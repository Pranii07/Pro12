// ===========================================================
// NeuroScreen — Tech Stack Section
// ===========================================================

import { motion } from 'framer-motion'

const stack = [
  {
    category: 'Frontend',
    items: ['React', 'TypeScript', 'Tailwind CSS', 'Vite'],
    color: 'from-primary/20 to-primary/5',
    border: 'border-primary/20',
  },
  {
    category: 'Backend',
    items: ['FastAPI', 'Python', 'Pydantic', 'REST APIs'],
    color: 'from-secondary/20 to-secondary/5',
    border: 'border-secondary/20',
  },
  {
    category: 'Database & Auth',
    items: ['Supabase', 'PostgreSQL', 'Row Level Security', 'JWT'],
    color: 'from-accent/20 to-accent/5',
    border: 'border-accent/20',
  },
  {
    category: 'Machine Learning',
    items: ['scikit-learn', 'XGBoost', 'Random Forest', 'SVM'],
    color: 'from-success/20 to-success/5',
    border: 'border-success/20',
  },
  {
    category: 'Computer Vision',
    items: ['OpenCV', 'MediaPipe', 'Face Mesh', 'Feature Extraction'],
    color: 'from-warning/20 to-warning/5',
    border: 'border-warning/20',
  },
  {
    category: 'Audio Processing',
    items: ['Librosa', 'Speech-to-Text', 'Audio Features', 'Fluency Analysis'],
    color: 'from-destructive/20 to-destructive/5',
    border: 'border-destructive/20',
  },
]

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
}

export function TechStackSection() {
  return (
    <section className="py-20 sm:py-28">
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
            Built With <span className="gradient-text">Modern Technology</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            A robust, full-stack architecture designed for reliability, scalability, and research reproducibility.
          </p>
        </motion.div>

        {/* Stack Grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="mt-16 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {stack.map((group) => (
            <motion.div
              key={group.category}
              variants={itemVariants}
              className={`rounded-xl border ${group.border} bg-gradient-to-br ${group.color} p-6 transition-all duration-200 hover:shadow-md`}
            >
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {group.category}
              </h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <span
                    key={item}
                    className="rounded-md bg-background/60 px-2.5 py-1 text-xs font-medium text-foreground ring-1 ring-border/50"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
