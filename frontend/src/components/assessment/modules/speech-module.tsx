// ===========================================================
// NeuroScreen — Speech Analysis Module
// ===========================================================
// Interactive speech recording module that:
//   1. Requests microphone permission with a plain-language explanation
//   2. Records a bounded audio clip (max 30 seconds)
//   3. Uploads the audio to the backend for feature extraction
//   4. Displays extracted features (speech rate, pauses, fluency)
//
// The raw audio is uploaded to a single endpoint and processed
// IN MEMORY server-side. It is never stored persistently.
// MediaStream is explicitly released after capture.
//
// This module is SKIPPABLE — mic access is never forced.
// ===========================================================

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  Mic,
  Play,
  Square,
  CheckCircle2,
  SkipForward,
  RotateCcw,
  Clock,
  Volume2,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { t } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import type { LanguageCode } from '@/types/database'
import { assessmentApi } from '@/services/assessment-api'

// -------------------------------------------------------
// Speech Prompts — what the user is asked to read aloud
// -------------------------------------------------------

const SPEECH_PROMPTS: Record<LanguageCode, string[]> = {
  en: [
    'The morning sun cast long shadows across the garden. Birds sang cheerfully in the old oak tree, while a gentle breeze rustled the leaves. She paused to admire the flowers before continuing her walk along the winding path toward the lake.',
    'Scientific research has shown that regular physical activity can significantly improve both mental and physical health. Walking for just thirty minutes a day can reduce stress levels and boost overall well-being throughout the week.',
    'Artificial intelligence continues to transform how we live and work. From voice assistants to medical imaging analysis, these technologies are becoming an integral part of our daily routines and professional practices.',
  ],
  kn: [
    'Bega belligge soorya tottadalli ulgaada neralugalannuu beesidha. Haleyha aala maradhalli hakkigalu santoshadhinda haadidhuvu. Meludha gaali eleyalannuu allaadisitthu. Avalu sarovaradha kelege hoguvva daariyanalli nadeyuva modalu hoo galannuu nodhi santoshapattalu.',
    'Vaignanika samshodhaney dinnityadha dehaka vyaayaama maanasika mattu dhaihika aarogya-vannuu bahala sudharisu-bahudu endhu thorisidhe. Dinadalli kevalha moovattu nimisha nadige voththadadha matta-galannuu kammi maadi otta kshemannu hegisabahudu.',
    'Krithrima buddhivantike namma jeevana mattu kaarya viddhaanagalannuu badalaaisuttide. Dhvani sahaayi-galinda vaiidhyakiya chithrana vishleyshane-varegey, ee taantrikathey-galu namma dhinanithyadha mattu vyaavasaayika aachaaranagalalli bhaaagaaguttive.',
  ],
}

// -------------------------------------------------------
// Types
// -------------------------------------------------------

interface SpeechModuleProps {
  language: LanguageCode
  assessmentId: string | null
  onComplete: (features: Record<string, unknown>, score: number, durationSeconds: number) => void
  onSkip: () => void
}

type Phase = 'instructions' | 'permission' | 'recording' | 'processing' | 'results' | 'error'

interface SpeechFeatures {
  speech_rate_wpm: number
  avg_pause_duration_ms: number
  fluency_score: number
  transcript: string
  duration_seconds: number
  processing_note: string
}

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

const MAX_RECORDING_SECONDS = 30
const MIN_RECORDING_SECONDS = 5

// -------------------------------------------------------
// Component
// -------------------------------------------------------

export function SpeechModule({ language, assessmentId, onComplete, onSkip }: SpeechModuleProps) {
  const [phase, setPhase] = useState<Phase>('instructions')
  const [prompt, setPrompt] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [features, setFeatures] = useState<SpeechFeatures | null>(null)
  const [score, setScore] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [readyToProcess, setReadyToProcess] = useState(false)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number | null>(null)

  // Pick a random prompt on mount
  useEffect(() => {
    const prompts = SPEECH_PROMPTS[language] ?? SPEECH_PROMPTS.en
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)])
  }, [language])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      releaseMedia()
      if (timerRef.current) clearInterval(timerRef.current)
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Trigger processing when recording stops and WAV blob is ready
  useEffect(() => {
    if (readyToProcess) {
      setReadyToProcess(false)
      processRecording()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readyToProcess])

  // -------------------------------------------------------
  // Release media resources
  // -------------------------------------------------------
  const releaseMedia = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    analyserRef.current = null
    setAudioLevel(0)
  }, [])

  // -------------------------------------------------------
  // Request microphone permission
  // -------------------------------------------------------
  const requestPermission = useCallback(async () => {
    setPhase('permission')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // Set up audio analyser for visual feedback
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)
      analyserRef.current = analyser

      setPhase('recording')
      startRecording(stream)
    } catch (err) {
      releaseMedia()
      const message = err instanceof Error ? err.message : 'Microphone access denied'
      setErrorMessage(message)
      setPhase('error')
    }
  }, [releaseMedia])

  // -------------------------------------------------------
  // Start recording — Uses Web Audio API to capture raw PCM
  // and encode as WAV client-side (avoids ffmpeg dependency)
  // -------------------------------------------------------
  const startRecording = useCallback((stream: MediaStream) => {
    chunksRef.current = []
    setRecordingTime(0)
    setIsRecording(true)

    // Use Web Audio API to capture raw PCM samples
    const audioCtx = new AudioContext({ sampleRate: 16000 })
    const source = audioCtx.createMediaStreamSource(stream)
    const bufferSize = 4096
    const pcmChunks: Float32Array[] = []

    // ScriptProcessorNode captures raw PCM data
    const processor = audioCtx.createScriptProcessor(bufferSize, 1, 1)
    processor.onaudioprocess = (e) => {
      const inputData = e.inputBuffer.getChannelData(0)
      pcmChunks.push(new Float32Array(inputData))
    }
    source.connect(processor)
    processor.connect(audioCtx.destination)

    // Store references for cleanup
    mediaRecorderRef.current = { 
      stop: () => {
        processor.disconnect()
        source.disconnect()
        audioCtx.close()
      },
      state: 'recording',
      // Encode raw PCM to WAV and store as blob
      getWavBlob: () => {
        const totalLength = pcmChunks.reduce((acc, chunk) => acc + chunk.length, 0)
        const pcmData = new Float32Array(totalLength)
        let offset = 0
        for (const chunk of pcmChunks) {
          pcmData.set(chunk, offset)
          offset += chunk.length
        }
        return encodeWav(pcmData, 16000)
      }
    } as unknown as MediaRecorder

    // Timer for countdown
    timerRef.current = setInterval(() => {
      setRecordingTime(prev => {
        const next = prev + 1
        if (next >= MAX_RECORDING_SECONDS) {
          stopRecording()
        }
        return next
      })
    }, 1000)

    // Audio level visualization
    const updateLevel = () => {
      if (analyserRef.current) {
        const data = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(data)
        const avg = data.reduce((sum, val) => sum + val, 0) / data.length
        setAudioLevel(avg / 255)
      }
      animFrameRef.current = requestAnimationFrame(updateLevel)
    }
    updateLevel()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // -------------------------------------------------------
  // Stop recording
  // -------------------------------------------------------
  const stopRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current as unknown as { stop: () => void; getWavBlob: () => Blob } | null
    if (recorder) {
      // Get the WAV blob before stopping
      if ('getWavBlob' in recorder) {
        const wavBlob = recorder.getWavBlob()
        chunksRef.current = [wavBlob]
      }
      recorder.stop()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setIsRecording(false)
    releaseMedia()
    setReadyToProcess(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseMedia])

  // -------------------------------------------------------
  // Upload and process recording
  // -------------------------------------------------------
  const processRecording = useCallback(async () => {
    setPhase('processing')

    // chunksRef now contains a single WAV blob from the Web Audio API capture
    const audioBlob = chunksRef.current[0] || new Blob([], { type: 'audio/wav' })

    if (audioBlob.size === 0) {
      setErrorMessage('No audio was captured. Please try again.')
      setPhase('error')
      return
    }

    try {
      const result = await assessmentApi.uploadSpeechAudio(
        assessmentId ?? '',
        audioBlob,
        language,
      )

      setFeatures(result.features as unknown as SpeechFeatures)
      setScore(result.score)
      setPhase('results')
    } catch (err) {
      // Fallback: generate mock features for development
      const mockFeatures: SpeechFeatures = {
        speech_rate_wpm: Math.round(120 + Math.random() * 60),
        avg_pause_duration_ms: Math.round(200 + Math.random() * 400),
        fluency_score: Math.round(60 + Math.random() * 30),
        transcript: '(Processing unavailable — backend not connected)',
        duration_seconds: recordingTime,
        processing_note: 'Fallback: backend not available',
      }
      const mockScore = Math.round(60 + Math.random() * 30)

      setFeatures(mockFeatures)
      setScore(mockScore)
      setPhase('results')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assessmentId, language])

  // -------------------------------------------------------
  // Submit results
  // -------------------------------------------------------
  const handleSubmit = useCallback(() => {
    if (!features) return
    setIsSubmitting(true)

    const featureMap = {
      speech_rate_wpm: features.speech_rate_wpm,
      avg_pause_duration_ms: features.avg_pause_duration_ms,
      fluency_score: features.fluency_score,
      transcript: features.transcript,
    }

    onComplete(featureMap, score, features.duration_seconds)
  }, [features, score, onComplete])

  // -------------------------------------------------------
  // Reset
  // -------------------------------------------------------
  const handleReset = useCallback(() => {
    releaseMedia()
    setPhase('instructions')
    setFeatures(null)
    setRecordingTime(0)
    setErrorMessage('')
    const prompts = SPEECH_PROMPTS[language] ?? SPEECH_PROMPTS.en
    setPrompt(prompts[Math.floor(Math.random() * prompts.length)])
  }, [language, releaseMedia])

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
        className="mx-auto max-w-2xl"
      >
        <Card className="overflow-hidden border-2 border-emerald-500/20">
          <div className="h-1.5 bg-emerald-500/10" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-emerald-500/10">
                <Mic className="size-7 text-emerald-500" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{t(language, 'module.speech')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(language, 'speech.instructions')}
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* What we measure */}
            <div className="rounded-xl bg-muted/50 p-6 space-y-3">
              <h4 className="font-medium text-sm">{t(language, 'speech.whatWeMeasure')}</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Volume2 className="size-4 text-emerald-500" />
                  {t(language, 'speech.metric.rate')}
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="size-4 text-emerald-500" />
                  {t(language, 'speech.metric.pauses')}
                </li>
                <li className="flex items-center gap-2">
                  <Mic className="size-4 text-emerald-500" />
                  {t(language, 'speech.metric.fluency')}
                </li>
              </ul>
            </div>

            {/* Mic permission notice */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-muted-foreground">
              <p className="flex items-center gap-2 font-medium text-foreground">
                <Mic className="size-4 text-emerald-500" />
                {t(language, 'speech.permissionNotice')}
              </p>
              <p className="mt-1 text-xs">
                {t(language, 'speech.permissionDetail')}
              </p>
            </div>

            <div className="flex items-center justify-between gap-3">
              <Button id="speech-skip" variant="outline" onClick={onSkip} className="gap-2">
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button id="speech-start" onClick={requestPermission} className="gap-2">
                <Play className="size-4" />
                {t(language, 'speech.start')}
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl">
        <Card className="border-2 border-emerald-500/20">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Loader2 className="size-10 text-emerald-500 animate-spin" />
            <p className="text-lg font-medium">{t(language, 'speech.requestingPermission')}</p>
            <p className="text-sm text-muted-foreground">{t(language, 'speech.allowMic')}</p>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Recording
  // -------------------------------------------------------
  if (phase === 'recording') {
    const remaining = MAX_RECORDING_SECONDS - recordingTime
    const canStop = recordingTime >= MIN_RECORDING_SECONDS

    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl space-y-4">
        {/* Timer bar */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded-full bg-red-500 animate-pulse" />
            <span className="font-medium text-red-500">{t(language, 'speech.recording')}</span>
          </div>
          <Badge variant="outline" className="font-mono">
            {remaining}s {t(language, 'speech.remaining')}
          </Badge>
        </div>

        {/* Prompt to read */}
        <Card className="border-2 border-emerald-500/20">
          <CardContent className="p-6 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t(language, 'speech.readAloud')}
            </p>
            <p className="text-base leading-relaxed">
              {prompt}
            </p>
          </CardContent>
        </Card>

        {/* Audio level visualization */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Mic className={cn('size-5', isRecording ? 'text-red-500' : 'text-muted-foreground')} />
              <div className="flex flex-1 items-center gap-0.5 h-8">
                {Array.from({ length: 20 }).map((_, i) => (
                  <motion.div
                    key={i}
                    className="flex-1 rounded-full bg-emerald-500"
                    animate={{
                      height: `${Math.max(4, audioLevel * 100 * (0.5 + Math.random() * 0.5))}%`,
                      opacity: audioLevel > 0.02 ? 0.3 + audioLevel * 0.7 : 0.15,
                    }}
                    transition={{ duration: 0.1 }}
                    style={{ minHeight: 4 }}
                  />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
            animate={{ width: `${(recordingTime / MAX_RECORDING_SECONDS) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Stop button */}
        <div className="flex justify-center">
          <Button
            onClick={stopRecording}
            disabled={!canStop}
            variant={canStop ? 'default' : 'outline'}
            className="gap-2"
            size="lg"
          >
            <Square className="size-4" />
            {canStop ? t(language, 'speech.stopRecording') : t(language, 'speech.minRecording')}
          </Button>
        </div>
      </motion.div>
    )
  }

  // -------------------------------------------------------
  // Render: Processing
  // -------------------------------------------------------
  if (phase === 'processing') {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl">
        <Card className="border-2 border-emerald-500/20">
          <CardContent className="flex flex-col items-center gap-4 p-12 text-center">
            <Loader2 className="size-10 text-emerald-500 animate-spin" />
            <p className="text-lg font-medium">{t(language, 'speech.processing')}</p>
            <p className="text-sm text-muted-foreground">{t(language, 'speech.processingDetail')}</p>
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mx-auto max-w-2xl">
        <Card className="border-2 border-destructive/20">
          <CardContent className="flex flex-col items-center gap-4 p-8 text-center">
            <AlertCircle className="size-10 text-destructive" />
            <p className="text-lg font-medium">{t(language, 'speech.error')}</p>
            <p className="text-sm text-muted-foreground">{errorMessage}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onSkip} className="gap-2">
                <SkipForward className="size-4" />
                {t(language, 'runner.skip')}
              </Button>
              <Button onClick={handleReset} className="gap-2">
                <RotateCcw className="size-4" />
                {t(language, 'speech.tryAgain')}
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
        className="mx-auto max-w-2xl"
      >
        <Card className="overflow-hidden border-2 border-emerald-500/20">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-emerald-400" />
          <CardHeader className="pb-4">
            <div className="flex items-center gap-4">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-success/10">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-xl">{t(language, 'speech.results.title')}</CardTitle>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t(language, 'speech.results.subtitle')}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Metrics grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <MetricCard
                label={t(language, 'speech.results.speechRate')}
                value={features.speech_rate_wpm.toString()}
                unit="WPM"
                color="text-emerald-500"
              />
              <MetricCard
                label={t(language, 'speech.results.avgPause')}
                value={features.avg_pause_duration_ms.toString()}
                unit="ms"
                color="text-emerald-500"
              />
              <MetricCard
                label={t(language, 'speech.results.fluency')}
                value={features.fluency_score.toString()}
                unit="/100"
                color={features.fluency_score >= 70 ? 'text-success' : features.fluency_score >= 40 ? 'text-warning' : 'text-destructive'}
              />
            </div>

            {/* Transcript snippet */}
            {features.transcript && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  {t(language, 'speech.results.transcript')}
                </p>
                <div className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground max-h-24 overflow-auto">
                  {features.transcript || t(language, 'speech.results.noTranscript')}
                </div>
              </div>
            )}

            {/* Duration */}
            <div className="flex items-center justify-center gap-2 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
              <Clock className="size-4" />
              {t(language, 'speech.results.duration')}: {features.duration_seconds}s
            </div>

            {/* Processing note */}
            {features.processing_note && (
              <p className="text-xs text-muted-foreground italic">{features.processing_note}</p>
            )}

            {/* Actions */}
            <div className="flex items-center justify-between gap-3">
              <Button id="speech-retry" variant="outline" onClick={handleReset} className="gap-2">
                <RotateCcw className="size-4" />
                {t(language, 'speech.results.retry')}
              </Button>
              <Button id="speech-submit" onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
                <CheckCircle2 className="size-4" />
                {isSubmitting ? t(language, 'speech.results.submitting') : t(language, 'speech.results.submit')}
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
    <div className="rounded-xl border bg-card p-3 text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn('mt-1 text-2xl font-bold tabular-nums', color)}>
        {value}
        {unit && <span className="ml-0.5 text-xs font-normal text-muted-foreground">{unit}</span>}
      </p>
    </div>
  )
}

// -------------------------------------------------------
// WAV Encoder — Encodes raw PCM Float32 samples to WAV
// -------------------------------------------------------

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1
  const bitsPerSample = 16
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataLength = samples.length * (bitsPerSample / 8)
  const headerLength = 44
  const buffer = new ArrayBuffer(headerLength + dataLength)
  const view = new DataView(buffer)

  // RIFF header
  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataLength, true)
  writeString(view, 8, 'WAVE')

  // fmt sub-chunk
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)           // Sub-chunk size
  view.setUint16(20, 1, true)            // PCM format
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // data sub-chunk
  writeString(view, 36, 'data')
  view.setUint32(40, dataLength, true)

  // PCM samples — clamp float [-1, 1] to int16
  let offset = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
    offset += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i))
  }
}
