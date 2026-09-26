// ===========================================================
// NeuroScreen — Assessment History Page
// ===========================================================
// Lists past assessments with status, date, modules, screening
// level. Data fetched via TanStack Query with status filters.
// ===========================================================

import { useState } from 'react'
import { motion } from 'framer-motion'
import { History, Plus, Search, Loader2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { Badge } from '@/components/ui/badge'
import { AssessmentHistoryCard } from '@/components/dashboard/assessment-history-card'
import { assessmentApi } from '@/services/assessment-api'
import { cn } from '@/lib/utils'
import type { ScreeningLevel } from '@/types/database'

type StatusFilter = 'all' | 'completed' | 'in_progress'

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'completed', label: 'Completed' },
  { key: 'in_progress', label: 'In Progress' },
]

export function AssessmentsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const { data: assessments, isLoading, error } = useQuery({
    queryKey: ['assessments', statusFilter],
    queryFn: () => assessmentApi.list({
      status: statusFilter === 'all' ? undefined : statusFilter,
      limit: 50,
    }),
    staleTime: 5 * 1000,
    refetchOnMount: 'always',
  })


  // Client-side search filter (by date string)
  const filtered = assessments?.filter((a) => {
    if (!search) return true
    const dateStr = new Date(a.started_at).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
    return dateStr.toLowerCase().includes(search.toLowerCase())
  }) ?? []

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader
          title="Assessment History"
          description="View and manage your past behavioural assessment sessions"
        >
          <Link to="/dashboard/new-assessment">
            <Button className="gap-2" size="sm">
              <Plus className="size-4" />
              New Assessment
            </Button>
          </Link>
        </PageHeader>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search by date..."
                  className="pl-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                {FILTERS.map((f) => (
                  <Badge
                    key={f.key}
                    variant={statusFilter === f.key ? 'default' : 'outline'}
                    className={cn(
                      'cursor-pointer transition-colors',
                      statusFilter === f.key
                        ? 'bg-primary text-primary-foreground'
                        : 'hover:bg-muted'
                    )}
                    onClick={() => setStatusFilter(f.key)}
                  >
                    {f.label}
                  </Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Assessment List */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <History className="size-5 text-secondary" />
              All Assessments
            </h2>
            {!isLoading && assessments && (
              <span className="text-xs text-muted-foreground">
                {filtered.length} of {assessments.length} assessments
              </span>
            )}
          </div>

          {isLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-12 gap-3">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Loading assessments...</span>
              </CardContent>
            </Card>
          ) : error ? (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  title="Unable to load assessments"
                  description="Could not connect to the server. Please try again later."
                />
              </CardContent>
            </Card>
          ) : filtered.length > 0 ? (
            <div className="space-y-2">
              {filtered.map((assessment, index) => (
                <AssessmentHistoryCard
                  key={assessment.id}
                  id={assessment.id}
                  status={assessment.status}
                  language={assessment.language}
                  startedAt={assessment.started_at}
                  completedAt={assessment.completed_at}
                  modulesCompleted={assessment.modules_completed}
                  modulesTotal={assessment.modules_total}
                  screeningLevel={assessment.screening_level as ScreeningLevel | null}
                  index={index}
                />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-8">
                <EmptyState
                  title={search ? 'No matching assessments' : 'No assessments yet'}
                  description={
                    search
                      ? `No assessments found matching "${search}".`
                      : 'Start your first assessment to begin tracking your behavioural patterns over time.'
                  }
                  action={
                    !search ? (
                      <Link to="/dashboard/new-assessment">
                        <Button className="gap-2">
                          <Plus className="size-4" />
                          Start Your First Assessment
                        </Button>
                      </Link>
                    ) : undefined
                  }
                />
              </CardContent>
            </Card>
          )}
        </div>
      </motion.div>
    </div>
  )
}
