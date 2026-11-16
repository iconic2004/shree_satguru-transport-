'use client'

import { useEffect, useState } from 'react'
import { validateNewPassword } from '@/lib/utils/validation'

const COMPANY_SETTINGS_KEY = 'company_profile'
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/
const EDITABLE_FIELDS = ['name', 'headOffice', 'gstin', 'contactEmail', 'contactPhone'] as const

function pickEditable(source: Record<string, unknown>): Partial<Record<(typeof EDITABLE_FIELDS)[number], string>> {
  const out: Partial<Record<(typeof EDITABLE_FIELDS)[number], string>> = {}
  for (const field of EDITABLE_FIELDS) {
    if (typeof source[field] === 'string') out[field] = source[field] as string
  }
  return out
}
import { createClient } from '@/lib/supabase/client'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from '@/lib/hooks/use-toast'
import { getErrorMessage } from '@/lib/utils/errors'
import { useUser } from '@/lib/hooks/use-user'
import { Building2, Lock, ShieldCheck, Database, Globe, Bell, Loader2 } from 'lucide-react'

export default function SettingsPage() {
  const [loadingPass, setLoadingPass] = useState(false)
  const [companyDetails, setCompanyDetails] = useState({
    name: 'Shree Satguru Transport',
    headOffice: 'Bhiwandi Mankoli Naka Logistics Hub, Thane, Maharashtra',
    gstin: '27AABCS9988A1Z0',
    contactEmail: 'operations@satgurutransport.com',
    contactPhone: '+91 98200 99887',
    timezone: 'Asia/Kolkata (IST)',
    currency: 'INR (₹)',
  })

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })

  const { user, can } = useUser()
  const canEditCompany = can('MANAGE_SETTINGS')
  const [savingCompany, setSavingCompany] = useState(false)

  // Load the persisted company profile (application_settings key/value store).
  useEffect(() => {
    const supabase = createClient()
    ;(supabase.from('application_settings') as any)
      .select('value')
      .eq('key', COMPANY_SETTINGS_KEY)
      .maybeSingle()
      .then(({ data, error }: { data: { value: string } | null; error: unknown }) => {
        if (error) {
          console.error('Failed to load company settings:', error)
          return
        }
        if (data?.value) {
          try {
            const saved = JSON.parse(data.value)
            setCompanyDetails(prev => ({ ...prev, ...pickEditable(saved) }))
          } catch {
            console.error('Stored company settings are not valid JSON')
          }
        }
      })
  }, [])

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canEditCompany || savingCompany) return
    if (companyDetails.gstin && !GSTIN_PATTERN.test(companyDetails.gstin.trim().toUpperCase())) {
      toast({ title: 'Invalid GSTIN', description: 'GSTIN must be 15 characters, e.g. 27AABCS9988A1Z0.', variant: 'error' })
      return
    }

    setSavingCompany(true)
    try {
      const supabase = createClient()
      const value = JSON.stringify(pickEditable({ ...companyDetails, gstin: companyDetails.gstin.trim().toUpperCase() }))
      const { error } = await (supabase.from('application_settings') as any).upsert(
        [{ key: COMPANY_SETTINGS_KEY, value, description: 'Company profile shown on invoices and challans' }],
        { onConflict: 'key' }
      )
      if (error) throw error
      toast({
        title: 'Company Settings Saved',
        description: 'Company profile updated.',
        variant: 'success',
      })
    } catch (err) {
      toast({ title: 'Could not save settings', description: getErrorMessage(err), variant: 'error' })
    } finally {
      setSavingCompany(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    const problem = validateNewPassword(passwordData.newPassword, passwordData.confirmPassword)
    if (problem) {
      toast({ title: 'Validation Error', description: problem, variant: 'error' })
      return
    }
    if (passwordData.newPassword === passwordData.currentPassword) {
      toast({ title: 'Validation Error', description: 'New password must be different from the current one.', variant: 'error' })
      return
    }
    if (!user?.email) {
      toast({ title: 'Session expired', description: 'Please sign in again.', variant: 'error' })
      return
    }

    try {
      setLoadingPass(true)
      const supabase = createClient()

      // Re-authenticate: an unattended open session must not be enough to change the password.
      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: passwordData.currentPassword,
      })
      if (verifyError) throw new Error('Current password is incorrect.')

      const { error } = await supabase.auth.updateUser({
        password: passwordData.newPassword,
      })
      if (error) throw error

      toast({
        title: 'Password Updated',
        description: 'Your login password has been changed.',
        variant: 'success',
      })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (err) {
      toast({
        title: 'Password not changed',
        description: getErrorMessage(err, 'Could not update password.'),
        variant: 'error',
      })
    } finally {
      setLoadingPass(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <PageHeader
        title="System & Profile Settings"
        description="Configure organization details, operational parameters, database integration and account security"
      />

      {/* Organization Details */}
      <Card className="border-gray-200/80 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-sm font-bold text-navy-950 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-orange-500" />
            <span>Transport Company Profile</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Appears on printed invoices, delivery challans, and customer freight slips
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handleSaveCompany} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Company Registered Name</Label>
                <Input
                  value={companyDetails.name}
                  onChange={(e) => setCompanyDetails({ ...companyDetails, name: e.target.value })}
                  disabled={!canEditCompany}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Master GSTIN</Label>
                <Input
                  value={companyDetails.gstin}
                  onChange={(e) => setCompanyDetails({ ...companyDetails, gstin: e.target.value })}
                  disabled={!canEditCompany}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold">Head Office & Central Godown Address</Label>
              <Input
                value={companyDetails.headOffice}
                onChange={(e) => setCompanyDetails({ ...companyDetails, headOffice: e.target.value })}
                disabled={!canEditCompany}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Official Contact Email</Label>
                <Input
                  type="email"
                  value={companyDetails.contactEmail}
                  onChange={(e) => setCompanyDetails({ ...companyDetails, contactEmail: e.target.value })}
                  disabled={!canEditCompany}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Direct Helpline Number</Label>
                <Input
                  value={companyDetails.contactPhone}
                  onChange={(e) => setCompanyDetails({ ...companyDetails, contactPhone: e.target.value })}
                  disabled={!canEditCompany}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Timezone</Label>
                <Input value={companyDetails.timezone} disabled className="bg-gray-50 text-gray-500" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Base Currency</Label>
                <Input value={companyDetails.currency} disabled className="bg-gray-50 text-gray-500" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={!canEditCompany || savingCompany}
                title={canEditCompany ? undefined : 'Only administrators can change company details'}
                className="bg-navy-900 hover:bg-navy-950 text-white font-semibold text-xs"
              >
                {savingCompany ? 'Saving…' : 'Save Company Details'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Security & Password */}
      <Card className="border-gray-200/80 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-sm font-bold text-navy-950 flex items-center gap-2">
            <Lock className="w-4 h-4 text-orange-500" />
            <span>Admin Password & Security</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Manage your Supabase Auth session credentials
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Current Password</Label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">New Password</Label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Confirm New Password</Label>
                <Input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" variant="outline" className="text-xs font-semibold" disabled={loadingPass}>
                {loadingPass ? 'Updating…' : 'Change Password'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Supabase Backend Connectivity Status */}
      <Card className="border-gray-200/80 shadow-sm">
        <CardHeader className="border-b border-gray-100 pb-3">
          <CardTitle className="text-sm font-bold text-navy-950 flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-500" />
            <span>Supabase Cloud Integration Status</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Setup reference (static information — not a live health check)
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-3">
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
            <div className="space-y-0.5">
              <p className="font-bold text-navy-950">PostgreSQL Migration Engine</p>
              <p className="text-gray-500">11 migration scripts in /supabase/migrations (00011 = security hardening)</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded-md">
              Info
            </span>
          </div>

          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-xs">
            <div className="space-y-0.5">
              <p className="font-bold text-navy-950">Row Level Security (RLS)</p>
              <p className="text-gray-500">7 User roles enforced with PostgreSQL policies</p>
            </div>
            <span className="px-2.5 py-1 bg-slate-200 text-slate-700 font-bold rounded-md">
              Info
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
