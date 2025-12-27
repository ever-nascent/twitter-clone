import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { trustedDevicesApi } from '../api/auth';
import { getErrorMessage } from '../utils/errors';

interface TrustedDevice {
  id: number;
  deviceName: string | null;
  ipAddress: string | null;
  trustedAt: string;
  expiresAt: string;
  lastUsedAt: string;
  isCurrent: boolean;
}

export default function TrustedDevicesPage() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState<TrustedDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Revoke all modal
  const [showRevokeAll, setShowRevokeAll] = useState(false);
  const [password, setPassword] = useState('');

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setIsLoading(true);
      const response = await trustedDevicesApi.getDevices();
      if (response.success && response.data) {
        setDevices(response.data.devices);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load trusted devices'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeDevice = async (deviceId: number) => {
    if (!confirm('Are you sure you want to revoke this device? You will need to complete 2FA on next login from this device.')) {
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await trustedDevicesApi.revokeDevice(deviceId);
      if (response.success) {
        setSuccess('Device revoked successfully');
        loadDevices();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to revoke device'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevokeAll = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      setIsSubmitting(true);
      const response = await trustedDevicesApi.revokeAll(password);
      if (response.success) {
        setSuccess(`All devices revoked successfully (${response.data?.revokedCount || 0} devices)`);
        setShowRevokeAll(false);
        setPassword('');
        loadDevices();
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to revoke all devices'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const isExpiringSoon = (expiresAt: string) => {
    const daysUntilExpiry = Math.ceil(
      (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    return daysUntilExpiry <= 3;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <button
            onClick={() => navigate('/security')}
            className="text-sm text-primary hover:text-blue-700 mb-4"
          >
            ← Back to Security Settings
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Trusted Devices</h1>
          <p className="mt-2 text-sm text-gray-600">
            Manage devices that can skip 2FA for 30 days. Remove devices to require 2FA on next login.
          </p>
        </div>

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

        {/* Revoke All Modal */}
        {showRevokeAll && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Revoke All Trusted Devices
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                This will remove trust from all devices. You'll need to complete 2FA on next login from any device.
              </p>
              <form onSubmit={handleRevokeAll}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Confirm with your password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-primary focus:border-primary"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
                  >
                    {isSubmitting ? 'Revoking...' : 'Revoke All'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowRevokeAll(false);
                      setPassword('');
                    }}
                    className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Devices List */}
        <div className="bg-white shadow rounded-lg">
          <div className="p-6 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900">
                {devices.length} Trusted Device{devices.length !== 1 ? 's' : ''}
              </h2>
              {devices.length > 0 && (
                <button
                  onClick={() => setShowRevokeAll(true)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                >
                  Revoke All Devices
                </button>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-200">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading devices...</p>
              </div>
            ) : devices.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-gray-500">No trusted devices</p>
                <p className="text-sm text-gray-400 mt-2">
                  Devices are automatically added when you choose to trust them during 2FA verification
                </p>
              </div>
            ) : (
              devices.map((device) => (
                <div key={device.id} className="p-6 hover:bg-gray-50">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="text-lg font-medium text-gray-900">
                          {device.deviceName || 'Unknown Device'}
                        </h3>
                        {device.isCurrent && (
                          <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded">
                            Current Device
                          </span>
                        )}
                        {isExpiringSoon(device.expiresAt) && (
                          <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                            Expiring Soon
                          </span>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-gray-600">
                        <p>
                          <span className="font-medium">IP Address:</span> {device.ipAddress || 'Unknown'}
                        </p>
                        <p>
                          <span className="font-medium">Trusted Since:</span> {formatDate(device.trustedAt)}
                        </p>
                        <p>
                          <span className="font-medium">Last Used:</span> {formatDate(device.lastUsedAt)}
                        </p>
                        <p>
                          <span className="font-medium">Expires:</span> {formatDate(device.expiresAt)}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRevokeDevice(device.id)}
                      disabled={isSubmitting}
                      className="ml-4 px-4 py-2 text-sm text-red-600 hover:text-red-800 font-medium disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            ℹ️ About Trusted Devices
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Trusted devices can skip 2FA for 30 days</li>
            <li>• Each device is identified by browser, IP, and other factors</li>
            <li>• Revoke a device to require 2FA on next login</li>
            <li>• Devices automatically expire after 30 days of being trusted</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
