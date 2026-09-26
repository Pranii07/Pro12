// ===========================================================
// NeuroScreen — Settings Page
// ===========================================================
// Theme, language, and account settings.
// ===========================================================

import { motion } from 'framer-motion'
import { Palette, Globe, Shield, LogOut } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/auth-context'
import { useTheme } from '@/components/theme-provider'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/ui/page-header'

export function SettingsPage() {
  const { signOut, profile, updateProfile } = useAuth()
  const { theme, setTheme } = useTheme()
  const navigate = useNavigate()

  async function handleSignOut() {
    await signOut()
    toast.success('Signed out successfully')
    navigate('/', { replace: true })
  }

  const themeOptions = [
    { value: 'light' as const, label: 'Light', emoji: '☀️' },
    { value: 'dark' as const, label: 'Dark', emoji: '🌙' },
    { value: 'system' as const, label: 'System', emoji: '💻' },
  ]

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader
          title="Settings"
          description="Customize your NeuroScreen experience"
        />
      </motion.div>

      {/* Appearance */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="size-5 text-primary" />
              Appearance
            </CardTitle>
            <CardDescription>
              Choose how NeuroScreen looks to you
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      theme === option.value
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    <span className="text-lg">{option.emoji}</span>
                    <p className="mt-1">{option.label}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Language */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="size-5 text-secondary" />
              Language
            </CardTitle>
            <CardDescription>
              Set your preferred language for assessments and UI
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Label>Assessment Language</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateProfile({ language_preference: 'en' })}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    profile?.language_preference === 'en'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  🇬🇧 English
                </button>
                <button
                  type="button"
                  onClick={() => updateProfile({ language_preference: 'kn' })}
                  className={`rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                    profile?.language_preference === 'kn'
                      ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                      : 'border-border hover:bg-muted'
                  }`}
                >
                  🇮🇳 ಕನ್ನಡ (Kannada)
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                This affects assessment prompts and content. Language can also be selected before each assessment.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Privacy & Security */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="size-5 text-accent" />
              Privacy & Security
            </CardTitle>
            <CardDescription>
              Manage your account security and data preferences
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-medium">Data Collection</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                NeuroScreen collects behavioural metrics from assessments. Raw audio and video are
                processed in memory and discarded — only derived features are stored. You can
                delete your assessment data at any time.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <h4 className="text-sm font-medium">Authentication</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Your account is secured via Supabase Auth with JWT tokens. Sessions are
                stored locally and auto-refreshed. Database access is protected by Row Level Security.
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.2 }}
      >
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-destructive">Account</CardTitle>
            <CardDescription>
              Sign out of your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={handleSignOut}
              className="gap-2"
            >
              <LogOut className="size-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
