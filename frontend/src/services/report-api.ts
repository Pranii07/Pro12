// ===========================================================
// NeuroScreen — Report API Service
// ===========================================================
// Client-side API functions for PDF report generation and
// management. Uses the shared Axios instance from services/api.ts.
//
// IMPORTANT: Reports contain Behavioural Screening Levels,
// NOT medical diagnoses.
// ===========================================================

import { api } from '@/services/api'

// -------------------------------------------------------
// Response Types
// -------------------------------------------------------

export interface ReportResponse {
  id: string
  assessment_id: string
  user_id: string
  storage_path: string
  file_name: string
  file_size_bytes: number | null
  generated_at: string
  created_at: string
  disclaimer: string
  prototype_notice: string
}

export interface ReportListItem {
  id: string
  assessment_id: string
  file_name: string
  file_size_bytes: number | null
  generated_at: string
  created_at: string
}

export interface ReportDownloadResponse {
  report_id: string
  file_name: string
  download_url: string
  expires_in_seconds: number
  disclaimer: string
}

// -------------------------------------------------------
// API Functions
// -------------------------------------------------------

export const reportApi = {
  /**
   * Generate a PDF report for a completed assessment.
   * Calls: POST /api/reports/assessments/{id}/generate
   */
  generate: async (assessmentId: string): Promise<ReportResponse> => {
    const res = await api.post<ReportResponse>(
      `/reports/assessments/${assessmentId}/generate`
    )
    return res.data
  },

  /**
   * List all reports for the current user.
   * Calls: GET /api/reports
   */
  list: async (): Promise<ReportListItem[]> => {
    const res = await api.get<ReportListItem[]>('/reports')
    return res.data
  },

  /**
   * Get a temporary signed URL for downloading a report PDF.
   * Calls: GET /api/reports/{id}/download
   */
  getDownloadUrl: async (reportId: string): Promise<ReportDownloadResponse> => {
    const res = await api.get<ReportDownloadResponse>(
      `/reports/${reportId}/download`
    )
    return res.data
  },

  /**
   * Download the PDF report file directly as a Blob attachment.
   * Calls: GET /api/reports/{id}/file
   * Saves directly to the user's browser Downloads.
   */
  downloadFile: async (reportId: string, fileName?: string): Promise<void> => {
    const res = await api.get(`/reports/${reportId}/file`, {
      responseType: 'blob',
    })
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName || `neuroscreen_report_${reportId.slice(0, 8)}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  },

  /**
   * Generate and download a PDF report directly — no storage required.
   * Calls: POST /api/reports/assessments/{assessmentId}/download-direct
   * This is a reliable fallback when Supabase Storage is not configured.
   */
  directDownload: async (
    assessmentId: string,
    payload?: {
      prediction?: unknown
      modules?: unknown
      user_name?: string
    },
  ): Promise<void> => {
    const res = await api.post(
      `/reports/assessments/${assessmentId}/download-direct`,
      payload || null,
      { responseType: 'blob', timeout: 60000 },
    )
    const blob = new Blob([res.data], { type: 'application/pdf' })
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `neuroscreen_report_${assessmentId.slice(0, 8)}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => window.URL.revokeObjectURL(url), 1000)
  },
}
