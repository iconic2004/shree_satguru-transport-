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
import { UserCheck, Plus, Phone, Truck, ShieldAlert, Award, Calendar } from 'lucide-react'
import { formatCurrency, formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'
import Link from 'next/link'

interface DriverItem {
  id: string
  full_name: string
  phone: string
  licence_number: string
  licence_class: string
  licence_expiry: string
  salary_type: string
  monthly_salary: number | null
  daily_wage: number | null
  trip_rate: number | null
  assigned_vehicle: string
  employment_status: string
}

export default function DriversPage() {
  const [drivers, setDrivers] = useState<DriverItem[]>([])
  const [loading, setLoading] = useState(true)

  const [vehicleOptions, setVehicleOptions] = useState<Array<{ id: string; registration_number: string }>>([])

  const loadDrivers = async () => {
    try {
      const supabase = createClient()
      const [driversRes, vehiclesRes] = await Promise.all([
        supabase
          .from('drivers')
          .select('*, vehicles!fk_drivers_assigned_vehicle(registration_number)')
          .order('created_at', { ascending: false }),
        supabase.from('vehicles').select('id, registration_number').order('registration_number'),
      ])

      if (driversRes.error) throw driversRes.error
      setDrivers((driversRes.data || []).map((d: any) => ({
        ...d,
        assigned_vehicle: d.vehicles?.registration_number || '',
      })))
      setVehicleOptions((vehiclesRes.data as any) || [])
    } catch (err) {
      console.error('Failed to load drivers:', err)
      setDrivers([])
      toast({ title: 'Could not load drivers', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDrivers()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { can } = useUser()
  const canManage = can('MANAGE_DRIVERS')
  const emptyForm = {
    full_name: '',
    phone: '',
    licence_number: '',
    licence_class: 'Heavy Transport (HMV)',
    licence_expiry: '',
    salary_type: 'monthly',
    rate_amount: '',
    assigned_vehicle: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const rate = parseAmount(formData.rate_amount)
    if (!formData.full_name.trim() || !formData.phone.trim() || !formData.licence_number.trim()) {
      toast({ title: 'Missing details', description: 'Name, phone and licence number are required.', variant: 'error' })
      return
    }
    if (Number.isNaN(rate) || rate < 0) {
      toast({ title: 'Invalid rate', description: 'Enter the salary / wage / trip rate as a number.', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const newRecord = {
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim(),
        licence_number: formData.licence_number.trim().toUpperCase(),
        licence_class: formData.licence_class,
        licence_expiry: formData.licence_expiry || null,
        salary_type: formData.salary_type,
        monthly_salary: formData.salary_type === 'monthly' ? rate : null,
        daily_wage: formData.salary_type === 'daily' ? rate : null,
        trip_rate: formData.salary_type === 'trip_based' ? rate : null,
        employment_status: 'active',
        assigned_vehicle_id: formData.assigned_vehicle || null,
      }

      const { data, error } = await (supabase.from('drivers') as any)
        .insert([newRecord])
        .select('*, vehicles!fk_drivers_assigned_vehicle(registration_number)')
      if (error) throw error
      if (!data?.[0]) throw new Error('The driver was not saved. Please try again.')

      setDrivers(prev => [{ ...data[0], assigned_vehicle: data[0].vehicles?.registration_number || '' }, ...prev])
      toast({
        title: 'Driver Enrolled',
        description: `${newRecord.full_name} registered successfully.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error adding driver',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'full_name',
      header: 'Driver Name & Phone',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.full_name}</span>
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {row.original.phone}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'licence_number',
      header: 'Licence No & Expiry',
      cell: ({ row }) => (
        <div>
          <span className="font-mono text-xs font-semibold text-gray-900 block">
            {row.original.licence_number}
          </span>
          <span className="text-[11px] text-gray-500">
            {row.original.licence_class} • Exp: {formatDate(row.original.licence_expiry)}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'assigned_vehicle',
      header: 'Assigned Vehicle',
      cell: ({ row }) => (
        <span className="font-bold text-navy-800 text-xs flex items-center gap-1 bg-navy-50 px-2.5 py-1 rounded-md border border-navy-200 w-fit">
          <Truck className="w-3.5 h-3.5 text-navy-600" />
          {row.original.assigned_vehicle || 'Floating'}
        </span>
      ),
    },
    {
      accessorKey: 'salary_type',
      header: 'Payment Structure',
      cell: ({ row }) => {
        const type = row.original.salary_type
        const amount =
          type === 'monthly'
            ? `${formatCurrency(row.original.monthly_salary)} / mo`
            : type === 'daily'
            ? `${formatCurrency(row.original.daily_wage)} / day`
            : `${formatCurrency(row.original.trip_rate)} / trip`
        return (
          <div>
            <span className="text-xs font-bold text-gray-900 block">{amount}</span>
            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{type}</span>
          </div>
        )
      },
    },
    {
      accessorKey: 'employment_status',
      header: 'Status',
      cell: ({ row }) => (
        <StatusBadge
          status={row.original.employment_status}
          colors={{
            active: 'bg-emerald-50 text-emerald-800 border-emerald-200',
            inactive: 'bg-gray-100 text-gray-800 border-gray-200',
          }}
        />
      ),
    },
    {
      id: 'actions',
      header: 'Ledger',
      cell: ({ row }) => (
        <Button asChild variant="outline" size="sm" className="h-7 text-xs">
          <Link href="/staff/advances">View Ledger</Link>
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Driver Roster & Register"
        description="Heavy & commercial drivers, licences, assigned vehicles, trip allowances and salary structures"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Register Driver
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={drivers}
        loading={loading}
        searchColumn="full_name"
        searchPlaceholder="Search driver name or licence no..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Register New Driver</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Add commercial driver with licence details and agreed salary terms.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                required
                placeholder="e.g. Driver Full Name"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Number *</Label>
                <Input
                  required
                  placeholder="+91 97654 32100"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Licence Number *</Label>
                <Input
                  required
                  placeholder="MH0420180045612"
                  value={formData.licence_number}
                  onChange={(e) => setFormData({ ...formData, licence_number: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Licence Class</Label>
                <Select
                  value={formData.licence_class}
                  onValueChange={(val) => setFormData({ ...formData, licence_class: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Heavy Transport (HMV)">Heavy Transport (HMV)</SelectItem>
                    <SelectItem value="Medium Goods Vehicle">Medium Goods Vehicle</SelectItem>
                    <SelectItem value="Light Motor Vehicle (LMV)">Light Motor Vehicle (LMV)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Licence Expiry</Label>
                <Input
                  type="date"
                  value={formData.licence_expiry}
                  onChange={(e) => setFormData({ ...formData, licence_expiry: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Payment Structure</Label>
                <Select
                  value={formData.salary_type}
                  onValueChange={(val) => setFormData({ ...formData, salary_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Fixed Salary</SelectItem>
                    <SelectItem value="daily">Daily Wage</SelectItem>
                    <SelectItem value="trip_based">Trip-Based Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Rate Amount (₹)</Label>
                <Input
                  type="number"
                  placeholder="25000"
                  value={formData.rate_amount}
                  onChange={(e) => setFormData({ ...formData, rate_amount: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Assigned Truck</Label>
              <Select
                value={formData.assigned_vehicle || 'none'}
                onValueChange={(val) => setFormData({ ...formData, assigned_vehicle: val === 'none' ? '' : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select vehicle" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not assigned</SelectItem>
                  {vehicleOptions.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.registration_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Enroll Driver
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
