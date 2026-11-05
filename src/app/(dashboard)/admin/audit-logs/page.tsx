'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { DataTable } from '@/components/shared/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { ShieldAlert, ShieldCheck, Clock, User, Filter, RefreshCw } from 'lucide-react'
import { formatDateTime } from '@/lib/utils/formatting'

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadAuditLogs = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(50)

      if (data && data.length > 0) {
        setLogs(
          data.map((l: any) => ({
            id: l.id,
            action: l.action,
            entity_type: l.entity_type,
            entity_id: l.entity_id || 'REF-N/A',
            user_name: l.profiles?.full_name || 'System / Admin',
            description: l.new_values ? JSON.stringify(l.new_values).substring(0, 100) : `${l.action} on ${l.entity_type}`,
            ip_address: l.ip_address || '127.0.0.1',
            created_at: l.created_at,
          }))
        )
      } else {
        setLogs([])
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err)
      setLogs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAuditLogs()
  }, [])

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
