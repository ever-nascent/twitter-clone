import { getErrorMessage } from '../utils/errors';
import { useState, useEffect } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth';

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [isVerifying, setIsVerifying] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      if (!token) {
        setError('Invalid verification link. Please check your email for the correct link.');
        setIsVerifying(false);
        return;
      }

      try {
        const response = await authApi.verifyEmail(token);

        if (response.success) {
          setSuccess(true);
          // Redirect to login after 3 seconds
          setTimeout(() => {
            navigate('/login');
          }, 3000);
        } else {
          setError(response.error || 'Failed to verify email');
        }
      } catch (err: unknown) {
        setError(getErrorMessage(err, 'Failed to verify email. The link may have expired.'));
      } finally {
        setIsVerifying(false);
      }
    };

    verifyEmail();
  }, [token, navigate]);

  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto"></div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Verifying your email...
          </h2>
          <p className="text-gray-600">Please wait a moment.</p>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-green-100">
              <svg
                className="h-10 w-10 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
              Email verified successfully!
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Your email has been verified. You can now log in to your account.
            </p>
            <p className="mt-2 text-sm text-gray-500">
              Redirecting to login...
            </p>
            <div className="mt-6">
              <Link
                to="/login"
                className="font-medium text-primary hover:text-blue-500"
              >
                Go to login now
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-16 w-16 flex items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-10 w-10 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Verification failed
          </h2>
          <div className="mt-2 rounded-md bg-red-50 p-4">
            <p className="text-sm text-red-800">{error}</p>
          </div>
          <div className="mt-6 space-y-4">
            <p className="text-sm text-gray-600">
              The verification link may have expired or is invalid.
            </p>
            <div>
              <Link
                to="/login"
                className="font-medium text-primary hover:text-blue-500"
              >
                Go to login
              </Link>
              <span className="mx-2 text-gray-300">|</span>
              <Link
                to="/register"
                className="font-medium text-primary hover:text-blue-500"
              >
                Create new account
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
