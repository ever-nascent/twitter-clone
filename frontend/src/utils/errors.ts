/**
 * Type-safe error handling utilities
 *
 * SECURITY: Proper error typing prevents information leakage
 * and ensures consistent error handling across the application
 */

/**
 * Check if error is an Axios error with response data
 */
export function isAxiosError(error: unknown): error is { response?: { data?: { error?: string } } } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  );
}

/**
 * Extract error message from unknown error type
 * Safely handles various error formats (axios, Error, string, etc.)
 */
export function getErrorMessage(error: unknown, fallback = 'An unexpected error occurred'): string {
  // Axios error with response data
  if (isAxiosError(error) && error.response?.data?.error) {
    return error.response.data.error;
  }

  // Standard Error object
  if (error instanceof Error) {
    return error.message;
  }

  // String error
  if (typeof error === 'string') {
    return error;
  }

  // Unknown error type
  return fallback;
}
