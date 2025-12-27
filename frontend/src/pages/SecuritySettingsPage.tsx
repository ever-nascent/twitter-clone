import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { authApi, twoFactorApi } from '../api/auth';
import { getErrorMessage } from '../utils/errors';

export default function SecuritySettingsPage() {
  const navigate = useNavigate();

  // 2FA State
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [backupCodesCount, setBackupCodesCount] = useState(0);
  const [isLoading2FA, setIsLoading2FA] = useState(true);

  // 2FA Setup State
  const [showSetup2FA, setShowSetup2FA] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [setupCode, setSetupCode] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // 2FA Disable State
  const [showDisable2FA, setShowDisable2FA] = useState(false);
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [logoutOtherDevices, setLogoutOtherDevices] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load 2FA status on mount
  useEffect(() => {
    loadTwoFactorStatus();
  }, []);

  const loadTwoFactorStatus = async () => {
    try {
      const response = await twoFactorApi.getStatus();
      if (response.success && response.data) {
        setTwoFactorEnabled(response.data.enabled);
        setBackupCodesCount(response.data.backupCodesCount);
      }
    } catch (err) {
      console.error('Failed to load 2FA status:', err);
    } finally {
      setIsLoading2FA(false);
    }
  };

  const handleSetup2FA = async () => {
    setError('');
    setIsSubmitting(true);

    try {
      const response = await twoFactorApi.setup();
      if (response.success && response.data) {
        setQrCodeUrl(response.data.qrCodeUrl);
        setSecret(response.data.secret);
        setShowSetup2FA(true);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to setup 2FA'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEnable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await twoFactorApi.enable(setupCode, setupPassword);
      if (response.success && response.data) {
        setBackupCodes(response.data.backupCodes);
        setTwoFactorEnabled(true);
        setSuccess('2FA enabled successfully! Save your backup codes.');
        setShowSetup2FA(false);
        setSetupCode('');
        setSetupPassword('');
        loadTwoFactorStatus();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to enable 2FA'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisable2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const response = await twoFactorApi.disable(disablePassword, disableCode);
      if (response.success) {
        setTwoFactorEnabled(false);
        setSuccess('2FA disabled successfully');
        setShowDisable2FA(false);
        setDisableCode('');
        setDisablePassword('');
        loadTwoFactorStatus();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to disable 2FA'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await authApi.changePassword(
        currentPassword,
        newPassword,
        logoutOtherDevices
      );
      if (response.success) {
        setSuccess(response.message || 'Password changed successfully');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setLogoutOtherDevices(false);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to change password'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Security Settings</h1>

        {/* Success/Error Messages */}
        {error && (
          <div className="mb-6 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-md bg-green-50 p-4">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}

        {/* Backup Codes Display (after enabling 2FA) */}
        {backupCodes.length > 0 && (
          <div className="mb-6 bg-yellow-50 border-2 border-yellow-400 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-900 mb-2">
              ⚠️ Save Your Backup Codes
            </h3>
            <p className="text-sm text-yellow-800 mb-4">
              These codes can be used to access your account if you lose your authenticator device.
              Each code can only be used once. Save them in a secure place!
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="bg-white border border-yellow-300 rounded px-3 py-2 font-mono text-sm text-center"
                >
                  {code}
                </div>
              ))}
            </div>
            <button
              onClick={() => {
                const text = backupCodes.join('\n');
                navigator.clipboard.writeText(text);
                setSuccess('Backup codes copied to clipboard');
              }}
              className="text-sm text-yellow-900 hover:text-yellow-700 font-medium"
            >
              📋 Copy all codes
            </button>
            <button
              onClick={() => setBackupCodes([])}
              className="ml-4 text-sm text-yellow-900 hover:text-yellow-700 font-medium"
            >
              I've saved them
            </button>
          </div>
        )}

        {/* Two-Factor Authentication Section */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Two-Factor Authentication</h2>

          {isLoading2FA ? (
            <p className="text-gray-500">Loading...</p>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm text-gray-600">
                    Status:{' '}
                    <span
                      className={`font-semibold ${
                        twoFactorEnabled ? 'text-green-600' : 'text-gray-500'
                      }`}
                    >
                      {twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </p>
                  {twoFactorEnabled && (
                    <p className="text-xs text-gray-500 mt-1">
                      {backupCodesCount} backup code{backupCodesCount !== 1 ? 's' : ''} remaining
                    </p>
                  )}
                </div>
                <div>
                  {!twoFactorEnabled ? (
                    <button
                      onClick={handleSetup2FA}
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                    >
                      Enable 2FA
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowDisable2FA(true)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Disable 2FA
                    </button>
                  )}
                </div>
              </div>

              {/* 2FA Setup Modal */}
              {showSetup2FA && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-4">Setup Two-Factor Authentication</h3>
                  <ol className="list-decimal list-inside space-y-3 text-sm text-gray-700 mb-4">
                    <li>Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)</li>
                    <li>Enter the 6-digit code from the app below</li>
                    <li>Enter your password to confirm</li>
                  </ol>

                  {qrCodeUrl && (
                    <div className="flex justify-center mb-4">
                      <img src={qrCodeUrl} alt="2FA QR Code" className="w-64 h-64" />
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <p className="text-xs text-gray-500 mb-1">Or enter this code manually:</p>
                    <code className="bg-gray-100 px-3 py-1 rounded text-sm">{secret}</code>
                  </div>

                  <form onSubmit={handleEnable2FA} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        6-Digit Code
                      </label>
                      <input
                        type="text"
                        value={setupCode}
                        onChange={(e) => setSetupCode(e.target.value)}
                        placeholder="000000"
                        maxLength={6}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md text-center text-2xl tracking-widest"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Password
                      </label>
                      <input
                        type="password"
                        value={setupPassword}
                        onChange={(e) => setSetupPassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Enabling...' : 'Enable 2FA'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowSetup2FA(false);
                          setSetupCode('');
                          setSetupPassword('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* 2FA Disable Modal */}
              {showDisable2FA && (
                <div className="border-t pt-4 mt-4">
                  <h3 className="text-lg font-semibold mb-4">Disable Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Enter your password and a 2FA code to disable two-factor authentication.
                  </p>

                  <form onSubmit={handleDisable2FA} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Your Password
                      </label>
                      <input
                        type="password"
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        2FA Code or Backup Code
                      </label>
                      <input
                        type="text"
                        value={disableCode}
                        onChange={(e) => setDisableCode(e.target.value)}
                        placeholder="000000"
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-md"
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                      >
                        {isSubmitting ? 'Disabling...' : 'Disable 2FA'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowDisable2FA(false);
                          setDisableCode('');
                          setDisablePassword('');
                        }}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </>
          )}
        </div>

        {/* Password Change Section */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Change Password</h2>

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Current Password
              </label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
              <p className="mt-1 text-xs text-gray-500">
                At least 8 characters with uppercase, lowercase, number, and special character
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="logoutOtherDevices"
                checked={logoutOtherDevices}
                onChange={(e) => setLogoutOtherDevices(e.target.checked)}
                className="h-4 w-4 text-primary focus:ring-primary border-gray-300 rounded"
              />
              <label htmlFor="logoutOtherDevices" className="ml-2 block text-sm text-gray-700">
                Log out from all other devices
              </label>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-4 py-2 bg-primary text-white rounded-md hover:bg-blue-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Changing Password...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Security Features Section */}
        <div className="bg-white shadow rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Security Features</h2>
          <div className="space-y-3">
            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-900">Trusted Devices</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    Manage devices that can skip 2FA for 30 days
                  </p>
                </div>
                <button
                  onClick={() => navigate('/trusted-devices')}
                  className="px-4 py-2 text-sm text-primary hover:text-blue-700 font-medium"
                >
                  Manage →
                </button>
              </div>
            </div>

            <div className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium text-gray-900">Login History</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    View all login attempts and suspicious activity
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login-history')}
                  className="px-4 py-2 text-sm text-primary hover:text-blue-700 font-medium"
                >
                  View →
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Active Sessions Section */}
        <div className="bg-white shadow rounded-lg p-6 mt-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Active Sessions</h2>
          <p className="text-sm text-gray-600 mb-4">
            Manage your active login sessions and see where you're logged in
          </p>
          <button
            onClick={() => navigate('/sessions')}
            className="w-full px-4 py-2 border border-primary text-primary rounded-md hover:bg-blue-50 font-medium"
          >
            View All Sessions
          </button>
        </div>
      </div>
    </div>
  );
}
