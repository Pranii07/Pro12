// ===========================================================
// NeuroScreen — Footer
// ===========================================================

import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui/logo'
import { Separator } from '@/components/ui/separator'

const footerLinks = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '#features', isRoute: false },
      { label: 'How It Works', href: '#how-it-works', isRoute: false },
      { label: 'FAQ', href: '#faq', isRoute: false },
    ],
  },
  {
    heading: 'Assessment Modules',
    links: [
      { label: 'Typing Analysis', href: '#features', isRoute: false },
      { label: 'Memory Tests', href: '#features', isRoute: false },
      { label: 'Reaction Time', href: '#features', isRoute: false },
      { label: 'Speech Analysis', href: '#features', isRoute: false },
      { label: 'Facial Analysis', href: '#features', isRoute: false },
    ],
  },
  {
    heading: 'Account',
    links: [
      { label: 'Sign In', href: '/login', isRoute: true },
      { label: 'Get Started', href: '/register', isRoute: true },
    ],
  },
]

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/20">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Top section */}
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Branding */}
          <div className="space-y-4">
            <Logo size="sm" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              A behavioural screening research and educational framework. Not a medical diagnostic system.
            </p>
          </div>

          {/* Link columns */}
          {footerLinks.map((group) => (
            <div key={group.heading}>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.heading}
              </h4>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.label}>
                    {link.isRoute ? (
                      <Link
                        to={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <Separator className="my-8" />

        {/* Disclaimer */}
        <div className="rounded-lg border border-warning/20 bg-warning/5 px-4 py-3">
          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="font-semibold text-foreground">Disclaimer:</strong>{' '}
            This application is intended for behavioural screening and educational/research purposes only.
            It is NOT a medical diagnosis and cannot replace evaluation by a qualified healthcare professional.
            Research/Educational Prototype — trained and evaluated on synthetic data. Not clinically validated.
          </p>
        </div>

        {/* Copyright */}
        <div className="mt-6 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} NeuroScreen. Final year engineering project — educational purposes only.
          </p>
          <p className="text-xs text-muted-foreground">
            Behavioural AI Framework for Early Neurological Risk Detection
          </p>
        </div>
      </div>
    </footer>
  )
}
