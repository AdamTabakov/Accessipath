import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SkipLink } from "./components/navigation/SkipLink.js";
import { Header } from "./components/navigation/Header.js";
import { Footer } from "./components/navigation/Footer.js";
import { LandingPage } from "./pages/LandingPage.js";
import { MapPage } from "./pages/MapPage.js";
import { PreferencesPage } from "./pages/PreferencesPage.js";
import { ReportPage } from "./pages/ReportPage.js";
import { AboutPage } from "./pages/AboutPage.js";
import { ProfileProvider } from "./hooks/useProfile.js";

export default function App() {
  return (
    <ProfileProvider>
      <BrowserRouter>
        <div className="flex min-h-screen flex-col bg-true-black text-silk">
          <SkipLink />
          <Header />
          <main id="main" className="flex-1">
            <Routes>
              <Route path="/" element={<LandingPage />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/preferences" element={<PreferencesPage />} />
              <Route path="/report" element={<ReportPage />} />
              <Route path="/about" element={<AboutPage />} />
            </Routes>
          </main>
          <Footer />
        </div>
      </BrowserRouter>
    </ProfileProvider>
  );
}