'use client'

import { useState } from 'react'
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
import { toast } from '@/lib/hooks/use-toast'

export default function CompaniesPage() {
  const [companies, setCompanies] = useState([
    {
      id: 'c1',
      name: 'Parle Agro Industries Ltd',
      company_type: 'client',
      contact_person: 'Rajesh Sharma',
      phone: '+91 98201 12345',
      email: 'logistics@parleagro.com',
      city: 'Mumbai',
      gstin: '27AAACP1234A1Z5',
      billing_terms: '30 Days Net',
      credit_limit: 500000,
      is_active: true,
    },
    {
      id: 'c2',
      name: 'Godrej Consumer Products',
      company_type: 'consignor',
      contact_person: 'Anand Kulkarni',
      phone: '+91 98199 54321',
      email: 'supplychain@godrej.com',
      city: 'Mumbai',
      gstin: '27AAACG5678B2Z1',
      billing_terms: '15 Days Net',
      credit_limit: 350000,
      is_active: true,
    },
    {
      id: 'c3',
      name: 'Asian Paints Ltd',
      company_type: 'client',
      contact_person: 'Sanjay Deshmukh',
      phone: '+91 98334 87654',
      email: 'dispatch@asianpaints.com',
      city: 'Mumbai',
      gstin: '27AAACA9876C3Z2',
      billing_terms: '30 Days Net',
      credit_limit: 600000,
      is_active: true,
    },
    {
      id: 'c4',
      name: 'Mahalaxmi Steel Traders',
      company_type: 'consignor',
      contact_person: 'Virendra Singh',
      phone: '+91 98670 99887',
      email: 'mahalaxmisteel@gmail.com',
      city: 'Mumbai',
      gstin: '27AABCM3456D4Z9',
      billing_terms: 'Immediate',
      credit_limit: 100000,
      is_active: true,
    },
  ])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    company_type: 'client',
    contact_person: '',
    phone: '',
    email: '',
    city: 'Mumbai',
    gstin: '',
    billing_terms: '30 Days Net',
    credit_limit: '200000',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const newComp = {
      id: `c-${Date.now()}`,
      name: formData.name,
      company_type: formData.company_type,
      contact_person: formData.contact_person,
      phone: formData.phone,
      email: formData.email,
      city: formData.city,
      gstin: formData.gstin,
      billing_terms: formData.billing_terms,
      credit_limit: parseFloat(formData.credit_limit) || 0,
      is_active: true,
    }
    setCompanies([newComp, ...companies])
    toast({
      title: 'Company Registered',
      description: `${formData.name} added to master registry.`,
      variant: 'success',
    })
    setIsOpen(false)
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
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Add Company
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={companies}
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
                placeholder="e.g. Parle Agro Industries Ltd"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
            <div className="grid grid-cols-2 gap-3">
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
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Save Company
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
