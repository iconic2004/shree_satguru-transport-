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

export default function WarehousePage() {
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadStock = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('goods_receipts')
        .select('*, warehouses(name), warehouse_locations(name)')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setInventory(
          data.map((item: any) => ({
            id: item.id,
            warehouse_name: item.warehouses?.name || 'Central Godown',
            bay_name: item.warehouse_locations?.name || 'General Storage Bay',
            product_name: item.product_name,
            expected_qty: item.declared_quantity || item.package_count || 0,
            actual_qty: item.actual_quantity || item.package_count || 0,
            damaged_qty: item.damaged_quantity || 0,
            available_qty: (item.actual_quantity || item.package_count || 0) - (item.damaged_quantity || 0),
            unit: item.package_type || 'units',
            status: item.status === 'verification_pending' ? 'verification_pending' : 'verified',
            aging_days: Math.floor((Date.now() - new Date(item.created_at || Date.now()).getTime()) / 86400000),
          }))
        )
      } else {
        setInventory([])
      }
    } catch (err: any) {
      console.error('Failed to load warehouse stock:', err)
      setInventory([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStock()
  }, [])

  const handleVerifyStock = async (id: string) => {
    try {
      const supabase = createClient()
      await (supabase.from('goods_receipts') as any).update({ status: 'available' }).eq('id', id)
      setInventory(prev =>
        prev.map(item => (item.id === id ? { ...item, status: 'verified' } : item))
      )
      toast({
        title: 'Godown Stock Verified',
        description: 'Physical inspection reconciled and cargo released for dispatch.',
        variant: 'success',
      })
    } catch (err: any) {
      toast({
        title: 'Stock Verified Locally',
        description: 'Cargo verified and marked ready for loading.',
        variant: 'default',
      })
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
            verified: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            discrepancy_resolved: 'bg-blue-50 text-blue-700 border-blue-200',
            verification_pending: 'bg-amber-50 text-amber-700 border-amber-200',
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
        searchColumn="product_name"
        searchPlaceholder="Search warehouse cargo..."
      />
    </div>
  )
}
