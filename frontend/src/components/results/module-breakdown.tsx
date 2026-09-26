// ===========================================================
// NeuroScreen — Module Breakdown Cards
// ===========================================================
// Per-module detail cards showing key features, score,
// and completion status.
// ===========================================================

import { motion } from 'framer-motion'
import {
  Keyboard,
  Brain,
  Timer,
  Mic,
  Camera,
  CheckCircle2,
  SkipForward,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ModuleType } from '@/types/database'

interface ModuleData {
  type: ModuleType
  completed: boolean
  score: number | null
  features: Record<string, unknown>
}

interface ModuleBreakdownProps {
  modules: ModuleData[]
  className?: string
}

const MODULE_ICONS: Record<ModuleType, typeof Keyboard> = {
  typing: Keyboard,
  memory: Brain,
  reaction: Timer,
  speech: Mic,
  facial: Camera,
}

const MODULE_LABELS: Record<ModuleType, string> = {
  typing: 'Typing Analysis',
  memory: 'Memory Tests',
  reaction: 'Reaction Time',
  speech: 'Speech Analysis',
  facial: 'Facial Analysis',
}

const MODULE_COLORS: Record<ModuleType, { bg: string; text: string; border: string }> = {
  typing: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  memory: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  reaction: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  speech: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  facial: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
}

// Feature display configuration per module
const FEATURE_DISPLAY: Record<ModuleType, { key: string; label: string; unit: string; direction: 'up' | 'down' | 'neutral' }[]> = {
  typing: [
    { key: 'wpm', label: 'Words/Min', unit: 'WPM', direction: 'up' },
    { key: 'accuracy', label: 'Accuracy', unit: '%', direction: 'up' },
    { key: 'avg_hold_time_ms', label: 'Avg Hold', unit: 'ms', direction: 'down' },
    { key: 'avg_flight_time_ms', label: 'Avg Flight', unit: 'ms', direction: 'down' },
  ],
  memory: [
    { key: 'word_recall_accuracy', label: 'Word Recall', unit: '%', direction: 'up' },
    { key: 'pattern_accuracy', label: 'Patterns', unit: '%', direction: 'up' },
    { key: 'avg_response_time_ms', label: 'Avg Response', unit: 'ms', direction: 'down' },
  ],
  reaction: [
    { key: 'avg_reaction_time_ms', label: 'Avg Time', unit: 'ms', direction: 'down' },
    { key: 'fastest_reaction_ms', label: 'Fastest', unit: 'ms', direction: 'down' },
    { key: 'false_start_count', label: 'False Starts', unit: '', direction: 'down' },
  ],
  speech: [
    { key: 'speech_rate_wpm', label: 'Speech Rate', unit: 'WPM', direction: 'up' },
    { key: 'fluency_score', label: 'Fluency', unit: '%', direction: 'up' },
    { key: 'avg_pause_duration_ms', label: 'Avg Pause', unit: 'ms', direction: 'down' },
  ],
  facial: [
    { key: 'blink_rate_per_min', label: 'Blink Rate', unit: '/min', direction: 'neutral' },
    { key: 'orientation_stability', label: 'Stability', unit: '%', direction: 'up' },
    { key: 'attention_score', label: 'Attention', unit: '%', direction: 'up' },
  ],
}

function formatFeatureValue(value: unknown, unit: string): string {
  if (value == null) return '—'
  const num = Number(value)
  if (isNaN(num)) return String(value)

  // If value is 0-1 and unit is %, display as percentage
  if (unit === '%' && num <= 1) return `${(num * 100).toFixed(0)}%`
  if (unit === '%') return `${num.toFixed(0)}%`
  if (unit === 'ms') return `${num.toFixed(0)}ms`
  if (unit === 'WPM' || unit === '/min') return `${num.toFixed(0)} ${unit}`
  return num.toFixed(1)
}

function DirectionIcon({ direction }: { direction: 'up' | 'down' | 'neutral' }) {
  switch (direction) {
    case 'up': return <TrendingUp className="size-3 text-success" />
    case 'down': return <TrendingDown className="size-3 text-destructive" />
    case 'neutral': return <Minus className="size-3 text-muted-foreground" />
  }
}

export function ModuleBreakdown({ modules, className }: ModuleBreakdownProps) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-3', className)}>
      {modules.map((mod, index) => {
        const Icon = MODULE_ICONS[mod.type]
        const colors = MODULE_COLORS[mod.type]
        const features = FEATURE_DISPLAY[mod.type] || []

        return (
          <motion.div
            key={mod.type}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.08, duration: 0.3 }}
          >
            <Card className={cn(
              'h-full transition-all duration-200',
              mod.completed ? 'hover:shadow-md hover:-translate-y-0.5' : 'opacity-60'
            )}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={cn('rounded-lg p-2', colors.bg)}>
                      <Icon className={cn('size-4', colors.text)} />
                    </div>
                    <CardTitle className="text-sm font-medium">
                      {MODULE_LABELS[mod.type]}
                    </CardTitle>
                  </div>

                  {mod.completed ? (
                    <Badge variant="default" className="bg-success text-success-foreground text-[0.6rem] gap-1">
                      <CheckCircle2 className="size-3" />
                      Done
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[0.6rem] gap-1">
                      <SkipForward className="size-3" />
                      Skipped
                    </Badge>
                  )}
                </div>

                {/* Module score */}
                {mod.completed && mod.score != null && (
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className={cn('text-2xl font-bold', colors.text)}>
                      {Math.round(mod.score)}
                    </span>
                    <span className="text-xs text-muted-foreground">/100</span>
                  </div>
                )}
              </CardHeader>

              {mod.completed && (
                <CardContent className="pt-0">
                  <div className="space-y-2 border-t pt-3">
                    {features.map(({ key, label, unit, direction }) => {
                      const value = mod.features[key]
                      return (
                        <div key={key} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <DirectionIcon direction={direction} />
                            <span className="text-muted-foreground">{label}</span>
                          </div>
                          <span className="font-mono font-medium">
                            {formatFeatureValue(value, unit)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </CardContent>
              )}
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}
