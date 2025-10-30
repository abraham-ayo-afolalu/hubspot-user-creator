'use client';

import { useEffect, useState } from 'react';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Check if user is authenticated via session endpoint
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated) {
          setIsAuthenticated(true);
        } else {
          // Redirect to login if not authenticated
          window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
        }
      })
      .catch(() => {
        window.location.href = `/api/auth/login?returnTo=${encodeURIComponent(window.location.pathname)}`;
      });
  }, []);

  // Show loading state
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-solid border-indigo-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Render children if authenticated
  return <>{children}</>;
}
