import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getAuth, setAuth, clearAuth, getMe, UNAUTHORIZED_EVENT } from '../lib/api';

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
    if (!getAuth().token) return;
    try {
      const { user: u } = await getMe();
      // Read the token again: the request may have renewed it.
      const { token: t } = getAuth();
      setToken(t);
      setUser(u);
      setAuth(t, u);
    } catch (err) {
      // Only a rejected token ends the session; network or server errors keep the user signed in.
      if (err.status === 401) signOut();
    }
  }, [signOut]);

  // Any request answered 401 (expired or revoked token) returns the user to the login screen
  // instead of leaving every page stuck on the "Кіру қажет" error.
  useEffect(() => {
    window.addEventListener(UNAUTHORIZED_EVENT, signOut);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, signOut);
  }, [signOut]);

  // Renew the token when the app starts and whenever it comes back to the foreground.
  useEffect(() => {
    refreshMe();
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshMe();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [refreshMe]);

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
