// ===========================================================
// NeuroScreen — Patient Detail Dashboard
// ===========================================================
// Full-page clinical dashboard for inspecting an individual patient:
// user identity, assessments, results, graphs, cognitive tests,
// neurological radar, and generated reports.
// ===========================================================

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  User,
  Mail,
  Calendar,
  Shield,
  FileText,
  Brain,
  ClipboardList,
  ExternalLink,
  Download,
  Activity,
  Award,
  Zap,
  Hash,
  Grid2X2,
  Crosshair,
  Loader2,
  Copy,
  Check,
  Stethoscope,
} from 'lucide-react'
import { toast } from 'sonner'

import { adminApi } from '@/services/admin-api'
import { benchmarkApi } from '@/services/benchmark-api'
import { CognitiveClinicalSection } from './cognitive-clinical-section'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'

interface PatientDetailDashboardProps {
  userId: string
  onBack: () => void
  onEditUser?: () => void
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' },
  in_progress: { label: 'In Progress', className: 'bg-blue-500/10 text-blue-600 border-blue-500/30' },
  abandoned: { label: 'Abandoned', className: 'bg-muted text-muted-foreground border-border' },
}

export function PatientDetailDashboard({
  userId,
  onBack,
  onEditUser,
}: PatientDetailDashboardProps) {
  const [copiedId, setCopiedId] = useState(false)
  const [activeTab, setActiveTab] = useState('cognitive')

  // 1. Fetch user profile, assessments, and reports
  const {
    data: userDossier,
    isLoading: dossierLoading,
    error: dossierError,
  } = useQuery({
    queryKey: ['admin', 'user-dossier', userId],
    queryFn: () => adminApi.getUserDetails(userId),
    enabled: !!userId,
  })

  // 2. Fetch full cognitive lab benchmark telemetry & clinical summary
  const {
    data: benchmarkData,
    isLoading: benchmarkLoading,
  } = useQuery({
    queryKey: ['admin', 'benchmarks', 'user', userId],
    queryFn: () => benchmarkApi.getAdminUserDossier(userId),
    enabled: !!userId,
  })

  const handleCopyId = () => {
    navigator.clipboard.writeText(userId)
    setCopiedId(true)
    toast.success('User ID copied to clipboard')
    setTimeout(() => setCopiedId(false), 2000)
  }

  if (dossierLoading || benchmarkLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3">
        <Loader2 className="size-7 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground font-medium">
          Compiling comprehensive patient clinical dashboard...
        </span>
      </div>
    )
  }

  if (dossierError || !userDossier) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack} className="gap-2 text-xs">
          <ArrowLeft className="size-4" />
          Back to User Directory
        </Button>
        <div className="p-8 border rounded-xl bg-destructive/5 text-destructive text-center">
          <p className="font-semibold text-sm">Failed to load patient data</p>
          <p className="text-xs text-muted-foreground mt-1">
            Could not retrieve profile records for ID: {userId}
          </p>
        </div>
      </div>
    )
  }

  const profile = userDossier.profile
  const assessments = userDossier.assessments || []
  const reports = userDossier.reports || []
  const completedAssessments = assessments.filter((a) => a.status === 'completed')

  // Find latest screening level if available
  let latestScreeningLevel: string | null = null
  for (const a of assessments) {
    if (a.predictions) {
      const pred = Array.isArray(a.predictions) ? a.predictions[0] : a.predictions
      if (pred && (pred.screening_level || pred.risk_level)) {
        latestScreeningLevel = String(pred.screening_level || pred.risk_level)
        break
      }
    }
  }

  const clinSummary = benchmarkData?.clinical_summary

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Back Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            <span>Back to Users</span>
          </Button>
          <span className="text-muted-foreground/40">/</span>
          <span className="text-xs font-semibold text-foreground truncate max-w-xs">
            {profile.full_name || 'Patient Overview'}
          </span>
        </div>

        {onEditUser && (
          <Button
            variant="outline"
            size="sm"
            onClick={onEditUser}
            className="h-8 text-xs gap-1.5 self-start sm:self-auto"
          >
            <User className="size-3.5" />
            <span>Edit Account</span>
          </Button>
        )}
      </div>

      {/* Patient Identity Header Card */}
      <Card className="border border-border/80 bg-card/90 shadow-xs">
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
            {/* Identity Info */}
            <div className="flex items-start sm:items-center gap-4">
              <div className="size-14 sm:size-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center font-bold text-xl sm:text-2xl text-purple-600 shrink-0">
                {profile.full_name ? profile.full_name.slice(0, 2).toUpperCase() : 'PT'}
              </div>

              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                    {profile.full_name || 'Unnamed Patient'}
                  </h2>
                  <Badge
                    variant={profile.role === 'ADMIN' ? 'default' : 'secondary'}
                    className={cn(
                      'text-[10px] uppercase font-mono px-2 py-0.5',
                      profile.role === 'ADMIN' && 'bg-purple-600 text-white'
                    )}
                  >
                    {profile.role === 'ADMIN' && <Shield className="mr-1 size-2.5" />}
                    {profile.role}
                  </Badge>
                  <Badge variant="outline" className="text-[10px] uppercase font-mono px-2 py-0.5">
                    {profile.language_preference}
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  {profile.email && (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-3.5" />
                      <span>{profile.email}</span>
                    </span>
                  )}
                  <span className="flex items-center gap-1.5 font-mono">
                    <span>ID: {profile.id.slice(0, 12)}...</span>
                    <button
                      type="button"
                      onClick={handleCopyId}
                      className="hover:text-foreground text-muted-foreground transition-colors p-0.5"
                      title="Copy full User ID"
                    >
                      {copiedId ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                    </button>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    <span>
                      Registered:{' '}
                      {new Date(profile.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Status Pillbox */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-border/40">
              {clinSummary && (
                <div className="px-3.5 py-2 rounded-xl border bg-muted/20">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    Neurological Status
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        clinSummary.overall_stability === 'DECLINE_ALERT'
                          ? 'bg-rose-500'
                          : clinSummary.overall_stability === 'MILD_FLUCTUATION'
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      )}
                    />
                    <span className="font-semibold text-xs text-foreground">
                      {clinSummary.overall_stability === 'DECLINE_ALERT'
                        ? 'Decline Alert'
                        : clinSummary.overall_stability === 'MILD_FLUCTUATION'
                        ? 'Mild Fluctuation'
                        : 'Stable Baseline'}
                    </span>
                  </div>
                </div>
              )}

              {latestScreeningLevel && (
                <div className="px-3.5 py-2 rounded-xl border bg-muted/20">
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                    Clinical Screening Risk
                  </span>
                  <span
                    className={cn(
                      'font-semibold text-xs mt-0.5 block',
                      latestScreeningLevel.toUpperCase() === 'HIGH'
                        ? 'text-rose-500'
                        : latestScreeningLevel.toUpperCase() === 'MODERATE'
                        ? 'text-amber-500'
                        : 'text-emerald-500'
                    )}
                  >
                    {latestScreeningLevel.toUpperCase()} RISK
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Top Clinical & Telemetry KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Clinical Assessments"
          value={String(assessments.length)}
          icon={ClipboardList}
          subtitle={`${completedAssessments.length} completed sessions`}
        />
        <StatCard
          title="Cognitive Lab Tests"
          value={String(benchmarkData?.total_tests_taken ?? 0)}
          icon={Brain}
          subtitle="Reflex & memory trials"
        />
        <StatCard
          title="Cognitive Composite"
          value={clinSummary ? `${clinSummary.composite_cognitive_index} / 100` : '—'}
          icon={Activity}
          subtitle="Standardized domain index"
        />
        <StatCard
          title="Clinical Reports"
          value={String(reports.length)}
          icon={FileText}
          subtitle="Generated PDF reports"
        />
      </div>

      {/* Main Tabs: Cognitive Telemetry, Assessments, Reports */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="inline-flex flex-wrap sm:flex-nowrap p-1 bg-muted/50 border border-border/50 rounded-xl">
          <TabsTrigger value="cognitive" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium">
            <Brain className="size-4 text-purple-500" />
            <span>Cognitive Lab & Neurological Analysis</span>
          </TabsTrigger>
          <TabsTrigger value="assessments" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium">
            <ClipboardList className="size-4 text-blue-500" />
            <span>Assessments & Results ({assessments.length})</span>
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2 px-4 py-2 text-xs sm:text-sm font-medium">
            <FileText className="size-4 text-emerald-500" />
            <span>Clinical Reports ({reports.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* ================= TAB 1: COGNITIVE LAB & NEUROLOGY ================= */}
        <TabsContent value="cognitive" className="space-y-6">
          {benchmarkData && benchmarkData.total_tests_taken > 0 ? (
            <div className="space-y-6">
              {/* Personal Best Benchmarks Cards */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Award className="size-3.5 text-amber-500" />
                    <span>Personal Best Benchmarks (6 Tests)</span>
                  </h4>
                  <span className="text-xs text-muted-foreground">
                    Total Attempts: <strong>{benchmarkData.total_tests_taken}</strong>
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {/* Reaction Time */}
                  <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                    <div className="flex items-center justify-between text-xs text-blue-600 font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Zap className="size-3" />
                        Reaction
                      </span>
                      <span className="text-[10px] text-muted-foreground">Reflex</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {benchmarkData.bests.reaction ? benchmarkData.bests.reaction.best_score : '—'}
                      </span>
                      {benchmarkData.bests.reaction && <span className="text-[10px] text-muted-foreground">ms</span>}
                    </div>
                  </div>

                  {/* Verbal Memory */}
                  <div className="p-3.5 rounded-xl border border-purple-500/20 bg-purple-500/5">
                    <div className="flex items-center justify-between text-xs text-purple-600 font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Brain className="size-3" />
                        Verbal
                      </span>
                      <span className="text-[10px] text-muted-foreground">Memory</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {benchmarkData.bests.verbal ? benchmarkData.bests.verbal.best_score : '—'}
                      </span>
                      {benchmarkData.bests.verbal && <span className="text-[10px] text-muted-foreground">words</span>}
                    </div>
                  </div>

                  {/* Digit Span */}
                  <div className="p-3.5 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                    <div className="flex items-center justify-between text-xs text-indigo-600 font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Hash className="size-3" />
                        Digit Span
                      </span>
                      <span className="text-[10px] text-muted-foreground">Span</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {benchmarkData.bests.number ? benchmarkData.bests.number.best_score : '—'}
                      </span>
                      {benchmarkData.bests.number && <span className="text-[10px] text-muted-foreground">digits</span>}
                    </div>
                  </div>

                  {/* Visual Grid */}
                  <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center justify-between text-xs text-emerald-600 font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Grid2X2 className="size-3" />
                        Visual Grid
                      </span>
                      <span className="text-[10px] text-muted-foreground">Spatial</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {benchmarkData.bests.visual ? `Lvl ${benchmarkData.bests.visual.best_score}` : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Chimp Test */}
                  <div className="p-3.5 rounded-xl border border-amber-500/20 bg-amber-500/5">
                    <div className="flex items-center justify-between text-xs text-amber-600 font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Award className="size-3" />
                        Chimp
                      </span>
                      <span className="text-[10px] text-muted-foreground">Iconic</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {benchmarkData.bests.chimp ? benchmarkData.bests.chimp.best_score : '—'}
                      </span>
                      {benchmarkData.bests.chimp && <span className="text-[10px] text-muted-foreground">nums</span>}
                    </div>
                  </div>

                  {/* Aim Trainer */}
                  <div className="p-3.5 rounded-xl border border-rose-500/20 bg-rose-500/5">
                    <div className="flex items-center justify-between text-xs text-rose-600 font-medium mb-1">
                      <span className="flex items-center gap-1">
                        <Crosshair className="size-3" />
                        Aim
                      </span>
                      <span className="text-[10px] text-muted-foreground">Motor</span>
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-xl font-bold font-mono text-foreground">
                        {benchmarkData.bests.aim ? benchmarkData.bests.aim.best_score : '—'}
                      </span>
                      {benchmarkData.bests.aim && <span className="text-[10px] text-muted-foreground">ms</span>}
                    </div>
                  </div>
                </div>
              </div>

              {/* Full Neurological Telemetry Radar & Brain Network Analysis */}
              <Card className="border border-border/70 shadow-xs">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Stethoscope className="size-4 text-primary" />
                    <span>Neurological Domain Mapping & Longitudinal Telemetry</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Continuous psychomotor reflex latency, working memory capacity, and target condition risk analysis.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CognitiveClinicalSection profile={benchmarkData} />
                </CardContent>
              </Card>

              {/* Recent Test Attempts Log */}
              <Card className="border border-border/70 shadow-xs">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-sm font-bold flex items-center gap-2">
                        <Activity className="size-4 text-primary" />
                        <span>Recent Test Attempts ({benchmarkData.recent_attempts.length})</span>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Complete chronological attempt telemetry for this patient
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {benchmarkData.recent_attempts.length > 0 ? (
                    <div className="divide-y divide-border/60">
                      {benchmarkData.recent_attempts.map((att) => {
                        const badgeColorMap: Record<string, string> = {
                          reaction: 'border-blue-500/30 text-blue-600 bg-blue-500/10',
                          verbal: 'border-purple-500/30 text-purple-600 bg-purple-500/10',
                          number: 'border-indigo-500/30 text-indigo-600 bg-indigo-500/10',
                          visual: 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10',
                          chimp: 'border-amber-500/30 text-amber-600 bg-amber-500/10',
                          aim: 'border-rose-500/30 text-rose-600 bg-rose-500/10',
                        }
                        const badgeClass = badgeColorMap[att.test_type] || 'border-border'

                        return (
                          <div
                            key={att.id}
                            className="flex items-center justify-between px-5 py-3.5 hover:bg-muted/20 transition-colors text-xs"
                          >
                            <div className="flex items-center gap-3">
                              <Badge
                                variant="outline"
                                className={cn('capitalize text-[11px] font-semibold px-2.5 py-0.5', badgeClass)}
                              >
                                {att.test_type}
                              </Badge>
                              <span className="font-mono font-bold text-sm text-foreground">
                                {att.score}{' '}
                                <span className="text-xs font-normal text-muted-foreground">{att.unit}</span>
                              </span>
                              {att.is_best && (
                                <Badge className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-2 py-0.5 font-medium flex items-center gap-1">
                                  <Award className="size-2.5" />
                                  Personal Best
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground font-mono">
                              {new Date(att.created_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="p-6 text-center text-xs text-muted-foreground italic">
                      No test attempts recorded.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border border-border/70">
              <CardContent className="p-8">
                <EmptyState
                  icon={Brain}
                  title="No Cognitive Lab Telemetry Yet"
                  description="When this patient practices Cognitive Lab reflex or memory tests, full 6-axis neurological analysis will appear here."
                />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ================= TAB 2: ASSESSMENTS & RESULTS ================= */}
        <TabsContent value="assessments" className="space-y-4">
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ClipboardList className="size-4 text-blue-500" />
                    <span>Clinical Assessment Sessions ({assessments.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Multi-modal behavioral screenings including speech acoustic, facial kinematic, typing, and memory modules.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {assessments.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {assessments.map((a) => {
                    const statusCfg = STATUS_CONFIG[a.status]
                    const pred = a.predictions
                      ? Array.isArray(a.predictions)
                        ? a.predictions[0]
                        : a.predictions
                      : null
                    const screeningLevel = pred && (pred.screening_level || pred.risk_level)
                      ? String(pred.screening_level || pred.risk_level)
                      : null

                    return (
                      <div
                        key={a.id}
                        className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 hover:bg-muted/20 transition-colors gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">
                              Session ID: {a.id.slice(0, 12)}...
                            </span>
                            {statusCfg && (
                              <Badge
                                variant="outline"
                                className={cn('text-[10px] px-2 py-0 font-medium', statusCfg.className)}
                              >
                                {statusCfg.label}
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] uppercase font-mono px-1.5 py-0">
                              {String(a.language)}
                            </Badge>
                            {!!screeningLevel && (
                              <Badge
                                variant="outline"
                                className={cn(
                                  'text-[10px] font-bold px-2 py-0',
                                  String(screeningLevel).toUpperCase() === 'HIGH'
                                    ? 'border-rose-500/40 text-rose-600 bg-rose-500/10'
                                    : String(screeningLevel).toUpperCase() === 'MODERATE'
                                    ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                                    : 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                                )}
                              >
                                {String(screeningLevel).toUpperCase()} RISK
                              </Badge>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                            <span>Started: {new Date(a.started_at).toLocaleString()}</span>
                            {a.completed_at && (
                              <span>Completed: {new Date(a.completed_at).toLocaleString()}</span>
                            )}
                            {a.module_results && (
                              <span className="text-primary font-medium">
                                {a.module_results.length} modules recorded
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Link to={`/dashboard/results/${a.id}`}>
                            <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary/90 hover:bg-primary">
                              <ExternalLink className="size-3.5" />
                              <span>View Full Results</span>
                            </Button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={ClipboardList}
                    title="No Assessments Logged"
                    description="This patient has not yet completed a clinical screening assessment session."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================= TAB 3: CLINICAL REPORTS ================= */}
        <TabsContent value="reports" className="space-y-4">
          <Card className="border border-border/70 shadow-xs">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <FileText className="size-4 text-emerald-500" />
                    <span>Generated Clinical Screening Reports ({reports.length})</span>
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Official multi-modal PDF clinical reports generated for neurologists and patient records.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {reports.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {reports.map((r) => (
                    <div
                      key={r.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 sm:p-5 hover:bg-muted/20 transition-colors gap-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="size-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shrink-0">
                          <FileText className="size-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-xs text-foreground">{r.file_name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            Generated: {new Date(r.generated_at).toLocaleString()} •{' '}
                            {Math.round((r.file_size_bytes || 0) / 1024)} KB
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Link to={`/dashboard/results/${r.assessment_id}`}>
                          <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-primary">
                            <Download className="size-3.5" />
                            <span>View / Download PDF</span>
                          </Button>
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={FileText}
                    title="No Reports Generated Yet"
                    description="When assessments are completed, downloadable clinical reports will appear here."
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
