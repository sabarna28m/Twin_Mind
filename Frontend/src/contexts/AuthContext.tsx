import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import api from '../services/api';

interface User {
  id: number;
  email: string;
  full_name: string;
  is_active: boolean;
}

interface AuthContextValue {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, fullName: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (!token) { setUser(null); return; }
    api.get<User>('/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => setUser(r.data))
      .catch(() => { localStorage.removeItem('token'); setToken(null); });
  }, [token]);

  async function login(email: string, password: string) {
    const { data } = await api.post<{ access_token: string }>('/auth/login', { email, password });
    localStorage.setItem('token', data.access_token);
    setToken(data.access_token);
  }

  async function register(email: string, fullName: string, password: string) {
    await api.post('/auth/register', { email, full_name: fullName, password });
  }

  function logout() {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
