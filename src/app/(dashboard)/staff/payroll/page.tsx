'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { DataTable } from '@/components/shared/data-table'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { todayIST } from '@/lib/utils/validation'
import { sumBy } from '@/lib/utils/finance'
import { ColumnDef } from '@tanstack/react-table'
import { DollarSign, CheckCircle, CreditCard, ArrowDownRight, Printer, AlertCircle } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { useUser } from '@/lib/hooks/use-user'

export default function PayrollPage() {
  const [payroll, setPayroll] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadPayroll = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      // Real payroll entries only — never synthesise salary figures on the client.
      const { data, error } = await supabase
        .from('payroll_entries')
        .select('*, payroll_periods(period_name, start_date, status), drivers(full_name), staff_members(full_name)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setPayroll(((data as any[]) || []).map(e => ({
        id: e.id,
        staff_member_id: e.staff_member_id,
        driver_id: e.driver_id,
        staff_name: e.drivers?.full_name || e.staff_members?.full_name || '-',
        staff_type: e.staff_type,
        period: e.payroll_periods?.period_name || '-',
        gross_earnings: Number(e.gross_earnings) || 0,
        advances_applied: Number(e.total_advances_applied) || 0,
        deductions: Number(e.total_deductions) || 0,
        net_payable: Number(e.net_payable) || 0,
        amount_paid: Number(e.amount_paid) || 0,
        outstanding: Number(e.outstanding_amount) || 0,
        status: e.payment_status,
      })))
    } catch (err) {
      console.error('Failed to load payroll records:', err)
      setPayroll([])
      toast({ title: 'Could not load payroll', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPayroll()
  }, [])

  const { user, can } = useUser()
  const canManage = can('MANAGE_PAYROLL')
  const [settleEntry, setSettleEntry] = useState<any>(null)
  const [settleMethod, setSettleMethod] = useState('cash')
  const [settleReference, setSettleReference] = useState('')
  const [settling, setSettling] = useState(false)

  const handleDisbursePayment = async () => {
    const entry = settleEntry
    if (!entry || !user || settling) return
    const amount = entry.outstanding
    if (!(amount > 0)) return

    setSettling(true)
    const supabase = createClient()
    try {
      // 1. Record the actual payment.
      const { data: payment, error: payError } = await (supabase.from('staff_payments') as any)
        .insert([{
          payroll_entry_id: entry.id,
          staff_member_id: entry.staff_member_id,
          driver_id: entry.driver_id,
          staff_type: entry.staff_type,
          payment_date: todayIST(),
          amount,
          payment_method: settleMethod,
          payment_reference: settleReference.trim() || null,
          payment_status: 'completed',
          recorded_by: user.id,
        }])
        .select('id')
      if (payError) throw payError

      // 2. Mark the payroll entry settled; roll back the payment if this fails.
      const newPaid = entry.amount_paid + amount
      const { data: updated, error: updError } = await (supabase.from('payroll_entries') as any)
        .update({ amount_paid: newPaid, outstanding_amount: 0, payment_status: 'paid' })
        .eq('id', entry.id)
        .select('id')
      if (updError || !updated?.length) {
        if (payment?.[0]?.id) {
          await (supabase.from('staff_payments') as any).update({ payment_status: 'cancelled' }).eq('id', payment[0].id)
        }
        throw updError || new Error('Payroll entry could not be updated.')
      }

      setPayroll(prev =>
        prev.map(p => (p.id === entry.id ? { ...p, amount_paid: newPaid, outstanding: 0, status: 'paid' } : p))
      )
      toast({
        title: 'Salary Disbursed',
        description: `${formatCurrency(amount)} paid to ${entry.staff_name}.`,
        variant: 'success',
      })
      setSettleEntry(null)
    } catch (err) {
      toast({ title: 'Settlement failed', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setSettling(false)
    }
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
            disabled={!canManage}
            onClick={() => {
              setSettleEntry(row.original)
              setSettleMethod('cash')
              setSettleReference('')
            }}
          >
            Settle {formatCurrency(row.original.outstanding)}
          </Button>
        ) : (
          <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Cleared
          </span>
        )
      ),
    },
  ]

  const totalGross = sumBy(payroll, p => p.gross_earnings)
  const totalAdvances = sumBy(payroll, p => p.advances_applied)
  const totalNet = sumBy(payroll, p => p.net_payable)
  const totalOutstanding = sumBy(payroll, p => p.outstanding)

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
        loading={loading}
        searchColumn="staff_name"
        searchPlaceholder="Search staff name..."
        emptyTitle="No payroll entries yet"
        emptyDescription="Payroll entries appear here once a payroll period has been prepared for drivers and staff."
      />

      <Dialog open={!!settleEntry} onOpenChange={(open) => { if (!open) setSettleEntry(null) }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Settle Salary</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Pay {settleEntry ? formatCurrency(settleEntry.outstanding) : ''} to {settleEntry?.staff_name} for {settleEntry?.period}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Payment Method</Label>
              <Select value={settleMethod} onValueChange={setSettleMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Reference / UTR (optional)</Label>
              <Input value={settleReference} onChange={(e) => setSettleReference(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSettleEntry(null)} disabled={settling}>Cancel</Button>
            <Button
              className="bg-navy-900 hover:bg-navy-950 text-white font-semibold"
              onClick={handleDisbursePayment}
              disabled={settling}
            >
              {settling ? 'Recording…' : 'Confirm Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
