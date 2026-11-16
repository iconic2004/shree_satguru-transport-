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
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { capacityUtilization } from '@/lib/utils/finance'
import { useUser } from '@/lib/hooks/use-user'
import Link from 'next/link'

function toRow(d: any) {
  const stops = [...(d.dispatch_stops || [])]
    .sort((a: any, b: any) => a.stop_sequence - b.stop_sequence)
    .map((s: any) => s.city || s.delivery_address || `Stop ${s.stop_sequence}`)
  const vehicleLabel = d.vehicles
    ? `${d.vehicles.registration_number}${d.vehicles.make || d.vehicles.model ? ` (${`${d.vehicles.make || ''} ${d.vehicles.model || ''}`.trim()})` : ''}`
    : '-'
  return {
    id: d.id,
    dispatch_number: d.dispatch_number,
    dispatch_date: d.dispatch_date,
    vehicle_reg: vehicleLabel,
    driver_name: d.drivers?.full_name || '-',
    cargo_weight_kg: Number(d.cargo_weight_kg) || 0,
    vehicle_capacity_kg: Number(d.vehicles?.cargo_capacity_kg) || 0,
    capacity_utilization_pct: Number(d.capacity_utilization_pct) || 0,
    planned_distance_km: Number(d.planned_distance_km) || 0,
    planned_cost: Number(d.planned_cost) || 0,
    stops_count: stops.length,
    stops: stops.length ? stops : ['No stops recorded'],
    status: d.status,
  }
}

export default function DispatchPage() {
  const [dispatches, setDispatches] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadDispatches = async () => {
    try {
      const supabase = createClient()
      const [dspRes, vehRes, drvRes, goodsRes] = await Promise.all([
        supabase
          .from('dispatches')
          .select('*, vehicles(registration_number, make, model, cargo_capacity_kg), drivers(full_name), dispatch_stops(stop_sequence, city, delivery_address)')
          .order('created_at', { ascending: false }),
        supabase
          .from('vehicles')
          .select('id, registration_number, cargo_capacity_kg, status')
          .in('status', ['available', 'assigned'])
          .order('registration_number'),
        supabase.from('drivers').select('id, full_name').eq('employment_status', 'active').order('full_name'),
        supabase
          .from('goods_receipts')
          .select('id, invoice_number, product_name, weight_kg, delivery_city')
          .eq('status', 'available')
          .order('created_at', { ascending: true })
          .limit(12),
      ])

      if (dspRes.error) throw dspRes.error
      setDispatches((dspRes.data || []).map(toRow))
      setVehicleOptions(((vehRes.data as any[]) || []).map(v => ({ ...v, cargo_capacity_kg: Number(v.cargo_capacity_kg) || 0 })))
      setDriverOptions((drvRes.data as any) || [])
      setUnassignedGoods(((goodsRes.data as any[]) || []).map(g => ({
        id: g.id,
        invoice: g.invoice_number,
        product: g.product_name,
        weight: Number(g.weight_kg) || 0,
        dest: g.delivery_city || '-',
      })))
    } catch (err) {
      console.error('Failed to load dispatches:', err)
      setDispatches([])
      toast({ title: 'Could not load dispatches', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDispatches()
  }, [])

  const [unassignedGoods, setUnassignedGoods] = useState<any[]>([])
  const [vehicleOptions, setVehicleOptions] = useState<Array<{ id: string; registration_number: string; cargo_capacity_kg: number }>>([])
  const [driverOptions, setDriverOptions] = useState<Array<{ id: string; full_name: string }>>([])

  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { user, can } = useUser()
  const canManage = can('MANAGE_DISPATCH')
  const emptyForm = {
    dispatch_number: '',
    vehicle_id: '',
    driver_id: '',
    cargo_weight_kg: '',
    planned_distance_km: '',
    planned_cost: '',
    stops: '',
  }
  const [formData, setFormData] = useState(emptyForm)
  const selectedVehicle = vehicleOptions.find(v => v.id === formData.vehicle_id)
  const previewWeight = parseAmount(formData.cargo_weight_kg)
  const previewUtil = selectedVehicle && !Number.isNaN(previewWeight)
    ? capacityUtilization(previewWeight, selectedVehicle.cargo_capacity_kg)
    : null

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const weight = parseAmount(formData.cargo_weight_kg)
    const distance = formData.planned_distance_km.trim() === '' ? 0 : parseAmount(formData.planned_distance_km)
    const cost = formData.planned_cost.trim() === '' ? 0 : parseAmount(formData.planned_cost)
    const driver = driverOptions.find(d => d.id === formData.driver_id)
    const stops = formData.stops.split('->').map(s => s.trim()).filter(Boolean)

    if (!formData.dispatch_number.trim()) {
      toast({ title: 'Dispatch number is required', variant: 'error' })
      return
    }
    if (!selectedVehicle || !driver) {
      toast({ title: 'Select a vehicle and a driver', variant: 'error' })
      return
    }
    if (Number.isNaN(weight) || weight < 0 || Number.isNaN(distance) || distance < 0 || Number.isNaN(cost) || cost < 0) {
      toast({ title: 'Invalid numbers', description: 'Weight, distance and cost must be 0 or more.', variant: 'error' })
      return
    }
    const util = capacityUtilization(weight, selectedVehicle.cargo_capacity_kg)
    if (util === null) {
      toast({ title: 'Vehicle capacity unknown', description: 'Set the cargo capacity on the vehicle record first.', variant: 'error' })
      return
    }
    if (util > 100) {
      toast({
        title: 'Vehicle overloaded',
        description: `${formatNumber(weight)} kg exceeds the ${formatNumber(selectedVehicle.cargo_capacity_kg)} kg capacity of ${selectedVehicle.registration_number}.`,
        variant: 'error',
      })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const newRecord = {
        dispatch_number: formData.dispatch_number.trim(),
        dispatch_date: todayIST(),
        cargo_weight_kg: weight,
        capacity_utilization_pct: util,
        planned_distance_km: distance,
        planned_cost: cost,
        status: 'planned',
        vehicle_id: selectedVehicle.id,
        driver_id: driver.id,
        created_by: user?.id ?? null,
      }

      const { data, error } = await (supabase.from('dispatches') as any).insert([newRecord]).select('id')
      if (error) {
        if (error.code === '23505') throw new Error(`Dispatch number ${newRecord.dispatch_number} already exists.`)
        throw error
      }
      const dispatchId = data?.[0]?.id
      if (!dispatchId) throw new Error('The dispatch was not saved. Please try again.')

      if (stops.length > 0) {
        const { error: stopsError } = await (supabase.from('dispatch_stops') as any).insert(
          stops.map((city, i) => ({ dispatch_id: dispatchId, stop_sequence: i + 1, city }))
        )
        if (stopsError) {
          // Compensate so we never leave a half-created trip behind.
          await (supabase.from('dispatches') as any).delete().eq('id', dispatchId)
          throw stopsError
        }
      }

      toast({
        title: 'Dispatch Plan Created',
        description: `${newRecord.dispatch_number} assigned to ${driver.full_name} on ${selectedVehicle.registration_number}.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
      await loadDispatches()
    } catch (err) {
      toast({
        title: 'Error creating dispatch',
        description: getErrorMessage(err, 'Failed to save dispatch plan'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
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
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
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
        loading={loading}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Dispatch Number</Label>
                <Input
                  required
                  value={formData.dispatch_number}
                  onChange={(e) => setFormData({ ...formData, dispatch_number: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vehicle *</Label>
                <Select
                  value={formData.vehicle_id}
                  onValueChange={(val) => setFormData({ ...formData, vehicle_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={vehicleOptions.length ? 'Select vehicle' : 'No available vehicles'} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicleOptions.map(v => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registration_number} ({formatNumber(v.cargo_capacity_kg)} kg)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Assigned Driver *</Label>
                <Select
                  value={formData.driver_id}
                  onValueChange={(val) => setFormData({ ...formData, driver_id: val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={driverOptions.length ? 'Select driver' : 'No active drivers'} />
                  </SelectTrigger>
                  <SelectContent>
                    {driverOptions.map(d => (
                      <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>
                    ))}
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
            {previewUtil !== null && (
              <p
                className={`text-[11px] font-semibold rounded border p-2 ${
                  previewUtil > 100
                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                    : previewUtil > 95
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                }`}
              >
                Capacity utilisation: {previewUtil}%{previewUtil > 100 ? ' — overloaded, reduce cargo or pick a larger vehicle' : ''}
              </p>
            )}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Route Stops (Separate by &apos;-&gt;&apos;)</Label>
              <Input
                placeholder="Bhiwandi Godown -> Thane DMart -> Pune MIDC"
                value={formData.stops}
                onChange={(e) => setFormData({ ...formData, stops: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Generate Trip Sheet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
