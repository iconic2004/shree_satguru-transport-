'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { ColumnDef } from '@tanstack/react-table'
import { Loader2, Plus, CheckCircle, Truck, Users, Clock } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'

export default function LoadingUnloadingPage() {
  const [operations, setOperations] = useState([
    {
      id: 'op-1',
      operation_type: 'loading',
      vehicle_reg: 'MH-04-GP-4521',
      driver_name: 'Ramesh Yadav',
      labourers: 'Baban Kamble, Sunil Pawar',
      dispatch_no: 'DSP-2026-0041',
      cargo_desc: 'Frooti 200ml (450 cartons)',
      expected_qty: 450,
      actual_qty: 450,
      status: 'in_progress',
      start_time: '08:30 AM',
      responsible_employee: 'Godown Supervisor Sharma',
    },
    {
      id: 'op-2',
      operation_type: 'unloading',
      vehicle_reg: 'MH-43-BP-8890',
      driver_name: 'Santosh Patil',
      labourers: 'Deepak More, Vijay Jadhav',
      dispatch_no: 'Incoming Challan CH-5542',
      cargo_desc: 'Cinthol Soap (200 cartons)',
      expected_qty: 200,
      actual_qty: 198,
      status: 'completed',
      start_time: '10:00 AM',
      responsible_employee: 'Godown Supervisor Sharma',
    },
    {
      id: 'op-3',
      operation_type: 'loading',
      vehicle_reg: 'MH-03-CP-1204',
      driver_name: 'Mohammad Irfan',
      labourers: 'Baban Kamble',
      dispatch_no: 'DSP-2026-0043',
      cargo_desc: 'Apex Hardware Supplies (60 boxes)',
      expected_qty: 60,
      actual_qty: 60,
      status: 'verified',
      start_time: '07:15 AM',
      responsible_employee: 'Deshmukh (Shift Lead)',
    },
  ])

  const handleCompleteOperation = (id: string) => {
    setOperations(prev =>
      prev.map(op => (op.id === id ? { ...op, status: 'completed' } : op))
    )
    toast({
      title: 'Operation Completed',
      description: 'Loading slip generated. Awaiting authorized verification.',
      variant: 'success',
    })
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Loading & Unloading Operations"
        description="Track vehicle loading onto trucks, unloading at godowns, package counts and assigned labour helper teams"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Active Loadings"
          value="1"
          subtitle="Currently at bay"
          icon={Loader2}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Completed Today"
          value="2"
          subtitle="Slips generated"
          icon={CheckCircle}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Active Labour Helpers"
          value="6"
          subtitle="Working across godowns"
          icon={Users}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Discrepancies Flagged"
          value="1"
          subtitle="2 cartons damaged"
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
