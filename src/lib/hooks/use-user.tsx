'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { hasPermission, type Permission, type UserRole } from '@/lib/constants/roles'
import type { User } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  phone: string | null
  role: UserRole
  is_active: boolean
}

interface UseUserReturn {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  error: string | null
  /** False while loading or when no profile is available (deny by default). */
  can: (permission: Permission) => boolean
}

const PROFILE_COLUMNS = 'id, full_name, avatar_url, phone, role, is_active'

const UserContext = createContext<UseUserReturn | null>(null)

function useUserState(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    async function loadProfile(userId: string) {
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select(PROFILE_COLUMNS)
        .eq('id', userId)
        .maybeSingle()
      if (cancelled) return
      if (profileError) {
        setError(profileError.message)
        setProfile(null)
      } else {
        setProfile((data as UserProfile | null) ?? null)
      }
    }

    async function init() {
      try {
        const { data: { user: authUser }, error: userError } = await supabase.auth.getUser()
        if (userError && userError.name !== 'AuthSessionMissingError') throw userError
        if (cancelled) return
        setUser(authUser ?? null)
        if (authUser) await loadProfile(authUser.id)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load user')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        return
      }
      if (session?.user && (event === 'SIGNED_IN' || event === 'USER_UPDATED')) {
        setUser(session.user)
        // Defer: awaiting Supabase calls inside this callback can deadlock supabase-js.
        const userId = session.user.id
        setTimeout(() => { void loadProfile(userId) }, 0)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  return useMemo(
    () => ({
      user,
      profile,
      loading,
      error,
      can: (permission: Permission) =>
        Boolean(profile?.role && profile.is_active && hasPermission(profile.role, permission)),
    }),
    [user, profile, loading, error]
  )
}

export function UserProvider({ children }: { children: React.ReactNode }) {
  const value = useUserState()
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

export function useUser(): UseUserReturn {
  const ctx = useContext(UserContext)
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>')
  return ctx
}
