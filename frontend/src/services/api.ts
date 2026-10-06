// ===========================================================
// NeuroScreen — API Service
// ===========================================================
// Axios instance with automatic JWT injection from Supabase session.
// All API calls go through this instance.
// ===========================================================

import axios from 'axios'
import type { InternalAxiosRequestConfig } from 'axios'
import { supabase } from '@/lib/supabase'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'

export const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// Single inflight refresh promise to avoid concurrent refresh requests and 429 errors
let refreshPromise: Promise<string | null> | null = null

async function getValidAccessToken(): Promise<string | null> {
  try {
    // supabase.auth.getSession() automatically refreshes tokens that are expired or expiring
    const { data: { session }, error } = await supabase.auth.getSession()
    if (error || !session) return null
    return session.access_token
  } catch {
    return null
  }
}

// Request interceptor: attach JWT from Supabase session
api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    try {
      const token = await getValidAccessToken()
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    } catch {
      // If token fetch fails, proceed without auth header
    }
    return config
  },
  (error) => Promise.reject(error)
)

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retry?: boolean
}

// Response interceptor: handle 401 with a single refresh attempt, without wiping user session
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as RetryableConfig | undefined

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true

      try {
        if (!refreshPromise) {
          refreshPromise = (async () => {
            try {
              const { data, error: refreshError } = await supabase.auth.refreshSession()
              if (refreshError || !data.session) {
                return null
              }
              return data.session.access_token
            } catch {
              return null
            } finally {
              refreshPromise = null
            }
          })()
        }

        const newToken = await refreshPromise
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`
          return api.request(originalRequest)
        }
      } catch {
        // Refresh failed, fall through to reject
      }
    }

    return Promise.reject(error)
  }
)
