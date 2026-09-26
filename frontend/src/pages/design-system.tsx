import {
  Brain,
  Users,
  Activity,
  FileText,
  Keyboard,
  Timer,
  Mic,
  Camera,
  BarChart3,
  Settings,
  Download,
  Plus,
  Search,
  ArrowRight,
} from "lucide-react"
import { motion } from "framer-motion"

import { Logo } from "@/components/ui/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { DisclaimerBanner, PrototypeBanner } from "@/components/ui/disclaimer-banner"
import { StatusBadge, ModuleStatusBadge } from "@/components/ui/status-badge"
import { StatCard } from "@/components/ui/stat-card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { SuccessState } from "@/components/ui/success-state"
import { PageHeader } from "@/components/ui/page-header"
import {
  CardSkeleton,
  TableSkeleton,
  ChartSkeleton,
  ProfileSkeleton,
} from "@/components/ui/loading-skeletons"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

const fadeIn = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 },
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <motion.section {...fadeIn} className="space-y-4">
      <h2 className="text-xl font-bold tracking-tight border-b border-border pb-2">
        {title}
      </h2>
      {children}
    </motion.section>
  )
}

export function DesignSystemPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo size="md" />
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="text-xs">
              Design System v1.0
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-6 py-10 space-y-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <Logo size="lg" className="justify-center" />
          <h1 className="text-4xl font-bold tracking-tight">
            <span className="gradient-text">NeuroScreen</span> Design System
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            A comprehensive design system for the Behavioural AI Framework for
            Early Neurological Risk Detection.
          </p>
        </motion.div>

        <Separator />

        {/* Color Palette */}
        <Section title="Color Palette">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            {[
              { name: "Primary", class: "bg-primary" },
              { name: "Secondary", class: "bg-secondary" },
              { name: "Accent", class: "bg-accent" },
              { name: "Destructive", class: "bg-destructive" },
              { name: "Success", class: "bg-success" },
              { name: "Warning", class: "bg-warning" },
              { name: "Muted", class: "bg-muted" },
              { name: "Card", class: "bg-card border" },
              { name: "Background", class: "bg-background border" },
              { name: "Level Low", class: "bg-level-low" },
              { name: "Level Moderate", class: "bg-level-moderate" },
              { name: "Level High", class: "bg-level-high" },
            ].map((color) => (
              <div key={color.name} className="space-y-1.5">
                <div
                  className={`h-16 rounded-lg ${color.class} shadow-sm`}
                />
                <p className="text-xs font-medium text-muted-foreground">
                  {color.name}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">Gradient Text</p>
            <p className="text-3xl font-bold gradient-text">
              Understand Behaviour. Discover Patterns Earlier.
            </p>
          </div>
        </Section>

        {/* Typography */}
        <Section title="Typography">
          <div className="space-y-3">
            <p className="text-4xl font-bold tracking-tight">
              Heading 1 — Inter Bold 36px
            </p>
            <p className="text-3xl font-bold tracking-tight">
              Heading 2 — Inter Bold 30px
            </p>
            <p className="text-2xl font-semibold tracking-tight">
              Heading 3 — Inter Semibold 24px
            </p>
            <p className="text-xl font-semibold">Heading 4 — Inter Semibold 20px</p>
            <p className="text-base">Body — Inter Regular 16px</p>
            <p className="text-sm text-muted-foreground">
              Small / Muted — Inter 14px
            </p>
            <p className="text-xs text-muted-foreground">
              Caption — Inter 12px
            </p>
            <p className="font-mono text-sm">
              Monospace — JetBrains Mono 14px
            </p>
          </div>
        </Section>

        {/* Logo */}
        <Section title="Logo">
          <div className="flex flex-wrap items-center gap-8">
            <Logo size="sm" />
            <Logo size="md" />
            <Logo size="lg" />
            <Logo size="md" showText={false} />
          </div>
        </Section>

        {/* Buttons */}
        <Section title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="link">Link</Button>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <Button size="xs">Extra Small</Button>
            <Button size="sm">Small</Button>
            <Button>Default</Button>
            <Button size="lg">Large</Button>
            <Button size="icon">
              <Plus />
            </Button>
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            <Button disabled>Disabled</Button>
            <Button>
              <Download className="mr-2 size-4" />
              With Icon
            </Button>
            <Button variant="outline">
              Get Started
              <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        </Section>

        {/* Inputs */}
        <Section title="Inputs">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl">
            <div className="space-y-2">
              <Label htmlFor="default-input">Default</Label>
              <Input id="default-input" placeholder="Enter text..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="search-input">With Icon</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input id="search-input" placeholder="Search..." className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="disabled-input">Disabled</Label>
              <Input id="disabled-input" placeholder="Disabled" disabled />
            </div>
          </div>
          <div className="flex items-center gap-3 mt-4">
            <Switch id="theme-switch" />
            <Label htmlFor="theme-switch">Toggle switch</Label>
          </div>
        </Section>

        {/* Badges */}
        <Section title="Badges">
          <div className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Default Badges
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Destructive</Badge>
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Screening Level Badges
              </p>
              <div className="flex flex-wrap gap-2">
                <StatusBadge level="LOW" />
                <StatusBadge level="MODERATE" />
                <StatusBadge level="HIGH" />
                <StatusBadge level="LOW" size="sm" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-2">
                Module Status Badges
              </p>
              <div className="flex flex-wrap gap-2">
                <ModuleStatusBadge status="completed" />
                <ModuleStatusBadge status="in-progress" />
                <ModuleStatusBadge status="pending" />
                <ModuleStatusBadge status="skipped" />
              </div>
            </div>
          </div>
        </Section>

        {/* Cards */}
        <Section title="Cards">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Assessment Module</CardTitle>
                <CardDescription>Typing analysis module</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Measures WPM, accuracy, and typing patterns.
                </p>
              </CardContent>
            </Card>
            <Card className="border-primary/30 glow-primary">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Brain className="size-5 text-primary" />
                  Active Assessment
                </CardTitle>
                <CardDescription>Currently in progress</CardDescription>
              </CardHeader>
              <CardContent>
                <ModuleStatusBadge status="in-progress" />
              </CardContent>
            </Card>
            <Card className="glass border-border/50">
              <CardHeader>
                <CardTitle>Glass Card</CardTitle>
                <CardDescription>Glassmorphism effect</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Translucent background with blur.
                </p>
              </CardContent>
            </Card>
          </div>
        </Section>

        {/* Stat Cards */}
        <Section title="Stat Cards">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Total Assessments"
              value="1,234"
              icon={Activity}
              trend={{ value: 12, label: "vs last month", positive: true }}
            />
            <StatCard
              title="Active Users"
              value="256"
              icon={Users}
              trend={{ value: 8, label: "vs last week", positive: true }}
            />
            <StatCard
              title="Reports Generated"
              value="89"
              icon={FileText}
              subtitle="Last 30 days"
            />
            <StatCard
              title="Avg. Score"
              value="73.2"
              icon={BarChart3}
              trend={{ value: -3, label: "vs last month", positive: false }}
            />
          </div>
        </Section>

        {/* Assessment Module Icons */}
        <Section title="Assessment Modules">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { name: "Typing", icon: Keyboard, color: "text-primary" },
              { name: "Memory", icon: Brain, color: "text-secondary" },
              { name: "Reaction", icon: Timer, color: "text-accent" },
              { name: "Speech", icon: Mic, color: "text-success" },
              { name: "Facial", icon: Camera, color: "text-warning" },
            ].map((module) => (
              <Card
                key={module.name}
                className="group cursor-pointer transition-all duration-200 hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30"
              >
                <CardContent className="flex flex-col items-center gap-3 p-6">
                  <div className="rounded-xl bg-muted p-3 transition-colors group-hover:bg-primary/10">
                    <module.icon
                      className={`size-6 ${module.color} transition-transform group-hover:scale-110`}
                    />
                  </div>
                  <span className="text-sm font-medium">{module.name}</span>
                </CardContent>
              </Card>
            ))}
          </div>
        </Section>

        {/* Disclaimer Banners */}
        <Section title="Disclaimers">
          <div className="space-y-3">
            <DisclaimerBanner />
            <DisclaimerBanner variant="compact" />
            <PrototypeBanner />
          </div>
        </Section>

        {/* Tabs */}
        <Section title="Tabs">
          <Tabs defaultValue="overview" className="max-w-lg">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assessments">Assessments</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
              <TabsTrigger value="settings">
                <Settings className="mr-1.5 size-3.5" />
                Settings
              </TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Overview content goes here.
              </p>
            </TabsContent>
            <TabsContent value="assessments" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Assessment list will appear here.
              </p>
            </TabsContent>
            <TabsContent value="reports" className="mt-4">
              <p className="text-sm text-muted-foreground">
                Generated reports will be listed here.
              </p>
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <p className="text-sm text-muted-foreground">
                User settings and preferences.
              </p>
            </TabsContent>
          </Tabs>
        </Section>

        {/* States */}
        <Section title="State Components">
          <Tabs defaultValue="empty" className="w-full">
            <TabsList>
              <TabsTrigger value="empty">Empty</TabsTrigger>
              <TabsTrigger value="error">Error</TabsTrigger>
              <TabsTrigger value="success">Success</TabsTrigger>
              <TabsTrigger value="loading">Loading</TabsTrigger>
            </TabsList>
            <TabsContent value="empty">
              <EmptyState
                title="No assessments yet"
                description="Start your first assessment to see behavioural screening results here."
                action={
                  <Button>
                    <Plus className="mr-2 size-4" />
                    Start Assessment
                  </Button>
                }
              />
            </TabsContent>
            <TabsContent value="error">
              <ErrorState
                title="Failed to load data"
                description="Could not connect to the server. Please check your connection and try again."
                onRetry={() => console.log("retry")}
              />
            </TabsContent>
            <TabsContent value="success">
              <SuccessState
                title="Assessment Complete!"
                description="Your behavioural screening results are ready to view."
                action={
                  <Button>
                    View Results
                    <ArrowRight className="ml-2 size-4" />
                  </Button>
                }
              />
            </TabsContent>
            <TabsContent value="loading">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <CardSkeleton key={i} />
                ))}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                <ChartSkeleton />
                <ChartSkeleton />
              </div>
              <ProfileSkeleton />
              <div className="mt-4">
                <TableSkeleton rows={3} />
              </div>
            </TabsContent>
          </Tabs>
        </Section>

        {/* Page Header */}
        <Section title="Page Header">
          <Card>
            <CardContent className="p-6">
              <PageHeader
                title="Assessment History"
                description="View and manage your past assessment results"
              >
                <Button variant="outline" size="sm">
                  <Download className="mr-2 size-4" />
                  Export
                </Button>
                <Button size="sm">
                  <Plus className="mr-2 size-4" />
                  New Assessment
                </Button>
              </PageHeader>
            </CardContent>
          </Card>
        </Section>

        {/* Glassmorphism / Effects */}
        <Section title="Effects">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="rounded-xl border p-6 glow-primary text-center">
              <p className="text-sm font-medium">Primary Glow</p>
            </div>
            <div className="rounded-xl border p-6 glow-accent text-center">
              <p className="text-sm font-medium">Accent Glow</p>
            </div>
            <div className="rounded-xl glass border p-6 text-center">
              <p className="text-sm font-medium">Glassmorphism</p>
            </div>
          </div>
        </Section>

        {/* Footer Disclaimer */}
        <Separator />
        <DisclaimerBanner variant="compact" />
      </main>
    </div>
  )
}
