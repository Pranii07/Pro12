// ===========================================================
// NeuroScreen — Feature Importance Chart
// ===========================================================
// Interactive, rich visualization showing feature importances
// from the RandomForest model with modality filtering,
// gradient bars, direct value labels, and biomarker descriptions.
// ===========================================================

import { useState, useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import {

  Layers,
  Mic,
  Smile,
  Zap,
  Brain,
  Keyboard,
  Sparkles,
  Info,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface FeatureImportanceChartProps {
  featureImportance: Record<string, number>
  maxFeatures?: number
  className?: string
}

type ModalityCategory = 'all' | 'speech' | 'facial' | 'reaction' | 'memory' | 'typing'

interface FeatureMeta {
  label: string
  modality: ModalityCategory
  modalityName: string
  description: string
  gradientId: string
  color: string
}

const FEATURE_METADATA: Record<string, FeatureMeta> = {
  avg_pause_duration_ms: {
    label: 'Avg Pause Duration',
    modality: 'speech',
    modalityName: 'Speech & Voice',
    description: 'Measures vocal hesitation and acoustic motor planning latencies between phrases',
    gradientId: 'grad-speech',
    color: '#10b981',
  },
  speech_rate_wpm: {
    label: 'Speech Rate (WPM)',
    modality: 'speech',
    modalityName: 'Speech & Voice',
    description: 'Pace of articulate vocalization reflecting verbal fluency speed',
    gradientId: 'grad-speech',
    color: '#10b981',
  },
  fluency_score: {
    label: 'Speech Fluency Score',
    modality: 'speech',
    modalityName: 'Speech & Voice',
    description: 'Steadiness of voice phonation and structural rhythm stability',
    gradientId: 'grad-speech',
    color: '#10b981',
  },
  transcript_word_count: {
    label: 'Transcript Word Count',
    modality: 'speech',
    modalityName: 'Speech & Voice',
    description: 'Total verbal output during self-paced narrative reading tasks',
    gradientId: 'grad-speech',
    color: '#10b981',
  },

  slowest_reaction_ms: {
    label: 'Slowest Reaction Time',
    modality: 'reaction',
    modalityName: 'Reaction & Reflex',
    description: 'Maximum latency observed during sudden visual/auditory stimulus triggers',
    gradientId: 'grad-reaction',
    color: '#8b5cf6',
  },
  fastest_reaction_ms: {
    label: 'Fastest Reaction Time',
    modality: 'reaction',
    modalityName: 'Reaction & Reflex',
    description: 'Peak motor transmission velocity responding to sensory visual cues',
    gradientId: 'grad-reaction',
    color: '#8b5cf6',
  },
  avg_reaction_time_ms: {
    label: 'Avg Reaction Time',
    modality: 'reaction',
    modalityName: 'Reaction & Reflex',
    description: 'Baseline motor-perceptual response speed across random stimulus intervals',
    gradientId: 'grad-reaction',
    color: '#8b5cf6',
  },
  false_start_count: {
    label: 'False Start Count',
    modality: 'reaction',
    modalityName: 'Reaction & Reflex',
    description: 'Premature anticipatory trigger attempts testing inhibitory motor control',
    gradientId: 'grad-reaction',
    color: '#8b5cf6',
  },

  orientation_stability: {
    label: 'Head Orientation Stability',
    modality: 'facial',
    modalityName: 'Facial & Attention',
    description: 'Postural drift resistance and head pose angular stability during tracking',
    gradientId: 'grad-facial',
    color: '#f59e0b',
  },
  avg_head_movement: {
    label: 'Avg Head Movement',
    modality: 'facial',
    modalityName: 'Facial & Attention',
    description: 'Sub-pixel tremor detection and micro-posture oscillation measurements',
    gradientId: 'grad-facial',
    color: '#f59e0b',
  },
  attention_score: {
    label: 'Attention & Gaze Score',
    modality: 'facial',
    modalityName: 'Facial & Attention',
    description: 'Centering of optical gaze within attention target boundaries',
    gradientId: 'grad-facial',
    color: '#f59e0b',
  },
  blink_rate_per_min: {
    label: 'Blink Rate (/min)',
    modality: 'facial',
    modalityName: 'Facial & Attention',
    description: 'Spontaneous eyeblink frequency indicating autonomic cognitive load',
    gradientId: 'grad-facial',
    color: '#f59e0b',
  },

  avg_response_time_ms: {
    label: 'Avg Memory Response',
    modality: 'memory',
    modalityName: 'Memory & Cognition',
    description: 'Retrieval duration before submitting working memory sequences',
    gradientId: 'grad-memory',
    color: '#06b6d4',
  },
  word_recall_accuracy: {
    label: 'Word Recall Accuracy',
    modality: 'memory',
    modalityName: 'Memory & Cognition',
    description: 'Verbal memory recall percentage under delayed conditions',
    gradientId: 'grad-memory',
    color: '#06b6d4',
  },
  pattern_accuracy: {
    label: 'Image Memory Game Accuracy',
    modality: 'memory',
    modalityName: 'Memory & Cognition',
    description: 'Visual-spatial working memory retention and card pair matching',
    gradientId: 'grad-memory',
    color: '#06b6d4',
  },
  image_memory_accuracy: {
    label: 'Image Memory Game Accuracy',
    modality: 'memory',
    modalityName: 'Memory & Cognition',
    description: 'Visual-spatial working memory retention and card pair matching',
    gradientId: 'grad-memory',
    color: '#06b6d4',
  },
  number_recall_accuracy: {
    label: 'Number Sequence Accuracy',
    modality: 'memory',
    modalityName: 'Memory & Cognition',
    description: 'Immediate phonological loop digit span capacity',
    gradientId: 'grad-memory',
    color: '#06b6d4',
  },

  avg_flight_time_ms: {
    label: 'Avg Keystroke Flight Time',
    modality: 'typing',
    modalityName: 'Typing & Motor',
    description: 'Transition interval between consecutive keystrokes reflecting motor sequencing',
    gradientId: 'grad-typing',
    color: '#3b82f6',
  },
  avg_hold_time_ms: {
    label: 'Avg Key Hold Time',
    modality: 'typing',
    modalityName: 'Typing & Motor',
    description: 'Key depression duration reflecting finger micro-motor release speed',
    gradientId: 'grad-typing',
    color: '#3b82f6',
  },
  backspace_rate: {
    label: 'Backspace Correction Rate',
    modality: 'typing',
    modalityName: 'Typing & Motor',
    description: 'Frequency of keystroke edits reflecting active cognitive error monitoring',
    gradientId: 'grad-typing',
    color: '#3b82f6',
  },
  accuracy: {
    label: 'Typing Accuracy',
    modality: 'typing',
    modalityName: 'Typing & Motor',
    description: 'Overall motor execution precision during standard paragraph transcription',
    gradientId: 'grad-typing',
    color: '#3b82f6',
  },
  wpm: {
    label: 'Typing Speed (WPM)',
    modality: 'typing',
    modalityName: 'Typing & Motor',
    description: 'Gross psychomotor typing speed in standard words per minute',
    gradientId: 'grad-typing',
    color: '#3b82f6',
  },
  cpm: {
    label: 'Characters Per Minute',
    modality: 'typing',
    modalityName: 'Typing & Motor',
    description: 'Fine motor character input cadence',
    gradientId: 'grad-typing',
    color: '#3b82f6',
  },
}

const MODALITY_FILTERS: { id: ModalityCategory; label: string; icon: typeof Layers; color: string }[] = [
  { id: 'all', label: 'All Modalities', icon: Layers, color: 'text-primary' },
  { id: 'speech', label: 'Speech & Voice', icon: Mic, color: 'text-emerald-500' },
  { id: 'reaction', label: 'Reaction Time', icon: Zap, color: 'text-violet-500' },
  { id: 'facial', label: 'Facial & Attention', icon: Smile, color: 'text-amber-500' },
  { id: 'memory', label: 'Memory & Cognition', icon: Brain, color: 'text-cyan-500' },
  { id: 'typing', label: 'Typing & Motor', icon: Keyboard, color: 'text-blue-500' },
]

export function FeatureImportanceChart({
  featureImportance,
  maxFeatures = 10,
  className,
}: FeatureImportanceChartProps) {
  const [selectedModality, setSelectedModality] = useState<ModalityCategory>('all')
  const [hoveredKey, setHoveredKey] = useState<string | null>(null)

  // Parse and sort all features
  const allFeatures = useMemo(() => {
    return Object.entries(featureImportance)
      .filter(([key]) => !key.endsWith('_present'))
      .map(([key, value]) => {
        const meta = FEATURE_METADATA[key] || {
          label: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          modality: 'all' as ModalityCategory,
          modalityName: 'General Biomarker',
          description: 'Model screening feature representation',
          gradientId: 'grad-default',
          color: '#6366f1',
        }
        return {
          key,
          rawImportance: value,
          importance: Math.round(value * 10000) / 100, // percentage e.g. 11.8%
          ...meta,
        }
      })
      .sort((a, b) => b.rawImportance - a.rawImportance)
  }, [featureImportance])

  // Filter based on selected modality
  const filteredFeatures = useMemo(() => {
    const list = selectedModality === 'all'
      ? allFeatures
      : allFeatures.filter((f) => f.modality === selectedModality)
    return list.slice(0, maxFeatures)
  }, [allFeatures, selectedModality, maxFeatures])

  // Modality weight summary (sum of percentages per modality)
  const modalityContributions = useMemo(() => {
    const sums: Record<string, number> = {
      speech: 0,
      reaction: 0,
      facial: 0,
      memory: 0,
      typing: 0,
    }
    allFeatures.forEach((f) => {
      if (f.modality in sums) {
        sums[f.modality] += f.importance
      }
    })
    return [
      { id: 'speech', label: 'Speech', value: Math.round(sums.speech), color: 'bg-emerald-500', text: 'text-emerald-500' },
      { id: 'reaction', label: 'Reaction', value: Math.round(sums.reaction), color: 'bg-violet-500', text: 'text-violet-500' },
      { id: 'facial', label: 'Facial', value: Math.round(sums.facial), color: 'bg-amber-500', text: 'text-amber-500' },
      { id: 'memory', label: 'Memory', value: Math.round(sums.memory), color: 'bg-cyan-500', text: 'text-cyan-500' },
      { id: 'typing', label: 'Motor/Typing', value: Math.round(sums.typing), color: 'bg-blue-500', text: 'text-blue-500' },
    ].sort((a, b) => b.value - a.value)
  }, [allFeatures])

  const activeFeatureMeta = useMemo(() => {
    if (!hoveredKey) return null
    return allFeatures.find((f) => f.key === hoveredKey) || null
  }, [hoveredKey, allFeatures])

  if (filteredFeatures.length === 0) return null

  return (
    <Card className={cn('overflow-hidden border shadow-sm', className)}>
      {/* Header */}
      <CardHeader className="pb-3 border-b bg-muted/20">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-4" />
              </div>
              <CardTitle className="text-base font-semibold">
                Biomarker Feature Importance
              </CardTitle>
              <Badge variant="outline" className="text-[0.65rem] border-primary/30 text-primary font-medium">
                RandomForest Model
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              Relative predictive weight of behavioural signals in the screening ensemble
            </CardDescription>
          </div>

          {/* Top Contributing Modality Indicator */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border text-xs shadow-2xs">
            <Sparkles className="size-3.5 text-amber-500" />
            <span className="text-muted-foreground">Top Signal:</span>
            <span className="font-semibold text-foreground">
              {allFeatures[0]?.label} ({allFeatures[0]?.importance}%)
            </span>
          </div>
        </div>

        {/* Modality Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-3">
          {MODALITY_FILTERS.map((filter) => {
            const Icon = filter.icon
            const isSelected = selectedModality === filter.id
            return (
              <button
                key={filter.id}
                onClick={() => setSelectedModality(filter.id)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all cursor-pointer',
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className={cn('size-3.5', isSelected ? 'text-primary-foreground' : filter.color)} />
                {filter.label}
              </button>
            )
          })}
        </div>
      </CardHeader>

      <CardContent className="pt-6">
        {/* SVG Chart Area */}
        <div className="h-[380px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={filteredFeatures}
              layout="vertical"
              margin={{ top: 8, right: 65, left: 10, bottom: 8 }}
            >
              {/* Vibrant Linear Gradient Definitions */}
              <defs>
                <linearGradient id="grad-speech" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#10b981" />
                </linearGradient>
                <linearGradient id="grad-reaction" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#a855f7" />
                </linearGradient>
                <linearGradient id="grad-facial" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#d97706" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
                <linearGradient id="grad-memory" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#0891b2" />
                  <stop offset="100%" stopColor="#06b6d4" />
                </linearGradient>
                <linearGradient id="grad-typing" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#2563eb" />
                  <stop offset="100%" stopColor="#3b82f6" />
                </linearGradient>
                <linearGradient id="grad-default" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#4f46e5" />
                  <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
              </defs>

              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border)"
                strokeOpacity={0.4}
                horizontal={false}
              />

              <XAxis
                type="number"
                domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]}
                tick={{ fill: 'var(--color-muted-foreground)', fontSize: 11 }}
                tickFormatter={(v) => `${v}%`}
                axisLine={{ stroke: 'var(--color-border)' }}
                tickLine={{ stroke: 'var(--color-border)' }}
              />

              {/* Generous 180px YAxis width so feature names fit perfectly on 1 line */}
              <YAxis
                type="category"
                dataKey="label"
                width={180}
                tick={{
                  fill: 'var(--color-foreground)',
                  fontSize: 12,
                  fontWeight: 500,
                }}
                axisLine={false}
                tickLine={false}
              />

              {/* Rich Custom Tooltip */}
              <Tooltip
                cursor={{ fill: 'var(--color-accent)', opacity: 0.15 }}
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null
                  const item = payload[0].payload
                  return (
                    <div className="rounded-xl border border-border bg-card/95 p-3.5 shadow-xl backdrop-blur-md max-w-xs space-y-2">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold text-foreground">
                          {item.label}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[0.65rem] px-1.5 py-0 border-current"
                          style={{ color: item.color }}
                        >
                          {item.modalityName}
                        </Badge>
                      </div>

                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-bold tracking-tight" style={{ color: item.color }}>
                          {item.importance}%
                        </span>
                        <span className="text-xs text-muted-foreground">model decision weight</span>
                      </div>

                      <p className="text-[0.7rem] text-muted-foreground leading-relaxed pt-1 border-t border-border/60">
                        {item.description}
                      </p>
                    </div>
                  )
                }}
              />

              {/* Styled Horizontal Bars with direct Value Labels */}
              <Bar
                dataKey="importance"
                radius={[0, 6, 6, 0]}
                animationDuration={600}
                maxBarSize={22}
              >
                {filteredFeatures.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={`url(#${entry.gradientId})`}
                    fillOpacity={hoveredKey === null || hoveredKey === entry.key ? 1 : 0.45}
                    className="transition-all duration-200 cursor-pointer"
                    onMouseEnter={() => setHoveredKey(entry.key)}
                    onMouseLeave={() => setHoveredKey(null)}
                  />
                ))}

                {/* Percentage label directly at the right tip of each bar */}
                <LabelList
                  dataKey="importance"
                  position="right"
                  formatter={(v: any) => `${v}%`}
                  style={{
                    fill: 'var(--color-foreground)',
                    fontSize: '11px',
                    fontWeight: 600,
                  }}
                  offset={10}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Feature Detail Callout on Hover or Default */}
        <div className="mt-4 rounded-xl border border-border/80 bg-muted/30 p-3.5 flex items-start gap-3">
          <Info className="size-4 shrink-0 text-primary mt-0.5" />
          <div className="flex-1 text-xs">
            {activeFeatureMeta ? (
              <div>
                <span className="font-semibold text-foreground">{activeFeatureMeta.label} ({activeFeatureMeta.modalityName}): </span>
                <span className="text-muted-foreground">{activeFeatureMeta.description}</span>
              </div>
            ) : (
              <div>
                <span className="font-semibold text-foreground">Interactive Biomarker Inspection: </span>
                <span className="text-muted-foreground">
                  Hover over any bar to view its clinical biomarker description and functional neuro-behavioral interpretation.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Modality Decision Weight Bar */}
        <div className="mt-5 pt-4 border-t">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-muted-foreground">Modality Distribution in Model</span>
            <span className="text-[0.7rem] text-muted-foreground">Total relative impact</span>
          </div>

          {/* Segmented Progress Bar */}
          <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex">
            {modalityContributions.map((mod) => (
              <div
                key={mod.id}
                className={cn('h-full transition-all', mod.color)}
                style={{ width: `${mod.value}%` }}
                title={`${mod.label}: ${mod.value}%`}
              />
            ))}
          </div>

          {/* Modality Legend Chips */}
          <div className="flex flex-wrap items-center justify-between gap-2 mt-2.5">
            {modalityContributions.map((mod) => (
              <div key={mod.id} className="flex items-center gap-1.5 text-xs">
                <span className={cn('size-2 rounded-full', mod.color)} />
                <span className="text-muted-foreground">{mod.label}:</span>
                <span className="font-semibold text-foreground">{mod.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
