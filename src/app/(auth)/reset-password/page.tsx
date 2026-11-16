'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getErrorMessage } from '@/lib/utils/errors'
import { validateNewPassword } from '@/lib/utils/validation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, KeyRound, Loader2, AlertCircle } from 'lucide-react'

export default function ResetPasswordPage() {
  const [checking, setChecking] = useState(true)
  const [hasSession, setHasSession] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setHasSession(Boolean(data.user))
      setChecking(false)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const problem = validateNewPassword(password, confirm)
    if (problem) {
      setError(problem)
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { error: updateError } = await supabase.auth.updateUser({ password })
      if (updateError) throw updateError
      // End the recovery session and require a fresh sign-in with the new password.
      await supabase.auth.signOut()
      window.location.assign('/login?reset=success')
    } catch (err) {
      setError(getErrorMessage(err, 'Could not update password.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 shadow-xl text-white mb-2">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">Set New Password</h1>
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">Shree Satguru Transport</p>
        </div>

        <Card className="border-navy-800 bg-white/95 backdrop-blur shadow-2xl">
          {checking ? (
            <CardContent className="py-10 flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-navy-800" />
            </CardContent>
          ) : !hasSession ? (
            <CardContent className="pt-6 pb-6 text-center space-y-4">
              <p className="text-sm text-gray-700">
                This password reset link is invalid or has expired.
              </p>
              <Button asChild className="w-full bg-navy-900 hover:bg-navy-950 text-white">
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleSubmit}>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-bold text-navy-950">Choose a new password</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  At least 8 characters, including a letter and a number.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {error && (
                  <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="new-password" className="text-xs font-semibold">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm-password" className="text-xs font-semibold">Confirm Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={8}
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  type="submit"
                  disabled={saving}
                  className="w-full h-10 bg-navy-900 hover:bg-navy-950 text-white font-semibold flex items-center justify-center gap-2"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                  {saving ? 'Updating…' : 'Update Password'}
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
