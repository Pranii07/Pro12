// ===========================================================
// NeuroScreen — Background Doodles (Animated & Interactive)
// ===========================================================
// Themed floating doodles representing neuroscience, speech acoustics,
// facial tracking, neural networks, and cognitive screening.
//
// Features:
// - Gentle continuous floating, bobbing, and rotation loops
// - Unique offsets and durations to create organic asynchronous motion
// - Interactive hover response (scale up + glow)
// - Fully responsive with theme-aware colors
// ===========================================================

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

interface DoodleProps {
  className?: string
  style?: React.CSSProperties
  delay?: number
  duration?: number
  floatY?: number
  floatX?: number
  rotateRange?: number
}

// -------------------------------------------------------------
// 1. Brain & Neural Connections Doodle
// -------------------------------------------------------------
export function BrainDoodle({
  className,
  style,
  delay = 0,
  duration = 6,
  floatY = 14,
  floatX = 6,
  rotateRange = 5,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.75, 1, 0.75],
        y: [-floatY, floatY, -floatY],
        x: [-floatX, floatX, -floatX],
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: rotateRange * 2.5,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="68"
        height="68"
        viewBox="0 0 68 68"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Left hemisphere lobes */}
        <path d="M34 16C30 11 22 10 17 15C12 20 12 27 16 31C11 34 10 42 14 47C17 51 23 52 27 50C28 54 31 57 34 57" strokeDasharray="1.5 0" />
        {/* Right hemisphere lobes */}
        <path d="M34 16C38 11 46 10 51 15C56 20 56 27 52 31C57 34 58 42 54 47C51 51 45 52 41 50C40 54 37 57 34 57" />
        {/* Central fissure */}
        <path d="M34 16V57" strokeDasharray="3 3" opacity="0.8" />
        {/* Neural folds / sulci */}
        <path d="M22 25C26 27 28 32 25 36C22 40 26 44 30 43" opacity="0.75" />
        <path d="M46 25C42 27 40 32 43 36C46 40 42 44 38 43" opacity="0.75" />
        {/* Synaptic nodes */}
        <circle cx="17" cy="15" r="2.5" fill="currentColor" />
        <circle cx="51" cy="15" r="2.5" fill="currentColor" />
        <circle cx="14" cy="47" r="2" fill="currentColor" />
        <circle cx="54" cy="47" r="2" fill="currentColor" />
        {/* Sparkle rays */}
        <path d="M34 8V4" opacity="0.7" />
        <path d="M10 20L6 18" opacity="0.7" />
        <path d="M58 20L62 18" opacity="0.7" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 2. Speech & Acoustic Waveform Doodle
// -------------------------------------------------------------
export function SpeechWaveDoodle({
  className,
  style,
  delay = 0.5,
  duration = 5.2,
  floatY = 12,
  floatX = 8,
  rotateRange = 6,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.7, 0.95, 0.7],
        y: [floatY, -floatY, floatY],
        x: [floatX, -floatX, floatX],
        rotate: [rotateRange, -rotateRange, rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: 0,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="76"
        height="50"
        viewBox="0 0 76 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Continuous audio frequency waveform */}
        <path d="M4 25C8 25 10 18 13 18C16 18 18 32 21 32C24 32 26 12 29 12C32 12 34 38 37 38C40 38 42 6 45 6C48 6 50 44 53 44C56 44 58 16 61 16C64 16 66 34 69 34C72 34 74 25 76 25" />
        {/* Harmonic secondary glow ripple */}
        <path d="M12 25C18 15 24 35 30 25C36 15 42 35 48 25C54 15 60 35 66 25" strokeDasharray="2 3" opacity="0.6" />
        {/* Microphone / Sound indicator node */}
        <circle cx="45" cy="6" r="3" fill="currentColor" />
        <circle cx="37" cy="38" r="2.5" fill="currentColor" opacity="0.8" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 3. Facial & Eye Gaze Tracker Doodle
// -------------------------------------------------------------
export function EyeTrackingDoodle({
  className,
  style,
  delay = 1.2,
  duration = 5.8,
  floatY = 16,
  floatX = 7,
  rotateRange = 7,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.75, 1, 0.75],
        y: [-floatY, floatY, -floatY],
        x: [floatX, -floatX, floatX],
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: -rotateRange * 2,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="64"
        height="54"
        viewBox="0 0 64 54"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Stylized eye contour */}
        <path d="M5 27C12 14 23 7 32 7C41 7 52 14 59 27C52 40 41 47 32 47C23 47 12 40 5 27Z" />
        {/* Iris circle */}
        <circle cx="32" cy="27" r="11" opacity="0.9" />
        {/* Pupil */}
        <circle cx="32" cy="27" r="5" fill="currentColor" />
        {/* Light glint */}
        <circle cx="35" cy="24" r="1.5" fill="var(--background, #fff)" stroke="none" />
        {/* Gaze tracking crosshair corners */}
        <path d="M12 11H8V15" strokeWidth="2.5" />
        <path d="M52 11H56V15" strokeWidth="2.5" />
        <path d="M12 43H8V39" strokeWidth="2.5" />
        <path d="M52 43H56V39" strokeWidth="2.5" />
        {/* Focal scan dot */}
        <circle cx="21" cy="27" r="1.5" fill="currentColor" opacity="0.7" />
        <circle cx="43" cy="27" r="1.5" fill="currentColor" opacity="0.7" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 4. Neuron / Synaptic Arborization Doodle
// -------------------------------------------------------------
export function SynapseDoodle({
  className,
  style,
  delay = 0.8,
  duration = 6.4,
  floatY = 15,
  floatX = 9,
  rotateRange = 10,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.7, 0.95, 0.7],
        y: [floatY, -floatY, floatY],
        x: [-floatX, floatX, -floatX],
        rotate: [rotateRange, -rotateRange, rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: rotateRange * 2,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="62"
        height="62"
        viewBox="0 0 62 62"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Central soma (cell body) */}
        <circle cx="31" cy="31" r="7" fill="currentColor" fillOpacity="0.2" />
        <circle cx="31" cy="31" r="3" fill="currentColor" />
        {/* Dendrites branching out */}
        <path d="M31 24C31 16 26 12 21 9" />
        <path d="M21 9L15 6" />
        <path d="M21 9L23 4" />
        <path d="M36 26C43 20 48 18 55 17" />
        <path d="M55 17L59 13" />
        <path d="M55 17L57 23" />
        <path d="M38 31C46 33 50 38 54 44" />
        <path d="M54 44L60 46" />
        <path d="M54 44L52 50" />
        <path d="M25 35C18 39 15 45 10 51" />
        <path d="M10 51L4 54" />
        <path d="M10 51L12 57" />
        <path d="M27 26C21 21 15 22 8 20" />
        {/* Synaptic terminal buttons */}
        <circle cx="15" cy="6" r="2.2" fill="currentColor" />
        <circle cx="23" cy="4" r="2.2" fill="currentColor" />
        <circle cx="59" cy="13" r="2.2" fill="currentColor" />
        <circle cx="57" cy="23" r="2.2" fill="currentColor" />
        <circle cx="60" cy="46" r="2.2" fill="currentColor" />
        <circle cx="52" cy="50" r="2.2" fill="currentColor" />
        <circle cx="4" cy="54" r="2.2" fill="currentColor" />
        <circle cx="12" cy="57" r="2.2" fill="currentColor" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 5. Cognitive Pulse & Signal Rhythm Doodle
// -------------------------------------------------------------
export function PulseDoodle({
  className,
  style,
  delay = 1.6,
  duration = 4.8,
  floatY = 11,
  floatX = 7,
  rotateRange = 5,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.75, 1, 0.75],
        y: [-floatY, floatY, -floatY],
        x: [floatX, -floatX, floatX],
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: 0,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="66"
        height="44"
        viewBox="0 0 66 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* ECG pulse rhythm */}
        <path d="M3 22H18L23 9L29 35L36 3L42 31L47 18L51 22H63" />
        {/* Peak signal dot */}
        <circle cx="36" cy="3" r="3" fill="currentColor" />
        {/* Secondary wave shadow */}
        <path d="M10 28H20L25 20L30 33L35 15L40 28H56" strokeDasharray="2 3" opacity="0.5" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 6. DNA Double Helix Doodle
// -------------------------------------------------------------
export function DnaDoodle({
  className,
  style,
  delay = 0.3,
  duration = 6.2,
  floatY = 16,
  floatX = 8,
  rotateRange = 12,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.7, 0.95, 0.7],
        y: [floatY, -floatY, floatY],
        x: [-floatX, floatX, -floatX],
        rotate: [rotateRange, -rotateRange, rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: rotateRange * 2,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="54"
        height="64"
        viewBox="0 0 54 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Helix strands */}
        <path d="M14 6C24 16 30 24 40 32C30 40 24 48 14 58" />
        <path d="M40 6C30 16 24 24 14 32C24 40 30 48 40 58" />
        {/* Base pairs */}
        <line x1="17" y1="12" x2="37" y2="12" strokeDasharray="1 2" />
        <line x1="20" y1="19" x2="34" y2="19" />
        <line x1="24" y1="26" x2="30" y2="26" />
        <line x1="24" y1="38" x2="30" y2="38" />
        <line x1="20" y1="45" x2="34" y2="45" />
        <line x1="17" y1="52" x2="37" y2="52" strokeDasharray="1 2" />
        {/* Nodes */}
        <circle cx="14" cy="6" r="2.5" fill="currentColor" />
        <circle cx="40" cy="6" r="2.5" fill="currentColor" />
        <circle cx="27" cy="32" r="3" fill="currentColor" />
        <circle cx="14" cy="58" r="2.5" fill="currentColor" />
        <circle cx="40" cy="58" r="2.5" fill="currentColor" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 7. Sparkle & Celestial AI Starlight Doodle
// -------------------------------------------------------------
export function SparkleDoodle({
  className,
  style,
  delay = 0.9,
  duration = 4.2,
  floatY = 9,
  floatX = 6,
  rotateRange = 15,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.65, 1, 0.65],
        scale: [0.95, 1.15, 0.95],
        y: [-floatY, floatY, -floatY],
        x: [floatX, -floatX, floatX],
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.35,
        rotate: 45,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.2 },
      }}
    >
      <svg
        width="44"
        height="44"
        viewBox="0 0 44 44"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* 4-point sparkle star */}
        <path d="M22 2C22 13 24 20 35 22C24 24 22 31 22 42C22 31 20 24 9 22C20 20 22 13 22 2Z" fill="currentColor" fillOpacity="0.25" />
        {/* Radiating corner glints */}
        <circle cx="34" cy="10" r="1.5" fill="currentColor" />
        <circle cx="10" cy="34" r="1.5" fill="currentColor" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 8. Orbital Loop & Arrow Gesture Doodle
// -------------------------------------------------------------
export function OrbitDoodle({
  className,
  style,
  delay = 1.4,
  duration = 5.5,
  floatY = 13,
  floatX = 8,
  rotateRange = 10,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.7, 0.95, 0.7],
        y: [floatY, -floatY, floatY],
        x: [-floatX, floatX, -floatX],
        rotate: [rotateRange, -rotateRange, rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: rotateRange * 3,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.25 },
      }}
    >
      <svg
        width="58"
        height="50"
        viewBox="0 0 58 50"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Elliptical orbital path */}
        <ellipse cx="29" cy="25" rx="23" ry="14" strokeDasharray="3 3" transform="rotate(-15 29 25)" />
        {/* Planet / Satellite node */}
        <circle cx="12" cy="18" r="4" fill="currentColor" />
        <circle cx="47" cy="32" r="2.5" fill="currentColor" opacity="0.8" />
        {/* Central beacon */}
        <circle cx="29" cy="25" r="2" fill="currentColor" opacity="0.6" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// 9. Playful Squiggle / Scribble Doodle
// -------------------------------------------------------------
export function SquiggleDoodle({
  className,
  style,
  delay = 0.7,
  duration = 4.6,
  floatY = 10,
  floatX = 5,
  rotateRange = 8,
}: DoodleProps) {
  return (
    <motion.div
      style={style}
      className={cn('pointer-events-auto cursor-pointer select-none', className)}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{
        opacity: [0.65, 0.9, 0.65],
        y: [-floatY, floatY, -floatY],
        x: [floatX, -floatX, floatX],
        rotate: [-rotateRange, rotateRange, -rotateRange],
      }}
      transition={{
        duration,
        repeat: Infinity,
        repeatType: 'reverse',
        ease: 'easeInOut',
        delay,
      }}
      whileHover={{
        scale: 1.25,
        rotate: 0,
        filter: 'drop-shadow(0 0 16px currentColor)',
        transition: { duration: 0.2 },
      }}
    >
      <svg
        width="50"
        height="40"
        viewBox="0 0 50 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full stroke-current"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* Whimsical curved wave */}
        <path d="M5 28C11 12 18 10 24 24C30 38 37 36 45 14" />
        {/* Loop flourish */}
        <path d="M37 20C42 22 47 18 43 14" opacity="0.6" />
        <circle cx="45" cy="14" r="2" fill="currentColor" />
        <circle cx="5" cy="28" r="1.5" fill="currentColor" opacity="0.7" />
      </svg>
    </motion.div>
  )
}

// -------------------------------------------------------------
// Master Component: Complete Home Page Doodles Background
// -------------------------------------------------------------
export function BackgroundDoodles() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden select-none z-0">
      {/* =======================================================
          MID SECTION DOODLES (Features / Architecture)
          ======================================================= */}

      {/* Mid Left: Cognitive Pulse */}
      <div className="absolute top-[820px] left-4 sm:left-12 lg:left-20">
        <PulseDoodle
          className="text-secondary/45 hover:text-secondary transition-colors size-14 sm:size-18"
          delay={1.3}
          duration={5.2}
        />
      </div>

      {/* Mid Right: DNA Helix */}
      <div className="absolute top-[880px] right-4 sm:right-14 lg:right-24">
        <DnaDoodle
          className="text-primary/45 hover:text-primary transition-colors size-14 sm:size-18"
          delay={0.5}
          duration={6.8}
        />
      </div>

      {/* Mid Center Sparkle Accent */}
      <div className="absolute top-[1100px] left-1/4 hidden lg:block">
        <SparkleDoodle
          className="text-accent/50 hover:text-accent transition-colors size-8 sm:size-10"
          delay={1.7}
          duration={4.5}
        />
      </div>

      {/* =======================================================
          HOW IT WORKS & TECH STACK DOODLES
          ======================================================= */}

      {/* How it works Left: Brain doodle */}
      <div className="absolute top-[1620px] left-4 sm:left-14 lg:left-24">
        <BrainDoodle
          className="text-accent/40 hover:text-accent transition-colors size-14 sm:size-18"
          delay={0.9}
          duration={6.2}
        />
      </div>

      {/* How it works Right: Speech Wave */}
      <div className="absolute top-[1700px] right-4 sm:right-16 lg:right-28">
        <SpeechWaveDoodle
          className="text-primary/45 hover:text-primary transition-colors size-16 sm:size-20"
          delay={1.4}
          duration={5.4}
        />
      </div>

      {/* Tech Stack Left: Orbital constellation */}
      <div className="absolute top-[2300px] left-6 sm:left-16 lg:left-28">
        <OrbitDoodle
          className="text-secondary/45 hover:text-secondary transition-colors size-12 sm:size-16"
          delay={0.7}
          duration={5.7}
        />
      </div>

      {/* Tech Stack Right: Squiggle */}
      <div className="absolute top-[2400px] right-6 sm:right-18 lg:right-32">
        <SquiggleDoodle
          className="text-warning/50 hover:text-warning transition-colors size-12 sm:size-16"
          delay={1.2}
          duration={4.8}
        />
      </div>

      {/* Near FAQ / Footer: Synapse & Starlight */}
      <div className="absolute top-[2950px] right-8 sm:right-20 lg:right-32">
        <SynapseDoodle
          className="text-accent/45 hover:text-accent transition-colors size-14 sm:size-18"
          delay={1.0}
          duration={6.3}
        />
      </div>
      <div className="absolute top-[3050px] left-6 sm:left-18 lg:left-28">
        <SparkleDoodle
          className="text-primary/50 hover:text-primary transition-colors size-9 sm:size-11"
          delay={0.4}
          duration={4.4}
        />
      </div>
    </div>
  )
}
