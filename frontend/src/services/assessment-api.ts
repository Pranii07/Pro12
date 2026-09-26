// ===========================================================
// NeuroScreen — Assessment API Service
// ===========================================================
// API calls for assessment session management and module results.
// Uses the Axios instance from services/api.ts with JWT injection.
// ===========================================================

import { api } from '@/services/api'
import type { LanguageCode, ModuleType, ModuleStatus } from '@/types/database'

// -------------------------------------------------------
// Request Types
// -------------------------------------------------------

export interface CreateAssessmentRequest {
  language: LanguageCode
}

export interface UpdateAssessmentRequest {
  status: 'in_progress' | 'completed' | 'abandoned'
}

export interface SubmitModuleResultRequest {
  module_type: ModuleType
  status: ModuleStatus
  features?: Record<string, unknown>
  score?: number | null
  duration_seconds?: number | null
  skip_reason?: string | null
}

/** Response from speech/facial media upload endpoints */
export interface MediaUploadResponse {
  success: boolean
  features: Record<string, unknown>
  score: number
  disclaimer?: string
}

// -------------------------------------------------------
// Response Types
// -------------------------------------------------------

export interface AssessmentResponse {
  id: string
  user_id: string
  language: LanguageCode
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ModuleResultResponse {
  id: string
  assessment_id: string
  module_type: ModuleType
  status: ModuleStatus
  features: Record<string, unknown>
  score: number | null
  duration_seconds: number | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface AssessmentWithModulesResponse extends AssessmentResponse {
  module_results: ModuleResultResponse[]
}

export interface AssessmentSummaryResponse {
  id: string
  language: LanguageCode
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  modules_completed: number
  modules_total: number
  screening_level: string | null
}

// -------------------------------------------------------
// API Functions
// -------------------------------------------------------

export const assessmentApi = {
  /** Create a new assessment session */
  create: async (data: CreateAssessmentRequest, abandonExisting: boolean = true): Promise<AssessmentResponse> => {
    const res = await api.post<AssessmentResponse>('/assessments', data, {
      params: { abandon_existing: abandonExisting },
    })
    return res.data
  },

  /** List current user's assessments */
  list: async (params?: { status?: string; limit?: number; offset?: number }): Promise<AssessmentSummaryResponse[]> => {
    const res = await api.get<AssessmentSummaryResponse[]>('/assessments', { params })
    return res.data
  },

  /** Get a single assessment with module results */
  get: async (id: string): Promise<AssessmentWithModulesResponse> => {
    const res = await api.get<AssessmentWithModulesResponse>(`/assessments/${id}`)
    return res.data
  },

  /** Update assessment status (complete, abandon) */
  update: async (id: string, data: UpdateAssessmentRequest): Promise<AssessmentResponse> => {
    const res = await api.patch<AssessmentResponse>(`/assessments/${id}`, data)
    return res.data
  },

  /** Submit a module result (completed or skipped) */
  submitModule: async (assessmentId: string, data: SubmitModuleResultRequest): Promise<ModuleResultResponse> => {
    const res = await api.post<ModuleResultResponse>(`/assessments/${assessmentId}/modules`, data)
    return res.data
  },

  /** Upload speech audio for server-side feature extraction (Section 6 pipeline) */
  uploadSpeechAudio: async (
    assessmentId: string,
    audioBlob: Blob,
    language: string = 'en',
  ): Promise<MediaUploadResponse> => {
    const formData = new FormData()
    formData.append('audio_file', audioBlob, 'recording.wav')
    formData.append('assessment_id', assessmentId)
    formData.append('language', language)
    const res = await api.post<MediaUploadResponse>('/media/speech', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000, // Speech processing may take longer
    })
    return res.data
  },

  /** Upload facial frames (base64 JPEG) for server-side feature extraction (Section 6 pipeline) */
  uploadFacialFrames: async (
    assessmentId: string,
    frames: string[],
    captureDurationSeconds: number,
  ): Promise<MediaUploadResponse> => {
    const res = await api.post<MediaUploadResponse>('/media/facial', {
      assessment_id: assessmentId,
      frames,
      capture_duration_seconds: captureDurationSeconds,
    }, {
      timeout: 60000, // Frame processing may take longer
    })
    return res.data
  },
}
