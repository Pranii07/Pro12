// ===========================================================
// NeuroScreen — Assessment Progress Stepper
// ===========================================================
// Horizontal step indicator for the assessment flow.
// Shows: Language → Modules → Context → Assessment → Complete
// ===========================================================

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { FlowStep } from '@/hooks/use-assessment-flow'
import type { LanguageCode } from '@/types/database'

interface AssessmentProgressProps {
  currentStep: FlowStep
  language: LanguageCode
}

const STEPS: { key: FlowStep; labelKey: string }[] = [
  { key: 'language', labelKey: 'progress.language' },
  { key: 'modules', labelKey: 'progress.modules' },
  { key: 'questionnaire', labelKey: 'progress.context' },
  { key: 'assessment', labelKey: 'progress.assessment' },
  { key: 'complete', labelKey: 'progress.complete' },
]

const STEP_ORDER: FlowStep[] = STEPS.map((s) => s.key)

function getStepStatus(step: FlowStep, currentStep: FlowStep): 'completed' | 'current' | 'upcoming' {
  const currentIdx = STEP_ORDER.indexOf(currentStep)
  const stepIdx = STEP_ORDER.indexOf(step)
  if (stepIdx < currentIdx) return 'completed'
  if (stepIdx === currentIdx) return 'current'
  return 'upcoming'
}

export function AssessmentProgress({ currentStep, language }: AssessmentProgressProps) {
  return (
    <nav aria-label="Assessment progress" className="w-full">
      <ol className="flex items-center justify-between gap-0">
        {STEPS.map((step, index) => {
          const status = getStepStatus(step.key, currentStep)
          const isLast = index === STEPS.length - 1

          return (
            <li
              key={step.key}
              className={cn('flex items-center', !isLast && 'flex-1')}
            >
              {/* Step circle + label */}
              <div className="flex flex-col items-center gap-1.5">
                <motion.div
                  initial={false}
                  animate={{
                    scale: status === 'current' ? 1 : 1,
                    backgroundColor:
                      status === 'completed'
                        ? 'var(--color-primary)'
                        : status === 'current'
                          ? 'var(--color-primary)'
                          : 'var(--color-muted)',
                  }}
                  transition={{ duration: 0.3 }}
                  className={cn(
                    'flex size-8 items-center justify-center rounded-full text-xs font-semibold transition-shadow sm:size-9',
                    status === 'completed' && 'text-primary-foreground',
                    status === 'current' && 'text-primary-foreground ring-4 ring-primary/20',
                    status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {status === 'completed' ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <Check className="size-4" />
                    </motion.div>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>

                <span
                  className={cn(
                    'text-[0.65rem] font-medium sm:text-xs',
                    status === 'current' && 'text-primary font-semibold',
                    status === 'completed' && 'text-primary',
                    status === 'upcoming' && 'text-muted-foreground'
                  )}
                >
                  {t(language, step.labelKey)}
                </span>
              </div>

              {/* Connector line */}
              {!isLast && (
                <div className="mx-2 mt-[-1.25rem] h-0.5 flex-1 rounded-full bg-muted sm:mx-3">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={false}
                    animate={{
                      width: status === 'completed' ? '100%' : '0%',
                    }}
                    transition={{ duration: 0.4, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
