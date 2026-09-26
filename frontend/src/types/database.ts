// ===========================================================
// NeuroScreen — Database Types
// ===========================================================
// TypeScript types matching the PostgreSQL schema.
// These types are used throughout the frontend for type safety.
// ===========================================================

// -------------------------------------------------------
// Enums (matching PostgreSQL enum types)
// -------------------------------------------------------

export type UserRole = 'USER' | 'ADMIN'

export type AssessmentStatus = 'in_progress' | 'completed' | 'abandoned'

export type ModuleType = 'typing' | 'memory' | 'reaction' | 'speech' | 'facial'

export type ModuleStatus = 'completed' | 'skipped' | 'pending'

export type ScreeningLevel = 'LOW' | 'MODERATE' | 'HIGH'

export type LanguageCode = 'en' | 'kn'

// -------------------------------------------------------
// Table Row Types
// -------------------------------------------------------

export interface Profile {
  id: string
  full_name: string
  role: UserRole
  language_preference: LanguageCode
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export interface Assessment {
  id: string
  user_id: string
  language: LanguageCode
  status: AssessmentStatus
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

export interface ModuleResult {
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

export interface Prediction {
  id: string
  assessment_id: string
  model_version: string
  model_name: string
  screening_level: ScreeningLevel
  overall_score: number | null
  /** Model screening distribution — never called "probability" */
  model_distribution: Record<ScreeningLevel, number>
  features_used: Record<string, unknown>
  modalities_present: Record<ModuleType, boolean>
  created_at: string
}

export interface Report {
  id: string
  assessment_id: string
  user_id: string
  storage_path: string
  file_name: string
  file_size_bytes: number | null
  generated_at: string
  created_at: string
}

// -------------------------------------------------------
// Module Feature Types (per-module feature shapes)
// -------------------------------------------------------

export interface TypingFeatures {
  wpm: number
  cpm: number
  accuracy: number
  backspace_count: number
  avg_hold_time_ms: number
  avg_flight_time_ms: number
}

export interface MemoryFeatures {
  word_recall_accuracy: number
  number_recall_accuracy: number
  image_memory_accuracy: number
  pattern_memory_accuracy: number
  avg_completion_time_ms: number
}

export interface ReactionFeatures {
  avg_reaction_time_ms: number
  fastest_reaction_time_ms: number
  slowest_reaction_time_ms: number
  false_start_count: number
  consistency_score: number
}

export interface SpeechFeatures {
  speech_rate_wpm: number
  avg_pause_duration_ms: number
  fluency_score: number
  transcript: string
}

export interface FacialFeatures {
  blink_rate_per_minute: number
  avg_head_movement: number
  head_orientation_stability: number
  attention_score: number
}

export type ModuleFeatures =
  | TypingFeatures
  | MemoryFeatures
  | ReactionFeatures
  | SpeechFeatures
  | FacialFeatures

// -------------------------------------------------------
// Composite Types (for UI convenience)
// -------------------------------------------------------

/** Assessment with its module results and prediction */
export interface AssessmentWithDetails extends Assessment {
  module_results: ModuleResult[]
  prediction: Prediction | null
  report: Report | null
}

/** Module info for assessment selection UI */
export interface ModuleInfo {
  type: ModuleType
  name: string
  description: string
  icon: string
  requiresHardware: 'none' | 'microphone' | 'camera'
  isOptional: boolean
}

// -------------------------------------------------------
// Constants
// -------------------------------------------------------

export const MODULE_INFO: Record<ModuleType, ModuleInfo> = {
  typing: {
    type: 'typing',
    name: 'Typing Analysis',
    description: 'Measures typing speed, accuracy, and keystroke patterns.',
    icon: 'Keyboard',
    requiresHardware: 'none',
    isOptional: true,
  },
  memory: {
    type: 'memory',
    name: 'Memory Tests',
    description: 'Tests word recall, number recall, and image memory matching game.',
    icon: 'Brain',
    requiresHardware: 'none',
    isOptional: true,
  },
  reaction: {
    type: 'reaction',
    name: 'Reaction Time',
    description: 'Measures response time to visual stimuli with false-start detection.',
    icon: 'Timer',
    requiresHardware: 'none',
    isOptional: true,
  },
  speech: {
    type: 'speech',
    name: 'Speech Analysis',
    description: 'Analyzes speech rate, pauses, and fluency from a short recording.',
    icon: 'Mic',
    requiresHardware: 'microphone',
    isOptional: true,
  },
  facial: {
    type: 'facial',
    name: 'Facial Analysis',
    description: 'Measures blink rate, head movement, and attention from camera input.',
    icon: 'Camera',
    requiresHardware: 'camera',
    isOptional: true,
  },
}

export const ALL_MODULE_TYPES: ModuleType[] = [
  'typing',
  'memory',
  'reaction',
  'speech',
  'facial',
]

export const SCREENING_LEVEL_ORDER: ScreeningLevel[] = ['LOW', 'MODERATE', 'HIGH']
