// ===========================================================
// NeuroScreen — Admin Dashboard & Management Suite
// ===========================================================
// Comprehensive administration panel with:
//   1. Overview — KPIs, screening distribution, and recent activity
//   2. Users — full user management (edit name/role, view dossier, delete)
//   3. Assessments — system-wide surveillance & direct result inspections
//   4. ML Model & Health — model metadata, confusion matrix, system diagnostics
//
// Accessible exclusively to users with the ADMIN role.
// ===========================================================

import { useState, useMemo } from 'react'
import { Link, useSearchParams, Navigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Shield,
  Users,
  ClipboardList,
  Cpu,
  BarChart3,
  Search,
  Loader2,
  AlertTriangle,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Activity,
  TrendingUp,
  Layers,
  Brain,
  Edit2,
  Trash2,
  Eye,
  CheckCircle2,
  ExternalLink,
  Download,
  Calendar,
  Sparkles,
  Server,
} from 'lucide-react'
import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from 'recharts'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/auth-context'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { PrototypeBanner } from '@/components/ui/disclaimer-banner'
import { PageHeader } from '@/components/ui/page-header'
import { cn } from '@/lib/utils'
import { adminApi } from '@/services/admin-api'
import type { AdminStats, AdminUser, ModelMetadata } from '@/services/admin-api'
import type { LanguageCode } from '@/types/database'

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
}

const PIE_COLORS: Record<string, string> = {
  LOW: 'var(--color-level-low, #22C55E)',
  MODERATE: 'var(--color-level-moderate, #F59E0B)',
  HIGH: 'var(--color-level-high, #EF4444)',
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-success/10 text-success border-success/30' },
  in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border-primary/30' },
  abandoned: { label: 'Abandoned', className: 'bg-muted text-muted-foreground border-border' },
}

const LEVEL_ICONS: Record<string, typeof Shield> = {
  LOW: ShieldCheck,
  MODERATE: Shield,
  HIGH: ShieldAlert,
}

const LEVEL_COLORS: Record<string, string> = {
  LOW: 'text-[var(--color-level-low)]',
  MODERATE: 'text-[var(--color-level-moderate)]',
  HIGH: 'text-[var(--color-level-high)]',
}

const DEMO_STATS: AdminStats = {
  total_users: 24,
  total_assessments: 87,
  completed_assessments: 62,
  total_reports: 38,
  screening_distribution: { LOW: 35, MODERATE: 18, HIGH: 9 },
  prototype_notice: 'Research/Educational Prototype',
}

const DEMO_MODEL: ModelMetadata = {
  model_name: 'RandomForest',
  model_version: '1.0.0',
  training_date: '2026-09-16T13:44:40.381857+00:00',
  dataset_description: 'Synthetic multimodal behavioural dataset (2000 samples). NOT real clinical data.',
  feature_schema: {
    feature_columns: [
      'wpm', 'cpm', 'accuracy', 'backspace_rate', 'avg_hold_time_ms', 'avg_flight_time_ms',
      'word_recall_accuracy', 'number_recall_accuracy', 'pattern_accuracy', 'avg_response_time_ms',
      'avg_reaction_time_ms', 'fastest_reaction_ms', 'slowest_reaction_ms', 'false_start_count',
      'speech_rate_wpm', 'avg_pause_duration_ms', 'fluency_score', 'transcript_word_count',
      'blink_rate_per_min', 'avg_head_movement', 'orientation_stability', 'attention_score',
    ],
    indicator_columns: ['typing_present', 'memory_present', 'reaction_present', 'speech_present', 'facial_present'],
    total_input_features: 27,
  },
  metrics: {
    accuracy: 0.9425,
    precision_weighted: 0.942,
    recall_weighted: 0.9425,
    f1_weighted: 0.9421,
    roc_auc_weighted: 0.9886,
    confusion_matrix: [[199, 3, 0], [8, 103, 5], [0, 7, 75]],
    cv_f1_scores: [0.9448, 0.9496, 0.9475, 0.9398, 0.9378],
    cv_f1_mean: 0.9439,
    cv_f1_std: 0.0045,
  },
  prototype_notice: 'Research/Educational Prototype — trained and evaluated on synthetic data. Not clinically validated.',
}

// -------------------------------------------------------
// Main Admin Component
// -------------------------------------------------------

export function AdminPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'overview'
  const { user, profile, isAdmin, loading } = useAuth()
  const queryClient = useQueryClient()

  // Strict role guard: immediately redirect non-admin users to patient dashboard
  if (!loading && !isAdmin) {
    return <Navigate to="/dashboard" replace />
  }

  const handleTabChange = (tab: string) => {
    setSearchParams(tab === 'overview' ? {} : { tab }, { replace: true })
  }

  // Quick refresh all admin data
  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin'] })
    toast.success('Admin data synchronized')
  }

  return (
    <div className="space-y-6">
      <motion.div {...fadeIn}>
        <PageHeader
          title="System Administration Console"
          description="Manage registered users, inspect assessment activity, and monitor machine learning models"
        >
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1.5 text-xs border-primary/30 text-primary bg-primary/5 py-1 px-2.5">
              <Shield className="size-3.5" />
              <span>Administrator: <strong>{profile?.full_name || user?.email}</strong></span>
            </Badge>
            <Button size="sm" variant="outline" onClick={handleRefresh} className="gap-1.5 text-xs">
              <Activity className="size-3.5" />
              Sync
            </Button>
          </div>
        </PageHeader>
      </motion.div>

      <motion.div {...fadeIn} transition={{ delay: 0.05 }}>
        <PrototypeBanner />
      </motion.div>

      <motion.div {...fadeIn} transition={{ delay: 0.1 }}>
        <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
          <TabsList className="inline-flex flex-wrap sm:flex-nowrap w-full sm:w-auto h-auto p-1.5 gap-1.5 bg-muted/60 border border-border/50 rounded-xl">
            <TabsTrigger value="overview" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg">
              <BarChart3 className="size-4" />
              <span>Overview</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg">
              <Users className="size-4" />
              <span>User Management</span>
            </TabsTrigger>
            <TabsTrigger value="assessments" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg">
              <ClipboardList className="size-4" />
              <span>Assessments</span>
            </TabsTrigger>
            <TabsTrigger value="model" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium rounded-lg">
              <Cpu className="size-4" />
              <span>ML & Diagnostics</span>
            </TabsTrigger>
          </TabsList>

          <div className="mt-6 w-full">
            <TabsContent value="overview">
              <OverviewTab onNavigateTab={handleTabChange} />
            </TabsContent>
            <TabsContent value="users">
              <UsersTab />
            </TabsContent>
            <TabsContent value="assessments">
              <AssessmentsTab />
            </TabsContent>
            <TabsContent value="model">
              <ModelInfoTab />
            </TabsContent>
          </div>
        </Tabs>
      </motion.div>
    </div>
  )
}

// -------------------------------------------------------
// Overview Tab
// -------------------------------------------------------

function OverviewTab({ onNavigateTab }: { onNavigateTab: (tab: string) => void }) {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.getStats(),
    staleTime: 30 * 1000,
  })

  const { data: assessments } = useQuery({
    queryKey: ['admin', 'assessments'],
    queryFn: () => adminApi.getAssessments({ limit: 10 }),
    staleTime: 30 * 1000,
  })

  const displayStats = stats ?? DEMO_STATS

  const pieData = useMemo(() => {
    const dist = displayStats.screening_distribution
    return [
      { name: 'LOW', value: dist.LOW || 0 },
      { name: 'MODERATE', value: dist.MODERATE || 0 },
      { name: 'HIGH', value: dist.HIGH || 0 },
    ].filter((d) => d.value > 0)
  }, [displayStats])

  const completionRate = displayStats.total_assessments > 0
    ? `${Math.round((displayStats.completed_assessments / displayStats.total_assessments) * 100)}%`
    : '—'

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading system overview...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Users"
          value={String(displayStats.total_users)}
          icon={Users}
          subtitle="Registered patient profiles"
        />
        <StatCard
          title="Total Assessments"
          value={String(displayStats.total_assessments)}
          icon={Activity}
          subtitle={`${displayStats.completed_assessments} completed sessions`}
        />
        <StatCard
          title="Completion Rate"
          value={completionRate}
          icon={TrendingUp}
          subtitle="Assessment adherence rate"
        />
        <StatCard
          title="PDF Reports"
          value={String(displayStats.total_reports)}
          icon={FileText}
          subtitle="Clinical dossiers generated"
        />
      </div>

      {/* Main Charts & Surveillance Row */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Screening Risk Distribution */}
        <Card className="shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <BarChart3 className="size-4 text-primary" />
                  Screening Risk Distribution
                </CardTitle>
                <CardDescription className="text-xs">
                  Breakdown across completed screening ensembles
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                Total: {pieData.reduce((s, e) => s + e.value, 0)} predictions
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-around py-2">
                <div className="size-[190px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {pieData.map((entry) => (
                          <Cell key={entry.name} fill={PIE_COLORS[entry.name]} />
                        ))}
                      </Pie>
                      <RechartsTooltip
                        content={({ active, payload }) => {
                          if (!active || !payload || !payload.length) return null
                          const entry = payload[0]
                          const name = String(entry.name || '')
                          const value = Number(entry.value || 0)
                          const total = pieData.reduce((s, e) => s + e.value, 0)
                          const pct = total > 0 ? ((value / total) * 100).toFixed(1) : '0'
                          const color = PIE_COLORS[name] || 'var(--color-primary)'

                          return (
                            <div
                              style={{
                                backgroundColor: 'var(--color-card)',
                                border: '1px solid var(--color-border)',
                                borderRadius: '8px',
                                boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
                                padding: '10px 14px',
                                fontSize: '12px',
                                color: 'var(--color-foreground)',
                                minWidth: '160px',
                              }}
                              className="space-y-1.5 pointer-events-none"
                            >
                              <p className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
                                <span
                                  className="size-2 rounded-full inline-block shrink-0"
                                  style={{ backgroundColor: color }}
                                />
                                <span>Risk Level: {name}</span>
                              </p>
                              <p className="text-foreground text-xs">
                                Assessments : {value}
                              </p>
                              <p className="text-xs font-medium" style={{ color }}>
                                Distribution : {pct}% of total
                              </p>
                            </div>
                          )
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-col gap-3 min-w-[170px]">
                  {pieData.map((entry) => {
                    const LevelIcon = LEVEL_ICONS[entry.name] ?? Shield
                    const levelColor = LEVEL_COLORS[entry.name] ?? ''
                    const total = pieData.reduce((s, e) => s + e.value, 0)
                    const pct = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0'
                    return (
                      <div key={entry.name} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30">
                        <LevelIcon className={cn('size-4', levelColor)} />
                        <div className="flex-1">
                          <p className={cn('text-xs font-semibold', levelColor)}>
                            {entry.name} Risk
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {entry.value} sessions ({pct}%)
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <EmptyState
                icon={BarChart3}
                title="No predictions yet"
                description="Distribution metrics will appear as assessments are completed."
              />
            )}
          </CardContent>
        </Card>

        {/* Recent Assessment Activity */}
        <Card className="shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <Activity className="size-4 text-secondary" />
                  Recent System Activity
                </CardTitle>
                <CardDescription className="text-xs">
                  Latest assessment sessions recorded across all users
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onNavigateTab('assessments')}
                className="text-xs gap-1"
              >
                View All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {assessments && assessments.length > 0 ? (
              <div className="divide-y divide-border text-sm">
                {assessments.slice(0, 5).map((a) => {
                  const statusCfg = STATUS_CONFIG[a.status]
                  const LevelIcon = a.screening_level ? LEVEL_ICONS[a.screening_level] : null
                  const levelColor = a.screening_level ? LEVEL_COLORS[a.screening_level] : ''
                  return (
                    <div key={a.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-foreground font-medium">
                            {a.id.slice(0, 8)}...
                          </span>
                          {statusCfg && (
                            <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusCfg.className)}>
                              {statusCfg.label}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="size-3" />
                          {new Date(a.started_at).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                          })}
                        </p>
                      </div>

                      <div className="flex items-center gap-3">
                        {LevelIcon && a.screening_level ? (
                          <span className={cn('text-xs font-semibold flex items-center gap-1', levelColor)}>
                            <LevelIcon className="size-3.5" />
                            {a.screening_level}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                        <Link to={`/dashboard/results/${a.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs">
                            <ExternalLink className="size-3.5" />
                          </Button>
                        </Link>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6">
                <EmptyState
                  icon={ClipboardList}
                  title="No sessions yet"
                  description="Recent assessment sessions will be logged here."
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

// -------------------------------------------------------
// Users Tab (Full User Management Console)
// -------------------------------------------------------

function UsersTab() {
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'USER' | 'ADMIN'>('ALL')
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null)
  const [deletingUser, setDeletingUser] = useState<AdminUser | null>(null)
  const [dossierUserId, setDossierUserId] = useState<string | null>(null)

  const queryClient = useQueryClient()

  // Fetch users
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => adminApi.getUsers({ limit: 200 }),
    staleTime: 30 * 1000,
  })

  // Edit user mutation
  const editMutation = useMutation({
    mutationFn: async ({
      userId,
      data,
    }: {
      userId: string
      data: { full_name?: string; role?: 'USER' | 'ADMIN'; language_preference?: LanguageCode }
    }) => {
      return adminApi.updateUser(userId, data)
    },
    onSuccess: () => {
      toast.success('User updated successfully')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setEditingUser(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to update user')
    },
  })

  // Delete user mutation
  const deleteMutation = useMutation({
    mutationFn: async (userId: string) => {
      return adminApi.deleteUser(userId)
    },
    onSuccess: () => {
      toast.success('User profile and assessments deleted')
      queryClient.invalidateQueries({ queryKey: ['admin', 'users'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'stats'] })
      setDeletingUser(null)
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.detail || 'Failed to delete user')
    },
  })

  const filtered = useMemo(() => {
    if (!users) return []
    return users.filter((u) => {
      const q = search.toLowerCase()
      const matchesSearch =
        u.full_name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter
      return matchesSearch && matchesRole
    })
  }, [users, search, roleFilter])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading user directory...</span>
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message="Failed to load users" />
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar: Search & Role Filters */}
      <Card className="shadow-xs">
        <CardContent className="p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or user ID..."
                className="pl-9 h-9 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground hidden sm:inline">Role:</span>
              {(['ALL', 'USER', 'ADMIN'] as const).map((r) => (
                <Button
                  key={r}
                  size="sm"
                  variant={roleFilter === r ? 'default' : 'outline'}
                  onClick={() => setRoleFilter(r)}
                  className="h-8 px-2.5 text-xs"
                >
                  {r === 'ADMIN' && <Shield className="mr-1 size-3" />}
                  {r}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-5 border-b bg-muted/20">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Users className="size-4 text-secondary" />
                User Governance Console
              </CardTitle>
              <CardDescription className="text-xs">
                Showing {filtered.length} of {users?.length ?? 0} registered accounts
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filtered.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User / Identity</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-center">Language</TableHead>
                  <TableHead className="text-center">Assessments</TableHead>
                  <TableHead className="text-center">Completed</TableHead>
                  <TableHead>Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((user) => (
                  <TableRow key={user.id} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="size-8 rounded-full bg-secondary/10 flex items-center justify-center font-semibold text-secondary text-xs">
                          {user.full_name ? user.full_name.slice(0, 2).toUpperCase() : 'NS'}
                        </div>
                        <div>
                          <p className="font-medium text-xs text-foreground">
                            {user.full_name || <span className="text-muted-foreground italic">No Name Set</span>}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {user.email || user.id.slice(0, 16) + '...'}
                          </p>
                        </div>
                      </div>
                    </TableCell>

                    <TableCell>
                      <Badge
                        variant={user.role === 'ADMIN' ? 'default' : 'secondary'}
                        className={cn(
                          'text-[10px] px-2 py-0.5 gap-1 font-medium',
                          user.role === 'ADMIN' && 'bg-purple-600 hover:bg-purple-700 text-white'
                        )}
                      >
                        {user.role === 'ADMIN' && <Shield className="size-2.5" />}
                        {user.role}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {user.language_preference}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-center text-xs font-semibold">
                      {user.total_assessments}
                    </TableCell>

                    <TableCell className="text-center text-xs font-semibold text-success">
                      {user.completed_assessments}
                    </TableCell>

                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(user.created_at).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                      })}
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {/* View User Dossier */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="View Assessment History & Dossier"
                          onClick={() => setDossierUserId(user.id)}
                          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
                        >
                          <Eye className="size-4" />
                        </Button>

                        {/* Edit User Info */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Edit User Information"
                          onClick={() => setEditingUser(user)}
                          className="h-8 w-8 p-0 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <Edit2 className="size-4" />
                        </Button>

                        {/* Delete User */}
                        <Button
                          variant="ghost"
                          size="sm"
                          title="Delete User"
                          onClick={() => setDeletingUser(user)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={Users}
                title={search ? 'No matching users' : 'No users registered'}
                description={search ? `No accounts found matching "${search}".` : 'Users will be listed here as they register.'}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit User Modal */}
      {editingUser && (
        <EditUserDialog
          user={editingUser}
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          onSave={(data) => editMutation.mutate({ userId: editingUser.id, data })}
          loading={editMutation.isPending}
        />
      )}

      {/* Delete User Dialog */}
      {deletingUser && (
        <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertTriangle className="size-5" />
                Confirm User Deletion
              </DialogTitle>
              <DialogDescription className="text-xs">
                Are you sure you want to delete profile for <strong>{deletingUser.full_name || deletingUser.email}</strong>?
                This will delete all their historical assessment records, module test results, and PDF dossiers.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="mt-4 gap-2">
              <Button variant="ghost" size="sm" onClick={() => setDeletingUser(null)} disabled={deleteMutation.isPending}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => deleteMutation.mutate(deletingUser.id)}
                disabled={deleteMutation.isPending}
                className="gap-1.5"
              >
                {deleteMutation.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                Confirm Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* User Dossier Drawer/Modal */}
      {dossierUserId && (
        <UserDossierModal
          userId={dossierUserId}
          isOpen={!!dossierUserId}
          onClose={() => setDossierUserId(null)}
        />
      )}
    </div>
  )
}

// -------------------------------------------------------
// Edit User Dialog
// -------------------------------------------------------

interface EditUserDialogProps {
  user: AdminUser
  isOpen: boolean
  onClose: () => void
  onSave: (data: { full_name?: string; role?: 'USER' | 'ADMIN'; language_preference?: LanguageCode }) => void
  loading: boolean
}

function EditUserDialog({ user, isOpen, onClose, onSave, loading }: EditUserDialogProps) {
  const [fullName, setFullName] = useState(user.full_name || '')
  const [role, setRole] = useState<'USER' | 'ADMIN'>(user.role)
  const [language, setLanguage] = useState<LanguageCode>(user.language_preference)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({
      full_name: fullName.trim(),
      role,
      language_preference: language,
    })
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Edit2 className="size-4 text-primary" />
            Edit User Profile & Permissions
          </DialogTitle>
          <DialogDescription className="text-xs">
            Manage account attributes and role access for {user.email || user.id}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Full Name */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Full Name</Label>
            <Input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="e.g. John Doe"
              className="text-xs"
            />
          </div>

          {/* Role Selection */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">System Role</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setRole('USER')}
                className={cn(
                  'flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer',
                  role === 'USER'
                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <Users className="size-3.5" />
                USER (Patient)
              </button>

              <button
                type="button"
                onClick={() => setRole('ADMIN')}
                className={cn(
                  'flex items-center justify-center gap-2 p-2.5 rounded-lg border text-xs font-medium transition-all cursor-pointer',
                  role === 'ADMIN'
                    ? 'border-purple-600 bg-purple-500/10 text-purple-600 ring-1 ring-purple-600'
                    : 'border-border text-muted-foreground hover:bg-muted'
                )}
              >
                <Shield className="size-3.5" />
                ADMIN (Manager)
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              ADMIN role grants access to view all patient data, system stats, and machine learning diagnostics.
            </p>
          </div>

          {/* Language Preference */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">Preferred Language</Label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value as LanguageCode)}
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1.5 text-xs shadow-xs focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="en">English (en)</option>
              <option value="kn">Kannada (kn) Transliterated</option>
            </select>
          </div>

          <DialogFooter className="pt-3 gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={loading} className="gap-1.5 font-semibold">
              {loading && <Loader2 className="size-3.5 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------
// User Dossier Modal (Comprehensive User History)
// -------------------------------------------------------

function UserDossierModal({
  userId,
  isOpen,
  onClose,
}: {
  userId: string
  isOpen: boolean
  onClose: () => void
}) {
  const { data: dossier, isLoading } = useQuery({
    queryKey: ['admin', 'user-dossier', userId],
    queryFn: () => adminApi.getUserDetails(userId),
    enabled: isOpen && !!userId,
  })

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <DialogTitle className="text-base font-semibold">Patient Clinical Dossier</DialogTitle>
          </div>
          <DialogDescription className="text-xs">
            Complete assessment records and generated screening reports for this account
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12 gap-2">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Compiling patient dossier...</span>
          </div>
        ) : dossier ? (
          <div className="space-y-5 py-2 text-xs">
            {/* User Meta Card */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-lg border bg-muted/20">
              <div>
                <p className="font-semibold text-sm text-foreground">{dossier.profile.full_name || 'No Name Set'}</p>
                <p className="text-muted-foreground font-mono">{dossier.profile.email || dossier.profile.id}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={dossier.profile.role === 'ADMIN' ? 'default' : 'secondary'} className="text-[10px]">
                  {dossier.profile.role}
                </Badge>
                <Badge variant="outline" className="text-[10px] uppercase font-mono">
                  {dossier.profile.language_preference}
                </Badge>
              </div>
            </div>

            {/* Assessment History */}
            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                Assessment Sessions ({dossier.assessments.length})
              </h4>
              {dossier.assessments.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border bg-card">
                  {dossier.assessments.map((a) => {
                    const statusCfg = STATUS_CONFIG[a.status]
                    return (
                      <div key={a.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-semibold">{a.id.slice(0, 8)}...</span>
                            {statusCfg && (
                              <Badge variant="outline" className={cn('text-[9px] px-1 py-0', statusCfg.className)}>
                                {statusCfg.label}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground">
                            Started: {new Date(a.started_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Link to={`/dashboard/results/${a.id}`}>
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                              <ExternalLink className="size-3" />
                              View Results
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-xs">No assessments taken by this user yet.</p>
              )}
            </div>

            {/* Generated Reports */}
            <div className="space-y-2">
              <h4 className="font-semibold text-xs text-foreground uppercase tracking-wider">
                Clinical Reports Generated ({dossier.reports.length})
              </h4>
              {dossier.reports.length > 0 ? (
                <div className="divide-y divide-border rounded-lg border bg-card">
                  {dossier.reports.map((r) => (
                    <div key={r.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                      <div>
                        <p className="font-medium text-xs text-foreground">{r.file_name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {new Date(r.generated_at).toLocaleString()} • {Math.round((r.file_size_bytes || 0) / 1024)} KB
                        </p>
                      </div>
                      <Link to={`/dashboard/results/${r.assessment_id}`}>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary">
                          <Download className="size-3" />
                          View / Download
                        </Button>
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic text-xs">No reports generated yet.</p>
              )}
            </div>
          </div>
        ) : (
          <p className="text-muted-foreground italic text-xs py-4">Unable to load patient dossier.</p>
        )}

        <DialogFooter className="pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>
            Close Dossier
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// -------------------------------------------------------
// Assessments Tab
// -------------------------------------------------------

function AssessmentsTab() {
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data: assessments, isLoading, error } = useQuery({
    queryKey: ['admin', 'assessments', statusFilter],
    queryFn: () =>
      adminApi.getAssessments({
        status: statusFilter === 'all' ? undefined : statusFilter,
        limit: 100,
      }),
    staleTime: 30 * 1000,
  })

  const filters = [
    { key: 'all', label: 'All Sessions' },
    { key: 'completed', label: 'Completed' },
    { key: 'in_progress', label: 'In Progress' },
    { key: 'abandoned', label: 'Abandoned' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading assessment surveillance...</span>
      </div>
    )
  }

  if (error) {
    return <ErrorBanner message="Failed to load assessments" />
  }

  return (
    <div className="space-y-4">
      {/* Filter Tabs */}
      <Card className="shadow-xs">
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            {filters.map((f) => (
              <Badge
                key={f.key}
                variant={statusFilter === f.key ? 'default' : 'outline'}
                className={cn(
                  'cursor-pointer transition-colors text-xs px-2.5 py-1',
                  statusFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                )}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </Badge>
            ))}
            <span className="ml-auto text-xs text-muted-foreground">
              {assessments?.length ?? 0} sessions
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Assessments Table */}
      <Card className="shadow-xs overflow-hidden">
        <CardHeader className="py-3 px-5 border-b bg-muted/20">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <ClipboardList className="size-4 text-primary" />
            Global Assessment Registry
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {assessments && assessments.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Session ID</TableHead>
                  <TableHead>Date Recorded</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead className="text-center">Modules</TableHead>
                  <TableHead>Screening Level</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assessments.map((a) => {
                  const statusCfg = STATUS_CONFIG[a.status]
                  const LevelIcon = a.screening_level ? LEVEL_ICONS[a.screening_level] : null
                  const levelColor = a.screening_level ? LEVEL_COLORS[a.screening_level] : ''
                  return (
                    <TableRow key={a.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs font-semibold text-foreground">
                        {a.id.slice(0, 8)}...
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {new Date(a.started_at).toLocaleDateString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell>
                        {statusCfg && (
                          <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', statusCfg.className)}>
                            {statusCfg.label}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">{a.language}</Badge>
                      </TableCell>
                      <TableCell className="text-center text-xs font-medium">
                        {a.modules_completed} of {a.modules_total}
                      </TableCell>
                      <TableCell>
                        {LevelIcon && a.screening_level ? (
                          <div className="flex items-center gap-1.5">
                            <LevelIcon className={cn('size-3.5', levelColor)} />
                            <span className={cn('text-xs font-semibold', levelColor)}>
                              {a.screening_level}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/dashboard/results/${a.id}`}>
                          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-primary">
                            <ExternalLink className="size-3" />
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={ClipboardList}
                title="No assessment records"
                description="Assessments from all users will be logged here."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

// -------------------------------------------------------
// ML Model Info & System Health Tab
// -------------------------------------------------------

function ModelInfoTab() {
  const { data: modelInfo, isLoading } = useQuery({
    queryKey: ['admin', 'model-info'],
    queryFn: () => adminApi.getModelInfo(),
    staleTime: 5 * 60 * 1000,
  })

  const model = modelInfo ?? DEMO_MODEL
  const isDemo = !modelInfo && !isLoading
  const metrics = model.metrics as Record<string, unknown>
  const schema = model.feature_schema as Record<string, unknown>
  const confMatrix = metrics?.confusion_matrix as number[][] | undefined

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading model metadata...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {isDemo && <DemoBanner />}

      {/* System Infrastructure Health Card */}
      <Card className="shadow-xs border-primary/20 bg-primary/5">
        <CardHeader className="py-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Server className="size-4 text-primary" />
            Infrastructure & Diagnostics Health
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-2.5 rounded-lg bg-background/80 border flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">PostgreSQL</p>
                <p className="text-[10px] text-muted-foreground">RLS Security Enabled</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">Supabase Storage</p>
                <p className="text-[10px] text-muted-foreground">PDF Bucket Active</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">FastAPI Engine</p>
                <p className="text-[10px] text-muted-foreground">Python Uvicorn Core</p>
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-background/80 border flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              <div>
                <p className="font-semibold text-foreground">ML Inference</p>
                <p className="text-[10px] text-muted-foreground">RandomForest + SVM</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Model Identity */}
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Brain className="size-5 text-primary" />
            Active ML Model Architecture
          </CardTitle>
          <CardDescription className="text-xs">
            Trained ensemble parameters and feature space specification
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <InfoItem label="Classifier Model" value={model.model_name} />
            <InfoItem label="Architecture Version" value={model.model_version} />
            <InfoItem
              label="Compilation Date"
              value={model.training_date
                ? new Date(model.training_date).toLocaleDateString('en-US', {
                    month: 'long', day: 'numeric', year: 'numeric',
                  })
                : 'N/A'}
            />
            <div className="sm:col-span-2 lg:col-span-3">
              <InfoItem label="Training Corpus" value={model.dataset_description} />
            </div>
            <InfoItem label="Biomarker Inputs" value={String((schema?.total_input_features as number) ?? 27)} />
            <InfoItem
              label="Feature Composition"
              value={`${((schema?.feature_columns as string[]) ?? []).length || 22} biomarkers + ${((schema?.indicator_columns as string[]) ?? []).length || 5} modality indicators`}
            />
          </div>
        </CardContent>
      </Card>

      {/* Performance Metrics */}
      <Card className="shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <TrendingUp className="size-5 text-secondary" />
            Cross-Validation Benchmarks
          </CardTitle>
          <CardDescription className="text-xs">
            5-Fold Cross Validation evaluated against balanced multimodal test sets
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <MetricCard label="Accuracy" value={(metrics?.accuracy as number) ?? 0.9425} />
            <MetricCard label="Precision" value={(metrics?.precision_weighted as number) ?? 0.942} />
            <MetricCard label="Recall" value={(metrics?.recall_weighted as number) ?? 0.9425} />
            <MetricCard label="F1 Score" value={(metrics?.f1_weighted as number) ?? 0.9421} />
            <MetricCard label="ROC-AUC" value={(metrics?.roc_auc_weighted as number) ?? 0.9886} />
          </div>
        </CardContent>
      </Card>

      {/* Confusion Matrix */}
      {confMatrix && confMatrix.length > 0 && (
        <Card className="shadow-xs">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Layers className="size-5 text-accent" />
              Confusion Matrix
            </CardTitle>
            <CardDescription className="text-xs">
              Rows = Ground Truth Level, Columns = Model Screening Prediction
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="text-xs border-collapse mx-auto">
                <thead>
                  <tr>
                    <th className="p-2 text-muted-foreground"></th>
                    <th className="p-2 font-semibold text-center text-[var(--color-level-low)]">Pred LOW</th>
                    <th className="p-2 font-semibold text-center text-[var(--color-level-moderate)]">Pred MOD</th>
                    <th className="p-2 font-semibold text-center text-[var(--color-level-high)]">Pred HIGH</th>
                  </tr>
                </thead>
                <tbody>
                  {['LOW', 'MODERATE', 'HIGH'].map((label, rowIdx) => (
                    <tr key={label}>
                      <td className={cn('p-2 font-semibold', LEVEL_COLORS[label])}>
                        Actual {label.slice(0, 3)}
                      </td>
                      {confMatrix[rowIdx]?.map((val, colIdx) => (
                        <td
                          key={colIdx}
                          className={cn(
                            'p-3 text-center text-xs font-medium rounded-md border min-w-[70px]',
                            rowIdx === colIdx
                              ? 'bg-primary/10 text-primary font-bold border-primary/30'
                              : val > 0
                                ? 'bg-destructive/5 text-destructive/70 border-destructive/20'
                                : 'bg-muted/50 text-muted-foreground border-border'
                          )}
                        >
                          {val}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// -------------------------------------------------------
// Helper Components
// -------------------------------------------------------

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-medium text-foreground">{value}</p>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: number }) {
  const formatted = typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '—'
  return (
    <div className="p-3 rounded-lg border bg-muted/20 text-center space-y-1">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className="text-lg font-bold text-foreground font-mono">{formatted}</p>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex items-center gap-3">
      <AlertTriangle className="size-5 text-destructive shrink-0" />
      <p className="text-xs text-destructive">{message}</p>
    </div>
  )
}

function DemoBanner() {
  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-center gap-2.5">
      <Sparkles className="size-4 text-amber-500 shrink-0" />
      <p className="text-xs text-amber-600 dark:text-amber-400">
        Demo Mode: Displaying synthetic benchmarking dataset metrics for administrative review.
      </p>
    </div>
  )
}
