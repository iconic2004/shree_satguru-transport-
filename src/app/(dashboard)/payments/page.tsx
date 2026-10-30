'use client'

import { useState } from 'react'
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
import { CreditCard, Plus, CheckCircle2, ArrowDownRight } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'

export default function PaymentsPage() {
  const [payments, setPayments] = useState([
    {
      id: 'pay-c1',
      payment_date: '2026-10-15',
      client_name: 'Parle Agro Industries Ltd',
      amount: 50000,
      payment_method: 'neft',
      reference_number: 'CMS9812401290',
      bank_name: 'HDFC Bank Ltd',
      allocated_invoice: 'SST-INV-2026-101',
      status: 'completed',
    },
    {
      id: 'pay-c2',
      payment_date: '2026-10-18',
      client_name: 'Godrej Consumer Products',
      amount: 49560,
      payment_method: 'rtgs',
      reference_number: 'AXISRTGS88102',
      bank_name: 'Axis Bank',
      allocated_invoice: 'SST-INV-2026-102',
      status: 'completed',
    },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    client_name: 'Parle Agro Industries Ltd',
    amount: '30000',
    payment_method: 'neft',
    reference_number: '',
    bank_name: 'ICICI Bank',
    allocated_invoice: 'SST-INV-2026-101',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const amt = parseFloat(formData.amount) || 0
    const newPay = {
      id: `pay-c-${Date.now()}`,
      payment_date: new Date().toISOString().split('T')[0],
      client_name: formData.client_name,
      amount: amt,
      payment_method: formData.payment_method,
      reference_number: formData.reference_number || 'TRX-DEFAULT',
      bank_name: formData.bank_name,
      allocated_invoice: formData.allocated_invoice,
      status: 'completed',
    }
    setPayments([newPay, ...payments])
    toast({
      title: 'Payment Received',
      description: `₹${amt} from ${formData.client_name} allocated to ${formData.allocated_invoice}.`,
      variant: 'success',
    })
    setIsOpen(false)
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'payment_date',
      header: 'Date & Client',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.client_name}</span>
          <span className="text-[11px] text-gray-500">{formatDate(row.original.payment_date)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'amount',
      header: 'Amount Collected',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-emerald-700 block">
          {formatCurrency(row.original.amount)}
        </span>
      ),
    },
    {
      accessorKey: 'payment_method',
      header: 'Mode & Bank Ref',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-900 uppercase block">
            {row.original.payment_method}
          </span>
          <span className="text-[11px] text-gray-500">
            {row.original.bank_name} • Ref: {row.original.reference_number}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'allocated_invoice',
      header: 'Allocated Invoice',
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-navy-800 bg-navy-50 px-2.5 py-0.5 rounded border border-navy-200">
          {row.original.allocated_invoice}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            completed: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            pending: 'bg-amber-50 text-amber-800 border-amber-200',
          }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Payments & Collections"
        description="Record incoming client bank transfers, cheques and NEFT payments with exact invoice allocation"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Payment Receipt
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={payments}
        searchColumn="client_name"
        searchPlaceholder="Search client name..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Record Client Payment</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Apply bank deposit or remittance against customer freight invoice.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Client Company</Label>
              <Select
                value={formData.client_name}
                onValueChange={(val) => setFormData({ ...formData, client_name: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Parle Agro Industries Ltd">Parle Agro Industries Ltd</SelectItem>
                  <SelectItem value="Godrej Consumer Products">Godrej Consumer Products</SelectItem>
                  <SelectItem value="Asian Paints Ltd">Asian Paints Ltd</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Amount Received (₹) *</Label>
                <Input
                  required
                  type="number"
                  placeholder="30000"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                />
              </div>
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
                    <SelectItem value="neft">NEFT</SelectItem>
                    <SelectItem value="rtgs">RTGS</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Bank Name</Label>
                <Input
                  placeholder="HDFC Bank"
                  value={formData.bank_name}
                  onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Reference / UTR No</Label>
                <Input
                  placeholder="UTR99881122"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Allocate To Invoice</Label>
              <Input
                placeholder="SST-INV-2026-101"
                value={formData.allocated_invoice}
                onChange={(e) => setFormData({ ...formData, allocated_invoice: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Confirm Receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
