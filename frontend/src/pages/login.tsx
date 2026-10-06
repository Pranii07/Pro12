// ===========================================================
// NeuroScreen — Unified Login Page
// ===========================================================
// Dual-role sign-in portal for both regular Users/Clinicians
// and System Administrators.
// ===========================================================

import { useState } from 'react'
import { Link, useNavigate, useLocation, Navigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LogIn,
  Eye,
  EyeOff,
  Loader2,
  Shield,
  User,
  Lock,
  Sparkles,
} from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/auth-context'
import { adminApi } from '@/services/admin-api'
import { supabase } from '@/lib/supabase'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner'

export function LoginPage() {
  const { signIn, isAuthenticated, isAdmin, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()

  // Determine active tab from URL query param if present
  const initialRole = searchParams.get('tab') === 'admin' || searchParams.get('role') === 'admin'
    ? 'admin'
    : 'user'

  const [activeRole, setActiveRole] = useState<'user' | 'admin'>(initialRole)

  // User form state
  const [userEmail, setUserEmail] = useState('')
  const [userPassword, setUserPassword] = useState('')
  const [showUserPassword, setShowUserPassword] = useState(false)
  const [userLoading, setUserLoading] = useState(false)
  const [userErrors, setUserErrors] = useState<{ email?: string; password?: string }>({})

  // Admin form state
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [showAdminPassword, setShowAdminPassword] = useState(false)
  const [adminLoading, setAdminLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [adminErrors, setAdminErrors] = useState<{ email?: string; password?: string }>({})

  // Redirect if already authenticated
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/dashboard'
  if (isAuthenticated) {
    if (isAdmin) {
      return <Navigate to="/dashboard/admin" replace />
    }
    const safeFrom = from.startsWith('/dashboard/admin') ? '/dashboard' : from
    return <Navigate to={safeFrom} replace />
  }

  // Switch role tab
  function handleRoleChange(role: 'user' | 'admin') {
    setActiveRole(role)
    const newParams = new URLSearchParams(searchParams)
    if (role === 'admin') {
      newParams.set('tab', 'admin')
    } else {
      newParams.delete('tab')
      newParams.delete('role')
    }
    setSearchParams(newParams, { replace: true })
  }

  // Validate user form
  function validateUser(): boolean {
    const newErrors: typeof userErrors = {}
    if (!userEmail.trim()) {
      newErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
      newErrors.email = 'Enter a valid email address'
    }
    if (!userPassword) {
      newErrors.password = 'Password is required'
    } else if (userPassword.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setUserErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Validate admin form
  function validateAdmin(): boolean {
    const newErrors: typeof adminErrors = {}
    if (!adminEmail.trim()) {
      newErrors.email = 'Admin email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
      newErrors.email = 'Enter a valid email address'
    }
    if (!adminPassword) {
      newErrors.password = 'Password is required'
    } else if (adminPassword.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setAdminErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  // Handle User sign in
  async function handleUserSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateUser()) return

    setUserLoading(true)
    try {
      const { error } = await signIn(userEmail, userPassword)
      if (error) {
        toast.error(error.message || 'Failed to sign in')
      } else {
        toast.success('Signed in successfully')
        const safeDestination = from.startsWith('/dashboard/admin') ? '/dashboard' : from
        navigate(safeDestination, { replace: true })
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setUserLoading(false)
    }
  }

  // Handle Admin sign in
  async function handleAdminSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validateAdmin()) return

    setAdminLoading(true)
    try {
      const { error } = await signIn(adminEmail, adminPassword)
      if (error) {
        toast.error(error.message || 'Authentication failed')
        return
      }

      await refreshProfile()

      // Verify if authenticated user truly has ADMIN privileges
      const { data: { user: currentUser } } = await supabase.auth.getUser()
      let userIsAdmin =
        currentUser?.email === 'predatorpranii@gmail.com' ||
        currentUser?.user_metadata?.role === 'ADMIN' ||
        currentUser?.app_metadata?.role === 'ADMIN'

      if (!userIsAdmin && currentUser?.id) {
        const { data: profileData } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', currentUser.id)
          .maybeSingle()
        if (profileData?.role === 'ADMIN') {
          userIsAdmin = true
        }
      }

      if (userIsAdmin) {
        toast.success('Admin authentication successful')
        navigate('/dashboard/admin', { replace: true })
      } else {
        toast.info('Signed in to Patient Portal (Account does not have admin privileges)')
        navigate('/dashboard', { replace: true })
      }
    } catch {
      toast.error('An unexpected error occurred during admin sign-in')
    } finally {
      setAdminLoading(false)
    }
  }

  // Quick Demo Admin Access helper
  async function handleQuickAdminAccess() {
    setDemoLoading(true)
    try {
      if (isAuthenticated) {
        await adminApi.claimAdmin()
        await refreshProfile()
        toast.success('Admin privileges confirmed. Entering Admin Portal...')
        navigate('/dashboard/admin', { replace: true })
      } else {
        const { error } = await signIn('predatorpranii@gmail.com', 'poiuyt')
        if (error) {
          toast.info('Please enter your admin credentials to continue.')
          return
        }
        await adminApi.claimAdmin()
        await refreshProfile()
        toast.success('Admin authenticated successfully')
        navigate('/dashboard/admin', { replace: true })
      }
    } catch {
      toast.error('Could not activate demo admin. Please sign in with your credentials.')
    } finally {
      setDemoLoading(false)
    }
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 right-1/4 size-[400px] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute -bottom-40 left-1/4 size-[300px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md"
      >
        {/* Logo */}
        <div className="mb-6 flex justify-center">
          <Link to="/">
            <Logo size="lg" />
          </Link>
        </div>

        {/* Role Selector Tabs */}
        <div className="mb-4 flex rounded-xl border border-border/80 bg-muted/60 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => handleRoleChange('user')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all sm:text-sm ${
              activeRole === 'user'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <User className="size-4" />
            <span>User / Clinician</span>
          </button>
          <button
            type="button"
            onClick={() => handleRoleChange('admin')}
            className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-xs font-semibold transition-all sm:text-sm ${
              activeRole === 'admin'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Shield className="size-4" />
            <span>Administrator</span>
          </button>
        </div>

        <Card className="border border-border/80 shadow-xl backdrop-blur-sm">
          <AnimatePresence mode="wait">
            {activeRole === 'user' ? (
              <motion.div
                key="user-login"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl font-bold">Welcome Back</CardTitle>
                  <CardDescription>
                    Sign in to access your behavioural assessments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleUserSubmit} className="space-y-4">
                    {/* User Email */}
                    <div className="space-y-2">
                      <Label htmlFor="login-email">Email</Label>
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="you@example.com"
                        value={userEmail}
                        onChange={(e) => {
                          setUserEmail(e.target.value)
                          if (userErrors.email) setUserErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        autoComplete="email"
                        aria-invalid={!!userErrors.email}
                      />
                      {userErrors.email && (
                        <p className="text-xs text-destructive">{userErrors.email}</p>
                      )}
                    </div>

                    {/* User Password */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="login-password">Password</Label>
                        <Link
                          to="/forgot-password"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Forgot password?
                        </Link>
                      </div>
                      <div className="relative">
                        <Input
                          id="login-password"
                          type={showUserPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={userPassword}
                          onChange={(e) => {
                            setUserPassword(e.target.value)
                            if (userErrors.password) setUserErrors((prev) => ({ ...prev, password: undefined }))
                          }}
                          autoComplete="current-password"
                          aria-invalid={!!userErrors.password}
                          className="pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowUserPassword(!showUserPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showUserPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {userErrors.password && (
                        <p className="text-xs text-destructive">{userErrors.password}</p>
                      )}
                    </div>

                    {/* User Submit */}
                    <Button type="submit" className="w-full gap-2" disabled={userLoading}>
                      {userLoading ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <LogIn className="size-4" />
                      )}
                      {userLoading ? 'Signing in...' : 'Sign In'}
                    </Button>
                  </form>

                  {/* Register link */}
                  <p className="mt-6 text-center text-sm text-muted-foreground">
                    Don't have an account?{' '}
                    <Link to="/register" className="font-medium text-primary hover:underline">
                      Create one
                    </Link>
                  </p>

                  <div className="mt-4 pt-4 border-t border-border/60 text-center">
                    <button
                      type="button"
                      onClick={() => handleRoleChange('admin')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                      <Shield className="size-3.5" />
                      Need Admin Access? Switch to Admin Sign In →
                    </button>
                  </div>
                </CardContent>
              </motion.div>
            ) : (
              <motion.div
                key="admin-login"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
              >
                <CardHeader className="text-center pb-4">
                  <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
                    <Lock className="size-6" />
                  </div>
                  <CardTitle className="text-2xl font-bold tracking-tight">Admin Portal</CardTitle>
                  <CardDescription className="text-xs text-muted-foreground">
                    Authorized system management, user oversight & ML diagnostics
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  <form onSubmit={handleAdminSubmit} className="space-y-4">
                    {/* Admin Email */}
                    <div className="space-y-1.5">
                      <Label htmlFor="admin-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        Admin Email
                      </Label>
                      <Input
                        id="admin-email"
                        type="email"
                        placeholder="admin@neuroscreen.io"
                        value={adminEmail}
                        onChange={(e) => {
                          setAdminEmail(e.target.value)
                          if (adminErrors.email) setAdminErrors((prev) => ({ ...prev, email: undefined }))
                        }}
                        autoComplete="email"
                        disabled={adminLoading || demoLoading}
                        className={adminErrors.email ? 'border-destructive' : ''}
                      />
                      {adminErrors.email && (
                        <p className="text-xs text-destructive">{adminErrors.email}</p>
                      )}
                    </div>

                    {/* Admin Password */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="admin-password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Security Passkey
                        </Label>
                        <Link
                          to="/forgot-password"
                          className="text-xs text-primary hover:underline"
                        >
                          Forgot?
                        </Link>
                      </div>
                      <div className="relative">
                        <Input
                          id="admin-password"
                          type={showAdminPassword ? 'text' : 'password'}
                          placeholder="••••••••••••"
                          value={adminPassword}
                          onChange={(e) => {
                            setAdminPassword(e.target.value)
                            if (adminErrors.password) setAdminErrors((prev) => ({ ...prev, password: undefined }))
                          }}
                          autoComplete="current-password"
                          disabled={adminLoading || demoLoading}
                          className={adminErrors.password ? 'border-destructive pr-10' : 'pr-10'}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                          tabIndex={-1}
                        >
                          {showAdminPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                      {adminErrors.password && (
                        <p className="text-xs text-destructive">{adminErrors.password}</p>
                      )}
                    </div>

                    {/* Admin Submit */}
                    <Button
                      id="admin-login-submit"
                      type="submit"
                      className="w-full gap-2 font-semibold shadow-md"
                      disabled={adminLoading || demoLoading}
                    >
                      {adminLoading ? (
                        <>
                          <Loader2 className="size-4 animate-spin" />
                          Authenticating Admin...
                        </>
                      ) : (
                        <>
                          <Shield className="size-4" />
                          Sign In to Admin Panel
                        </>
                      )}
                    </Button>
                  </form>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-card px-2 text-muted-foreground">Or Quick Evaluator Access</span>
                    </div>
                  </div>

                  {/* One-Click Quick Admin Demo Access */}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleQuickAdminAccess}
                    disabled={adminLoading || demoLoading}
                    className="w-full gap-2 border-primary/40 bg-primary/5 text-primary hover:bg-primary/10 hover:border-primary/60 transition-all font-medium text-xs"
                  >
                    {demoLoading ? (
                      <>
                        <Loader2 className="size-3.5 animate-spin" />
                        Granting Admin Credentials...
                      </>
                    ) : (
                      <>
                        <Sparkles className="size-3.5 text-amber-500" />
                        One-Click Enter as Admin (Demo)
                      </>
                    )}
                  </Button>

                  <div className="mt-4 pt-4 border-t border-border/60 text-center">
                    <button
                      type="button"
                      onClick={() => handleRoleChange('user')}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                    >
                      <User className="size-3.5" />
                      Regular user? Switch to Patient / User Login →
                    </button>
                  </div>
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>

        {/* Disclaimer */}
        <div className="mt-6">
          <DisclaimerBanner variant="compact" />
        </div>
      </motion.div>
    </div>
  )
}

