import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, type ErrorInfo, type ReactNode } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { GOOGLE_CLIENT_ID } from './lib/config';
// Only mount GoogleOAuthProvider when a client ID is actually configured.
// Without this guard, an empty clientId causes @react-oauth/google to throw
// before the ErrorBoundary can catch it, producing a blank white screen.
function MaybeGoogleProvider({ children }: { children: ReactNode }) {
  if (!GOOGLE_CLIENT_ID) return <>{children}</>;
  return <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>{children}</GoogleOAuthProvider>;
}
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { SidebarProvider } from './contexts/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import SplashScreen from './components/SplashScreen';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('App error:', error, info); }
  render() {
    if (this.state.error) {
      const err = this.state.error as Error;
      return (
        <div style={{ minHeight: '100svh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#060b18', padding: '2rem', gap: '1rem' }}>
          <span style={{ fontSize: '2rem' }}>⚠️</span>
          <p style={{ color: '#f1f5f9', fontWeight: 700, margin: 0, fontSize: '1.1rem' }}>Something went wrong</p>
          <p style={{ color: '#94a3b8', margin: 0, fontSize: '0.85rem', maxWidth: '480px', textAlign: 'center' }}>{err.message}</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: '0.5rem', padding: '0.5rem 1.5rem', background: '#00D4FF', color: '#060b18', border: 'none', borderRadius: '8px', fontWeight: 700, cursor: 'pointer', fontSize: '0.875rem' }}>Reload</button>
        </div>
      );
    }
    return this.props.children;
  }
}
import TwinMindCopilot from './components/TwinMindCopilot';
import ThemeEngine from './components/ThemeEngine';
import ParticleEngine from './components/ParticleEngine';
import { ParticleProvider } from './contexts/ParticleContext';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Sessions from './pages/Sessions';
// Materials page retired — content merged into /quiz (Study Resources tab)
import Progress from './pages/Progress';
import ProfileSetup from './pages/ProfileSetup';
import CheckIn from './pages/CheckIn';
import Predict from './pages/Predict';
import Simulate from './pages/Simulate';
import Mentor from './pages/Mentor';
import Twin from './pages/Twin';
import DigitalPersonaTwin from './pages/DigitalPersonaTwin';
import Achievements from './pages/Achievements';
import Quiz from './pages/Quiz';
import Battles from './pages/Battles';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import StudyVideos from './pages/StudyVideos';
import Burnout from './pages/Burnout';
import SubjectAnalysis from './pages/SubjectAnalysis';
import CareerDevelopment from './pages/CareerDevelopment';
import CommTwin from './pages/CommTwin';
import SmartNotes from './pages/SmartNotes';
import SkillTree from './pages/SkillTree';
import Shop from './pages/Shop';
import StudyPlanner from './pages/StudyPlanner';
import ShieldCenter from './pages/ShieldCenter';
import About from './pages/About';
import Home from './pages/Home';

/* Auth guard that doubles as the layout route element.
   Renders AppShell (which contains <Outlet />) for all child routes. */
function AuthGuard() {
  const { token, studentProfile, profileLoaded } = useAuth();
  if (!token) return <Navigate to="/login" replace />;
  if (!profileLoaded) return <SplashScreen />;
  if (!studentProfile) return <Navigate to="/profile/setup" replace />;
  return <AppShell />;
}

export default function App() {
  return (
    <ErrorBoundary>
    <MaybeGoogleProvider>
    <ThemeProvider>
    <ParticleProvider>
    <LanguageProvider>
    <BrowserRouter>
      <AuthProvider>
        <SidebarProvider>
          <ThemeEngine />
          <ParticleEngine />
          <Routes>
            {/* ── Public routes ── */}
            <Route path="/"                element={<Home />} />
            <Route path="/login"           element={<Login />} />
            <Route path="/register"        element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password"  element={<ResetPassword />} />
            <Route path="/about"           element={<About />} />

            {/* Profile setup — protected but skips profile-exists check */}
            <Route
              path="/profile/setup"
              element={
                <ProtectedRoute requireProfile={false}>
                  <ProfileSetup />
                </ProtectedRoute>
              }
            />

            {/* ── Authenticated app — all share the AppShell sidebar + header ── */}
            <Route element={<AuthGuard />}>
              <Route path="/dashboard"     element={<Dashboard />} />
              <Route path="/sessions"      element={<Sessions />} />
              <Route path="/notes"         element={<SmartNotes />} />
              <Route path="/progress"      element={<Progress />} />
              <Route path="/predict"       element={<Predict />} />
              <Route path="/mentor"        element={<Mentor />} />
              <Route path="/simulate"      element={<Simulate />} />
              <Route path="/twin"          element={<Twin />} />
              <Route path="/twin-profile"  element={<DigitalPersonaTwin />} />
              <Route path="/twin-legacy"   element={<DigitalPersonaTwin />} />
              <Route path="/checkin"       element={<CheckIn />} />
              <Route path="/shop"          element={<Shop />} />
              <Route path="/achievements"  element={<Achievements />} />
              <Route path="/quiz"          element={<Quiz />} />
              <Route path="/battles"       element={<Battles />} />
              <Route path="/videos"        element={<StudyVideos />} />
              <Route path="/burnout"       element={<Burnout />} />
              <Route path="/subjects"      element={<SubjectAnalysis />} />
              <Route path="/career"        element={<CareerDevelopment />} />
              <Route path="/comm-twin"     element={<CommTwin />} />
              <Route path="/skill-tree"    element={<SkillTree />} />
              <Route path="/study-planner" element={<StudyPlanner />} />
              <Route path="/shield"        element={<ShieldCenter />} />
              <Route path="/profile"       element={<Profile />} />
            </Route>

            {/* ── Legacy redirects ── */}
            <Route path="/materials"   element={<Navigate to="/quiz"     replace />} />
            <Route path="/focus"       element={<Navigate to="/sessions" replace />} />
            <Route path="/smart-notes" element={<Navigate to="/notes"    replace />} />
            <Route path="*"            element={<Navigate to="/"         replace />} />
          </Routes>
          <TwinMindCopilot />
        </SidebarProvider>
      </AuthProvider>
    </BrowserRouter>
    </LanguageProvider>
    </ParticleProvider>
    </ThemeProvider>
    </MaybeGoogleProvider>
    </ErrorBoundary>
  );
}
