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

      if (data && data.length > 0) {
        setCustomers(data.map((c: any) => ({
          ...c,
          company_name: c.companies?.name || 'Direct Client',
        })))
      } else {
        setCustomers([
          {
            id: 'cust-1',
            name: 'Reliance Retail Central Warehouse',
            company_name: 'Parle Agro Industries Ltd',
            contact_person: 'Praveen Mehta',
            phone: '+91 99200 11223',
            city: 'Bhiwandi',
            area: 'Poman Industrial Hub',
            pin_code: '421302',
            credit_limit: 300000,
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
    credit_limit: '150000',
  })

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const supabase = createClient()
      const newRecord = {
        name: formData.name,
        contact_person: formData.contact_person,
        phone: formData.phone,
        city: formData.city,
        area: formData.area,
        pin_code: formData.pin_code,
        credit_limit: parseFloat(formData.credit_limit) || 0,
        is_active: true,
      }

      const { data, error } = await (supabase.from('customers') as any).insert([newRecord]).select()

      const createdCust = (data && data[0]) ? {
        ...data[0],
        company_name: 'Direct Customer',
      } : {
        id: `cust-${Date.now()}`,
        ...newRecord,
        company_name: 'Direct Customer',
      }

      setCustomers([createdCust, ...customers])
      toast({
        title: 'Customer Added',
        description: `${formData.name} added to customer directory.`,
        variant: 'success',
      })
      setIsOpen(false)
    } catch (err: any) {
      toast({
        title: 'Error adding customer',
        description: err.message || 'Failed to save to database',
        variant: 'error',
      })
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
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Customer
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={customers}
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
              <Button type="submit" onClick={handleCreate} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Save Customer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
