// ===========================================================
// NeuroScreen — Cognitive Clinical Neurological Section
// ===========================================================
// Provides clinical neurological domain analysis, 6-axis radar
// envelope, brain region mapping, and condition monitoring.
// ===========================================================

import {
  Brain,
  Zap,
  Hash,
  Grid2X2,
  Award,
  Crosshair,
  ShieldCheck,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Stethoscope,
  Activity,
} from 'lucide-react'
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { UserBenchmarkProfile } from '@/services/benchmark-api'

interface CognitiveClinicalSectionProps {
  profile: UserBenchmarkProfile
}

export function CognitiveClinicalSection({ profile }: CognitiveClinicalSectionProps) {
  const summary = profile.clinical_summary
  if (!summary || !summary.domains || summary.domains.length === 0) {
    return null
  }

  // Prepare Radar Chart data
  const radarData = summary.domains.map((d) => {
    const shortLabels: Record<string, string> = {
      reaction: 'Psychomotor',
      verbal: 'Verbal Recall',
      number: 'Working Span',
      visual: 'Visuospatial',
      chimp: 'Sequential',
      aim: 'Motor Coordination',
    }
    return {
      domain: shortLabels[d.domain_key] || d.domain_name,
      fullName: d.domain_name,
      score: d.normalized_score,
      normativeBaseline: 50,
      zScore: d.z_score,
      brainRegion: d.brain_region,
    }
  })

  // Stability badge styling
  const isAlert = summary.overall_stability === 'DECLINE_ALERT'
  const isBorderline = summary.overall_stability === 'MILD_FLUCTUATION'
  
  const statusColor = isAlert
    ? 'border-rose-500/30 text-rose-600 bg-rose-500/10'
    : isBorderline
    ? 'border-amber-500/30 text-amber-600 bg-amber-500/10'
    : 'border-emerald-500/30 text-emerald-600 bg-emerald-500/10'

  const TrendIcon =
    summary.longitudinal_trend === 'DECLINING'
      ? TrendingDown
      : summary.longitudinal_trend === 'IMPROVING'
      ? TrendingUp
      : Minus

  const getDomainIcon = (key: string) => {
    switch (key) {
      case 'reaction':
        return Zap
      case 'verbal':
        return Brain
      case 'number':
        return Hash
      case 'visual':
        return Grid2X2
      case 'chimp':
        return Award
      case 'aim':
        return Crosshair
      default:
        return Activity
    }
  }

  return (
    <div className="space-y-5 pt-2">
      {/* 1. Clinical Status Header Banner */}
      <div className="p-4 rounded-xl border bg-card/80 backdrop-blur-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
              <Stethoscope className="size-4" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>Neurological Status:</span>
                <Badge variant="outline" className={cn('text-[11px] px-2.5 py-0.5 font-bold', statusColor)}>
                  {isAlert ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      Decline Alert
                    </span>
                  ) : isBorderline ? (
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="size-3" />
                      Mild Fluctuation
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="size-3" />
                      Stable Neurological Baseline
                    </span>
                  )}
                </Badge>
              </h4>
              <p className="text-xs text-muted-foreground mt-0.5">
                {summary.primary_neurological_profile}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-lg border bg-muted/30 text-right">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                Composite Index
              </span>
              <span className="font-mono font-black text-sm text-foreground">
                {summary.composite_cognitive_index} <span className="text-[10px] text-muted-foreground font-normal">/ 100</span>
              </span>
            </div>

            <div className="px-3 py-1.5 rounded-lg border bg-muted/30 text-right">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold block">
                Longitudinal Trend
              </span>
              <span className="font-mono text-xs font-bold text-foreground flex items-center justify-end gap-1">
                <TrendIcon className={cn('size-3', summary.longitudinal_trend === 'DECLINING' ? 'text-rose-500' : 'text-emerald-500')} />
                {summary.longitudinal_trend}
              </span>
            </div>
          </div>
        </div>

        {/* Clinical Synthesis Bullet points */}
        <div className="space-y-1.5">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            Clinical Synthesis & Findings
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
            {summary.clinical_findings.map((finding, idx) => (
              <div key={idx} className="flex items-start gap-2 p-2 rounded-lg bg-muted/20 border border-border/30">
                <span className="text-primary mt-0.5">•</span>
                <span className="text-muted-foreground leading-relaxed">{finding}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Visual Cognitive Envelope Radar & Interpretation */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Radar Chart */}
        <div className="lg:col-span-5 p-4 rounded-xl border bg-card/60 flex flex-col items-center">
          <div className="w-full flex items-center justify-between mb-1">
            <span className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Activity className="size-3.5 text-purple-500" />
              6-Axis Cognitive Envelope
            </span>
            <span className="text-[10px] text-muted-foreground">
              Norm = 50
            </span>
          </div>

          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                <PolarGrid stroke="var(--color-border)" strokeOpacity={0.6} />
                <PolarAngleAxis
                  dataKey="domain"
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 10 }}
                />
                <PolarRadiusAxis
                  angle={90}
                  domain={[0, 100]}
                  tick={{ fill: 'var(--color-muted-foreground)', fontSize: 8 }}
                  tickCount={4}
                />
                {/* Population Norm reference */}
                <Radar
                  name="Population Norm"
                  dataKey="normativeBaseline"
                  stroke="#94a3b8"
                  strokeDasharray="3 3"
                  strokeWidth={1}
                  fill="transparent"
                />
                {/* Patient Profile */}
                <Radar
                  name="Patient Telemetry"
                  dataKey="score"
                  stroke="#8b5cf6"
                  fill="#8b5cf6"
                  fillOpacity={0.25}
                  strokeWidth={2}
                  dot={{ fill: '#8b5cf6', r: 3 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--color-card)',
                    border: '1px solid var(--color-border)',
                    borderRadius: '8px',
                    fontSize: '11px',
                  }}
                  formatter={(value) => [`${Number(value)} / 100`, 'Score']}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-4 text-[10px] text-muted-foreground mt-1">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-purple-500 inline-block" />
              Patient Profile
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full border border-dashed border-slate-400 inline-block" />
              Normative Baseline (50)
            </span>
          </div>
        </div>

        {/* Anatomical Brain Region & Condition Mapping Cards */}
        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {summary.domains.map((dom) => {
            const Icon = getDomainIcon(dom.domain_key)
            const isDomImpaired = dom.clinical_status === 'IMPAIRED'
            const isDomBorderline = dom.clinical_status === 'BORDERLINE'

            return (
              <div
                key={dom.domain_key}
                className="p-3 rounded-xl border bg-card/70 hover:bg-muted/30 transition-all space-y-1.5 text-xs"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Icon className="size-3.5 text-primary shrink-0" />
                    <span className="truncate">{dom.domain_name}</span>
                  </span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[9px] px-1.5 py-0 font-mono font-bold',
                      isDomImpaired
                        ? 'border-rose-500/40 text-rose-600 bg-rose-500/10'
                        : isDomBorderline
                        ? 'border-amber-500/40 text-amber-600 bg-amber-500/10'
                        : 'border-emerald-500/40 text-emerald-600 bg-emerald-500/10'
                    )}
                  >
                    Z: {dom.z_score > 0 ? `+${dom.z_score.toFixed(2)}` : dom.z_score.toFixed(2)} SD
                  </Badge>
                </div>

                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <span className="font-mono text-purple-600 font-medium">Network:</span>
                  <span className="truncate">{dom.brain_region}</span>
                </div>

                <div className="space-y-1 pt-0.5">
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-muted-foreground">Standardized:</span>
                    <span className="font-bold text-foreground">{dom.normalized_score} / 100</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-muted/60 overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        isDomImpaired ? 'bg-rose-500' : isDomBorderline ? 'bg-amber-500' : 'bg-purple-500'
                      )}
                      style={{ width: `${Math.min(100, Math.max(10, dom.normalized_score))}%` }}
                    />
                  </div>
                </div>

                <p className="text-[10px] text-muted-foreground leading-snug line-clamp-2 pt-0.5">
                  <strong className="text-foreground/80 font-medium">Target Condition:</strong> {dom.associated_condition}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
