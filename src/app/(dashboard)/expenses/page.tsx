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
import { DollarSign, Plus, Fuel, Wrench, Shield, Home } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

function toRow(e: any) {
  return { ...e, vehicle_reg: e.vehicles?.registration_number || 'General / Godown' }
}

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadExpenses = async () => {
    try {
      const supabase = createClient()
      const [expRes, vehRes] = await Promise.all([
        supabase
          .from('expenses')
          .select('*, vehicles(registration_number)')
          .order('expense_date', { ascending: false }),
        supabase.from('vehicles').select('id, registration_number').order('registration_number'),
      ])

      if (expRes.error) throw expRes.error
      setExpenses((expRes.data || []).map(toRow))
      setVehicleOptions((vehRes.data as any) || [])
    } catch (err) {
      console.error('Failed to load expenses:', err)
      setExpenses([])
      toast({ title: 'Could not load expenses', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadExpenses()
  }, [])

  const [vehicleOptions, setVehicleOptions] = useState<Array<{ id: string; registration_number: string }>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, can } = useUser()
  const canManage = can('MANAGE_EXPENSES')
  const emptyForm = {
    category: 'diesel_fuel',
    amount: '',
    payment_method: 'cash',
    vendor: '',
    vehicle_id: '',
    description: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const amt = parseAmount(formData.amount)
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
        expense_date: todayIST(),
        category: formData.category as any,
        amount: amt,
        payment_method: formData.payment_method as any,
        vendor: formData.vendor.trim() || null,
        vehicle_id: formData.vehicle_id || null,
        description: formData.description.trim() || null,
        entered_by: user.id,
      }

      const { data, error } = await (supabase.from('expenses') as any)
        .insert([newRecord])
        .select('*, vehicles(registration_number)')
      if (error) throw error
      if (!data?.[0]) throw new Error('The expense was not saved. Please try again.')

      setExpenses(prev => [toRow(data[0]), ...prev])
      toast({
        title: 'Expense Logged',
        description: `₹${amt.toLocaleString('en-IN')} recorded under ${formData.category.replace(/_/g, ' ')}.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error saving expense',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'category',
      header: 'Category & Date',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 capitalize block">
            {row.original.category.replace(/_/g, ' ')}
          </span>
          <span className="text-[11px] text-gray-500">{formatDate(row.original.expense_date)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-rose-700 block">
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: 'vendor',
      header: 'Vendor & Vehicle',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-900 block">{row.original.vendor}</span>
          <span className="text-[11px] text-gray-500">{row.original.vehicle_reg}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600 truncate block max-w-xs">{row.original.description}</span>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: 'Payment Mode',
      cell: ({ row }) => (
        <span className="text-xs uppercase text-gray-600 font-semibold">
          {row.original.payment_method}
        </span>
      ),
    },
  ]

  const totalFuel = expenses.filter(e => e.category === 'diesel_fuel').reduce((s, e) => s + e.amount, 0)
  const totalRepairs = expenses.filter(e => e.category === 'vehicle_repair').reduce((s, e) => s + e.amount, 0)
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operating & Transport Expenses"
        description="Daily diesel logs, highway FASTag tolls, vehicle garage repairs, godown lease and operating overheads"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Expense
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Operating Expenses"
          value={formatCurrency(totalExpenses)}
          subtitle="All recorded disbursements"
          icon={DollarSign}
        />
        <KPICard
          title="Diesel & Fuel"
          value={formatCurrency(totalFuel)}
          subtitle="Fleet fuel cost"
          icon={Fuel}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Repairs & Garage"
          value={formatCurrency(totalRepairs)}
          subtitle="Spares, brakes & maintenance"
          icon={Wrench}
          iconClassName="bg-blue-50 text-blue-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        loading={loading}
        searchColumn="vendor"
        searchPlaceholder="Search vendor or category..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Record Transport Expense</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Log fuel bill, toll slip, spare parts or facility rent.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Expense Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diesel_fuel">Diesel & Fuel</SelectItem>
                    <SelectItem value="toll">FASTag / Toll</SelectItem>
                    <SelectItem value="vehicle_repair">Vehicle Repairs</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="warehouse_rent">Warehouse Rent</SelectItem>
                    <SelectItem value="office">Office / Overhead</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Amount (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="4000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vendor / Pump Name</Label>
                <Input
                  placeholder="Bharat Petroleum"
                  value={formData.vendor}
                  onChange={(e) => setFormData({ ...formData, vendor: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Related Vehicle</Label>
                <Select
                  value={formData.vehicle_id || 'none'}
                  onValueChange={(val) => setFormData({ ...formData, vehicle_id: val === 'none' ? '' : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">General / Godown (no vehicle)</SelectItem>
                    {vehicleOptions.map(v => (
                      <SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select
                value={formData.payment_method}
                onValueChange={(val) => setFormData({ ...formData, payment_method: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Description</Label>
              <Input
                placeholder="Diesel 45 Litres filled at Mankoli Naka"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
