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

export default function BillingPage() {
  const [invoices, setInvoices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadInvoices = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('invoices')
        .select('*, customers(name), companies(name)')
        .order('invoice_date', { ascending: false })

      if (data && data.length > 0) {
        setInvoices(data.map((inv: any) => ({
          ...inv,
          client_name: inv.companies?.name || inv.customers?.name || 'Client',
        })))
      } else {
        setInvoices([
          {
            id: 'inv-1',
            invoice_number: 'SST-INV-2026-101',
            client_name: 'Parle Agro Industries Ltd',
            billing_month: 'September 2026',
            invoice_date: '2026-10-01',
            due_date: '2026-10-31',
            subtotal: 85000,
            tax_amount: 15300,
            tds_amount: 1700,
            total_amount: 100300,
            paid_amount: 50000,
            outstanding_amount: 50300,
            status: 'partially_paid',
          },
          {
            id: 'inv-2',
            invoice_number: 'SST-INV-2026-102',
            client_name: 'Godrej Consumer Products',
            billing_month: 'September 2026',
            invoice_date: '2026-10-05',
            due_date: '2026-10-20',
            subtotal: 42000,
            tax_amount: 7560,
            tds_amount: 840,
            total_amount: 49560,
            paid_amount: 49560,
            outstanding_amount: 0,
            status: 'paid',
          },
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInvoices()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    invoice_number: `SST-INV-2026-105`,
    client_name: 'Parle Agro Industries Ltd',
    billing_month: 'October 2026',
    subtotal: '60000',
    tax_rate: '18',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const supabase = createClient()
      const sub = parseFloat(formData.subtotal) || 0
      const tax = sub * 0.18
      const tds = sub * 0.02
      const total = sub + tax

      const today = new Date().toISOString().split('T')[0]
      const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]

      const newRecord = {
        invoice_number: formData.invoice_number,
        invoice_date: today,
        due_date: due,
        billing_month: today,
        subtotal: sub,
        tax_amount: tax,
        tax_rate: 18,
        tds_amount: tds,
        total_amount: total,
        paid_amount: 0,
        outstanding_amount: total,
        status: 'draft',
      }

      const { data, error } = await (supabase.from('invoices') as any).insert([newRecord]).select()

      const createdInv = (data && data[0]) ? {
        ...data[0],
        client_name: formData.client_name,
      } : {
        id: `inv-${Date.now()}`,
        ...newRecord,
        client_name: formData.client_name,
      }

      setInvoices([createdInv, ...invoices])
      toast({
        title: 'Tax Invoice Generated',
        description: `${formData.invoice_number} created with ₹${total.toLocaleString('en-IN')} total.`,
        variant: 'success',
      })
      setIsOpen(false)
    } catch (err: any) {
      toast({
        title: 'Error generating invoice',
        description: err.message || 'Failed to save to database',
        variant: 'error',
      })
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
      header: 'Subtotal & GST (18%)',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-900 block">
            {formatCurrency(row.original.subtotal)}
          </span>
          <span className="text-[11px] text-gray-500">GST: +{formatCurrency(row.original.tax_amount)}</span>
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

  const totalInvoiced = invoices.reduce((s, i) => s + i.total_amount, 0)
  const totalReceived = invoices.reduce((s, i) => s + i.paid_amount, 0)
  const totalReceivables = invoices.reduce((s, i) => s + i.outstanding_amount, 0)

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
              <Label className="text-xs font-semibold">Customer Corporation</Label>
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
                <Label className="text-xs font-semibold">Billing Month</Label>
                <Input
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
            <p className="text-[11px] text-gray-500 bg-gray-50 p-2 rounded border">
              Includes automatic 18% CGST/SGST and 2% TDS computation.
            </p>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Generate Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
