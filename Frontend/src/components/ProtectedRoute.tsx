import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import SplashScreen from './SplashScreen';
import type { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  requireProfile?: boolean;  // default true — redirect to /profile/setup if no student profile
}

export default function ProtectedRoute({ children, requireProfile = true }: Props) {
  const { token, studentProfile, profileLoaded } = useAuth();

  if (!token) return <Navigate to="/login" replace />;
  if (requireProfile && !profileLoaded) return <SplashScreen />;
  if (requireProfile && profileLoaded && !studentProfile) return <Navigate to="/profile/setup" replace />;

  return <>{children}</>;
}
