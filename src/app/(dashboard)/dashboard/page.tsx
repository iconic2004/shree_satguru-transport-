'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { KPICard } from '@/components/shared/kpi-card'
import { PageHeader } from '@/components/shared/page-header'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency, formatDate, formatNumber } from '@/lib/utils/formatting'
import {
  Package,
  Clock,
  CheckCircle2,
  Warehouse,
  Truck,
  MapPin,
  AlertTriangle,
  Users,
  CalendarCheck,
  TrendingUp,
  Receipt,
  DollarSign,
  AlertCircle,
  FileText,
  RotateCcw,
  ShieldAlert,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from 'recharts'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { useUser } from '@/lib/hooks/use-user'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { todayIST, addDays } from '@/lib/utils/validation'
import { roundMoney, sumBy } from '@/lib/utils/finance'
import { istDate, weeklyDeliveryPerformance, successRate, monthlyProfitability, expiringDocuments, type ExpiringDoc } from '@/lib/dashboard-metrics'

const IN_GODOWN = ['received', 'verification_pending', 'available', 'reserved', 'partially_dispatched', 'damaged', 'on_hold']
const OPEN_DELIVERY = ['pending', 'assigned', 'loaded', 'in_transit', 'rescheduled', 'on_hold']

function DeniedNotice() {
  const searchParams = useSearchParams()
  const denied = searchParams.get('denied')
  if (!denied) return null
  return (
    <div role="alert" className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
      <ShieldAlert className="w-4 h-4 flex-shrink-0 mt-0.5" />
      <span>You do not have permission to open <span className="font-mono font-semibold">{denied}</span>. Contact an administrator if you need access.</span>
    </div>
  )
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true)
  const { can, profile, loading: userLoading } = useUser()
  const showFinance = can('VIEW_FINANCIAL_REPORTS')
  const canSeeGoods = can('VIEW_GOODS')
  const canSeeDispatch = can('VIEW_DISPATCH')

  const [metrics, setMetrics] = useState({
    goodsReceivedToday: 0,
    goodsAwaitingVerification: 0,
    goodsAvailableDispatch: 0,
    goodsInWarehouse: 0,
    deliveriesScheduled: 0,
    completedDeliveries: 0,
    pendingDeliveries: 0,
    failedDeliveries: 0,
    trucksOnRoad: 0,
    fleetSize: 0,
    staffPresentToday: 0,
    staffMarkedToday: 0,
    totalRevenueMonth: 0,
    totalExpensesMonth: 0,
    estimatedProfit: 0,
    customerOutstanding: 0,
    advancesThisMonth: 0,
  })

  const [recentArrivals, setRecentArrivals] = useState<any[]>([])
  const [recentDispatches, setRecentDispatches] = useState<any[]>([])
  const [expiringDocs, setExpiringDocs] = useState<ExpiringDoc[]>([])
  const [performanceData, setPerformanceData] = useState<ReturnType<typeof weeklyDeliveryPerformance>>([])
  const [revenueExpenseData, setRevenueExpenseData] = useState<ReturnType<typeof monthlyProfitability>>([])

  useEffect(() => {
    // Wait for the profile so role-dependent queries are only issued when permitted.
    if (!profile) {
      // Profile could not be loaded: stop the spinner instead of waiting forever.
      if (!userLoading) setLoading(false)
      return
    }
    let cancelled = false

    async function loadDashboardData() {
      try {
        const supabase = createClient()
        const today = todayIST()
        const monthStart = `${today.slice(0, 7)}-01`
        const sixMonthsAgo = addDays(monthStart, -186)
        const empty = Promise.resolve({ data: [] as any[], error: null })

        const [
          goodsRes,
          recentGoodsRes,
          dispatchesRes,
          vehiclesRes,
          driversRes,
          deliveriesRes,
          staffAttRes,
          driverAttRes,
          invoicesRes,
          expensesRes,
          advancesRes,
        ] = await Promise.all([
          supabase.from('goods_receipts').select('status, created_at'),
          supabase.from('goods_receipts').select('id, invoice_number, product_name, status, delivery_city, created_at, companies(name)').order('created_at', { ascending: false }).limit(5),
          supabase.from('dispatches').select('id, dispatch_number, dispatch_date, status, planned_distance_km, vehicles(registration_number), drivers(full_name), dispatch_stops(id)').order('created_at', { ascending: false }).limit(20),
          supabase.from('vehicles').select('registration_number, status, insurance_expiry, fitness_expiry, permit_expiry, puc_expiry'),
          supabase.from('drivers').select('full_name, licence_expiry').eq('employment_status', 'active'),
          supabase.from('deliveries').select('status, updated_at'),
          supabase.from('staff_attendance').select('status').eq('attendance_date', today),
          supabase.from('driver_attendance').select('status').eq('attendance_date', today),
          showFinance ? supabase.from('invoices').select('invoice_date, subtotal, outstanding_amount, status').gte('invoice_date', sixMonthsAgo) : empty,
          showFinance ? supabase.from('expenses').select('expense_date, amount').gte('expense_date', sixMonthsAgo) : empty,
          showFinance ? supabase.from('staff_advances').select('amount').gte('advance_date', monthStart) : empty,
        ])

        const firstError = [goodsRes, dispatchesRes, deliveriesRes].find(r => r.error)?.error
        if (firstError) throw firstError

        const goods = (goodsRes.data as any[]) || []
        const deliveries = (deliveriesRes.data as any[]) || []
        const vehicles = (vehiclesRes.data as any[]) || []
        const dispatches = (dispatchesRes.data as any[]) || []
        const attendance = [...((staffAttRes.data as any[]) || []), ...((driverAttRes.data as any[]) || [])]
        const invoices = (invoicesRes.data as any[]) || []
        const expenses = (expensesRes.data as any[]) || []

        // Finance KPIs: this month only; revenue excludes GST.
        const monthInvoices = invoices.filter(i => i.invoice_date >= monthStart && i.status !== 'cancelled' && i.status !== 'credited')
        const revenueMonth = sumBy(monthInvoices, i => i.subtotal)
        const expensesMonth = sumBy(expenses.filter(e => e.expense_date >= monthStart), e => e.amount)
        const outstanding = sumBy(invoices.filter(i => i.status !== 'cancelled' && i.status !== 'credited'), i => i.outstanding_amount)

        const deliveriesToday = deliveries.filter(d => istDate(d.updated_at) === today)

        if (cancelled) return
        setMetrics({
          goodsReceivedToday: goods.filter(g => istDate(g.created_at) === today).length,
          goodsAwaitingVerification: goods.filter(g => g.status === 'verification_pending').length,
          goodsAvailableDispatch: goods.filter(g => g.status === 'available').length,
          goodsInWarehouse: goods.filter(g => IN_GODOWN.includes(g.status)).length,
          deliveriesScheduled: deliveriesToday.length,
          completedDeliveries: deliveriesToday.filter(d => d.status === 'delivered').length,
          pendingDeliveries: deliveries.filter(d => OPEN_DELIVERY.includes(d.status)).length,
          failedDeliveries: deliveriesToday.filter(d => d.status === 'failed').length,
          trucksOnRoad: vehicles.filter(v => v.status === 'on_trip').length,
          fleetSize: vehicles.filter(v => v.status !== 'inactive').length,
          staffPresentToday: attendance.filter(a => a.status === 'present' || a.status === 'half_day').length,
          staffMarkedToday: attendance.length,
          totalRevenueMonth: revenueMonth,
          totalExpensesMonth: expensesMonth,
          estimatedProfit: roundMoney(revenueMonth - expensesMonth),
          customerOutstanding: outstanding,
          advancesThisMonth: sumBy((advancesRes.data as any[]) || [], a => a.amount),
        })

        setRecentArrivals(((recentGoodsRes.data as any[]) || []).map(g => ({ ...g, consignor: g.companies?.name })))
        setRecentDispatches(dispatches
          .filter(d => d.dispatch_date === today || d.status === 'in_transit' || d.status === 'loading')
          .slice(0, 5)
          .map(d => ({
            ...d,
            vehicle_reg: d.vehicles?.registration_number,
            driver_name: d.drivers?.full_name,
            stops: (d.dispatch_stops || []).length,
            planned_distance: `${Number(d.planned_distance_km) || 0} km`,
          })))
        setExpiringDocs(expiringDocuments(vehicles, (driversRes.data as any[]) || [], today).slice(0, 6))
        setPerformanceData(weeklyDeliveryPerformance(deliveries, today))
        setRevenueExpenseData(monthlyProfitability(invoices, expenses, today))
      } catch (err) {
        console.error('Failed to load dashboard metrics:', err)
        if (!cancelled) toast({ title: 'Could not load dashboard', description: getErrorMessage(err), variant: 'error' })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadDashboardData()
    return () => { cancelled = true }
  }, [profile, userLoading, showFinance])

  const weeklySuccess = successRate(performanceData)
  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <PageHeader
        title="Operations & Financial Dashboard"
        description="Live status of goods arrivals, godowns, dispatches, active fleet, attendance, and settlements"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {canSeeGoods && (
              <Button asChild size="sm" className="bg-orange-500 hover:bg-orange-600 text-white font-medium">
                <Link href="/goods">
                  <Package className="w-4 h-4 mr-1.5" />
                  New Goods Receipt
                </Link>
              </Button>
            )}
            {canSeeDispatch && (
              <Button asChild size="sm" variant="outline" className="border-navy-300 hover:bg-navy-50">
                <Link href="/dispatch">
                  <Truck className="w-4 h-4 mr-1.5" />
                  Plan Dispatch
                </Link>
              </Button>
            )}
          </div>
        }
      />

      <Suspense fallback={null}>
        <DeniedNotice />
      </Suspense>

      {loading && (
        <p className="text-xs text-gray-500" role="status">Loading live figures…</p>
      )}

      {/* Primary Operational KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3.5">
        <KPICard
          title="Received Today"
          value={metrics.goodsReceivedToday}
          subtitle="Consignments registered today"
          icon={Package}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Verification Pending"
          value={metrics.goodsAwaitingVerification}
          subtitle="Awaiting godown check"
          icon={Clock}
          iconClassName="bg-amber-50 text-amber-700"
        />
        <KPICard
          title="Ready For Dispatch"
          value={metrics.goodsAvailableDispatch}
          subtitle="Stock verified"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="In Godown / Warehouse"
          value={metrics.goodsInWarehouse}
          subtitle="Total active consignments"
          icon={Warehouse}
          iconClassName="bg-purple-50 text-purple-700"
        />
        <KPICard
          title="Trucks On Road"
          value={metrics.trucksOnRoad}
          subtitle={`Out of ${metrics.fleetSize} active vehicles`}
          icon={Truck}
          iconClassName="bg-indigo-50 text-indigo-700"
        />
        <KPICard
          title="Delivered Today"
          value={`${metrics.completedDeliveries} / ${metrics.deliveriesScheduled}`}
          subtitle={`${metrics.failedDeliveries} failed today • ${metrics.pendingDeliveries} open`}
          icon={MapPin}
          iconClassName="bg-teal-50 text-teal-700"
        />
      </div>

      {/* Financial & Staff Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {showFinance && (
          <>
            <KPICard
              title="Month Revenue (excl. GST)"
              value={formatCurrency(metrics.totalRevenueMonth)}
              subtitle="Invoiced this month"
              icon={TrendingUp}
              iconClassName="bg-emerald-50 text-emerald-700"
            />
            <KPICard
              title="Month Total Expenses"
              value={formatCurrency(metrics.totalExpensesMonth)}
              subtitle="Diesel, tolls, wages, repairs"
              icon={DollarSign}
              iconClassName="bg-rose-50 text-rose-700"
            />
            <KPICard
              title="Est. Operating Profit"
              value={formatCurrency(metrics.estimatedProfit)}
              subtitle="Revenue minus recorded expenses"
              icon={ArrowUpRight}
              iconClassName="bg-emerald-100 text-emerald-800"
            />
            <KPICard
              title="Customer Receivables"
              value={formatCurrency(metrics.customerOutstanding)}
              subtitle="Unpaid invoices (last 6 months)"
              icon={Receipt}
              iconClassName="bg-amber-50 text-amber-700"
            />
          </>
        )}
        <KPICard
          title="Staff Present Today"
          value={`${metrics.staffPresentToday} / ${metrics.staffMarkedToday}`}
          subtitle={metrics.staffMarkedToday ? 'Present or half-day of those marked' : 'Attendance not marked yet'}
          icon={Users}
          iconClassName="bg-blue-50 text-blue-700"
        />
        {showFinance && (
          <KPICard
            title="Advances This Month"
            value={formatCurrency(metrics.advancesThisMonth)}
            subtitle="To drivers & labourers"
            icon={Receipt}
            iconClassName="bg-orange-50 text-orange-700"
          />
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Daily Delivery Success Performance */}
        <Card className="border-gray-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-navy-950 flex items-center justify-between">
              <span>Weekly Delivery Performance</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {weeklySuccess === null ? 'No completed stops' : `${weeklySuccess}% Success Rate`}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Completed delivery attempts over the last 7 days (delivered vs failed / rescheduled)
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={performanceData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} />
                <YAxis stroke="#64748B" fontSize={11} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#0F294A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="scheduled" name="Scheduled Stops" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="delivered" name="Delivered Successfully" fill="#0F294A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="failed" name="Failed / Rescheduled" fill="#F43F5E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Revenue vs Expenses & Net Margin (finance roles only) */}
        {showFinance && (
        <Card className="border-gray-200/80 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-bold text-navy-950 flex items-center justify-between">
              <span>Monthly Transport Profitability (₹)</span>
              <span className="text-xs font-semibold text-navy-800 bg-navy-50 px-2 py-0.5 rounded-full">
                Financial Health
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              Invoiced revenue (excl. GST) vs recorded expenses, last 6 months
            </CardDescription>
          </CardHeader>
          <CardContent className="h-72 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueExpenseData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="month" stroke="#64748B" fontSize={11} />
                <YAxis
                  stroke="#64748B"
                  fontSize={11}
                  tickFormatter={(val) => `₹${val / 1000}k`}
                />
                <Tooltip
                  formatter={(val: any) => formatCurrency(Number(val))}
                  contentStyle={{ backgroundColor: '#0F294A', color: '#fff', borderRadius: '8px', fontSize: '12px' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="income" name="Recognized Revenue" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="expenses" name="Operating Expenses" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 4 }} />
                <Line type="monotone" dataKey="profit" name="Net Operating Margin" stroke="#F97316" strokeWidth={3} dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        )}
      </div>

      {/* Operational Widgets Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Recent Goods Arrivals */}
        <Card className="border-gray-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-bold text-navy-950">Recent Goods Arrivals</CardTitle>
              <CardDescription className="text-xs">Incoming godown consignments</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-orange-600 hover:text-orange-700 h-7 px-2">
              <Link href="/goods">View All</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-gray-100">
            {!loading && recentArrivals.length === 0 && (
              <p className="p-4 text-xs text-gray-500">No goods receipts recorded yet.</p>
            )}
            {recentArrivals.map((item) => (
              <div key={item.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-navy-900">{item.invoice_number}</span>
                  <StatusBadge
                    status={item.status}
                    colors={{
                      available: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                      verification_pending: 'bg-amber-50 text-amber-700 border-amber-200',
                    }}
                  />
                </div>
                <p className="text-xs text-gray-700 font-medium line-clamp-1">{item.product_name}</p>
                <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                  <span>{item.consignor || item.delivery_city}</span>
                  <span>{formatDate(item.created_at)}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Active Dispatches */}
        <Card className="border-gray-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-bold text-navy-950">Today&apos;s Dispatches</CardTitle>
              <CardDescription className="text-xs">Trucks, assigned drivers & routes</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-orange-600 hover:text-orange-700 h-7 px-2">
              <Link href="/dispatch">View Dispatches</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-gray-100">
            {!loading && recentDispatches.length === 0 && (
              <p className="p-4 text-xs text-gray-500">No dispatches planned for today or on the road.</p>
            )}
            {recentDispatches.map((dsp) => (
              <div key={dsp.id} className="p-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-bold text-navy-900">
                    {dsp.dispatch_number} • {dsp.vehicle_reg || '-'}
                  </span>
                  <StatusBadge
                    status={dsp.status}
                    colors={{
                      in_transit: 'bg-indigo-50 text-indigo-700 border-indigo-200',
                      planned: 'bg-blue-50 text-blue-700 border-blue-200',
                      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    }}
                  />
                </div>
                <p className="text-xs text-gray-600">
                  Driver: <span className="font-semibold text-gray-800">{dsp.driver_name || '-'}</span>
                </p>
                <div className="flex items-center justify-between mt-1 text-[11px] text-gray-500">
                  <span>{dsp.stops} delivery stop(s)</span>
                  <span>Est: {dsp.planned_distance}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Document Expiry Warnings */}
        <Card className="border-gray-200/80 shadow-sm">
          <CardHeader className="pb-3 border-b border-gray-100 flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm font-bold text-navy-950 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>Expiring Documents</span>
              </CardTitle>
              <CardDescription className="text-xs">Insurance, fitness, permits & licences</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="text-xs text-orange-600 hover:text-orange-700 h-7 px-2">
              <Link href="/vehicles">Fleet Reg</Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-gray-100">
            {!loading && expiringDocs.length === 0 && (
              <p className="p-4 text-xs text-gray-500">No documents expiring in the next 30 days.</p>
            )}
            {expiringDocs.map((doc, idx) => (
              <div key={idx} className="p-3.5 hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-bold text-navy-900">{doc.entity}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                    doc.severity === 'expired'
                      ? 'bg-rose-100 text-rose-800'
                      : doc.severity === 'warning'
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {doc.days < 0 ? `Expired ${Math.abs(doc.days)} day(s) ago` : doc.days === 0 ? 'Expires today' : `Expires in ${doc.days} day(s)`}
                  </span>
                </div>
                <p className="text-xs text-gray-600 font-medium">{doc.type}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">Due date: {formatDate(doc.expiry)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
