// ===========================================================
// NeuroScreen — Human Benchmark: Verbal Memory Test
// ===========================================================
// Words are presented one by one. You decide if you have
// SEEN the word previously in this test, or if it is NEW.
// 3 lives. Tests short-term and recognition memory capacity.
// ===========================================================

import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Brain, Heart, Trophy, RotateCcw, Check, X, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { benchmarkApi } from '@/services/benchmark-api'

const WORD_DICTIONARY = [
  'apple', 'river', 'clock', 'table', 'forest', 'bridge', 'garden', 'winter',
  'candle', 'ocean', 'purple', 'basket', 'mirror', 'thunder', 'pencil', 'silver',
  'window', 'morning', 'castle', 'desert', 'guitar', 'island', 'jungle', 'ladder',
  'planet', 'rabbit', 'shadow', 'tunnel', 'velvet', 'wizard', 'anchor', 'breeze',
  'canvas', 'dragon', 'feather', 'glacier', 'harbor', 'icicle', 'jacket', 'kitten',
  'lantern', 'meadow', 'needle', 'palace', 'quartz', 'ribbon', 'shield', 'trophy',
  'valley', 'walnut', 'beacon', 'canyon', 'dolphin', 'ember', 'falcon', 'galaxy',
  'horizon', 'iris', 'journey', 'knight', 'lagoon', 'monarch', 'nebula', 'orbit',
  'pebble', 'quest', 'radar', 'safari', 'timber', 'urchin', 'vessel', 'whisper',
  'zenith', 'arcade', 'boulder', 'copper', 'fossil', 'geyser', 'helmet', 'matrix',
  'parade', 'summit', 'temple', 'voyage', 'willow', 'abyss', 'bronze', 'citadel',
  'diamond', 'echo', 'frost', 'garnet', 'haven', 'ivory', 'meteor', 'oasis',
  'phoenix', 'relic', 'saffron', 'tundra', 'vortex', 'zephyr', 'acorn', 'blizzard'
]

type Phase = 'idle' | 'playing' | 'game-over'

export function VerbalMemoryBenchmark() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(3)
  const [currentWord, setCurrentWord] = useState('')
  const [seenWords, setSeenWords] = useState<Set<string>>(new Set())
  const [unseenPool, setUnseenPool] = useState<string[]>([])
  const [lastFeedback, setLastFeedback] = useState<'correct' | 'wrong' | null>(null)
  const [bestScore, setBestScore] = useState<number>(() => {
    const saved = localStorage.getItem('neuroscreen_hb_verbal_best')
    return saved ? Number(saved) : 0
  })

  const pickNextWord = useCallback((seen: Set<string>, pool: string[]) => {
    // 50% chance to show an already seen word if we have seen words
    const shouldPickSeen = seen.size >= 2 && Math.random() < 0.5

    if (shouldPickSeen) {
      const seenArray = Array.from(seen)
      const randomSeen = seenArray[Math.floor(Math.random() * seenArray.length)]
      setCurrentWord(randomSeen)
    } else {
      if (pool.length === 0) {
        // Pool exhausted, fallback to seen
        const seenArray = Array.from(seen)
        setCurrentWord(seenArray[Math.floor(Math.random() * seenArray.length)])
        return
      }
      const randomIndex = Math.floor(Math.random() * pool.length)
      const chosen = pool[randomIndex]
      const newPool = [...pool]
      newPool.splice(randomIndex, 1)
      setUnseenPool(newPool)
      setCurrentWord(chosen)
    }
  }, [])

  const startGame = () => {
    const shuffled = [...WORD_DICTIONARY].sort(() => Math.random() - 0.5)
    const firstWord = shuffled[0]
    const remaining = shuffled.slice(1)

    setScore(0)
    setLives(3)
    setSeenWords(new Set())
    setUnseenPool(remaining)
    setCurrentWord(firstWord)
    setLastFeedback(null)
    setPhase('playing')
  }

  const handleChoice = (choice: 'SEEN' | 'NEW') => {
    if (phase !== 'playing') return

    const isActuallySeen = seenWords.has(currentWord)
    const isCorrect = (choice === 'SEEN' && isActuallySeen) || (choice === 'NEW' && !isActuallySeen)

    if (isCorrect) {
      setLastFeedback('correct')
      const newScore = score + 1
      setScore(newScore)

      // If new, mark as seen
      const updatedSeen = new Set(seenWords)
      if (choice === 'NEW') {
        updatedSeen.add(currentWord)
        setSeenWords(updatedSeen)
      }

      pickNextWord(updatedSeen, unseenPool)
    } else {
      setLastFeedback('wrong')
      const newLives = lives - 1
      setLives(newLives)

      if (newLives <= 0) {
        if (score > bestScore) {
          setBestScore(score)
          localStorage.setItem('neuroscreen_hb_verbal_best', String(score))
        }
        benchmarkApi.record({
          test_type: 'verbal',
          score,
          unit: 'words',
          details: { wordsSeen: seenWords.size },
        }).catch(() => {})
        setPhase('game-over')
      } else {
        // Even on mistake, ensure word is accounted for
        const updatedSeen = new Set(seenWords)
        if (!isActuallySeen) {
          updatedSeen.add(currentWord)
          setSeenWords(updatedSeen)
        }
        pickNextWord(updatedSeen, unseenPool)
      }
    }
  }

  const getPercentile = (s: number) => {
    if (s >= 80) return 'Top 1% (Exceptional Verbal Capacity)'
    if (s >= 55) return 'Top 5% (Superior Memory)'
    if (s >= 40) return 'Top 20% (Above Average)'
    if (s >= 25) return 'Top 50% (Average / Normal)'
    if (s >= 15) return 'Top 75% (Fair)'
    return 'Bottom 25% (Mild Inattention)'
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs px-2.5 py-1 gap-1.5 border-purple-500/30">
            <Brain className="size-3.5 text-purple-500" />
            Human Benchmark: Verbal Memory
          </Badge>
          {phase === 'playing' && (
            <span className="text-xs text-muted-foreground font-medium">
              Words Seen: {seenWords.size}
            </span>
          )}
        </div>
        {bestScore > 0 && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            <Trophy className="size-3.5" />
            <span>Personal Best: <strong>{bestScore} words</strong></span>
          </div>
        )}
      </div>

      {/* Main card */}
      <Card className="border border-border/70 overflow-hidden shadow-md bg-card/90 backdrop-blur-sm">
        {phase === 'idle' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center ring-1 ring-purple-500/20">
              <Brain className="size-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="text-xl font-bold tracking-tight">Verbal Memory Test</h2>
              <p className="text-muted-foreground max-w-md mx-auto text-sm leading-relaxed">
                You will be shown words one at a time. If you have seen a word in this round, click <strong className="text-foreground">SEEN</strong>. If it’s a new word, click <strong className="text-foreground">NEW</strong>.
              </p>
            </div>
            <div className="flex justify-center gap-5 text-xs text-muted-foreground pt-1">
              <div className="flex items-center gap-1.5">
                <Heart className="size-3.5 text-rose-500 fill-rose-500" />
                <span>3 Strikes System</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="size-3.5 text-purple-500" />
                <span>Exponential Vocabulary</span>
              </div>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="px-6 py-2 h-10 text-sm font-semibold shadow-md bg-purple-600 hover:bg-purple-700 text-white"
              >
                Start Verbal Test
              </Button>
            </div>
          </CardContent>
        )}

        {phase === 'playing' && (
          <CardContent className="p-6 sm:p-8 space-y-6">
            {/* Lives and Score */}
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-1.5">
                <span className="text-xs uppercase text-muted-foreground font-semibold mr-1">Lives:</span>
                {Array.from({ length: 3 }).map((_, idx) => (
                  <Heart
                    key={idx}
                    className={cn(
                      'size-4 transition-all',
                      idx < lives ? 'text-rose-500 fill-rose-500 scale-100' : 'text-muted-foreground/30 scale-90'
                    )}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase text-muted-foreground font-semibold">Score:</span>
                <span className="text-xl font-bold text-purple-600 dark:text-purple-400 font-mono">{score}</span>
              </div>
            </div>

            {/* Current Word Display */}
            <div className="py-8 text-center relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentWord}
                  initial={{ opacity: 0, y: 15, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -15, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-2"
                >
                  <p className="text-3xl sm:text-4xl font-bold tracking-tight capitalize select-none text-foreground">
                    {currentWord}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Feedback indicator */}
              <AnimatePresence>
                {lastFeedback && (
                  <motion.div
                    key={`${currentWord}-${lastFeedback}`}
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className={cn(
                      'absolute right-2 top-0 flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
                      lastFeedback === 'correct' ? 'bg-emerald-500/10 text-emerald-600' : 'bg-rose-500/10 text-rose-600'
                    )}
                  >
                    {lastFeedback === 'correct' ? <Check className="size-3" /> : <X className="size-3" />}
                    <span>{lastFeedback === 'correct' ? '+1 Point' : 'Strike!'}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* SEEN and NEW Buttons */}
            <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto">
              <Button
                variant="outline"
                onClick={() => handleChoice('SEEN')}
                className="h-11 text-sm font-semibold border-2 border-purple-500/40 hover:bg-purple-500 hover:text-white transition-all shadow-sm"
              >
                SEEN
              </Button>
              <Button
                onClick={() => handleChoice('NEW')}
                className="h-11 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white shadow-md shadow-purple-500/20"
              >
                NEW
              </Button>
            </div>
          </CardContent>
        )}

        {phase === 'game-over' && (
          <CardContent className="p-6 sm:p-8 text-center space-y-5">
            <div className="mx-auto size-12 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center ring-1 ring-purple-500/20">
              <Trophy className="size-6 text-amber-500" />
            </div>
            <div className="space-y-1.5">
              <p className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">Verbal Memory Capacity</p>
              <h2 className="text-3xl font-bold">{score} <span className="text-lg font-medium text-muted-foreground">words</span></h2>
              <p className="text-xs sm:text-sm font-medium text-purple-600 dark:text-purple-400">
                {getPercentile(score)}
              </p>
            </div>
            <div className="pt-2">
              <Button
                onClick={startGame}
                className="gap-2 px-6 py-2 h-10 text-sm font-semibold bg-purple-600 hover:bg-purple-700 text-white"
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
