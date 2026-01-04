import { useEffect, useState } from 'react';

interface Service {
  name: string;
  status: 'available' | 'unavailable' | 'degraded';
  description?: string;
}

interface StatusData {
  overallStatus: 'available' | 'unavailable' | 'degraded';
  lastUpdated: string;
  services: {
    [category: string]: Service[];
  };
}

export default function StatusPage() {
  const [status, setStatus] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/status');
      const data = await response.json();

      if (data.success) {
        setStatus(data.data);
        setError(null);
      } else {
        setError('Failed to fetch status');
      }
    } catch (err) {
      setError('Unable to connect to server');
      console.error('Status fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();

    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchStatus, 60000);

    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-green-500';
      case 'degraded':
        return 'bg-yellow-500';
      case 'unavailable':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'available':
        return 'Available';
      case 'degraded':
        return 'Degraded Performance';
      case 'unavailable':
        return 'Unavailable';
      default:
        return 'Unknown';
    }
  };

  const getOverallStatusMessage = (status: string) => {
    switch (status) {
      case 'available':
        return 'All Systems Operational';
      case 'degraded':
        return 'Some Systems Experiencing Issues';
      case 'unavailable':
        return 'Service Disruption';
      default:
        return 'Status Unknown';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading status...</div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-2">⚠️ {error}</div>
          <button
            onClick={fetchStatus}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">System Status</h1>
          <div className="text-sm text-gray-500">
            Last updated{' '}
            {new Date(status.lastUpdated).toLocaleString('en-US', {
              hour: 'numeric',
              minute: '2-digit',
              hour12: true,
              timeZoneName: 'short',
            })}
          </div>
        </div>

        {/* Overall Status Banner */}
        <div
          className={`mb-8 p-6 rounded-lg ${
            status.overallStatus === 'available'
              ? 'bg-green-50 border border-green-200'
              : status.overallStatus === 'degraded'
              ? 'bg-yellow-50 border border-yellow-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          <div className="flex items-center justify-center">
            <div
              className={`w-3 h-3 rounded-full ${getStatusColor(
                status.overallStatus
              )} mr-3`}
            ></div>
            <div
              className={`text-xl font-semibold ${
                status.overallStatus === 'available'
                  ? 'text-green-800'
                  : status.overallStatus === 'degraded'
                  ? 'text-yellow-800'
                  : 'text-red-800'
              }`}
            >
              {getOverallStatusMessage(status.overallStatus)}
            </div>
          </div>
        </div>

        {/* Services by Category */}
        <div className="space-y-6">
          {Object.entries(status.services).map(([category, services]) => (
            <div key={category} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">{category}</h2>
              </div>
              <div className="divide-y divide-gray-100">
                {services.map((service) => (
                  <div key={service.name} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                    <div className="flex items-center flex-1">
                      <div
                        className={`w-2.5 h-2.5 rounded-full ${getStatusColor(
                          service.status
                        )} mr-4 flex-shrink-0`}
                      ></div>
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{service.name}</div>
                        {service.description && (
                          <div className="text-sm text-gray-500 mt-0.5">
                            {service.description}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="ml-4 flex-shrink-0">
                      <span
                        className={`text-sm font-medium ${
                          service.status === 'available'
                            ? 'text-green-700'
                            : service.status === 'degraded'
                            ? 'text-yellow-700'
                            : 'text-red-700'
                        }`}
                      >
                        {getStatusText(service.status)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-sm text-gray-500">
          <p>
            If you are experiencing an issue not listed here,{' '}
            <a href="/contact" className="text-blue-600 hover:text-blue-800">
              contact support
            </a>
            .
          </p>
          <p className="mt-2">
            This page automatically refreshes every 60 seconds.
          </p>
        </div>
      </div>
    </div>
  );
}
