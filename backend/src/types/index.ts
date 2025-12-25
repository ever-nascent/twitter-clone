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
  created_at: Date;
}

// Tweet type
export interface Tweet {
  id: number;
  user_id: number;
  content: string;
  reply_to_tweet_id: number | null;
  retweet_of_tweet_id: number | null;
  likes_count: number;
  retweets_count: number;
  replies_count: number;
  created_at: Date;
  updated_at: Date;
}

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
