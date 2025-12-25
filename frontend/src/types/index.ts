// User type
export interface User {
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
  created_at: string;
}

// API response type
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Auth forms
export interface RegisterFormData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface LoginFormData {
  email: string;
  password: string;
}
