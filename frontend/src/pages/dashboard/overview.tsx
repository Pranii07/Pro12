// ===========================================================
// NeuroScreen — Dashboard Overview Page
// ===========================================================
// Main dashboard view with welcome message, quick actions,
// recent assessments, latest screening result, and summary
// statistics. Data fetched via TanStack Query from the API.
// ===========================================================

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardList,
  History,
  FileText,
  ArrowRight,
  Activity,
  BarChart3,
  Plus,
  Brain,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Loader2,
} from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { PrototypeBanner } from '@/components/ui/disclaimer-banner'
import { Badge } from '@/components/ui/badge'
import { ScreeningGauge } from '@/components/results/screening-gauge'
import { assessmentApi } from '@/services/assessment-api'
import { predictionApi } from '@/services/prediction-api'
import { reportApi } from '@/services/report-api'
import { cn } from '@/lib/utils'
import type { ScreeningLevel, ModuleType } from '@/types/database'

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
}

const quickActions = [
  {
    title: 'New Assessment',
    description: 'Start a new behavioural screening session',
    icon: ClipboardList,
    path: '/dashboard/new-assessment',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    title: 'Cognitive Lab',
    description: 'Practice standardized memory & reflex benchmarks',
    icon: Brain,
    path: '/dashboard/benchmarks',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
  },
  {
    title: 'Assessment History',
    description: 'View your past assessments and results',
    icon: History,
    path: '/dashboard/assessments',
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
  },
  {
    title: 'Reports',
    description: 'Download and manage your PDF reports',
    icon: FileText,
    path: '/dashboard/reports',
    color: 'text-accent',
    bgColor: 'bg-accent/10',
  },
]

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

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-success/10 text-success border-success/30' },
  in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border-primary/30' },
  abandoned: { label: 'Abandoned', className: 'bg-muted text-muted-foreground border-border' },
}

export function DashboardOverviewPage() {
  const { profile, user, isAdmin } = useAuth()
  const userName =
    profile?.full_name?.trim() ||
    (user?.user_metadata?.full_name as string)?.trim() ||
    (user?.user_metadata?.name as string)?.trim() ||
    user?.email?.split('@')[0] ||
    'User'

  // Fetch assessments
  const { data: assessments, isLoading: assessmentsLoading } = useQuery({
    queryKey: ['assessments'],
    queryFn: () => assessmentApi.list({ limit: 5 }),
    staleTime: 5 * 1000,
    refetchOnMount: 'always',
  })

  // Fetch latest prediction
  const { data: latestPrediction, isLoading: predictionLoading } = useQuery({
    queryKey: ['predictions', 'latest'],
    queryFn: () => predictionApi.getLatest(),
    staleTime: 5 * 1000,
    refetchOnMount: 'always',
    retry: false, // Don't retry — 404 is expected for new users
  })

  // Fetch reports count
  const { data: reports } = useQuery({
    queryKey: ['reports'],
    queryFn: () => reportApi.list(),
    staleTime: 5 * 1000,
    refetchOnMount: 'always',
  })


  const totalAssessments = assessments?.length ?? 0
  const completedAssessments = assessments?.filter((a) => a.status === 'completed').length ?? 0
  const totalModulesCompleted = assessments?.reduce((sum, a) => sum + a.modules_completed, 0) ?? 0
  const recentAssessments = assessments?.slice(0, 3) ?? []

  const latestScore = latestPrediction?.overall_score
  const latestLevel = latestPrediction?.screening_level as ScreeningLevel | undefined

  const currentQuickActions = isAdmin
    ? [
        {
          title: 'Admin Console',
          description: 'Manage users, surveillance, and ML models',
          icon: Shield,
          path: '/dashboard/admin',
          color: 'text-primary',
          bgColor: 'bg-primary/10',
        },
        {
          title: 'Assessments Surveillance',
          description: 'Inspect all assessment sessions across patients',
          icon: ClipboardList,
          path: '/dashboard/admin?tab=assessments',
          color: 'text-secondary',
          bgColor: 'bg-secondary/10',
        },
        {
          title: 'Reports & Export',
          description: 'Download and manage clinical dossiers',
          icon: FileText,
          path: '/dashboard/reports',
          color: 'text-accent',
          bgColor: 'bg-accent/10',
        },
        {
          title: 'Cognitive Lab',
          description: 'Interactive psychomotor & memory benchmarks',
          icon: Brain,
          path: '/dashboard/benchmarks',
          color: 'text-purple-500',
          bgColor: 'bg-purple-500/10',
        },
      ]
    : quickActions

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div {...fadeIn}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Welcome back, <span className="gradient-text">{userName}</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isAdmin
                ? "Here's an overview of clinical activity and system surveillance."
                : "Here's an overview of your behavioural assessments."}
            </p>
          </div>
          {isAdmin ? (
            <Link to="/dashboard/admin">
              <Button className="gap-2">
                <Shield className="size-4" />
                Admin Console
              </Button>
            </Link>
          ) : (
            <Link to="/dashboard/new-assessment">
              <Button className="gap-2">
                <Plus className="size-4" />
                New Assessment
              </Button>
            </Link>
          )}
        </div>
      </motion.div>

      {/* Prototype notice */}
      <motion.div {...fadeIn} transition={{ delay: 0.05 }}>
        <PrototypeBanner />
      </motion.div>

      {/* Stats Overview */}
      <motion.div
        {...fadeIn}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          title="Total Assessments"
          value={assessmentsLoading ? '...' : String(totalAssessments)}
          icon={Activity}
          subtitle={totalAssessments === 0 ? 'No assessments yet' : `${completedAssessments} completed`}
        />
        <StatCard
          title="Latest Score"
          value={
            predictionLoading ? '...'
              : latestScore != null ? String(Math.round(latestScore))
              : '—'
          }
          icon={Brain}
          subtitle={
            latestLevel ? `${latestLevel} screening level`
              : 'Complete an assessment'
          }
        />
        <StatCard
          title="Reports Generated"
          value={String(reports?.length ?? 0)}
          icon={FileText}
          subtitle={reports?.length ? `${reports.length} PDF report${reports.length !== 1 ? 's' : ''}` : 'No reports yet'}
        />
        <StatCard
          title="Modules Completed"
          value={assessmentsLoading ? '...' : `${totalModulesCompleted}`}
          icon={BarChart3}
          subtitle="Across all assessments"
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div {...fadeIn} transition={{ delay: 0.15 }}>
        <h2 className="mb-3 text-lg font-semibold">Quick Actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {currentQuickActions.map((action) => (
            <Link key={action.path} to={action.path}>
              <Card className="group h-full cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20">
                <CardContent className="flex items-start gap-4 p-5">
                  <div className={`shrink-0 rounded-xl ${action.bgColor} p-3 transition-transform group-hover:scale-110`}>
                    <action.icon className={`size-5 ${action.color}`} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-semibold">{action.title}</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">{action.description}</p>
                  </div>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </motion.div>

      {/* Latest Screening Result */}
      <motion.div {...fadeIn} transition={{ delay: 0.2 }}>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="size-5 text-primary" />
              Latest Screening Result
            </CardTitle>
            <CardDescription>
              Your most recent behavioural screening summary
            </CardDescription>
          </CardHeader>
          <CardContent>
            {predictionLoading ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading latest results...</span>
              </div>
            ) : latestPrediction && latestLevel && latestScore != null ? (
              <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-around">
                <ScreeningGauge
                  score={latestScore}
                  level={latestLevel}
                />
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <span className="text-xs text-muted-foreground">Model</span>
                    <p className="font-medium">{latestPrediction.model_name} v{latestPrediction.model_version}</p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Date</span>
                    <p className="font-medium">
                      {new Date(latestPrediction.created_at).toLocaleDateString('en-US', {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">Modules</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {(['typing', 'memory', 'reaction', 'speech', 'facial'] as ModuleType[]).map((type) => {
                        const present = latestPrediction.modalities_present[type]
                        return (
                          <Badge
                            key={type}
                            variant={present ? 'default' : 'secondary'}
                            className={cn('text-[0.55rem] capitalize', present && 'bg-primary/90')}
                          >
                            {type}
                          </Badge>
                        )
                      })}
                    </div>
                  </div>
                  <Link to={`/dashboard/results/${latestPrediction.assessment_id}`}>
                    <Button variant="outline" size="sm" className="gap-2 mt-2">
                      View Full Results
                      <ArrowRight className="size-3.5" />
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <EmptyState
                title={isAdmin ? "No clinical assessments yet" : "No screening results yet"}
                description={
                  isAdmin
                    ? "As an administrator, oversee registered patients, inspect completed sessions, and monitor model performance."
                    : "Complete your first assessment to see your Behavioural Screening Level and module-by-module breakdown."
                }
                action={
                  isAdmin ? (
                    <Link to="/dashboard/admin">
                      <Button className="gap-2">
                        <Shield className="size-4" />
                        Admin Console
                      </Button>
                    </Link>
                  ) : (
                    <Link to="/dashboard/new-assessment">
                      <Button className="gap-2">
                        <Plus className="size-4" />
                        Start Assessment
                      </Button>
                    </Link>
                  )
                }
              />
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Recent Assessments */}
      <motion.div {...fadeIn} transition={{ delay: 0.25 }}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Assessments</CardTitle>
                <CardDescription>Your last completed assessment sessions</CardDescription>
              </div>
              <Link to="/dashboard/assessments">
                <Button variant="ghost" size="sm" className="gap-1">
                  View All
                  <ArrowRight className="size-3.5" />
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {assessmentsLoading ? (
              <div className="flex items-center justify-center py-8 gap-3">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading assessments...</span>
              </div>
            ) : recentAssessments.length > 0 ? (
              <div className="space-y-3">
                {recentAssessments.map((assessment) => {
                  const statusCfg = STATUS_LABELS[assessment.status]
                  const LevelIcon = assessment.screening_level ? LEVEL_ICONS[assessment.screening_level] : null
                  const levelColor = assessment.screening_level ? LEVEL_COLORS[assessment.screening_level] : ''

                  return (
                    <div
                      key={assessment.id}
                      className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex flex-col min-w-0">
                          <p className="text-sm font-medium truncate">
                            {new Date(assessment.started_at).toLocaleDateString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                            })}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            {statusCfg && (
                              <Badge variant="outline" className={cn('text-[0.55rem]', statusCfg.className)}>
                                {statusCfg.label}
                              </Badge>
                            )}
                            <span className="text-[0.65rem] text-muted-foreground">
                              {assessment.modules_completed}/{assessment.modules_total} modules
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        {LevelIcon && assessment.screening_level && (
                          <div className="flex items-center gap-1">
                            <LevelIcon className={cn('size-3.5', levelColor)} />
                            <span className={cn('text-xs font-semibold', levelColor)}>
                              {assessment.screening_level}
                            </span>
                          </div>
                        )}
                        {assessment.status === 'completed' && (
                          <Link
                            to={`/dashboard/results/${assessment.id}`}
                            className="text-xs text-primary hover:underline font-medium"
                          >
                            Results →
                          </Link>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                title="No assessments yet"
                description="Your completed assessments will appear here with status, date, and screening results."
              />
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
