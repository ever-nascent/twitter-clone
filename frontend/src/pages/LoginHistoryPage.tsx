import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginHistoryApi } from '../api/auth';
import { getErrorMessage } from '../utils/errors';

interface LoginAttempt {
  id: number;
  success: boolean;
  failureReason: string | null;
  ipAddress: string | null;
  deviceInfo: string | null;
  location: string | null;
  suspicious: boolean;
  suspiciousReason: string | null;
  createdAt: string;
}

interface LoginStats {
  allTime: {
    totalAttempts: number;
    successfulLogins: number;
    failedLogins: number;
    suspiciousLogins: number;
    uniqueIPs: number;
    uniqueDevices: number;
  };
  last30Days: {
    totalAttempts: number;
    successfulLogins: number;
    suspiciousLogins: number;
  };
  lastLogin: {
    timestamp: string;
    ipAddress: string;
    deviceInfo: string;
    location: string;
  } | null;
}

export default function LoginHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<LoginAttempt[]>([]);
  const [stats, setStats] = useState<LoginStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'suspicious' | 'failed'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, [filter]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [historyResponse, statsResponse] = await Promise.all([
        filter === 'suspicious'
          ? loginHistoryApi.getSuspicious(50)
          : loginHistoryApi.getHistory(50),
        loginHistoryApi.getStats(),
      ]);

      if (historyResponse.success && historyResponse.data) {
        const data = 'history' in historyResponse.data
          ? historyResponse.data.history
          : historyResponse.data.suspicious;

        // Filter for failed if selected
        const filteredData = filter === 'failed'
          ? data.filter((item) => !item.success)
          : data;

        setHistory(filteredData);
      }

      if (statsResponse.success && statsResponse.data) {
        setStats(statsResponse.data);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load login history'));
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/security')}
            className="text-sm text-primary hover:text-blue-700 mb-4"
          >
            ← Back to Security Settings
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Login History</h1>
          <p className="mt-2 text-sm text-gray-600">
            Review all login attempts to your account and identify suspicious activity.
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500">Total Logins</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.allTime.totalAttempts}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.last30Days.totalAttempts} in last 30 days
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500">Unique Devices</h3>
              <p className="text-3xl font-bold text-gray-900 mt-2">{stats.allTime.uniqueDevices}</p>
              <p className="text-xs text-gray-500 mt-1">
                From {stats.allTime.uniqueIPs} unique IPs
              </p>
            </div>
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-sm font-medium text-gray-500">Suspicious Activity</h3>
              <p className="text-3xl font-bold text-red-600 mt-2">{stats.allTime.suspiciousLogins}</p>
              <p className="text-xs text-gray-500 mt-1">
                {stats.last30Days.suspiciousLogins} in last 30 days
              </p>
            </div>
          </div>
        )}

        {/* Last Login Info */}
        {stats?.lastLogin && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">Last Successful Login</h3>
            <div className="text-sm text-blue-800 grid grid-cols-2 gap-2">
              <p><span className="font-medium">Time:</span> {formatDate(stats.lastLogin.timestamp)}</p>
              <p><span className="font-medium">Device:</span> {stats.lastLogin.deviceInfo}</p>
              <p><span className="font-medium">IP:</span> {stats.lastLogin.ipAddress}</p>
              <p><span className="font-medium">Location:</span> {stats.lastLogin.location}</p>
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              <button
                onClick={() => setFilter('all')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  filter === 'all'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                All Activity
              </button>
              <button
                onClick={() => setFilter('suspicious')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  filter === 'suspicious'
                    ? 'border-red-500 text-red-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Suspicious
              </button>
              <button
                onClick={() => setFilter('failed')}
                className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  filter === 'failed'
                    ? 'border-yellow-500 text-yellow-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Failed Attempts
              </button>
            </nav>
          </div>

          {/* History Timeline */}
          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading history...</p>
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No login attempts found</p>
              </div>
            ) : (
              history.map((attempt) => (
                <div
                  key={attempt.id}
                  className={`p-6 hover:bg-gray-50 ${
                    attempt.suspicious ? 'bg-red-50' : ''
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {attempt.success ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            ✓ Successful Login
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            ✗ Failed Login
                          </span>
                        )}
                        {attempt.suspicious && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                            ⚠ Suspicious
                          </span>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">Time:</span> {formatDate(attempt.createdAt)}
                        </p>
                        <p>
                          <span className="font-medium">Device:</span>{' '}
                          {attempt.deviceInfo || 'Unknown'}
                        </p>
                        <p>
                          <span className="font-medium">IP:</span> {attempt.ipAddress || 'Unknown'}
                        </p>
                        <p>
                          <span className="font-medium">Location:</span>{' '}
                          {attempt.location || 'Unknown'}
                        </p>
                      </div>
                      {!attempt.success && attempt.failureReason && (
                        <p className="mt-2 text-sm text-red-600">
                          <span className="font-medium">Reason:</span> {attempt.failureReason}
                        </p>
                      )}
                      {attempt.suspicious && attempt.suspiciousReason && (
                        <p className="mt-2 text-sm text-yellow-700">
                          <span className="font-medium">Suspicious Activity:</span>{' '}
                          {attempt.suspiciousReason}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-yellow-900 mb-2">
            🔒 Security Tip
          </h3>
          <p className="text-sm text-yellow-800">
            If you notice any suspicious activity that you don't recognize, immediately change your
            password and enable 2FA. You can also revoke all trusted devices to require 2FA on all
            future logins.
          </p>
        </div>
      </div>
    </div>
  );
}
