// ===========================================================
// NeuroScreen — Assessment Runner
// ===========================================================
// Step 4: Runs selected modules sequentially. Shows progress,
// current module, skip dialog, and abandon confirmation.
//
// All five modules (Typing, Memory, Reaction, Speech, Facial)
// render fully interactive UIs.
// ===========================================================

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ChevronRight,
  LogOut,
  SkipForward,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { DisclaimerBanner } from '@/components/ui/disclaimer-banner'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'

// Real module components
import { TypingModule } from './modules/typing-module'
import { MemoryModule } from './modules/memory-module'
import { ReactionModule } from './modules/reaction-module'
import { SpeechModule } from './modules/speech-module'
import { FacialModule } from './modules/facial-module'

import { assessmentApi } from '@/services/assessment-api'
import type { LanguageCode } from '@/types/database'
import type { ModuleState } from '@/hooks/use-assessment-flow'
import type { ModuleResultResponse } from '@/services/assessment-api'

interface AssessmentRunnerProps {
  language: LanguageCode
  selectedModules: ModuleState[]
  currentModuleIndex: number
  currentModule: ModuleState | null
  completedCount: number
  assessmentId: string | null
  onComplete: (result: ModuleResultResponse) => void
  onSkip: (reason: string) => void
  onAbandon: () => void
}

const SKIP_REASONS = [
  { value: 'no_hardware', labelKey: 'runner.skip.reason.noHardware' },
  { value: 'prefer_not', labelKey: 'runner.skip.reason.preferNot' },
  { value: 'technical', labelKey: 'runner.skip.reason.technical' },
  { value: 'other', labelKey: 'runner.skip.reason.other' },
]

export function AssessmentRunner({
  language,
  selectedModules,
  currentModuleIndex,
  currentModule,
  completedCount,
  assessmentId,
  onComplete,
  onSkip,
  onAbandon,
}: AssessmentRunnerProps) {
  const [skipDialogOpen, setSkipDialogOpen] = useState(false)
  const [abandonDialogOpen, setAbandonDialogOpen] = useState(false)
  const [skipReason, setSkipReason] = useState('')

  const total = selectedModules.length
  const progress = total > 0 ? (completedCount / total) * 100 : 0

  if (!currentModule) return null

  const handleSkipConfirm = () => {
    if (skipReason) {
      onSkip(skipReason)
      setSkipDialogOpen(false)
      setSkipReason('')
    }
  }

  // ----------------------------------------------------------
  // Real module completion handler — submits features to the
  // backend API and returns a ModuleResultResponse to the flow.
  // ----------------------------------------------------------
  const handleModuleComplete = useCallback(
    async (
      features: Record<string, unknown>,
      score: number,
      durationSeconds: number,
    ) => {
      if (!currentModule) return

      // Attempt to submit to backend; if it fails (e.g., no Supabase
      // configured), fall back to a local mock result so the flow
      // can continue during development.
      let result: ModuleResultResponse

      try {
        if (assessmentId) {
          result = await assessmentApi.submitModule(assessmentId, {
            module_type: currentModule.type,
            status: 'completed',
            features,
            score,
            duration_seconds: durationSeconds,
          })
        } else {
          throw new Error('No assessment ID')
        }
      } catch {
        // Fallback mock result for local development
        result = {
          id: `local-${Date.now()}`,
          assessment_id: assessmentId ?? 'local',
          module_type: currentModule.type,
          status: 'completed',
          features,
          score,
          duration_seconds: durationSeconds,
          completed_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
      }

      onComplete(result)
    },
    [currentModule, assessmentId, onComplete],
  )

  // ----------------------------------------------------------
  // Render the active module component
  // ----------------------------------------------------------
  const renderModule = () => {
    const moduleProps = {
      language,
      onComplete: handleModuleComplete,
      onSkip: () => setSkipDialogOpen(true),
    }

    switch (currentModule.type) {
      case 'typing':
        return <TypingModule key="typing" {...moduleProps} />
      case 'memory':
        return <MemoryModule key="memory" {...moduleProps} />
      case 'reaction':
        return <ReactionModule key="reaction" {...moduleProps} />
      case 'speech':
        return (
          <SpeechModule
            key="speech"
            {...moduleProps}
            assessmentId={assessmentId}
          />
        )
      case 'facial':
        return (
          <FacialModule
            key="facial"
            {...moduleProps}
            assessmentId={assessmentId}
          />
        )
      default:
        return null
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="mx-auto flex max-w-4xl flex-col gap-6"
    >
      {/* Top Bar — Progress + Module Counter */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-xs">
              {t(language, 'runner.module')} {currentModuleIndex + 1} {t(language, 'runner.of')} {total}
            </Badge>
            <ChevronRight className="size-3 text-muted-foreground" />
            <span className="text-sm font-medium">
              {t(language, `module.${currentModule.type}`)}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
            onClick={() => setAbandonDialogOpen(true)}
          >
            <LogOut className="size-3.5" />
            {t(language, 'runner.abandon')}
          </Button>
        </div>

        {/* Progress Bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-secondary"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Module dots */}
        <div className="flex items-center gap-1.5">
          {selectedModules.map((mod, idx) => (
            <motion.div
              key={mod.type}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                mod.status === 'completed' && 'bg-success',
                mod.status === 'skipped' && 'bg-warning',
                mod.status === 'pending' && idx === currentModuleIndex && 'bg-primary',
                mod.status === 'pending' && idx !== currentModuleIndex && 'bg-muted'
              )}
              initial={false}
              animate={{
                scale: idx === currentModuleIndex ? 1 : 1,
                opacity: idx === currentModuleIndex ? 1 : 0.7,
              }}
            />
          ))}
        </div>
      </div>

      {/* Current Module Content */}
      <AnimatePresence mode="wait">
        {renderModule()}
      </AnimatePresence>

      {/* Disclaimer */}
      <DisclaimerBanner variant="compact" />

      {/* ======================================= */}
      {/* Skip Dialog                              */}
      {/* ======================================= */}
      <Dialog open={skipDialogOpen} onOpenChange={setSkipDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <SkipForward className="size-5 text-warning" />
              {t(language, 'runner.skip.title')}
            </DialogTitle>
            <DialogDescription>
              {t(language, 'runner.skip.description')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">
              {t(language, 'runner.skip.reason')}
            </label>
            <div className="space-y-2">
              {SKIP_REASONS.map((reason) => (
                <label
                  key={reason.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-all',
                    skipReason === reason.value
                      ? 'border-primary bg-primary/5'
                      : 'hover:bg-muted/50'
                  )}
                >
                  <input
                    type="radio"
                    name="skip-reason"
                    value={reason.value}
                    checked={skipReason === reason.value}
                    onChange={(e) => setSkipReason(e.target.value)}
                    className="accent-primary"
                  />
                  <span className="text-sm">
                    {t(language, reason.labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setSkipDialogOpen(false)
                setSkipReason('')
              }}
            >
              {t(language, 'runner.skip.cancel')}
            </Button>
            <Button
              variant="outline"
              onClick={handleSkipConfirm}
              disabled={!skipReason}
              className="gap-2"
            >
              <SkipForward className="size-4" />
              {t(language, 'runner.skip.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ======================================= */}
      {/* Abandon Dialog                           */}
      {/* ======================================= */}
      <Dialog open={abandonDialogOpen} onOpenChange={setAbandonDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {t(language, 'runner.abandon.title')}
            </DialogTitle>
            <DialogDescription>
              {t(language, 'runner.abandon.description')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAbandonDialogOpen(false)}
            >
              {t(language, 'runner.abandon.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setAbandonDialogOpen(false)
                onAbandon()
              }}
              className="gap-2"
            >
              <X className="size-4" />
              {t(language, 'runner.abandon.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  )
}
