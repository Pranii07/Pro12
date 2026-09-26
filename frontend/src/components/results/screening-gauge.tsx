// ===========================================================
// NeuroScreen — Screening Level Gauge
// ===========================================================
// Animated circular gauge displaying the overall behaviour
// score (0-100) with a screening level badge.
//
// NOT a medical diagnosis. Behavioural Screening Level only.
// ===========================================================

import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ScreeningLevel } from '@/types/database'

interface ScreeningGaugeProps {
  score: number
  level: ScreeningLevel
  className?: string
}

const LEVEL_CONFIG: Record<ScreeningLevel, {
  label: string
  color: string
  bgColor: string
  borderColor: string
  icon: typeof Shield
  description: string
}> = {
  LOW: {
    label: 'Low',
    color: 'text-[var(--color-level-low)]',
    bgColor: 'bg-[var(--color-level-low)]/10',
    borderColor: 'border-[var(--color-level-low)]/30',
    icon: ShieldCheck,
    description: 'No significant behavioural indicators detected',
  },
  MODERATE: {
    label: 'Moderate',
    color: 'text-[var(--color-level-moderate)]',
    bgColor: 'bg-[var(--color-level-moderate)]/10',
    borderColor: 'border-[var(--color-level-moderate)]/30',
    icon: Shield,
    description: 'Some behavioural variations observed',
  },
  HIGH: {
    label: 'High',
    color: 'text-[var(--color-level-high)]',
    bgColor: 'bg-[var(--color-level-high)]/10',
    borderColor: 'border-[var(--color-level-high)]/30',
    icon: ShieldAlert,
    description: 'Notable behavioural patterns identified',
  },
}

function getStrokeColor(level: ScreeningLevel): string {
  switch (level) {
    case 'LOW': return 'var(--color-level-low)'
    case 'MODERATE': return 'var(--color-level-moderate)'
    case 'HIGH': return 'var(--color-level-high)'
  }
}

export function ScreeningGauge({ score, level, className }: ScreeningGaugeProps) {
  const config = LEVEL_CONFIG[level]
  const Icon = config.icon
  const [animatedScore, setAnimatedScore] = useState(0)

  // Animate score counting up
  useEffect(() => {
    const duration = 1200
    const steps = 60
    const increment = score / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= score) {
        setAnimatedScore(score)
        clearInterval(timer)
      } else {
        setAnimatedScore(Math.round(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [score])

  // SVG circular gauge
  const radius = 70
  const circumference = 2 * Math.PI * radius
  const progress = (animatedScore / 100) * circumference
  const strokeDashoffset = circumference - progress

  return (
    <div className={cn('flex flex-col items-center gap-5', className)}>
      {/* Circular Gauge */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.2 }}
        className="relative"
      >
        <svg
          width="180"
          height="180"
          viewBox="0 0 180 180"
          className="-rotate-90"
        >
          {/* Background circle */}
          <circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth="10"
            strokeLinecap="round"
          />
          {/* Progress circle */}
          <motion.circle
            cx="90"
            cy="90"
            r={radius}
            fill="none"
            stroke={getStrokeColor(level)}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
          />
        </svg>

        {/* Score in center */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-4xl font-bold tabular-nums', config.color)}>
            {animatedScore}
          </span>
          <span className="text-xs text-muted-foreground font-medium">/ 100</span>
        </div>
      </motion.div>

      {/* Level Badge */}
      <motion.div
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className={cn(
          'flex items-center gap-2 rounded-full border px-5 py-2.5',
          config.bgColor,
          config.borderColor
        )}
      >
        <Icon className={cn('size-5', config.color)} />
        <div className="flex flex-col">
          <span className={cn('text-sm font-semibold', config.color)}>
            {config.label} Screening Level
          </span>
          <span className="text-[0.65rem] text-muted-foreground">
            {config.description}
          </span>
        </div>
      </motion.div>
    </div>
  )
}

export { LEVEL_CONFIG }
