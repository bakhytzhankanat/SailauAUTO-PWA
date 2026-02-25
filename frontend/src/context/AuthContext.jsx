import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuth, setAuth, clearAuth, getMe } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadStored = useCallback(() => {
    const { token: t, user: u } = getAuth();
    setToken(t);
    setUser(u);
  }, []);

  useEffect(() => {
    loadStored();
    setLoading(false);
  }, [loadStored]);

  const signIn = useCallback((newToken, newUser) => {
    setAuth(newToken, newUser);
    setToken(newToken);
    setUser(newUser);
  }, []);

  const signOut = useCallback(() => {
    clearAuth();
    setToken(null);
    setUser(null);
  }, []);

  const refreshMe = useCallback(async () => {
    const { token: t } = getAuth();
    if (!t) return;
    try {
      const { user: u } = await getMe();
      setUser(u);
      setAuth(t, u);
    } catch {
      signOut();
    }
  }, [signOut]);

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    signIn,
    signOut,
    refreshMe,
    loadStored,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
