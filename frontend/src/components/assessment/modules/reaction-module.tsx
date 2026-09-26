// ===========================================================
// NeuroScreen — Reaction Time Module
// ===========================================================
// Multi-trial reaction time test:
//   - 10 trials with randomized delay
//   - Color/shape-change stimulus
//   - performance.now() + requestAnimationFrame timing
//   - False-start detection (click before stimulus)
//
// Metrics: average/fastest/slowest reaction time, false starts,
//          consistency score (inverse of coefficient of variation)
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Timer,
  Play,
  CheckCircle2,
  SkipForward,
  RotateCcw,
  Zap,
  AlertTriangle,
  Clock,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/types/database'

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const TOTAL_TRIALS = 10
const MIN_DELAY_MS = 1500
const MAX_DELAY_MS = 4000
const FALSE_START_MESSAGE_MS = 1200

// Stimulus shapes and colors
const STIMULI = [
  { shape: 'circle', color: 'bg-green-500', label: 'Green Circle' },
  { shape: 'square', color: 'bg-blue-500', label: 'Blue Square' },
  { shape: 'diamond', color: 'bg-amber-500', label: 'Amber Diamond' },
  { shape: 'circle', color: 'bg-red-500', label: 'Red Circle' },
  { shape: 'square', color: 'bg-purple-500', label: 'Purple Square' },
]

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface ReactionModuleProps {
  language: LanguageCode
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'testing' | 'results'
type TrialState = 'waiting' | 'ready' | 'stimulus' | 'responded' | 'false-start'

interface TrialResult {
  reactionTimeMs: number
  isFalseStart: boolean
  stimulusIndex: number
}

interface ReactionMetrics {
  avgReactionTimeMs: number
  fastestReactionTimeMs: number
  slowestReactionTimeMs: number
  falseStartCount: number
  consistencyScore: number
  validTrials: number
  totalTrials: number
  allReactionTimes: number[]
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ReactionModule({ language, onComplete, onSkip }: ReactionModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [trialState, setTrialState] = useState<TrialState>('waiting')
  const [trialNumber, setTrialNumber] = useState(0)
  const [currentStimulus, setCurrentStimulus] = useState(0)
  const [trialResults, setTrialResults] = useState<TrialResult[]>([])
  const [lastReactionTime, setLastReactionTime] = useState<number | null>(null)
  const [metrics, setMetrics] = useState<ReactionMetrics | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const stimulusTimeRef = useRef(0)
  const delayTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const moduleStartRef = useRef(0)
  const trialActiveRef = useRef(false)

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    }
  }, [])

  // -------------------------------------------------------
  // Start the test
  // -------------------------------------------------------
  const handleStart = useCallback(() => {
    setPhase('testing')
    setTrialNumber(0)
    setTrialResults([])
    moduleStartRef.current = performance.now()
    startTrial(0)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------
  // Start a single trial
  // -------------------------------------------------------
  const startTrial = useCallback((trialIdx: number) => {
    setTrialState('waiting')
    setTrialNumber(trialIdx)
    setLastReactionTime(null)
    trialActiveRef.current = true

    // Pick a random stimulus
    const stimIdx = Math.floor(Math.random() * STIMULI.length)
    setCurrentStimulus(stimIdx)

    // Random delay before showing stimulus
    const delay = MIN_DELAY_MS + Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)

    // After a brief "get ready" moment, enter the ready state
    setTimeout(() => {
      setTrialState('ready')
    }, 300)

    delayTimeoutRef.current = setTimeout(() => {
      // Use requestAnimationFrame for precise stimulus timing
      rafIdRef.current = requestAnimationFrame(() => {
        stimulusTimeRef.current = performance.now()
        setTrialState('stimulus')
      })
    }, delay)
  }, [])

  // -------------------------------------------------------
  // Handle user click/tap
  // -------------------------------------------------------
  const handleReact = useCallback(() => {
    if (!trialActiveRef.current) return

    const now = performance.now()

    if (trialState === 'waiting' || trialState === 'ready') {
      // FALSE START — clicked before the stimulus appeared
      trialActiveRef.current = false
      if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current)
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)

      setTrialState('false-start')
      const result: TrialResult = {
        reactionTimeMs: 0,
        isFalseStart: true,
        stimulusIndex: currentStimulus,
      }

      setTrialResults((prev) => {
        const updated = [...prev, result]
        // Move to next trial after a brief delay
        setTimeout(() => {
          if (updated.length >= TOTAL_TRIALS) {
            finishTest(updated)
          } else {
            startTrial(updated.length)
          }
        }, FALSE_START_MESSAGE_MS)
        return updated
      })
    } else if (trialState === 'stimulus') {
      // VALID REACTION — use requestAnimationFrame-corrected time
      trialActiveRef.current = false
      const reactionTime = now - stimulusTimeRef.current

      setLastReactionTime(Math.round(reactionTime))
      setTrialState('responded')

      const result: TrialResult = {
        reactionTimeMs: Math.round(reactionTime),
        isFalseStart: false,
        stimulusIndex: currentStimulus,
      }

      setTrialResults((prev) => {
        const updated = [...prev, result]
        // Brief pause to show result, then next trial
        setTimeout(() => {
          if (updated.length >= TOTAL_TRIALS) {
            finishTest(updated)
          } else {
            startTrial(updated.length)
          }
        }, 1000)
        return updated
      })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trialState, currentStimulus])

  // -------------------------------------------------------
  // Compute metrics from all trials
  // -------------------------------------------------------
  const finishTest = useCallback((allResults: TrialResult[]) => {
    const validResults = allResults.filter((r) => !r.isFalseStart)
    const falseStarts = allResults.filter((r) => r.isFalseStart).length
    const reactionTimes = validResults.map((r) => r.reactionTimeMs)

    if (reactionTimes.length === 0) {
      // All false starts — edge case
      setMetrics({
        avgReactionTimeMs: 0,
        fastestReactionTimeMs: 0,
        slowestReactionTimeMs: 0,
        falseStartCount: falseStarts,
        consistencyScore: 0,
        validTrials: 0,
        totalTrials: TOTAL_TRIALS,
        allReactionTimes: [],
      })
      setPhase('results')
      return
    }

    const avg = Math.round(reactionTimes.reduce((a, b) => a + b, 0) / reactionTimes.length)
    const fastest = Math.min(...reactionTimes)
    const slowest = Math.max(...reactionTimes)

    // Consistency score: based on coefficient of variation (lower CV = more consistent)
    const stdDev = Math.sqrt(
      reactionTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / reactionTimes.length
    )
    const cv = avg > 0 ? stdDev / avg : 1
    // Map CV to a 0-100 score (CV of 0 = perfect 100, CV of 0.5+ ≈ 0)
    const consistencyScore = Math.round(Math.max(0, Math.min(100, (1 - cv * 2) * 100)))

    setMetrics({
      avgReactionTimeMs: avg,
      fastestReactionTimeMs: fastest,
      slowestReactionTimeMs: slowest,
      falseStartCount: falseStarts,
      consistencyScore,
      validTrials: validResults.length,
      totalTrials: TOTAL_TRIALS,
      allReactionTimes: reactionTimes,
    })
    setPhase('results')
  }, [])

  // -------------------------------------------------------
  // Submit results
  // -------------------------------------------------------
  const handleSubmit = useCallback(() => {
    if (!metrics) return
    setIsSubmitting(true)

    // Score: weighted combo of reaction time and consistency
    // Fast reaction (200ms) = full marks; 600ms+ = low
    const speedScore = metrics.avgReactionTimeMs > 0
      ? Math.max(0, Math.min(100, Math.round((1 - (metrics.avgReactionTimeMs - 200) / 400) * 100)))
      : 0
    const falseStartPenalty = metrics.falseStartCount * 5
    const score = Math.max(0, Math.min(100,
      Math.round(speedScore * 0.5 + metrics.consistencyScore * 0.4 - falseStartPenalty)
    ))

    const totalTime = (performance.now() - moduleStartRef.current) / 1000

    const features = {
      avg_reaction_time_ms: metrics.avgReactionTimeMs,
      fastest_reaction_time_ms: metrics.fastestReactionTimeMs,
      slowest_reaction_time_ms: metrics.slowestReactionTimeMs,
      false_start_count: metrics.falseStartCount,
      consistency_score: metrics.consistencyScore,
    }

    onComplete(features, score, Math.round(totalTime * 10) / 10)
  }, [metrics, onComplete])

  // -------------------------------------------------------
  // Reset
  // -------------------------------------------------------
  const handleReset = useCallback(() => {
    if (delayTimeoutRef.current) clearTimeout(delayTimeoutRef.current)
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current)
    trialActiveRef.current = false
    setPhase('instructions')
    setTrialState('waiting')
    setTrialNumber(0)
    setTrialResults([])
    setMetrics(null)
  }, [])

  // -------------------------------------------------------
  // Render stimulus shape
  // -------------------------------------------------------
  const renderStimulus = (stimulus: (typeof STIMULI)[0], size: string, pulse: boolean) => {
    const baseClasses = cn(size, stimulus.color, 'transition-all shadow-lg')
    if (stimulus.shape === 'circle') {
      return <div className={cn(baseClasses, 'rounded-full', pulse && 'animate-pulse')} />
    }
    if (stimulus.shape === 'diamond') {
      return <div className={cn(baseClasses, 'rounded-xl rotate-45', pulse && 'animate-pulse')} />
    }
    return <div className={cn(baseClasses, 'rounded-xl', pulse && 'animate-pulse')} />
  }

  // -------------------------------------------------------
  // Render: Instructions
  // -------------------------------------------------------
  if (phase === 'instructions') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="mx-auto max-w-2xl"
      >
        <Card className="overflow-hidden border-2 border-amber-500/20">
          <div className="h-1.5 bg-amber-500/10" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-amber-500/10">
                <Timer className="size-7 text-amber-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{t(language, 'module.reaction')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(language, 'reaction.instructions')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl bg-muted/50 p-6 space-y-3">
              <h4 className="font-medium text-sm">{t(language, 'reaction.howItWorks')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  {t(language, 'reaction.step.wait')}
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  {t(language, 'reaction.step.react')}
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  {t(language, 'reaction.step.falseStart')}
                </li>
                <li className="flex items-center gap-2">
                  <Target className="size-4 text-amber-500" />
                  {t(language, 'reaction.step.trials', { count: TOTAL_TRIALS })}
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button id="reaction-skip" variant="outline" onClick={onSkip} className="gap-2">
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button id="reaction-start" onClick={handleStart} className="gap-2">
                <Play className="size-4" />
                {t(language, 'reaction.start')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Testing phase
  // -------------------------------------------------------
  if (phase === 'testing') {
    const stimulus = STIMULI[currentStimulus]

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl space-y-4">
        {/* Progress bar */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="font-mono">
            {t(language, 'reaction.trial')} {trialNumber + 1} / {TOTAL_TRIALS}
          </Badge>
          <div className="flex gap-1">
            {Array.from({ length: TOTAL_TRIALS }).map((_, idx) => {
              const result = trialResults[idx]
              return (
                <div
                  key={idx}
                  className={cn(
                    'size-2.5 rounded-full transition-all',
                    result === undefined && idx === trialNumber && 'bg-primary animate-pulse',
                    result === undefined && idx !== trialNumber && 'bg-muted',
                    result && !result.isFalseStart && 'bg-success',
                    result?.isFalseStart && 'bg-destructive',
                  )}
                />
              )
            })}
          </div>
        </div>

        {/* Reaction area */}
        <Card
          className={cn(
            'cursor-pointer select-none overflow-hidden border-2 transition-all',
            trialState === 'waiting' && 'border-muted',
            trialState === 'ready' && 'border-amber-500/30',
            trialState === 'stimulus' && 'border-green-500/50 shadow-lg shadow-green-500/10',
            trialState === 'responded' && 'border-success/50',
            trialState === 'false-start' && 'border-destructive/50',
          )}
          onClick={handleReact}
        >
          <CardContent className="flex min-h-[300px] flex-col items-center justify-center p-8 sm:min-h-[350px]">
            {/* Waiting / Ready */}
            {(trialState === 'waiting' || trialState === 'ready') && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                <div className="flex size-20 items-center justify-center rounded-full bg-muted">
                  <Clock className="size-8 text-muted-foreground" />
                </div>
                <p className="text-lg font-medium text-muted-foreground">
                  {t(language, 'reaction.waitForStimulus')}
                </p>
                <p className="text-sm text-muted-foreground/70">
                  {t(language, 'reaction.dontClickYet')}
                </p>
              </motion.div>
            )}

            {/* Stimulus — CLICK NOW! */}
            {trialState === 'stimulus' && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                className="flex flex-col items-center gap-4 text-center"
              >
                {renderStimulus(stimulus, 'size-24 sm:size-28', true)}
                <p className="mt-4 text-2xl font-bold text-green-500">
                  {t(language, 'reaction.clickNow')}
                </p>
              </motion.div>
            )}

            {/* Responded */}
            {trialState === 'responded' && lastReactionTime !== null && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                <CheckCircle2 className="size-12 text-success" />
                <p className="text-4xl font-bold tabular-nums text-success">
                  {lastReactionTime}<span className="text-lg">ms</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  {lastReactionTime < 250
                    ? t(language, 'reaction.feedback.excellent')
                    : lastReactionTime < 350
                      ? t(language, 'reaction.feedback.good')
                      : lastReactionTime < 500
                        ? t(language, 'reaction.feedback.average')
                        : t(language, 'reaction.feedback.slow')}
                </p>
              </motion.div>
            )}

            {/* False start */}
            {trialState === 'false-start' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 text-center"
              >
                <AlertTriangle className="size-12 text-destructive" />
                <p className="text-xl font-bold text-destructive">
                  {t(language, 'reaction.falseStart')}
                </p>
                <p className="text-sm text-muted-foreground">
                  {t(language, 'reaction.falseStartHint')}
                </p>
              </motion.div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------
  if (phase === 'results' && metrics) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-2xl"
      >
        <Card className="overflow-hidden border-2 border-amber-500/20">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-success/10">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{t(language, 'reaction.results.title')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(language, 'reaction.results.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard
                label={t(language, 'reaction.results.avgTime')}
                value={metrics.avgReactionTimeMs.toString()}
                unit="ms"
                color="text-amber-500"
              />
              <MetricCard
                label={t(language, 'reaction.results.fastest')}
                value={metrics.fastestReactionTimeMs.toString()}
                unit="ms"
                color="text-success"
              />
              <MetricCard
                label={t(language, 'reaction.results.slowest')}
                value={metrics.slowestReactionTimeMs.toString()}
                unit="ms"
                color="text-muted-foreground"
              />
              <MetricCard
                label={t(language, 'reaction.results.falseStarts')}
                value={metrics.falseStartCount.toString()}
                unit=""
                color={metrics.falseStartCount === 0 ? 'text-success' : 'text-destructive'}
              />
              <MetricCard
                label={t(language, 'reaction.results.consistency')}
                value={metrics.consistencyScore.toString()}
                unit="/100"
                color="text-purple-500"
              />
              <MetricCard
                label={t(language, 'reaction.results.validTrials')}
                value={`${metrics.validTrials}/${metrics.totalTrials}`}
                unit=""
                color="text-muted-foreground"
              />
            </div>

            {/* Mini bar chart of reaction times */}
            {metrics.allReactionTimes.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {t(language, 'reaction.results.timeline')}
                </p>
                <div className="flex items-end gap-1 h-20">
                  {metrics.allReactionTimes.map((time, idx) => {
                    const maxTime = Math.max(...metrics.allReactionTimes)
                    const height = maxTime > 0 ? (time / maxTime) * 100 : 0
                    return (
                      <motion.div
                        key={idx}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ delay: idx * 0.05, duration: 0.3 }}
                        className={cn(
                          'flex-1 rounded-t-sm',
                          time < 300 ? 'bg-success' : time < 500 ? 'bg-amber-500' : 'bg-destructive',
                        )}
                        title={`${time}ms`}
                      />
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button id="reaction-retry" variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="size-4" />
                {t(language, 'reaction.results.retry')}
              </Button>
              <Button id="reaction-submit" onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                <CheckCircle2 className="size-4" />
                {isSubmitting ? t(language, 'reaction.results.submitting') : t(language, 'reaction.results.submit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return null
}

// -------------------------------------------------------
// Metric Card Sub-component
// -------------------------------------------------------

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}
