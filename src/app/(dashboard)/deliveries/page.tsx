'use client'

import { useState } from 'react'
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
import { formatNumber } from '@/lib/utils/formatting'

export default function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState([
    {
      id: 'del-1',
      dispatch_no: 'DSP-2026-0041',
      customer_name: 'Reliance Retail Central DC',
      destination: 'Poman Industrial Hub, Bhiwandi',
      driver_name: 'Ramesh Yadav',
      vehicle_reg: 'MH-04-GP-4521',
      cargo: 'Frooti 200ml (450 Cartons)',
      receiver_name: 'Praveen Mehta (Store Mgr)',
      status: 'delivered',
      pod_submitted: true,
    },
    {
      id: 'del-2',
      dispatch_no: 'DSP-2026-0041',
      customer_name: 'DMart DC Thane',
      destination: 'Ghodbunder Road, Thane',
      driver_name: 'Ramesh Yadav',
      vehicle_reg: 'MH-04-GP-4521',
      cargo: 'Cinthol Soap (200 Cartons)',
      receiver_name: '-',
      status: 'in_transit',
      pod_submitted: false,
    },
    {
      id: 'del-3',
      dispatch_no: 'DSP-2026-0040',
      customer_name: 'Apex Paints & Hardware',
      destination: 'Bhosari MIDC, Pune',
      driver_name: 'Santosh Patil',
      vehicle_reg: 'MH-43-BP-8890',
      cargo: 'Royale Luxury Emulsion (120 Buckets)',
      receiver_name: 'Receiver Unavailable',
      status: 'failed',
      failure_reason: 'Gate closed due to union bandh; rescheduled for tomorrow',
      pod_submitted: false,
    },
  ])

  const [selectedDel, setSelectedDel] = useState<any>(null)
  const [receiverName, setReceiverName] = useState('')
  const [receiverPhone, setReceiverPhone] = useState('')
  const [podRemarks, setPodRemarks] = useState('')

  const handleMarkDelivered = () => {
    if (!selectedDel) return
    setDeliveries(prev =>
      prev.map(d =>
        d.id === selectedDel.id
          ? {
              ...d,
              status: 'delivered',
              receiver_name: receiverName || 'Store In-charge',
              pod_submitted: true,
            }
          : d
      )
    )
    toast({
      title: 'Proof of Delivery Recorded',
      description: `Delivery for ${selectedDel.customer_name} verified and marked Delivered.`,
      variant: 'success',
    })
    setSelectedDel(null)
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
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
            onClick={() => {
              toast({
                title: 'Rescheduled',
                description: 'Stop added back to available goods for next vehicle dispatch.',
              })
            }}
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reschedule
          </Button>
        )
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delivery Tracking & Proof of Delivery (POD)"
        description="Stop-by-stop live delivery tracking, receiver signatures, proof photograph recording and failed delivery recovery"
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <KPICard
          title="Scheduled Deliveries"
          value="14"
          subtitle="Today across all routes"
          icon={MapPin}
        />
        <KPICard
          title="Delivered Successfully"
          value="9"
          subtitle="Signed POD submitted"
          icon={CheckCircle2}
          iconClassName="bg-emerald-50 text-emerald-700"
        />
        <KPICard
          title="Active In-Transit"
          value="4"
          subtitle="Trucks on highway"
          icon={MapPin}
          iconClassName="bg-blue-50 text-blue-700"
        />
        <KPICard
          title="Failed / Rescheduled"
          value="1"
          subtitle="Requires redelivery plan"
          icon={AlertTriangle}
          iconClassName="bg-rose-50 text-rose-700"
        />
      </div>

      <DataTable
        columns={columns}
        data={deliveries}
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
              <p className="text-xs text-gray-600 font-medium">Capture or Upload Signed Challan Photo</p>
              <p className="text-[10px] text-gray-400 mt-0.5">JPG, PNG or PDF under 10MB</p>
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setSelectedDel(null)}>
              Cancel
            </Button>
            <Button
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              onClick={handleMarkDelivered}
            >
              Verify & Complete Delivery
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
