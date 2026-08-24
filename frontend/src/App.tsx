import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SkipLink } from "./components/navigation/SkipLink.js";
import { Header } from "./components/navigation/Header.js";
import { Footer } from "./components/navigation/Footer.js";
import { NotificationViewport } from "./components/notifications/Notifications.js";
import { Spinner } from "./components/ui.js";
import { AuthProvider } from "./hooks/useAuth.js";
import { ProfileProvider } from "./hooks/useProfile.js";

const LandingPage = lazy(() =>
  import("./pages/LandingPage.js").then((m) => ({ default: m.LandingPage })),
);

const MapPage = lazy(() => import("./pages/MapPage.js").then((m) => ({ default: m.MapPage })));
const PreferencesPage = lazy(() =>
  import("./pages/PreferencesPage.js").then((m) => ({ default: m.PreferencesPage })),
);
const ReportPage = lazy(() =>
  import("./pages/ReportPage.js").then((m) => ({ default: m.ReportPage })),
);
const AboutPage = lazy(() =>
  import("./pages/AboutPage.js").then((m) => ({ default: m.AboutPage })),
);
const PrivacyPage = lazy(() =>
  import("./pages/PrivacyPage.js").then((m) => ({ default: m.PrivacyPage })),
);
const TermsPage = lazy(() =>
  import("./pages/TermsPage.js").then((m) => ({ default: m.TermsPage })),
);
const SignupPage = lazy(() =>
  import("./pages/SignupPage.js").then((m) => ({ default: m.SignupPage })),
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage.js").then((m) => ({ default: m.LoginPage })),
);
const VerifyPage = lazy(() =>
  import("./pages/VerifyPage.js").then((m) => ({ default: m.VerifyPage })),
);
const NotFoundPage = lazy(() =>
  import("./pages/NotFoundPage.js").then((m) => ({ default: m.NotFoundPage })),
);

function HeaderGate() {
  const { pathname } = useLocation();
  if (pathname === "/") return null;
  return <Header />;
}

function PageFallback() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <Spinner label="Loading..." />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ProfileProvider>
        <BrowserRouter>
          <div className="flex min-h-screen flex-col bg-true-black text-silk">
            <SkipLink />
            <HeaderGate />
            <main id="main" className="flex-1">
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/map" element={<MapPage />} />
                  <Route path="/preferences" element={<PreferencesPage />} />
                  <Route path="/report" element={<ReportPage />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/signup" element={<SignupPage />} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/verify" element={<VerifyPage />} />
                  <Route path="*" element={<NotFoundPage />} />
                </Routes>
              </Suspense>
            </main>
            <Footer />
            <NotificationViewport />
          </div>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  );
}
