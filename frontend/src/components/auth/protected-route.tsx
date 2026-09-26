// ===========================================================
// NeuroScreen — Protected Route Component
// ===========================================================
// Route guard that redirects unauthenticated users to /login.
// Optionally requires a specific role (e.g., ADMIN).
// ===========================================================

import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import type { UserRole } from '@/types/database'

interface ProtectedRouteProps {
  children: React.ReactNode
  /** If set, user must have this role to access the route */
  requiredRole?: UserRole
}

export function ProtectedRoute({ children, requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, loading, profile } = useAuth()
  const location = useLocation()

  // Still checking auth state — show nothing (or a loading indicator)
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Checking authentication...</p>
        </div>
      </div>
    )
  }

  // Not authenticated — redirect to login, preserving the intended destination
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Role check (if required)
  if (requiredRole && profile?.role !== requiredRole) {
    // User is authenticated but lacks the required role — redirect to dashboard
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
