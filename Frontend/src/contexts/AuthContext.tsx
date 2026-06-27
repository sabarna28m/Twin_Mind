import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
  avatar_url?: string | null;
  twofa_enabled?: boolean;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  institution: string;
  course: string;
  semester: string;
  academic_goals: string;
  learning_preferences: string;
  subjects: string[];
}

interface LoginResponse {
  access_token?: string;
  token_type?: string;
  requires_2fa?: boolean;
  challenge_token?: string;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  studentProfile: StudentProfile | null;
  profileLoaded: boolean;
  // 2FA challenge state
  twoFARequired: boolean;
  login: (email: string, password: string) => Promise<boolean>; // returns true if 2FA is required
  loginWithGoogle: (credential: string) => Promise<void>;
  completeTwoFALogin: (code: string) => Promise<void>;
  clearTwoFAChallenge: () => void;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
  refreshStudentProfile: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken]                     = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser]                       = useState<User | null>(null);
  const [studentProfile, setStudentProfile]   = useState<StudentProfile | null>(null);
  const [profileLoaded, setProfileLoaded]     = useState(false);
  const [twoFARequired, setTwoFARequired]     = useState(false);
  const [twoFAChallengeToken, setTwoFAChallengeToken] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setUser(null);
      setStudentProfile(null);
      setProfileLoaded(false);
      return;
    }
    const headers = { Authorization: `Bearer ${token}` };
    api.get<User>('/auth/me', { headers })
      .then(async r => {
        setUser(r.data);
        try {
          const { data } = await api.get<StudentProfile>('/student-profile', { headers });
          setStudentProfile(data);
        } catch (err: unknown) {
          const status = (err as { response?: { status?: number } })?.response?.status;
          if (status === 404) setStudentProfile(null);
        }
        setProfileLoaded(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setProfileLoaded(false);
      });
  }, [token]);

  async function refreshUser() {
    if (!token) return;
    try {
      const { data } = await api.get<User>('/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser(data);
    } catch {
      // ignore
    }
  }

  async function refreshStudentProfile() {
    if (!token) return;
    try {
      const { data } = await api.get<StudentProfile>('/student-profile', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setStudentProfile(data);
    } catch {
      setStudentProfile(null);
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    const { data } = await api.post<LoginResponse>('/auth/login', { email, password });
    if (data.requires_2fa && data.challenge_token) {
      // Store challenge token in React state only — never in localStorage
      setTwoFAChallengeToken(data.challenge_token);
      setTwoFARequired(true);
      return true;
    }
    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      setProfileLoaded(false);
      setToken(data.access_token);
    }
    return false;
  }

  async function completeTwoFALogin(code: string) {
    const { data } = await api.post<{ access_token: string; token_type: string }>(
      '/auth/2fa/verify-login',
      { challenge_token: twoFAChallengeToken!, code },
    );
    localStorage.setItem('token', data.access_token);
    setTwoFARequired(false);
    setTwoFAChallengeToken(null);
    setProfileLoaded(false);
    setToken(data.access_token);
  }

  function clearTwoFAChallenge() {
    setTwoFARequired(false);
    setTwoFAChallengeToken(null);
  }

  /** Exchange a Google credential (ID token) for a TwinMind session token. */
  async function loginWithGoogle(credential: string) {
    const { data } = await api.post<{ access_token: string }>('/auth/google-login', { credential });
    localStorage.setItem('token', data.access_token);
    setProfileLoaded(false);
    setToken(data.access_token);
  }

  async function register(email: string, fullName: string, password: string) {
    await api.post('/auth/register', { email, full_name: fullName, password });
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setStudentProfile(null);
    setProfileLoaded(false);
    setTwoFARequired(false);
    setTwoFAChallengeToken(null);
  }

  return (
    <AuthContext.Provider value={{
      user, token, studentProfile, profileLoaded,
      twoFARequired,
      login, loginWithGoogle, completeTwoFALogin, clearTwoFAChallenge,
      register, logout,
      refreshStudentProfile, refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
