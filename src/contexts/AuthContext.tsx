'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface AdminSession {
  username: string;
  isAuthenticated: boolean;
  loginTime: number;
}

interface AuthContextType {
  session: AdminSession | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AdminSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/status');
      const data = await response.json();
      
      if (data.success && data.data.authenticated) {
        setSession({
          username: data.data.username,
          isAuthenticated: true,
          loginTime: data.data.loginTime,
        });
      } else {
        setSession(null);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (data.success) {
        setSession({
          username: data.data.username,
          isAuthenticated: true,
          loginTime: Date.now(),
        });
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Login failed:', error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error('Logout request failed:', error);
    }
    
    setSession(null);
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider value={{ session, isLoading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
