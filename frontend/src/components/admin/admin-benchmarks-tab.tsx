// ===========================================================
// NeuroScreen — Admin Cognitive Lab Surveillance Tab
// ===========================================================
// Administrative view of all patient Cognitive Lab benchmarks.
// Displays platform-wide reflex/memory metrics, patient leaderboard,
// and detailed patient dossiers.
// ===========================================================

import { useState, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Brain,
  Search,
  Loader2,
  Activity,
  ExternalLink,
  Users,
  Clock,
} from 'lucide-react'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState } from '@/components/ui/empty-state'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { benchmarkApi } from '@/services/benchmark-api'
import { cn } from '@/lib/utils'

export function AdminBenchmarksTab() {
  const [search, setSearch] = useState('')
  const [, setSearchParams] = useSearchParams()

  // Fetch platform-wide overview
  const { data: overview, isLoading: overviewLoading } = useQuery({
    queryKey: ['admin', 'benchmarks', 'overview'],
    queryFn: () => benchmarkApi.getAdminOverview(),
    staleTime: 15 * 1000,
  })

  // Fetch all patient profiles with benchmarks
  const { data: profiles, isLoading: profilesLoading } = useQuery({
    queryKey: ['admin', 'benchmarks', 'users'],
    queryFn: () => benchmarkApi.getAdminUsers(),
    staleTime: 15 * 1000,
  })

  const navigateToPatient = (userId: string) => {
    setSearchParams({ tab: 'users', userId })
  }

  const filteredProfiles = useMemo(() => {
    if (!profiles) return []
    const q = search.toLowerCase().trim()
    if (!q) return profiles
    return profiles.filter((p) => {
      const matchName = p.full_name?.toLowerCase().includes(q)
      const matchEmail = p.email?.toLowerCase().includes(q)
      const matchId = p.user_id?.toLowerCase().includes(q)
      return matchName || matchEmail || matchId
    })
  }, [profiles, search])

  if (overviewLoading && profilesLoading) {
    return (
      <div className="flex items-center justify-center py-16 gap-3">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading Cognitive Lab surveillance data...</span>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Operational KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          title="Total Lab Tests"
          value={String(overview?.total_attempts ?? 0)}
          icon={Activity}
          subtitle="Tests completed by patients"
        />
        <StatCard
          title="Patients Tested"
          value={String(overview?.active_users_count ?? 0)}
          icon={Users}
          subtitle="Active benchmark profiles"
        />
        <StatCard
          title="Latest Activity"
          value={
            overview?.recent_activity?.[0]
              ? new Date(overview.recent_activity[0].created_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'
          }
          icon={Clock}
          subtitle={
            overview?.recent_activity?.[0]
              ? `${overview.recent_activity[0].test_type.toUpperCase()} test completed`
              : 'No attempts recorded'
          }
        />
      </div>

      {/* Patient Benchmark Table */}
      <Card className="shadow-xs border border-border/60">
        <CardHeader className="p-4 sm:p-6 pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                <Brain className="size-5 text-purple-500" />
                <span>Patient Benchmark Leaderboard & Surveillance</span>
              </CardTitle>
              <CardDescription className="text-xs">
                Inspect psychomotor reflexes, memory scores, and longitudinal practice data.
              </CardDescription>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Search patient..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {filteredProfiles.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow className="text-xs">
                  <TableHead>Patient</TableHead>
                  <TableHead>Neurological Status</TableHead>
                  <TableHead className="text-center">Tests Taken</TableHead>
                  <TableHead className="text-center">Reaction PB</TableHead>
                  <TableHead className="text-center">Verbal PB</TableHead>
                  <TableHead className="text-center">Number PB</TableHead>
                  <TableHead className="text-center">Visual PB</TableHead>
                  <TableHead className="text-center">Aim PB</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProfiles.map((p) => {
                  const reactionBest = p.bests.reaction?.best_score
                  const verbalBest = p.bests.verbal?.best_score
                  const numberBest = p.bests.number?.best_score
                  const visualBest = p.bests.visual?.best_score
                  const aimBest = p.bests.aim?.best_score
                  const clin = p.clinical_summary

                  return (
                    <TableRow
                      key={p.user_id}
                      onClick={() => navigateToPatient(p.user_id)}
                      className="text-xs hover:bg-muted/40 cursor-pointer"
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className="flex size-7 items-center justify-center rounded-full bg-purple-500/10 text-purple-600 font-bold text-xs">
                            {p.full_name?.charAt(0)?.toUpperCase() || 'P'}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{p.full_name || 'Patient'}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {p.email || p.user_id.slice(0, 10) + '...'}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell>
                        {clin ? (
                          <div className="space-y-0.5">
                            <Badge
                              variant="outline"
                              className={cn(
                                'text-[10px] font-semibold px-2 py-0.5 flex items-center gap-1 w-fit',
                                clin.overall_stability === 'DECLINE_ALERT'
                                  ? 'border-rose-500/40 text-rose-600 bg-rose-500/10'
                                  : clin.overall_stability === 'MILD_FLUCTUATION'
                                  ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                                  : 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                              )}
                            >
                              <span
                                className={cn(
                                  'size-1.5 rounded-full',
                                  clin.overall_stability === 'DECLINE_ALERT'
                                    ? 'bg-rose-500'
                                    : clin.overall_stability === 'MILD_FLUCTUATION'
                                    ? 'bg-amber-500'
                                    : 'bg-emerald-500'
                                )}
                              />
                              {clin.overall_stability === 'DECLINE_ALERT'
                                ? 'Decline Alert'
                                : clin.overall_stability === 'MILD_FLUCTUATION'
                                ? 'Mild Fluctuation'
                                : 'Stable Baseline'}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono block">
                              Score: {clin.composite_cognitive_index}/100
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>

                      <TableCell className="text-center font-bold">
                        {p.total_tests_taken}
                      </TableCell>

                      <TableCell className="text-center">
                        {reactionBest != null ? (
                          <Badge variant="outline" className={cn(
                            'text-[11px] font-mono px-2 py-0.5',
                            reactionBest < 250 ? 'border-emerald-500/40 text-emerald-600 bg-emerald-500/5' :
                            reactionBest < 380 ? 'border-amber-500/40 text-amber-600 bg-amber-500/5' :
                            'border-rose-500/40 text-rose-600 bg-rose-500/5'
                          )}>
                            {reactionBest} ms
                          </Badge>
                        ) : '—'}
                      </TableCell>

                      <TableCell className="text-center font-mono">
                        {verbalBest != null ? `${verbalBest} words` : '—'}
                      </TableCell>

                      <TableCell className="text-center font-mono">
                        {numberBest != null ? `${numberBest} digits` : '—'}
                      </TableCell>

                      <TableCell className="text-center font-mono">
                        {visualBest != null ? `Lvl ${visualBest}` : '—'}
                      </TableCell>

                      <TableCell className="text-center font-mono">
                        {aimBest != null ? `${aimBest} ms` : '—'}
                      </TableCell>

                      <TableCell className="text-muted-foreground">
                        {p.last_active
                          ? new Date(p.last_active).toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                            })
                          : '—'}
                      </TableCell>

                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation()
                            navigateToPatient(p.user_id)
                          }}
                          className="h-7 px-2.5 text-xs text-primary gap-1"
                        >
                          <span>Dossier</span>
                          <ExternalLink className="size-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-8">
              <EmptyState
                icon={Brain}
                title="No Benchmark Records Yet"
                description="When patients play Cognitive Lab tests, their reflexes and memory records will appear here."
              />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
