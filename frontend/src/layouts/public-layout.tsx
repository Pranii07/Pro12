// ===========================================================
// NeuroScreen — Public Layout
// ===========================================================
// Layout for public pages (landing, login, register).
// Sticky transparent navbar, content area, no sidebar.
// ===========================================================

import { Link, useLocation, Outlet } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/contexts/auth-context'

export function PublicLayout() {
  const { isAuthenticated, isAdmin } = useAuth()
  const location = useLocation()
  const isLanding = location.pathname === '/home' || location.pathname === '/landing'
  const isAuthPage = location.pathname === '/' || location.pathname === '/login' || location.pathname === '/admin/login'

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to={isAuthenticated ? (isAdmin ? "/dashboard/admin" : "/dashboard") : "/"}>
            <Logo size="md" />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {isLanding && (
              <>
                <a href="#features" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  Features
                </a>
                <a href="#how-it-works" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  How It Works
                </a>
                <a href="#faq" className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                  FAQ
                </a>
              </>
            )}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            {isAuthenticated ? (
              <Link to={isAdmin ? "/dashboard/admin" : "/dashboard"}>
                <Button size="sm">{isAdmin ? "Admin Console" : "Dashboard"}</Button>
              </Link>
            ) : (
              <>
                {isAuthPage && (
                  <Link to="/home">
                    <Button variant="ghost" size="sm">Explore Platform</Button>
                  </Link>
                )}
                {!isAuthPage && (
                  <Link to="/login">
                    <Button variant="ghost" size="sm">Sign In</Button>
                  </Link>
                )}
                <Link to="/register">
                  <Button size="sm">Get Started</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Content */}
      <main>
        <Outlet />
      </main>
    </div>
  )
}
