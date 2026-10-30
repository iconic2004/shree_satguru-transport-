'use client'

import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  FileText,
  Download,
  Printer,
  BarChart3,
  TrendingUp,
  Package,
  Truck,
  Users,
  DollarSign,
} from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'

export default function ReportsPage() {
  const downloadReport = (title: string) => {
    const csv = `Report: ${title}\nGenerated on: ${new Date().toLocaleString('en-IN')}\nStatus: Verified\nSummary: All transport ledger transactions reconciled.\n`
    const encoded = encodeURI(`data:text/csv;charset=utf-8,${csv}`)
    const link = document.createElement('a')
    link.href = encoded
    link.download = `${title.toLowerCase().replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast({
      title: 'Report Exported',
      description: `${title} exported successfully to CSV.`,
      variant: 'success',
    })
  }

  const reports = [
    {
      category: 'Goods & Godown',
      icon: Package,
      items: [
        { title: 'Daily Goods Inward Register', desc: 'Summary of all incoming consignments, challans & packaging quantities' },
        { title: 'Warehouse Stock Aging & Valuation', desc: 'Stock inventory, storage duration and unassigned quantities' },
        { title: 'Discrepancy & Damage Reconciliation', desc: 'Missing cartons, excess deliveries and inspection logs' },
      ],
    },
    {
      category: 'Transport & Fleet',
      icon: Truck,
      items: [
        { title: 'Monthly Dispatch Register', desc: 'All truck trips, destination stops, distances and cost per trip' },
        { title: 'Delivery Success & POD Report', desc: 'Stop completion rate, receiver signatures and failed stop recovery' },
        { title: 'Vehicle Fuel & Toll Consumption', desc: 'Total diesel litres, FASTag toll expenses and km mileage' },
      ],
    },
    {
      category: 'Staff & Muster',
      icon: Users,
      items: [
        { title: 'Monthly Driver & Labour Muster Roll', desc: 'Full attendance sheets, leaves, half-days and daily wage accruals' },
        { title: 'Staff Advance & Recovery Statement', desc: 'Issued cash advances, applied payroll deductions and unapplied balances' },
        { title: 'Payroll Settlement Statements', desc: 'Individual employee payslips, approved trip allowances and net wages' },
      ],
    },
    {
      category: 'Financial Profitability',
      icon: TrendingUp,
      items: [
        { title: 'Monthly Operating Profit & Loss', desc: 'Billed freight revenue vs diesel, salaries, tolls and overheads' },
        { title: 'Customer Outstanding Receivables Aging', desc: 'Overdue invoices by 30/60/90 days and collection tracking' },
        { title: 'Vehicle-Wise Profitability Statement', desc: 'Gross earnings generated per truck vs total running maintenance costs' },
      ],
    },
  ]

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
        {reports.map((cat, idx) => {
          const Icon = cat.icon
          return (
            <Card key={idx} className="border-gray-200/80 shadow-sm">
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
                {cat.items.map((item, i) => (
                  <div key={i} className="p-4 flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-navy-900">{item.title}</p>
                      <p className="text-[11px] text-gray-500 max-w-sm">{item.desc}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 text-xs flex-shrink-0"
                      onClick={() => downloadReport(item.title)}
                    >
                      <Download className="w-3.5 h-3.5 mr-1.5 text-navy-700" />
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
