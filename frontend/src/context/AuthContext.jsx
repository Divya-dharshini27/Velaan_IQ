import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setToken, clearAuth } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('velaan_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [token, setTokenState] = useState(() => localStorage.getItem('velaan_token'));
  const [loading, setLoading] = useState(true);
  const [sessionExpiredMsg, setSessionExpiredMsg] = useState('');

  const loadUser = useCallback(async () => {
    const savedToken = localStorage.getItem('velaan_token');
    if (!savedToken) {
      setUser(null);
      setLoading(false);
      return;
    }

    try {
      const userData = await authApi.me();
      setUser(userData);
      localStorage.setItem('velaan_user', JSON.stringify(userData));
    } catch (err) {
      console.warn('Failed to fetch current user:', err);
      clearAuth();
      setUser(null);
      setTokenState(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUser();

    const handleExpired = (e) => {
      setUser(null);
      setTokenState(null);
      setSessionExpiredMsg(e?.detail?.message || 'Session expired, please sign in again');
    };

    window.addEventListener('velaan:session-expired', handleExpired);
    return () => window.removeEventListener('velaan:session-expired', handleExpired);
  }, [loadUser]);

  const login = async (email, password) => {
    const data = await authApi.login(email, password);
    setToken(data.access_token);
    setTokenState(data.access_token);
    setSessionExpiredMsg('');
    const userData = await authApi.me();
    setUser(userData);
    localStorage.setItem('velaan_user', JSON.stringify(userData));
    return userData;
  };

  const register = async (email, password, fullName) => {
    await authApi.register(email, password, fullName);
    return login(email, password);
  };

  const logout = () => {
    clearAuth();
    setUser(null);
    setTokenState(null);
    setSessionExpiredMsg('');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
        sessionExpiredMsg,
        clearSessionExpiredMsg: () => setSessionExpiredMsg(''),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
