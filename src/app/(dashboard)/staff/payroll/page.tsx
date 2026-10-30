'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { ColumnDef } from '@tanstack/react-table'
import { DollarSign, CheckCircle, CreditCard, ArrowDownRight, Printer, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'

export default function PayrollPage() {
  const [payroll, setPayroll] = useState([
    {
      id: 'pay-1',
      staff_name: 'Ramesh Yadav',
      staff_type: 'driver',
      period: 'October 2026',
      gross_earnings: 27500, // 26k salary + 1500 trip allowances
      advances_applied: 5000,
      deductions: 0,
      net_payable: 22500,
      amount_paid: 22500,
      outstanding: 0,
      status: 'paid',
    },
    {
      id: 'pay-2',
      staff_name: 'Santosh Patil',
      staff_type: 'driver',
      period: 'October 2026',
      gross_earnings: 25200, // 24k + 1200 allowance
      advances_applied: 0,
      deductions: 0,
      net_payable: 25200,
      amount_paid: 15000,
      outstanding: 10200,
      status: 'partially_paid',
    },
    {
      id: 'pay-3',
      staff_name: 'Baban Kamble',
      staff_type: 'labourer',
      period: 'October 2026',
      gross_earnings: 16900, // 26 days @ 650
      advances_applied: 1000,
      deductions: 0,
      net_payable: 15900,
      amount_paid: 15900,
      outstanding: 0,
      status: 'paid',
    },
    {
      id: 'pay-4',
      staff_name: 'Sunil Pawar',
      staff_type: 'labourer',
      period: 'October 2026',
      gross_earnings: 16250, // 25 days @ 650
      advances_applied: 0,
      deductions: 0,
      net_payable: 16250,
      amount_paid: 0,
      outstanding: 16250,
      status: 'unpaid',
    },
  ])

  const handleDisbursePayment = (id: string) => {
    setPayroll(prev =>
      prev.map(p =>
        p.id === id
          ? { ...p, amount_paid: p.net_payable, outstanding: 0, status: 'paid' }
          : p
      )
    )
    toast({
      title: 'Salary Disbursed',
      description: 'Payment recorded and staff individual ledger updated.',
      variant: 'success',
    })
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'staff_name',
      header: 'Staff Member',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.staff_name}</span>
          <span className="text-[11px] font-semibold text-orange-600 uppercase">
            {row.original.staff_type}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'gross_earnings',
      header: 'Gross Earnings',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-gray-900 block">
          {formatCurrency(row.original.gross_earnings)}
        </span>
      ),
    },
    {
      accessorKey: 'advances_applied',
      header: 'Advance Deducted',
      cell: ({ row }) => (
        <span className="text-xs text-rose-600 font-semibold block">
          - {formatCurrency(row.original.advances_applied)}
        </span>
      ),
    },
    {
      accessorKey: 'net_payable',
      header: 'Net Payable',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-navy-900 block">
          {formatCurrency(row.original.net_payable)}
        </span>
      ),
    },
    {
      accessorKey: 'amount_paid',
      header: 'Paid Amount',
      cell: ({ row }) => (
        <span className="text-xs text-emerald-700 font-bold block">
          {formatCurrency(row.original.amount_paid)}
        </span>
      ),
    },
    {
      accessorKey: 'outstanding',
      header: 'Outstanding Balance',
      cell: ({ row }) => (
        <span
          className={`text-xs font-bold block ${
            row.original.outstanding > 0 ? 'text-amber-700' : 'text-gray-400'
          }`}
        >
          {formatCurrency(row.original.outstanding)}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            paid: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            partially_paid: 'bg-amber-50 text-amber-800 border-amber-200',
            unpaid: 'bg-rose-50 text-rose-800 border-rose-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        row.original.outstanding > 0 ? (
          <Button
            size="sm"
            className="h-7 text-xs bg-navy-800 hover:bg-navy-900 text-white font-medium"
            onClick={() => handleDisbursePayment(row.original.id)}
          >
            Settle ₹{row.original.outstanding}
          </Button>
        ) : (
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Cleared
          </span>
        )
      ),
    },
  ]

  const totalGross = payroll.reduce((s, p) => s + p.gross_earnings, 0)
  const totalAdvances = payroll.reduce((s, p) => s + p.advances_applied, 0)
  const totalNet = payroll.reduce((s, p) => s + p.net_payable, 0)
  const totalOutstanding = payroll.reduce((s, p) => s + p.outstanding, 0)

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll & Wage Settlements"
        description="Monthly salary computation, daily wage reconciliation, automatic advance deduction and settlement disbursement"
        actions={
          <Button
            variant="outline"
            size="sm"
            className="text-xs"
            onClick={() => window.print()}
          >
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print Payroll Sheet
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Total Gross Wages"
          value={formatCurrency(totalGross)}
          subtitle="Salary + Trip allowances"
          icon={DollarSign}
        />
        <KPICard
          title="Advances Deducted"
          value={formatCurrency(totalAdvances)}
          subtitle="Subtracted from earnings"
          icon={ArrowDownRight}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Total Net Payable"
          value={formatCurrency(totalNet)}
          subtitle="After advance adjustments"
          icon={CreditCard}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Outstanding Payable"
          value={formatCurrency(totalOutstanding)}
          subtitle="Pending disbursements"
          icon={AlertCircle}
          iconClassName="bg-rose-50 text-rose-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={payroll}
        searchColumn="staff_name"
        searchPlaceholder="Search staff name..."
      />
    </div>
  )
}
