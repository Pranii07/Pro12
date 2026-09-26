// ===========================================================
// NeuroScreen — Assessment Completion Step
// ===========================================================
// Step 5: Summary of completed and skipped modules.
// CTAs to view results or return to dashboard.
// ===========================================================

import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  CheckCircle2,
  SkipForward,
  BarChart3,
  ArrowRight,
  LayoutDashboard,
  Info,
  Sparkles,
} from 'lucide-react'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { LanguageCode, ModuleType } from '@/types/database'
import type { ModuleState } from '@/hooks/use-assessment-flow'

interface CompletionStepProps {
  language: LanguageCode
  modules: ModuleState[]
  assessmentId: string | null
  onFinish: () => void
}

const MODULE_COLORS: Record<ModuleType, string> = {
  typing: 'text-blue-500',
  memory: 'text-purple-500',
  reaction: 'text-amber-500',
  speech: 'text-emerald-500',
  facial: 'text-rose-500',
}

export function CompletionStep({ language, modules, assessmentId, onFinish }: CompletionStepProps) {
  const selectedModules = modules.filter((m) => m.selected)
  const completedModules = selectedModules.filter((m) => m.status === 'completed')
  const skippedModules = selectedModules.filter((m) => m.status === 'skipped')

  // Call onFinish on mount to mark the assessment as completed
  useEffect(() => {
    onFinish()
  }, [onFinish])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mx-auto flex max-w-2xl flex-col items-center gap-6"
    >
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 200,
          damping: 15,
          delay: 0.1,
        }}
        className="relative"
      >
        <div className="flex size-20 items-center justify-center rounded-full bg-success/10">
          <Sparkles className="size-10 text-success" />
        </div>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.4 }}
          className="absolute -right-1 -top-1 flex size-7 items-center justify-center rounded-full bg-success text-success-foreground"
        >
          <CheckCircle2 className="size-4" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <div className="text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {t(language, 'complete.title')}
        </h2>
        <p className="mt-2 text-muted-foreground">
          {t(language, 'complete.subtitle')}
        </p>
      </div>

      {/* Module Summary */}
      <Card className="w-full">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="size-4 text-primary" />
            Module Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {selectedModules.map((mod, index) => (
            <motion.div
              key={mod.type}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: 0.2 + index * 0.06 }}
              className={cn(
                'flex items-center justify-between rounded-lg border p-3',
                mod.status === 'completed' && 'border-success/30 bg-success/5',
                mod.status === 'skipped' && 'border-warning/30 bg-warning/5'
              )}
            >
              <div className="flex items-center gap-3">
                <span className={cn('text-sm font-medium', MODULE_COLORS[mod.type])}>
                  {t(language, `module.${mod.type}`)}
                </span>
              </div>

              <div className="flex items-center gap-2">
                {mod.status === 'completed' ? (
                  <>
                    {mod.result?.score != null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {mod.result.score}/100
                      </span>
                    )}
                    <Badge variant="default" className="bg-success text-success-foreground text-[0.6rem] gap-1">
                      <CheckCircle2 className="size-3" />
                      {t(language, 'complete.completed')}
                    </Badge>
                  </>
                ) : (
                  <Badge variant="secondary" className="text-[0.6rem] gap-1">
                    <SkipForward className="size-3" />
                    {t(language, 'complete.skipped')}
                  </Badge>
                )}
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="flex w-full gap-3">
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-success">{completedModules.length}</span>
            <span className="text-xs text-muted-foreground">{t(language, 'complete.completed')}</span>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-warning">{skippedModules.length}</span>
            <span className="text-xs text-muted-foreground">{t(language, 'complete.skipped')}</span>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="flex flex-col items-center p-4">
            <span className="text-2xl font-bold text-primary">{selectedModules.length}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </CardContent>
        </Card>
      </div>

      {/* Note about skipped modules */}
      {skippedModules.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-start gap-3 rounded-lg bg-warning/10 p-4 w-full"
        >
          <Info className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-xs text-warning leading-relaxed">
            {t(language, 'complete.note')}
          </p>
        </motion.div>
      )}

      {/* Actions */}
      <div className="flex w-full flex-col gap-3 sm:flex-row">
        <Link
          id="complete-view-results"
          to={assessmentId ? `/dashboard/results/${assessmentId}` : '/dashboard/results'}
          className={cn(
            buttonVariants({ size: 'lg' }),
            'flex-1 gap-2'
          )}
        >
          {t(language, 'complete.viewResults')}
          <ArrowRight className="size-4" />
        </Link>
        <Link
          id="complete-dashboard"
          to="/dashboard"
          className={cn(
            buttonVariants({ variant: 'outline', size: 'lg' }),
            'flex-1 gap-2'
          )}
        >
          <LayoutDashboard className="size-4" />
          {t(language, 'complete.backToDashboard')}
        </Link>
      </div>

      {/* Disclaimer */}
      <DisclaimerBanner variant="compact" />
    </motion.div>
  )
}
