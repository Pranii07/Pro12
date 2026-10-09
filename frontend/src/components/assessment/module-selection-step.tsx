// ===========================================================
// NeuroScreen — Module Selection Step
// ===========================================================
// Step 2: User picks which of the 5 assessment modules
// to include. Grid of toggleable cards with hardware badges.
// ===========================================================

import { motion, AnimatePresence } from 'framer-motion'
import {
  Keyboard,
  Brain,
  Timer,
  Mic,
  Camera,
  Check,
  Info,
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { LanguageCode, ModuleType } from '@/types/database'
import { MODULE_INFO } from '@/types/database'
import type { ModuleState } from '@/hooks/use-assessment-flow'

interface ModuleSelectionStepProps {
  language: LanguageCode
  modules: ModuleState[]
  error: string | null
  onToggle: (type: ModuleType) => void
  onSelectAll: () => void
  onContinue: () => void
  onBack: () => void
}

const MODULE_ICONS: Record<ModuleType, React.ElementType> = {
  typing: Keyboard,
  memory: Brain,
  reaction: Timer,
  speech: Mic,
  facial: Camera,
}

const MODULE_GRADIENTS: Record<ModuleType, string> = {
  typing: 'from-blue-500/10 to-indigo-500/10',
  memory: 'from-purple-500/10 to-pink-500/10',
  reaction: 'from-amber-500/10 to-orange-500/10',
  speech: 'from-emerald-500/10 to-teal-500/10',
  facial: 'from-rose-500/10 to-red-500/10',
}

const MODULE_ICON_COLORS: Record<ModuleType, string> = {
  typing: 'text-blue-500',
  memory: 'text-purple-500',
  reaction: 'text-amber-500',
  speech: 'text-emerald-500',
  facial: 'text-rose-500',
}

export function ModuleSelectionStep({
  language,
  modules,
  error,
  onToggle,
  onSelectAll,
  onContinue,
  onBack,
}: ModuleSelectionStepProps) {
  const selectedCount = modules.filter((m) => m.selected).length
  const allSelected = selectedCount === modules.length

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex w-full max-w-3xl flex-col gap-6"
    >
      {/* Header */}
      <div className="flex flex-col gap-2 text-center">
        <h2 className="text-2xl font-bold tracking-tight">
          {t(language, 'modules.title')}
        </h2>
        <p className="text-muted-foreground">
          {t(language, 'modules.subtitle')}
        </p>
      </div>

      {/* Select All / Count */}
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-sm">
          {selectedCount} of {modules.length} selected
        </Badge>
        <Button
          id="select-all-btn"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onSelectAll}
          className="text-sm font-medium"
        >
          {allSelected
            ? t(language, 'modules.deselectAll')
            : t(language, 'modules.selectAll')}
        </Button>
      </div>

      {/* Module Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod, index) => {
          const info = MODULE_INFO[mod.type]
          const Icon = MODULE_ICONS[mod.type]
          const gradient = MODULE_GRADIENTS[mod.type]
          const iconColor = MODULE_ICON_COLORS[mod.type]

          return (
            <motion.div
              key={mod.type}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                id={`module-${mod.type}`}
                className={cn(
                  'relative cursor-pointer transition-all duration-200',
                  mod.selected
                    ? 'border-primary ring-2 ring-primary/20 shadow-md'
                    : 'hover:border-muted-foreground/30 hover:shadow-sm'
                )}
                onClick={() => onToggle(mod.type)}
              >
                <CardContent className="p-5">
                  <div className="flex flex-col gap-3">
                    {/* Icon + Check */}
                    <div className="flex items-start justify-between">
                      <div className={cn('flex size-11 items-center justify-center rounded-xl bg-gradient-to-br', gradient)}>
                        <Icon className={cn('size-5', iconColor)} />
                      </div>
                      <div
                        className={cn(
                          'flex size-5 items-center justify-center rounded-md border-2 transition-all',
                          mod.selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-muted-foreground/30'
                        )}
                      >
                        {mod.selected && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                          >
                            <Check className="size-3" />
                          </motion.div>
                        )}
                      </div>
                    </div>

                    {/* Name + Description */}
                    <div>
                      <p className="font-semibold text-sm">
                        {t(language, `module.${mod.type}`)}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        {info.description}
                      </p>
                    </div>

                    {/* Hardware Badge */}
                    {info.requiresHardware !== 'none' && (
                      <Badge variant="secondary" className="w-fit text-[0.65rem]">
                        {info.requiresHardware === 'microphone'
                          ? t(language, 'modules.requiresMic')
                          : t(language, 'modules.requiresCam')}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Info Note */}
      <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {t(language, 'modules.info')}
        </p>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-lg bg-destructive/10 p-3 text-destructive"
          >
            <AlertCircle className="size-4 shrink-0" />
            <p className="text-sm">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          id="modules-back"
          variant="ghost"
          onClick={onBack}
        >
          {t(language, 'modules.back')}
        </Button>
        <Button
          id="modules-continue"
          onClick={onContinue}
          disabled={selectedCount === 0}
        >
          {t(language, 'modules.continue')}
        </Button>
      </div>
    </motion.div>
  )
}
