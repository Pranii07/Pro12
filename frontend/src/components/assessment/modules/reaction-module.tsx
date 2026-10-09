// ===========================================================
// NeuroScreen — Reaction Time Assessment Module
// ===========================================================
// Standardized Human Benchmark reaction time test:
//   - Red-to-green visual stimulus
//   - Click anywhere or press Spacebar
//   - False-start detection (clicked before green)
//   - 5 rounds, exactly matching the Cognitive Lab experience
//   - Exports clinical ML features: average, fastest, slowest,
//     false starts, response variability (SD), CV, and score.
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Trophy,
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

const TOTAL_ROUNDS = 5
const MIN_DELAY_MS = 1800
const MAX_DELAY_MS = 5500

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface ReactionModuleProps {
  language: LanguageCode
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'testing' | 'results'
type TestState = 'idle' | 'waiting' | 'ready' | 'too-early' | 'round-result' | 'complete'

interface RoundData {
  roundNumber: number
  timeMs: number
}

interface ReactionMetrics {
  avgReactionTimeMs: number
  responseVariabilityMs: number
  coefficientOfVariation: number
  fastestReactionTimeMs: number
  slowestReactionTimeMs: number
  falseStartCount: number
  consistencyScore: number
  speedScore: number
  moduleScore: number
  performanceRating: string
  validTrials: number
  totalTrials: number
  allReactionTimes: number[]
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function ReactionModule({ language, onComplete, onSkip }: ReactionModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [testState, setTestState] = useState<TestState>('idle')
  const [rounds, setRounds] = useState<RoundData[]>([])
  const [lastTime, setLastTime] = useState(0)
  const [falseStarts, setFalseStarts] = useState(0)
  const [metrics, setMetrics] = useState<ReactionMetrics | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(0)
  const moduleStartRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    return () => clearTimer()
  }, [])

  // -------------------------------------------------------
  // Round management (matching Cognitive Lab)
  // -------------------------------------------------------

  const startRound = useCallback(() => {
    clearTimer()
    setTestState('waiting')
    // Random delay between 1.8s and 5.5s
    const delay = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS)) + MIN_DELAY_MS
    timerRef.current = setTimeout(() => {
      startTimeRef.current = performance.now()
      setTestState('ready')
    }, delay)
  }, [])

  const handleStart = useCallback(() => {
    setPhase('testing')
    setRounds([])
    setFalseStarts(0)
    setLastTime(0)
    moduleStartRef.current = performance.now()
    startRound()
  }, [startRound])

  // Click handler on the main benchmark box
  const handleBoxClick = () => {
    if (testState === 'idle') {
      setRounds([])
      setFalseStarts(0)
      startRound()
    } else if (testState === 'waiting') {
      clearTimer()
      setFalseStarts((prev) => prev + 1)
      setTestState('too-early')
    } else if (testState === 'ready') {
      const elapsed = Math.round(performance.now() - startTimeRef.current)
      setLastTime(elapsed)
      const newRounds = [...rounds, { roundNumber: rounds.length + 1, timeMs: elapsed }]
      setRounds(newRounds)

      if (newRounds.length >= TOTAL_ROUNDS) {
        computeAndSetMetrics(newRounds, falseStarts)
      } else {
        setTestState('round-result')
      }
    } else if (testState === 'too-early' || testState === 'round-result') {
      startRound()
    }
  }

  // -------------------------------------------------------
  // Metric calculation
  // -------------------------------------------------------

  const computeAndSetMetrics = (completedRounds: RoundData[], totalFalseStarts: number) => {
    const times = completedRounds.map((r) => r.timeMs)
    const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length)

    // Standard deviation
    const variance = times.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / times.length
    const stdDev = Math.sqrt(variance)
    const responseVariabilityMs = Math.round(stdDev * 10) / 10

    // Coefficient of variation (CV = SD / Mean)
    const cv = avg > 0 ? stdDev / avg : 0.2
    const cvRounded = Math.round(cv * 1000) / 1000

    // Calibrated speed score: 250ms -> 100, 400ms -> 75, 560ms -> 50, >750ms -> 20
    const speedScore = avg <= 250
      ? 100
      : Math.max(10, Math.min(100, Math.round(100 - ((avg - 250) / 310) * 50)))

    // Calibrated consistency score: CV <= 0.16 -> 100
    const consistencyScore = cv <= 0.16
      ? 100
      : Math.max(10, Math.min(100, Math.round(100 - ((cv - 0.16) / 0.34) * 60)))

    const falseStartPenalty = totalFalseStarts * 4
    const moduleScore = Math.max(10, Math.min(100,
      Math.round(speedScore * 0.65 + consistencyScore * 0.35 - falseStartPenalty)
    ))

    let performanceRating = 'Normal Reaction Speed'
    if (avg <= 230) performanceRating = 'Superior Reflexes'
    else if (avg <= 290) performanceRating = 'Fast & Healthy Response'
    else if (avg <= 380) performanceRating = 'Normal Reflex Latency'
    else if (avg <= 500) performanceRating = 'Mild Psychomotor Delay'
    else performanceRating = 'Moderate Latency'

    setMetrics({
      avgReactionTimeMs: avg,
      responseVariabilityMs,
      coefficientOfVariation: cvRounded,
      fastestReactionTimeMs: Math.min(...times),
      slowestReactionTimeMs: Math.max(...times),
      falseStartCount: totalFalseStarts,
      consistencyScore,
      speedScore,
      moduleScore,
      performanceRating,
      validTrials: times.length,
      totalTrials: TOTAL_ROUNDS,
      allReactionTimes: times,
    })

    setPhase('results')
  }

  // -------------------------------------------------------
  // Submit results to assessment runner
  // -------------------------------------------------------

  const handleSubmit = useCallback(() => {
    if (!metrics) return
    setIsSubmitting(true)

    const totalTime = (performance.now() - moduleStartRef.current) / 1000

    const features = {
      avg_reaction_time_ms: metrics.avgReactionTimeMs,
      response_variability_ms: metrics.responseVariabilityMs,
      coefficient_of_variation: metrics.coefficientOfVariation,
      fastest_reaction_time_ms: metrics.fastestReactionTimeMs,
      fastest_reaction_ms: metrics.fastestReactionTimeMs,
      slowest_reaction_time_ms: metrics.slowestReactionTimeMs,
      slowest_reaction_ms: metrics.slowestReactionTimeMs,
      false_start_count: metrics.falseStartCount,
      consistency_score: metrics.consistencyScore,
      speed_score: metrics.speedScore,
      module_score: metrics.moduleScore,
      performance_rating: metrics.performanceRating,
      valid_trials: metrics.validTrials,
      total_trials: metrics.totalTrials,
      trial_reaction_times: metrics.allReactionTimes,
      reaction_present: 1,
    }

    onComplete(features, metrics.moduleScore, Math.round(totalTime * 10) / 10)
  }, [metrics, onComplete])

  // -------------------------------------------------------
  // Reset
  // -------------------------------------------------------

  const handleReset = useCallback(() => {
    clearTimer()
    setPhase('instructions')
    setTestState('idle')
    setRounds([])
    setFalseStarts(0)
    setLastTime(0)
    setMetrics(null)
  }, [])

  const getPercentile = (ms: number) => {
    if (ms <= 190) return 'Top 1% (Pro Reflexes)'
    if (ms <= 220) return 'Top 5% (Exceptional)'
    if (ms <= 250) return 'Top 20% (Fast Reflexes)'
    if (ms <= 300) return 'Top 50% (Normal / Healthy)'
    if (ms <= 360) return 'Top 75% (Moderate)'
    return 'Bottom 25% (Slight Delay)'
  }

  // =======================================================
  // Render: Instructions
  // =======================================================

  if (phase === 'instructions') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className="overflow-hidden border border-amber-500/20 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-amber-500/10">
                <Timer className="size-6 text-amber-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{t(language, 'module.reaction')}</CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {t(language, 'reaction.instructions')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-muted/50 p-4 sm:p-5 space-y-2.5">
              <h4 className="font-semibold text-xs sm:text-sm">{t(language, 'reaction.howItWorks')}</h4>
              <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-amber-500" />
                  <span>Wait while the screen is red (random delay). Do not click yet!</span>
                </li>
                <li className="flex items-center gap-2">
                  <Zap className="size-4 text-amber-500" />
                  <span>As soon as the screen turns green, click as fast as you can.</span>
                </li>
                <li className="flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-500" />
                  <span>Clicking too early counts as a false start.</span>
                </li>
                <li className="flex items-center gap-2">
                  <Target className="size-4 text-amber-500" />
                  <span>5 rounds total — standardized Human Benchmark reflex measurement.</span>
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                id="reaction-skip"
                variant="outline"
                onClick={onSkip}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button
                id="reaction-start"
                onClick={handleStart}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-semibold shadow-md bg-amber-600 hover:bg-amber-700 text-white"
              >
                <Play className="size-4" />
                {t(language, 'reaction.start')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // =======================================================
  // Render: Testing (Cognitive Lab Experience)
  // =======================================================

  if (phase === 'testing') {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-4">
        {/* Top round counter */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-amber-500/30">
              <Zap className="size-3.5 text-amber-500" />
              Assessment: Reaction Time
            </Badge>
            <span className="text-xs text-muted-foreground font-medium">
              Round {Math.min(rounds.length + (testState === 'waiting' || testState === 'ready' ? 1 : 0), TOTAL_ROUNDS)} of {TOTAL_ROUNDS}
            </span>
          </div>

          {falseStarts > 0 && (
            <Badge variant="outline" className="text-xs text-rose-500 border-rose-500/30 bg-rose-500/10">
              False Starts: {falseStarts}
            </Badge>
          )}
        </div>

        {/* Main Interactive Screen (Same as Cognitive Lab) */}
        <div
          onClick={handleBoxClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => { if (e.code === 'Space' || e.key === ' ') handleBoxClick() }}
          className={cn(
            'relative w-full h-80 sm:h-96 rounded-2xl flex flex-col items-center justify-center p-6 select-none cursor-pointer transition-all duration-150 shadow-xl border overflow-hidden focus:outline-none focus:ring-4 focus:ring-primary/40',
            testState === 'waiting' && 'bg-gradient-to-br from-red-600 to-rose-700 text-white border-red-500/40',
            testState === 'ready' && 'bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-400/50 shadow-emerald-500/20',
            testState === 'too-early' && 'bg-gradient-to-br from-amber-600 to-orange-700 text-white border-amber-500/40',
            testState === 'round-result' && 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700',
            testState === 'idle' && 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-500/40'
          )}
        >
          <AnimatePresence mode="wait">
            {testState === 'waiting' && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center space-y-3 pointer-events-none"
              >
                <div className="mx-auto size-12 rounded-full bg-white/20 flex items-center justify-center animate-pulse">
                  <div className="size-5 rounded-full bg-white" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold">Wait for green...</h2>
                <p className="text-white/80 text-xs">Do not click yet!</p>
              </motion.div>
            )}

            {testState === 'ready' && (
              <motion.div
                key="ready"
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-center space-y-3 pointer-events-none"
              >
                <div className="mx-auto size-12 rounded-full bg-white flex items-center justify-center text-green-600 shadow-md">
                  <Zap className="size-6 fill-current" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">CLICK NOW!</h2>
              </motion.div>
            )}

            {testState === 'too-early' && (
              <motion.div
                key="too-early"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="text-center space-y-3 pointer-events-none"
              >
                <AlertTriangle className="size-10 mx-auto text-white/90" />
                <h2 className="text-xl font-bold">Too soon!</h2>
                <p className="text-white/80 text-xs">You clicked before the screen turned green.</p>
                <p className="text-xs bg-white/20 px-3.5 py-1 rounded-full inline-block">Click to try this round again</p>
              </motion.div>
            )}

            {testState === 'round-result' && (
              <motion.div
                key="round-result"
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="text-center space-y-2 pointer-events-none"
              >
                <h3 className="text-3xl sm:text-4xl font-bold tracking-tight">
                  {lastTime} <span className="text-lg font-medium text-white/70">ms</span>
                </h3>
                <p className="text-xs text-white/75">{getPercentile(lastTime)}</p>
                <p className="text-xs bg-white/10 px-3.5 py-1 rounded-full inline-block mt-2">
                  Click to continue ({rounds.length}/{TOTAL_ROUNDS})
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Round Progress Dots */}
        <div className="grid grid-cols-5 gap-2">
          {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
            const r = rounds[i]
            return (
              <div
                key={i}
                className={cn(
                  'flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all',
                  r ? 'bg-primary/5 border-primary/20 text-foreground' : 'bg-muted/30 border-dashed border-border/50 text-muted-foreground'
                )}
              >
                <span className="text-[10px] text-muted-foreground uppercase font-semibold">Round {i + 1}</span>
                <span className="text-xs font-bold mt-0.5">{r ? `${r.timeMs}ms` : '—'}</span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // =======================================================
  // Render: Results (Preserving user's compact layout)
  // =======================================================

  if (phase === 'results' && metrics) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className="overflow-hidden border border-amber-500/20 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-amber-500 to-amber-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="size-6 text-success" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{t(language, 'reaction.results.title')}</CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {t(language, 'reaction.results.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Top Score Banner */}
            <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/20 gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400">
                  <Trophy className="size-5" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium">Cognitive Score</p>
                  <p className="text-2xl font-black text-foreground tabular-nums">
                    {metrics.moduleScore} <span className="text-sm font-normal text-muted-foreground">/ 100</span>
                  </p>
                </div>
              </div>
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-xs px-3 py-1">
                {metrics.performanceRating}
              </Badge>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <MetricCard
                label={t(language, 'reaction.results.avgTime')}
                value={`${metrics.avgReactionTimeMs}`}
                unit="ms"
                color="text-amber-500"
              />
              <MetricCard
                label={t(language, 'reaction.results.fastest')}
                value={`${metrics.fastestReactionTimeMs}`}
                unit="ms"
                color="text-emerald-500"
              />
              <MetricCard
                label={t(language, 'reaction.results.slowest')}
                value={`${metrics.slowestReactionTimeMs}`}
                unit="ms"
                color="text-rose-500"
              />
              <MetricCard
                label={t(language, 'reaction.results.falseStarts')}
                value={`${metrics.falseStartCount}`}
                unit=""
                color={metrics.falseStartCount > 0 ? 'text-rose-500' : 'text-emerald-500'}
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <MetricCard
                label={t(language, 'reaction.results.variability')}
                value={`±${metrics.responseVariabilityMs}`}
                unit="ms"
                color="text-amber-500"
              />
              <MetricCard
                label="Consistency (CV)"
                value={`${metrics.coefficientOfVariation}`}
                unit=""
                color="text-blue-500"
              />
            </div>

            {/* Round Breakdown */}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
              <p className="text-[11px] font-semibold uppercase text-muted-foreground tracking-wider">
                Round-by-Round Breakdown
              </p>
              <div className="grid grid-cols-5 gap-2">
                {metrics.allReactionTimes.map((time, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-lg bg-card border text-center shadow-2xs"
                  >
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">R{idx + 1}</span>
                    <p className="text-xs font-bold mt-0.5">{time}ms</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                id="reaction-retry"
                variant="outline"
                onClick={handleReset}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <RotateCcw className="size-4" />
                {t(language, 'reaction.results.retry')}
              </Button>
              <Button
                id="reaction-submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium bg-amber-600 hover:bg-amber-700 text-white shadow-sm"
              >
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

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center shadow-2xs">
      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">{label}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', color)}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}
