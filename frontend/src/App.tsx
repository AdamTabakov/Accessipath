import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { SkipLink } from "./components/navigation/SkipLink.js";
import { Header } from "./components/navigation/Header.js";
import { Footer } from "./components/navigation/Footer.js";
import { LandingPage } from "./pages/LandingPage.js";
import { MapPage } from "./pages/MapPage.js";
import { PreferencesPage } from "./pages/PreferencesPage.js";
import { ReportPage } from "./pages/ReportPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { PrivacyPage } from "./pages/PrivacyPage.js";
import { TermsPage } from "./pages/TermsPage.js";
import { NotFoundPage } from "./pages/NotFoundPage.js";
import { SignupPage } from "./pages/SignupPage.js";
import { LoginPage } from "./pages/LoginPage.js";
import { VerifyPage } from "./pages/VerifyPage.js";
import { AuthProvider } from "./hooks/useAuth.js";
import { ProfileProvider } from "./hooks/useProfile.js";

function HeaderGate() {
  const { pathname } = useLocation();
  if (pathname === "/") return null;
  return <Header />;
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
            </main>
            <Footer />
          </div>
        </BrowserRouter>
      </ProfileProvider>
    </AuthProvider>
  );
}