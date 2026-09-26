// ===========================================================
// NeuroScreen — How It Works Section
// ===========================================================

import { motion } from 'framer-motion'
import { ClipboardCheck, Cpu, BarChart3 } from 'lucide-react'

const steps = [
  {
    number: '01',
    title: 'Take Assessments',
    description: 'Complete interactive exercises — typing, memory, reaction time, speech, and facial analysis. Each module is optional; skip any you prefer.',
    icon: ClipboardCheck,
    color: 'from-primary to-primary/70',
  },
  {
    number: '02',
    title: 'AI Analyzes Patterns',
    description: 'Features are extracted from your responses and fused into a single vector. Classical ML models (Random Forest, SVM, XGBoost) compare your patterns.',
    icon: Cpu,
    color: 'from-accent to-accent/70',
  },
  {
    number: '03',
    title: 'Review Results',
    description: 'Receive a Behavioural Screening Level (Low / Moderate / High) with per-module breakdowns, visualizations, and a downloadable PDF report.',
    icon: BarChart3,
    color: 'from-secondary to-secondary/70',
  },
]

export function HowItWorksSection() {
  return (
    <section id="how-it-works" className="relative py-20 sm:py-28 bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-2xl text-center"
        >
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            How It <span className="gradient-text">Works</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Three simple steps from assessment to insight.
          </p>
        </motion.div>

        {/* Steps */}
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector line (between steps) */}
              {index < steps.length - 1 && (
                <div className="absolute top-12 left-[calc(50%+40px)] hidden h-px w-[calc(100%-40px)] bg-gradient-to-r from-border to-transparent md:block" />
              )}

              <div className="flex flex-col items-center text-center">
                {/* Step number + icon */}
                <div className="relative">
                  <div className={`flex size-20 items-center justify-center rounded-2xl bg-gradient-to-br ${step.color} shadow-lg`}>
                    <step.icon className="size-8 text-white" />
                  </div>
                  <span className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-background text-xs font-bold text-foreground ring-2 ring-border">
                    {step.number}
                  </span>
                </div>

                <h3 className="mt-6 text-xl font-semibold">{step.title}</h3>
                <p className="mt-3 max-w-xs text-sm leading-relaxed text-muted-foreground">
                  {step.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
