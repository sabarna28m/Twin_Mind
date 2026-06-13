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
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';

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
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import Sessions from './pages/Sessions';
import Notes from './pages/Notes';
import Materials from './pages/Materials';
import Progress from './pages/Progress';
import ProfileSetup from './pages/ProfileSetup';
import CheckIn from './pages/CheckIn';
import Predict from './pages/Predict';
import Simulate from './pages/Simulate';
import Mentor from './pages/Mentor';
import Twin from './pages/Twin';
import Achievements from './pages/Achievements';
import Quiz from './pages/Quiz';
import Battles from './pages/Battles';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import FocusSession from './pages/FocusSession';
import StudyVideos from './pages/StudyVideos';
import Burnout from './pages/Burnout';
import SubjectAnalysis from './pages/SubjectAnalysis';
import AIFocusDetector from './pages/AIFocusDetector';
import CareerDevelopment from './pages/CareerDevelopment';

export default function App() {
  return (
    <ErrorBoundary>
    <MaybeGoogleProvider>
    <ThemeProvider>
    <LanguageProvider>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/sessions"
            element={
              <ProtectedRoute>
                <Sessions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/notes"
            element={
              <ProtectedRoute>
                <Notes />
              </ProtectedRoute>
            }
          />
          <Route
            path="/materials"
            element={
              <ProtectedRoute>
                <Materials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/progress"
            element={
              <ProtectedRoute>
                <Progress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/predict"
            element={
              <ProtectedRoute>
                <Predict />
              </ProtectedRoute>
            }
          />
          <Route
            path="/mentor"
            element={
              <ProtectedRoute>
                <Mentor />
              </ProtectedRoute>
            }
          />
          <Route
            path="/simulate"
            element={
              <ProtectedRoute>
                <Simulate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/twin"
            element={
              <ProtectedRoute>
                <Twin />
              </ProtectedRoute>
            }
          />
          <Route
            path="/checkin"
            element={
              <ProtectedRoute>
                <CheckIn />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile/setup"
            element={
              <ProtectedRoute requireProfile={false}>
                <ProfileSetup />
              </ProtectedRoute>
            }
          />
          <Route
            path="/achievements"
            element={
              <ProtectedRoute>
                <Achievements />
              </ProtectedRoute>
            }
          />
          <Route
            path="/quiz"
            element={
              <ProtectedRoute>
                <Quiz />
              </ProtectedRoute>
            }
          />
          <Route
            path="/battles"
            element={
              <ProtectedRoute>
                <Battles />
              </ProtectedRoute>
            }
          />
          <Route
            path="/focus"
            element={
              <ProtectedRoute>
                <FocusSession />
              </ProtectedRoute>
            }
          />
          <Route
            path="/videos"
            element={
              <ProtectedRoute>
                <StudyVideos />
              </ProtectedRoute>
            }
          />
          <Route
            path="/burnout"
            element={
              <ProtectedRoute>
                <Burnout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subjects"
            element={
              <ProtectedRoute>
                <SubjectAnalysis />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-focus"
            element={
              <ProtectedRoute>
                <AIFocusDetector />
              </ProtectedRoute>
            }
          />
          <Route
            path="/career"
            element={
              <ProtectedRoute>
                <CareerDevelopment />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <TwinMindCopilot />
      </AuthProvider>
    </BrowserRouter>
    </LanguageProvider>
    </ThemeProvider>
    </MaybeGoogleProvider>
    </ErrorBoundary>
  );
}
