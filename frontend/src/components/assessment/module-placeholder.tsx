// ===========================================================
// NeuroScreen — Module Placeholder
// ===========================================================
// Temporary placeholder for actual module UIs (Phase 7–8).
// Shows module info + mock Complete/Skip buttons for testing
// the full assessment flow end-to-end.
// ===========================================================

import { motion } from 'framer-motion'
import {
  Keyboard,
  Brain,
  Timer,
  Mic,
  Camera,
  Play,
  SkipForward,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import type { LanguageCode, ModuleType } from '@/types/database'
import { MODULE_INFO } from '@/types/database'

interface ModulePlaceholderProps {
  moduleType: ModuleType
  language: LanguageCode
  onComplete: () => void
  onSkip: () => void
}

const MODULE_ICONS: Record<ModuleType, React.ElementType> = {
  typing: Keyboard,
  memory: Brain,
  reaction: Timer,
  speech: Mic,
  facial: Camera,
}

const MODULE_COLORS: Record<ModuleType, { bg: string; text: string; border: string }> = {
  typing: { bg: 'bg-blue-500/10', text: 'text-blue-500', border: 'border-blue-500/20' },
  memory: { bg: 'bg-purple-500/10', text: 'text-purple-500', border: 'border-purple-500/20' },
  reaction: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  speech: { bg: 'bg-emerald-500/10', text: 'text-emerald-500', border: 'border-emerald-500/20' },
  facial: { bg: 'bg-rose-500/10', text: 'text-rose-500', border: 'border-rose-500/20' },
}

export function ModulePlaceholder({
  moduleType,
  language,
  onComplete,
  onSkip,
}: ModulePlaceholderProps) {
  const info = MODULE_INFO[moduleType]
  const Icon = MODULE_ICONS[moduleType]
  const colors = MODULE_COLORS[moduleType]

  return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className={`overflow-hidden border ${colors.border} shadow-md`}>
          {/* Gradient header strip */}
          <div className={`h-1.5 ${colors.bg}`} />

          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className={`flex size-11 items-center justify-center rounded-xl ${colors.bg}`}>
                <Icon className={`size-6 ${colors.text}`} />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">
                  {t(language, `module.${moduleType}`)}
                </CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {info.description}
                </p>
              </div>
              {info.requiresHardware !== 'none' && (
                <Badge variant="secondary" className="text-xs">
                  {info.requiresHardware === 'microphone' ? '🎤 Mic' : '📷 Camera'}
                </Badge>
              )}
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Placeholder content */}
            <div className="flex flex-col items-center gap-4 rounded-xl bg-muted/50 p-6 sm:p-8 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Play className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-sm text-muted-foreground">
                  Module Coming Soon
                </p>
                <p className="mt-1 text-xs sm:text-sm text-muted-foreground/80">
                  This module will be fully interactive in the next update.
                  For now, use the buttons below to test the assessment flow.
                </p>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                id={`module-skip-${moduleType}`}
                variant="outline"
                onClick={onSkip}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button
                id={`module-complete-${moduleType}`}
                onClick={onComplete}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                Complete (Mock)
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
  )
}
