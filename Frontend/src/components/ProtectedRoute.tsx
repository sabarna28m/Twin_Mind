import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  requireProfile?: boolean;  // default true — redirect to /profile/setup if no student profile
}

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100svh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      gap: '1rem',
    }}>
      <div style={{
        width: '44px',
        height: '44px',
        border: '3px solid rgba(0,212,255,0.15)',
        borderTop: '3px solid #00D4FF',
        borderRadius: '50%',
        animation: 'ring-spin 0.9s linear infinite',
      }} />
      <span style={{ fontSize: '0.85rem', color: 'var(--text)', opacity: 0.6 }}>Loading…</span>
    </div>
  );
}

export default function ProtectedRoute({ children, requireProfile = true }: Props) {
  const { token, studentProfile, profileLoaded } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (requireProfile && !profileLoaded) return <LoadingScreen />;
  if (requireProfile && profileLoaded && !studentProfile) return <Navigate to="/profile/setup" replace />;

  return <>{children}</>;
}
