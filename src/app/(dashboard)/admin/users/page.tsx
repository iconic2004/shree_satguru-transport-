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
import { ShieldCheck, Plus, UserPlus, Lock, CheckCircle2, RefreshCw } from 'lucide-react'
import { ROLE_LABELS, type UserRole } from '@/lib/constants/roles'
import { formatDate } from '@/lib/utils/formatting'
import { toast } from '@/lib/hooks/use-toast'

export default function UsersAdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const supabase = createClient()
      const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })

      if (data && data.length > 0) {
        setUsers(
          data.map((u: any) => ({
            id: u.id,
            full_name: u.full_name || 'Staff User',
            email: u.email || `${u.full_name?.toLowerCase().replace(/\s+/g, '.')}@satgurutransport.com`,
            role: (u.role || 'operations_manager') as UserRole,
            phone: u.phone || '+91 98200 00000',
            is_active: u.is_active ?? true,
            created_at: u.created_at || new Date().toISOString(),
          }))
        )
      } else {
        setUsers([
          {
            id: 'usr-1',
            full_name: 'Super Admin Officer',
            email: 'admin@satgurutransport.com',
            role: 'super_admin' as UserRole,
            phone: '+91 98200 11111',
            is_active: true,
            created_at: '2026-01-10',
          },
          {
            id: 'usr-2',
            full_name: 'Dinesh Sharma (Ops Head)',
            email: 'ops@satgurutransport.com',
            role: 'operations_manager' as UserRole,
            phone: '+91 98200 22222',
            is_active: true,
            created_at: '2026-02-15',
          },
          {
            id: 'usr-3',
            full_name: 'Pooja Verma (Chief Accountant)',
            email: 'accounts@satgurutransport.com',
            role: 'accountant' as UserRole,
            phone: '+91 98200 33333',
            is_active: true,
            created_at: '2026-03-01',
          },
        ])
      }
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    role: 'operations_manager' as UserRole,
    phone: '',
    password: '',
  })

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault()
    const newUser = {
      id: `usr-${Date.now()}`,
      full_name: formData.full_name,
      email: formData.email,
      role: formData.role,
      phone: formData.phone,
      is_active: true,
      created_at: new Date().toISOString().split('T')[0],
    }
    setUsers([newUser, ...users])
    toast({
      title: 'User Created',
      description: `Account for ${formData.full_name} registered with ${ROLE_LABELS[formData.role]} role.`,
      variant: 'success',
    })
    setIsOpen(false)
  }

  const toggleStatus = (id: string) => {
    setUsers(prev =>
      prev.map(u => (u.id === id ? { ...u, is_active: !u.is_active } : u))
    )
    toast({
      title: 'User Status Toggled',
      description: 'Account activation status changed.',
    })
  }

  const columns: ColumnDef<any>[] = [
    {
      accessorKey: 'full_name',
      header: 'Full Name & Email',
      cell: ({ row }) => (
        <div>
          <span className="font-bold text-navy-950 block">{row.original.full_name}</span>
          <span className="text-[11px] text-gray-500">{row.original.email}</span>
        </div>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Assigned Role',
      cell: ({ row }) => (
        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-navy-100 text-navy-900 border border-navy-200">
          {ROLE_LABELS[row.original.role as UserRole]}
        </span>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => <span className="text-xs text-gray-700">{row.original.phone}</span>,
    },
    {
      accessorKey: 'is_active',
      header: 'Account Status',
      cell: ({ row }) => (
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
            row.original.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}
        >
          {row.original.is_active ? 'Active' : 'Suspended'}
        </span>
      ),
    },
    {
      accessorKey: 'created_at',
      header: 'Created On',
      cell: ({ row }) => <span className="text-xs text-gray-500">{formatDate(row.original.created_at)}</span>,
    },
    {
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => toggleStatus(row.original.id)}
        >
          {row.original.is_active ? 'Deactivate' : 'Activate'}
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <PageHeader
        title="User Roles & Access Control (RBAC)"
        description="Provision transport software users, assign granular roles and control module permissions"
        actions={
          <Button
            size="sm"
            className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
            onClick={() => setIsOpen(true)}
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Create User Account
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        searchColumn="full_name"
        searchPlaceholder="Search by name or email..."
      />

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-navy-950">Add Team User</DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Provision administrative or operational login credentials with role-based permissions.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Full Name *</Label>
              <Input
                required
                placeholder="Dinesh Sharma"
                value={formData.full_name}
                onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Official Work Email *</Label>
              <Input
                required
                type="email"
                placeholder="dinesh@satgurutransport.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">User Role *</Label>
                <Select
                  value={formData.role}
                  onValueChange={(val) => setFormData({ ...formData, role: val as UserRole })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="super_admin">Super Admin</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="operations_manager">Operations Manager</SelectItem>
                    <SelectItem value="accountant">Accountant</SelectItem>
                    <SelectItem value="warehouse_staff">Warehouse Staff</SelectItem>
                    <SelectItem value="driver">Driver</SelectItem>
                    <SelectItem value="labour_supervisor">Labour Supervisor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Phone</Label>
                <Input
                  placeholder="+91 98200 11223"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Temporary Password *</Label>
              <Input
                required
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Provision User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
