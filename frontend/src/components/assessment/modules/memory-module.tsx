// ===========================================================
// NeuroScreen — Memory Tests Module
// ===========================================================
// Three sub-tests:
//   1. Word Recall — show words, then recall them
//   2. Number Recall — show number sequence, type it back
//   3. Image Memory Game — match 6 pairs of illustrated cards
//
// Metrics: per-test accuracy, average completion time
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Play,
  CheckCircle2,
  SkipForward,
  ArrowRight,
  RotateCcw,
  Eye,
  EyeOff,
  Clock,
  Hash,
  Type,
  Grid2X2,
  Sparkles,
  Trophy,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/types/database'

// -------------------------------------------------------
// Test Data: Word Recall & Number Sequences
// -------------------------------------------------------

const WORD_LISTS: Record<LanguageCode, string[][]> = {
  en: [
    ['apple', 'river', 'clock', 'table', 'forest', 'bridge'],
    ['garden', 'winter', 'candle', 'ocean', 'purple', 'basket'],
    ['mirror', 'thunder', 'pencil', 'silver', 'window', 'morning'],
  ],
  kn: [
    ['sebu', 'nadhi', 'gadiyaara', 'meju', 'kaadu', 'saanku'],
    ['thota', 'chali', 'deeipa', 'samudra', 'neeli', 'butti'],
    ['kannnadi', 'gududu', 'pensilu', 'belli', 'kitiki', 'balagina'],
  ],
}

const NUMBER_SEQUENCES = [
  [3, 7, 2, 9, 4],
  [8, 1, 5, 6, 3, 9],
  [4, 2, 8, 5, 1, 7, 3],
]

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface MemoryModuleProps {
  language: LanguageCode
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'testing' | 'results'
type SubTest = 'words' | 'numbers' | 'images'

interface SubTestResult {
  type: SubTest
  accuracy: number
  completionTimeMs: number
}

interface MemoryMetrics {
  wordRecallAccuracy: number
  numberRecallAccuracy: number
  imageMemoryAccuracy: number
  avgCompletionTimeMs: number
}

// -------------------------------------------------------
// Main Component
// -------------------------------------------------------

export function MemoryModule({ language, onComplete, onSkip }: MemoryModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [currentTest, setCurrentTest] = useState<SubTest>('words')
  const [, setTestIndex] = useState(0)
  const [results, setResults] = useState<SubTestResult[]>([])
  const [metrics, setMetrics] = useState<MemoryMetrics | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const moduleStartRef = useRef(0)

  const TEST_ORDER: SubTest[] = ['words', 'numbers', 'images']

  const handleStart = useCallback(() => {
    setPhase('testing')
    setCurrentTest('words')
    setTestIndex(0)
    setResults([])
    moduleStartRef.current = performance.now()
  }, [])

  const handleSubTestComplete = useCallback((result: SubTestResult) => {
    setResults((prev) => {
      const updated = [...prev, result]
      const nextIdx = TEST_ORDER.indexOf(result.type) + 1

      if (nextIdx >= TEST_ORDER.length) {
        // All tests done — compute metrics
        const wordResult = updated.find((r) => r.type === 'words')
        const numResult = updated.find((r) => r.type === 'numbers')
        const imgResult = updated.find((r) => r.type === 'images')

        const avgTime = updated.reduce((sum, r) => sum + r.completionTimeMs, 0) / updated.length

        setMetrics({
          wordRecallAccuracy: wordResult?.accuracy ?? 0,
          numberRecallAccuracy: numResult?.accuracy ?? 0,
          imageMemoryAccuracy: imgResult?.accuracy ?? 0,
          avgCompletionTimeMs: Math.round(avgTime),
        })
        setPhase('results')
      } else {
        setCurrentTest(TEST_ORDER[nextIdx])
        setTestIndex(nextIdx)
      }

      return updated
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleSubmit = useCallback(() => {
    if (!metrics) return
    setIsSubmitting(true)

    const overallAccuracy = (
      metrics.wordRecallAccuracy +
      metrics.numberRecallAccuracy +
      metrics.imageMemoryAccuracy
    ) / 3

    const score = Math.round(overallAccuracy)
    const totalTime = (performance.now() - moduleStartRef.current) / 1000

    const features = {
      word_recall_accuracy: metrics.wordRecallAccuracy,
      number_recall_accuracy: metrics.numberRecallAccuracy,
      image_memory_accuracy: metrics.imageMemoryAccuracy,
      pattern_accuracy: metrics.imageMemoryAccuracy, // Backwards-compatible alias for ML models
      pattern_memory_accuracy: metrics.imageMemoryAccuracy,
      avg_completion_time_ms: metrics.avgCompletionTimeMs,
      avg_response_time_ms: metrics.avgCompletionTimeMs,
    }

    onComplete(features, score, Math.round(totalTime * 10) / 10)
  }, [metrics, onComplete])

  const handleReset = useCallback(() => {
    setPhase('instructions')
    setCurrentTest('words')
    setTestIndex(0)
    setResults([])
    setMetrics(null)
  }, [])

  // -------------------------------------------------------
  // Instructions
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
        <Card className="overflow-hidden border-2 border-purple-500/20">
          <div className="h-1.5 bg-purple-500/10" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-purple-500/10">
                <Brain className="size-7 text-purple-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{t(language, 'module.memory')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(language, 'memory.instructions')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl bg-muted/50 p-6 space-y-3">
              <h4 className="font-medium text-sm">{t(language, 'memory.subTests')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Type className="size-4 text-purple-500" />
                  {t(language, 'memory.test.words')}
                </li>
                <li className="flex items-center gap-2">
                  <Hash className="size-4 text-purple-500" />
                  {t(language, 'memory.test.numbers')}
                </li>
                <li className="flex items-center gap-2">
                  <Grid2X2 className="size-4 text-purple-500" />
                  {t(language, 'memory.test.images')}
                </li>
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button id="memory-skip" variant="outline" onClick={onSkip} className="gap-2">
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button id="memory-start" onClick={handleStart} className="gap-2">
                <Play className="size-4" />
                {t(language, 'memory.start')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Testing phase — render current sub-test
  // -------------------------------------------------------
  if (phase === 'testing') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl space-y-4">
        {/* Sub-test progress */}
        <div className="flex items-center gap-2">
          {TEST_ORDER.map((test, idx) => {
            const done = results.some((r) => r.type === test)
            const active = test === currentTest
            return (
              <div key={test} className="flex items-center gap-2">
                <div className={cn(
                  'flex size-8 items-center justify-center rounded-full text-xs font-medium transition-colors',
                  done && 'bg-success text-success-foreground',
                  active && !done && 'bg-primary text-primary-foreground',
                  !done && !active && 'bg-muted text-muted-foreground',
                )}>
                  {done ? '✓' : idx + 1}
                </div>
                {idx < TEST_ORDER.length - 1 && (
                  <div className={cn('h-0.5 w-6', done ? 'bg-success' : 'bg-muted')} />
                )}
              </div>
            )
          })}
          <span className="ml-auto text-sm text-muted-foreground">
            {t(language, `memory.test.${currentTest}`)}
          </span>
        </div>

        <AnimatePresence mode="wait">
          {currentTest === 'words' && (
            <WordRecallTest key="words" language={language} onComplete={handleSubTestComplete} />
          )}
          {currentTest === 'numbers' && (
            <NumberRecallTest key="numbers" language={language} onComplete={handleSubTestComplete} />
          )}
          {currentTest === 'images' && (
            <ImageMemoryGameTest key="images" language={language} onComplete={handleSubTestComplete} />
          )}
        </AnimatePresence>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Results
  // -------------------------------------------------------
  if (phase === 'results' && metrics) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto max-w-2xl"
      >
        <Card className="overflow-hidden border-2 border-purple-500/20">
          <div className="h-1.5 bg-gradient-to-r from-purple-500 to-purple-400" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-success/10">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{t(language, 'memory.results.title')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(language, 'memory.results.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-3 gap-3">
              <MetricCard label={t(language, 'memory.results.words')} value={`${metrics.wordRecallAccuracy}`} unit="%" color="text-purple-500" />
              <MetricCard label={t(language, 'memory.results.numbers')} value={`${metrics.numberRecallAccuracy}`} unit="%" color="text-purple-500" />
              <MetricCard label={t(language, 'memory.results.images')} value={`${metrics.imageMemoryAccuracy}`} unit="%" color="text-purple-500" />
            </div>
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {t(language, 'memory.results.avgTime')}: {metrics.avgCompletionTimeMs}ms
            </div>
            <div className="flex items-center justify-between gap-3">
              <Button id="memory-retry" variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="size-4" />
                {t(language, 'memory.results.retry')}
              </Button>
              <Button id="memory-submit" onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                <CheckCircle2 className="size-4" />
                {isSubmitting ? t(language, 'memory.results.submitting') : t(language, 'memory.results.submit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return null
}

// ===============================================================
// Sub-test 1: Word Recall
// ===============================================================

function WordRecallTest({
  language,
  onComplete,
}: {
  language: LanguageCode
  onComplete: (result: SubTestResult) => void
}) {
  const lists = WORD_LISTS[language] ?? WORD_LISTS.en
  const [words] = useState(() => lists[Math.floor(Math.random() * lists.length)])
  const [showPhase, setShowPhase] = useState<'show' | 'recall'>('show')
  const [input, setInput] = useState('')
  const [countdown, setCountdown] = useState(5)
  const startTimeRef = useRef(0)

  useEffect(() => {
    if (showPhase !== 'show') return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setShowPhase('recall')
          startTimeRef.current = performance.now()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [showPhase])

  const handleSubmit = () => {
    const recalled = input
      .toLowerCase()
      .split(/[\s,]+/)
      .map((w) => w.trim())
      .filter(Boolean)
    const uniqueRecalled = [...new Set(recalled)]
    const correct = uniqueRecalled.filter((w) => words.map((orig) => orig.toLowerCase()).includes(w)).length
    const accuracy = Math.round((correct / words.length) * 100)
    const completionTimeMs = Math.round(performance.now() - startTimeRef.current)
    onComplete({ type: 'words', accuracy, completionTimeMs })
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <Card>
        <CardContent className="p-6 space-y-4">
          {showPhase === 'show' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-purple-500" />
                  <span className="font-medium">{t(language, 'memory.words.memorize')}</span>
                </div>
                <Badge variant="outline" className="font-mono">{countdown}s</Badge>
              </div>
              <div className="grid grid-cols-3 gap-3 py-6">
                {words.map((word, idx) => (
                  <motion.div
                    key={word}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex h-14 items-center justify-center rounded-xl border-2 border-purple-500/20 bg-purple-500/5 text-lg font-semibold capitalize"
                  >
                    {word}
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <EyeOff className="size-4 text-purple-500" />
                <span className="font-medium">{t(language, 'memory.words.recall')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t(language, 'memory.words.recallHint')}</p>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t(language, 'memory.words.placeholder')}
                className="text-base"
                autoFocus
              />
              <Button onClick={handleSubmit} className="w-full gap-2" disabled={!input.trim()}>
                <ArrowRight className="size-4" />
                {t(language, 'memory.next')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===============================================================
// Sub-test 2: Number Recall
// ===============================================================

function NumberRecallTest({
  language,
  onComplete,
}: {
  language: LanguageCode
  onComplete: (result: SubTestResult) => void
}) {
  const [sequence] = useState(() => NUMBER_SEQUENCES[Math.floor(Math.random() * NUMBER_SEQUENCES.length)])
  const [showPhase, setShowPhase] = useState<'show' | 'recall'>('show')
  const [input, setInput] = useState('')
  const [countdown, setCountdown] = useState(5)
  const startTimeRef = useRef(0)

  useEffect(() => {
    if (showPhase !== 'show') return
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          setShowPhase('recall')
          startTimeRef.current = performance.now()
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(timer)
  }, [showPhase])

  const handleSubmit = () => {
    const recalled = input.split(/[\s,]+/).map(Number).filter((n) => !isNaN(n))
    let correct = 0
    for (let i = 0; i < sequence.length; i++) {
      if (recalled[i] === sequence[i]) correct++
    }
    const accuracy = Math.round((correct / sequence.length) * 100)
    const completionTimeMs = Math.round(performance.now() - startTimeRef.current)
    onComplete({ type: 'numbers', accuracy, completionTimeMs })
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <Card>
        <CardContent className="p-6 space-y-4">
          {showPhase === 'show' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-purple-500" />
                  <span className="font-medium">{t(language, 'memory.numbers.memorize')}</span>
                </div>
                <Badge variant="outline" className="font-mono">{countdown}s</Badge>
              </div>
              <div className="flex justify-center gap-3 py-6">
                {sequence.map((num, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, rotateY: 90 }}
                    animate={{ opacity: 1, rotateY: 0 }}
                    transition={{ delay: idx * 0.15 }}
                    className="flex size-14 items-center justify-center rounded-xl border-2 border-purple-500/20 bg-purple-500/5 text-2xl font-bold"
                  >
                    {num}
                  </motion.div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <EyeOff className="size-4 text-purple-500" />
                <span className="font-medium">{t(language, 'memory.numbers.recall')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t(language, 'memory.numbers.recallHint')}</p>
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t(language, 'memory.numbers.placeholder')}
                className="font-mono text-center text-xl tracking-widest"
                autoFocus
              />
              <Button onClick={handleSubmit} className="w-full gap-2" disabled={!input.trim()}>
                <ArrowRight className="size-4" />
                {t(language, 'memory.next')}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </motion.div>
  )
}

// ===============================================================
// Sub-test 3: Image Memory Game (12 Cards / 6 Pairs)
// ===============================================================

// SVG Components matching the uploaded image items
function SunglassesSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 64" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="2" y="10" width="96" height="44" rx="22" fill="white" stroke="#111827" strokeWidth="4" />
      <circle cx="28" cy="32" r="16" fill="#7c3aed" stroke="#111827" strokeWidth="4" />
      <path d="M 18 24 A 12 12 0 0 1 34 20" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      <circle cx="72" cy="32" r="16" fill="#7c3aed" stroke="#111827" strokeWidth="4" />
      <path d="M 62 24 A 12 12 0 0 1 78 20" stroke="#38bdf8" strokeWidth="3" strokeLinecap="round" />
      <path d="M 44 30 Q 50 24 56 30" stroke="#111827" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M 12 28 L 4 30" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
      <path d="M 88 28 L 96 30" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

function PopsicleSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 70 90" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(35 35 45)">
        <rect x="30" y="52" width="10" height="26" rx="5" fill="#d97706" stroke="#111827" strokeWidth="4" />
        <path d="M 18 20 C 18 8 52 8 52 20 L 52 56 C 52 60 18 60 18 56 Z" fill="white" stroke="#111827" strokeWidth="6" strokeLinejoin="round" />
        <path d="M 21 20 C 21 12 49 12 49 20 L 49 54 C 49 57 21 57 21 54 Z" fill="#4ade80" stroke="#111827" strokeWidth="3.5" />
        <path d="M 26 20 L 26 48" stroke="#dcfce7" strokeWidth="3.5" strokeLinecap="round" />
      </g>
    </svg>
  )
}

function UmbrellaSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-30 45 45)">
        <path d="M 45 28 L 45 74 C 45 80 37 80 37 75" stroke="#111827" strokeWidth="5" strokeLinecap="round" fill="none" />
        <path d="M 12 48 C 12 22 78 22 78 48 Z" fill="white" stroke="#111827" strokeWidth="7" strokeLinejoin="round" />
        <path d="M 14 48 C 14 26 31 29 33 48 Z" fill="#ec4899" stroke="#111827" strokeWidth="3" />
        <path d="M 33 48 C 31 29 45 24 45 48 Z" fill="#facc15" stroke="#111827" strokeWidth="3" />
        <path d="M 45 48 C 45 24 59 29 57 48 Z" fill="#a855f7" stroke="#111827" strokeWidth="3" />
        <path d="M 57 48 C 59 29 76 26 76 48 Z" fill="#f43f5e" stroke="#111827" strokeWidth="3" />
        <circle cx="45" cy="22" r="3.5" fill="#111827" />
      </g>
    </svg>
  )
}

function SeashellSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <g transform="rotate(-15 45 45)">
        <path d="M 22 60 C 10 38 24 16 48 16 C 72 16 84 38 72 62 L 60 70 L 32 70 Z" fill="white" stroke="#111827" strokeWidth="7" strokeLinejoin="round" />
        <path d="M 25 58 C 15 38 27 20 48 20 C 69 20 78 38 68 60 Z" fill="#38bdf8" stroke="#111827" strokeWidth="3.5" />
        <path d="M 48 20 L 46 66" stroke="#0369a1" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 37 24 L 41 66" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
        <path d="M 59 24 L 51 66" stroke="#0284c7" strokeWidth="3" strokeLinecap="round" />
        <path d="M 28 36 L 37 66" stroke="#075985" strokeWidth="3" strokeLinecap="round" />
        <path d="M 68 36 L 55 66" stroke="#075985" strokeWidth="3" strokeLinecap="round" />
        <path d="M 32 64 L 60 64 L 54 71 L 38 71 Z" fill="#8b5cf6" stroke="#111827" strokeWidth="3.5" strokeLinejoin="round" />
      </g>
    </svg>
  )
}

function BeachBallSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 90" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="45" cy="45" r="37" fill="white" stroke="#111827" strokeWidth="7" />
      <circle cx="45" cy="45" r="34" fill="#f8fafc" stroke="#111827" strokeWidth="3.5" />
      <path d="M 45 45 L 45 11 A 34 34 0 0 1 74 27 Z" fill="#ec4899" stroke="#111827" strokeWidth="3" />
      <path d="M 45 45 L 74 27 A 34 34 0 0 1 78 52 Z" fill="#38bdf8" stroke="#111827" strokeWidth="3" />
      <path d="M 45 45 L 78 52 A 34 34 0 0 1 55 78 Z" fill="#fbbf24" stroke="#111827" strokeWidth="3" />
      <path d="M 45 45 L 55 78 A 34 34 0 0 1 21 70 Z" fill="#ec4899" stroke="#111827" strokeWidth="3" />
      <path d="M 45 45 L 21 70 A 34 34 0 0 1 12 39 Z" fill="#38bdf8" stroke="#111827" strokeWidth="3" />
      <path d="M 45 45 L 12 39 A 34 34 0 0 1 45 11 Z" fill="#fbbf24" stroke="#111827" strokeWidth="3" />
      <circle cx="45" cy="45" r="7" fill="white" stroke="#111827" strokeWidth="3" />
    </svg>
  )
}

function WatermelonSvg({ className = 'w-10 h-10' }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 84" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M 10 56 Q 45 80 80 56 L 45 10 Z" fill="white" stroke="#111827" strokeWidth="7" strokeLinejoin="round" />
      <path d="M 13 55 Q 45 76 77 55 L 73 48 Q 45 68 17 48 Z" fill="#22c55e" stroke="#111827" strokeWidth="3" />
      <path d="M 16 50 Q 45 70 74 50 L 71 46 Q 45 64 19 46 Z" fill="#bbf7d0" />
      <path d="M 20 46 Q 45 64 70 46 L 45 15 Z" fill="#f43f5e" stroke="#111827" strokeWidth="3" />
      <ellipse cx="38" cy="38" rx="2" ry="3.5" fill="#111827" />
      <ellipse cx="52" cy="38" rx="2" ry="3.5" fill="#111827" />
      <ellipse cx="45" cy="27" rx="2" ry="3.5" fill="#111827" />
      <ellipse cx="45" cy="47" rx="2" ry="3.5" fill="#111827" />
      <ellipse cx="32" cy="46" rx="2" ry="3.5" fill="#111827" />
      <ellipse cx="58" cy="46" rx="2" ry="3.5" fill="#111827" />
    </svg>
  )
}

type CardType = 'sunglasses' | 'popsicle' | 'umbrella' | 'seashell' | 'beachball' | 'watermelon'

interface GameCard {
  id: number
  type: CardType
  label: string
  bgColor: string
  Icon: React.ComponentType<{ className?: string }>
  isFlipped: boolean
  isMatched: boolean
}

const CARD_PROTOTYPES: { type: CardType; label: string; bgColor: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { type: 'sunglasses', label: 'Sunglasses', bgColor: 'bg-[#5cb85c]', Icon: SunglassesSvg },
  { type: 'popsicle',   label: 'Popsicle',   bgColor: 'bg-[#6f5499]', Icon: PopsicleSvg },
  { type: 'umbrella',   label: 'Umbrella',   bgColor: 'bg-[#d9534f]', Icon: UmbrellaSvg },
  { type: 'seashell',   label: 'Seashell',   bgColor: 'bg-[#a89f91]', Icon: SeashellSvg },
  { type: 'beachball',  label: 'Beach Ball', bgColor: 'bg-[#f0ad4e]', Icon: BeachBallSvg },
  { type: 'watermelon', label: 'Watermelon', bgColor: 'bg-[#5bc0de]', Icon: WatermelonSvg },
]

function createShuffledDeck(): GameCard[] {
  const deck: GameCard[] = []
  let idCounter = 0
  for (const proto of CARD_PROTOTYPES) {
    deck.push({ ...proto, id: idCounter++, isFlipped: false, isMatched: false })
    deck.push({ ...proto, id: idCounter++, isFlipped: false, isMatched: false })
  }
  // Fisher-Yates shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[deck[i], deck[j]] = [deck[j], deck[i]]
  }
  return deck
}

function ImageMemoryGameTest({
  language,
  onComplete,
}: {
  language: LanguageCode
  onComplete: (result: SubTestResult) => void
}) {
  const [cards, setCards] = useState<GameCard[]>(() => createShuffledDeck())
  const [flippedIndices, setFlippedIndices] = useState<number[]>([])
  const [matchedPairs, setMatchedPairs] = useState(0)
  const [moves, setMoves] = useState(0)
  const [isLocked, setIsLocked] = useState(false)
  const [isGameFinished, setIsGameFinished] = useState(false)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef(0)

  // Start timer on mount
  useEffect(() => {
    startTimeRef.current = performance.now()
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1)
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Card click handler
  const handleCardClick = (index: number) => {
    if (isLocked) return
    if (cards[index].isFlipped || cards[index].isMatched) return

    // Flip the clicked card
    const updatedCards = [...cards]
    updatedCards[index] = { ...updatedCards[index], isFlipped: true }
    setCards(updatedCards)

    const newFlipped = [...flippedIndices, index]
    setFlippedIndices(newFlipped)

    if (newFlipped.length === 2) {
      setMoves((m) => m + 1)
      setIsLocked(true)

      const [firstIdx, secondIdx] = newFlipped
      const firstCard = updatedCards[firstIdx]
      const secondCard = updatedCards[secondIdx]

      if (firstCard.type === secondCard.type) {
        // MATCH FOUND
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === firstIdx || i === secondIdx ? { ...c, isMatched: true } : c
            )
          )
          setFlippedIndices([])
          setIsLocked(false)
          setMatchedPairs((mp) => {
            const nextCount = mp + 1
            if (nextCount === 6) {
              // Game Won!
              finishGame(moves + 1)
            }
            return nextCount
          })
        }, 300)
      } else {
        // MISMATCH — flip back after brief pause
        setTimeout(() => {
          setCards((prev) =>
            prev.map((c, i) =>
              i === firstIdx || i === secondIdx ? { ...c, isFlipped: false } : c
            )
          )
          setFlippedIndices([])
          setIsLocked(false)
        }, 900)
      }
    }
  }

  const finishGame = (totalMoves: number) => {
    setIsGameFinished(true)
    const completionTimeMs = Math.round(performance.now() - startTimeRef.current)
    // 6 pairs: optimal moves = 6. Accuracy decreases as moves increase.
    const accuracy = Math.max(20, Math.min(100, Math.round((6 / Math.max(6, totalMoves)) * 100)))

    setTimeout(() => {
      onComplete({ type: 'images', accuracy, completionTimeMs })
    }, 1400)
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-4"
    >
      <Card className="overflow-hidden border-2 border-slate-800 shadow-xl bg-slate-900/90 text-white">
        {/* Memory Game Banner (styled identically to the uploaded illustration banner) */}
        <div className="bg-[#0097a7] py-2.5 px-4 text-center border-b-2 border-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-yellow-300 animate-pulse" />
            <span className="font-extrabold tracking-wider text-xl sm:text-2xl text-white uppercase drop-shadow">
              {t(language, 'memory.images.title')}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs sm:text-sm font-semibold">
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/20 text-white font-mono border-none">
              {matchedPairs} / 6 {t(language, 'memory.images.pairs')}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/20 text-white font-mono border-none">
              {moves} {t(language, 'memory.images.moves')}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 hover:bg-white/20 text-white font-mono border-none">
              {elapsedSeconds}s
            </Badge>
          </div>
        </div>

        <CardContent className="p-4 sm:p-6 space-y-4">
          <p className="text-center text-xs sm:text-sm text-slate-300">
            {t(language, 'memory.images.hint')}
          </p>

          {/* 3 rows of 4 cards (12 total cards) */}
          <div className="grid grid-cols-4 gap-2.5 sm:gap-3.5 max-w-lg mx-auto">
            {cards.map((card, idx) => {
              const isOpen = card.isFlipped || card.isMatched

              return (
                <div
                  key={card.id}
                  className="aspect-square select-none cursor-pointer [perspective:1000px]"
                  onClick={() => handleCardClick(idx)}
                >
                  <motion.div
                    className="relative w-full h-full rounded-2xl transition-transform duration-500 [transform-style:preserve-3d]"
                    animate={{ rotateY: isOpen ? 180 : 0 }}
                    whileHover={{ scale: isOpen ? 1 : 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    {/* Back of card (face-down) */}
                    <div className="absolute inset-0 w-full h-full rounded-2xl border-3 border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center shadow-lg [backface-visibility:hidden]">
                      <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
                        <Brain className="size-5" />
                      </div>
                    </div>

                    {/* Front of card (face-up image) */}
                    <div
                      className={cn(
                        'absolute inset-0 w-full h-full rounded-2xl border-3 sm:border-4 border-slate-900 flex items-center justify-center shadow-xl [backface-visibility:hidden] [transform:rotateY(180deg)]',
                        card.bgColor,
                        card.isMatched && 'ring-4 ring-emerald-400/90 brightness-105'
                      )}
                    >
                      <card.Icon className="w-10 h-10 sm:w-14 sm:h-14 drop-shadow" />
                      {card.isMatched && (
                        <div className="absolute top-1 right-1 flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                          <CheckCircle2 className="size-3.5" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                </div>
              )
            })}
          </div>

          {/* Victory Overlay if Finished */}
          <AnimatePresence>
            {isGameFinished && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="rounded-xl bg-emerald-500/20 border border-emerald-500/40 p-3 text-center flex items-center justify-center gap-3 text-emerald-300 font-semibold"
              >
                <Trophy className="size-5 text-yellow-400" />
                <span>{t(language, 'memory.images.matched')} ({moves} {t(language, 'memory.images.moves')})</span>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  )
}

// -------------------------------------------------------
// Metric Card Sub-component
// -------------------------------------------------------

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>
        {value}<span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>
      </p>
    </div>
  )
}
