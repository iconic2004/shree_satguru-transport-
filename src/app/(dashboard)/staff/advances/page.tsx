'use client'

import { useState } from 'react'
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
import { Wallet, Plus, CreditCard, CheckCircle2, ArrowDownRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'

export default function StaffAdvancesPage() {
  const [advances, setAdvances] = useState([
    {
      id: 'adv-1',
      staff_name: 'Ramesh Yadav',
      staff_type: 'driver',
      date: '2026-10-18',
      amount: 5000,
      applied_amount: 5000,
      remaining_amount: 0,
      payment_method: 'upi',
      reason: 'Diwali family advance',
      status: 'fully_applied',
    },
    {
      id: 'adv-2',
      staff_name: 'Baban Kamble',
      staff_type: 'labourer',
      date: '2026-10-22',
      amount: 2000,
      applied_amount: 1000,
      remaining_amount: 1000,
      payment_method: 'cash',
      reason: 'Medical expense assistance',
      status: 'partially_applied',
    },
    {
      id: 'adv-3',
      staff_name: 'Santosh Patil',
      staff_type: 'driver',
      date: '2026-10-25',
      amount: 4000,
      applied_amount: 0,
      remaining_amount: 4000,
      payment_method: 'bank_transfer',
      reason: 'Route emergency advance',
      status: 'unapplied',
    },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    staff_name: 'Ramesh Yadav',
    staff_type: 'driver',
    amount: '3000',
    payment_method: 'cash',
    reason: 'Emergency travel advance',
    reference: '',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(formData.amount) || 0
    const newAdv = {
      id: `adv-${Date.now()}`,
      staff_name: formData.staff_name,
      staff_type: formData.staff_type,
      date: new Date().toISOString().split('T')[0],
      amount: amt,
      applied_amount: 0,
      remaining_amount: amt,
      payment_method: formData.payment_method,
      reason: formData.reason,
      status: 'unapplied',
    }
    setAdvances([newAdv, ...advances])
    toast({
      title: 'Advance Issued',
      description: `₹${amt} recorded for ${formData.staff_name}. Added to unapplied balance.`,
      variant: 'success',
    })
    setIsOpen(false)
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
              <Input
                required
                placeholder="Ramesh Yadav"
                value={formData.staff_name}
                onChange={(e) => setFormData({ ...formData, staff_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Role</Label>
                <Select
                  value={formData.staff_type}
                  onValueChange={(val) => setFormData({ ...formData, staff_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="labourer">Labourer</SelectItem>
                    <SelectItem value="helper">Helper</SelectItem>
                  </SelectContent>
                </Select>
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
            <div className="grid grid-cols-2 gap-3">
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
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Issue Advance
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
