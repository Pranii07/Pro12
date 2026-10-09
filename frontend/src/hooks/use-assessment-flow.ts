// ===========================================================
// NeuroScreen — Assessment Flow Hook
// ===========================================================
// Manages assessment session state: creation, module ordering,
// current step tracking, skip logic, and session completion.
//
// This hook is the single source of truth for the multi-step
// assessment flow. It does NOT handle individual module UI —
// each module page consumes this hook to know which module
// is active and to report completion/skip.
// ===========================================================

import { useState, useCallback, useMemo } from 'react'
import type { LanguageCode, ModuleType } from '@/types/database'
import { ALL_MODULE_TYPES } from '@/types/database'
import type { AssessmentResponse, ModuleResultResponse } from '@/services/assessment-api'
import { assessmentApi } from '@/services/assessment-api'

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export type FlowStep =
  | 'language'       // Step 1: choose language
  | 'modules'        // Step 2: choose which modules to attempt
  | 'questionnaire'  // Step 3: pre-assessment contextual factors
  | 'assessment'     // Step 4: running modules sequentially
  | 'complete'       // Step 5: all chosen modules done

export interface ModuleState {
  type: ModuleType
  selected: boolean
  status: 'pending' | 'completed' | 'skipped'
  skipReason?: string
  result?: ModuleResultResponse
}

export interface AssessmentFlowState {
  step: FlowStep
  language: LanguageCode
  assessment: AssessmentResponse | null
  modules: ModuleState[]
  currentModuleIndex: number
  questionnaire: Record<string, string>
  error: string | null
  loading: boolean
}

// -------------------------------------------------------
// Hook
// -------------------------------------------------------

export function useAssessmentFlow() {
  const [state, setState] = useState<AssessmentFlowState>({
    step: 'language',
    language: 'en',
    assessment: null,
    modules: ALL_MODULE_TYPES.map((type) => ({
      type,
      selected: true, // All selected by default
      status: 'pending',
    })),
    currentModuleIndex: 0,
    questionnaire: {},
    error: null,
    loading: false,
  })

  // Computed: selected modules only
  const selectedModules = useMemo(
    () => state.modules.filter((m) => m.selected),
    [state.modules]
  )

  // Computed: current module in the flow
  const currentModule = useMemo(
    () => selectedModules[state.currentModuleIndex] ?? null,
    [selectedModules, state.currentModuleIndex]
  )

  // Computed: how many are done (completed + skipped)
  const completedCount = useMemo(
    () => selectedModules.filter((m) => m.status !== 'pending').length,
    [selectedModules]
  )

  // -------------------------------------------------------
  // Step 1: Set language
  // -------------------------------------------------------
  const setLanguage = useCallback((lang: LanguageCode) => {
    setState((prev) => ({ ...prev, language: lang }))
  }, [])

  const goToModuleSelection = useCallback(() => {
    setState((prev) => ({ ...prev, step: 'modules' }))
  }, [])

  // -------------------------------------------------------
  // Step 2: Toggle module selection
  // -------------------------------------------------------
  const toggleModule = useCallback((type: ModuleType) => {
    setState((prev) => ({
      ...prev,
      error: null,
      modules: prev.modules.map((m) =>
        m.type === type ? { ...m, selected: !m.selected } : m
      ),
    }))
  }, [])

  const selectAll = useCallback(() => {
    setState((prev) => {
      const allSelected = prev.modules.every((m) => m.selected)
      return {
        ...prev,
        error: null,
        modules: prev.modules.map((m) => ({ ...m, selected: !allSelected })),
      }
    })
  }, [])

  const goToQuestionnaire = useCallback(() => {
    setState((prev) => {
      const hasSelected = prev.modules.some((m) => m.selected)
      if (!hasSelected) {
        return { ...prev, error: 'Please select at least one assessment module.' }
      }
      return { ...prev, step: 'questionnaire', error: null }
    })
  }, [])

  // -------------------------------------------------------
  // Step 3: Questionnaire
  // -------------------------------------------------------
  const updateQuestionnaire = useCallback((key: string, value: string) => {
    setState((prev) => ({
      ...prev,
      questionnaire: { ...prev.questionnaire, [key]: value },
    }))
  }, [])

  const startAssessment = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      let assessment: AssessmentResponse
      try {
        assessment = await assessmentApi.create({ language: state.language }, true)
      } catch (err: any) {
        if (err?.response?.status === 409) {
          // User already has an in-progress assessment — resume it seamlessly!
          const inProgress = await assessmentApi.list({ status: 'in_progress', limit: 1 })
          if (inProgress && inProgress.length > 0) {
            const existingFull = await assessmentApi.get(inProgress[0].id)
            try {
              localStorage.setItem(`neuroscreen_context_${existingFull.id}`, JSON.stringify(state.questionnaire))
            } catch {
              // best-effort storage
            }
            setState((prev) => ({
              ...prev,
              assessment: {
                id: existingFull.id,
                user_id: existingFull.user_id,
                language: existingFull.language,
                status: existingFull.status,
                started_at: existingFull.started_at,
                completed_at: existingFull.completed_at,
                created_at: existingFull.created_at,
                updated_at: existingFull.updated_at,
              },
              step: 'assessment',
              currentModuleIndex: existingFull.module_results?.length || 0,
              loading: false,
            }))
            return
          }
        }
        throw err
      }

      try {
        localStorage.setItem(`neuroscreen_context_${assessment.id}`, JSON.stringify(state.questionnaire))
      } catch {
        // best-effort storage
      }

      setState((prev) => ({
        ...prev,
        assessment,
        step: 'assessment',
        currentModuleIndex: 0,
        loading: false,
      }))
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create assessment session'
      setState((prev) => ({ ...prev, loading: false, error: message }))
    }
  }, [state.language, state.questionnaire])

  // -------------------------------------------------------
  // Step 4: Module execution
  // -------------------------------------------------------

  /** Mark the current module as completed and move to the next */
  const completeModule = useCallback(
    async (result: ModuleResultResponse) => {
      setState((prev) => {
        const current = prev.modules.filter((m) => m.selected)[prev.currentModuleIndex]
        if (!current) return prev

        const updatedModules = prev.modules.map((m) =>
          m.type === current.type ? { ...m, status: 'completed' as const, result } : m
        )
        const selected = updatedModules.filter((m) => m.selected)
        const nextIndex = prev.currentModuleIndex + 1
        const isDone = nextIndex >= selected.length

        return {
          ...prev,
          modules: updatedModules,
          currentModuleIndex: isDone ? prev.currentModuleIndex : nextIndex,
          step: isDone ? 'complete' : prev.step,
        }
      })
    },
    []
  )

  /** Skip the current module with a reason and move to the next */
  const skipModule = useCallback(
    async (reason: string) => {
      if (!state.assessment) return

      const current = selectedModules[state.currentModuleIndex]
      if (!current) return

      try {
        // Submit skipped module to the API
        await assessmentApi.submitModule(state.assessment.id, {
          module_type: current.type,
          status: 'skipped',
          features: {},
          score: null,
          duration_seconds: null,
          skip_reason: reason,
        })

        setState((prev) => {
          const updatedModules = prev.modules.map((m) =>
            m.type === current.type ? { ...m, status: 'skipped' as const, skipReason: reason } : m
          )
          const selected = updatedModules.filter((m) => m.selected)
          const nextIndex = prev.currentModuleIndex + 1
          const isDone = nextIndex >= selected.length

          return {
            ...prev,
            modules: updatedModules,
            currentModuleIndex: isDone ? prev.currentModuleIndex : nextIndex,
            step: isDone ? 'complete' : prev.step,
          }
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Failed to skip module'
        setState((prev) => ({ ...prev, error: message }))
      }
    },
    [state.assessment, selectedModules, state.currentModuleIndex]
  )

  /** Complete the entire assessment session */
  const finishAssessment = useCallback(async () => {
    if (!state.assessment) return
    setState((prev) => ({ ...prev, loading: true }))
    try {
      await assessmentApi.update(state.assessment.id, { status: 'completed' })
    } catch {
      // Assessment finalization is best-effort — don't block the user
    } finally {
      setState((prev) => ({ ...prev, loading: false }))
    }
  }, [state.assessment])

  /** Abandon the assessment */
  const abandonAssessment = useCallback(async () => {
    if (!state.assessment) return
    try {
      await assessmentApi.update(state.assessment.id, { status: 'abandoned' })
    } catch {
      // best-effort
    }
  }, [state.assessment])

  /** Go back one step */
  const goBack = useCallback(() => {
    setState((prev) => {
      const stepOrder: FlowStep[] = ['language', 'modules', 'questionnaire', 'assessment', 'complete']
      const currentIdx = stepOrder.indexOf(prev.step)
      if (currentIdx <= 0) return prev
      // Don't allow going back from 'assessment' once started
      if (prev.step === 'assessment' || prev.step === 'complete') return prev
      return { ...prev, step: stepOrder[currentIdx - 1], error: null }
    })
  }, [])

  return {
    ...state,
    selectedModules,
    currentModule,
    completedCount,
    setLanguage,
    goToModuleSelection,
    toggleModule,
    selectAll,
    goToQuestionnaire,
    updateQuestionnaire,
    startAssessment,
    completeModule,
    skipModule,
    finishAssessment,
    abandonAssessment,
    goBack,
  }
}
