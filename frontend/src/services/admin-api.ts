// ===========================================================
// NeuroScreen — Admin API Service
// ===========================================================
// Client-side API functions for admin dashboard endpoints.
// All endpoints require ADMIN role — returns 403 for non-admins.
// ===========================================================

import { api } from '@/services/api'
import type { ScreeningLevel, LanguageCode } from '@/types/database'

// -------------------------------------------------------
// Response Types
// -------------------------------------------------------

export interface AdminStats {
  total_users: number
  total_assessments: number
  completed_assessments: number
  total_reports: number
  screening_distribution: Record<ScreeningLevel, number>
  prototype_notice: string
}

export interface AdminUser {
  id: string
  email?: string | null
  full_name: string
  role: 'USER' | 'ADMIN'
  language_preference: LanguageCode
  avatar_url: string | null
  created_at: string
  updated_at: string
  total_assessments: number
  completed_assessments: number
  cognitive_tests?: number
  last_assessment_at?: string | null
}

export interface AdminAssessment {
  id: string
  language: LanguageCode
  status: 'in_progress' | 'completed' | 'abandoned'
  started_at: string
  completed_at: string | null
  modules_completed: number
  modules_total: number
  screening_level: ScreeningLevel | null
}

export interface ModelMetadata {
  model_name: string
  model_version: string
  training_date: string | null
  dataset_description: string
  feature_schema: Record<string, unknown>
  metrics: Record<string, unknown>
  prototype_notice: string
}

export interface UserDossier {
  profile: {
    id: string
    email?: string | null
    full_name: string
    role: 'USER' | 'ADMIN'
    language_preference: LanguageCode
    avatar_url: string | null
    created_at: string
    updated_at: string
  }
  assessments: Array<{
    id: string
    language: LanguageCode
    status: 'in_progress' | 'completed' | 'abandoned'
    started_at: string
    completed_at: string | null
    module_results?: Array<Record<string, unknown>>
    predictions?: Array<Record<string, unknown>> | Record<string, unknown>
  }>
  reports: Array<{
    id: string
    assessment_id: string
    storage_path: string
    file_name: string
    file_size_bytes: number
    generated_at: string
  }>
}

// -------------------------------------------------------
// API Functions
// -------------------------------------------------------

export const adminApi = {
  /**
   * Get admin dashboard statistics.
   * Calls: GET /api/admin/stats
   */
  getStats: async (): Promise<AdminStats> => {
    const res = await api.get<AdminStats>('/admin/stats')
    return res.data
  },

  /**
   * List all users with their assessment stats.
   * Calls: GET /api/admin/users
   */
  getUsers: async (params?: {
    limit?: number
    offset?: number
  }): Promise<AdminUser[]> => {
    const res = await api.get<AdminUser[]>('/admin/users', { params })
    return res.data
  },

  /**
   * Update user details or role.
   * Calls: PATCH /api/admin/users/{userId}
   */
  updateUser: async (
    userId: string,
    data: {
      full_name?: string
      role?: 'USER' | 'ADMIN'
      language_preference?: LanguageCode
    }
  ): Promise<AdminUser> => {
    const res = await api.patch<AdminUser>(`/admin/users/${userId}`, data)
    return res.data
  },

  /**
   * Delete a user profile and all related assessment data.
   * Calls: DELETE /api/admin/users/{userId}
   */
  deleteUser: async (userId: string): Promise<{ message: string; id: string }> => {
    const res = await api.delete<{ message: string; id: string }>(`/admin/users/${userId}`)
    return res.data
  },

  /**
   * Get a full user dossier (assessments, results, reports).
   * Calls: GET /api/admin/users/{userId}/details
   */
  getUserDetails: async (userId: string): Promise<UserDossier> => {
    const res = await api.get<UserDossier>(`/admin/users/${userId}/details`)
    return res.data
  },

  /**
   * Promote the current user to ADMIN (quick evaluation helper).
   * Calls: POST /api/admin/claim-admin
   */
  claimAdmin: async (): Promise<{ message: string; role: string }> => {
    const res = await api.post<{ message: string; role: string }>('/admin/claim-admin')
    return res.data
  },

  /**
   * List all assessments across all users.
   * Calls: GET /api/admin/assessments
   */
  getAssessments: async (params?: {
    status?: string
    limit?: number
    offset?: number
  }): Promise<AdminAssessment[]> => {
    const res = await api.get<AdminAssessment[]>('/admin/assessments', { params })
    return res.data
  },

  /**
   * Get ML model metadata (read-only).
   * Calls: GET /api/admin/model-info
   */
  getModelInfo: async (): Promise<ModelMetadata> => {
    const res = await api.get<ModelMetadata>('/admin/model-info')
    return res.data
  },
}
