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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ColumnDef } from '@tanstack/react-table'
import { Building2, Plus, Phone, Mail, MapPin } from 'lucide-react'
import { formatCurrency } from '@/lib/utils/formatting'
import { getErrorMessage } from '@/lib/utils/errors'
import { parseAmount } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'
import { toast } from '@/lib/hooks/use-toast'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadCompanies = async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('companies')
        .select('*')
        .order('name', { ascending: true })

      if (error) throw error
      setCompanies(data || [])
    } catch (err) {
      console.error('Failed to load companies:', err)
      setCompanies([])
      toast({ title: 'Could not load companies', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadCompanies()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    company_type: 'client',
    contact_person: '',
    phone: '',
    email: '',
    city: '',
    gstin: '',
    billing_terms: '30 Days Net',
    credit_limit: '0',
  })

  const [submitting, setSubmitting] = useState(false)
  const { can } = useUser()
  const canManage = can('MANAGE_COMPANIES')

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const creditLimit = formData.credit_limit.trim() === '' ? 0 : parseAmount(formData.credit_limit)
    if (!formData.name.trim()) {
      toast({ title: 'Company name is required', variant: 'error' })
      return
    }
    if (Number.isNaN(creditLimit) || creditLimit < 0) {
      toast({ title: 'Invalid credit limit', description: 'Enter a number of 0 or more.', variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const supabase = createClient()
      const newRecord = {
        name: formData.name.trim(),
        company_type: formData.company_type as any,
        contact_person: formData.contact_person.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        city: formData.city.trim() || null,
        gstin: formData.gstin.trim().toUpperCase() || null,
        billing_terms: formData.billing_terms.trim() || null,
        credit_limit: creditLimit,
        is_active: true,
      }

      const { data, error } = await (supabase.from('companies') as any).insert([newRecord]).select()
      if (error) throw error
      if (!data?.[0]) throw new Error('The company was not saved. Please try again.')

      setCompanies(prev => [data[0], ...prev])
      toast({
        title: 'Company Registered',
        description: `${newRecord.name} added to master registry.`,
        variant: 'success',
      })
      setFormData({ name: '', company_type: 'client', contact_person: '', phone: '', email: '', city: '', gstin: '', billing_terms: '30 Days Net', credit_limit: '0' })
      setIsOpen(false)
    } catch (err) {
      toast({
        title: 'Error adding company',
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
      header: 'Company Name',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.name}</span>
          <span className="text-[11px] text-gray-500">GST: {row.original.gstin || 'Unregistered'}</span>
        </div>
      ),
    },
    {
      accessorKey: 'company_type',
      header: 'Type',
      cell: ({ row }) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-navy-100 text-navy-800">
          {row.original.company_type}
        </span>
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
      accessorKey: 'billing_terms',
      header: 'Billing Terms',
      cell: ({ row }) => (
        <span className="text-xs text-gray-700 font-medium">{row.original.billing_terms}</span>
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
        title="Companies & Corporate Clients"
        description="Master registry of shipper corporations, consignors, logistics partners and suppliers"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Company
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={companies}
        loading={loading}
        searchColumn="name"
        searchPlaceholder="Search company name or GSTIN..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Add Corporate Company</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Register consignor or client company for transport contracts and billing.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3.5 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Company Name *</Label>
              <Input
                required
                placeholder="e.g. Acme Enterprise Pvt Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Company Type</Label>
                <Select
                  value={formData.company_type}
                  onValueChange={(val) => setFormData({ ...formData, company_type: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="client">Client</SelectItem>
                    <SelectItem value="consignor">Consignor</SelectItem>
                    <SelectItem value="consignee">Consignee</SelectItem>
                    <SelectItem value="supplier">Supplier</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">GSTIN</Label>
                <Input
                  placeholder="27AAACP1234A1Z5"
                  value={formData.gstin}
                  onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Contact Person</Label>
                <Input
                  placeholder="Rajesh Sharma"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone Number</Label>
                <Input
                  placeholder="+91 98201 12345"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Billing Terms</Label>
                <Input
                  placeholder="30 Days Net"
                  value={formData.billing_terms}
                  onChange={(e) => setFormData({ ...formData, billing_terms: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Credit Limit (₹)</Label>
                <Input
                  type="number"
                  placeholder="500000"
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
                Save Company
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
