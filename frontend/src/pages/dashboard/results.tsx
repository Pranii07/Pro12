// ===========================================================
// NeuroScreen — Results Page
// ===========================================================
// Full-page results view displaying ML screening prediction
// with charts, module breakdown, and recommendations.
//
// Route: /dashboard/results/:assessmentId
//
// IMPORTANT: This is NOT a medical diagnosis. Results represent
// a Behavioural Screening Level for educational/research purposes.
//
// Research/Educational Prototype — trained on synthetic data.
// ===========================================================

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Download,
  Clock,
  Cpu,
  Calendar,
  AlertTriangle,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { DisclaimerBanner, PrototypeBanner } from '@/components/ui/disclaimer-banner'
import { PageHeader } from '@/components/ui/page-header'
import { ScreeningGauge } from '@/components/results/screening-gauge'
import { DistributionChart } from '@/components/results/distribution-chart'
import { ModuleRadar } from '@/components/results/module-radar'
import { ModuleBreakdown } from '@/components/results/module-breakdown'
import { Recommendations } from '@/components/results/recommendations'
import { FeatureImportanceChart } from '@/components/results/feature-importance-chart'
import { ScoreHistoryChart } from '@/components/results/score-history-chart'
import { predictionApi } from '@/services/prediction-api'
import { assessmentApi } from '@/services/assessment-api'
import { reportApi } from '@/services/report-api'
import { useAuth } from '@/contexts/auth-context'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { ScreeningLevel, ModuleType } from '@/types/database'
import type { PredictionResponse } from '@/services/prediction-api'
import type { AssessmentWithModulesResponse } from '@/services/assessment-api'

// -------------------------------------------------------
// Feature importance from model metadata (RandomForest)
// -------------------------------------------------------
// This is embedded from ml/models/model_metadata.json →
// all_model_results → RandomForest → feature_importance.
// In production, this would come from an API endpoint.
const RF_FEATURE_IMPORTANCE: Record<string, number> = {
  wpm: 0.01285, cpm: 0.01277, accuracy: 0.01565, backspace_rate: 0.02825,
  avg_hold_time_ms: 0.02913, avg_flight_time_ms: 0.04246,
  word_recall_accuracy: 0.02864, number_recall_accuracy: 0.02231,
  pattern_accuracy: 0.02527, avg_response_time_ms: 0.05912,
  avg_reaction_time_ms: 0.09475, fastest_reaction_ms: 0.09890,
  slowest_reaction_ms: 0.10865, false_start_count: 0.00815,
  speech_rate_wpm: 0.02518, avg_pause_duration_ms: 0.11501,
  fluency_score: 0.03529, transcript_word_count: 0.02542,
  blink_rate_per_min: 0.01763, avg_head_movement: 0.06591,
  orientation_stability: 0.07746, attention_score: 0.04206,
}

// -------------------------------------------------------
// Demo Data (fallback when API is unavailable)
// -------------------------------------------------------

const DEMO_PREDICTION: PredictionResponse = {
  id: 'demo-prediction',
  assessment_id: 'demo',
  model_version: '1.0.0',
  model_name: 'SVM',
  screening_level: 'MODERATE',
  overall_score: 58.4,
  model_distribution: { LOW: 0.32, MODERATE: 0.52, HIGH: 0.16 },
  module_scores: { typing: 72, memory: 65, reaction: 58, speech: null, facial: 68 },
  features_used: {},
  modalities_present: {
    typing: true,
    memory: true,
    reaction: true,
    speech: false,
    facial: true,
  },
  created_at: new Date().toISOString(),
  disclaimer: 'This application is intended for behavioural screening and educational/research purposes only.',
  prototype_notice: 'Research/Educational Prototype — trained and evaluated on synthetic data.',
}

const DEMO_MODULES = [
  { type: 'typing' as ModuleType, completed: true, score: 72, features: { wpm: 45, cpm: 225, accuracy: 0.88, backspace_rate: 0.09, avg_hold_time_ms: 115, avg_flight_time_ms: 155 } },
  { type: 'memory' as ModuleType, completed: true, score: 65, features: { word_recall_accuracy: 0.75, number_recall_accuracy: 0.70, pattern_accuracy: 0.78, avg_response_time_ms: 1650 } },
  { type: 'reaction' as ModuleType, completed: true, score: 58, features: { avg_reaction_time_ms: 410, fastest_reaction_ms: 265, slowest_reaction_ms: 620, false_start_count: 1 } },
  { type: 'speech' as ModuleType, completed: false, score: null, features: {} },
  { type: 'facial' as ModuleType, completed: true, score: 68, features: { blink_rate_per_min: 14, avg_head_movement: 4.8, orientation_stability: 0.78, attention_score: 0.76 } },
]

// -------------------------------------------------------
// Component
// -------------------------------------------------------

type PageState = 'loading' | 'predicting' | 'ready' | 'error' | 'demo'

export function ResultsPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>()
  const navigate = useNavigate()
  const { profile, user } = useAuth()
  const [state, setState] = useState<PageState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [prediction, setPrediction] = useState<PredictionResponse | null>(null)
  const [assessment, setAssessment] = useState<AssessmentWithModulesResponse | null>(null)
  const [reportLoading, setReportLoading] = useState(false)

  // Fetch prediction history for the score trends chart
  const { data: predictionHistory } = useQuery({
    queryKey: ['predictions', 'history'],
    queryFn: () => predictionApi.getHistory(),
    staleTime: 5 * 60 * 1000,
    enabled: state === 'ready' || state === 'demo', // Only fetch after main data loads
  })

  // Build score history for the chart
  const scoreHistory = useMemo(() => {
    if (!predictionHistory || predictionHistory.length < 2) return []
    return predictionHistory.map((p, i) => ({
      date: p.created_at,
      score: p.overall_score ?? 0,
      level: p.screening_level as ScreeningLevel,
      label: `#${i + 1}`,
    }))
  }, [predictionHistory])

  // Build module data from assessment + prediction
  const moduleData = prediction && assessment
    ? (['typing', 'memory', 'reaction', 'speech', 'facial'] as ModuleType[]).map((type) => {
        const moduleResult = assessment.module_results?.find((m) => m.module_type === type)
        const completed = prediction.modalities_present[type] ?? false
        const moduleScore = prediction.module_scores?.[type] ?? null
        return {
          type,
          completed,
          score: moduleScore ?? moduleResult?.score ?? null,
          features: (moduleResult?.features ?? {}) as Record<string, unknown>,
        }
      })
    : state === 'demo' ? DEMO_MODULES : []

  const completedModules = moduleData.filter((m) => m.completed).map((m) => m.type)

  const loadResults = useCallback(async () => {
    if (!assessmentId) {
      // No assessment ID — show demo mode
      setState('demo')
      setPrediction(DEMO_PREDICTION)
      return
    }

    try {
      setState('loading')
      setError(null)

      // 1. Fetch the assessment details
      let assessmentData: AssessmentWithModulesResponse
      try {
        assessmentData = await assessmentApi.get(assessmentId)
        setAssessment(assessmentData)
      } catch {
        // API unavailable — fall back to demo
        setState('demo')
        setPrediction(DEMO_PREDICTION)
        return
      }

      // 2. Try to get existing prediction first
      try {
        const existing = await predictionApi.get(assessmentId)
        setPrediction(existing)
        setState('ready')
        return
      } catch {
        // No existing prediction — trigger one
      }

      // 3. Trigger ML prediction
      setState('predicting')
      try {
        const result = await predictionApi.trigger(assessmentId)
        setPrediction(result)
        setState('ready')
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Prediction failed'
        // If trigger fails (409 = already exists), try get again
        if (typeof err === 'object' && err !== null && 'response' in err) {
          const axiosErr = err as { response?: { status?: number } }
          if (axiosErr.response?.status === 409) {
            try {
              const existing = await predictionApi.get(assessmentId)
              setPrediction(existing)
              setState('ready')
              return
            } catch { /* fall through */ }
          }
        }
        setError(errMsg)
        setState('demo')
        setPrediction(DEMO_PREDICTION)
      }
    } catch (err) {
      console.error('Results page error:', err)
      setState('demo')
      setPrediction(DEMO_PREDICTION)
    }
  }, [assessmentId])

  useEffect(() => {
    loadResults()
  }, [loadResults])

  // Current prediction to display
  const currentPrediction = prediction ?? DEMO_PREDICTION
  const currentLevel = currentPrediction.screening_level as ScreeningLevel
  const currentScore = currentPrediction.overall_score ?? 50

  // Loading state
  if (state === 'loading' || state === 'predicting') {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        >
          <Loader2 className="size-8 text-primary" />
        </motion.div>
        <div className="text-center">
          <h3 className="text-lg font-semibold">
            {state === 'predicting' ? 'Running ML Analysis...' : 'Loading Results...'}
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            {state === 'predicting'
              ? 'The model is processing your assessment data'
              : 'Fetching your assessment results'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader
          title="Screening Results"
          description="Behavioural screening assessment results and recommendations"
        >
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={reportLoading || !assessmentId}
              onClick={async () => {
                if (!assessmentId) return
                setReportLoading(true)
                try {
                  // Direct download with client-side fallback payload (fast, reliable, self-contained)
                  await reportApi.directDownload(assessmentId, {
                    prediction: currentPrediction,
                    modules: assessment?.module_results || moduleData.map((m) => ({
                      module_type: m.type,
                      status: m.completed ? 'completed' : 'skipped',
                      score: m.score,
                      features: m.features,
                    })),
                    user_name: profile?.full_name || (user?.user_metadata?.full_name as string) || 'User',
                  })
                  toast.success('Report downloaded successfully')
                } catch (directErr) {
                  console.warn('Direct download failed, trying standard flow:', directErr)
                  try {
                    // Fallback: standard flow (generate in storage + download)
                    const report = await reportApi.generate(assessmentId)
                    await reportApi.downloadFile(report.id, report.file_name)
                    toast.success('Report downloaded successfully', {
                      description: report.file_name,
                    })
                  } catch (fallbackErr) {
                    console.error('All report generation attempts failed:', fallbackErr)
                    toast.error('Report generation failed', {
                      description: 'Could not generate or download the PDF report. Please try again.',
                    })
                  }
                } finally {
                  setReportLoading(false)
                }
              }}
            >
              {reportLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              {reportLoading ? 'Generating...' : 'Download Report'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/dashboard/assessments')}
              className="gap-2"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          </div>
        </PageHeader>
      </motion.div>

      {/* Demo mode banner */}
      {state === 'demo' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-accent/30 bg-accent/5 p-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-accent" />
            <div>
              <p className="text-sm font-medium text-accent">Preview Mode</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Showing sample data for UI preview. {error && `(${error})`} Connect to the backend API to see actual prediction results.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Prototype Notice */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <PrototypeBanner />
      </motion.div>

      {/* Hero: Gauge + Meta Info */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.35 }}
      >
        <Card className="overflow-hidden">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-col items-center gap-8 lg:flex-row lg:justify-between">
              {/* Gauge */}
              <ScreeningGauge
                score={currentScore}
                level={currentLevel}
                className="flex-shrink-0"
              />

              {/* Meta info */}
              <div className="flex flex-col gap-4 text-sm lg:min-w-[280px]">
                <h3 className="text-lg font-semibold">Assessment Details</h3>

                <div className="grid gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-1.5">
                      <Cpu className="size-3.5 text-primary" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Model</span>
                      <p className="text-sm font-medium">
                        {currentPrediction.model_name} v{currentPrediction.model_version}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-1.5">
                      <Calendar className="size-3.5 text-secondary" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Date</span>
                      <p className="text-sm font-medium">
                        {new Date(currentPrediction.created_at).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="rounded-md bg-muted p-1.5">
                      <Clock className="size-3.5 text-accent" />
                    </div>
                    <div>
                      <span className="text-xs text-muted-foreground">Modules Completed</span>
                      <p className="text-sm font-medium">
                        {completedModules.length} of 5
                      </p>
                    </div>
                  </div>
                </div>

                {/* Module presence badges */}
                <div className="flex flex-wrap gap-1.5 mt-1">
                  {(['typing', 'memory', 'reaction', 'speech', 'facial'] as ModuleType[]).map((type) => {
                    const present = currentPrediction.modalities_present[type]
                    return (
                      <Badge
                        key={type}
                        variant={present ? 'default' : 'secondary'}
                        className={cn(
                          'text-[0.6rem] capitalize',
                          present && 'bg-primary/90'
                        )}
                      >
                        {type}
                      </Badge>
                    )
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row */}
      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.35 }}
        >
          <DistributionChart distribution={currentPrediction.model_distribution} />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.35 }}
        >
          <ModuleRadar
            moduleScores={moduleData.map((m) => ({
              type: m.type,
              score: m.score,
              completed: m.completed,
            }))}
          />
        </motion.div>
      </div>

      {/* Score History (only if ≥2 assessments) */}
      {scoreHistory.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.35 }}
        >
          <ScoreHistoryChart history={scoreHistory} />
        </motion.div>
      )}

      {/* Biomarker Feature Importance — Full Width Dedicated Section */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
      >
        <FeatureImportanceChart featureImportance={RF_FEATURE_IMPORTANCE} />
      </motion.div>

      {/* Module Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.35 }}
      >
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            Module Breakdown
          </h3>
          <ModuleBreakdown modules={moduleData} />
        </div>
      </motion.div>

      {/* Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.35 }}
      >
        <Recommendations
          level={currentLevel}
          completedModules={completedModules}
        />
      </motion.div>

      {/* Disclaimer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <DisclaimerBanner />
      </motion.div>

      {/* Footer Actions */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55 }}
        className="flex flex-col gap-3 sm:flex-row sm:justify-between"
      >
        <Link to="/dashboard/new-assessment">
          <Button variant="outline" className="gap-2 w-full sm:w-auto">
            <RefreshCw className="size-4" />
            Take New Assessment
          </Button>
        </Link>
        <Link to="/dashboard">
          <Button variant="ghost" className="gap-2 w-full sm:w-auto">
            <ArrowLeft className="size-4" />
            Back to Dashboard
          </Button>
        </Link>
      </motion.div>
    </div>
  )
}
