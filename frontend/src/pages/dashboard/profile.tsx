// ===========================================================
// NeuroScreen — Profile Page
// ===========================================================
// Displays user profile info and allows editing name/language.
// Uses auth context for data.
// ===========================================================

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { User, Save, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { PageHeader } from '@/components/ui/page-header'
import type { LanguageCode } from '@/types/database'

export function ProfilePage() {
  const { user, profile, updateProfile } = useAuth()

  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [language, setLanguage] = useState<LanguageCode>(profile?.language_preference || 'en')
  const [saving, setSaving] = useState(false)

  // Keep state synchronized with profile as it loads or changes
  useEffect(() => {
    if (profile?.full_name !== undefined) {
      setFullName(profile.full_name)
    }
    if (profile?.language_preference !== undefined) {
      setLanguage(profile.language_preference)
    }
  }, [profile?.full_name, profile?.language_preference])

  const initials = (fullName || profile?.full_name)
    ? (fullName || profile?.full_name || '')
        .trim()
        .split(' ')
        .map(n => n[0])
        .filter(Boolean)
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?'

  const hasChanges =
    fullName.trim() !== (profile?.full_name || '') ||
    language !== (profile?.language_preference || 'en')

  async function handleSave() {
    if (!fullName.trim()) {
      toast.error('Full name cannot be empty')
      return
    }
    if (!hasChanges) return
    setSaving(true)
    try {
      const { error } = await updateProfile({
        full_name: fullName.trim(),
        language_preference: language,
      })
      if (error) {
        toast.error(error.message || 'Failed to update profile')
      } else {
        toast.success('Profile updated successfully')
      }
    } catch {
      toast.error('An unexpected error occurred')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <PageHeader
          title="Profile"
          description="Manage your account information and preferences"
        />
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="lg:col-span-1"
        >
          <Card>
            <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
              <Avatar className="size-20">
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="text-lg font-semibold">{profile?.full_name || 'User'}</h3>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              <Badge variant="outline" className="text-xs">
                {profile?.role || 'USER'}
              </Badge>
              <Separator />
              <div className="w-full space-y-2 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Language</span>
                  <span className="font-medium">
                    {profile?.language_preference === 'kn' ? 'Kannada' : 'English'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Member since</span>
                  <span className="font-medium">
                    {profile?.created_at
                      ? new Date(profile.created_at).toLocaleDateString()
                      : '—'}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Edit Profile */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="lg:col-span-2"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="size-5 text-primary" />
                Edit Profile
              </CardTitle>
              <CardDescription>
                Update your display name and language preference
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Email (read-only) */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ''} disabled />
                <p className="text-xs text-muted-foreground">
                  Email is managed by your authentication provider and cannot be changed here.
                </p>
              </div>

              {/* Full Name */}
              <div className="space-y-2">
                <Label htmlFor="profile-name">Full Name</Label>
                <Input
                  id="profile-name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your full name"
                />
              </div>

              {/* Language Preference */}
              <div className="space-y-2">
                <Label>Language Preference</Label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      language === 'en'
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('kn')}
                    className={`flex-1 rounded-lg border px-4 py-3 text-sm font-medium transition-all ${
                      language === 'kn'
                        ? 'border-primary bg-primary/5 text-primary ring-1 ring-primary/20'
                        : 'border-border hover:bg-muted'
                    }`}
                  >
                    🇮🇳 ಕನ್ನಡ (Kannada)
                  </button>
                </div>
              </div>

              {/* Save */}
              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                  className="gap-2"
                >
                  {saving ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Save className="size-4" />
                  )}
                  {saving ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
