import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { sessionApi, Session } from '../api/sessions';
import { getErrorMessage } from '../utils/errors';

export default function SessionsPage() {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deletingAll, setDeletingAll] = useState(false);

  // Fetch sessions on mount
  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await sessionApi.getSessions();

      if (response.success && response.data) {
        setSessions(response.data.sessions);
      } else {
        setError(response.error || 'Failed to load sessions');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load sessions'));
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSession = async (sessionId: number) => {
    if (!confirm('Are you sure you want to log out from this device?')) {
      return;
    }

    setDeletingId(sessionId);
    setError('');

    try {
      const response = await sessionApi.deleteSession(sessionId);

      if (response.success) {
        // Remove session from list
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      } else {
        setError(response.error || 'Failed to delete session');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete session'));
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteOtherSessions = async () => {
    if (!confirm('Are you sure you want to log out from all other devices?')) {
      return;
    }

    setDeletingAll(true);
    setError('');

    try {
      const response = await sessionApi.deleteOtherSessions();

      if (response.success) {
        // Remove all non-current sessions
        setSessions((prev) => prev.filter((s) => s.isCurrent));
      } else {
        setError(response.error || 'Failed to delete sessions');
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to delete sessions'));
    } finally {
      setDeletingAll(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/security')}
            className="text-sm text-gray-600 hover:text-gray-900 mb-4 flex items-center"
          >
            <svg
              className="w-4 h-4 mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Back to Security Settings
          </button>

          <h1 className="text-3xl font-bold text-gray-900">Active Sessions</h1>
          <p className="mt-2 text-gray-600">
            Manage your active login sessions across different devices
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {/* Logout All Button */}
        {otherSessionsCount > 0 && (
          <div className="mb-6">
            <button
              onClick={handleDeleteOtherSessions}
              disabled={deletingAll}
              className="px-4 py-2 border border-red-600 text-red-600 rounded-md hover:bg-red-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {deletingAll ? 'Logging out...' : `Log out from ${otherSessionsCount} other device${otherSessionsCount !== 1 ? 's' : ''}`}
            </button>
          </div>
        )}

        {/* Sessions List */}
        {loading ? (
          <div className="bg-white shadow rounded-lg p-8">
            <div className="flex justify-center items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
            <p className="text-center text-gray-600 mt-4">Loading sessions...</p>
          </div>
        ) : sessions.length === 0 ? (
          <div className="bg-white shadow rounded-lg p-8 text-center">
            <p className="text-gray-600">No active sessions found</p>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg divide-y divide-gray-200">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`p-6 ${session.isCurrent ? 'bg-blue-50' : ''}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Device Info */}
                    <div className="flex items-center">
                      <svg
                        className="w-6 h-6 text-gray-400 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        {session.deviceInfo?.toLowerCase().includes('mobile') ||
                        session.deviceInfo?.toLowerCase().includes('android') ||
                        session.deviceInfo?.toLowerCase().includes('ios') ? (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z"
                          />
                        ) : (
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                          />
                        )}
                      </svg>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">
                          {session.deviceInfo || 'Unknown Device'}
                          {session.isCurrent && (
                            <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                              Current Session
                            </span>
                          )}
                        </h3>
                        <div className="mt-1 text-sm text-gray-600 space-y-1">
                          {session.location && (
                            <div className="flex items-center">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                />
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                />
                              </svg>
                              {session.location}
                            </div>
                          )}
                          {session.ipAddress && (
                            <div className="flex items-center">
                              <svg
                                className="w-4 h-4 mr-1"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                />
                              </svg>
                              {session.ipAddress}
                            </div>
                          )}
                          <div className="flex items-center">
                            <svg
                              className="w-4 h-4 mr-1"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            Last active {formatDate(session.lastActiveAt)}
                          </div>
                          <div className="text-xs text-gray-500">
                            Signed in {formatDate(session.createdAt)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  {!session.isCurrent && (
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      disabled={deletingId === session.id}
                      className="ml-4 px-3 py-1.5 text-sm border border-red-600 text-red-600 rounded-md hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === session.id ? 'Logging out...' : 'Log out'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <svg
              className="w-5 h-5 text-blue-600 mr-3 flex-shrink-0 mt-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">Security Tip</p>
              <p>
                If you see a session you don't recognize, log out from that device immediately
                and consider changing your password. This could indicate unauthorized access to
                your account.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
