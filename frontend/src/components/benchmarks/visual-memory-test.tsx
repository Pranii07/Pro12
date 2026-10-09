// ===========================================================
// NeuroScreen — Human Benchmark: Visual Memory Test
// ===========================================================
// Memorize the pattern of white tiles on a grid.
// As levels increase, grid grows and tile count expands.
// 3 strikes before game over.
// ===========================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Grid2X2, Trophy, RotateCcw, Heart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { benchmarkApi } from '@/services/benchmark-api'

type Phase = 'idle' | 'showing' | 'recalling' | 'round-success' | 'game-over'

export function VisualMemoryBenchmark() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [level, setLevel] = useState(1)
  const [lives, setLives] = useState(3)
  const [activeTileIndices, setActiveTileIndices] = useState<Set<number>>(new Set())
  const [selectedCorrect, setSelectedCorrect] = useState<Set<number>>(new Set())
  const [selectedWrong, setSelectedWrong] = useState<Set<number>>(new Set())
  const [bestLevel, setBestLevel] = useState<number>(() => {
    const saved = localStorage.getItem('neuroscreen_hb_visual_best')
    return saved ? Number(saved) : 0
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Determine grid dimension and number of target tiles by level
  const getGridConfig = (lvl: number) => {
    // 3x3 for lvl 1-2, 4x4 for lvl 3-5, 5x5 for lvl 6-8, 6x6 for lvl 9+
    let size = 3
    if (lvl >= 3) size = 4
    if (lvl >= 6) size = 5
    if (lvl >= 9) size = 6

    const totalTiles = size * size
    // Target count starts at 3, roughly +1 every level or two
    const targetCount = Math.min(totalTiles - 2, 2 + Math.floor(lvl * 0.9))
    return { size, targetCount, totalTiles }
  }

  const { size, targetCount, totalTiles } = getGridConfig(level)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    return () => clearTimer()
  }, [])

  const startLevel = useCallback((lvl: number) => {
    clearTimer()
    const { totalTiles: total, targetCount: targets } = getGridConfig(lvl)

    // Generate random target indices
    const indices = new Set<number>()
    while (indices.size < targets) {
      indices.add(Math.floor(Math.random() * total))
    }

    setActiveTileIndices(indices)
    setSelectedCorrect(new Set())
    setSelectedWrong(new Set())
    setPhase('showing')

    // Show for 1.3 seconds, then let user recall
    timerRef.current = setTimeout(() => {
      setPhase('recalling')
    }, 1300)
  }, [])

  const startGame = () => {
    setLevel(1)
    setLives(3)
    startLevel(1)
  }

  const handleTileClick = (index: number) => {
    if (phase !== 'recalling') return
    if (selectedCorrect.has(index) || selectedWrong.has(index)) return

    if (activeTileIndices.has(index)) {
      // Correct tile!
      const updated = new Set(selectedCorrect).add(index)
      setSelectedCorrect(updated)

      if (updated.size === activeTileIndices.size) {
        // Round passed!
        setPhase('round-success')
        if (level > bestLevel) {
          setBestLevel(level)
          localStorage.setItem('neuroscreen_hb_visual_best', String(level))
        }

        timerRef.current = setTimeout(() => {
          const nextLvl = level + 1
          setLevel(nextLvl)
          startLevel(nextLvl)
        }, 800)
      }
    } else {
      // Wrong tile!
      const updatedWrong = new Set(selectedWrong).add(index)
      setSelectedWrong(updatedWrong)

      // Lose a life
      const remainingLives = lives - 1
      setLives(remainingLives)

      if (remainingLives <= 0) {
        benchmarkApi.record({
          test_type: 'visual',
          score: level,
          unit: 'level',
          details: { maxLevel: level, targetCount, size },
        }).catch(() => {})
        setPhase('game-over')
      } else {
        // Flash round retry after brief shake
        timerRef.current = setTimeout(() => {
          startLevel(level)
        }, 700)
      }
    }
  }

  const getPercentile = (lvl: number) => {
    if (lvl >= 16) return 'Top 1% (Pro Visual Memory)'
    if (lvl >= 12) return 'Top 5% (Superior Spatial Cognition)'
    if (lvl >= 9) return 'Top 20% (Above Average)'
    if (lvl >= 7) return 'Top 50% (Average / Normal)'
    if (lvl >= 5) return 'Top 75% (Fair)'
    return 'Bottom 25% (Mild Spatial Inattention)'
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-emerald-500/30">
            <Grid2X2 className="size-3.5 text-emerald-500" />
            Human Benchmark: Visual Memory
          </Badge>
          {(phase === 'showing' || phase === 'recalling' || phase === 'round-success') && (
            <span className="text-xs text-muted-foreground font-medium">
              Level {level} ({size}x{size} Grid, {targetCount} Tiles)
            </span>
          )}
        </div>
        {bestLevel > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Trophy className="size-3.5" />
            <span>Personal Best: <strong>Level {bestLevel}</strong></span>
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="border border-border/70 overflow-hidden shadow-md bg-card/90 backdrop-blur-sm">
        {phase === 'idle' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center ring-1 ring-emerald-500/20">
              <Grid2X2 className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight">Visual Memory Test</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                Memorize the square tiles that flash white. When they flip back, click each one to reproduce the pattern.
              </p>
            </div>
            <div className="flex justify-center gap-5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Heart className="size-3.5 text-rose-500 fill-rose-500" />
                <span>3 Strikes Allowed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Grid2X2 className="size-3.5 text-emerald-500" />
                <span>Dynamic Scaling Grid</span>
              </div>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="px-6 py-2 h-10 text-sm font-semibold shadow-md bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                Start Visual Memory
              </Button>
            </div>
          </CardContent>
        )}

        {(phase === 'showing' || phase === 'recalling' || phase === 'round-success') && (
          <CardContent className="p-6 sm:p-8 space-y-5">
            {/* Lives and Level tracker */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase text-muted-foreground font-semibold mr-1">Lives:</span>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={cn(
                      'size-4 transition-all',
                      idx < lives ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground/30'
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground font-semibold">Level:</span>
                <span className="text-xl font-bold text-emerald-600 dark:text-emerald-400 font-mono">{level}</span>
              </div>
            </div>

            {/* Instruction banner */}
            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {phase === 'showing' ? 'Remember the highlighted squares...' : 'Click the squares you memorized!'}
            </p>

            {/* Grid Container */}
            <div className="flex justify-center py-3">
              <div
                className="grid gap-2.5 p-3 rounded-2xl bg-muted/40 border border-border/60 shadow-inner"
                style={{
                  gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))`,
                  width: `${Math.min(size * 72, 400)}px`,
                  height: `${Math.min(size * 72, 400)}px`,
                }}
              >
                {Array.from({ length: totalTiles }).map((_, idx) => {
                  const isHighlighted = phase === 'showing' && activeTileIndices.has(idx)
                  const isCorrectlyPicked = selectedCorrect.has(idx)
                  const isWronglyPicked = selectedWrong.has(idx)

                  return (
                    <motion.button
                      key={idx}
                      whileHover={phase === 'recalling' ? { scale: 1.04 } : {}}
                      whileTap={phase === 'recalling' ? { scale: 0.96 } : {}}
                      onClick={() => handleTileClick(idx)}
                      disabled={phase !== 'recalling'}
                      className={cn(
                        'w-full h-full rounded-xl transition-all duration-200 select-none shadow-sm focus:outline-none',
                        isHighlighted && 'bg-white shadow-lg ring-2 ring-emerald-400 scale-[1.02]',
                        isCorrectlyPicked && 'bg-emerald-500 shadow-md ring-2 ring-emerald-400 scale-[1.02]',
                        isWronglyPicked && 'bg-rose-500 shadow-md ring-2 ring-rose-400 scale-[0.98]',
                        !isHighlighted && !isCorrectlyPicked && !isWronglyPicked && 'bg-slate-300 dark:bg-slate-700/80 hover:bg-slate-400 dark:hover:bg-slate-600 cursor-pointer'
                      )}
                    />
                  )
                })}
              </div>
            </div>
          </CardContent>
        )}

        {phase === 'game-over' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center ring-1 ring-emerald-500/20">
              <Trophy className="size-6 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Spatial Memory Span</p>
              <h2 className="text-3xl font-bold">Level {level}</h2>
              <p className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400">
                {getPercentile(level)}
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="gap-2 px-6 py-2 h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
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
