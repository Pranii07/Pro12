// ===========================================================
// NeuroScreen — Assessment History Card
// ===========================================================
// A single assessment row card for the history page.
// Shows date, status badge, modules completed, screening
// level badge, and a "View Results" action link.
// ===========================================================

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Calendar,
  Layers,
  ArrowRight,
  Shield,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ScreeningLevel } from '@/types/database'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  completed: { label: 'Completed', className: 'bg-success/10 text-success border-success/30' },
  in_progress: { label: 'In Progress', className: 'bg-primary/10 text-primary border-primary/30' },
  abandoned: { label: 'Abandoned', className: 'bg-muted text-muted-foreground border-border' },
}

interface AssessmentHistoryCardProps {
  id: string
  status: 'in_progress' | 'completed' | 'abandoned'
  language: string
  startedAt: string
  completedAt: string | null
  modulesCompleted: number
  modulesTotal: number
  screeningLevel: ScreeningLevel | null
  index?: number
}

const LEVEL_CONFIG: Record<string, {
  label: string
  icon: typeof Shield
  color: string
  bgColor: string
}> = {
  LOW: {
    label: 'Low',
    icon: ShieldCheck,
    color: 'text-[var(--color-level-low)]',
    bgColor: 'bg-[var(--color-level-low)]/10',
  },
  MODERATE: {
    label: 'Moderate',
    icon: Shield,
    color: 'text-[var(--color-level-moderate)]',
    bgColor: 'bg-[var(--color-level-moderate)]/10',
  },
  HIGH: {
    label: 'High',
    icon: ShieldAlert,
    color: 'text-[var(--color-level-high)]',
    bgColor: 'bg-[var(--color-level-high)]/10',
  },
}

export function AssessmentHistoryCard({
  id,
  status,
  language,
  startedAt,
  completedAt,
  modulesCompleted,
  modulesTotal,
  screeningLevel,
  index = 0,
}: AssessmentHistoryCardProps) {
  const levelConfig = screeningLevel ? LEVEL_CONFIG[screeningLevel] : null
  const LevelIcon = levelConfig?.icon ?? Shield
  const displayDate = completedAt || startedAt

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: 0.05 * index }}
    >
      <Card className="group transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/20">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Date + Status */}
            <div className="flex items-center gap-4 min-w-0">
              {/* Date icon */}
              <div className="hidden sm:flex shrink-0 size-10 items-center justify-center rounded-xl bg-muted">
                <Calendar className="size-4 text-muted-foreground" />
              </div>

              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {new Date(displayDate).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {new Date(displayDate).toLocaleTimeString('en-US', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className={cn('text-[0.6rem]', STATUS_CONFIG[status]?.className)}>
                    {STATUS_CONFIG[status]?.label ?? status}
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Layers className="size-3" />
                    {modulesCompleted}/{modulesTotal} modules
                  </span>
                  <Badge variant="outline" className="text-[0.6rem] uppercase">
                    {language}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Right: Screening Level + Action */}
            <div className="flex items-center gap-3 shrink-0">
              {levelConfig && screeningLevel ? (
                <div className={cn(
                  'flex items-center gap-1.5 rounded-full px-3 py-1.5',
                  levelConfig.bgColor,
                )}>
                  <LevelIcon className={cn('size-3.5', levelConfig.color)} />
                  <span className={cn('text-xs font-semibold', levelConfig.color)}>
                    {levelConfig.label}
                  </span>
                </div>
              ) : status === 'completed' ? (
                <Badge variant="secondary" className="text-[0.6rem]">
                  Awaiting prediction
                </Badge>
              ) : null}

              {status === 'completed' && (
                <Link
                  to={`/dashboard/results/${id}`}
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline transition-colors"
                >
                  View Results
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" />
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )
}
