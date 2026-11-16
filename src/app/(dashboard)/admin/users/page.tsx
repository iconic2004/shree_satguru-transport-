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
import { getErrorMessage } from '@/lib/utils/errors'
import { validateNewPassword } from '@/lib/utils/validation'
import { useUser } from '@/lib/hooks/use-user'

export default function UsersAdminPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const loadUsers = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/admin/users', { cache: 'no-store' })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status})`)
      setUsers(json.data)
    } catch (err) {
      console.error('Failed to load users:', err)
      setUsers([])
      toast({ title: 'Could not load users', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const [isOpen, setIsOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const { user: currentUser, can } = useUser()
  const canManage = can('MANAGE_USERS')
  const emptyForm = {
    full_name: '',
    email: '',
    role: 'operations_manager' as UserRole,
    phone: '',
    password: '',
  }
  const [formData, setFormData] = useState(emptyForm)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    const passwordProblem = validateNewPassword(formData.password, formData.password)
    if (passwordProblem) {
      toast({ title: 'Weak temporary password', description: passwordProblem, variant: 'error' })
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status})`)

      setUsers(prev => [json.data, ...prev])
      toast({
        title: 'User Created',
        description: `Account for ${formData.full_name} created with ${ROLE_LABELS[formData.role]} role.`,
        variant: 'success',
      })
      setFormData(emptyForm)
      setIsOpen(false)
    } catch (err) {
      toast({ title: 'Could not create user', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setSubmitting(false)
    }
  }

  const toggleStatus = async (id: string, currentlyActive: boolean) => {
    setTogglingId(id)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: !currentlyActive }),
      })
      const json = await res.json().catch(() => null)
      if (!res.ok || !json?.success) throw new Error(json?.error || `Request failed (${res.status})`)

      setUsers(prev => prev.map(u => (u.id === id ? { ...u, is_active: json.data.is_active } : u)))
      toast({
        title: json.data.is_active ? 'User Activated' : 'User Deactivated',
        description: json.data.is_active ? 'The user can sign in again.' : 'The user has been signed out and blocked.',
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Could not change status', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setTogglingId(null)
    }
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
          disabled={!canManage || row.original.id === currentUser?.id || togglingId === row.original.id}
          title={row.original.id === currentUser?.id ? 'You cannot deactivate your own account' : undefined}
          onClick={() => toggleStatus(row.original.id, row.original.is_active)}
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
            disabled={!canManage}
            title={canManage ? undefined : 'You do not have permission to add records here'}
          >
            <UserPlus className="w-4 h-4 mr-1.5" />
            Create User Account
          </Button>
        }
      />

      <DataTable
        columns={columns}
        data={users}
        loading={loading}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                minLength={8}
                type="password"
                autoComplete="new-password"
                placeholder="Min 8 chars, letters + numbers"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting} className="bg-navy-900 hover:bg-navy-950 text-white font-semibold">
                Provision User
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
