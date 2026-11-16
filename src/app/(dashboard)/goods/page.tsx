'use client'

import { useState, useEffect } from 'react'
import { PageHeader } from '@/components/shared/page-header'
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
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST } from '@/lib/utils/validation'
import { toCsv, downloadCsv } from '@/lib/utils/csv'
import { useUser } from '@/lib/hooks/use-user'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/formatting'
import { ColumnDef } from '@tanstack/react-table'
import { Package, Plus, Download, Filter, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function GoodsPage() {
  const [goods, setGoods] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [formData, setFormData] = useState({
    invoice_number: '',
    challan_number: '',
    consignor_name: '',
    consignee_name: '',
    product_category: 'FMCG',
    product_name: '',
    quantity: '',
    unit: 'cartons',
    weight_kg: '',
    delivery_city: '',
    priority: 'normal',
    handling_instructions: '',
  })

  const loadGoods = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/goods', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success || !Array.isArray(json.data)) {
        throw new Error(json?.error || `Request failed (${res.status})`)
      }
      setGoods(json.data)
    } catch (err) {
      console.error('loadGoods error:', err)
      setGoods([])
      toast({ title: 'Could not load goods register', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadGoods()
  }, [])

  const handleCreateGoods = async (e?: React.FormEvent) => {
    if (e && e.preventDefault) e.preventDefault()

    const quantity = parseAmount(formData.quantity)
    const weight = parseAmount(formData.weight_kg)
    if (!formData.invoice_number.trim() || !formData.product_name.trim() || !formData.delivery_city.trim()) {
      toast({
        title: 'Validation Missing',
        description: 'Invoice number, product name and destination city are required.',
        variant: 'error',
      })
      return
    }
    if (Number.isNaN(quantity) || quantity <= 0) {
      toast({ title: 'Invalid quantity', description: 'Quantity must be greater than 0.', variant: 'error' })
      return
    }
    if (Number.isNaN(weight) || weight < 0) {
      toast({ title: 'Invalid weight', description: 'Weight must be 0 or more.', variant: 'error' })
      return
    }

    setIsSubmitting(true)

    const payload = {
      invoice_number: formData.invoice_number.trim(),
      challan_number: formData.challan_number.trim() || null,
      consignor_name: formData.consignor_name.trim() || 'General Consignor',
      consignee_name: formData.consignee_name.trim() || null,
      product_name: formData.product_name.trim(),
      product_category: formData.product_category.trim() || 'General Cargo',
      quantity,
      unit: formData.unit.trim() || 'cartons',
      weight_kg: weight,
      delivery_city: formData.delivery_city.trim(),
      priority: formData.priority || 'normal',
      handling_instructions: formData.handling_instructions.trim() || null,
    }

    try {
      const res = await fetch('/api/goods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error || `Request failed (${res.status})`)
      }

      setGoods((prev) => [json.data, ...prev])

      toast({
        title: 'Goods Receipt Created',
        description: `Invoice ${payload.invoice_number} registered successfully.`,
        variant: 'success',
      })

      // Reset form and close dialog
      setFormData({
        invoice_number: '',
        challan_number: '',
        consignor_name: '',
        consignee_name: '',
        product_category: 'FMCG',
        product_name: '',
        quantity: '',
        unit: 'cartons',
        weight_kg: '',
        delivery_city: '',
        priority: 'normal',
        handling_instructions: '',
      })
      setIsCreateOpen(false)
    } catch (err) {
      console.error('handleCreateGoods error:', err)
      // Keep the dialog open so the user can correct and retry without retyping.
      toast({
        title: 'Goods receipt NOT saved',
        description: getErrorMessage(err, 'Failed to save goods receipt'),
        variant: 'error',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const { can } = useUser()
  const canManage = can('MANAGE_GOODS')

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'invoice_number',
      header: 'Invoice & Challan',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.invoice_number}</span>
          <span className="text-[11px] text-gray-500">Challan: {row.original.challan_number || '-'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'product_name',
      header: 'Product & Cargo',
      cell: ({ row }) => (
        <div>
          <span className="font-semibold text-gray-900 block">{row.original.product_name}</span>
          <span className="text-[11px] text-gray-500">
            {formatNumber(row.original.quantity)} {row.original.unit || 'units'} • {formatNumber(row.original.weight_kg)} kg
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'consignor_name',
      header: 'Consignor / Client',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-700">
          {row.original.consignor_name || 'Direct Consignor'}
        </span>
      ),
    },
    {
      accessorKey: 'delivery_city',
      header: 'Destination',
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-navy-900">
          {row.original.delivery_city || '-'}
        </span>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ row }) => {
        const p = row.original.priority || 'normal'
        return (
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
              p === 'urgent'
                ? 'bg-rose-100 text-rose-800'
                : p === 'high'
                ? 'bg-orange-100 text-orange-800'
                : 'bg-gray-100 text-gray-700'
            }`}
          >
            {p}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status || 'expected'}
          colors={{
            available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            verification_pending: 'bg-amber-50 text-amber-700 border-amber-200',
            received: 'bg-blue-50 text-blue-700 border-blue-200',
            dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            delivered: 'bg-teal-50 text-teal-700 border-teal-200',
          }}
        />
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Received Date',
      cell: ({ row }) => (
        <span className="text-xs text-gray-500">{formatDate(row.original.created_at)}</span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Goods & Invoices Register"
        description="Record incoming goods receipts, challan verification, packaging quantities and delivery destinations"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="border-gray-300 text-xs"
              disabled={goods.length === 0}
              onClick={() => {
                const csv = toCsv(
                  ['Invoice', 'Challan', 'Consignor', 'Consignee', 'Product', 'Quantity', 'Unit', 'Weight (kg)', 'City', 'Priority', 'Status', 'Received'],
                  goods.map(g => [
                    g.invoice_number, g.challan_number, g.consignor_name, g.consignee_name, g.product_name,
                    Number(g.quantity), g.unit, Number(g.weight_kg), g.delivery_city, g.priority, g.status, formatDate(g.created_at),
                  ])
                )
                downloadCsv(`goods_register_${todayIST()}.csv`, csv)
              }}
            >
              <Download className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button
              size="sm"
              className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
              onClick={() => setIsCreateOpen(true)}
              disabled={!canManage}
              title={canManage ? undefined : 'You do not have permission to add goods receipts'}
            >
              <Plus className="w-4 h-4 mr-1.5" />
              New Goods Entry
            </Button>
          </div>
        }
      />

      <DataTable
        columns={columns}
        data={goods}
        loading={loading}
        searchColumn="invoice_number"
        searchPlaceholder="Search by invoice number or challan..."
        emptyTitle="No goods receipts recorded"
        emptyDescription="Incoming consignments and warehouse arrivals will show up here."
      />

      {/* New Goods Receipt Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Record New Goods Receipt</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Enter invoice, client and product cargo details to create godown inventory record.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateGoods} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Invoice Number *</Label>
                <Input
                  required
                  placeholder="e.g. INV-2026-0901"
                  value={formData.invoice_number}
                  onChange={(e) => setFormData({ ...formData, invoice_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Challan Number</Label>
                <Input
                  placeholder="e.g. CH-6012"
                  value={formData.challan_number}
                  onChange={(e) => setFormData({ ...formData, challan_number: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Consignor (Sender Company)</Label>
                <Input
                  placeholder="e.g. Consignor Enterprise"
                  value={formData.consignor_name}
                  onChange={(e) => setFormData({ ...formData, consignor_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Consignee (Customer / Receiver)</Label>
                <Input
                  placeholder="e.g. Reliance DC Bhiwandi"
                  value={formData.consignee_name}
                  onChange={(e) => setFormData({ ...formData, consignee_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <Label className="text-xs font-semibold">Product Name & Description *</Label>
                <Input
                  required
                  placeholder="e.g. Packaged Consumer Goods"
                  value={formData.product_name}
                  onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Category</Label>
                <Input
                  placeholder="e.g. Beverages"
                  value={formData.product_category}
                  onChange={(e) => setFormData({ ...formData, product_category: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Quantity *</Label>
                <Input
                  required
                  type="number"
                  placeholder="450"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Unit</Label>
                <Input
                  placeholder="cartons / bags / boxes"
                  value={formData.unit}
                  onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Weight in KG *</Label>
                <Input
                  required
                  type="number"
                  placeholder="4950"
                  value={formData.weight_kg}
                  onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Destination City *</Label>
                <Input
                  required
                  placeholder="e.g. Bhiwandi / Pune"
                  value={formData.delivery_city}
                  onChange={(e) => setFormData({ ...formData, delivery_city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Priority</Label>
                <Select
                  value={formData.priority}
                  onValueChange={(val) => setFormData({ ...formData, priority: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Handling Instructions</Label>
              <Input
                placeholder="e.g. Keep dry, stack max 5 high, fragile cargo"
                value={formData.handling_instructions}
                onChange={(e) => setFormData({ ...formData, handling_instructions: e.target.value })}
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-navy-900 hover:bg-navy-950 text-white font-semibold flex items-center gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Goods Receipt</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
