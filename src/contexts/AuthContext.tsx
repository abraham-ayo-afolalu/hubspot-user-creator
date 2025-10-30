'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { oktaAuth } from '@/lib/auth-config';
import type { OktaAuth, AuthState } from '@okta/okta-auth-js';

interface AuthContextType {
  authState: AuthState | null;
  oktaAuth: OktaAuth | null;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!oktaAuth) {
      setIsLoading(false);
      return;
    }

    // Subscribe to auth state changes
    const updateAuthState = () => {
      oktaAuth.authStateManager.subscribe((newAuthState) => {
        setAuthState(newAuthState);
        setIsLoading(false);
      });
    };

    // Initial auth state check
    oktaAuth.authStateManager.updateAuthState().then(() => {
      setAuthState(oktaAuth.authStateManager.getAuthState());
      setIsLoading(false);
    }).catch((error) => {
      console.error('Auth state update error:', error);
      setIsLoading(false);
    });

    updateAuthState();

    return () => {
      oktaAuth.authStateManager.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ authState, oktaAuth, isLoading }}>
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
