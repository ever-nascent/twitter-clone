import { Request } from 'express';

// User type (matches database schema)
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  profile_image_url: string | null;
  banner_image_url: string | null;
  verified: boolean;
  is_admin: boolean;
  email_verified: boolean;
  email_verification_token: string | null;
  email_verification_expires: Date | null;
  password_reset_token: string | null;
  password_reset_expires: Date | null;
  failed_login_attempts: number;
  locked_until: Date | null;
  created_at: Date;
  updated_at: Date;
}

// Public user type (without sensitive data)
export interface PublicUser {
  id: number;
  username: string;
  display_name: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  profile_image_url: string | null;
  banner_image_url: string | null;
  verified: boolean;
  is_admin: boolean;
  email_verified: boolean;
  created_at: Date;
}

// Post type (formerly Tweet)
export interface Post {
  id: number;
  user_id: number;
  content: string;
  reply_to_post_id: number | null;
  repost_of_post_id: number | null;
  likes_count: number;
  reposts_count: number;
  replies_count: number;
  created_at: Date;
  updated_at: Date;
}

// Legacy alias for backwards compatibility (deprecated)
export type Tweet = Post;

// Extended Express Request with user
export interface AuthRequest extends Request {
  user?: {
    userId: number;
    username: string;
  };
}

// Auth payload for JWT
export interface JWTPayload {
  userId: number;
  username: string;
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Registration request
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

// Login request
export interface LoginRequest {
  email: string;
  password: string;
}
