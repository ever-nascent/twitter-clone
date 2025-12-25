import { useState, useEffect } from 'react';
import { adminApi, User, UserStats } from '../api/admin';

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editData, setEditData] = useState<Partial<User>>({});
  const [resetPasswordMode, setResetPasswordMode] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: number; username: string } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    passwordsMatch: false,
  });

  useEffect(() => {
    loadUsers();
    loadStats();
  }, [page, search]);

  useEffect(() => {
    setPasswordValidation({
      minLength: newPassword.length >= 8,
      hasUppercase: /[A-Z]/.test(newPassword),
      hasLowercase: /[a-z]/.test(newPassword),
      hasNumber: /[0-9]/.test(newPassword),
      passwordsMatch: newPassword.length > 0 && newPassword === confirmPassword,
    });
  }, [newPassword, confirmPassword]);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await adminApi.getUsers(page, 20, search);
      if (response.success && response.data) {
        setUsers(response.data.users);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await adminApi.getStats();
      if (response.success && response.data) {
        setStats(response.data.stats);
      }
    } catch (err) {
      console.error('Failed to load stats:', err);
    }
  };

  const handleUnlock = async (id: number) => {
    if (!confirm('Are you sure you want to unlock this account?')) return;

    try {
      setError('');
      setSuccess('');
      const response = await adminApi.unlockUser(id);
      if (response.success) {
        setSuccess('Account unlocked successfully');
        loadUsers();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to unlock account');
    }
  };

  const handleVerifyEmail = async (id: number) => {
    if (!confirm('Are you sure you want to verify this email?')) return;

    try {
      setError('');
      setSuccess('');
      const response = await adminApi.verifyEmail(id);
      if (response.success) {
        setSuccess('Email verified successfully');
        loadUsers();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to verify email');
    }
  };

  const handleDelete = async (id: number, username: string) => {
    if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) return;

    try {
      setError('');
      setSuccess('');
      const response = await adminApi.deleteUser(id);
      if (response.success) {
        setSuccess('User deleted successfully');
        loadUsers();
        setSelectedUser(null);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete user');
    }
  };

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    setEditMode(true);
    setEditData({
      username: user.username,
      email: user.email,
      display_name: user.display_name,
      bio: user.bio,
      location: user.location,
      website: user.website,
      verified: user.verified,
      email_verified: user.email_verified,
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    try {
      setError('');
      setSuccess('');
      const response = await adminApi.updateUser(selectedUser.id, editData);
      if (response.success) {
        setSuccess('User updated successfully');
        setEditMode(false);
        setSelectedUser(null);
        loadUsers();
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleResetPassword = (id: number, username: string) => {
    setResetPasswordUser({ id, username });
    setResetPasswordMode(true);
    setNewPassword('');
    setConfirmPassword('');
    setError('');
    setSuccess('');
  };

  const handleSubmitPasswordReset = async () => {
    if (!resetPasswordUser) return;

    const isValid =
      passwordValidation.minLength &&
      passwordValidation.hasUppercase &&
      passwordValidation.hasLowercase &&
      passwordValidation.hasNumber &&
      passwordValidation.passwordsMatch;

    if (!isValid) {
      setError('Please ensure all password requirements are met');
      return;
    }

    try {
      setError('');
      setSuccess('');
      const response = await adminApi.resetPassword(resetPasswordUser.id, newPassword);
      if (response.success) {
        setSuccess(`Password reset successfully for user "${resetPasswordUser.username}"`);
        setResetPasswordMode(false);
        setResetPasswordUser(null);
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Total Users</div>
              <div className="text-2xl font-bold">{stats.total_users}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Verified</div>
              <div className="text-2xl font-bold text-green-600">{stats.verified_users}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Unverified</div>
              <div className="text-2xl font-bold text-yellow-600">{stats.unverified_users}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">Locked</div>
              <div className="text-2xl font-bold text-red-600">{stats.locked_users}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">New (24h)</div>
              <div className="text-2xl font-bold">{stats.new_users_24h}</div>
            </div>
            <div className="bg-white p-4 rounded-lg shadow">
              <div className="text-sm text-gray-600">New (7d)</div>
              <div className="text-2xl font-bold">{stats.new_users_7d}</div>
            </div>
          </div>
        )}

        {/* Messages */}
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 p-4 mb-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="bg-green-50 border-l-4 border-green-500 p-4 mb-4">
            <p className="text-green-700">{success}</p>
          </div>
        )}

        {/* Search */}
        <div className="bg-white p-4 rounded-lg shadow mb-6">
          <input
            type="text"
            placeholder="Search users by username, email, or display name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No users found
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{user.username}</div>
                        <div className="text-sm text-gray-500">{user.display_name || 'No display name'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {user.email}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          {user.email_verified ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              Email Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
                              Email Unverified
                            </span>
                          )}
                          {user.verified && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              Verified Account
                            </span>
                          )}
                          {user.locked_until && new Date(user.locked_until) > new Date() && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Locked
                            </span>
                          )}
                          {user.failed_login_attempts > 0 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800">
                              {user.failed_login_attempts} failed attempts
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(user)}
                            className="text-blue-600 hover:text-blue-900"
                          >
                            Edit
                          </button>
                          {!user.email_verified && (
                            <button
                              onClick={() => handleVerifyEmail(user.id)}
                              className="text-green-600 hover:text-green-900"
                            >
                              Verify Email
                            </button>
                          )}
                          {user.locked_until && new Date(user.locked_until) > new Date() && (
                            <button
                              onClick={() => handleUnlock(user.id)}
                              className="text-yellow-600 hover:text-yellow-900"
                            >
                              Unlock
                            </button>
                          )}
                          <button
                            onClick={() => handleResetPassword(user.id, user.username)}
                            className="text-purple-600 hover:text-purple-900"
                          >
                            Reset Password
                          </button>
                          <button
                            onClick={() => handleDelete(user.id, user.username)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setPage(Math.max(1, page - 1))}
                  disabled={page === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage(Math.min(totalPages, page + 1))}
                  disabled={page === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Page <span className="font-medium">{page}</span> of{' '}
                    <span className="font-medium">{totalPages}</span>
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                    <button
                      onClick={() => setPage(Math.max(1, page - 1))}
                      disabled={page === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages, page + 1))}
                      disabled={page === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Edit Modal */}
        {editMode && selectedUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-screen overflow-y-auto">
              <h2 className="text-2xl font-bold mb-4">Edit User: {selectedUser.username}</h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    value={editData.username || ''}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editData.display_name || ''}
                    onChange={(e) => setEditData({ ...editData, display_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bio
                  </label>
                  <textarea
                    value={editData.bio || ''}
                    onChange={(e) => setEditData({ ...editData, bio: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Location
                  </label>
                  <input
                    type="text"
                    value={editData.location || ''}
                    onChange={(e) => setEditData({ ...editData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Website
                  </label>
                  <input
                    type="text"
                    value={editData.website || ''}
                    onChange={(e) => setEditData({ ...editData, website: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>

                <div className="flex items-center gap-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editData.verified || false}
                      onChange={(e) => setEditData({ ...editData, verified: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Verified Account Badge</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editData.email_verified || false}
                      onChange={(e) => setEditData({ ...editData, email_verified: e.target.checked })}
                      className="mr-2"
                    />
                    <span className="text-sm font-medium text-gray-700">Email Verified</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setEditMode(false);
                    setSelectedUser(null);
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Password Reset Modal */}
        {resetPasswordMode && resetPasswordUser && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-4">Reset Password</h2>
              <p className="text-gray-600 mb-4">
                Setting new password for user: <span className="font-semibold">{resetPasswordUser.username}</span>
              </p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Password
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Enter new password"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirm Password
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                    placeholder="Confirm new password"
                  />
                </div>

                {/* Password Requirements */}
                <div className="bg-gray-50 p-3 rounded-md">
                  <p className="text-sm font-medium text-gray-700 mb-2">Password Requirements:</p>
                  <ul className="space-y-1 text-sm">
                    <li className={passwordValidation.minLength ? 'text-green-600' : 'text-gray-500'}>
                      {passwordValidation.minLength ? '✓' : '○'} At least 8 characters
                    </li>
                    <li className={passwordValidation.hasUppercase ? 'text-green-600' : 'text-gray-500'}>
                      {passwordValidation.hasUppercase ? '✓' : '○'} Contains uppercase letter
                    </li>
                    <li className={passwordValidation.hasLowercase ? 'text-green-600' : 'text-gray-500'}>
                      {passwordValidation.hasLowercase ? '✓' : '○'} Contains lowercase letter
                    </li>
                    <li className={passwordValidation.hasNumber ? 'text-green-600' : 'text-gray-500'}>
                      {passwordValidation.hasNumber ? '✓' : '○'} Contains number
                    </li>
                    <li className={passwordValidation.passwordsMatch ? 'text-green-600' : 'text-gray-500'}>
                      {passwordValidation.passwordsMatch ? '✓' : '○'} Passwords match
                    </li>
                  </ul>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setResetPasswordMode(false);
                    setResetPasswordUser(null);
                    setNewPassword('');
                    setConfirmPassword('');
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmitPasswordReset}
                  disabled={
                    !passwordValidation.minLength ||
                    !passwordValidation.hasUppercase ||
                    !passwordValidation.hasLowercase ||
                    !passwordValidation.hasNumber ||
                    !passwordValidation.passwordsMatch
                  }
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset Password
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
