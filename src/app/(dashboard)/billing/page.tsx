'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
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
import { Receipt, Plus, Printer, CheckCircle, FileText, ArrowUpRight, DollarSign } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { computeInvoiceTotals, sumBy } from '@/lib/utils/finance'
import { useUser } from '@/lib/hooks/use-user'

interface CustomerOption {
  id: string
  name: string
  gstin: string | null
  company_id: string | null
}

function toRow(inv: any) {
  return { ...inv, client_name: inv.customers?.name || inv.companies?.name || '-' }
}

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadInvoices = async () => {
    try {
      const supabase = createClient()
      const [invRes, custRes] = await Promise.all([
        supabase
          .from('invoices')
          .select('*, customers(name), companies(name)')
          .order('invoice_date', { ascending: false }),
        supabase
          .from('customers')
          .select('id, name, gstin, company_id')
          .eq('is_active', true)
          .order('name'),
      ])

      if (invRes.error) throw invRes.error
      setInvoices((invRes.data || []).map(toRow))
      setCustomerOptions((custRes.data as any) || [])
    } catch (err) {
      console.error('Failed to load invoices:', err)
      setInvoices([])
      toast({ title: 'Could not load invoices', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const [customerOptions, setCustomerOptions] = useState<CustomerOption[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, can } = useUser()
  const canManage = can('MANAGE_BILLING')
  const emptyForm = {
    invoice_number: '',
    customer_id: '',
    billing_month: todayIST().slice(0, 7),
    subtotal: '',
    tax_rate: '18',
  }
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const customer = customerOptions.find(c => c.id === formData.customer_id)
    const sub = parseAmount(formData.subtotal)
    const rate = parseAmount(formData.tax_rate)
    if (!formData.invoice_number.trim()) {
      toast({ title: 'Invoice number is required', variant: 'error' })
      return
    }
    if (!customer) {
      toast({ title: 'Select a customer', description: 'Invoices must be billed to a registered customer.', variant: 'error' })
      return
    }
    if (Number.isNaN(sub) || sub <= 0) {
      toast({ title: 'Invalid subtotal', description: 'Enter a freight amount greater than 0.', variant: 'error' })
      return
    }
    if (!/^\d{4}-\d{2}$/.test(formData.billing_month)) {
      toast({ title: 'Select the billing month', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const totals = computeInvoiceTotals(sub, rate)
      const today = todayIST()
      const supabase = createClient()

      const newRecord = {
        invoice_number: formData.invoice_number.trim(),
        customer_id: customer.id,
        company_id: customer.company_id,
        gst_number: customer.gstin,
        invoice_date: today,
        due_date: addDays(today, 30),
        billing_month: `${formData.billing_month}-01`,
        ...totals,
        paid_amount: 0,
        outstanding_amount: totals.total_amount,
        status: 'draft',
        created_by: user?.id ?? null,
      }

      const { data, error } = await (supabase.from('invoices') as any)
        .insert([newRecord])
        .select('*, customers(name), companies(name)')
      if (error) {
        if (error.code === '23505') throw new Error(`Invoice number ${newRecord.invoice_number} already exists.`)
        throw error
      }
      if (!data?.[0]) throw new Error('The invoice was not saved. Please try again.')

      setInvoices(prev => [toRow(data[0]), ...prev])
      toast({
        title: 'Tax Invoice Generated',
        description: `${newRecord.invoice_number} created with ${formatCurrency(totals.total_amount)} total.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error creating invoice',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'invoice_number',
      header: 'Invoice No & Month',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.invoice_number}</span>
          <span className="text-[11px] text-gray-500">{row.original.billing_month}</span>
        </div>
      ),
    },
    {
      accessorKey: 'client_name',
      header: 'Billed Client Company',
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-gray-900 block">{row.original.client_name}</span>
          <span className="text-[11px] text-gray-500">Due: {formatDate(row.original.due_date)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'subtotal',
      header: 'Subtotal & GST',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-900 block">
            {formatCurrency(row.original.subtotal)}
          </span>
          <span className="text-[11px] text-gray-500">GST {Number(row.original.tax_rate) || 0}%: +{formatCurrency(row.original.tax_amount)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: 'Total Invoiced',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-navy-950 block">
          {formatCurrency(row.original.total_amount)}
        </span>
      ),
    },
    {
      accessorKey: 'outstanding_amount',
      header: 'Outstanding Balance',
      cell: ({ row }) => (
        <span
          className={`text-xs font-bold block ${
            row.original.outstanding_amount > 0 ? 'text-amber-700' : 'text-emerald-700'
          }`}
        >
          {formatCurrency(row.original.outstanding_amount)}
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
            paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            partially_paid: 'bg-amber-50 text-amber-800 border-amber-200',
            issued: 'bg-blue-50 text-blue-800 border-blue-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Print Tax Invoice',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex items-center gap-1"
          onClick={() => window.print()}
        >
          <Printer className="w-3.5 h-3.5" />
          Print PDF
        </Button>
      ),
    },
  ]

  // Cancelled / credited invoices are not revenue.
  const activeInvoices = invoices.filter(i => i.status !== 'cancelled' && i.status !== 'credited')
  const totalInvoiced = sumBy(activeInvoices, i => i.total_amount)
  const totalReceived = sumBy(activeInvoices, i => i.paid_amount)
  const totalReceivables = sumBy(activeInvoices, i => i.outstanding_amount)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Monthly Customer Billing & Invoices"
        description="Generate freight tax invoices, apply customer contract rate cards, include fuel surcharges, tolls and track payment collections"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Generate Monthly Invoice
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Total Billed Revenue"
          value={formatCurrency(totalInvoiced)}
          subtitle="Tax invoices issued"
          icon={Receipt}
        />
        <KPICard
          title="Payments Collected"
          value={formatCurrency(totalReceived)}
          subtitle="Deposited in bank"
          icon={CheckCircle}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Outstanding Receivables"
          value={formatCurrency(totalReceivables)}
          subtitle="Customer payments due"
          icon={DollarSign}
          iconClassName="bg-amber-50 text-amber-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={invoices}
        loading={loading}
        searchColumn="invoice_number"
        searchPlaceholder="Search invoice no or client..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Create Customer Freight Invoice</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Generate monthly GST invoice against eligible delivery stops and trip records.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Invoice Number</Label>
              <Input
                required
                value={formData.invoice_number}
                onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Customer *</Label>
              <Select
                value={formData.customer_id}
                onValueChange={(val) => setFormData({ ...formData, customer_id: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={customerOptions.length ? 'Select customer' : 'No customers registered'} />
                </SelectTrigger>
                <SelectContent>
                  {customerOptions.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Billing Month *</Label>
                <Input
                  type="month"
                  required
                  value={formData.billing_month}
                  onChange={(e) => setFormData({ ...formData, billing_month: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Subtotal Freight (₹)</Label>
                <Input
                  required
                  type="number"
                  placeholder="60000"
                  value={formData.subtotal}
                  onChange={(e) => setFormData({ ...formData, subtotal: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">GST Rate</Label>
              <Select
                value={formData.tax_rate}
                onValueChange={(val) => setFormData({ ...formData, tax_rate: val })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">0% (Exempt / RCM)</SelectItem>
                  <SelectItem value="5">5%</SelectItem>
                  <SelectItem value="12">12%</SelectItem>
                  <SelectItem value="18">18%</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded border">
              GST is added at the selected rate. 2% TDS is recorded for reference (deducted by the customer at payment).
            </p>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Generate Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
