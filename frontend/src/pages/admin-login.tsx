// ===========================================================
// NeuroScreen — Admin Portal Login
// ===========================================================
// Dedicated authentication page for administrators and clinical
// system managers. Directs directly to /dashboard/admin.
// ===========================================================

import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Shield,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
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

export function AdminLoginPage() {
  const { signIn, isAuthenticated, isAdmin, refreshProfile } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [demoLoading, setDemoLoading] = useState(false)
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({})

  // If already an authenticated admin, jump straight to the panel
  if (isAuthenticated && isAdmin) {
    return <Navigate to="/dashboard/admin" replace />
  }

  function validate(): boolean {
    const newErrors: typeof errors = {}
    if (!email.trim()) {
      newErrors.email = 'Admin email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Enter a valid email address'
    }
    if (!password) {
      newErrors.password = 'Password is required'
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters'
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const { error } = await signIn(email, password)
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
      setLoading(false)
    }
  }

  // Quick Demo Admin Access helper
  async function handleQuickAdminAccess() {
    setDemoLoading(true)
    try {
      if (isAuthenticated) {
        // Upgrade current session to admin directly
        await adminApi.claimAdmin()
        await refreshProfile()
        toast.success('Admin privileges confirmed. Entering Admin Portal...')
        navigate('/dashboard/admin', { replace: true })
      } else {
        // Sign in with the registered admin user
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
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      {/* High-security background ambient glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 size-[500px] rounded-full bg-primary/10 blur-[130px]" />
        <div className="absolute bottom-10 right-1/4 size-[350px] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative w-full max-w-md space-y-4"
      >
        {/* Brand Header */}
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <Link to="/" className="inline-block transition-transform hover:scale-105">
            <Logo size="lg" />
          </Link>
          <div className="flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <Shield className="size-3.5" />
            <span>Authorized Personnel Only</span>
          </div>
        </div>

        <Card className="border border-primary/20 shadow-xl backdrop-blur-sm">
          <CardHeader className="text-center pb-4">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/25">
              <Lock className="size-6" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Admin Portal</CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Manage system users, oversee assessments, and monitor clinical machine learning models
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="admin-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Admin Email
                </Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@neuroscreen.io"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }))
                  }}
                  autoComplete="email"
                  disabled={loading || demoLoading}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Password */}
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
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value)
                      if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }))
                    }}
                    autoComplete="current-password"
                    disabled={loading || demoLoading}
                    className={errors.password ? 'border-destructive pr-10' : 'pr-10'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Submit Button */}
              <Button
                id="admin-login-submit"
                type="submit"
                className="w-full gap-2 font-semibold shadow-md"
                disabled={loading || demoLoading}
              >
                {loading ? (
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
                <span className="bg-card px-2 text-muted-foreground">Or Evaluator Quick Access</span>
              </div>
            </div>

            {/* One-Click Quick Admin Demo Access */}
            <Button
              type="button"
              variant="outline"
              onClick={handleQuickAdminAccess}
              disabled={loading || demoLoading}
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

            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-center">
              <p className="text-xs text-muted-foreground">
                Regular user?{' '}
                <Link to="/login" className="font-semibold text-primary hover:underline inline-flex items-center gap-1">
                  Return to Patient Portal <ArrowRight className="size-3" />
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
