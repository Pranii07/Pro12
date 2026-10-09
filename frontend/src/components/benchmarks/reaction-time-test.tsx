// ===========================================================
// NeuroScreen — Human Benchmark: Reaction Time Test
// ===========================================================
// Click when the red screen turns green as fast as you can.
// 5 rounds, measures average reaction time in ms.
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, Trophy, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { benchmarkApi } from '@/services/benchmark-api'

type State = 'idle' | 'waiting' | 'ready' | 'too-early' | 'round-result' | 'complete'

interface RoundData {
  timeMs: number
}

const TOTAL_ROUNDS = 5

export function ReactionTimeBenchmark() {
  const [state, setState] = useState<State>('idle')
  const [rounds, setRounds] = useState<RoundData[]>([])
  const [lastTime, setLastTime] = useState(0)
  const [bestScore, setBestScore] = useState<number | null>(() => {
    const saved = localStorage.getItem('neuroscreen_hb_reaction_best')
    return saved ? Number(saved) : null
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startTimeRef = useRef(0)

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  useEffect(() => {
    return () => clearTimer()
  }, [])

  const startRound = useCallback(() => {
    clearTimer()
    setState('waiting')
    // Random delay between 1.8s and 5.5s
    const delay = Math.floor(Math.random() * 3700) + 1800
    timerRef.current = setTimeout(() => {
      startTimeRef.current = performance.now()
      setState('ready')
    }, delay)
  }, [])

  const handleClick = () => {
    if (state === 'idle') {
      setRounds([])
      startRound()
    } else if (state === 'waiting') {
      clearTimer()
      setState('too-early')
    } else if (state === 'ready') {
      const elapsed = Math.round(performance.now() - startTimeRef.current)
      setLastTime(elapsed)
      const newRounds = [...rounds, { timeMs: elapsed }]
      setRounds(newRounds)

      if (newRounds.length >= TOTAL_ROUNDS) {
        const avg = Math.round(newRounds.reduce((acc, r) => acc + r.timeMs, 0) / newRounds.length)
        if (!bestScore || avg < bestScore) {
          setBestScore(avg)
          localStorage.setItem('neuroscreen_hb_reaction_best', String(avg))
        }
        benchmarkApi.record({
          test_type: 'reaction',
          score: avg,
          unit: 'ms',
          details: { rounds: newRounds.map((r) => r.timeMs) },
        }).catch(() => {})
        setState('complete')
      } else {
        setState('round-result')
      }
    } else if (state === 'too-early' || state === 'round-result') {
      startRound()
    } else if (state === 'complete') {
      setRounds([])
      startRound()
    }
  }

  const average = rounds.length > 0
    ? Math.round(rounds.reduce((acc, r) => acc + r.timeMs, 0) / rounds.length)
    : 0

  const getPercentile = (ms: number) => {
    if (ms <= 190) return 'Top 1% (Pro Gamer / Fighter Pilot)'
    if (ms <= 220) return 'Top 5% (Exceptional)'
    if (ms <= 250) return 'Top 20% (Fast Reflexes)'
    if (ms <= 300) return 'Top 50% (Normal / Healthy)'
    if (ms <= 360) return 'Top 75% (Moderate)'
    return 'Bottom 25% (Slight Delay)'
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* High score header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-primary/30">
            <Zap className="size-3.5 text-primary" />
            Human Benchmark: Reaction Time
          </Badge>
          <span className="text-xs text-muted-foreground">
            Round {Math.min(rounds.length + (state === 'waiting' || state === 'ready' ? 1 : 0), TOTAL_ROUNDS)} of {TOTAL_ROUNDS}
          </span>
        </div>
        {bestScore && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Trophy className="size-3.5" />
            <span>Personal Best: <strong>{bestScore} ms</strong></span>
          </div>
        )}
      </div>

      {/* Main Interactive Screen */}
      <div
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if (e.code === 'Space' || e.key === ' ') handleClick() }}
        className={cn(
          'relative w-full h-96 rounded-2xl flex flex-col items-center justify-center p-8 select-none cursor-pointer transition-all duration-150 shadow-xl border overflow-hidden focus:outline-none focus:ring-4 focus:ring-primary/40',
          state === 'idle' && 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-500/40 hover:brightness-105',
          state === 'waiting' && 'bg-gradient-to-br from-red-600 to-rose-700 text-white border-red-500/40',
          state === 'ready' && 'bg-gradient-to-br from-emerald-500 to-green-600 text-white border-emerald-400/50 shadow-emerald-500/20',
          state === 'too-early' && 'bg-gradient-to-br from-amber-600 to-orange-700 text-white border-amber-500/40',
          state === 'round-result' && 'bg-gradient-to-br from-slate-800 to-slate-900 text-white border-slate-700',
          state === 'complete' && 'bg-gradient-to-br from-purple-800 to-indigo-900 text-white border-purple-500/40'
        )}
      >
        <AnimatePresence mode="wait">
          {state === 'idle' && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="text-center space-y-4 pointer-events-none"
            >
              <div className="mx-auto size-12 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm">
                <Zap className="size-6 text-white" />
              </div>
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Reaction Time Test</h2>
              <p className="text-sm text-white/85 max-w-md mx-auto leading-relaxed">
                When the red screen turns green, click as quickly as you can anywhere on the screen.
              </p>
              <div className="pt-1">
                <span className="inline-block px-5 py-2 rounded-full bg-white text-indigo-900 font-semibold text-xs shadow">
                  Click Anywhere to Begin
                </span>
              </div>
            </motion.div>
          )}

          {state === 'waiting' && (
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

          {state === 'ready' && (
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

          {state === 'too-early' && (
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

          {state === 'round-result' && (
            <motion.div
              key="round-result"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-center space-y-2 pointer-events-none"
            >
              <h3 className="text-3xl sm:text-4xl font-bold tracking-tight">{lastTime} <span className="text-lg font-medium text-white/70">ms</span></h3>
              <p className="text-xs text-white/75">{getPercentile(lastTime)}</p>
              <p className="text-xs bg-white/10 px-3.5 py-1 rounded-full inline-block mt-2">
                Click to continue ({rounds.length}/{TOTAL_ROUNDS})
              </p>
            </motion.div>
          )}

          {state === 'complete' && (
            <motion.div
              key="complete"
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              className="text-center space-y-3 pointer-events-none"
            >
              <CheckCircle2 className="size-12 mx-auto text-emerald-300" />
              <p className="text-xs uppercase tracking-wider text-white/70 font-semibold">Average Reaction Time</p>
              <h2 className="text-3xl sm:text-4xl font-bold">{average} <span className="text-lg font-medium">ms</span></h2>
              <Badge className="bg-white/20 text-white text-xs px-2.5 py-0.5 hover:bg-white/25">
                {getPercentile(average)}
              </Badge>
              <div className="pt-1">
                <span className="inline-block px-5 py-2 rounded-full bg-white text-purple-900 font-semibold text-xs shadow">
                  Click to Try Again
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Round Breakdown */}
      {rounds.length > 0 && (
        <Card className="border border-border/60 bg-card/60 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Round Breakdown
            </h4>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: TOTAL_ROUNDS }).map((_, i) => {
                const r = rounds[i]
                return (
                  <div
                    key={i}
                    className={cn(
                      'flex flex-col items-center justify-center p-2.5 rounded-xl border text-center transition-all',
                      r ? 'bg-primary/5 border-primary/20 text-foreground' : 'bg-muted/30 border-dashed border-border/50 text-muted-foreground'
                    )}
                  >
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">Round {i + 1}</span>
                    <span className="text-sm font-bold mt-0.5">{r ? `${r.timeMs}ms` : '—'}</span>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
