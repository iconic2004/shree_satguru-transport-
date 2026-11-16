'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
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
import { ColumnDef } from '@tanstack/react-table'
import { CheckCircle2, AlertTriangle, MapPin, Camera, RotateCcw, FileCheck, Phone } from 'lucide-react'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { useUser } from '@/lib/hooks/use-user'
import { formatNumber } from '@/lib/utils/formatting'

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadDeliveries = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('deliveries')
        .select('*, customers(name), drivers(full_name), vehicles(registration_number), dispatches(dispatch_number), goods_receipts(product_name, quantity, unit)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setDeliveries((data || []).map((d: any) => ({
        id: d.id,
        goods_receipt_id: d.goods_receipt_id,
        dispatch_no: d.dispatches?.dispatch_number || '-',
        customer_name: d.customers?.name || '-',
        destination: d.destination_address || d.destination_city || '-',
        driver_name: d.drivers?.full_name || '-',
        vehicle_reg: d.vehicles?.registration_number || '-',
        cargo: d.goods_receipts ? `${d.goods_receipts.product_name || 'Goods'} (${d.goods_receipts.quantity} ${d.goods_receipts.unit || ''})`.trim() : '-',
        receiver_name: d.receiver_name || '-',
        status: d.status,
        pod_submitted: d.status === 'delivered',
      })))
    } catch (err) {
      console.error('Failed to load deliveries:', err)
      setDeliveries([])
      toast({ title: 'Could not load deliveries', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDeliveries()
  }, [])

  const [selectedDel, setSelectedDel] = useState<any>(null)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [podRemarks, setPodRemarks] = useState('')
  const [savingPod, setSavingPod] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const { user, can } = useUser()
  const canUpdate = can('UPDATE_DELIVERY')

  const handleMarkDelivered = async () => {
    if (!selectedDel || savingPod) return
    if (!receiverName.trim()) {
      toast({ title: 'Receiver name is required', description: 'Enter the name of the person who received the goods.', variant: 'error' })
      return
    }
    if (receiverPhone.trim() && !/^[+\d][\d\s-]{6,}$/.test(receiverPhone.trim())) {
      toast({ title: 'Invalid phone number', variant: 'error' })
      return
    }
    if (!user) {
      toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'error' })
      return
    }

    setSavingPod(true)
    const supabase = createClient()
    const previousStatus = selectedDel.status
    try {
      const now = new Date().toISOString()
      const { data: updated, error: updateError } = await (supabase.from('deliveries') as any)
        .update({
          status: 'delivered',
          receiver_name: receiverName.trim(),
          delivery_remarks: podRemarks.trim() || null,
          actual_arrival: now,
        })
        .eq('id', selectedDel.id)
        .select('id')
      if (updateError) throw updateError
      if (!updated?.length) throw new Error('You do not have permission to update this delivery.')

      const { error: podError } = await (supabase.from('proof_of_delivery') as any).insert([{
        delivery_id: selectedDel.id,
        receiver_name: receiverName.trim(),
        receiver_phone: receiverPhone.trim() || null,
        remarks: podRemarks.trim() || null,
        captured_at: now,
        captured_by: user.id,
      }])
      if (podError) {
        // Roll the status back so a delivery is never "delivered" without its POD.
        await (supabase.from('deliveries') as any)
          .update({ status: previousStatus, receiver_name: null, actual_arrival: null })
          .eq('id', selectedDel.id)
        throw podError
      }

      setDeliveries(prev =>
        prev.map(d =>
          d.id === selectedDel.id
            ? { ...d, status: 'delivered', receiver_name: receiverName.trim(), pod_submitted: true }
            : d
        )
      )
      toast({
        title: 'Proof of Delivery Recorded',
        description: `Delivery for ${selectedDel.customer_name} verified and marked Delivered.`,
        variant: 'success',
      })
      setSelectedDel(null)
    } catch (err) {
      toast({
        title: 'Error updating delivery',
        description: getErrorMessage(err, 'Could not update status'),
        variant: 'error',
      })
    } finally {
      setSavingPod(false)
    }
  }

  const handleReschedule = async (del: any) => {
    setBusyId(del.id)
    try {
      const supabase = createClient()
      const { data, error } = await (supabase.from('deliveries') as any)
        .update({ status: 'rescheduled' })
        .eq('id', del.id)
        .select('id')
      if (error) throw error
      if (!data?.length) throw new Error('You do not have permission to update this delivery.')

      // Release the consignment so it can be planned on another vehicle.
      if (del.goods_receipt_id) {
        const { error: goodsError } = await (supabase.from('goods_receipts') as any)
          .update({ status: 'available' })
          .eq('id', del.goods_receipt_id)
        if (goodsError) throw goodsError
      }

      setDeliveries(prev => prev.map(d => (d.id === del.id ? { ...d, status: 'rescheduled' } : d)))
      toast({
        title: 'Rescheduled',
        description: 'Consignment released back to available goods for the next dispatch.',
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Could not reschedule', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setBusyId(null)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'customer_name',
      header: 'Consignee & Destination',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.customer_name}</span>
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <MapPin className="w-3 h-3 text-gray-400" /> {row.original.destination}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'cargo',
      header: 'Cargo Consignment',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-800 block">{row.original.cargo}</span>
          <span className="text-[11px] text-gray-500">Trip: {row.original.dispatch_no}</span>
        </div>
      ),
    },
    {
      accessorKey: 'driver_name',
      header: 'Truck & Driver',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-bold text-navy-900 block">{row.original.vehicle_reg}</span>
          <span className="text-[11px] text-gray-600">Driver: {row.original.driver_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Delivery Status',
      cell: ({ row }) => (
        <div>
          <StatusBadge
            status={row.original.status}
            colors={{
              delivered: 'bg-emerald-50 text-emerald-800 border-emerald-200',
              in_transit: 'bg-indigo-50 text-indigo-800 border-indigo-200',
              failed: 'bg-rose-50 text-rose-800 border-rose-200',
            }}
          />
          {row.original.failure_reason && (
            <span className="text-[10px] text-rose-600 block mt-1 line-clamp-1">
              {row.original.failure_reason}
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'actions',
      header: 'Proof of Delivery',
      cell: ({ row }) => (
        row.original.status === 'in_transit' ? (
          <Button
            size="sm"
            className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            disabled={!canUpdate}
            onClick={() => {
              setSelectedDel(row.original)
              setReceiverName('')
              setReceiverPhone('')
              setPodRemarks('')
            }}
          >
            <Camera className="w-3.5 h-3.5 mr-1" />
            Submit POD
          </Button>
        ) : row.original.status === 'delivered' ? (
          <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <FileCheck className="w-3.5 h-3.5" /> POD Confirmed
          </span>
        ) : row.original.status === 'failed' ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
            disabled={!canUpdate || busyId === row.original.id}
            onClick={() => handleReschedule(row.original)}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reschedule
          </Button>
        ) : (
          <span className="text-xs text-gray-500 capitalize">{String(row.original.status).replace(/_/g, ' ')}</span>
        )
      ),
    },
  ]

  const scheduledCount = deliveries.length
  const deliveredCount = deliveries.filter(d => d.status === 'delivered').length
  const inTransitCount = deliveries.filter(d => d.status === 'in_transit').length
  const failedCount = deliveries.filter(d => d.status === 'failed').length

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Tracking & Proof of Delivery (POD)"
        description="Stop-by-stop live delivery tracking, receiver signatures, proof photograph recording and failed delivery recovery"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Scheduled Deliveries"
          value={scheduledCount.toString()}
          subtitle="Today across all routes"
          icon={MapPin}
        />
        <KPICard
          title="Delivered Successfully"
          value={deliveredCount.toString()}
          subtitle="Signed POD submitted"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Active In-Transit"
          value={inTransitCount.toString()}
          subtitle="Trucks on highway"
          icon={MapPin}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Failed / Rescheduled"
          value={failedCount.toString()}
          subtitle="Requires redelivery plan"
          icon={AlertTriangle}
          iconClassName="bg-rose-50 text-rose-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={deliveries}
        loading={loading}
        searchColumn="customer_name"
        searchPlaceholder="Search consignee customer or stop..."
      />

      {/* Submit POD Modal */}
      <Dialog open={!!selectedDel} onOpenChange={() => setSelectedDel(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Record Proof of Delivery</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Confirm goods handover and receiver confirmation for {selectedDel?.customer_name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Receiver Full Name *</Label>
              <Input
                required
                placeholder="e.g. Satish Patil (Store In-Charge)"
                value={receiverName}
                onChange={(e) => setReceiverName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Receiver Contact Phone</Label>
              <Input
                placeholder="+91 98765 43210"
                value={receiverPhone}
                onChange={(e) => setReceiverPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Delivery Inspection Remarks</Label>
              <Input
                placeholder="Packages received in intact condition, signed copy taken"
                value={podRemarks}
                onChange={(e) => setPodRemarks(e.target.value)}
              />
            </div>
            <div className="border border-dashed border-gray-300 rounded-lg p-4 text-center bg-gray-50">
              <Camera className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-600 font-medium">Signed challan photo upload is not available yet</p>
              <p className="text-[10px] text-gray-400 mt-0.5">Keep the physical signed copy on file.</p>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSelectedDel(null)} disabled={savingPod}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleMarkDelivered}
              disabled={savingPod}
            >
              Verify & Complete Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
