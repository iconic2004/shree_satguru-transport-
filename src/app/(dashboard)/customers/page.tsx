'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
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
import { Users, Plus, Phone, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount, todayIST, addDays } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

export default function CustomersPage() {
  const [customers, setCustomers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadCustomers = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('customers')
        .select('*, companies(name)')
        .order('name', { ascending: true })

      if (error) throw error
      setCustomers((data || []).map((c: any) => ({
        ...c,
        company_name: c.companies?.name || 'Direct Client',
      })))
    } catch (err) {
      console.error('Failed to load customers:', err)
      setCustomers([])
      toast({ title: 'Could not load customers', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCustomers()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    city: '',
    area: '',
    pin_code: '',
    credit_limit: '0',
  })

  const [submitting, setSubmitting] = useState(false)
  const { can } = useUser()
  const canManage = can('MANAGE_CUSTOMERS')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const creditLimit = formData.credit_limit.trim() === '' ? 0 : parseAmount(formData.credit_limit)
    if (!formData.name.trim()) {
      toast({ title: 'Customer name is required', variant: 'error' })
      return
    }
    if (Number.isNaN(creditLimit) || creditLimit < 0) {
      toast({ title: 'Invalid credit limit', description: 'Enter a number of 0 or more.', variant: 'error' })
      return
    }
    if (formData.pin_code.trim() && !/^\d{6}$/.test(formData.pin_code.trim())) {
      toast({ title: 'Invalid PIN code', description: 'PIN code must be 6 digits.', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const newRecord = {
        name: formData.name.trim(),
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        city: formData.city.trim() || null,
        area: formData.area.trim() || null,
        pin_code: formData.pin_code.trim() || null,
        credit_limit: creditLimit,
        is_active: true,
      }

      const { data, error } = await (supabase.from('customers') as any).insert([newRecord]).select()
      if (error) throw error
      if (!data?.[0]) throw new Error('The customer was not saved. Please try again.')

      setCustomers(prev => [{ ...data[0], company_name: 'Direct Client' }, ...prev])
      toast({
        title: 'Customer Added',
        description: `${newRecord.name} added to customer directory.`,
        variant: 'success',
      })
      setFormData({ name: '', contact_person: '', phone: '', city: '', area: '', pin_code: '', credit_limit: '0' })
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error adding customer',
        description: getErrorMessage(err, 'Failed to save to database'),
        variant: 'error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'name',
      header: 'Customer / Consignee',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.name}</span>
          <span className="text-[11px] text-gray-500">Parent: {row.original.company_name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'contact_person',
      header: 'Contact Person & Phone',
      cell: ({ row }) => (
        <div>
          <span className="font-medium text-gray-900 block">{row.original.contact_person}</span>
          <span className="text-[11px] text-gray-500 flex items-center gap-1">
            <Phone className="w-3 h-3" /> {row.original.phone}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'city',
      header: 'Location & PIN',
      cell: ({ row }) => (
        <span className="text-xs font-semibold text-navy-900 flex items-center gap-1">
          <MapPin className="w-3 h-3 text-gray-400" />
          {row.original.area}, {row.original.city} ({row.original.pin_code})
        </span>
      ),
    },
    {
      accessorKey: 'credit_limit',
      header: 'Credit Limit',
      cell: ({ row }) => (
        <span className="text-xs font-bold text-navy-900">
          {formatCurrency(row.original.credit_limit)}
        </span>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="Receiving Customers & Consignees"
        description="Delivery destination addresses, receiving contacts, distribution centers and retailers"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Customer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={customers}
        loading={loading}
        searchColumn="name"
        searchPlaceholder="Search customer name or destination..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Add Receiving Customer</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Register delivery consignee or retail distribution center.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Customer / Facility Name *</Label>
              <Input
                required
                placeholder="e.g. DMart Distribution Center"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Contact Person</Label>
                <Input
                  placeholder="Satish Patil"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  placeholder="+91 98700 33445"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">City *</Label>
                <Input
                  required
                  placeholder="Thane"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Area / Hub</Label>
                <Input
                  placeholder="Ghodbunder Road"
                  value={formData.area}
                  onChange={(e) => setFormData({ ...formData, area: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">PIN Code</Label>
                <Input
                  placeholder="400615"
                  value={formData.pin_code}
                  onChange={(e) => setFormData({ ...formData, pin_code: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Credit Limit (₹)</Label>
                <Input
                  type="number"
                  placeholder="250000"
                  value={formData.credit_limit}
                  onChange={(e) => setFormData({ ...formData, credit_limit: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
