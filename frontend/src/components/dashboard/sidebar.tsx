// ===========================================================
// NeuroScreen — Dashboard Sidebar
// ===========================================================
// Collapsible sidebar navigation for the authenticated dashboard.
// ===========================================================

import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home,
  LayoutDashboard,
  ClipboardList,
  History,
  FileText,
  User,
  Settings,
  Shield,
  Users,
  Cpu,
  Brain,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/auth-context'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

interface NavItem {
  label: string
  path: string
  icon: React.ElementType
}

// Admin Navigation (Clinical System Operators)
const adminPrimaryNavItems: NavItem[] = [
  { label: 'Home', path: '/home', icon: Home },
  { label: 'Admin Console', path: '/dashboard/admin', icon: Shield },
  { label: 'User Management', path: '/dashboard/admin?tab=users', icon: Users },
  { label: 'Assessments', path: '/dashboard/admin?tab=assessments', icon: ClipboardList },
  { label: 'Lab Surveillance', path: '/dashboard/admin?tab=benchmarks', icon: Brain },
  { label: 'ML & Health', path: '/dashboard/admin?tab=model', icon: Cpu },
]

// Regular User Navigation (Patients / Screeners)
const userNavItems: NavItem[] = [
  { label: 'Home', path: '/home', icon: Home },
  { label: 'Overview', path: '/dashboard', icon: LayoutDashboard },
  { label: 'New Assessment', path: '/dashboard/new-assessment', icon: ClipboardList },
  { label: 'Cognitive Lab', path: '/dashboard/benchmarks', icon: Brain },
  { label: 'History', path: '/dashboard/assessments', icon: History },
  { label: 'Reports', path: '/dashboard/reports', icon: FileText },
]

const settingsNavItems: NavItem[] = [
  { label: 'Profile', path: '/dashboard/profile', icon: User },
  { label: 'Settings', path: '/dashboard/settings', icon: Settings },
]

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { isAdmin } = useAuth()

  const isActive = (path: string) => {
    const currentFull = location.pathname + location.search
    if (path.includes('?')) {
      return currentFull === path
    }
    if (path === '/dashboard/admin') {
      return location.pathname === '/dashboard/admin' && (!location.search || location.search === '?tab=overview')
    }
    if (path === '/dashboard') {
      return location.pathname === '/dashboard' && !location.pathname.startsWith('/dashboard/admin')
    }
    return location.pathname === path
  }

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="relative flex h-screen flex-col border-r border-sidebar-border bg-sidebar"
    >
      {/* Logo */}
      <div className="flex h-16 items-center px-4">
        <Link to={isAdmin ? "/dashboard/admin" : "/dashboard"}>
          <Logo size="sm" showText={!collapsed} />
        </Link>
      </div>

      <Separator />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {isAdmin ? (
          // ================= ADMIN VIEW =================
          <div className="space-y-1">
            {!collapsed && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-primary">
                  Administration
                </p>
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[0.6rem] font-bold text-primary uppercase">
                  Admin
                </span>
              </div>
            )}
            {adminPrimaryNavItems.map((item) => (
              <NavLink key={item.path} item={item} collapsed={collapsed} active={isActive(item.path)} />
            ))}
          </div>
        ) : (
          // ================= REGULAR USER VIEW =================
          <div className="space-y-1">
            {!collapsed && (
              <p className="px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
                Main
              </p>
            )}
            {userNavItems.map((item) => (
              <NavLink key={item.path} item={item} collapsed={collapsed} active={isActive(item.path)} />
            ))}
          </div>
        )}

        <Separator className="my-3" />

        {/* Account / Settings */}
        <div className="space-y-1">
          {!collapsed && (
            <p className="px-3 py-1.5 text-[0.65rem] font-semibold uppercase tracking-widest text-muted-foreground">
              Account
            </p>
          )}
          {settingsNavItems.map((item) => (
            <NavLink key={item.path} item={item} collapsed={collapsed} active={isActive(item.path)} />
          ))}
        </div>
      </nav>

      {/* Collapse Toggle */}
      <div className="border-t border-sidebar-border p-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className={cn(
            "w-full justify-center text-muted-foreground hover:text-foreground",
            !collapsed && "justify-start"
          )}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed && <span className="ml-2 text-xs">Collapse</span>}
        </Button>
      </div>
    </motion.aside>
  )
}

function NavLink({ item, collapsed, active }: { item: NavItem; collapsed: boolean; active: boolean }) {
  return (
    <Link
      to={item.path}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
        collapsed && "justify-center px-2",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
      )}
      title={collapsed ? item.label : undefined}
    >
      <item.icon className={cn("size-4 shrink-0", active && "text-sidebar-primary")} />
      {!collapsed && <span>{item.label}</span>}
    </Link>
  )
}
