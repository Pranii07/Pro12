// ===========================================================
// NeuroScreen — Cognitive Benchmark Suite (Human Benchmark)
// ===========================================================
// Interactive hub for standardized cognitive & psychomotor tests:
//   1. Reaction Time
//   2. Verbal Memory (Seen vs New)
//   3. Number Memory (Digit Span)
//   4. Visual Memory (Grid Pattern Recall)
//   5. Chimp Test (Iconic Spatial Memory)
//   6. Aim Trainer (Visuomotor Speed)
// ===========================================================

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Brain,
  Hash,
  Grid2X2,
  Award,
  Crosshair,
  ArrowLeft,
  Trophy,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

// Benchmark Test Components
import { ReactionTimeBenchmark } from '@/components/benchmarks/reaction-time-test'
import { VerbalMemoryBenchmark } from '@/components/benchmarks/verbal-memory-test'
import { NumberMemoryBenchmark } from '@/components/benchmarks/number-memory-test'
import { VisualMemoryBenchmark } from '@/components/benchmarks/visual-memory-test'
import { ChimpTestBenchmark } from '@/components/benchmarks/chimp-test'
import { AimTrainerBenchmark } from '@/components/benchmarks/aim-trainer-test'
import { benchmarkApi } from '@/services/benchmark-api'

type BenchmarkId = 'reaction' | 'verbal' | 'number' | 'visual' | 'chimp' | 'aim'

interface TestInfo {
  id: BenchmarkId
  title: string
  subtitle: string
  domain: string
  icon: React.ElementType
  color: string
  bgLight: string
  badgeColor: string
  description: string
  storageKey: string
  unit: string
  lowerIsBetter?: boolean
}

const TESTS: TestInfo[] = [
  {
    id: 'reaction',
    title: 'Reaction Time',
    subtitle: 'Click when the screen turns green',
    domain: 'Simple Psychomotor Speed',
    icon: Zap,
    color: 'text-blue-500',
    bgLight: 'bg-blue-500/10',
    badgeColor: 'border-blue-500/30 text-blue-500',
    description: 'Measures central nervous system conduction velocity and simple motor response latency.',
    storageKey: 'neuroscreen_hb_reaction_best',
    unit: 'ms',
    lowerIsBetter: true,
  },
  {
    id: 'verbal',
    title: 'Verbal Memory',
    subtitle: 'Keep words in short-term memory (SEEN or NEW)',
    domain: 'Semantic Working Memory',
    icon: Brain,
    color: 'text-purple-500',
    bgLight: 'bg-purple-500/10',
    badgeColor: 'border-purple-500/30 text-purple-500',
    description: 'Tests lexical access, recognition memory, and proactive interference resistance.',
    storageKey: 'neuroscreen_hb_verbal_best',
    unit: 'words',
  },
  {
    id: 'number',
    title: 'Number Memory',
    subtitle: 'Remember an increasingly long number',
    domain: 'Phonological Digit Span',
    icon: Hash,
    color: 'text-indigo-500',
    bgLight: 'bg-indigo-500/10',
    badgeColor: 'border-indigo-500/30 text-indigo-500',
    description: 'Evaluates the capacity of the prefrontal working memory buffer and auditory rehearsal loop.',
    storageKey: 'neuroscreen_hb_number_best',
    unit: 'digits',
  },
  {
    id: 'visual',
    title: 'Visual Memory',
    subtitle: 'Remember the pattern of flashing tiles',
    domain: 'Visuospatial Sketchpad',
    icon: Grid2X2,
    color: 'text-emerald-500',
    bgLight: 'bg-emerald-500/10',
    badgeColor: 'border-emerald-500/30 text-emerald-500',
    description: 'Tests spatial pattern retention and visual working memory scaling across expanding grids.',
    storageKey: 'neuroscreen_hb_visual_best',
    unit: 'level',
  },
  {
    id: 'chimp',
    title: 'Chimp Test',
    subtitle: 'Are you smarter than a chimpanzee?',
    domain: 'Iconic Working Memory',
    icon: Award,
    color: 'text-amber-500',
    bgLight: 'bg-amber-500/10',
    badgeColor: 'border-amber-500/30 text-amber-500',
    description: 'Based on Kyoto University chimpanzee research. Memorize numbers before they turn blank.',
    storageKey: 'neuroscreen_hb_chimp_best',
    unit: 'numbers',
  },
  {
    id: 'aim',
    title: 'Aim Trainer',
    subtitle: 'Click 30 targets as quickly as possible',
    domain: 'Visuomotor Coordination',
    icon: Crosshair,
    color: 'text-rose-500',
    bgLight: 'bg-rose-500/10',
    badgeColor: 'border-rose-500/30 text-rose-500',
    description: 'Measures fine motor control, rapid spatial re-orientation, and target acquisition speed.',
    storageKey: 'neuroscreen_hb_aim_best',
    unit: 'ms/target',
    lowerIsBetter: true,
  },
]

import { useAuth } from '@/contexts/auth-context'
import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'

export function BenchmarksPage() {
  const [selectedTest, setSelectedTest] = useState<BenchmarkId | null>(null)
  const { isAdmin } = useAuth()

  const getSavedScore = (test: TestInfo) => {
    const val = localStorage.getItem(test.storageKey)
    if (!val) return null
    return Number(val)
  }

  // Auto-sync any existing local storage benchmarks to the server (Patients only, NEVER Admins)
  useEffect(() => {
    if (isAdmin) return
    TESTS.forEach((test) => {
      const val = localStorage.getItem(test.storageKey)
      if (val) {
        const num = Number(val)
        if (!isNaN(num) && num > 0) {
          benchmarkApi.record({
            test_type: test.id,
            score: num,
            unit: test.unit,
            details: { source: 'auto_sync' },
          }).catch(() => {})
        }
      }
    })
  }, [isAdmin])

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-10">
      {/* Admin Notice Banner */}
      {isAdmin && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-500/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 text-purple-700 dark:text-purple-300">
            <Shield className="size-4 shrink-0" />
            <div>
              <p className="font-semibold">Administrator Inspection Mode</p>
              <p className="text-muted-foreground text-[11px]">
                You are logged in as an administrator. Patient surveillance data is reserved for patients; your test attempts will not be saved to patient leaderboards.
              </p>
            </div>
          </div>
          <Link to="/dashboard/admin?tab=benchmarks">
            <Button size="sm" variant="outline" className="border-purple-500/30 text-purple-600 hover:bg-purple-500/10 text-xs shrink-0">
              View Patient Surveillance
            </Button>
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Cognitive Benchmark Suite</h1>
            <Badge variant="outline" className="text-[11px] bg-primary/5 text-primary border-primary/20 px-2 py-0.5">
              Interactive Lab
            </Badge>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm mt-1">
            Standardized cognitive, memory, and psychomotor tests inspired by human benchmark research.
          </p>
        </div>

        {selectedTest && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelectedTest(null)}
            className="gap-2 self-start sm:self-auto h-8 text-xs"
          >
            <ArrowLeft className="size-3.5" />
            All Benchmarks
          </Button>
        )}
      </div>

      {/* Main Content Area */}
      <AnimatePresence mode="wait">
        {!selectedTest ? (
          <motion.div
            key="grid"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-5"
          >
            {/* Quick selector grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {TESTS.map((test) => {
                const Icon = test.icon
                const best = getSavedScore(test)

                return (
                  <Card
                    key={test.id}
                    onClick={() => setSelectedTest(test.id)}
                    className="group relative cursor-pointer border border-border/60 hover:border-primary/50 hover:shadow-md transition-all duration-200 overflow-hidden bg-card/60 backdrop-blur-sm"
                  >
                    <div className="h-1 w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent group-hover:via-primary transition-all" />
                    <CardHeader className="p-4 sm:p-5 pb-2">
                      <div className="flex items-start justify-between">
                        <div className={cn('flex size-10 items-center justify-center rounded-xl ring-1 ring-border/50 transition-transform group-hover:scale-105', test.bgLight)}>
                          <Icon className={cn('size-5', test.color)} />
                        </div>
                        {best !== null ? (
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                            <Trophy className="size-3" />
                            <span>
                              {best} {test.unit}
                            </span>
                          </div>
                        ) : (
                          <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground px-1.5 py-0.5">
                            Not Tested
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="text-base font-semibold mt-3 group-hover:text-primary transition-colors">
                        {test.title}
                      </CardTitle>
                      <CardDescription className="text-[11px] sm:text-xs font-medium text-muted-foreground mt-0.5">
                        {test.domain}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-5 pt-0 space-y-3">
                      <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                        {test.subtitle}
                      </p>
                      <div className="pt-2 flex items-center justify-between border-t border-border/40 text-xs font-medium text-primary">
                        <span>Launch Benchmark</span>
                        <span className="transition-transform group-hover:translate-x-1">→</span>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>

            {/* Scientific context card */}
            <Card className="border border-border/50 bg-muted/30">
              <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
                <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Info className="size-4" />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs sm:text-sm font-semibold text-foreground">About These Cognitive Tests</h4>
                  <p className="text-muted-foreground leading-relaxed text-xs">
                    These standardized tasks isolate specific neural pathways: psychomotor velocity, verbal recognition,
                    forward digit span, visuospatial scratchpad retention, iconic memory, and hand-eye target acquisition.
                    Scores are stored locally on your device for practice and progress monitoring.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <motion.div
            key={selectedTest}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            className="space-y-6"
          >
            {/* Quick Test Switcher Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              {TESTS.map((t) => {
                const Icon = t.icon
                const isActive = t.id === selectedTest
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTest(t.id)}
                    className={cn(
                      'flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0',
                      isActive
                        ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                        : 'bg-card text-muted-foreground border-border/60 hover:text-foreground hover:bg-muted/50'
                    )}
                  >
                    <Icon className="size-3.5" />
                    <span>{t.title}</span>
                  </button>
                )
              })}
            </div>

            {/* Test Component */}
            <div className="pt-2">
              {selectedTest === 'reaction' && <ReactionTimeBenchmark />}
              {selectedTest === 'verbal' && <VerbalMemoryBenchmark />}
              {selectedTest === 'number' && <NumberMemoryBenchmark />}
              {selectedTest === 'visual' && <VisualMemoryBenchmark />}
              {selectedTest === 'chimp' && <ChimpTestBenchmark />}
              {selectedTest === 'aim' && <AimTrainerBenchmark />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
