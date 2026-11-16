'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
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
import { Users, Plus, Phone, Wallet, CalendarDays } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'
import Link from 'next/link'

export default function StaffPage() {
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadStaff = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('staff_members')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      setStaff(data || [])
    } catch (err) {
      console.error('Failed to load staff:', err)
      setStaff([])
      toast({ title: 'Could not load staff', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStaff()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    staff_type: 'labourer',
    phone: '',
    daily_wage: '650',
    payment_method_preference: 'cash',
  })

  const [submitting, setSubmitting] = useState(false)
  const { can } = useUser()
  const canManage = can('MANAGE_STAFF')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const wage = parseAmount(formData.daily_wage)
    if (!formData.full_name.trim()) {
      toast({ title: 'Full name is required', variant: 'error' })
      return
    }
    if (Number.isNaN(wage) || wage < 0) {
      toast({ title: 'Invalid daily wage', description: 'Enter a number of 0 or more.', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const newRecord = {
        full_name: formData.full_name.trim(),
        staff_type: formData.staff_type as any,
        phone: formData.phone.trim() || null,
        daily_wage: wage,
        payment_method_preference: formData.payment_method_preference as any,
        employment_status: 'active',
        joining_date: todayIST(),
      }

      const { data, error } = await (supabase.from('staff_members') as any).insert([newRecord]).select()
      if (error) throw error
      if (!data?.[0]) throw new Error('The staff member was not saved. Please try again.')

      setStaff(prev => [data[0], ...prev])
      toast({
        title: 'Staff Member Enrolled',
        description: `${newRecord.full_name} added to staff roster.`,
        variant: 'success',
      })
      setFormData({ full_name: '', staff_type: 'labourer', phone: '', daily_wage: '650', payment_method_preference: 'cash' })
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error enrolling staff',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'full_name',
      header: 'Staff Member & Phone',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.full_name}</span>
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {row.original.phone}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'staff_type',
      header: 'Role / Designation',
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-orange-100 text-orange-800">
          {row.original.staff_type.replace('_', ' ')}
        </span>
      ),
    },
    {
      accessorKey: 'daily_wage',
      header: 'Agreed Daily Wage',
      cell: ({ row }) => (
        <span className="font-bold text-navy-900 text-xs">
          {formatCurrency(row.original.daily_wage)} / day
        </span>
      ),
    },
    {
      accessorKey: 'payment_method_preference',
      header: 'Payment Method',
      cell: ({ row }) => (
        <span className="text-xs uppercase text-gray-600 font-medium">
          {row.original.payment_method_preference}
        </span>
      ),
    },
    {
      accessorKey: 'employment_status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.employment_status}
          colors={{
            active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            inactive: 'bg-gray-100 text-gray-800 border-gray-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Quick Action',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Button asChild variant="outline" size="sm" className="h-7 text-xs">
            <Link href="/staff/advances">Advance</Link>
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Labourers & Warehouse Helpers"
        description="Daily wage workers, godown loaders/unloaders, helpers and wage configurations"
        actions={
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="sm" className="text-xs">
              <Link href="/staff/attendance">
                <CalendarDays className="w-3.5 h-3.5 mr-1.5" />
                Mark Today&apos;s Attendance
              </Link>
            </Button>
            <Button
              size="sm"
              className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
              onClick={() => setIsOpen(true)}
              disabled={!canManage}
              title={canManage ? undefined : 'You do not have permission to add records here'}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              Add Labourer / Helper
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={staff}
        loading={loading}
        searchColumn="full_name"
        searchPlaceholder="Search staff member name..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Enroll Labourer or Helper</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Set agreed daily wage rate and payout method preference.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                required
                placeholder="Baban Kamble"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Staff Type</Label>
                <Select
                  value={formData.staff_type}
                  onValueChange={(val) => setFormData({ ...formData, staff_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="labourer">Labourer (Loader/Unloader)</SelectItem>
                    <SelectItem value="helper">Trip Helper</SelectItem>
                    <SelectItem value="warehouse_staff">Warehouse Floor Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  placeholder="+91 96190 22334"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Daily Wage (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="650"
                  value={formData.daily_wage}
                  onChange={(e) => setFormData({ ...formData, daily_wage: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payment Method</Label>
                <Select
                  value={formData.payment_method_preference}
                  onValueChange={(val) => setFormData({ ...formData, payment_method_preference: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Enroll Staff
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
