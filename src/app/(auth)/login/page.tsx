'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { isSupabaseConfigured } from '@/lib/supabase/config'
import { safeRedirectPath } from '@/lib/auth/route-access'
import { getErrorMessage } from '@/lib/utils/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck, ShieldCheck, ArrowRight, Loader2, AlertCircle } from 'lucide-react'

const ERROR_MESSAGES: Record<string, string> = {
  inactive: 'Your account is inactive or has no profile. Contact your administrator.',
  config: 'The application is not configured (missing Supabase credentials). Contact your administrator.',
  unavailable: 'The authentication service is currently unavailable. Please try again shortly.',
  link: 'The sign-in or password reset link is invalid or has expired. Please request a new one.',
}

// Demo shortcuts only prefill an email address; a real password is always required.
// They are hidden unless NEXT_PUBLIC_ENABLE_DEMO_LOGIN is explicitly "true".
const DEMO_LOGIN_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN === 'true'
const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'admin@satgurutransport.com' },
  { label: 'Ops Manager', email: 'ops@satgurutransport.com' },
  { label: 'Accountant', email: 'accounts@satgurutransport.com' },
  { label: 'Warehouse Staff', email: 'godown@satgurutransport.com' },
]

function LoginForm() {
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    const code = searchParams.get('error')
    if (code) setError(ERROR_MESSAGES[code] ?? 'Please sign in again.')
    if (searchParams.get('reset') === 'success') {
      setNotice('Your password has been updated. Sign in with your new password.')
    }
  }, [searchParams])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (!isSupabaseConfigured()) {
      setError(ERROR_MESSAGES.config)
      return
    }

    setLoading(true)
    try {
      const supabase = createClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })

      if (signInError) {
        setError(
          /invalid login credentials/i.test(signInError.message)
            ? 'Invalid email or password.'
            : getErrorMessage(signInError)
        )
        return
      }

      // Full navigation so the middleware sees the new session cookies.
      window.location.assign(safeRedirectPath(searchParams.get('redirectTo')))
    } catch (err) {
      setError(getErrorMessage(err, 'Unable to sign in. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-navy-800 bg-white/95 backdrop-blur shadow-2xl">
      <CardHeader className="space-y-1 pb-4">
        <CardTitle className="text-xl font-bold text-navy-950">Sign In</CardTitle>
        <CardDescription className="text-xs text-gray-500">
          Enter your credentials to access operations, warehouse &amp; dispatch
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleLogin}>
        <CardContent className="space-y-4">
          {error && (
            <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}
          {notice && (
            <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              {notice}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Email Address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="username"
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs font-semibold text-gray-700">Password</Label>
              <a
                href="/forgot-password"
                className="text-[11px] text-orange-600 hover:text-orange-700 font-medium"
              >
                Forgot password?
              </a>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="h-10 text-sm"
            />
          </div>

          {DEMO_LOGIN_ENABLED && (
            <div className="pt-2">
              <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-2">
                Demo accounts (password required):
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {DEMO_ACCOUNTS.map(acc => (
                  <Button
                    key={acc.email}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs font-medium border-navy-200 hover:bg-navy-50"
                    onClick={() => {
                      setEmail(acc.email)
                      setPassword('')
                      document.getElementById('password')?.focus()
                    }}
                  >
                    {acc.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="pt-2">
          <Button
            type="submit"
            disabled={loading}
            className="w-full h-10 bg-navy-900 hover:bg-navy-950 text-white font-semibold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Signing in...
              </>
            ) : (
              <>
                Access Dashboard
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </CardFooter>
      </form>
    </Card>
  )
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 shadow-xl text-white mb-2">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Shree Satguru Transport
          </h1>
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">
            Transport Management System
          </p>
        </div>

        <Suspense fallback={<div className="h-80 rounded-xl bg-white/90 animate-pulse" />}>
          <LoginForm />
        </Suspense>

        <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Role-Based Access Control &amp; RLS Protected</span>
        </div>
      </div>
    </div>
  )
}
