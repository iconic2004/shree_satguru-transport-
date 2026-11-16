'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { ColumnDef } from '@tanstack/react-table'
import { formatNumber } from '@/lib/utils/formatting'
import { Warehouse, CheckSquare, Box, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { useUser } from '@/lib/hooks/use-user'

/** Goods physically held in a godown (excludes expected, dispatched, delivered, returned). */
const IN_GODOWN_STATUSES = ['received', 'verification_pending', 'available', 'reserved', 'partially_dispatched', 'damaged', 'on_hold'] as const
const RELEASED_STATUSES = new Set(['available', 'reserved', 'partially_dispatched'])

function toStockRow(item: any) {
  const items: any[] = item.goods_items || []
  const accepted = items.reduce((s, i) => s + (Number(i.accepted_quantity) || 0), 0)
  const damaged = items.reduce((s, i) => s + (Number(i.damaged_quantity) || 0), 0)
  // Use per-item counts once a physical count has been recorded, otherwise the receipt quantity.
  const actual = items.length > 0 && accepted + damaged > 0 ? accepted + damaged : Number(item.quantity) || 0
  return {
    id: item.id,
    warehouse_name: item.warehouses?.name || 'Unassigned warehouse',
    bay_name: item.warehouse_locations?.name || 'No bay assigned',
    product_name: item.product_name,
    actual_qty: actual,
    damaged_qty: damaged,
    available_qty: RELEASED_STATUSES.has(item.status) ? Math.max(actual - damaged, 0) : 0,
    unit: item.unit || 'units',
    status: item.status,
    aging_days: Math.max(0, Math.floor((Date.now() - new Date(item.received_at || item.created_at).getTime()) / 86400000)),
  }
}

export default function WarehousePage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadStock = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('goods_receipts')
        .select('*, warehouses(name), warehouse_locations(name), goods_items(accepted_quantity, damaged_quantity)')
        .in('status', IN_GODOWN_STATUSES as unknown as string[])
        .order('created_at', { ascending: false })

      if (error) throw error
      setInventory((data || []).map(toStockRow))
    } catch (err) {
      console.error('Failed to load warehouse stock:', err)
      setInventory([])
      toast({ title: 'Could not load warehouse stock', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  const [verifyingId, setVerifyingId] = useState<string | null>(null)
  const { user, can } = useUser()
  const canVerify = can('VERIFY_GOODS')

  const handleVerifyStock = async (id: string) => {
    if (!user) return
    setVerifyingId(id)
    try {
      const supabase = createClient()
      const { data, error } = await (supabase.from('goods_receipts') as any)
        .update({ status: 'available', verified_at: new Date().toISOString(), verified_by: user.id })
        .eq('id', id)
        .eq('status', 'verification_pending')
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('This consignment was already verified or you do not have permission.')

      setInventory(prev =>
        prev.map(item => (item.id === id ? { ...item, status: 'available', available_qty: item.actual_qty - item.damaged_qty } : item))
      )
      toast({
        title: 'Godown Stock Verified',
        description: 'Physical inspection reconciled and cargo released for dispatch.',
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Verification failed', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setVerifyingId(null)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'warehouse_name',
      header: 'Warehouse & Bay',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.warehouse_name}</span>
          <span className="text-[11px] text-gray-500">{row.original.bay_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'product_name',
      header: 'Stored Cargo',
      cell: ({ row }) => (
        <span className="font-semibold text-gray-900">{row.original.product_name}</span>
      ),
    },
    {
      accessorKey: 'actual_qty',
      header: 'Actual vs Damaged',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-900">
            {formatNumber(row.original.actual_qty)} {row.original.unit}
          </span>
          {row.original.damaged_qty > 0 && (
            <span className="text-[11px] text-rose-600 block">
              Damaged: {row.original.damaged_qty} {row.original.unit}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'available_qty',
      header: 'Available for Dispatch',
      cell: ({ row }) => (
        <span className="font-bold text-emerald-700">
          {formatNumber(row.original.available_qty)} {row.original.unit}
        </span>
      ),
    },
    {
      accessorKey: 'aging_days',
      header: 'Godown Age',
      cell: ({ row }) => (
        <span className="text-xs text-gray-600">{row.original.aging_days} days</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Verification Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            reserved: 'bg-blue-50 text-blue-700 border-blue-200',
            partially_dispatched: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            verification_pending: 'bg-amber-50 text-amber-700 border-amber-200',
            damaged: 'bg-rose-50 text-rose-700 border-rose-200',
            on_hold: 'bg-gray-100 text-gray-700 border-gray-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        row.original.status === 'verification_pending' ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-emerald-500 text-emerald-700 hover:bg-emerald-50"
            disabled={!canVerify || verifyingId === row.original.id}
            onClick={() => handleVerifyStock(row.original.id)}
          >
            <CheckSquare className="w-3.5 h-3.5 mr-1" />
            Verify Stock
          </Button>
        ) : (
          <span className="text-[11px] text-emerald-600 font-medium flex items-center gap-1">
            <ShieldCheck className="w-3.5 h-3.5" /> Reconciled
          </span>
        )
      ),
    },
  ]

  const totalPackages = inventory.reduce((sum, item) => sum + (Number(item.actual_qty) || 0), 0)
  const pendingInspection = inventory.filter(item => item.status === 'verification_pending').length
  const availableStock = inventory.reduce((sum, item) => sum + (Number(item.available_qty) || 0), 0)
  const activeWarehousesCount = new Set(inventory.map(item => item.warehouse_name).filter(Boolean)).size

  return (
    <div className="space-y-6">
      <PageHeader
        title="Godown & Warehouse Inventory"
        description="Physical stock verification, storage bay allocations, damage discrepancies and goods reservation"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Warehouses"
          value={activeWarehousesCount.toString()}
          subtitle="Operational facilities"
          icon={Warehouse}
        />
        <KPICard
          title="Total Stored Packages"
          value={totalPackages.toString()}
          subtitle="Across all bays"
          icon={Box}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Inspection Pending"
          value={pendingInspection.toString()}
          subtitle="Consignments awaiting count"
          icon={AlertTriangle}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Available Stock"
          value={availableStock.toString()}
          subtitle="Ready for truck loading"
          icon={CheckSquare}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={inventory}
        loading={loading}
        searchColumn="product_name"
        searchPlaceholder="Search warehouse cargo..."
      />
    </div>
  )
}
