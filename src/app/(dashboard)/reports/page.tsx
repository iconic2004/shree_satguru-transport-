'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { Download, Printer, TrendingUp, Package, Truck, Users, Loader2 } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { useUser } from '@/lib/hooks/use-user'
import { buildReport, type ReportKey } from '@/lib/reports'
import { toCsv, downloadCsv } from '@/lib/utils/csv'
import { todayIST } from '@/lib/utils/validation'
import type { Permission } from '@/lib/constants/roles'

interface ReportItem {
  key: ReportKey
  title: string
  desc: string
}

interface ReportCategory {
  category: string
  icon: React.ElementType
  permission?: Permission
  items: ReportItem[]
}

const REPORTS: ReportCategory[] = [
  {
    category: 'Goods & Godown',
    icon: Package,
    items: [
      { key: 'goods_inward', title: 'Daily Goods Inward Register', desc: 'Summary of all incoming consignments, challans & packaging quantities' },
      { key: 'stock_aging', title: 'Warehouse Stock Aging & Valuation', desc: 'Goods currently in the godown, declared value and storage duration' },
      { key: 'discrepancy', title: 'Discrepancy & Damage Reconciliation', desc: 'Damaged, missing, excess and rejected quantities from inspections' },
    ],
  },
  {
    category: 'Transport & Fleet',
    icon: Truck,
    items: [
      { key: 'dispatch_register', title: 'Monthly Dispatch Register', desc: 'All truck trips, distances, load utilisation and cost per trip' },
      { key: 'delivery_pod', title: 'Delivery Success & POD Report', desc: 'Delivery status, receiver details and failed stop reasons' },
      { key: 'fuel_toll', title: 'Vehicle Fuel & Toll Consumption', desc: 'Diesel and FASTag toll expenses per vehicle' },
    ],
  },
  {
    category: 'Staff & Muster',
    icon: Users,
    items: [
      { key: 'muster_roll', title: 'Monthly Driver & Labour Muster Roll', desc: 'Attendance recorded this month for drivers and staff' },
      { key: 'advances', title: 'Staff Advance & Recovery Statement', desc: 'Issued cash advances, applied deductions and unapplied balances' },
      { key: 'payroll', title: 'Payroll Settlement Statements', desc: 'Payroll entries with gross, deductions, net and payment status' },
    ],
  },
  {
    category: 'Financial Profitability',
    icon: TrendingUp,
    permission: 'VIEW_FINANCIAL_REPORTS',
    items: [
      { key: 'profit_loss', title: 'Monthly Operating Profit & Loss', desc: 'Billed freight revenue (excl. GST) vs recorded operating expenses' },
      { key: 'receivables_aging', title: 'Customer Outstanding Receivables Aging', desc: 'Unpaid invoices bucketed by days overdue (30/60/90+)' },
      { key: 'vehicle_profitability', title: 'Vehicle-Wise Profitability Statement', desc: 'Trip-linked billed revenue per truck vs vehicle expenses' },
    ],
  },
]

export default function ReportsPage() {
  const { can } = useUser()
  const [busyKey, setBusyKey] = useState<ReportKey | null>(null)

  const downloadReport = async (item: ReportItem) => {
    setBusyKey(item.key)
    try {
      const supabase = createClient()
      const table = await buildReport(supabase, item.key)
      const csv = toCsv(table.headers, table.rows, [
        `Report: ${item.title}`,
        `Generated on: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
        'Organization: Shree Satguru Transport',
      ])
      downloadCsv(`${item.key}_${todayIST()}.csv`, csv)

      toast({
        title: table.rows.length ? 'Report exported' : 'Report exported (no rows)',
        description: table.rows.length
          ? `${item.title}: ${table.rows.length} row(s).`
          : `${item.title} has no data you are allowed to see yet.`,
        variant: table.rows.length ? 'success' : 'warning',
      })
    } catch (err) {
      toast({
        title: 'Export Error',
        description: getErrorMessage(err, 'Failed to export report.'),
        variant: 'error',
      })
    } finally {
      setBusyKey(null)
    }
  }

  const visibleReports = REPORTS.filter(cat => !cat.permission || can(cat.permission))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Operational & Financial Reports"
        description="Audited ledger statements, vehicle profitability analysis, godown stock registers and staff wage exports"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print All Summary
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {visibleReports.map((cat) => {
          const Icon = cat.icon
          return (
            <Card key={cat.category} className="border-gray-200/80 shadow-sm">
              <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center gap-2 space-y-0">
                <div className="p-2 rounded-lg bg-navy-50 text-navy-800">
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-navy-950">{cat.category}</CardTitle>
                  <CardDescription className="text-xs">Exportable audit datasets</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-gray-100">
                {cat.items.map((item) => (
                  <div key={item.key} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="space-y-0.5 min-w-0">
                      <p className="text-xs font-bold text-navy-900">{item.title}</p>
                      <p className="text-[11px] text-gray-500 max-w-sm">{item.desc}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-shrink-0"
                      disabled={busyKey !== null}
                      onClick={() => downloadReport(item)}
                      aria-label={`Download ${item.title} as CSV`}
                    >
                      {busyKey === item.key ? (
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5 mr-1.5 text-navy-700" />
                      )}
                      CSV
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
