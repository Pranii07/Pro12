// ===========================================================
// NeuroScreen — Human Benchmark: Chimp Test
// ===========================================================
// Click the squares in order by their numbers.
// The test gets harder: once you click '1', the other numbers
// turn into blank boxes! Tests iconic visual working memory.
// ===========================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Eye, Trophy, RotateCcw, Heart, Award } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { benchmarkApi } from '@/services/benchmark-api'

type Phase = 'idle' | 'playing' | 'round-success' | 'game-over'

interface TileItem {
  id: number
  gridIndex: number
  value: number // 1 to N
}

const GRID_COLS = 8
const GRID_ROWS = 5
const TOTAL_CELLS = GRID_COLS * GRID_ROWS

export function ChimpTestBenchmark() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [numberCount, setNumberCount] = useState(4) // Starts at 4 numbers
  const [lives, setLives] = useState(3)
  const [tiles, setTiles] = useState<TileItem[]>([])
  const [nextExpected, setNextExpected] = useState(1)
  const [isMasked, setIsMasked] = useState(false)
  const [clickedSet, setClickedSet] = useState<Set<number>>(new Set())
  const [failedTile, setFailedTile] = useState<number | null>(null)
  const [bestScore, setBestScore] = useState<number>(() => {
    const saved = localStorage.getItem('neuroscreen_hb_chimp_best')
    return saved ? Number(saved) : 0
  })

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimer = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
  }

  useEffect(() => {
    return () => clearTimer()
  }, [])

  const generateRound = useCallback((count: number) => {
    clearTimer()
    // Select count unique random positions on the 8x5 grid
    const chosenPositions = new Set<number>()
    while (chosenPositions.size < count) {
      chosenPositions.add(Math.floor(Math.random() * TOTAL_CELLS))
    }

    const posArray = Array.from(chosenPositions)
    const newTiles: TileItem[] = posArray.map((pos, idx) => ({
      id: idx + 1,
      gridIndex: pos,
      value: idx + 1,
    }))

    setTiles(newTiles)
    setNextExpected(1)
    setIsMasked(false)
    setClickedSet(new Set())
    setFailedTile(null)
    setPhase('playing')
  }, [])

  const startGame = () => {
    setNumberCount(4)
    setLives(3)
    generateRound(4)
  }

  const handleTileClick = (tile: TileItem) => {
    if (phase !== 'playing') return
    if (clickedSet.has(tile.value)) return

    if (tile.value === nextExpected) {
      // Correct!
      const updatedClicked = new Set(clickedSet).add(tile.value)
      setClickedSet(updatedClicked)

      // Mask tiles as soon as tile 1 is clicked
      if (tile.value === 1) {
        setIsMasked(true)
      }

      if (tile.value === numberCount) {
        // Round successfully completed!
        setPhase('round-success')
        if (numberCount > bestScore) {
          setBestScore(numberCount)
          localStorage.setItem('neuroscreen_hb_chimp_best', String(numberCount))
        }

        timerRef.current = setTimeout(() => {
          const nextCount = numberCount + 1
          setNumberCount(nextCount)
          generateRound(nextCount)
        }, 800)
      } else {
        setNextExpected(nextExpected + 1)
      }
    } else {
      // Wrong tile!
      setFailedTile(tile.value)
      const remainingLives = lives - 1
      setLives(remainingLives)

      if (remainingLives <= 0) {
        const finalScore = numberCount - 1
        benchmarkApi.record({
          test_type: 'chimp',
          score: finalScore,
          unit: 'numbers',
          details: { maxNumbers: finalScore },
        }).catch(() => {})
        setPhase('game-over')
      } else {
        // Redo current level
        timerRef.current = setTimeout(() => {
          generateRound(numberCount)
        }, 1000)
      }
    }
  }

  const getPercentile = (count: number) => {
    if (count >= 18) return 'Top 0.1% (Chimpanzee Master: Ayumu Level)'
    if (count >= 14) return 'Top 1% (Superior Working Memory)'
    if (count >= 11) return 'Top 10% (High Iconic Memory)'
    if (count >= 9) return 'Top 30% (Above Average)'
    if (count >= 7) return 'Top 60% (Average Human Level)'
    return 'Bottom 40% (Casual)'
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-amber-500/30">
            <Award className="size-3.5 text-amber-500" />
            Human Benchmark: Chimp Test
          </Badge>
          {(phase === 'playing' || phase === 'round-success') && (
            <span className="text-xs text-muted-foreground font-medium">
              {numberCount} Numbers ({clickedSet.size}/{numberCount} clicked)
            </span>
          )}
        </div>
        {bestScore > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Trophy className="size-3.5" />
            <span>Personal Best: <strong>{bestScore} Numbers</strong></span>
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="border border-border/70 overflow-hidden shadow-md bg-card/90 backdrop-blur-sm">
        {phase === 'idle' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center ring-1 ring-amber-500/20">
              <Eye className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight">Are You Smarter Than a Chimpanzee?</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                Click the squares in numerical order (1, 2, 3...). Once you click 1, the remaining numbers turn into blank white squares!
              </p>
            </div>
            <div className="flex justify-center gap-5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Heart className="size-3.5 text-rose-500 fill-rose-500" />
                <span>3 Strikes Allowed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Award className="size-3.5 text-amber-500" />
                <span>Starts at 4 Numbers</span>
              </div>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="px-6 py-2 h-10 text-sm font-semibold shadow-md bg-amber-600 hover:bg-amber-700 text-white"
              >
                Start Chimp Test
              </Button>
            </div>
          </CardContent>
        )}

        {(phase === 'playing' || phase === 'round-success') && (
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Lives and Number Count */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase text-muted-foreground font-semibold mr-1">Lives:</span>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={cn(
                      'size-5 transition-all',
                      idx < lives ? 'text-rose-500 fill-rose-500' : 'text-muted-foreground/30'
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground font-semibold">Targets:</span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono">{numberCount}</span>
              </div>
            </div>

            <p className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {isMasked ? 'Numbers are hidden! Click them in order from memory...' : 'Click 1 to start the sequence!'}
            </p>

            {/* Grid Arena: 8 columns x 5 rows */}
            <div className="flex justify-center py-2">
              <div
                className="grid grid-cols-8 gap-2 p-3 sm:p-4 rounded-2xl bg-muted/30 border border-border/60 max-w-2xl w-full select-none"
                style={{ aspectRatio: '8 / 5' }}
              >
                {Array.from({ length: TOTAL_CELLS }).map((_, cellIdx) => {
                  const tile = tiles.find((t) => t.gridIndex === cellIdx)
                  if (!tile) {
                    return <div key={cellIdx} className="w-full h-full rounded-lg" />
                  }

                  const isClicked = clickedSet.has(tile.value)
                  const isFailed = failedTile === tile.value

                  if (isClicked) {
                    return (
                      <div
                        key={cellIdx}
                        className="w-full h-full rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 font-bold opacity-40"
                      >
                        ✓
                      </div>
                    )
                  }

                  return (
                    <motion.button
                      key={cellIdx}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleTileClick(tile)}
                      className={cn(
                        'w-full h-full rounded-xl flex items-center justify-center font-bold text-lg sm:text-2xl border-2 transition-all shadow-sm focus:outline-none',
                        isFailed && 'bg-rose-500 border-rose-600 text-white animate-shake',
                        !isFailed && !isMasked && 'bg-card border-primary/40 text-primary shadow-md hover:bg-primary/5',
                        !isFailed && isMasked && 'bg-slate-200 dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-transparent hover:bg-slate-300 dark:hover:bg-slate-600 shadow'
                      )}
                    >
                      {isMasked ? '' : tile.value}
                    </motion.button>
                  )
                })}
              </div>
            </div>
          </CardContent>
        )}

        {phase === 'game-over' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center ring-1 ring-amber-500/20">
              <Trophy className="size-6 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Chimp Working Memory Score</p>
              <h2 className="text-3xl font-bold">{numberCount - 1} <span className="text-lg font-medium text-muted-foreground">Numbers</span></h2>
              <p className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400">
                {getPercentile(numberCount - 1)}
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="gap-2 px-6 py-2 h-10 text-sm font-semibold bg-amber-600 hover:bg-amber-700 text-white"
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
