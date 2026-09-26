// ===========================================================
// NeuroScreen — Distribution Chart
// ===========================================================
// Horizontal bar chart showing model screening distribution
// across LOW / MODERATE / HIGH levels.
//
// Never called "probability" — this is the model's output
// distribution for behavioural screening levels.
// ===========================================================

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'
import type { ScreeningLevel } from '@/types/database'

interface DistributionChartProps {
  distribution: Record<ScreeningLevel, number>
  className?: string
}

const LEVEL_BARS: { key: ScreeningLevel; label: string; color: string; bgColor: string }[] = [
  { key: 'LOW', label: 'Low', color: 'bg-[var(--color-level-low)]', bgColor: 'bg-[var(--color-level-low)]/15' },
  { key: 'MODERATE', label: 'Moderate', color: 'bg-[var(--color-level-moderate)]', bgColor: 'bg-[var(--color-level-moderate)]/15' },
  { key: 'HIGH', label: 'High', color: 'bg-[var(--color-level-high)]', bgColor: 'bg-[var(--color-level-high)]/15' },
]

export function DistributionChart({ distribution, className }: DistributionChartProps) {
  const maxValue = Math.max(...Object.values(distribution), 0.01)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4 text-primary" />
          Model Screening Distribution
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Distribution of model output across screening levels (not probability)
        </p>
      </CardHeader>
      <CardContent className="space-y-4 pt-2">
        {LEVEL_BARS.map(({ key, label, color, bgColor }, index) => {
          const value = distribution[key] ?? 0
          const percentage = (value * 100).toFixed(1)
          const barWidth = (value / maxValue) * 100

          return (
            <motion.div
              key={key}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.1, duration: 0.3 }}
              className="space-y-1.5"
            >
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">{label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {percentage}%
                </span>
              </div>
              <div className={cn('h-3 w-full rounded-full overflow-hidden', bgColor)}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ delay: 0.5 + index * 0.1, duration: 0.8, ease: 'easeOut' }}
                  className={cn('h-full rounded-full', color)}
                />
              </div>
            </motion.div>
          )
        })}
      </CardContent>
    </Card>
  )
}
