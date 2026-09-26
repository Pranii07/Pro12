// ===========================================================
// NeuroScreen — Memory Tests Module
// ===========================================================
// Four sub-tests:
//   1. Word Recall — show words, then recall them
//   2. Number Recall — show number sequence, type it back
//   3. Visual Pattern — show grid pattern, recreate it
//   4. Pattern Sequence — show colour sequence, repeat it
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
  Grid3X3,
  Palette,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/types/database'

// -------------------------------------------------------
// Test Data
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

// 5x5 grid patterns (1 = filled, 0 = empty)
const GRID_PATTERNS = [
  [
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
    [0, 1, 0, 1, 0],
    [1, 0, 1, 0, 1],
  ],
  [
    [1, 1, 0, 0, 0],
    [1, 1, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 1, 1],
    [0, 0, 0, 1, 1],
  ],
  [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
  ],
]

// Colour sequences
const SEQUENCE_COLORS = ['red', 'blue', 'green', 'yellow', 'purple']
const COLOR_SEQUENCES = [
  [0, 2, 1, 3],
  [4, 1, 0, 3, 2],
  [2, 0, 4, 1, 3, 0],
]

const COLOR_CLASS_MAP: Record<string, { bg: string; ring: string }> = {
  red:    { bg: 'bg-red-500', ring: 'ring-red-500' },
  blue:   { bg: 'bg-blue-500', ring: 'ring-blue-500' },
  green:  { bg: 'bg-green-500', ring: 'ring-green-500' },
  yellow: { bg: 'bg-yellow-400', ring: 'ring-yellow-400' },
  purple: { bg: 'bg-purple-500', ring: 'ring-purple-500' },
}

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface MemoryModuleProps {
  language: LanguageCode
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'testing' | 'results'
type SubTest = 'words' | 'numbers' | 'pattern' | 'sequence'

interface SubTestResult {
  type: SubTest
  accuracy: number
  completionTimeMs: number
}

interface MemoryMetrics {
  wordRecallAccuracy: number
  numberRecallAccuracy: number
  patternMemoryAccuracy: number
  sequenceMemoryAccuracy: number
  avgCompletionTimeMs: number
}

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function MemoryModule({ language, onComplete, onSkip }: MemoryModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [currentTest, setCurrentTest] = useState<SubTest>('words')
  const [, setTestIndex] = useState(0)
  const [results, setResults] = useState<SubTestResult[]>([])
  const [metrics, setMetrics] = useState<MemoryMetrics | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const moduleStartRef = useRef(0)

  const TEST_ORDER: SubTest[] = ['words', 'numbers', 'pattern', 'sequence']

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
        const patResult = updated.find((r) => r.type === 'pattern')
        const seqResult = updated.find((r) => r.type === 'sequence')

        const avgTime = updated.reduce((sum, r) => sum + r.completionTimeMs, 0) / updated.length

        setMetrics({
          wordRecallAccuracy: wordResult?.accuracy ?? 0,
          numberRecallAccuracy: numResult?.accuracy ?? 0,
          patternMemoryAccuracy: patResult?.accuracy ?? 0,
          sequenceMemoryAccuracy: seqResult?.accuracy ?? 0,
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
      metrics.patternMemoryAccuracy +
      metrics.sequenceMemoryAccuracy
    ) / 4

    const score = Math.round(overallAccuracy)
    const totalTime = (performance.now() - moduleStartRef.current) / 1000

    const features = {
      word_recall_accuracy: metrics.wordRecallAccuracy,
      number_recall_accuracy: metrics.numberRecallAccuracy,
      image_memory_accuracy: metrics.patternMemoryAccuracy,
      pattern_memory_accuracy: metrics.sequenceMemoryAccuracy,
      avg_completion_time_ms: metrics.avgCompletionTimeMs,
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
                  <Grid3X3 className="size-4 text-purple-500" />
                  {t(language, 'memory.test.pattern')}
                </li>
                <li className="flex items-center gap-2">
                  <Palette className="size-4 text-purple-500" />
                  {t(language, 'memory.test.sequence')}
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
          {currentTest === 'pattern' && (
            <PatternMemoryTest key="pattern" language={language} onComplete={handleSubTestComplete} />
          )}
          {currentTest === 'sequence' && (
            <SequenceMemoryTest key="sequence" language={language} onComplete={handleSubTestComplete} />
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
            <div className="grid grid-cols-2 gap-3">
              <MetricCard label={t(language, 'memory.results.words')} value={`${metrics.wordRecallAccuracy}`} unit="%" color="text-purple-500" />
              <MetricCard label={t(language, 'memory.results.numbers')} value={`${metrics.numberRecallAccuracy}`} unit="%" color="text-purple-500" />
              <MetricCard label={t(language, 'memory.results.pattern')} value={`${metrics.patternMemoryAccuracy}`} unit="%" color="text-purple-500" />
              <MetricCard label={t(language, 'memory.results.sequence')} value={`${metrics.sequenceMemoryAccuracy}`} unit="%" color="text-purple-500" />
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
// Sub-test: Word Recall
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

  // Show words for 5 seconds, then switch to recall
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
    const recalled = input.toLowerCase().split(/[\s,]+/).filter(Boolean)
    const correct = words.filter((w) => recalled.includes(w.toLowerCase()))
    const accuracy = Math.round((correct.length / words.length) * 100)
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
              <div className="flex flex-wrap gap-3 justify-center py-6">
                {words.map((word, idx) => (
                  <motion.div
                    key={word}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="rounded-xl border-2 border-purple-500/20 bg-purple-500/5 px-5 py-3 text-lg font-semibold"
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
                className="font-mono"
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
// Sub-test: Number Recall
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
  const [countdown, setCountdown] = useState(4)
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
// Sub-test: Visual Pattern Memory (5x5 grid)
// ===============================================================

function PatternMemoryTest({
  language,
  onComplete,
}: {
  language: LanguageCode
  onComplete: (result: SubTestResult) => void
}) {
  const [pattern] = useState(() => GRID_PATTERNS[Math.floor(Math.random() * GRID_PATTERNS.length)])
  const [showPhase, setShowPhase] = useState<'show' | 'recall'>('show')
  const [userGrid, setUserGrid] = useState<number[][]>(() =>
    Array.from({ length: 5 }, () => Array(5).fill(0))
  )
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

  const toggleCell = (row: number, col: number) => {
    setUserGrid((prev) =>
      prev.map((r, ri) =>
        ri === row ? r.map((c, ci) => (ci === col ? (c === 1 ? 0 : 1) : c)) : r
      )
    )
  }

  const handleSubmit = () => {
    let correct = 0
    let total = 0
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        total++
        if (userGrid[r][c] === pattern[r][c]) correct++
      }
    }
    const accuracy = Math.round((correct / total) * 100)
    const completionTimeMs = Math.round(performance.now() - startTimeRef.current)
    onComplete({ type: 'pattern', accuracy, completionTimeMs })
  }

  const renderGrid = (grid: number[][], interactive: boolean) => (
    <div className="inline-grid grid-cols-5 gap-1.5">
      {grid.map((row, ri) =>
        row.map((cell, ci) => (
          <motion.button
            key={`${ri}-${ci}`}
            type="button"
            className={cn(
              'size-10 rounded-lg border-2 transition-all sm:size-12',
              cell === 1
                ? 'border-purple-500 bg-purple-500 shadow-md shadow-purple-500/20'
                : 'border-border bg-muted/50 hover:border-purple-500/50',
              interactive && 'cursor-pointer active:scale-95',
              !interactive && 'cursor-default',
            )}
            onClick={() => interactive && toggleCell(ri, ci)}
            whileTap={interactive ? { scale: 0.9 } : undefined}
            disabled={!interactive}
          />
        ))
      )}
    </div>
  )

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <Card>
        <CardContent className="p-6 space-y-4">
          {showPhase === 'show' ? (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="size-4 text-purple-500" />
                  <span className="font-medium">{t(language, 'memory.pattern.memorize')}</span>
                </div>
                <Badge variant="outline" className="font-mono">{countdown}s</Badge>
              </div>
              <div className="flex justify-center py-4">
                {renderGrid(pattern, false)}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <Grid3X3 className="size-4 text-purple-500" />
                <span className="font-medium">{t(language, 'memory.pattern.recall')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t(language, 'memory.pattern.recallHint')}</p>
              <div className="flex justify-center py-4">
                {renderGrid(userGrid, true)}
              </div>
              <Button onClick={handleSubmit} className="w-full gap-2">
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
// Sub-test: Colour Sequence Memory
// ===============================================================

function SequenceMemoryTest({
  language,
  onComplete,
}: {
  language: LanguageCode
  onComplete: (result: SubTestResult) => void
}) {
  const [sequence] = useState(() => COLOR_SEQUENCES[Math.floor(Math.random() * COLOR_SEQUENCES.length)])
  const [showPhase, setShowPhase] = useState<'show' | 'recall'>('show')
  const [highlightIdx, setHighlightIdx] = useState(-1)
  const [userSequence, setUserSequence] = useState<number[]>([])
  const startTimeRef = useRef(0)

  // Animate the sequence playback
  useEffect(() => {
    if (showPhase !== 'show') return
    let idx = 0
    const interval = setInterval(() => {
      if (idx < sequence.length) {
        setHighlightIdx(idx)
        idx++
      } else {
        clearInterval(interval)
        // Brief pause, then switch to recall
        setTimeout(() => {
          setHighlightIdx(-1)
          setShowPhase('recall')
          startTimeRef.current = performance.now()
        }, 600)
      }
    }, 800)
    return () => clearInterval(interval)
  }, [showPhase, sequence])

  const handleColorClick = (colorIdx: number) => {
    const next = [...userSequence, colorIdx]
    setUserSequence(next)
    if (next.length >= sequence.length) {
      // Auto-submit
      let correct = 0
      for (let i = 0; i < sequence.length; i++) {
        if (next[i] === sequence[i]) correct++
      }
      const accuracy = Math.round((correct / sequence.length) * 100)
      const completionTimeMs = Math.round(performance.now() - startTimeRef.current)
      onComplete({ type: 'sequence', accuracy, completionTimeMs })
    }
  }

  const handleUndo = () => {
    setUserSequence((prev) => prev.slice(0, -1))
  }

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
      <Card>
        <CardContent className="p-6 space-y-4">
          {showPhase === 'show' ? (
            <>
              <div className="flex items-center gap-2">
                <Eye className="size-4 text-purple-500" />
                <span className="font-medium">{t(language, 'memory.sequence.watch')}</span>
              </div>
              <div className="flex justify-center gap-3 py-6">
                {SEQUENCE_COLORS.map((color, idx) => {
                  const isHighlighted = idx === sequence[highlightIdx]
                  const colors = COLOR_CLASS_MAP[color]
                  return (
                    <motion.div
                      key={color}
                      className={cn(
                        'size-14 rounded-xl transition-all sm:size-16',
                        colors.bg,
                        isHighlighted && 'ring-4 scale-110 shadow-lg',
                        isHighlighted && colors.ring,
                        !isHighlighted && 'opacity-40 scale-100',
                      )}
                      animate={{
                        scale: isHighlighted ? 1.15 : 1,
                        opacity: isHighlighted ? 1 : 0.4,
                      }}
                      transition={{ duration: 0.2 }}
                    />
                  )
                })}
              </div>
              <p className="text-center text-sm text-muted-foreground">
                {t(language, 'memory.sequence.watchHint')}
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Palette className="size-4 text-purple-500" />
                  <span className="font-medium">{t(language, 'memory.sequence.recall')}</span>
                </div>
                <Badge variant="outline" className="font-mono">
                  {userSequence.length} / {sequence.length}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{t(language, 'memory.sequence.recallHint')}</p>

              {/* User's current selection */}
              <div className="flex justify-center gap-2 min-h-[40px]">
                {userSequence.map((colorIdx, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className={cn('size-8 rounded-lg', COLOR_CLASS_MAP[SEQUENCE_COLORS[colorIdx]].bg)}
                  />
                ))}
                {Array.from({ length: sequence.length - userSequence.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="size-8 rounded-lg border-2 border-dashed border-muted" />
                ))}
              </div>

              {/* Color buttons */}
              <div className="flex justify-center gap-3 py-2">
                {SEQUENCE_COLORS.map((color, idx) => {
                  const colors = COLOR_CLASS_MAP[color]
                  return (
                    <motion.button
                      key={color}
                      type="button"
                      className={cn(
                        'size-14 rounded-xl cursor-pointer transition-all sm:size-16',
                        colors.bg,
                        'hover:ring-4 hover:scale-105 active:scale-95',
                        colors.ring,
                      )}
                      onClick={() => handleColorClick(idx)}
                      whileTap={{ scale: 0.85 }}
                      disabled={userSequence.length >= sequence.length}
                    />
                  )
                })}
              </div>

              {userSequence.length > 0 && userSequence.length < sequence.length && (
                <Button variant="ghost" size="sm" onClick={handleUndo} className="mx-auto flex gap-1">
                  <RotateCcw className="size-3" />
                  {t(language, 'memory.sequence.undo')}
                </Button>
              )}
            </>
          )}
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
