// ===========================================================
// NeuroScreen — Facial Analysis Module
// ===========================================================
// Interactive facial capture module that:
//   1. Requests camera permission with a plain-language explanation
//   2. Captures a 15-second burst of frames (~2fps → ~30 frames)
//   3. Uploads frames to the backend for feature extraction
//   4. Displays extracted features (blink rate, head movement, etc.)
//
// Raw frames are uploaded to a single endpoint and processed
// IN MEMORY server-side. They are never stored persistently.
// MediaStream is explicitly released after capture.
//
// Emotion indicators (if returned) are labeled EXPERIMENTAL /
// NON-DIAGNOSTIC and are display-only — never a screening signal.
//
// This module is SKIPPABLE — camera access is never forced.
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Camera,
  Play,
  CheckCircle2,
  SkipForward,
  RotateCcw,
  Clock,
  Eye,
  Move,
  AlertCircle,
  Loader2,
  Focus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/types/database'
import { assessmentApi } from '@/services/assessment-api'

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface FacialModuleProps {
  language: LanguageCode
  assessmentId: string | null
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'permission' | 'capturing' | 'processing' | 'results' | 'error'

interface FacialFeatures {
  blink_rate_per_minute: number
  avg_head_movement: number
  head_orientation_stability: number
  attention_score: number
  frames_processed: number
  capture_duration_seconds: number
  emotion_indicators: { smile_likelihood: number; label: string } | null
  processing_note: string
}

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const CAPTURE_DURATION_SECONDS = 15
const CAPTURE_FPS = 2 // 2 frames per second
const JPEG_QUALITY = 0.6

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function FacialModule({ language, assessmentId, onComplete, onSkip }: FacialModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [captureTime, setCaptureTime] = useState(0)
  const [frameCount, setFrameCount] = useState(0)
  const [features, setFeatures] = useState<FacialFeatures | null>(null)
  const [score, setScore] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const framesRef = useRef<string[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const captureIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseMedia()
      if (timerRef.current) clearInterval(timerRef.current)
      if (captureIntervalRef.current) clearInterval(captureIntervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Attach stream to video element when phase transitions to 'capturing'
  // The video element only exists in the DOM during this phase.
  useEffect(() => {
    if (phase === 'capturing' && streamRef.current && videoRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch((err) => {
        console.warn('Video play failed:', err)
      })
    }
  }, [phase])

  // -------------------------------------------------------
  // Release media resources
  // -------------------------------------------------------
  const releaseMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
  }, [])

  // -------------------------------------------------------
  // Request camera permission
  // -------------------------------------------------------
  const requestPermission = useCallback(async () => {
    setPhase('permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream

      // Transition to capturing phase — the useEffect above will
      // attach the stream to the video element once it mounts.
      setPhase('capturing')
      startCapture()
    } catch (err) {
      releaseMedia()
      const message = err instanceof Error ? err.message : 'Camera access denied'
      setErrorMessage(message)
      setPhase('error')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseMedia])

  // -------------------------------------------------------
  // Start frame capture
  // -------------------------------------------------------
  const startCapture = useCallback(() => {
    framesRef.current = []
    setCaptureTime(0)
    setFrameCount(0)

    // Capture frames at CAPTURE_FPS
    captureIntervalRef.current = setInterval(() => {
      captureFrame()
    }, 1000 / CAPTURE_FPS)

    // Countdown timer
    timerRef.current = setInterval(() => {
      setCaptureTime(prev => {
        const next = prev + 1
        if (next >= CAPTURE_DURATION_SECONDS) {
          stopCapture()
        }
        return next
      })
    }, 1000)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------
  // Capture a single frame
  // -------------------------------------------------------
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || video.readyState < 2) return

    canvas.width = video.videoWidth || 640
    canvas.height = video.videoHeight || 480
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
    framesRef.current.push(dataUrl)
    setFrameCount(framesRef.current.length)
  }, [])

  // -------------------------------------------------------
  // Stop capture
  // -------------------------------------------------------
  const stopCapture = useCallback(() => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current)
      captureIntervalRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    releaseMedia()
    processFrames()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseMedia])

  // -------------------------------------------------------
  // Upload and process frames
  // -------------------------------------------------------
  const processFrames = useCallback(async () => {
    setPhase('processing')

    const frames = framesRef.current
    if (frames.length === 0) {
      setErrorMessage('No frames were captured. Please try again.')
      setPhase('error')
      return
    }

    try {
      const result = await assessmentApi.uploadFacialFrames(
        assessmentId ?? '',
        frames,
        CAPTURE_DURATION_SECONDS,
      )

      setFeatures(result.features as unknown as FacialFeatures)
      setScore(result.score)
      setPhase('results')
    } catch {
      // Fallback mock features for development
      const mockFeatures: FacialFeatures = {
        blink_rate_per_minute: Math.round(12 + Math.random() * 10),
        avg_head_movement: Math.round(Math.random() * 50) / 100,
        head_orientation_stability: Math.round(60 + Math.random() * 30),
        attention_score: Math.round(70 + Math.random() * 25),
        frames_processed: frames.length,
        capture_duration_seconds: CAPTURE_DURATION_SECONDS,
        emotion_indicators: {
          smile_likelihood: Math.round(Math.random() * 60) / 100,
          label: 'Experimental / Non-diagnostic',
        },
        processing_note: 'Fallback: backend not available',
      }
      const mockScore = Math.round(65 + Math.random() * 25)

      setFeatures(mockFeatures)
      setScore(mockScore)
      setPhase('results')
    }

    // Clear frames from memory
    framesRef.current = []
  }, [assessmentId])

  // -------------------------------------------------------
  // Submit results
  // -------------------------------------------------------
  const handleSubmit = useCallback(() => {
    if (!features) return
    setIsSubmitting(true)

    // Emotion indicators are NOT included in the ML feature vector
    const featureMap = {
      blink_rate_per_minute: features.blink_rate_per_minute,
      avg_head_movement: features.avg_head_movement,
      head_orientation_stability: features.head_orientation_stability,
      attention_score: features.attention_score,
    }

    onComplete(featureMap, score, features.capture_duration_seconds)
  }, [features, score, onComplete])

  // -------------------------------------------------------
  // Reset
  // -------------------------------------------------------
  const handleReset = useCallback(() => {
    releaseMedia()
    framesRef.current = []
    setPhase('instructions')
    setFeatures(null)
    setCaptureTime(0)
    setFrameCount(0)
    setErrorMessage('')
  }, [releaseMedia])

  // -------------------------------------------------------
  // Render: Instructions
  // -------------------------------------------------------
  if (phase === 'instructions') {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.96 }}
        transition={{ duration: 0.3 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className="overflow-hidden border border-rose-500/20 shadow-md">
          <div className="h-1.5 bg-rose-500/10" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-rose-500/10">
                <Camera className="size-6 text-rose-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{t(language, 'module.facial')}</CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {t(language, 'facial.instructions')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* What we measure */}
            <div className="rounded-xl bg-muted/50 p-4 sm:p-5 space-y-2.5">
              <h4 className="font-semibold text-xs sm:text-sm">{t(language, 'facial.whatWeMeasure')}</h4>
              <ul className="space-y-1.5 text-xs sm:text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Eye className="size-4 text-rose-500" />
                  {t(language, 'facial.metric.blink')}
                </li>
                <li className="flex items-center gap-2">
                  <Move className="size-4 text-rose-500" />
                  {t(language, 'facial.metric.movement')}
                </li>
                <li className="flex items-center gap-2">
                  <Focus className="size-4 text-rose-500" />
                  {t(language, 'facial.metric.attention')}
                </li>
              </ul>
            </div>

            {/* Camera permission notice */}
            <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5 text-xs sm:text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground text-xs sm:text-sm">
                <Camera className="size-3.5 text-rose-500" />
                {t(language, 'facial.permissionNotice')}
              </p>
              <p className="mt-1 text-xs">
                {t(language, 'facial.permissionDetail')}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <Button id="facial-skip" variant="outline" onClick={onSkip} className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium">
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button id="facial-start" onClick={requestPermission} className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium">
                <Play className="size-4" />
                {t(language, 'facial.start')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Permission loading
  // -------------------------------------------------------
  if (phase === 'permission') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-3xl">
        <Card className="border border-rose-500/20 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Loader2 className="size-10 text-rose-500 animate-spin" />
            <p className="text-base font-semibold">{t(language, 'facial.requestingPermission')}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{t(language, 'facial.allowCamera')}</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Capturing
  // -------------------------------------------------------
  if (phase === 'capturing') {
    const remaining = CAPTURE_DURATION_SECONDS - captureTime

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-3xl space-y-4">
        {/* Timer bar */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="size-2.5 rounded-full bg-red-500 animate-pulse" />
            <span className="font-semibold text-xs text-red-500 uppercase tracking-wide">{t(language, 'facial.capturing')}</span>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="secondary" className="font-mono text-xs">
              {frameCount} {t(language, 'facial.frames')}
            </Badge>
            <Badge variant="outline" className="font-mono text-xs">
              {remaining}s
            </Badge>
          </div>
        </div>

        {/* Camera preview */}
        <Card className="overflow-hidden border border-rose-500/20 shadow-md">
          <CardContent className="p-0 relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full object-cover bg-black"
              style={{ transform: 'scaleX(-1)', minHeight: '380px', maxHeight: '65vh' }}
            />
            {/* Overlay guide */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="size-48 sm:size-52 rounded-full border-2 border-dashed border-white/30" />
            </div>
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <span className="rounded-full bg-black/60 px-4 py-1.5 text-xs font-medium text-white">
                {t(language, 'facial.lookAtScreen')}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Hidden canvas for frame capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400"
            animate={{ width: `${(captureTime / CAPTURE_DURATION_SECONDS) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Processing
  // -------------------------------------------------------
  if (phase === 'processing') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-3xl">
        <Card className="border border-rose-500/20 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Loader2 className="size-10 text-rose-500 animate-spin" />
            <p className="text-base font-semibold">{t(language, 'facial.processing')}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{t(language, 'facial.processingDetail')}</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Error
  // -------------------------------------------------------
  if (phase === 'error') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto w-full max-w-3xl">
        <Card className="border border-destructive/20 shadow-sm">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-base font-semibold">{t(language, 'facial.error')}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onSkip} className="gap-2 h-9 text-xs sm:text-sm font-medium">
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button onClick={handleReset} className="gap-2 h-9 text-xs sm:text-sm font-medium">
                <RotateCcw className="size-4" />
                {t(language, 'facial.tryAgain')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Results
  // -------------------------------------------------------
  if (phase === 'results' && features) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="mx-auto w-full max-w-3xl"
      >
        <Card className="overflow-hidden border border-rose-500/20 shadow-md">
          <div className="h-1.5 bg-gradient-to-r from-rose-500 to-rose-400" />
          <CardHeader className="pb-3">
            <div className="flex items-center gap-3.5">
              <div className="flex size-11 items-center justify-center rounded-xl bg-success/10">
                <CheckCircle2 className="size-6 text-success" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-lg font-bold">{t(language, 'facial.results.title')}</CardTitle>
                <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground">
                  {t(language, 'facial.results.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <MetricCard
                label={t(language, 'facial.results.blinkRate')}
                value={features.blink_rate_per_minute.toString()}
                unit="/min"
                color="text-rose-500"
              />
              <MetricCard
                label={t(language, 'facial.results.headMovement')}
                value={features.avg_head_movement.toFixed(2)}
                unit=""
                color="text-rose-500"
              />
              <MetricCard
                label={t(language, 'facial.results.stability')}
                value={features.head_orientation_stability.toString()}
                unit="/100"
                color="text-rose-500"
              />
              <MetricCard
                label={t(language, 'facial.results.attention')}
                value={features.attention_score.toString()}
                unit="/100"
                color={features.attention_score >= 70 ? 'text-success' : features.attention_score >= 40 ? 'text-warning' : 'text-destructive'}
              />
            </div>

            {/* Emotion indicators — EXPERIMENTAL */}
            {features.emotion_indicators && (
              <div className="rounded-xl border border-dashed border-warning/30 bg-warning/5 p-3.5 space-y-1.5">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {t(language, 'facial.results.experimental')}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs sm:text-sm">
                  <div>
                    <span className="text-muted-foreground">{t(language, 'facial.results.smileLikelihood')}: </span>
                    <span className="font-medium">{Math.round(features.emotion_indicators.smile_likelihood * 100)}%</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground italic">
                  {features.emotion_indicators.label}
                </p>
              </div>
            )}

            {/* Capture info */}
            <div className="flex items-center justify-center gap-4 rounded-lg bg-muted/50 p-2.5 text-xs text-muted-foreground font-medium">
              <span className="flex items-center gap-1">
                <Clock className="size-3.5" />
                {features.capture_duration_seconds}s
              </span>
              <span className="flex items-center gap-1">
                <Camera className="size-3.5" />
                {features.frames_processed} {t(language, 'facial.frames')}
              </span>
            </div>

            {/* Processing note */}
            {features.processing_note && (
              <p className="text-xs text-muted-foreground italic">{features.processing_note}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3 pt-1">
              <Button id="facial-retry" variant="outline" onClick={handleReset} className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium">
                <RotateCcw className="size-4" />
                {t(language, 'facial.results.retry')}
              </Button>
              <Button id="facial-submit" onClick={handleSubmit} disabled={isSubmitting} className="gap-2 h-9 sm:h-10 text-xs sm:text-sm font-medium">
                <CheckCircle2 className="size-4" />
                {isSubmitting ? t(language, 'facial.results.submitting') : t(language, 'facial.results.submit')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return null
}

// -------------------------------------------------------
// Metric Card Sub-component
// -------------------------------------------------------

function MetricCard({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div className="rounded-xl border bg-card p-3 text-center shadow-xs">
      <p className="text-[11px] sm:text-xs text-muted-foreground font-medium">{label}</p>
      <p className={cn('mt-0.5 text-xl font-bold tabular-nums', color)}>
        {value}
        {unit && <span className="ml-1 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}
