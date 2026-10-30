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
import { DollarSign, Plus, Fuel, Wrench, Shield, Home } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([
    {
      id: 'exp-1',
      expense_date: '2026-10-28',
      category: 'diesel_fuel',
      amount: 8500,
      payment_method: 'upi',
      vendor: 'Indian Oil Corporation, Bhiwandi',
      vehicle_reg: 'MH-04-GP-4521',
      description: 'Diesel 92 Litres for Tata 1613',
    },
    {
      id: 'exp-2',
      expense_date: '2026-10-27',
      category: 'toll',
      amount: 680,
      payment_method: 'upi',
      vendor: 'Fastag Toll Plaza',
      vehicle_reg: 'MH-04-GP-4521',
      description: 'Mumbai-Pune Expressway Toll',
    },
    {
      id: 'exp-3',
      expense_date: '2026-10-26',
      category: 'vehicle_repair',
      amount: 3200,
      payment_method: 'cash',
      vendor: 'Sai Auto Garage',
      vehicle_reg: 'MH-03-CP-1204',
      description: 'Brake pad replacement and oil top-up',
    },
    {
      id: 'exp-4',
      expense_date: '2026-10-20',
      category: 'warehouse_rent',
      amount: 45000,
      payment_method: 'bank_transfer',
      vendor: 'Mankoli Logistics Park',
      vehicle_reg: 'General Godown',
      description: 'Monthly Bhiwandi Godown Lease Rent',
    },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    category: 'diesel_fuel',
    amount: '4000',
    payment_method: 'upi',
    vendor: 'Bharat Petroleum',
    vehicle_reg: 'MH-43-BP-8890',
    description: 'Diesel top up',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(formData.amount) || 0
    const newExp = {
      id: `exp-${Date.now()}`,
      expense_date: new Date().toISOString().split('T')[0],
      category: formData.category,
      amount: amt,
      payment_method: formData.payment_method,
      vendor: formData.vendor,
      vehicle_reg: formData.vehicle_reg,
      description: formData.description,
    }
    setExpenses([newExp, ...expenses])
    toast({
      title: 'Expense Logged',
      description: `₹${amt} recorded under ${formData.category.replace('_', ' ')}.`,
      variant: 'success',
    })
    setIsOpen(false)
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'category',
      header: 'Category & Date',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 capitalize block">
            {row.original.category.replace('_', ' ')}
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
                <Input
                  placeholder="MH-04-GP-4521"
                  value={formData.vehicle_reg}
                  onChange={(e) => setFormData({ ...formData, vehicle_reg: e.target.value })}
                />
              </div>
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
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Save Expense
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
