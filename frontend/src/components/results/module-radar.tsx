// ===========================================================
// NeuroScreen — Module Radar Chart
// ===========================================================
// Radar chart showing normalised module scores across
// completed assessment modules. Uses Recharts RadarChart.
// ===========================================================

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { motion } from 'framer-motion'
import { Radar as RadarIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ModuleType } from '@/types/database'
import { MODULE_INFO } from '@/types/database'

interface ModuleRadarProps {
  moduleScores: { type: ModuleType; score: number | null; completed: boolean }[]
  className?: string
}

export function ModuleRadar({ moduleScores, className }: ModuleRadarProps) {
  const data = moduleScores.map((mod) => ({
    module: MODULE_INFO[mod.type]?.name.replace(' Analysis', '').replace(' Tests', '').replace(' Time', '') || mod.type,
    score: mod.completed ? (mod.score ?? 0) : 0,
    fullMark: 100,
    completed: mod.completed,
  }))

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <RadarIcon className="size-4 text-secondary" />
          Module Performance
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Scores across completed assessment modules (0-100)
        </p>
      </CardHeader>
      <CardContent>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className="h-[280px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
              <PolarGrid
                stroke="var(--color-border)"
                strokeOpacity={0.5}
              />
              <PolarAngleAxis
                dataKey="module"
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
              />
              <PolarRadiusAxis
                angle={90}
                domain={[0, 100]}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 9 }}
                tickCount={5}
              />
              <Radar
                name="Score"
                dataKey="score"
                stroke="var(--color-primary)"
                fill="var(--color-primary)"
                fillOpacity={0.2}
                strokeWidth={2}
                dot={{ fill: 'var(--color-primary)', r: 4 }}
                animationBegin={600}
                animationDuration={1000}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--color-card)',
                  border: '1px solid var(--color-border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                }}
                formatter={(value) => [`${Number(value)}/100`, 'Score']}
              />
            </RadarChart>
          </ResponsiveContainer>
        </motion.div>
      </CardContent>
    </Card>
  )
}
