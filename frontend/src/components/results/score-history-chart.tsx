// ===========================================================
// NeuroScreen — Score History Chart
// ===========================================================
// Recharts LineChart showing overall behaviour score across
// past assessments. X-axis: date, Y-axis: score (0-100).
//
// Only displayed if the user has ≥2 assessments with predictions.
//
// Research/Educational Prototype — synthetic data.
// ===========================================================

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Area,
} from 'recharts'
import { motion } from 'framer-motion'
import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ScreeningLevel } from '@/types/database'

interface ScoreHistoryItem {
  date: string
  score: number
  level: ScreeningLevel
  label: string
}

interface ScoreHistoryChartProps {
  history: ScoreHistoryItem[]
  className?: string
}

function getLevelColor(level: ScreeningLevel): string {
  switch (level) {
    case 'LOW': return 'var(--color-level-low, #22c55e)'
    case 'MODERATE': return 'var(--color-level-moderate, #f59e0b)'
    case 'HIGH': return 'var(--color-level-high, #ef4444)'
  }
}

export function ScoreHistoryChart({ history, className }: ScoreHistoryChartProps) {
  if (history.length < 2) return null

  // Find the latest trend
  const latest = history[history.length - 1]
  const previous = history[history.length - 2]
  const trend = latest.score - previous.score
  const trendDirection = trend > 0 ? 'up' : trend < 0 ? 'down' : 'stable'

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4 text-secondary" />
          Score History
        </CardTitle>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Overall behaviour score across your assessments
          </p>
          {trendDirection !== 'stable' && (
            <span className={cn(
              'text-[0.65rem] font-medium px-2 py-0.5 rounded-full',
              trendDirection === 'down' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning',
            )}>
              {trendDirection === 'down' ? '↓' : '↑'} {Math.abs(trend).toFixed(1)}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="h-[250px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={history} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <defs>
                <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                strokeOpacity={0.4}
                vertical={false}
              />
              <XAxis
                dataKey="label"
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                ticks={[0, 25, 50, 75, 100]}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                width={35}
              />
              {/* Reference zones for LOW/MODERATE/HIGH */}
              <ReferenceLine
                y={33}
                stroke="var(--color-level-low, #22c55e)"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
              <ReferenceLine
                y={66}
                stroke="var(--color-level-high, #ef4444)"
                strokeDasharray="3 3"
                strokeOpacity={0.4}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                formatter={(value) => [`${Number(value).toFixed(1)} / 100`, 'Behaviour Score']}
                labelFormatter={(label) => `Assessment: ${String(label)}`}
              />
              <Area
                type="monotone"
                dataKey="score"
                fill="url(#scoreGradient)"
                stroke="none"
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="var(--color-primary)"
                strokeWidth={2.5}
                dot={(props: Record<string, unknown>) => {
                  const { cx, cy, payload } = props as { cx: number; cy: number; payload: ScoreHistoryItem }
                  return (
                    <circle
                      key={`dot-${payload.label}`}
                      cx={cx}
                      cy={cy}
                      r={5}
                      fill={getLevelColor(payload.level)}
                      stroke="var(--color-card)"
                      strokeWidth={2}
                    />
                  )
                }}
                activeDot={{
                  r: 7,
                  fill: 'var(--color-primary)',
                  stroke: 'var(--color-card)',
                  strokeWidth: 2,
                }}
                animationBegin={600}
                animationDuration={1200}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  )
}
