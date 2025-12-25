import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary">Twitter Clone</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">
                Welcome, <strong>{user?.display_name || user?.username}</strong>!
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Welcome to Twitter Clone!
            </h2>
            <p className="text-gray-600 mb-4">
              You're now logged in. This is the home page where your tweet feed will appear.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">User Info:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li><strong>Username:</strong> {user?.username}</li>
                <li><strong>Display Name:</strong> {user?.display_name || 'Not set'}</li>
                <li><strong>Bio:</strong> {user?.bio || 'No bio yet'}</li>
                <li><strong>Verified:</strong> {user?.verified ? 'Yes' : 'No'}</li>
                <li><strong>Member since:</strong> {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'Unknown'}</li>
              </ul>
            </div>

            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 mb-2">Next Steps:</h3>
              <ul className="list-disc list-inside text-gray-600 space-y-1">
                <li>Tweet creation functionality</li>
                <li>Timeline/feed display</li>
                <li>Follow/unfollow users</li>
                <li>Like and retweet features</li>
                <li>User profiles</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
