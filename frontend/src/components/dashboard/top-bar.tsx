// ===========================================================
// NeuroScreen — Dashboard Top Bar
// ===========================================================
// Top bar for authenticated dashboard pages.
// Shows breadcrumb-style page title, user info, and theme toggle.
// ===========================================================

import { useLocation, Link } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAuth } from '@/contexts/auth-context'

interface TopBarProps {
  onMenuToggle: () => void
}

const pageTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/new-assessment': 'New Assessment',
  '/dashboard/assessments': 'Assessment History',
  '/dashboard/reports': 'Reports',
  '/dashboard/profile': 'Profile',
  '/dashboard/settings': 'Settings',
  '/dashboard/admin': 'Admin Panel',
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const location = useLocation()
  const { profile, signOut } = useAuth()

  const pageTitle = pageTitles[location.pathname] || 'Dashboard'
  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : '?'

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-3">
          {/* Mobile menu toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden"
          >
            <Menu className="size-4" />
          </Button>

          <div>
            <h1 className="text-lg font-semibold tracking-tight">{pageTitle}</h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggle />

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted cursor-pointer">
              <Avatar className="size-7">
                <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm font-medium sm:inline-block">
                {profile?.full_name || 'User'}
              </span>
              {profile?.role === 'ADMIN' && (
                <Badge variant="outline" className="hidden text-[0.6rem] px-1.5 py-0 sm:inline-flex">
                  Admin
                </Badge>
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem>
                <Link to="/home" className="flex w-full items-center">
                  Home
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/dashboard/profile" className="flex w-full items-center">
                  Profile
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Link to="/dashboard/settings" className="flex w-full items-center">
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => signOut()} className="text-destructive focus:text-destructive">
                <LogOut className="mr-2 size-4" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
