'use client';

import { useEffect, useState } from 'react';
import { LogOut, User } from 'lucide-react';

interface UserData {
  email?: string;
  name?: string;
}

export default function UserProfile() {
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    // Fetch user data from session
    fetch('/api/auth/session')
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setUserData(data.user);
        }
      })
      .catch(error => console.error('Failed to fetch user data:', error));
  }, []);

  const handleLogout = () => {
    window.location.href = '/api/auth/logout';
  };

  if (!userData) {
    return null;
  }

  const userEmail = userData.email || 'User';
  const userName = userData.name || userEmail;

  return (
    <div className="flex items-center justify-between mb-6 bg-white/95 backdrop-blur-sm shadow rounded-lg p-4">
      <div className="flex items-center space-x-3">
        <div className="bg-indigo-100 rounded-full p-2">
          <User className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-900">{userName}</p>
          <p className="text-xs text-gray-500">{userEmail}</p>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
      >
        <LogOut className="h-4 w-4" />
        <span>Logout</span>
      </button>
    </div>
  );
}
