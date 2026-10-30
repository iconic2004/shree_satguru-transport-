'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { ShieldAlert, ShieldCheck, Clock, User, Filter } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatting'

export default function AuditLogsPage() {
  const [logs] = useState([
    {
      id: 'log-1',
      action: 'INVENTORY_VERIFICATION',
      entity_type: 'goods_receipts',
      entity_id: 'INV-2026-0891',
      user_name: 'Dinesh Sharma (Ops Head)',
      description: 'Physical stock verified for 450 cartons of Frooti 200ml at Bhiwandi Bay A-1. Status changed to available.',
      ip_address: '103.21.144.12',
      created_at: new Date(Date.now() - 35 * 60000).toISOString(),
    },
    {
      id: 'log-2',
      action: 'DISPATCH_APPROVAL',
      entity_type: 'dispatches',
      entity_id: 'DSP-2026-0041',
      user_name: 'Super Admin Officer',
      description: 'Vehicle MH-04-GP-4521 approved for 3 stops. Driver Ramesh Yadav trip allowances authorized.',
      ip_address: '103.21.144.12',
      created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    },
    {
      id: 'log-3',
      action: 'STAFF_ADVANCE_ISSUED',
      entity_type: 'staff_advances',
      entity_id: 'ADV-8891',
      user_name: 'Pooja Verma (Chief Accountant)',
      description: 'Issued ₹5,000 cash advance to driver Ramesh Yadav for festival travel. Ledger updated.',
      ip_address: '103.21.144.18',
      created_at: new Date(Date.now() - 240 * 60000).toISOString(),
    },
    {
      id: 'log-4',
      action: 'INVOICE_GENERATED',
      entity_type: 'invoices',
      entity_id: 'SST-INV-2026-103',
      user_name: 'Pooja Verma (Chief Accountant)',
      description: 'Created tax invoice for Asian Paints Ltd totaling ₹92,040 with 18% GST.',
      ip_address: '103.21.144.18',
      created_at: new Date(Date.now() - 480 * 60000).toISOString(),
    },
    {
      id: 'log-5',
      action: 'DELIVERY_POD_RECORDED',
      entity_type: 'deliveries',
      entity_id: 'DEL-4412',
      user_name: 'Ramesh Yadav (Driver)',
      description: 'Signed delivery challan and receiver signature captured for Reliance DC Bhiwandi.',
      ip_address: '157.34.12.98 (Mobile)',
      created_at: new Date(Date.now() - 720 * 60000).toISOString(),
    },
  ])

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'created_at',
      header: 'Timestamp (IST)',
      cell: ({ row }) => (
        <span className="text-xs font-mono text-gray-500 whitespace-nowrap">
          {formatDateTime(row.original.created_at)}
        </span>
      ),
    },
    {
      accessorKey: 'action',
      header: 'Operation Action',
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono uppercase tracking-wider bg-navy-100 text-navy-900 border border-navy-200">
          {row.original.action}
        </span>
      ),
    },
    {
      accessorKey: 'user_name',
      header: 'Performed By & IP',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-bold text-navy-950 block">{row.original.user_name}</span>
          <span className="text-[10px] text-gray-400 font-mono">IP: {row.original.ip_address}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: 'Audit Description & Entity ID',
      cell: ({ row }) => (
        <div className="max-w-md">
          <p className="text-xs text-gray-700 leading-snug">{row.original.description}</p>
          <span className="text-[10px] font-mono text-orange-600 block mt-0.5">
            Target: {row.original.entity_id}
          </span>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & System Audit Logs"
        description="Immutable compliance trail recording all operational approvals, stock adjustments, financial settlements and role modifications"
      />

      <DataTable
        columns={columns}
        data={logs}
        searchColumn="action"
        searchPlaceholder="Filter audit action..."
      />
    </div>
  )
}
