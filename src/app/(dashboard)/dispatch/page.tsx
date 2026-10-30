'use client'

import { useState } from 'react'
import { PageHeader } from '@/components/shared/page-header'
import { KPICard } from '@/components/shared/kpi-card'
import { StatusBadge } from '@/components/shared/status-badge'
import { DataTable } from '@/components/shared/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColumnDef } from '@tanstack/react-table'
import { Truck, Plus, MapPin, Printer, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react'
import { formatNumber, formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import Link from 'next/link'

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState([
    {
      id: 'dsp-1',
      dispatch_number: 'DSP-2026-0041',
      dispatch_date: '2026-10-29',
      vehicle_reg: 'MH-04-GP-4521 (Tata 1613)',
      driver_name: 'Ramesh Yadav',
      cargo_weight_kg: 4950,
      vehicle_capacity_kg: 9500,
      capacity_utilization_pct: 52.1,
      planned_distance_km: 65,
      planned_cost: 3500,
      stops_count: 3,
      stops: ['Bhiwandi Godown (Origin)', 'Reliance DC (Stop 1)', 'DMart DC (Stop 2)'],
      status: 'in_transit',
    },
    {
      id: 'dsp-2',
      dispatch_number: 'DSP-2026-0042',
      dispatch_date: '2026-10-29',
      vehicle_reg: 'MH-43-BP-8890 (Eicher 3015)',
      driver_name: 'Santosh Patil',
      cargo_weight_kg: 2400,
      vehicle_capacity_kg: 8500,
      capacity_utilization_pct: 28.2,
      planned_distance_km: 45,
      planned_cost: 2800,
      stops_count: 2,
      stops: ['Vashi Hub (Origin)', 'DMart Thane (Stop 1)'],
      status: 'planned',
    },
    {
      id: 'dsp-3',
      dispatch_number: 'DSP-2026-0043',
      dispatch_date: '2026-10-28',
      vehicle_reg: 'MH-03-CP-1204 (Tata Ace)',
      driver_name: 'Mohammad Irfan',
      cargo_weight_kg: 1100,
      vehicle_capacity_kg: 1200,
      capacity_utilization_pct: 91.6,
      planned_distance_km: 32,
      planned_cost: 1500,
      stops_count: 1,
      stops: ['Kurla Local DC (Stop 1)'],
      status: 'completed',
    },
  ])

  const [unassignedGoods, setUnassignedGoods] = useState([
    { invoice: 'INV-2026-0893', product: 'Royale Luxury Emulsion (120 buckets)', weight: 3120, dest: 'Pune MIDC' },
    { invoice: 'INV-2026-0894', product: 'Mahalaxmi Steel Pipes (40 bundles)', weight: 2800, dest: 'Panvel Yard' },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    dispatch_number: `DSP-2026-00${dispatches.length + 42}`,
    vehicle_reg: 'MH-04-GP-4521 (Tata 1613)',
    driver_name: 'Ramesh Yadav',
    cargo_weight_kg: '3120',
    planned_distance_km: '140',
    planned_cost: '6500',
    stops: 'Bhiwandi Central -> Pune Bhosari MIDC',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const weight = parseFloat(formData.cargo_weight_kg) || 0
    const cap = 9500
    const util = Math.round((weight / cap) * 100)

    const newDsp = {
      id: `dsp-${Date.now()}`,
      dispatch_number: formData.dispatch_number,
      dispatch_date: new Date().toISOString().split('T')[0],
      vehicle_reg: formData.vehicle_reg,
      driver_name: formData.driver_name,
      cargo_weight_kg: weight,
      vehicle_capacity_kg: cap,
      capacity_utilization_pct: util,
      planned_distance_km: parseFloat(formData.planned_distance_km) || 0,
      planned_cost: parseFloat(formData.planned_cost) || 0,
      stops_count: 2,
      stops: formData.stops.split('->').map(s => s.trim()),
      status: 'planned',
    }

    setDispatches([newDsp, ...dispatches])
    toast({
      title: 'Dispatch Plan Created',
      description: `${formData.dispatch_number} assigned to ${formData.driver_name}. Trip sheet ready.`,
      variant: 'success',
    })
    setIsOpen(false)
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'dispatch_number',
      header: 'Trip & Date',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.dispatch_number}</span>
          <span className="text-[11px] text-gray-500">{formatDate(row.original.dispatch_date)}</span>
        </div>
      ),
    },
    {
      accessorKey: 'vehicle_reg',
      header: 'Assigned Truck & Driver',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-900 block">{row.original.vehicle_reg}</span>
          <span className="text-xs text-gray-600 font-medium">Driver: {row.original.driver_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'capacity_utilization_pct',
      header: 'Weight & Capacity Utilization',
      cell: ({ row }) => {
        const util = row.original.capacity_utilization_pct
        return (
          <div className="w-44">
            <div className="flex justify-between text-xs font-semibold mb-1">
              <span>{formatNumber(row.original.cargo_weight_kg)} kg</span>
              <span className={util > 95 ? 'text-rose-600' : 'text-emerald-700'}>{util}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  util > 95 ? 'bg-rose-500' : util > 75 ? 'bg-orange-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(util, 100)}%` }}
              />
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'stops',
      header: 'Route & Stops',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-900 block">
            {row.original.stops_count} Delivery Stops
          </span>
          <span className="text-[11px] text-gray-500 truncate block max-w-xs">
            {row.original.stops.join(' → ')}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Dispatch Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            in_transit: 'bg-indigo-50 text-indigo-700 border-indigo-200',
            planned: 'bg-blue-50 text-blue-700 border-blue-200',
            completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Trip Sheet',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs flex items-center gap-1"
          onClick={() => window.print()}
        >
          <Printer className="w-3.5 h-3.5" />
          Print Sheet
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Truck-Wise Dispatch Planner"
        description="Consolidate goods consignments into truck routes, assign drivers, verify cargo capacity and generate driver trip manifests"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Create Dispatch
          </Button>
        }
      />

      {/* Unassigned Goods Warning Card */}
      {unassignedGoods.length > 0 && (
        <Card className="border-orange-200 bg-orange-50/40">
          <CardHeader className="py-3 px-4 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              <CardTitle className="text-xs font-bold text-orange-950">
                Unassigned Consignments Awaiting Vehicle Route ({unassignedGoods.length})
              </CardTitle>
            </div>
            <span className="text-[11px] text-orange-800 font-medium">Ready in godown</span>
          </CardHeader>
          <CardContent className="px-4 pb-3 pt-0 flex gap-4 overflow-x-auto">
            {unassignedGoods.map((item, i) => (
              <div key={i} className="bg-white border border-orange-200 rounded-lg p-2.5 text-xs flex-shrink-0 w-72">
                <span className="font-bold text-navy-950 block">{item.invoice}</span>
                <span className="text-gray-700 font-medium block truncate">{item.product}</span>
                <div className="flex justify-between text-[11px] text-gray-500 mt-1">
                  <span>{formatNumber(item.weight)} kg</span>
                  <span className="font-semibold text-navy-900">{item.dest}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <DataTable
        columns={columns}
        data={dispatches}
        searchColumn="dispatch_number"
        searchPlaceholder="Search dispatch ID or truck reg..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Plan New Vehicle Dispatch</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Assign compatible consignments, truck, driver and delivery stop sequence.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dispatch Number</Label>
                <Input
                  required
                  value={formData.dispatch_number}
                  onChange={(e) => setFormData({ ...formData, dispatch_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vehicle</Label>
                <Select
                  value={formData.vehicle_reg}
                  onValueChange={(val) => setFormData({ ...formData, vehicle_reg: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MH-04-GP-4521 (Tata 1613)">MH-04-GP-4521 (9.5T)</SelectItem>
                    <SelectItem value="MH-43-BP-8890 (Eicher 3015)">MH-43-BP-8890 (8.5T)</SelectItem>
                    <SelectItem value="MH-03-CP-1204 (Tata Ace)">MH-03-CP-1204 (1.2T)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assigned Driver</Label>
                <Select
                  value={formData.driver_name}
                  onValueChange={(val) => setFormData({ ...formData, driver_name: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ramesh Yadav">Ramesh Yadav</SelectItem>
                    <SelectItem value="Santosh Patil">Santosh Patil</SelectItem>
                    <SelectItem value="Mohammad Irfan">Mohammad Irfan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Total Cargo Weight (KG)</Label>
                <Input
                  required
                  type="number"
                  placeholder="3120"
                  value={formData.cargo_weight_kg}
                  onChange={(e) => setFormData({ ...formData, cargo_weight_kg: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Route Stops (Separate by &apos;-&gt;&apos;)</Label>
              <Input
                placeholder="Bhiwandi Godown -> Thane DMart -> Pune MIDC"
                value={formData.stops}
                onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Planned Distance (KM)</Label>
                <Input
                  type="number"
                  placeholder="140"
                  value={formData.planned_distance_km}
                  onChange={(e) => setFormData({ ...formData, planned_distance_km: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Planned Trip Cost (₹)</Label>
                <Input
                  type="number"
                  placeholder="6500"
                  value={formData.planned_cost}
                  onChange={(e) => setFormData({ ...formData, planned_cost: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Generate Trip Sheet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
