// ===========================================================
// NeuroScreen — Human Benchmark: Aim Trainer Test
// ===========================================================
// Click 30 targets appearing randomly across the arena as fast
// as possible. Measures visuomotor coordination and reaction.
// ===========================================================

import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Crosshair, Trophy, RotateCcw, Target, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { benchmarkApi } from '@/services/benchmark-api'

type Phase = 'idle' | 'playing' | 'complete'

interface TargetCoord {
  x: number // percentage (5% to 90%)
  y: number // percentage (8% to 88%)
}

const TOTAL_TARGETS = 30

export function AimTrainerBenchmark() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [remainingTargets, setRemainingTargets] = useState(TOTAL_TARGETS)
  const [targetCoord, setTargetCoord] = useState<TargetCoord>({ x: 50, y: 50 })
  const [targetTimes, setTargetTimes] = useState<number[]>([])
  const [misses, setMisses] = useState(0)
  const [bestAvg, setBestAvg] = useState<number>(() => {
    const saved = localStorage.getItem('neuroscreen_hb_aim_best')
    return saved ? Number(saved) : 0
  })

  const targetSpawnTimeRef = useRef(0)
  const testStartTimeRef = useRef(0)

  const getRandomCoord = (): TargetCoord => ({
    x: Math.floor(Math.random() * 80) + 10,
    y: Math.floor(Math.random() * 76) + 12,
  })

  const spawnNextTarget = useCallback(() => {
    setTargetCoord(getRandomCoord())
    targetSpawnTimeRef.current = performance.now()
  }, [])

  const startGame = () => {
    setRemainingTargets(TOTAL_TARGETS)
    setTargetTimes([])
    setMisses(0)
    setPhase('playing')
    testStartTimeRef.current = performance.now()
    spawnNextTarget()
  }

  const handleTargetClick = (e: React.MouseEvent) => {
    e.stopPropagation() // Don't trigger miss click on background
    if (phase !== 'playing') return

    const elapsed = Math.round(performance.now() - targetSpawnTimeRef.current)
    const newTimes = [...targetTimes, elapsed]
    setTargetTimes(newTimes)

    const nextRemaining = remainingTargets - 1
    setRemainingTargets(nextRemaining)

    if (nextRemaining <= 0) {
      // Completed all 30 targets!
      const avg = Math.round(newTimes.reduce((a, b) => a + b, 0) / newTimes.length)
      if (bestAvg === 0 || avg < bestAvg) {
        setBestAvg(avg)
        localStorage.setItem('neuroscreen_hb_aim_best', String(avg))
      }
      const acc = newTimes.length + misses > 0
        ? Math.round((newTimes.length / (newTimes.length + misses)) * 100)
        : 100
      benchmarkApi.record({
        test_type: 'aim',
        score: avg,
        unit: 'ms/target',
        details: { accuracy: acc, misses, targetTimes: newTimes },
      }).catch(() => {})
      setPhase('complete')
    } else {
      spawnNextTarget()
    }
  }

  const handleArenaClick = () => {
    if (phase === 'playing') {
      setMisses((m) => m + 1)
    }
  }

  const averageMs = targetTimes.length > 0
    ? Math.round(targetTimes.reduce((a, b) => a + b, 0) / targetTimes.length)
    : 0

  const accuracy = targetTimes.length + misses > 0
    ? Math.round((targetTimes.length / (targetTimes.length + misses)) * 100)
    : 100

  const getPercentile = (avgMs: number) => {
    if (avgMs <= 350) return 'Top 0.5% (Elite FPS Aim / Reflexes)'
    if (avgMs <= 420) return 'Top 5% (Superior Visuomotor Speed)'
    if (avgMs <= 500) return 'Top 25% (Fast Motor Control)'
    if (avgMs <= 620) return 'Top 60% (Average / Normal)'
    if (avgMs <= 750) return 'Top 85% (Casual)'
    return 'Bottom 15% (Mild Motor Delay)'
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-rose-500/30">
            <Crosshair className="size-3.5 text-rose-500" />
            Human Benchmark: Aim Trainer
          </Badge>
          {phase === 'playing' && (
            <span className="text-xs text-muted-foreground font-medium">
              Remaining: <strong className="text-foreground">{remainingTargets}</strong> / {TOTAL_TARGETS}
            </span>
          )}
        </div>
        {bestAvg > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Trophy className="size-3.5" />
            <span>Personal Best: <strong>{bestAvg} ms/target</strong></span>
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="border border-border/70 overflow-hidden shadow-md bg-card/90 backdrop-blur-sm">
        {phase === 'idle' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center ring-1 ring-rose-500/20">
              <Crosshair className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight">Aim Trainer</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                Click 30 targets as quickly and accurately as you can. Measures visuospatial acquisition and hand-eye motor speed.
              </p>
            </div>
            <div className="flex justify-center gap-5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Target className="size-3.5 text-rose-500" />
                <span>30 Rapid Targets</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Crosshair className="size-3.5 text-rose-500" />
                <span>Precision & Speed Tracking</span>
              </div>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="px-6 py-2 h-10 text-sm font-semibold shadow-md bg-rose-600 hover:bg-rose-700 text-white"
              >
                Start Aim Trainer
              </Button>
            </div>
          </CardContent>
        )}

        {phase === 'playing' && (
          <div
            onClick={handleArenaClick}
            className="relative w-full h-[450px] bg-slate-900 rounded-b-xl overflow-hidden cursor-crosshair select-none border-t border-border/40"
          >
            {/* Top HUD overlay */}
            <div className="absolute top-3 left-4 right-4 flex items-center justify-between text-xs text-white/80 pointer-events-none z-10">
              <div>
                <span>Targets remaining: </span>
                <strong className="text-white text-sm font-mono">{remainingTargets}</strong>
              </div>
              <div>
                <span>Accuracy: </span>
                <strong className="text-white text-sm font-mono">{accuracy}%</strong>
              </div>
            </div>

            {/* Target Bullseye */}
            <motion.button
              key={`${targetCoord.x}-${targetCoord.y}`}
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.08 }}
              onClick={handleTargetClick}
              style={{
                left: `${targetCoord.x}%`,
                top: `${targetCoord.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute size-14 rounded-full bg-rose-500 flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/50 hover:brightness-110 active:scale-95 transition-transform"
            >
              <div className="size-10 rounded-full bg-white flex items-center justify-center">
                <div className="size-5 rounded-full bg-rose-600" />
              </div>
            </motion.button>
          </div>
        )}

        {phase === 'complete' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center ring-1 ring-rose-500/20">
              <CheckCircle2 className="size-6 text-emerald-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Average Target Acquisition Time</p>
              <h2 className="text-3xl font-bold">{averageMs} <span className="text-lg font-medium text-muted-foreground">ms</span></h2>
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground pt-1">
                <span>Accuracy: <strong className="text-foreground">{accuracy}%</strong></span>
                <span>•</span>
                <span>Misclicks: <strong className="text-foreground">{misses}</strong></span>
              </div>
              <p className="text-xs sm:text-sm font-medium text-rose-600 dark:text-rose-400">
                {getPercentile(averageMs)}
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="gap-2 px-6 py-2 h-10 text-sm font-semibold bg-rose-600 hover:bg-rose-700 text-white"
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
