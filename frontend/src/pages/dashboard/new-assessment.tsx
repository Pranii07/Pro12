// ===========================================================
// NeuroScreen — New Assessment Page
// ===========================================================
// Master orchestrator for the multi-step assessment flow.
// Renders the correct step component based on the current
// flow state from useAssessmentFlow().
//
// Flow: Language → Modules → Questionnaire → Assessment → Complete
// ===========================================================

import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent } from '@/components/ui/card'
import { useAssessmentFlow } from '@/hooks/use-assessment-flow'

// Step components
import { AssessmentProgress } from '@/components/assessment/assessment-progress'
import { LanguageStep } from '@/components/assessment/language-step'
import { ModuleSelectionStep } from '@/components/assessment/module-selection-step'
import { QuestionnaireStep } from '@/components/assessment/questionnaire-step'
import { AssessmentRunner } from '@/components/assessment/assessment-runner'
import { CompletionStep } from '@/components/assessment/completion-step'

export function NewAssessmentPage() {
  const navigate = useNavigate()

  const {
    step,
    language,
    assessment,
    modules,
    currentModuleIndex,
    questionnaire,
    error,
    loading,
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
  } = useAssessmentFlow()

  const handleAbandon = useCallback(async () => {
    await abandonAssessment()
    navigate('/dashboard')
  }, [abandonAssessment, navigate])

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Progress Stepper */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardContent className="p-4 sm:p-6">
            <AssessmentProgress currentStep={step} language={language} />
          </CardContent>
        </Card>
      </motion.div>

      {/* Step Content */}
      <AnimatePresence mode="wait">
        {step === 'language' && (
          <LanguageStep
            key="language"
            language={language}
            onSelect={setLanguage}
            onContinue={goToModuleSelection}
          />
        )}

        {step === 'modules' && (
          <ModuleSelectionStep
            key="modules"
            language={language}
            modules={modules}
            error={error}
            onToggle={toggleModule}
            onSelectAll={selectAll}
            onContinue={goToQuestionnaire}
            onBack={goBack}
          />
        )}

        {step === 'questionnaire' && (
          <QuestionnaireStep
            key="questionnaire"
            language={language}
            questionnaire={questionnaire}
            loading={loading}
            error={error}
            onUpdate={updateQuestionnaire}
            onStart={startAssessment}
            onBack={goBack}
          />
        )}

        {step === 'assessment' && (
          <AssessmentRunner
            key="assessment"
            language={language}
            selectedModules={selectedModules}
            currentModuleIndex={currentModuleIndex}
            currentModule={currentModule}
            completedCount={completedCount}
            assessmentId={assessment?.id ?? null}
            onComplete={completeModule}
            onSkip={skipModule}
            onAbandon={handleAbandon}
          />
        )}

        {step === 'complete' && (
          <CompletionStep
            key="complete"
            language={language}
            modules={modules}
            assessmentId={assessment?.id ?? null}
            onFinish={finishAssessment}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
