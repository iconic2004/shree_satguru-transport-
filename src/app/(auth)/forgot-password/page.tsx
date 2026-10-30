'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from '@/lib/hooks/use-toast'
import { Truck, ArrowLeft, Mail, CheckCircle2 } from 'lucide-react'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
      })

      if (error) {
        // demo handling
        setSubmitted(true)
        return
      }

      setSubmitted(true)
      toast({
        title: 'Reset link dispatched',
        description: 'Check your email for the password recovery link.',
        variant: 'success',
      })
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err.message || 'Failed to send recovery email.',
        variant: 'error',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-950 via-navy-900 to-slate-900 p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500 shadow-xl text-white mb-2">
            <Truck className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-wide">
            Reset Password
          </h1>
          <p className="text-xs text-orange-400 font-semibold uppercase tracking-widest">
            Shree Satguru Transport
          </p>
        </div>

        <Card className="border-navy-800 bg-white/95 backdrop-blur shadow-2xl">
          {submitted ? (
            <CardContent className="pt-6 pb-6 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-bold text-gray-900">Check Your Email</h3>
                <p className="text-xs text-gray-500 max-w-xs mx-auto">
                  If an account exists with <span className="font-semibold text-gray-800">{email}</span>, a secure password reset link has been dispatched.
                </p>
              </div>
              <Button asChild variant="outline" className="w-full">
                <Link href="/login">Return to Sign In</Link>
              </Button>
            </CardContent>
          ) : (
            <form onSubmit={handleReset}>
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-xl font-bold text-navy-950">Password Recovery</CardTitle>
                <CardDescription className="text-xs text-gray-500">
                  Enter your registered work email to receive password reset instructions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-gray-700">Registered Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="officer@satgurutransport.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-10 text-sm"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full h-10 bg-navy-900 hover:bg-navy-950 text-white font-semibold flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  {loading ? 'Sending link...' : 'Send Recovery Link'}
                </Button>
                <Button asChild variant="ghost" size="sm" className="w-full text-xs">
                  <Link href="/login" className="flex items-center gap-1.5">
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Sign In
                  </Link>
                </Button>
              </CardFooter>
            </form>
          )}
        </Card>
      </div>
    </div>
  )
}
