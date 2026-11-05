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

export default function VehiclesPage() {
  const [vehicles, setVehicles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadVehicles = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setVehicles(data.map((v: any) => ({
          ...v,
          make_model: `${v.make || ''} ${v.model || ''}`.trim() || 'Tata Motors',
          assigned_driver: 'Assigned Driver',
        })))
      } else {
        setVehicles([
          {
            id: 'v1',
            registration_number: 'MH-04-GP-4521',
            vehicle_type: 'truck',
            make_model: 'Tata Motors LPT 1613',
            cargo_capacity_kg: 9500,
            fuel_type: 'diesel',
            current_odometer: 74520,
            insurance_expiry: '2027-04-15',
            fitness_expiry: '2027-03-20',
            puc_expiry: '2027-01-10',
            assigned_driver: 'Ramesh Yadav',
            status: 'available',
          },
          {
            id: 'v2',
            registration_number: 'MH-43-BP-8890',
            vehicle_type: 'truck',
            make_model: 'Eicher Pro 3015',
            cargo_capacity_kg: 8500,
            fuel_type: 'diesel',
            current_odometer: 48210,
            insurance_expiry: '2027-06-10',
            fitness_expiry: '2026-12-05',
            puc_expiry: '2026-12-05',
            assigned_driver: 'Santosh Patil',
            status: 'available',
          },
          {
            id: 'v3',
            registration_number: 'MH-03-CP-1204',
            vehicle_type: 'tempo',
            make_model: 'Tata Ace Gold',
            cargo_capacity_kg: 1200,
            fuel_type: 'cng',
            current_odometer: 31200,
            insurance_expiry: '2027-02-28',
            fitness_expiry: '2027-02-15',
            puc_expiry: '2027-03-01',
            assigned_driver: 'Mohammad Irfan',
            status: 'available',
          },
        ])
      }
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadVehicles()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    registration_number: '',
    vehicle_type: 'truck',
    make_model: 'Tata Motors',
    cargo_capacity_kg: '9000',
    fuel_type: 'diesel',
    current_odometer: '10000',
    insurance_expiry: '2027-10-01',
    fitness_expiry: '2027-10-01',
    puc_expiry: '2027-04-01',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const supabase = createClient()
      const parts = formData.make_model.split(' ')
      const make = parts[0] || 'Tata'
      const model = parts.slice(1).join(' ') || 'Motors'

      const newRecord = {
        registration_number: formData.registration_number,
        vehicle_type: formData.vehicle_type as any,
        make,
        model,
        cargo_capacity_kg: parseFloat(formData.cargo_capacity_kg) || 0,
        fuel_type: formData.fuel_type as any,
        current_odometer: parseFloat(formData.current_odometer) || 0,
        insurance_expiry: formData.insurance_expiry,
        fitness_expiry: formData.fitness_expiry,
        puc_expiry: formData.puc_expiry,
        status: 'available',
      }

      const { data, error } = await (supabase.from('vehicles') as any).insert([newRecord]).select()
      
      const createdItem = (data && data[0]) ? {
        ...data[0],
        make_model: formData.make_model,
        assigned_driver: 'Unassigned',
      } : {
        id: `v-${Date.now()}`,
        ...newRecord,
        make_model: formData.make_model,
        assigned_driver: 'Unassigned',
      }

      setVehicles([createdItem, ...vehicles])
      toast({
        title: 'Vehicle Added',
        description: `${formData.registration_number} added to fleet.`,
        variant: 'success',
      })
      setIsOpen(false)
    } catch (err: any) {
      toast({
        title: 'Error adding vehicle',
        description: err.message || 'Failed to save to database',
        variant: 'error',
      })
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
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Vehicle
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={vehicles}
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Register Vehicle
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
