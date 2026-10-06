// ===========================================================
// NeuroScreen — Application Root
// ===========================================================
// Configures providers, routing, and page layout structure.
//
// Route structure:
//   /                             → Landing page (public)
//   /login                        → Login (public)
//   /register                     → Register (public)
//   /forgot-password              → Forgot password (public)
//   /design-system                → Design system preview (dev)
//   /dashboard                    → Dashboard overview (protected)
//   /dashboard/new-assessment     → New assessment flow (protected)
//   /dashboard/assessments        → Assessment history (protected)
//   /dashboard/results/:id        → Prediction results (protected)
//   /dashboard/reports            → Reports (protected)
//   /dashboard/profile            → Profile (protected)
//   /dashboard/settings           → Settings (protected)
//   /dashboard/admin              → Admin panel (protected, ADMIN)
// ===========================================================

import { BrowserRouter, Routes, Route } from "react-router-dom"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/contexts/auth-context"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"

// Layouts
import { PublicLayout } from "@/layouts/public-layout"
import { DashboardLayout } from "@/layouts/dashboard-layout"

// Auth guard
import { ProtectedRoute } from "@/components/auth/protected-route"

// Public pages
import { LandingPage } from "@/pages/landing"
import { LoginPage } from "@/pages/login"
import { AdminLoginPage } from "@/pages/admin-login"
import { RegisterPage } from "@/pages/register"
import { ForgotPasswordPage } from "@/pages/forgot-password"

// Dashboard pages
import { DashboardOverviewPage } from "@/pages/dashboard/overview"
import { NewAssessmentPage } from "@/pages/dashboard/new-assessment"
import { AssessmentsPage } from "@/pages/dashboard/assessments"
import { ResultsPage } from "@/pages/dashboard/results"
import { ReportsPage } from "@/pages/dashboard/reports"
import { ProfilePage } from "@/pages/dashboard/profile"
import { SettingsPage } from "@/pages/dashboard/settings"
import { AdminPage } from "@/pages/dashboard/admin"

// Dev pages
import { DesignSystemPage } from "@/pages/design-system"

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      retry: (failureCount, error: any) => {
        const status = error?.response?.status
        if (status === 401 || status === 403 || status === 404) {
          return false
        }
        return failureCount < 1
      },
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="system">
          <TooltipProvider>
            <BrowserRouter>
              <Routes>
                {/* =============================== */}
                {/* Public routes (PublicLayout)     */}
                {/* =============================== */}
                <Route element={<PublicLayout />}>
                  {/* Default root path shows Login Page first */}
                  <Route path="/" element={<LoginPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/admin/login" element={<AdminLoginPage />} />
                  <Route path="/home" element={<LandingPage />} />
                  <Route path="/landing" element={<LandingPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                </Route>

                {/* =============================== */}
                {/* Protected routes (Dashboard)    */}
                {/* =============================== */}
                <Route
                  element={
                    <ProtectedRoute>
                      <DashboardLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="/dashboard" element={<DashboardOverviewPage />} />
                  <Route path="/dashboard/new-assessment" element={<NewAssessmentPage />} />
                  <Route path="/dashboard/assessments" element={<AssessmentsPage />} />
                  <Route path="/dashboard/results/:assessmentId" element={<ResultsPage />} />
                  <Route path="/dashboard/results" element={<ResultsPage />} />
                  <Route path="/dashboard/reports" element={<ReportsPage />} />
                  <Route path="/dashboard/profile" element={<ProfilePage />} />
                  <Route path="/dashboard/settings" element={<SettingsPage />} />
                  <Route
                    path="/dashboard/admin"
                    element={
                      <ProtectedRoute requiredRole="ADMIN">
                        <AdminPage />
                      </ProtectedRoute>
                    }
                  />
                </Route>

                {/* =============================== */}
                {/* Dev-only routes                  */}
                {/* =============================== */}
                <Route path="/design-system" element={<DesignSystemPage />} />
              </Routes>
            </BrowserRouter>
            <Toaster richColors position="bottom-right" />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
