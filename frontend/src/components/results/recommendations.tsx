// ===========================================================
// NeuroScreen — Recommendations
// ===========================================================
// Educational, non-diagnostic recommendations based on
// screening level and completed modules.
//
// IMPORTANT: These are NOT medical advice. They are general
// behavioural wellness suggestions for educational purposes.
// ===========================================================

import { motion } from 'framer-motion'
import {
  Lightbulb,
  Activity,
  BookOpen,
  HeartPulse,
  ClipboardList,
  Footprints,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { ScreeningLevel, ModuleType } from '@/types/database'

interface RecommendationsProps {
  level: ScreeningLevel
  completedModules: ModuleType[]
  className?: string
}

interface Recommendation {
  icon: typeof Lightbulb
  title: string
  description: string
  category: 'general' | 'cognitive' | 'motor' | 'lifestyle'
}

function getRecommendations(level: ScreeningLevel, modules: ModuleType[]): Recommendation[] {
  const recs: Recommendation[] = []

  // General recommendations (always shown)
  recs.push({
    icon: ClipboardList,
    title: 'Regular Screening',
    description: 'Consider repeating this assessment periodically to track changes in your behavioural patterns over time.',
    category: 'general',
  })

  if (level === 'LOW') {
    recs.push({
      icon: Activity,
      title: 'Maintain Your Routine',
      description: 'Your behavioural indicators are within expected ranges. Continue your current physical and cognitive activities to maintain these patterns.',
      category: 'lifestyle',
    })
    recs.push({
      icon: BookOpen,
      title: 'Stay Mentally Active',
      description: 'Regular reading, puzzles, and learning new skills help maintain cognitive sharpness throughout life.',
      category: 'cognitive',
    })
  }

  if (level === 'MODERATE') {
    recs.push({
      icon: HeartPulse,
      title: 'Consult a Professional',
      description: 'Some behavioural variations were observed. Consider discussing these results with a qualified healthcare professional for proper evaluation.',
      category: 'general',
    })
    recs.push({
      icon: Activity,
      title: 'Physical Exercise',
      description: 'Regular aerobic exercise (30 min/day) has been shown in research to support cognitive function and motor coordination.',
      category: 'lifestyle',
    })
    recs.push({
      icon: BookOpen,
      title: 'Cognitive Training',
      description: 'Activities like memory games, word puzzles, and strategic games may help maintain cognitive flexibility.',
      category: 'cognitive',
    })
  }

  if (level === 'HIGH') {
    recs.push({
      icon: HeartPulse,
      title: 'Professional Evaluation Recommended',
      description: 'Notable behavioural patterns were identified. We strongly recommend consulting a qualified neurologist or healthcare professional for a comprehensive evaluation.',
      category: 'general',
    })
    recs.push({
      icon: Footprints,
      title: 'Daily Movement',
      description: 'Regular physical activity, including walking, stretching, and balance exercises, supports overall neurological health.',
      category: 'lifestyle',
    })
    recs.push({
      icon: BookOpen,
      title: 'Structured Cognitive Activities',
      description: 'Engage in structured activities that challenge memory, attention, and problem-solving. Consistency is more important than difficulty.',
      category: 'cognitive',
    })
  }

  // Module-specific recommendations
  if (modules.includes('typing') && level !== 'LOW') {
    recs.push({
      icon: Activity,
      title: 'Fine Motor Exercises',
      description: 'Hand dexterity exercises (e.g., finger tapping, grip exercises) may help maintain typing speed and accuracy.',
      category: 'motor',
    })
  }

  if (modules.includes('speech') && level !== 'LOW') {
    recs.push({
      icon: Lightbulb,
      title: 'Speech Practice',
      description: 'Reading aloud for 10-15 minutes daily can help maintain speech fluency and articulation.',
      category: 'cognitive',
    })
  }

  return recs
}

const CATEGORY_COLORS: Record<string, string> = {
  general: 'text-primary',
  cognitive: 'text-purple-500',
  motor: 'text-amber-500',
  lifestyle: 'text-emerald-500',
}

export function Recommendations({ level, completedModules, className }: RecommendationsProps) {
  const recs = getRecommendations(level, completedModules)

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="size-4 text-warning" />
          Personalised Recommendations
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Educational suggestions based on your assessment — not medical advice
        </p>
      </CardHeader>
      <CardContent className="space-y-3 pt-2">
        {recs.map((rec, index) => {
          const Icon = rec.icon
          const iconColor = CATEGORY_COLORS[rec.category] || 'text-muted-foreground'

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 + index * 0.08, duration: 0.25 }}
              className="flex items-start gap-3 rounded-lg border bg-card/50 p-3 transition-colors hover:bg-muted/50"
            >
              <div className="mt-0.5 rounded-md bg-muted p-1.5">
                <Icon className={cn('size-3.5', iconColor)} />
              </div>
              <div className="space-y-0.5">
                <p className="text-sm font-medium">{rec.title}</p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {rec.description}
                </p>
              </div>
            </motion.div>
          )
        })}
      </CardContent>
    </Card>
  )
}
