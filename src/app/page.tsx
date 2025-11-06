'use client';

import { useState } from 'react';
import { signOut, useSession } from 'next-auth/react';
import UserCreationForm from '@/components/UserCreationForm';
import BulkUploadForm from '@/components/BulkUploadForm';
import ProtectedRoute from '@/components/ProtectedRoute';
import { User, Users, LogOut } from 'lucide-react';

export default function Home() {
  const [activeTab, setActiveTab] = useState<'single' | 'bulk'>('single');
  const { data: session } = useSession();

  return (
    <ProtectedRoute>
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8" style={{
      backgroundImage: 'url(/background.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat'
    }}>
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex justify-between items-center mb-4">
            <h1 className="text-xl font-bold text-gray-900 sm:text-2xl flex-1">
              Elastic Path Customer Portal User Creator
            </h1>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
          {session?.user?.email && (
            <p className="text-sm text-gray-600">
              Signed in as {session.user.email}
            </p>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-8 justify-center" aria-label="Tabs">
            <button
              onClick={() => setActiveTab('single')}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'single'
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                  : 'text-gray-500 hover:text-gray-700 border-2 border-transparent'
              }`}
            >
              <User className="w-4 h-4 mr-2" />
              Single User
            </button>
            <button
              onClick={() => setActiveTab('bulk')}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                activeTab === 'bulk'
                  ? 'bg-indigo-100 text-indigo-700 border-2 border-indigo-200'
                  : 'text-gray-500 hover:text-gray-700 border-2 border-transparent'
              }`}
            >
              <Users className="w-4 h-4 mr-2" />
              Bulk Upload
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="bg-white/95 backdrop-blur-sm shadow-xl rounded-lg p-6">
          {activeTab === 'single' ? (
            <UserCreationForm />
          ) : (
            <BulkUploadForm />
          )}
        </div>
      </div>
    </div>
    </ProtectedRoute>
  );
}
