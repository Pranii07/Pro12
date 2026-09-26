// ===========================================================
// NeuroScreen — Pre-Assessment Questionnaire Step
// ===========================================================
// Step 3: Optional contextual factors (age, sleep, stress, meds).
// All fields are optional — submitted alongside assessment data.
// ===========================================================

import { motion } from 'framer-motion'
import { ClipboardList, AlertCircle, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { LanguageCode } from '@/types/database'

interface QuestionnaireStepProps {
  language: LanguageCode
  questionnaire: Record<string, string>
  loading: boolean
  error?: string | null
  onUpdate: (key: string, value: string) => void
  onStart: () => void
  onBack: () => void
}

interface QuestionConfig {
  key: string
  labelKey: string
  placeholderKey: string
  options: { value: string; label: string }[]
}

const QUESTIONS: QuestionConfig[] = [
  {
    key: 'age_range',
    labelKey: 'questionnaire.ageRange',
    placeholderKey: 'questionnaire.ageRange.placeholder',
    options: [
      { value: '18-25', label: '18–25' },
      { value: '26-35', label: '26–35' },
      { value: '36-45', label: '36–45' },
      { value: '46-55', label: '46–55' },
      { value: '56-65', label: '56–65' },
      { value: '65+', label: '65+' },
    ],
  },
  {
    key: 'sleep_quality',
    labelKey: 'questionnaire.sleepQuality',
    placeholderKey: 'questionnaire.sleepQuality.placeholder',
    options: [
      { value: 'very_poor', label: 'Very Poor' },
      { value: 'poor', label: 'Poor' },
      { value: 'fair', label: 'Fair' },
      { value: 'good', label: 'Good' },
      { value: 'excellent', label: 'Excellent' },
    ],
  },
  {
    key: 'stress_level',
    labelKey: 'questionnaire.stressLevel',
    placeholderKey: 'questionnaire.stressLevel.placeholder',
    options: [
      { value: 'very_low', label: 'Very Low' },
      { value: 'low', label: 'Low' },
      { value: 'moderate', label: 'Moderate' },
      { value: 'high', label: 'High' },
      { value: 'very_high', label: 'Very High' },
    ],
  },
  {
    key: 'medication',
    labelKey: 'questionnaire.medication',
    placeholderKey: 'questionnaire.medication.placeholder',
    options: [
      { value: 'yes', label: 'Yes' },
      { value: 'no', label: 'No' },
      { value: 'prefer_not_to_say', label: 'Prefer not to say' },
    ],
  },
]

export function QuestionnaireStep({
  language,
  questionnaire,
  loading,
  error,
  onUpdate,
  onStart,
  onBack,
}: QuestionnaireStepProps) {
  const answeredCount = Object.values(questionnaire).filter(Boolean).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.25 }}
      className="mx-auto flex max-w-3xl flex-col gap-5"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-secondary/10">
          <ClipboardList className="size-6 text-secondary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t(language, 'questionnaire.title')}
        </h2>
        <p className="max-w-lg text-sm text-muted-foreground">
          {t(language, 'questionnaire.subtitle')}
        </p>
      </div>

      {/* Form Card */}
      <form onSubmit={(e) => { e.preventDefault(); onStart(); }}>
        <Card className="overflow-hidden shadow-sm">
          <CardContent className="p-5 sm:p-6">
            {/* Error banner if creation failed */}
            {error && (
              <div className="mb-5 flex items-center gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <AlertCircle className="size-4 shrink-0" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {/* Questions in a clean 2x2 responsive grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5">
              {QUESTIONS.map((q, index) => {
                const isSelected = Boolean(questionnaire[q.key])
                return (
                  <motion.div
                    key={q.key}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.04 }}
                    className="space-y-1.5"
                  >
                    <Label
                      htmlFor={`q-${q.key}`}
                      className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                    >
                      {t(language, q.labelKey)}
                      <span className="ml-1 text-[11px] font-normal lowercase text-muted-foreground/70">
                        (optional)
                      </span>
                    </Label>
                    <div className="relative">
                      <select
                        id={`q-${q.key}`}
                        value={questionnaire[q.key] || ''}
                        onChange={(e) => onUpdate(q.key, e.target.value)}
                        className={cn(
                          'flex h-10 w-full appearance-none rounded-lg border border-input bg-background px-3 py-2 text-sm transition-colors',
                          'ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
                          'disabled:cursor-not-allowed disabled:opacity-50',
                          isSelected
                            ? 'border-secondary/50 font-medium text-foreground bg-secondary/5'
                            : 'text-muted-foreground'
                        )}
                      >
                        <option value="">{t(language, q.placeholderKey)}</option>
                        {q.options.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      {/* Custom dropdown chevron */}
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                        <svg className="size-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </CardContent>

          {/* Integrated Card Footer Actions — Always visible right below inputs */}
          <CardFooter className="flex flex-col-reverse items-stretch justify-between gap-3 border-t bg-muted/20 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
            <Button
              id="questionnaire-back"
              type="button"
              variant="ghost"
              onClick={onBack}
              disabled={loading}
              className="text-muted-foreground hover:text-foreground"
            >
              {t(language, 'questionnaire.back')}
            </Button>

            <div className="flex items-center justify-between sm:justify-end gap-3">
              {answeredCount > 0 ? (
                <Badge variant="secondary" className="gap-1 border-secondary/30 bg-secondary/10 text-secondary text-xs font-medium">
                  <Check className="size-3" />
                  {answeredCount} of {QUESTIONS.length} selected
                </Badge>
              ) : (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  All fields optional
                </span>
              )}

              <Button
                id="questionnaire-start"
                type="submit"
                disabled={loading}
                className="min-w-[190px] shadow-sm font-semibold"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    {t(language, 'questionnaire.starting')}
                  </>
                ) : (
                  <>
                    {t(language, 'questionnaire.start')}
                    <ArrowRight className="ml-2 size-4" />
                  </>
                )}
              </Button>
            </div>
          </CardFooter>
        </Card>
      </form>
    </motion.div>
  )
}
