'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Shield, Activity, Users, AlertTriangle, TrendingUp, Home } from 'lucide-react';
import Link from 'next/link';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  action: string;
  clientId: string;
  details: {
    success: boolean;
    userCount?: number;
    organizationName?: string;
    errorMessage?: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    contactId?: string;
    successCount?: number;
    failedCount?: number;
  };
}

interface AuditStats {
  totalActions: number;
  successfulActions: number;
  failedActions: number;
  userCreations: number;
  bulkUploads: number;
  rateLimitViolations: number;
  topClients: Array<{ clientId: string; count: number }>;
}

export default function AdminPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [auditStats, setAuditStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState({
    action: '',
    success: '',
    limit: 50,
  });

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/admin/status');
      const data = await response.json();
      
      if (data.success && data.data.authenticated) {
        setSession(data.data);
        setLoading(false);
        return true;
      } else {
        // Don't redirect here, let middleware handle it
        setLoading(false);
        return false;
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setLoading(false);
      return false;
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    router.push('/admin/login');
  };

  const loadAuditData = async () => {
    setLoading(true);
    try {
      // Load audit logs
      const logsResponse = await fetch(`/api/admin/audit-logs?${new URLSearchParams({
        limit: filter.limit.toString(),
        action: filter.action,
        success: filter.success,
      })}`);
      
      if (logsResponse.ok) {
        const logsData = await logsResponse.json();
        setAuditLogs(logsData.logs);
      }

      // Load audit stats
      const statsResponse = await fetch('/api/admin/audit-stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setAuditStats(statsData);
      }
    } catch (err) {
      setError('Failed to load audit data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initializeAdmin = async () => {
      const isAuthenticated = await checkAuth();
      if (isAuthenticated) {
        loadAuditData();
      }
    };
    
    initializeAdmin();
  }, [router]);

  useEffect(() => {
    if (session) {
      loadAuditData();
    }
  }, [filter, session]);

  // Show loading while checking authentication
  if (loading && !session) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  // Admin dashboard
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Shield className="h-8 w-8 text-indigo-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
              {session && (
                <span className="ml-4 text-sm text-gray-600">
                  Welcome, {session.username}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/"
                className="flex items-center text-sm text-gray-600 hover:text-gray-900"
              >
                <Home className="w-4 h-4 mr-1" />
                Main App
              </Link>
              <button
                onClick={handleLogout}
                className="bg-gray-600 text-white px-4 py-2 rounded-md hover:bg-gray-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* Statistics Cards */}
        {auditStats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Activity className="h-6 w-6 text-gray-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Total Actions (7 days)
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {auditStats.totalActions}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <Users className="h-6 w-6 text-green-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        User Creations
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {auditStats.userCreations}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-6 w-6 text-blue-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Success Rate
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {auditStats.totalActions > 0 
                          ? Math.round((auditStats.successfulActions / auditStats.totalActions) * 100)
                          : 0}%
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="h-6 w-6 text-red-400" />
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Rate Limit Violations
                      </dt>
                      <dd className="text-lg font-medium text-gray-900">
                        {auditStats.rateLimitViolations}
                      </dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg font-medium mb-4">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Action
                </label>
                <select
                  value={filter.action}
                  onChange={(e) => setFilter({ ...filter, action: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All Actions</option>
                  <option value="CREATE_USER">Create User</option>
                  <option value="BULK_UPLOAD">Bulk Upload</option>
                  <option value="SEARCH_ORGANIZATION">Search Organization</option>
                  <option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Status
                </label>
                <select
                  value={filter.success}
                  onChange={(e) => setFilter({ ...filter, success: e.target.value })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value="">All</option>
                  <option value="true">Success</option>
                  <option value="false">Failed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Limit
                </label>
                <select
                  value={filter.limit}
                  onChange={(e) => setFilter({ ...filter, limit: parseInt(e.target.value) })}
                  className="block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                >
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Audit Logs Table */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Audit Logs</h3>
            <p className="mt-1 text-sm text-gray-500">Recent activity and security events</p>
          </div>
          <ul className="divide-y divide-gray-200">
            {loading ? (
              <li className="px-4 py-4 text-center text-gray-500">Loading...</li>
            ) : auditLogs.length === 0 ? (
              <li className="px-4 py-4 text-center text-gray-500">No audit logs found</li>
            ) : (
              auditLogs.map((log) => (
                <li key={log.id} className="px-4 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className={`flex-shrink-0 h-2 w-2 rounded-full ${
                        log.details.success ? 'bg-green-400' : 'bg-red-400'
                      }`} />
                      <div className="ml-4">
                        <div className="flex items-center">
                          <span className="font-medium text-gray-900">
                            {log.action.replace(/_/g, ' ')}
                          </span>
                          {log.details.organizationName && (
                            <span className="ml-2 text-sm text-gray-500">
                              ({log.details.organizationName})
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-gray-500">
                          Client: {log.clientId.substring(0, 20)}...
                          {log.details.errorMessage && (
                            <span className="text-red-600 ml-2">
                              Error: {log.details.errorMessage}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(log.timestamp).toLocaleString()}
                    </div>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
