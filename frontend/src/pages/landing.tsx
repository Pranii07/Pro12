// ===========================================================
// NeuroScreen — Landing Page
// ===========================================================
// Assembles all landing page sections into a complete page.
// Rendered inside PublicLayout via <Outlet />.
// ===========================================================

import { HeroSection } from '@/components/landing/hero-section'
import { FeaturesSection } from '@/components/landing/features-section'
import { HowItWorksSection } from '@/components/landing/how-it-works-section'
import { TechStackSection } from '@/components/landing/tech-stack-section'
import { FAQSection } from '@/components/landing/faq-section'
import { Footer } from '@/components/landing/footer'
import { BackgroundDoodles } from '@/components/landing/background-doodles'

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated interactive background doodles */}
      <BackgroundDoodles />

      {/* Main page content sections */}
      <div className="relative z-10">
        <HeroSection />
        <FeaturesSection />
        <HowItWorksSection />
        <TechStackSection />
        <FAQSection />
        <Footer />
      </div>
    </div>
  )
}

