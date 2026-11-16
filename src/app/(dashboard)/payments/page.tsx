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
import { CreditCard, Plus, CheckCircle2, ArrowDownRight, RefreshCw } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

interface OpenInvoice {
  id: string
  invoice_number: string
  customer_id: string
  company_id: string | null
  outstanding_amount: number
  client_name: string
}

function toRow(p: any) {
  return {
    id: p.id,
    payment_date: p.payment_date,
    client_name: p.customers?.name || p.companies?.name || '-',
    amount: Number(p.amount) || 0,
    payment_method: p.payment_method,
    reference_number: p.payment_reference || '-',
    bank_name: p.bank_name || '-',
    allocated_invoice: p.invoices?.invoice_number || 'Unallocated',
    status: p.status,
  }
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadPayments = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const [payRes, invRes] = await Promise.all([
        supabase
          .from('payments')
          .select('*, customers(name), companies(name), invoices(invoice_number)')
          .order('payment_date', { ascending: false }),
        supabase
          .from('invoices')
          .select('id, invoice_number, customer_id, company_id, outstanding_amount, status, customers(name)')
          .gt('outstanding_amount', 0)
          .not('status', 'in', '(cancelled,credited)')
          .order('invoice_date', { ascending: false }),
      ])

      if (payRes.error) throw payRes.error
      setPayments((payRes.data || []).map(toRow))
      setOpenInvoices(((invRes.data as any[]) || []).map(inv => ({
        ...inv,
        outstanding_amount: Number(inv.outstanding_amount) || 0,
        client_name: inv.customers?.name || '-',
      })))
    } catch (err) {
      console.error('Failed to load payments:', err)
      setPayments([])
      toast({ title: 'Could not load payments', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayments()
  }, [])

  const [openInvoices, setOpenInvoices] = useState<OpenInvoice[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, can } = useUser()
  const canManage = can('MANAGE_PAYMENTS')
  const emptyForm = {
    invoice_id: '',
    amount: '',
    payment_method: 'neft',
    reference_number: '',
    bank_name: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const invoice = openInvoices.find(i => i.id === formData.invoice_id)
    const amt = parseAmount(formData.amount)
    if (!invoice) {
      toast({ title: 'Select the invoice this payment is for', variant: 'error' })
      return
    }
    if (Number.isNaN(amt) || amt <= 0) {
      toast({ title: 'Invalid amount', description: 'Enter an amount greater than 0.', variant: 'error' })
      return
    }
    if (amt > invoice.outstanding_amount) {
      toast({
        title: 'Amount exceeds balance',
        description: `Invoice ${invoice.invoice_number} has only ${formatCurrency(invoice.outstanding_amount)} outstanding.`,
        variant: 'error',
      })
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
        invoice_id: invoice.id,
        customer_id: invoice.customer_id,
        company_id: invoice.company_id,
        payment_date: todayIST(),
        amount: amt,
        payment_method: formData.payment_method,
        payment_reference: formData.reference_number.trim() || null,
        bank_name: formData.bank_name.trim() || null,
        status: 'completed',
        recorded_by: user.id,
      }

      // The invoice's paid / outstanding amounts are updated atomically by the
      // trg_apply_payment_to_invoice trigger (migration 00011).
      const { data, error } = await (supabase.from('payments') as any)
        .insert([newRecord])
        .select('*, customers(name), companies(name), invoices(invoice_number)')
      if (error) throw error
      if (!data?.[0]) throw new Error('The payment was not saved. Please try again.')

      toast({
        title: 'Payment Received',
        description: `${formatCurrency(amt)} from ${invoice.client_name} applied to ${invoice.invoice_number}.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
      await loadPayments()
    } catch (err) {
      toast({
        title: 'Error saving payment',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
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
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Record Payment Receipt
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={payments}
        loading={loading}
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
              <Label className="text-xs font-semibold">Against Invoice *</Label>
              <Select
                value={formData.invoice_id}
                onValueChange={(val) => setFormData({ ...formData, invoice_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={openInvoices.length ? 'Select an open invoice' : 'No invoices with an outstanding balance'} />
                </SelectTrigger>
                <SelectContent>
                  {openInvoices.map(inv => (
                    <SelectItem key={inv.id} value={inv.id}>
                      {inv.invoice_number} — {inv.client_name} (due {formatCurrency(inv.outstanding_amount)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                    <SelectItem value="bank_transfer">Bank Transfer (IMPS / other)</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                    <SelectItem value="upi">UPI</SelectItem>
                    <SelectItem value="cash">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Confirm Receipt
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
