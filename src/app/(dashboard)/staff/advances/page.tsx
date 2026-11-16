'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColumnDef } from '@tanstack/react-table'
import { Wallet, Plus, CreditCard, CheckCircle2, ArrowDownRight, RefreshCw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

interface Person {
  key: string
  id: string
  kind: 'driver' | 'staff'
  name: string
  staff_type: string
}

function toRow(adv: any) {
  const amount = Number(adv.amount) || 0
  const applied = Number(adv.applied_amount) || 0
  return {
    id: adv.id,
    staff_name: adv.drivers?.full_name || adv.staff_members?.full_name || '-',
    staff_type: adv.staff_type,
    date: adv.advance_date,
    amount,
    applied_amount: applied,
    remaining_amount: adv.remaining_amount != null ? Number(adv.remaining_amount) : amount - applied,
    payment_method: adv.payment_method,
    reason: adv.reason || '-',
    status: adv.status,
  }
}

export default function StaffAdvancesPage() {
  const [advances, setAdvances] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAdvances = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const [advRes, drvRes, stfRes] = await Promise.all([
        supabase
          .from('staff_advances')
          .select('*, drivers(full_name), staff_members(full_name)')
          .order('advance_date', { ascending: false }),
        supabase.from('drivers').select('id, full_name').eq('employment_status', 'active').order('full_name'),
        supabase.from('staff_members').select('id, full_name, staff_type').eq('employment_status', 'active').order('full_name'),
      ])

      if (advRes.error) throw advRes.error
      setAdvances((advRes.data || []).map(toRow))
      setPeople([
        ...((drvRes.data as any[]) || []).map(d => ({ key: `drv:${d.id}`, id: d.id, kind: 'driver' as const, name: d.full_name, staff_type: 'driver' })),
        ...((stfRes.data as any[]) || []).map(s => ({ key: `stf:${s.id}`, id: s.id, kind: 'staff' as const, name: s.full_name, staff_type: s.staff_type || 'labourer' })),
      ])
    } catch (err) {
      console.error('Failed to load advances:', err)
      setAdvances([])
      toast({ title: 'Could not load advances', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAdvances()
  }, [])

  const [people, setPeople] = useState<Person[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, can } = useUser()
  const canManage = can('MANAGE_ADVANCES')
  const emptyForm = {
    person_key: '',
    amount: '',
    payment_method: 'cash',
    reason: '',
    reference: '',
  }
  const [formData, setFormData] = useState(emptyForm)
  const selectedPerson = people.find(p => p.key === formData.person_key)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const amt = parseAmount(formData.amount)
    if (!selectedPerson) {
      toast({ title: 'Select the staff member receiving the advance', variant: 'error' })
      return
    }
    if (Number.isNaN(amt) || amt <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter an amount greater than 0.', variant: 'error' })
      return
    }
    if (!user) {
      toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const newRecord = {
        advance_date: todayIST(),
        amount: amt,
        staff_type: selectedPerson.staff_type,
        payment_method: formData.payment_method,
        payment_reference: formData.reference.trim() || null,
        reason: formData.reason.trim() || null,
        status: 'unapplied',
        applied_amount: 0,
        remaining_amount: amt,
        driver_id: selectedPerson.kind === 'driver' ? selectedPerson.id : null,
        staff_member_id: selectedPerson.kind === 'staff' ? selectedPerson.id : null,
        recorded_by: user.id,
      }

      const { data, error } = await (supabase.from('staff_advances') as any)
        .insert([newRecord])
        .select('*, drivers(full_name), staff_members(full_name)')
      if (error) throw error
      if (!data?.[0]) throw new Error('The advance was not saved. Please try again.')

      setAdvances(prev => [toRow(data[0]), ...prev])
      toast({
        title: 'Advance Issued',
        description: `₹${amt.toLocaleString('en-IN')} recorded for ${selectedPerson.name}. Added to unapplied balance.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error recording advance',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'staff_name',
      header: 'Staff Member',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.staff_name}</span>
          <span className="text-[11px] font-semibold text-orange-600 uppercase">
            {row.original.staff_type}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'date',
      header: 'Issue Date',
      cell: ({ row }) => <span className="text-xs text-gray-600">{formatDate(row.original.date)}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'Advance Issued',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-navy-900 block">
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: 'applied_amount',
      header: 'Deducted in Payroll',
      cell: ({ row }) => (
        <span className="text-xs text-gray-700 block">
          {formatCurrency(row.original.applied_amount)}
        </span>
      ),
    },
    {
      accessorKey: 'remaining_amount',
      header: 'Unapplied Balance',
      cell: ({ row }) => (
        <span
          className={`text-xs font-bold block ${
            row.original.remaining_amount > 0 ? 'text-orange-600' : 'text-emerald-600'
          }`}
        >
          {formatCurrency(row.original.remaining_amount)}
        </span>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: 'Disbursement Method',
      cell: ({ row }) => (
        <span className="text-xs uppercase text-gray-600 font-semibold">
          {row.original.payment_method}
        </span>
      ),
    },
    {
      accessorKey: 'reason',
      header: 'Recorded Reason',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 truncate block max-w-xs">{row.original.reason}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            unapplied: 'bg-amber-50 text-amber-800 border-amber-200',
            partially_applied: 'bg-blue-50 text-blue-800 border-blue-200',
            fully_applied: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          }}
        />
      ),
    },
  ]

  const totalIssued = advances.reduce((s, a) => s + a.amount, 0)
  const totalApplied = advances.reduce((s, a) => s + a.applied_amount, 0)
  const totalUnapplied = advances.reduce((s, a) => s + a.remaining_amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver & Labour Advance Register"
        description="Issued cash advances, tracking deduction against future salary, and unapplied balances"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Issue Staff Advance
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Advances Issued"
          value={formatCurrency(totalIssued)}
          subtitle="Cumulative disbursements"
          icon={Wallet}
        />
        <KPICard
          title="Applied To Payroll"
          value={formatCurrency(totalApplied)}
          subtitle="Recovered in settlements"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Outstanding Unapplied Advances"
          value={formatCurrency(totalUnapplied)}
          subtitle="Awaiting salary deduction"
          icon={ArrowDownRight}
          iconClassName="bg-orange-50 text-orange-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={advances}
        loading={loading}
        searchColumn="staff_name"
        searchPlaceholder="Search staff member..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Record Staff Advance</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Disburse cash or UPI advance to driver or labourer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Staff Member *</Label>
              <Select
                value={formData.person_key}
                onValueChange={(val) => setFormData({ ...formData, person_key: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={people.length ? 'Select driver or staff member' : 'No drivers or staff registered'} />
                </SelectTrigger>
                <SelectContent>
                  {people.map(p => (
                    <SelectItem key={p.key} value={p.key}>
                      {p.name} ({p.staff_type.replace(/_/g, ' ')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Role</Label>
                <Input
                  readOnly
                  disabled
                  value={selectedPerson ? selectedPerson.staff_type.replace(/_/g, ' ') : '-'}
                  className="capitalize"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Advance Amount (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="3000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payment Mode</Label>
                <Select
                  value={formData.payment_method}
                  onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash in Hand</SelectItem>
                    <SelectItem value="upi">UPI / GPay</SelectItem>
                    <SelectItem value="bank_transfer">Direct Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reference / UTR</Label>
                <Input
                  placeholder="UPI Ref / Voucher No"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reason for Advance</Label>
              <Input
                placeholder="Family emergency, festival travel, vehicle trip expense"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Issue Advance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
