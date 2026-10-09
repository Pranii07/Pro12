// ===========================================================
// NeuroScreen — Typing Analysis Module
// ===========================================================
// Interactive typing test that measures:
//   - WPM (words per minute)
//   - CPM (characters per minute)
//   - Accuracy (%)
//   - Backspace count
//   - Average hold time (ms) — key press → key release
//   - Average flight time (ms) — key release → next key press
//
// Timing uses performance.now() for sub-millisecond precision.
// No permanent raw keystroke log is retained — only aggregate
// metrics are submitted to the backend.
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Keyboard,
  Play,
  RotateCcw,
  CheckCircle2,
  SkipForward,
  Clock,
  Target,
  Gauge,
  Delete,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/types/database'

// -------------------------------------------------------
// Typing Prompts (English + Kannada transliterated)
// -------------------------------------------------------

const TYPING_PROMPTS: Record<LanguageCode, string[]> = {
  en: [
    'The quick brown fox jumps over the lazy dog near the river bank on a warm summer evening.',
    'Medical research continues to advance our understanding of the human brain and nervous system every year.',
    'Technology is transforming healthcare through artificial intelligence and machine learning applications worldwide.',
    'Neurological screening can help identify patterns early when combined with behavioural assessment tools.',
    'The morning sunlight filtered through the curtains as she sat down to begin her daily writing practice.',
  ],
  kn: [
    'Bega kaaphi kudiyuvudu nanage tumba ishta. Namma mane hattira ondu doddha tota ide.',
    'Arogya bahala mukhya. Dina vyaayaama maaduvudu namma dehakke olleyadhu.',
    'Vignaana mattu tantra jnaana namma jeevanavannuu sulabhha maadide.',
    'Nadevalike vishleyshane naramandala aarogya kurithu arthha maadikollalu sahaaya maaduttadhe.',
    'Balagaali belligge tottadalli hoo galannuu noadi ananda pattidhenu.',
  ],
}

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface TypingModuleProps {
  language: LanguageCode
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'typing' | 'results'

interface KeyEvent {
  key: string
  pressTime: number
  releaseTime: number
}

interface TypingMetrics {
  wpm: number
  cpm: number
  accuracy: number
  backspaceCount: number
  avgHoldTimeMs: number
  avgFlightTimeMs: number
  totalTimeSeconds: number
  totalCharsTyped: number
  correctChars: number
  errorCount: number
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function TypingModule({ language, onComplete, onSkip }: TypingModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [prompt, setPrompt] = useState('')
  const [typed, setTyped] = useState('')
  const [startTime, setStartTime] = useState(0)
  const [, setEndTime] = useState(0)
  const [metrics, setMetrics] = useState<TypingMetrics | null>(null)
  const [currentCharIndex, setCurrentCharIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Keystroke timing data (transient — not persisted)
  const keyEventsRef = useRef<KeyEvent[]>([])
  const activeKeysRef = useRef<Map<string, number>>(new Map())
  const backspaceCountRef = useRef(0)
  const lastReleaseTimeRef = useRef(0)
  const flightTimesRef = useRef<number[]>([])
  const holdTimesRef = useRef<number[]>([])
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Pick a random prompt on mount
  useEffect(() => {
    const prompts = TYPING_PROMPTS[language] ?? TYPING_PROMPTS.en
    const random = prompts[Math.floor(Math.random() * prompts.length)]
    setPrompt(random)
  }, [language])

  // -------------------------------------------------------
  // Start the typing test
  // -------------------------------------------------------
  const handleStart = useCallback(() => {
    setPhase('typing')
    setTyped('')
    setCurrentCharIndex(0)
    backspaceCountRef.current = 0
    keyEventsRef.current = []
    activeKeysRef.current.clear()
    lastReleaseTimeRef.current = 0
    flightTimesRef.current = []
    holdTimesRef.current = []
    setStartTime(performance.now())
    setEndTime(0)
    // Focus the textarea after transition
    setTimeout(() => inputRef.current?.focus(), 100)
  }, [])

  // -------------------------------------------------------
  // Key event handlers (performance.now() based)
  // -------------------------------------------------------
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now()

    if (e.key === 'Backspace') {
      backspaceCountRef.current++
    }

    // Track flight time: time from last key release to this key press
    if (lastReleaseTimeRef.current > 0 && !activeKeysRef.current.has(e.key)) {
      const flight = now - lastReleaseTimeRef.current
      if (flight > 0 && flight < 5000) { // Ignore unreasonable gaps (> 5s)
        flightTimesRef.current.push(flight)
      }
    }

    // Record press time for this key
    if (!activeKeysRef.current.has(e.key)) {
      activeKeysRef.current.set(e.key, now)
    }
  }, [])

  const handleKeyUp = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const now = performance.now()
    const pressTime = activeKeysRef.current.get(e.key)

    if (pressTime !== undefined) {
      const holdTime = now - pressTime
      if (holdTime > 0 && holdTime < 5000) { // Ignore unreasonable holds
        holdTimesRef.current.push(holdTime)
      }
      keyEventsRef.current.push({ key: e.key, pressTime, releaseTime: now })
      activeKeysRef.current.delete(e.key)
    }

    lastReleaseTimeRef.current = now
  }, [])

  // -------------------------------------------------------
  // Compute metrics
  // -------------------------------------------------------
  const computeMetrics = useCallback((typedText: string, promptText: string, startMs: number, endMs: number): TypingMetrics => {
    const totalTimeSeconds = (endMs - startMs) / 1000
    const totalTimeMinutes = totalTimeSeconds / 60

    const totalCharsTyped = typedText.length
    let correctChars = 0
    let errorCount = 0

    for (let i = 0; i < typedText.length; i++) {
      if (i < promptText.length && typedText[i] === promptText[i]) {
        correctChars++
      } else {
        errorCount++
      }
    }

    // WPM: standard is 5 characters = 1 word, only correct chars counted
    const wpm = totalTimeMinutes > 0 ? Math.round((correctChars / 5) / totalTimeMinutes) : 0
    const cpm = totalTimeMinutes > 0 ? Math.round(totalCharsTyped / totalTimeMinutes) : 0
    const accuracy = totalCharsTyped > 0 ? Math.round((correctChars / totalCharsTyped) * 100) : 0

    const holdTimes = holdTimesRef.current
    const flightTimes = flightTimesRef.current
    const avgHoldTimeMs = holdTimes.length > 0
      ? Math.round(holdTimes.reduce((a, b) => a + b, 0) / holdTimes.length)
      : 0
    const avgFlightTimeMs = flightTimes.length > 0
      ? Math.round(flightTimes.reduce((a, b) => a + b, 0) / flightTimes.length)
      : 0

    return {
      wpm,
      cpm,
      accuracy,
      backspaceCount: backspaceCountRef.current,
      avgHoldTimeMs,
      avgFlightTimeMs,
      totalTimeSeconds: Math.round(totalTimeSeconds * 10) / 10,
      totalCharsTyped,
      correctChars,
      errorCount,
    }
  }, [])

  // -------------------------------------------------------
  // Handle text input change
  // -------------------------------------------------------
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    setTyped(value)
    setCurrentCharIndex(value.length)

    // Auto-complete when the user finishes typing the full prompt
    if (value.length >= prompt.length) {
      const end = performance.now()
      setEndTime(end)
      const result = computeMetrics(value, prompt, startTime, end)
      setMetrics(result)
      setPhase('results')
    }
  }, [prompt, startTime, computeMetrics])

  // -------------------------------------------------------
  // Manual finish (if user wants to stop before typing everything)
  // -------------------------------------------------------
  const handleFinishEarly = useCallback(() => {
    if (typed.length < 10) return // Need at least some data
    const end = performance.now()
    setEndTime(end)
    const result = computeMetrics(typed, prompt, startTime, end)
    setMetrics(result)
    setPhase('results')
  }, [typed, prompt, startTime, computeMetrics])

  // -------------------------------------------------------
  // Submit results
  // -------------------------------------------------------
  const handleSubmit = useCallback(() => {
    if (!metrics) return
    setIsSubmitting(true)

    // Compute a behavioural typing score (0–100)
    // Weighted: accuracy (40%), WPM normalized (30%), consistency via hold time (30%)
    const wpmScore = Math.min(metrics.wpm / 80, 1) * 100 // 80 WPM = max score
    const accuracyScore = metrics.accuracy
    const consistencyScore = metrics.avgHoldTimeMs > 0
      ? Math.max(0, 100 - Math.abs(metrics.avgHoldTimeMs - 120) * 0.5) // 120ms is "ideal"
      : 50
    const score = Math.round(accuracyScore * 0.4 + wpmScore * 0.3 + consistencyScore * 0.3)

    const features = {
      wpm: metrics.wpm,
      cpm: metrics.cpm,
      accuracy: metrics.accuracy,
      backspace_count: metrics.backspaceCount,
      avg_hold_time_ms: metrics.avgHoldTimeMs,
      avg_flight_time_ms: metrics.avgFlightTimeMs,
    }

    onComplete(features, Math.min(100, Math.max(0, score)), metrics.totalTimeSeconds)
  }, [metrics, onComplete])

  // -------------------------------------------------------
  // Reset
  // -------------------------------------------------------
  const handleReset = useCallback(() => {
    setPhase('instructions')
    setTyped('')
    setCurrentCharIndex(0)
    setMetrics(null)
    const prompts = TYPING_PROMPTS[language] ?? TYPING_PROMPTS.en
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)])
  }, [language])

  // -------------------------------------------------------
  // Render: character-by-character diff display
  // -------------------------------------------------------
  const renderPromptChars = () => {
    return prompt.split('').map((char, idx) => {
      let className = 'transition-colors duration-100 '
      if (idx < typed.length) {
        className += typed[idx] === char ? 'text-success' : 'text-destructive bg-destructive/10 rounded-sm'
      } else if (idx === currentCharIndex) {
        className += 'bg-primary/20 text-foreground rounded-sm animate-pulse'
      } else {
        className += 'text-muted-foreground/60'
      }
      return (
        <span key={idx} className={className}>
          {char}
        </span>
      )
    })
  }

  // -------------------------------------------------------
  // Render: Instructions phase
  // -------------------------------------------------------
  if (phase === 'instructions') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className="overflow-hidden border border-blue-500/20 shadow-md">
          <div className="h-1.5 bg-blue-500/10" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10">
                <Keyboard className="size-6 text-blue-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{t(language, 'module.typing')}</CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {t(language, 'typing.instructions')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="rounded-xl bg-muted/50 p-4 sm:p-5 space-y-2.5">
              <h4 className="font-semibold text-xs sm:text-sm">{t(language, 'typing.whatWeMessure')}</h4>
              <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Gauge className="size-4 text-blue-500" />
                  {t(language, 'typing.metric.speed')}
                </li>
                <li className="flex items-center gap-2">
                  <Target className="size-4 text-blue-500" />
                  {t(language, 'typing.metric.accuracy')}
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-blue-500" />
                  {t(language, 'typing.metric.timing')}
                </li>
                <li className="flex items-center gap-2">
                  <Delete className="size-4 text-blue-500" />
                  {t(language, 'typing.metric.corrections')}
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                id="typing-skip"
                variant="outline"
                onClick={onSkip}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button
                id="typing-start"
                onClick={handleStart}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <Play className="size-4" />
                {t(language, 'typing.start')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Typing phase
  // -------------------------------------------------------
  if (phase === 'typing') {
    const progress = prompt.length > 0 ? Math.round((typed.length / prompt.length) * 100) : 0
    // const elapsed = startTime > 0 ? Math.round((performance.now() - startTime) / 1000) : 0

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="mx-auto w-full max-w-3xl space-y-4"
      >
        {/* Stats bar */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <Badge variant="outline" className="font-mono text-xs">
              {progress}%
            </Badge>
            <span className="text-muted-foreground text-xs sm:text-sm">
              {typed.length} / {prompt.length} {t(language, 'typing.chars')}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleFinishEarly}
            disabled={typed.length < 10}
            className="text-xs h-8"
          >
            {t(language, 'typing.finishEarly')}
          </Button>
        </div>

        {/* Prompt display */}
        <Card className="border border-blue-500/20 shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t(language, 'typing.prompt')}
            </p>
            <p className="select-none font-mono text-sm sm:text-base leading-relaxed tracking-wide">
              {renderPromptChars()}
            </p>
          </CardContent>
        </Card>

        {/* Typing input */}
        <Card>
          <CardContent className="p-4">
            <textarea
              ref={inputRef}
              value={typed}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onKeyUp={handleKeyUp}
              spellCheck={false}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              className="h-28 w-full resize-none rounded-lg border-0 bg-muted/50 p-3.5 font-mono text-sm sm:text-base outline-none ring-1 ring-border focus:ring-2 focus:ring-primary"
              placeholder={t(language, 'typing.placeholder')}
            />
          </CardContent>
        </Card>

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-blue-500 to-blue-400"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.2 }}
          />
        </div>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Results phase
  // -------------------------------------------------------
  if (phase === 'results' && metrics) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className="overflow-hidden border border-blue-500/20 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="size-6 text-success" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{t(language, 'typing.results.title')}</CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {t(language, 'typing.results.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <MetricCard
                label={t(language, 'typing.results.wpm')}
                value={metrics.wpm.toString()}
                unit="WPM"
                color="text-blue-500"
              />
              <MetricCard
                label={t(language, 'typing.results.cpm')}
                value={metrics.cpm.toString()}
                unit="CPM"
                color="text-blue-500"
              />
              <MetricCard
                label={t(language, 'typing.results.accuracy')}
                value={`${metrics.accuracy}`}
                unit="%"
                color={metrics.accuracy >= 90 ? 'text-success' : metrics.accuracy >= 70 ? 'text-warning' : 'text-destructive'}
              />
              <MetricCard
                label={t(language, 'typing.results.backspaces')}
                value={metrics.backspaceCount.toString()}
                unit=""
                color="text-muted-foreground"
              />
              <MetricCard
                label={t(language, 'typing.results.holdTime')}
                value={metrics.avgHoldTimeMs.toString()}
                unit="ms"
                color="text-purple-500"
              />
              <MetricCard
                label={t(language, 'typing.results.flightTime')}
                value={metrics.avgFlightTimeMs.toString()}
                unit="ms"
                color="text-purple-500"
              />
            </div>

            {/* Time taken */}
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground font-medium">
              <Clock className="size-3.5" />
              {t(language, 'typing.results.time')}: {metrics.totalTimeSeconds}s
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button
                id="typing-retry"
                variant="outline"
                onClick={handleReset}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <RotateCcw className="size-4" />
                {t(language, 'typing.results.retry')}
              </Button>
              <Button
                id="typing-submit"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
              >
                <CheckCircle2 className="size-4" />
                {isSubmitting ? t(language, 'typing.results.submitting') : t(language, 'typing.results.submit')}
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

function MetricCard({
  label,
  value,
  unit,
  color,
}: {
  label: string
  value: string
  unit: string
  color: string
}) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center shadow-xs">
      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">{label}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', color)}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}
