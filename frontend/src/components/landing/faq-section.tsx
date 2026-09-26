// ===========================================================
// NeuroScreen — FAQ Section
// ===========================================================

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FAQItem {
  question: string
  answer: string
}

const faqs: FAQItem[] = [
  {
    question: 'What does NeuroScreen do?',
    answer:
      'NeuroScreen collects measurable behavioural signals through interactive assessments — typing patterns, memory recall, reaction time, speech fluency, and facial movement. These signals are fused into features and processed by classical ML models to produce a non-diagnostic Behavioural Screening Level (Low, Moderate, or High).',
  },
  {
    question: 'Is this a medical diagnosis?',
    answer:
      'No. NeuroScreen is a research and educational prototype. It does not diagnose any disease or neurological condition. The Behavioural Screening Level is an experimental indicator based on synthetic training data and should never be interpreted as a clinical result. Always consult a qualified healthcare professional for medical evaluation.',
  },
  {
    question: 'What data do you collect?',
    answer:
      'We collect derived behavioural features (typing speed, accuracy metrics, reaction times, etc.) from your assessment interactions. We do NOT permanently store raw audio or video. Camera and microphone data are processed in real-time to extract numeric features, and the raw media is discarded immediately after processing.',
  },
  {
    question: 'Are all assessments required?',
    answer:
      'No. Every assessment module is optional — you can skip any module you prefer. However, the screening result is most informative when more modules are completed. If too few modules are completed, the system may report "Insufficient data for reliable screening."',
  },
  {
    question: 'What languages are supported?',
    answer:
      'NeuroScreen supports English and Kannada. For Kannada, a transliteration mode is available so you can type using an English keyboard. Additional languages can be added in the future.',
  },
  {
    question: 'How is my data protected?',
    answer:
      'Authentication is handled by Supabase Auth with JWT tokens. Database access is protected by Row Level Security — each user can only access their own data. All API communication uses HTTPS. Raw media (audio/video) is never permanently stored. Secrets and keys are stored server-side only, never in frontend code.',
  },
  {
    question: 'What ML models are used?',
    answer:
      'NeuroScreen compares three classical ML models: Random Forest, Support Vector Machine (SVM), and XGBoost. The best-performing model is selected based on evaluation metrics. The current prototype is trained on synthetic data — model metrics should be interpreted in that context.',
  },
]

function FAQAccordionItem({ item, isOpen, onToggle }: { item: FAQItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between py-5 text-left transition-colors hover:text-primary"
      >
        <span className="pr-4 text-base font-medium">{item.question}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform duration-200',
            isOpen && 'rotate-180 text-primary'
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-sm leading-relaxed text-muted-foreground">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  return (
    <section id="faq" className="py-20 sm:py-28 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Frequently Asked <span className="gradient-text">Questions</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Everything you need to know about NeuroScreen.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-12 max-w-3xl rounded-xl border border-border bg-card p-6 sm:p-8"
        >
          {faqs.map((faq, index) => (
            <FAQAccordionItem
              key={index}
              item={faq}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </motion.div>
      </div>
    </section>
  )
}
