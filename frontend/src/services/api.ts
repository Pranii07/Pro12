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
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return null

    // Proactively refresh if token expires within 60 seconds
    const now = Math.floor(Date.now() / 1000)
    if (session.expires_at && session.expires_at - now < 60) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const { data, error } = await supabase.auth.refreshSession()
            if (error || !data.session) {
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
      return await refreshPromise
    }

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

// Response interceptor: handle common errors with single refresh and retry guard
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
        } else {
          // Refresh failed or no session — clear stale session and redirect to login
          console.warn('[API] Session expired or invalid. Redirecting to login.')
          try {
            await supabase.auth.signOut()
          } catch {
            // Ignore signout errors
          }
          if (!window.location.pathname.startsWith('/login')) {
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`
          }
        }
      } catch {
        // Refresh failed
      }
    }

    return Promise.reject(error)
  }
)
