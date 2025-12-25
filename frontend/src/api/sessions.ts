import { ApiResponse } from '../types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export interface Session {
  id: number;
  deviceInfo: string | null;
  ipAddress: string | null;
  location: string | null;
  lastActiveAt: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export const sessionApi = {
  /**
   * Get all active sessions for the current user
   */
  getSessions: async (): Promise<ApiResponse<{ sessions: Session[] }>> => {
    try {
      const response = await fetch(`${API_URL}/api/sessions`, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch sessions',
      };
    }
  },

  /**
   * Delete a specific session (remote logout)
   */
  deleteSession: async (sessionId: number): Promise<ApiResponse> => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete session',
      };
    }
  },

  /**
   * Delete all other sessions (logout from all other devices)
   */
  deleteOtherSessions: async (): Promise<ApiResponse<{ deletedCount: number }>> => {
    try {
      const response = await fetch(`${API_URL}/api/sessions/others/all`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete sessions',
      };
    }
  },
};
