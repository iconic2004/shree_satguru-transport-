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
import { getErrorMessage } from '@/lib/utils/errors'
import { nowTimeIST } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

export default function LoadingUnloadingPage() {
  const [operations, setOperations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadOperations = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('loading_unloading_operations')
        .select(
          '*, vehicles(registration_number), drivers(full_name), warehouses(name), dispatches(dispatch_number), ' +
          'loading_unloading_items(expected_quantity, actual_quantity), ' +
          'loading_unloading_staff(staff_members(full_name)), ' +
          'responsible:profiles!loading_unloading_operations_responsible_employee_fkey(full_name)'
        )
        .order('operation_date', { ascending: false })

      if (error) throw error
      setOperations((data || []).map((op: any) => {
        const items: any[] = op.loading_unloading_items || []
        const crew: string[] = (op.loading_unloading_staff || [])
          .map((s: any) => s.staff_members?.full_name)
          .filter(Boolean)
        return {
          id: op.id,
          operation_type: op.operation_type,
          vehicle_reg: op.vehicles?.registration_number || '-',
          driver_name: op.drivers?.full_name || '-',
          labourers: crew.length ? crew.join(', ') : '-',
          crew_count: crew.length,
          dispatch_no: op.dispatches?.dispatch_number || '-',
          cargo_desc: op.remarks || (items.length ? `${items.length} consignment line(s)` : '-'),
          expected_qty: items.reduce((s, i) => s + (Number(i.expected_quantity) || 0), 0),
          actual_qty: items.reduce((s, i) => s + (Number(i.actual_quantity) || 0), 0),
          has_items: items.length > 0,
          status: op.status,
          start_time: op.start_time || '-',
          responsible_employee: op.responsible?.full_name || '-',
        }
      }))
    } catch (err) {
      console.error('Failed to load loading operations:', err)
      setOperations([])
      toast({ title: 'Could not load operations', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOperations()
  }, [])

  const [completingId, setCompletingId] = useState<string | null>(null)
  const { can } = useUser()
  const canManage = can('MANAGE_LOADING')

  const handleCompleteOperation = async (id: string) => {
    setCompletingId(id)
    try {
      const supabase = createClient()
      const { data, error } = await (supabase.from('loading_unloading_operations') as any)
        .update({ status: 'completed', completion_time: nowTimeIST() })
        .eq('id', id)
        .eq('status', 'in_progress')
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('Operation is no longer in progress or you do not have permission.')

      setOperations(prev =>
        prev.map(op => (op.id === id ? { ...op, status: 'completed' } : op))
      )
      toast({
        title: 'Operation Completed',
        description: 'Loading slip generated. Awaiting authorized verification.',
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Could not complete operation', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setCompletingId(null)
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
            disabled={!canManage || completingId === row.original.id}
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
  const activeHelpers = operations
    .filter(op => op.status === 'in_progress')
    .reduce((acc, curr) => acc + curr.crew_count, 0)
  const flaggedDiscrepancies = operations.filter(op => op.has_items && op.actual_qty > 0 && op.expected_qty !== op.actual_qty).length

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
        loading={loading}
        searchColumn="vehicle_reg"
        searchPlaceholder="Search by vehicle registration..."
      />
    </div>
  )
}
