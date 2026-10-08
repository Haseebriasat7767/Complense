import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { MarketingLayout } from '@/components/marketing/MarketingLayout';
import { AppShell } from '@/components/app/AppShell';
import { ProtectedRoute } from '@/components/app/ProtectedRoute';
import { ToastProvider } from '@/components/ui/Toast';
import { SessionProvider } from '@/lib/session';
import { LandingPage } from '@/pages/marketing/LandingPage';
import { FeaturesPage } from '@/pages/marketing/FeaturesPage';
import { HowItWorksPage } from '@/pages/marketing/HowItWorksPage';
import { SecurityPage } from '@/pages/marketing/SecurityPage';
import { PricingPage } from '@/pages/marketing/PricingPage';
import { FaqPage } from '@/pages/marketing/FaqPage';
import { DocumentationPage } from '@/pages/marketing/DocumentationPage';
import { ProductOverviewPage } from '@/pages/marketing/ProductOverviewPage';
import { LegalPage } from '@/pages/marketing/LegalPage';
import { LoginPage } from '@/pages/auth/LoginPage';
import { SignupPage } from '@/pages/auth/SignupPage';
import { ForgotPasswordPage } from '@/pages/auth/ForgotPasswordPage';
import { DashboardPage } from '@/pages/app/DashboardPage';
import { EvidencePage } from '@/pages/app/EvidencePage';
import { EvidenceDetailPage } from '@/pages/app/EvidenceDetailPage';
import { ControlsPage } from '@/pages/app/ControlsPage';
import { ControlDetailPage } from '@/pages/app/ControlDetailPage';
import { MappingsPage } from '@/pages/app/MappingsPage';
import { GapsPage } from '@/pages/app/GapsPage';
import { GapDetailPage } from '@/pages/app/GapDetailPage';
import { ReportsPage } from '@/pages/app/ReportsPage';
import { ReportDetailPage } from '@/pages/app/ReportDetailPage';
import { FrameworksPage } from '@/pages/app/FrameworksPage';
import { SettingsPage } from '@/pages/app/SettingsPage';
import { HelpPage } from '@/pages/app/HelpPage';
import { NotFoundPage } from '@/pages/NotFoundPage';

/** Reset scroll position on navigation so deep links land at the top of a page. */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [pathname]);
  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ToastProvider>
          <ScrollToTop />
          <Routes>
            {/* Marketing site — one shared header, footer and mobile nav. */}
            <Route element={<MarketingLayout />}>
              <Route path="/" element={<LandingPage />} />
              <Route path="/features" element={<FeaturesPage />} />
              <Route path="/how-it-works" element={<HowItWorksPage />} />
              <Route path="/security" element={<SecurityPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/faq" element={<FaqPage />} />
            </Route>

            {/* Standalone pages that carry their own chrome. */}
            <Route path="/documentation" element={<DocumentationPage />} />
            <Route path="/overview" element={<ProductOverviewPage />} />
            <Route path="/privacy" element={<LegalPage kind="privacy" />} />
            <Route path="/terms" element={<LegalPage kind="terms" />} />

            {/* Authentication. */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />

            {/* The product. Demo sessions are real sessions, so the guard runs here too. */}
            <Route
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
              <Route path="/app/dashboard" element={<DashboardPage />} />
              <Route path="/app/evidence" element={<EvidencePage />} />
              <Route path="/app/evidence/:evidenceId" element={<EvidenceDetailPage />} />
              <Route path="/app/controls" element={<ControlsPage />} />
              <Route path="/app/controls/:controlId" element={<ControlDetailPage />} />
              <Route path="/app/mappings" element={<MappingsPage />} />
              <Route path="/app/gaps" element={<GapsPage />} />
              <Route path="/app/gaps/:findingId" element={<GapDetailPage />} />
              <Route path="/app/reports" element={<ReportsPage />} />
              <Route path="/app/reports/:reportId" element={<ReportDetailPage />} />
              <Route path="/app/frameworks" element={<FrameworksPage />} />
              <Route path="/app/settings" element={<SettingsPage />} />
              <Route path="/app/help" element={<HelpPage />} />
              <Route path="/app/*" element={<NotFoundPage insideApp />} />
            </Route>

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
