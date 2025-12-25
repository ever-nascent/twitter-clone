import axios from 'axios';
import { ApiResponse, User, RegisterFormData, LoginFormData } from '../types';

// Create axios instance with default config
const api = axios.create({
  baseURL: '/api',
  withCredentials: true, // Send cookies with requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// CSRF token storage
let csrfToken: string | null = null;

/**
 * Fetch CSRF token from server
 * Should be called on app initialization
 */
export const fetchCsrfToken = async (): Promise<void> => {
  try {
    const response = await api.get('/csrf-token');
    csrfToken = response.data.csrfToken;
  } catch (error) {
    console.error('Failed to fetch CSRF token:', error);
    // Don't throw - allow app to continue, requests will fail with proper error
  }
};

/**
 * Get current CSRF token
 */
export const getCsrfToken = (): string | null => csrfToken;

// Request interceptor to add CSRF token to all state-changing requests
api.interceptors.request.use(
  (config) => {
    // Add CSRF token to POST, PUT, DELETE, PATCH requests
    if (
      csrfToken &&
      config.method &&
      ['post', 'put', 'delete', 'patch'].includes(config.method.toLowerCase())
    ) {
      config.headers['x-csrf-token'] = csrfToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth API
export const authApi = {
  // Register new user
  register: async (data: RegisterFormData): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.post('/auth/register', data);
    return response.data;
  },

  // Login user
  login: async (data: LoginFormData): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.post('/auth/login', data);
    return response.data;
  },

  // Logout user
  logout: async (): Promise<ApiResponse> => {
    const response = await api.post('/auth/logout');
    return response.data;
  },

  // Get current user
  getCurrentUser: async (): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get('/auth/me');
    return response.data;
  },

  // Refresh access token
  refreshToken: async (): Promise<ApiResponse> => {
    const response = await api.post('/auth/refresh');
    return response.data;
  },

  // Verify email
  verifyEmail: async (token: string): Promise<ApiResponse> => {
    const response = await api.post('/auth/verify-email', { token });
    return response.data;
  },

  // Resend verification email
  resendVerification: async (email: string): Promise<ApiResponse> => {
    const response = await api.post('/auth/resend-verification', { email });
    return response.data;
  },

  // Request password reset
  forgotPassword: async (email: string): Promise<ApiResponse> => {
    const response = await api.post('/auth/forgot-password', { email });
    return response.data;
  },

  // Reset password with token
  resetPassword: async (token: string, newPassword: string): Promise<ApiResponse> => {
    const response = await api.post('/auth/reset-password', { token, newPassword });
    return response.data;
  },
};

// Response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Handle CSRF token errors - refetch token and retry
    if (error.response?.status === 403 && error.response?.data?.error?.includes('CSRF')) {
      console.warn('CSRF token invalid, refetching...');
      await fetchCsrfToken();

      // Retry the request with new CSRF token
      if (csrfToken) {
        originalRequest.headers['x-csrf-token'] = csrfToken;
        return api(originalRequest);
      }
    }

    // Handle 401 errors (token expiration)
    // Don't retry if:
    // 1. Already retried
    // 2. Request was to /auth/refresh (avoid infinite loop)
    // 3. Request was to /auth/login or /auth/register
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/auth/refresh') &&
      !originalRequest.url?.includes('/auth/login') &&
      !originalRequest.url?.includes('/auth/register')
    ) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        await api.post('/auth/refresh');

        // Retry original request
        return api(originalRequest);
      } catch (refreshError) {
        // Refresh failed, just reject (don't redirect here to avoid loops)
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
