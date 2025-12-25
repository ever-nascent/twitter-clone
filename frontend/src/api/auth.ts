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
};

// Interceptor to handle 401 errors (token expiration)
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

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
