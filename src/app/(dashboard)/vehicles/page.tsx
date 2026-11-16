'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColumnDef } from '@tanstack/react-table'
import { Truck, Plus, Gauge, AlertTriangle, ShieldCheck, Fuel } from 'lucide-react'
import { formatNumber, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

function toRow(v: any) {
  return {
    ...v,
    make_model: `${v.make || ''} ${v.model || ''}`.trim() || '-',
    assigned_driver: v.drivers?.full_name || 'Unassigned',
  }
}

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadVehicles = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('vehicles')
        .select('*, drivers!vehicles_assigned_driver_id_fkey(full_name)')
        .order('created_at', { ascending: false })

      if (error) throw error
      setVehicles((data || []).map(toRow))
    } catch (err) {
      console.error('Failed to load vehicles:', err)
      setVehicles([])
      toast({ title: 'Could not load vehicles', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { can } = useUser()
  const canManage = can('MANAGE_VEHICLES')
  const emptyForm = {
    registration_number: '',
    vehicle_type: 'truck',
    make_model: '',
    cargo_capacity_kg: '',
    fuel_type: 'diesel',
    current_odometer: '',
    insurance_expiry: '',
    fitness_expiry: '',
    puc_expiry: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const registration = formData.registration_number.trim().toUpperCase()
    const capacity = parseAmount(formData.cargo_capacity_kg)
    const odometer = formData.current_odometer.trim() === '' ? 0 : parseAmount(formData.current_odometer)
    if (!registration) {
      toast({ title: 'Registration number is required', variant: 'error' })
      return
    }
    if (Number.isNaN(capacity) || capacity <= 0) {
      toast({ title: 'Invalid capacity', description: 'Enter the cargo capacity in kg (greater than 0).', variant: 'error' })
      return
    }
    if (Number.isNaN(odometer) || odometer < 0) {
      toast({ title: 'Invalid odometer reading', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const [make, ...modelParts] = formData.make_model.trim().split(/\s+/)

      const newRecord = {
        registration_number: registration,
        vehicle_type: formData.vehicle_type as any,
        make: make || null,
        model: modelParts.join(' ') || null,
        cargo_capacity_kg: capacity,
        fuel_type: formData.fuel_type as any,
        current_odometer: odometer,
        insurance_expiry: formData.insurance_expiry || null,
        fitness_expiry: formData.fitness_expiry || null,
        puc_expiry: formData.puc_expiry || null,
        status: 'available',
      }

      const { data, error } = await (supabase.from('vehicles') as any)
        .insert([newRecord])
        .select('*, drivers!vehicles_assigned_driver_id_fkey(full_name)')
      if (error) throw error
      if (!data?.[0]) throw new Error('The vehicle was not saved. Please try again.')

      setVehicles(prev => [toRow(data[0]), ...prev])
      toast({
        title: 'Vehicle Added',
        description: `${registration} added to fleet.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error adding vehicle',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'registration_number',
      header: 'Registration No',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 font-mono text-sm block">
            {row.original.registration_number}
          </span>
          <span className="text-[11px] text-gray-500">{row.original.make_model}</span>
        </div>
      ),
    },
    {
      accessorKey: 'vehicle_type',
      header: 'Type & Capacity',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-gray-800 block">
            {row.original.vehicle_type}
          </span>
          <span className="text-[11px] text-gray-500">
            Max: {formatNumber(row.original.cargo_capacity_kg)} kg
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'current_odometer',
      header: 'Odometer & Fuel',
      cell: ({ row }) => (
        <div>
          <span className="text-xs font-semibold text-gray-900 flex items-center gap-1">
            <Gauge className="w-3 h-3 text-gray-400" />
            {formatNumber(row.original.current_odometer)} km
          </span>
          <span className="text-[11px] text-gray-500 uppercase flex items-center gap-1 mt-0.5">
            <Fuel className="w-3 h-3 text-orange-500" />
            {row.original.fuel_type}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'puc_expiry',
      header: 'PUC / Fitness Expiry',
      cell: ({ row }) => (
        <div>
          <span className="text-xs text-gray-700 block">
            PUC: {formatDate(row.original.puc_expiry)}
          </span>
          <span className="text-[11px] text-gray-500">
            Fit: {formatDate(row.original.fitness_expiry)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'assigned_driver',
      header: 'Assigned Driver',
      cell: ({ row }) => (
        <span className="text-xs font-medium text-gray-800">{row.original.assigned_driver}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.status}
          colors={{
            available: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            under_maintenance: 'bg-amber-50 text-amber-800 border-amber-200',
            on_trip: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          }}
        />
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet & Vehicle Register"
        description="Transport fleet records, cargo carrying capacities, fuel types, odometer tracking and certificate expiries"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Vehicle
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={vehicles}
        loading={loading}
        searchColumn="registration_number"
        searchPlaceholder="Search vehicle registration no..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Add Vehicle to Fleet</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Register commercial transport truck, tempo or mini-truck.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Registration Number *</Label>
              <Input
                required
                placeholder="MH-04-AB-1234"
                value={formData.registration_number}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Vehicle Type</Label>
                <Select
                  value={formData.vehicle_type}
                  onValueChange={(val) => setFormData({ ...formData, vehicle_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="truck">Heavy Truck</SelectItem>
                    <SelectItem value="tempo">Tempo</SelectItem>
                    <SelectItem value="mini_truck">Mini Truck</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Fuel Type</Label>
                <Select
                  value={formData.fuel_type}
                  onValueChange={(val) => setFormData({ ...formData, fuel_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diesel">Diesel</SelectItem>
                    <SelectItem value="cng">CNG</SelectItem>
                    <SelectItem value="petrol">Petrol</SelectItem>
                    <SelectItem value="electric">Electric</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Make & Model</Label>
                <Input
                  placeholder="Tata Motors LPT 1613"
                  value={formData.make_model}
                  onChange={(e) => setFormData({ ...formData, make_model: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payload Capacity (KG)</Label>
                <Input
                  type="number"
                  placeholder="9500"
                  value={formData.cargo_capacity_kg}
                  onChange={(e) => setFormData({ ...formData, cargo_capacity_kg: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Current Odometer (KM)</Label>
                <Input
                  type="number"
                  placeholder="75000"
                  value={formData.current_odometer}
                  onChange={(e) => setFormData({ ...formData, current_odometer: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">PUC Expiry</Label>
                <Input
                  type="date"
                  value={formData.puc_expiry}
                  onChange={(e) => setFormData({ ...formData, puc_expiry: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Register Vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
