import axios from 'axios';
import { ApiResponse } from '../types';
import { getCsrfToken } from './auth';

// API v1: Using versioned API endpoints for future compatibility
const api = axios.create({
  baseURL: '/api/v1/admin',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add CSRF token to all state-changing requests
api.interceptors.request.use(
  (config) => {
    const csrfToken = getCsrfToken();
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

export interface User {
  id: number;
  username: string;
  email: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  email_verified: boolean;
  failed_login_attempts: number;
  locked_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  total_users: string;
  verified_users: string;
  unverified_users: string;
  locked_users: string;
  new_users_24h: string;
  new_users_7d: string;
}

export const adminApi = {
  // Get all users
  getUsers: async (page = 1, limit = 20, search = ''): Promise<ApiResponse<{ users: User[]; pagination: any }>> => {
    const response = await api.get('/users', {
      params: { page, limit, search },
    });
    return response.data;
  },

  // Get user by ID
  getUser: async (id: number): Promise<ApiResponse<{ user: User }>> => {
    const response = await api.get(`/users/${id}`);
    return response.data;
  },

  // Update user
  updateUser: async (id: number, data: Partial<User>): Promise<ApiResponse> => {
    const response = await api.put(`/users/${id}`, data);
    return response.data;
  },

  // Delete user
  deleteUser: async (id: number): Promise<ApiResponse> => {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  },

  // Unlock user account
  unlockUser: async (id: number): Promise<ApiResponse> => {
    const response = await api.post(`/users/${id}/unlock`);
    return response.data;
  },

  // Verify user email
  verifyEmail: async (id: number): Promise<ApiResponse> => {
    const response = await api.post(`/users/${id}/verify-email`);
    return response.data;
  },

  // Reset user password
  resetPassword: async (id: number, newPassword: string): Promise<ApiResponse> => {
    const response = await api.post(`/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  // Get statistics
  getStats: async (): Promise<ApiResponse<{ stats: UserStats }>> => {
    const response = await api.get('/stats');
    return response.data;
  },
};
