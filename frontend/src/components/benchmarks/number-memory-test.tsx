// ===========================================================
// NeuroScreen — Human Benchmark: Number Memory Test (Digit Span)
// ===========================================================
// Remember an increasingly long number.
// Measures forward digit span working memory capacity.
// ===========================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Hash, Trophy, RotateCcw, ArrowRight, CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { benchmarkApi } from '@/services/benchmark-api'

type Phase = 'idle' | 'memorizing' | 'input' | 'level-result' | 'game-over'

export function NumberMemoryBenchmark() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(1)
  const [targetNumber, setTargetNumber] = useState('')
  const [userInput, setUserInput] = useState('')
  const [timeRemainingPercent, setTimeRemainingPercent] = useState(100)
  const [bestLevel, setBestLevel] = useState<number>(() => {
    const saved = localStorage.getItem('neuroscreen_hb_number_best')
    return saved ? Number(saved) : 0
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
  }

  useEffect(() => {
    return () => clearTimers()
  }, [])

  const generateNumber = (digitCount: number) => {
    let result = ''
    // First digit 1-9 to avoid leading zero
    result += Math.floor(Math.random() * 9) + 1
    for (let i = 1; i < digitCount; i++) {
      result += Math.floor(Math.random() * 10)
    }
    return result
  }

  const startLevel = useCallback((lvl: number) => {
    clearTimers()
    const digits = lvl + 2 // Level 1 is 3 digits, Level 2 is 4 digits, etc.
    const num = generateNumber(digits)
    setTargetNumber(num)
    setUserInput('')
    setPhase('memorizing')
    setTimeRemainingPercent(100)

    // Duration scales with number length: base 1400ms + 750ms per digit
    const durationMs = 1400 + digits * 750
    const start = performance.now()

    intervalRef.current = setInterval(() => {
      const elapsed = performance.now() - start
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setTimeRemainingPercent(remaining)
    }, 25)

    timerRef.current = setTimeout(() => {
      clearTimers()
      setPhase('input')
      setTimeout(() => inputRef.current?.focus(), 50)
    }, durationMs)
  }, [])

  const startGame = () => {
    setLevel(1)
    startLevel(1)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (phase !== 'input') return

    const isCorrect = userInput.trim() === targetNumber

    if (isCorrect) {
      if (level > bestLevel) {
        setBestLevel(level)
        localStorage.setItem('neuroscreen_hb_number_best', String(level))
      }
      setPhase('level-result')
    } else {
      const finalDigits = Math.max(0, level + 1)
      benchmarkApi.record({
        test_type: 'number',
        score: finalDigits,
        unit: 'digits',
        details: { level: level - 1, targetNumber, userAnswer: userInput.trim() },
      }).catch(() => {})
      setPhase('game-over')
    }
  }

  const handleNextLevel = () => {
    const nextLvl = level + 1
    setLevel(nextLvl)
    startLevel(nextLvl)
  }

  const getPercentile = (digitsSpan: number) => {
    if (digitsSpan >= 13) return 'Top 0.1% (Exceptional Working Memory)'
    if (digitsSpan >= 10) return 'Top 5% (Superior Digit Span)'
    if (digitsSpan >= 8) return 'Top 20% (Above Average)'
    if (digitsSpan >= 7) return 'Top 50% (Average / Normal Human Span: 7±2)'
    if (digitsSpan >= 5) return 'Top 75% (Moderate)'
    return 'Bottom 25% (Mild Attention Deficit)'
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-blue-500/30">
            <Hash className="size-3.5 text-blue-500" />
            Human Benchmark: Number Memory
          </Badge>
          {(phase === 'memorizing' || phase === 'input' || phase === 'level-result') && (
            <span className="text-xs text-muted-foreground font-medium">
              Level {level} ({level + 2} Digits)
            </span>
          )}
        </div>
        {bestLevel > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Trophy className="size-3.5" />
            <span>Personal Best: <strong>Level {bestLevel} ({bestLevel + 2} Digits)</strong></span>
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="border border-border/70 overflow-hidden shadow-md bg-card/90 backdrop-blur-sm">
        {phase === 'idle' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center ring-1 ring-blue-500/20">
              <Hash className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight">Number Memory Test</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                The average person can remember 7 numbers at once. Can you do more? Remember the sequence and type it back.
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="px-6 py-2 h-10 text-sm font-semibold shadow-md bg-blue-600 hover:bg-blue-700 text-white"
              >
                Start Number Memory
              </Button>
            </div>
          </CardContent>
        )}

        {phase === 'memorizing' && (
          <CardContent className="p-6 sm:p-10 text-center space-y-6">
            <div className="space-y-2">
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Memorize this number:
              </p>
              <motion.div
                initial={{ scale: 0.9 }}
                animate={{ scale: 1 }}
                className="text-3xl sm:text-4xl font-bold font-mono tracking-widest text-primary py-3 select-none"
              >
                {targetNumber}
              </motion.div>
            </div>

            {/* Countdown progress bar */}
            <div className="w-full max-w-md mx-auto h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 transition-all duration-75"
                style={{ width: `${timeRemainingPercent}%` }}
              />
            </div>
          </CardContent>
        )}

        {phase === 'input' && (
          <CardContent className="p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-1">
              <h3 className="text-lg font-bold">What was the number?</h3>
              <p className="text-xs text-muted-foreground">Press ENTER or click Submit</p>
            </div>

            <form onSubmit={handleSubmit} className="max-w-md mx-auto space-y-4">
              <Input
                ref={inputRef}
                type="text"
                pattern="[0-9]*"
                inputMode="numeric"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value.replace(/\D/g, ''))}
                placeholder="Type the number here..."
                className="text-center text-xl font-mono h-11 tracking-widest font-bold"
                autoFocus
              />
              <Button
                type="submit"
                disabled={!userInput.trim()}
                className="w-full h-10 text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white"
              >
                Submit
              </Button>
            </form>
          </CardContent>
        )}

        {phase === 'level-result' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center ring-1 ring-emerald-500/20">
              <CheckCircle2 className="size-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-foreground">Correct!</h3>
              <p className="text-sm text-muted-foreground font-mono">{targetNumber}</p>
            </div>
            <p className="text-xs text-muted-foreground uppercase font-semibold">Ready for Level {level + 1} ({level + 3} digits)</p>
            <div className="pt-2">
              <Button
                onClick={handleNextLevel}
                className="gap-2 px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
              >
                <span>Next Level</span>
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        )}

        {phase === 'game-over' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center ring-1 ring-rose-500/20">
              <XCircle className="size-6" />
            </div>
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3 max-w-sm mx-auto p-3.5 rounded-xl bg-muted/40 border border-border/50 text-left">
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">Number was</span>
                  <p className="font-mono font-bold text-sm text-foreground break-all">{targetNumber}</p>
                </div>
                <div>
                  <span className="text-[11px] text-muted-foreground uppercase font-semibold">Your answer</span>
                  <p className="font-mono font-bold text-sm text-rose-500 line-through break-all">{userInput || '—'}</p>
                </div>
              </div>

              <div className="pt-1">
                <p className="text-xs uppercase font-semibold text-muted-foreground">Highest Level Achieved</p>
                <h2 className="text-3xl font-bold mt-1">Level {level - 1} <span className="text-base font-semibold text-muted-foreground">({Math.max(0, level + 1)} digits)</span></h2>
                <p className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">
                  {getPercentile(level + 1)}
                </p>
              </div>
            </div>

            <div className="pt-2">
              <Button
                onClick={startGame}
                className="gap-2 px-6 h-10 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm"
              >
                <RotateCcw className="size-4" />
                Try Again
              </Button>
            </div>
          </CardContent>
        )}
      </Card>
    </div>
  )
}
