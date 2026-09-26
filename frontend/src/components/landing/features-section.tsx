// ===========================================================
// NeuroScreen — Features Section
// ===========================================================

import { motion } from 'framer-motion'
import { Keyboard, Brain, Timer, Mic, Camera } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

const modules = [
  {
    name: 'Typing Analysis',
    description: 'Measures typing speed, accuracy, keystroke hold/flight times, and backspace patterns.',
    icon: Keyboard,
    color: 'text-primary',
    bgColor: 'bg-primary/10',
    hardware: null,
  },
  {
    name: 'Memory Tests',
    description: 'Word recall, number recall, image memory, and pattern recognition with timing.',
    icon: Brain,
    color: 'text-secondary',
    bgColor: 'bg-secondary/10',
    hardware: null,
  },
  {
    name: 'Reaction Time',
    description: 'Measures response time to visual stimuli with false-start detection and consistency tracking.',
    icon: Timer,
    color: 'text-accent',
    bgColor: 'bg-accent/10',
    hardware: null,
  },
  {
    name: 'Speech Analysis',
    description: 'Analyzes speech rate, pause duration, and fluency from a short voice recording.',
    icon: Mic,
    color: 'text-success',
    bgColor: 'bg-success/10',
    hardware: 'Microphone',
  },
  {
    name: 'Facial Analysis',
    description: 'Measures blink rate, head movement, and attention indicators from camera input.',
    icon: Camera,
    color: 'text-warning',
    bgColor: 'bg-warning/10',
    hardware: 'Camera',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-28">
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
            Five Assessment <span className="gradient-text">Modules</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Each module collects specific behavioural signals through interactive exercises.
            All modules are optional — complete as many as you'd like.
          </p>
        </motion.div>

        {/* Module Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {modules.map((module) => (
            <motion.div key={module.name} variants={itemVariants}>
              <Card className="group h-full transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 hover:border-primary/20">
                <CardContent className="flex flex-col gap-4 p-6">
                  <div className="flex items-start justify-between">
                    <div className={`rounded-xl ${module.bgColor} p-3 transition-transform group-hover:scale-110`}>
                      <module.icon className={`size-6 ${module.color}`} />
                    </div>
                    {module.hardware && (
                      <Badge variant="outline" className="text-[0.65rem]">
                        {module.hardware}
                      </Badge>
                    )}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold">{module.name}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                      {module.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
