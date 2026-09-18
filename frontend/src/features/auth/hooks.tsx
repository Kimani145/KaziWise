'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from './types';
import { getMe, login as apiLogin, logout as apiLogout } from './api';
import { getAccessToken } from '../../lib/api-client';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: typeof apiLogin;
  logout: typeof apiLogout;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setUser(null);
        setIsLoading(false);
        return;
      }
      const data = await getMe();
      setUser(data);
      if (typeof window !== 'undefined') {
        localStorage.setItem('kaziwise_user', JSON.stringify(data));
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load from storage if present
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('kaziwise_user');
      if (cached) {
        try {
          setUser(JSON.parse(cached));
        } catch {}
      }
    }
    refreshUser();
  }, []);

  const handleLogin: typeof apiLogin = async (credentials) => {
    const res = await apiLogin(credentials);
    setUser(res.user);
    return res;
  };

  const handleLogout = async () => {
    setUser(null);
    await apiLogout();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        login: handleLogin,
        logout: handleLogout,
        refreshUser,
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
