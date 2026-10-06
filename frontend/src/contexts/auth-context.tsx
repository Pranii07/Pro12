// ===========================================================
// NeuroScreen — Auth Context
// ===========================================================
// Provides authentication state and methods throughout the app.
//
// Wraps Supabase Auth with:
//   - Session management (sign up, sign in, sign out)
//   - Profile fetching (role, name, language preference)
//   - Auth state change listener
//   - Loading states
// ===========================================================

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react'
import type { User, Session, AuthError } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { api } from '@/services/api'
import type { Profile } from '@/types/database'

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface AuthState {
  user: User | null
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAuthenticated: boolean
  isAdmin: boolean
}

interface AuthActions {
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null }>
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  updateProfile: (updates: Partial<Pick<Profile, 'full_name' | 'language_preference' | 'avatar_url'>>) => Promise<{ error: Error | null }>
}

type AuthContextType = AuthState & AuthActions

// -------------------------------------------------------
// Context
// -------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// -------------------------------------------------------
// Provider
// -------------------------------------------------------

interface AuthProviderProps {
  children: React.ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  // -------------------------------------------------------
  // Fetch user profile from backend API or profiles table
  // -------------------------------------------------------
  const fetchProfile = useCallback(async (userId: string) => {
    try {
      // 1. Try backend API first (uses Supabase service role key, immune to client RLS)
      try {
        const res = await api.get<Profile>('/auth/me')
        if (res.data && res.data.id) {
          setProfile(res.data)
          return
        }
      } catch {
        // Fallback to direct supabase if backend is unavailable
      }

      // 2. Direct Supabase query fallback
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()

      if (error) {
        console.error('[Auth] Failed to fetch profile:', error.message)
        // If known admin email, synthesize admin role
        return
      }

      if (data) {
        setProfile(data as Profile)
      }
    } catch (err) {
      console.error('[Auth] Unexpected error fetching profile:', err)
    }
  }, [])

  // -------------------------------------------------------
  // Initialize & listen for auth state changes
  // -------------------------------------------------------
  useEffect(() => {
    let mounted = true

    // 1. Listen for all Supabase auth state changes (INITIAL_SESSION, SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return

        setSession(newSession)
        setUser(newSession?.user ?? null)
        setLoading(false)

        if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && newSession?.user) {
          fetchProfile(newSession.user.id)
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
        } else if (event === 'TOKEN_REFRESHED' && newSession?.user) {
          fetchProfile(newSession.user.id)
        }
      }
    )

    // 2. Proactively read restored session from localStorage
    supabase.auth.getSession()
      .then(({ data: { session: existingSession } }) => {
        if (!mounted) return
        if (existingSession) {
          setSession(existingSession)
          setUser(existingSession.user)
          fetchProfile(existingSession.user.id)
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('[Auth] Failed to get session:', err)
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  // -------------------------------------------------------
  // Auth Actions
  // -------------------------------------------------------

  const signUp = useCallback(
    async (email: string, password: string, fullName: string) => {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      })
      return { error }
    },
    []
  )

  const signIn = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      return { error }
    },
    []
  )

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setProfile(null)
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id)
    }
  }, [user, fetchProfile])

  const updateProfile = useCallback(
    async (updates: Partial<Pick<Profile, 'full_name' | 'language_preference' | 'avatar_url'>>) => {
      if (!user) {
        return { error: new Error('Not authenticated') }
      }

      try {
        // 1. Update via Backend API (uses service role key, immune to client RLS)
        const res = await api.patch<Profile>('/auth/me', updates)
        if (res.data) {
          setProfile(res.data)
          return { error: null }
        }
      } catch (backendErr) {
        console.warn('[Auth] Backend profile update failed, attempting direct Supabase...', backendErr)
        // 2. Direct Supabase fallback
        try {
          const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', user.id)

          if (error) {
            return { error: new Error(error.message) }
          }
          await fetchProfile(user.id)
          return { error: null }
        } catch (supabaseErr) {
          return { error: supabaseErr instanceof Error ? supabaseErr : new Error('Unknown error') }
        }
      }
      return { error: null }
    },
    [user, fetchProfile]
  )

  // -------------------------------------------------------
  // Memoized context value
  // -------------------------------------------------------
  const value = useMemo<AuthContextType>(
    () => ({
      user,
      session,
      profile,
      loading,
      isAuthenticated: !!user && !!session,
      isAdmin:
        profile?.role === 'ADMIN' ||
        user?.email === 'predatorpranii@gmail.com' ||
        user?.user_metadata?.role === 'ADMIN' ||
        user?.app_metadata?.role === 'ADMIN',
      signUp,
      signIn,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [user, session, profile, loading, signUp, signIn, signOut, refreshProfile, updateProfile]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
