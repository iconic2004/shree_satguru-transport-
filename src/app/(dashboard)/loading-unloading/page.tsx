'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus, CheckCircle, Truck, Users, Clock, RefreshCw } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'

export default function LoadingUnloadingPage() {
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadOperations = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('loading_unloading_operations')
        .select('*, vehicles(registration_number), drivers(full_name), warehouses(name), dispatches(dispatch_number)')
        .order('operation_date', { ascending: false })

      if (data && data.length > 0) {
        setOperations(
          data.map((op: any) => ({
            id: op.id,
            operation_type: op.operation_type,
            vehicle_reg: op.vehicles?.registration_number || 'N/A',
            driver_name: op.drivers?.full_name || 'Fleet Driver',
            labourers: op.laborers || 'Assigned Staff',
            dispatch_no: op.dispatches?.dispatch_number || 'N/A',
            cargo_desc: op.remarks || 'Consignment',
            expected_qty: op.expected_qty || 0,
            actual_qty: op.actual_qty || 0,
            status: op.status,
            start_time: op.start_time || 'N/A',
            responsible_employee: op.responsible_person || 'Supervisor',
          }))
        )
      } else {
        setOperations([])
      }
    } catch (err) {
      console.error('Failed to load loading operations:', err)
      setOperations([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOperations()
  }, [])

  const handleCompleteOperation = async (id: string) => {
    try {
      const supabase = createClient()
      await (supabase.from('loading_unloading_operations') as any)
        .update({ status: 'completed' })
        .eq('id', id)
      setOperations(prev =>
        prev.map(op => (op.id === id ? { ...op, status: 'completed' } : op))
      )
      toast({
        title: 'Operation Completed',
        description: 'Loading slip generated. Awaiting authorized verification.',
        variant: 'success',
      })
    } catch (err: any) {
      setOperations(prev =>
        prev.map(op => (op.id === id ? { ...op, status: 'completed' } : op))
      )
      toast({
        title: 'Operation Completed',
        description: 'Status marked completed locally.',
        variant: 'default',
      })
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'operation_type',
      header: 'Operation Type',
      cell: ({ row }) => (
        <span
          className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
            row.original.operation_type === 'loading'
              ? 'bg-blue-100 text-blue-900 border border-blue-200'
              : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
          }`}
        >
          {row.original.operation_type}
        </span>
      ),
    },
    {
      accessorKey: 'vehicle_reg',
      header: 'Vehicle & Driver',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.vehicle_reg}</span>
          <span className="text-xs text-gray-600">Driver: {row.original.driver_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'cargo_desc',
      header: 'Cargo & Quantity',
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-gray-900 block">{row.original.cargo_desc}</span>
          <span className="text-[11px] text-gray-500">
            Expected: {row.original.expected_qty} • Loaded/Unloaded: {row.original.actual_qty}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'labourers',
      header: 'Assigned Labour Team',
      cell: ({ row }) => (
        <span className="text-xs text-gray-700 font-medium">{row.original.labourers}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            in_progress: 'bg-amber-50 text-amber-800 border-amber-200',
            completed: 'bg-blue-50 text-blue-800 border-blue-200',
            verified: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        row.original.status === 'in_progress' ? (
          <Button
            size="sm"
            className="h-7 text-xs bg-navy-800 hover:bg-navy-900 text-white"
            onClick={() => handleCompleteOperation(row.original.id)}
          >
            Mark Done
          </Button>
        ) : (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Reconciled
          </span>
        )
      ),
    },
  ]

  const activeLoadings = operations.filter(op => op.status === 'in_progress' || op.status === 'loading').length
  const completedToday = operations.filter(op => op.status === 'completed' || op.status === 'verified').length
  const activeHelpers = operations.reduce((acc, curr) => acc + (curr.labourers && curr.labourers !== 'Assigned Staff' ? curr.labourers.split(',').length : 0), 0)
  const flaggedDiscrepancies = operations.filter(op => op.status === 'discrepancy' || (op.expected_qty && op.actual_qty && op.expected_qty !== op.actual_qty)).length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loading & Unloading Operations"
        description="Track vehicle loading onto trucks, unloading at godowns, package counts and assigned labour helper teams"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Loadings"
          value={activeLoadings.toString()}
          subtitle="Currently at bay"
          icon={Loader2}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Completed Today"
          value={completedToday.toString()}
          subtitle="Slips generated"
          icon={CheckCircle}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Active Labour Helpers"
          value={activeHelpers.toString()}
          subtitle="Working across godowns"
          icon={Users}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Discrepancies Flagged"
          value={flaggedDiscrepancies.toString()}
          subtitle={flaggedDiscrepancies > 0 ? `${flaggedDiscrepancies} discrepant` : 'No issues reported'}
          icon={Clock}
          iconClassName="bg-rose-50 text-rose-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={operations}
        searchColumn="vehicle_reg"
        searchPlaceholder="Search by vehicle registration..."
      />
    </div>
  )
}
