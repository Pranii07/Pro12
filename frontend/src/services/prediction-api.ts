// ===========================================================
// NeuroScreen — Prediction API Service
// ===========================================================
// Client-side API functions for ML screening predictions.
// Uses the shared Axios instance from services/api.ts.
//
// IMPORTANT: Predictions are Behavioural Screening Levels,
// NOT medical diagnoses.
// ===========================================================

import { api } from '@/services/api'
import type { ScreeningLevel, ModuleType } from '@/types/database'

// -------------------------------------------------------
// Response Types
// -------------------------------------------------------

export interface PredictionResponse {
  id: string
  assessment_id: string
  model_version: string
  model_name: string
  screening_level: ScreeningLevel
  overall_score: number | null
  /** Model screening distribution — never called "probability" */
  model_distribution: Record<ScreeningLevel, number>
  /** Per-module normalized scores (0-100). null = skipped */
  module_scores: Record<ModuleType, number | null>
  features_used: Record<string, unknown>
  modalities_present: Record<ModuleType, boolean>
  created_at: string
  disclaimer: string
  prototype_notice: string
}

export interface PredictionHistoryItem {
  id: string
  assessment_id: string
  screening_level: ScreeningLevel
  overall_score: number | null
  module_scores: Record<ModuleType, number | null>
  model_name: string
  created_at: string
}

// -------------------------------------------------------
// API Functions
// -------------------------------------------------------

export const predictionApi = {
  /**
   * Trigger ML screening prediction for a completed assessment.
   * Calls: POST /api/predictions/assessments/{id}/predict
   */
  trigger: async (assessmentId: string): Promise<PredictionResponse> => {
    const res = await api.post<PredictionResponse>(
      `/predictions/assessments/${assessmentId}/predict`
    )
    return res.data
  },

  /**
   * Get existing prediction for an assessment (if already generated).
   * Calls: GET /api/assessments/{id}/prediction
   */
  get: async (assessmentId: string): Promise<PredictionResponse> => {
    const res = await api.get<PredictionResponse>(
      `/assessments/${assessmentId}/prediction`
    )
    return res.data
  },

  /**
   * Get the current user's latest prediction (for dashboard overview).
   * Calls: GET /api/predictions/latest
   * Returns null if no prediction exists yet (404).
   */
  getLatest: async (): Promise<PredictionResponse | null> => {
    try {
      const res = await api.get<PredictionResponse>('/predictions/latest')
      return res.data
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return null
      }
      throw error
    }
  },

  /**
   * Get all predictions for the current user (for score trends chart).
   * Calls: GET /api/predictions/history
   */
  getHistory: async (limit?: number): Promise<PredictionHistoryItem[]> => {
    const res = await api.get<PredictionHistoryItem[]>('/predictions/history', {
      params: limit ? { limit } : undefined,
    })
    return res.data
  },
}
