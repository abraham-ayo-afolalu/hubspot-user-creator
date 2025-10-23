'use client';

import { useState } from 'react';
import { LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LogoutButton() {
  const { session, logout } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (!session) return null;

  return (
    <div className="flex items-center space-x-3">
      <div className="flex items-center text-sm text-gray-600">
        <User className="w-4 h-4 mr-1" />
        <span>Welcome, {session.username}</span>
      </div>
      
      <button
        onClick={handleLogout}
        disabled={isLoading}
        className="flex items-center px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Logout"
      >
        {isLoading ? (
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
        ) : (
          <>
            <LogOut className="w-4 h-4 mr-1" />
            Logout
          </>
        )}
      </button>
    </div>
  );
}
