// ===========================================================
// NeuroScreen — Language Selection Step
// ===========================================================
// Step 1: User picks English or Kannada (transliterated).
// Renders two clickable cards with visual selection feedback.
// ===========================================================

import { motion } from 'framer-motion'
import { Check, Globe } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { t } from '@/lib/i18n'
import type { LanguageCode } from '@/types/database'

interface LanguageStepProps {
  language: LanguageCode
  onSelect: (lang: LanguageCode) => void
  onContinue: () => void
}

const LANGUAGE_OPTIONS: { code: LanguageCode; labelKey: string; flag: string; subtitle: string }[] = [
  {
    code: 'en',
    labelKey: 'lang.english',
    flag: '🇬🇧',
    subtitle: 'All prompts and instructions in English',
  },
  {
    code: 'kn',
    labelKey: 'lang.kannada',
    flag: '🇮🇳',
    subtitle: 'Ella suchane mattu maargadarshana Kannada-nalli (Transliterated)',
  },
]

export function LanguageStep({ language, onSelect, onContinue }: LanguageStepProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="mx-auto flex max-w-2xl flex-col items-center gap-8"
    >
      {/* Header */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl bg-primary/10">
          <Globe className="size-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight">
          {t(language, 'lang.title')}
        </h2>
        <p className="max-w-md text-muted-foreground">
          {t(language, 'lang.subtitle')}
        </p>
      </div>

      {/* Language Cards */}
      <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2">
        {LANGUAGE_OPTIONS.map((option) => {
          const isSelected = language === option.code
          return (
            <motion.div
              key={option.code}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Card
                id={`lang-${option.code}`}
                className={cn(
                  'cursor-pointer transition-all duration-200',
                  isSelected
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md'
                    : 'hover:border-muted-foreground/30 hover:shadow-sm'
                )}
                onClick={() => onSelect(option.code)}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  {/* Flag */}
                  <span className="text-4xl" role="img" aria-label={option.code === 'en' ? 'British flag' : 'Indian flag'}>
                    {option.flag}
                  </span>

                  {/* Label */}
                  <div className="flex-1">
                    <p className="text-base font-semibold">
                      {t(language, option.labelKey)}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {option.subtitle}
                    </p>
                  </div>

                  {/* Check indicator */}
                  <div
                    className={cn(
                      'flex size-6 items-center justify-center rounded-full border-2 transition-all',
                      isSelected
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {isSelected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                      >
                        <Check className="size-3.5" />
                      </motion.div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )
        })}
      </div>

      {/* Continue Button */}
      <Button
        id="lang-continue"
        size="lg"
        className="min-w-[200px]"
        onClick={onContinue}
      >
        {t(language, 'lang.continue')}
      </Button>
    </motion.div>
  )
}
