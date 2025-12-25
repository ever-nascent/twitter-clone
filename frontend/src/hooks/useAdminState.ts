import { useReducer, useCallback } from 'react';
import { User, UserStats } from '../api/admin';

/**
 * Admin Page State Management
 *
 * CODE QUALITY: Consolidate 17+ useState hooks into a single useReducer
 *
 * Benefits:
 * - Single source of truth for all admin page state
 * - Predictable state updates with actions
 * - Easier to test and debug
 * - Better performance (fewer re-renders)
 * - Industry standard pattern (Redux-like)
 *
 * References:
 * - React docs: useReducer for complex state
 * - Kent C. Dodds: Application State Management
 */

// State interface
export interface AdminState {
  // Data
  users: User[];
  stats: UserStats | null;
  totalPages: number;

  // Pagination & Search
  page: number;
  search: string;

  // UI State
  loading: boolean;
  error: string;
  success: string;

  // Edit Mode
  editMode: boolean;
  selectedUser: User | null;
  editData: Partial<User>;

  // Password Reset Mode
  resetPasswordMode: boolean;
  resetPasswordUser: { id: number; username: string } | null;
  newPassword: string;
  confirmPassword: string;
  passwordValidation: {
    minLength: boolean;
    hasUppercase: boolean;
    hasLowercase: boolean;
    hasNumber: boolean;
    hasSpecialChar: boolean;
    passwordsMatch: boolean;
  };
}

// Action types
type AdminAction =
  | { type: 'SET_USERS'; payload: User[] }
  | { type: 'SET_STATS'; payload: UserStats }
  | { type: 'SET_TOTAL_PAGES'; payload: number }
  | { type: 'SET_PAGE'; payload: number }
  | { type: 'SET_SEARCH'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'SET_SUCCESS'; payload: string }
  | { type: 'CLEAR_MESSAGES' }
  | { type: 'OPEN_EDIT_MODE'; payload: User }
  | { type: 'CLOSE_EDIT_MODE' }
  | { type: 'UPDATE_EDIT_DATA'; payload: Partial<User> }
  | { type: 'OPEN_RESET_PASSWORD'; payload: { id: number; username: string } }
  | { type: 'CLOSE_RESET_PASSWORD' }
  | { type: 'SET_NEW_PASSWORD'; payload: string }
  | { type: 'SET_CONFIRM_PASSWORD'; payload: string }
  | { type: 'UPDATE_PASSWORD_VALIDATION'; payload: AdminState['passwordValidation'] };

// Initial state
const initialState: AdminState = {
  users: [],
  stats: null,
  totalPages: 1,
  page: 1,
  search: '',
  loading: true,
  error: '',
  success: '',
  editMode: false,
  selectedUser: null,
  editData: {},
  resetPasswordMode: false,
  resetPasswordUser: null,
  newPassword: '',
  confirmPassword: '',
  passwordValidation: {
    minLength: false,
    hasUppercase: false,
    hasLowercase: false,
    hasNumber: false,
    hasSpecialChar: false,
    passwordsMatch: false,
  },
};

// Reducer
function adminReducer(state: AdminState, action: AdminAction): AdminState {
  switch (action.type) {
    case 'SET_USERS':
      return { ...state, users: action.payload };

    case 'SET_STATS':
      return { ...state, stats: action.payload };

    case 'SET_TOTAL_PAGES':
      return { ...state, totalPages: action.payload };

    case 'SET_PAGE':
      return { ...state, page: action.payload };

    case 'SET_SEARCH':
      return { ...state, search: action.payload, page: 1 }; // Reset to page 1 on search

    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, success: '' }; // Clear success on error

    case 'SET_SUCCESS':
      return { ...state, success: action.payload, error: '' }; // Clear error on success

    case 'CLEAR_MESSAGES':
      return { ...state, error: '', success: '' };

    case 'OPEN_EDIT_MODE':
      return {
        ...state,
        editMode: true,
        selectedUser: action.payload,
        editData: {
          username: action.payload.username,
          email: action.payload.email,
          display_name: action.payload.display_name,
          bio: action.payload.bio,
          location: action.payload.location,
          website: action.payload.website,
          verified: action.payload.verified,
          email_verified: action.payload.email_verified,
        },
      };

    case 'CLOSE_EDIT_MODE':
      return {
        ...state,
        editMode: false,
        selectedUser: null,
        editData: {},
      };

    case 'UPDATE_EDIT_DATA':
      return {
        ...state,
        editData: { ...state.editData, ...action.payload },
      };

    case 'OPEN_RESET_PASSWORD':
      return {
        ...state,
        resetPasswordMode: true,
        resetPasswordUser: action.payload,
        newPassword: '',
        confirmPassword: '',
      };

    case 'CLOSE_RESET_PASSWORD':
      return {
        ...state,
        resetPasswordMode: false,
        resetPasswordUser: null,
        newPassword: '',
        confirmPassword: '',
        passwordValidation: initialState.passwordValidation,
      };

    case 'SET_NEW_PASSWORD':
      return { ...state, newPassword: action.payload };

    case 'SET_CONFIRM_PASSWORD':
      return { ...state, confirmPassword: action.payload };

    case 'UPDATE_PASSWORD_VALIDATION':
      return { ...state, passwordValidation: action.payload };

    default:
      return state;
  }
}

// Custom hook
export function useAdminState() {
  const [state, dispatch] = useReducer(adminReducer, initialState);

  // Memoized action creators for better performance
  const actions = {
    setUsers: useCallback((users: User[]) => {
      dispatch({ type: 'SET_USERS', payload: users });
    }, []),

    setStats: useCallback((stats: UserStats) => {
      dispatch({ type: 'SET_STATS', payload: stats });
    }, []),

    setTotalPages: useCallback((totalPages: number) => {
      dispatch({ type: 'SET_TOTAL_PAGES', payload: totalPages });
    }, []),

    setPage: useCallback((page: number) => {
      dispatch({ type: 'SET_PAGE', payload: page });
    }, []),

    setSearch: useCallback((search: string) => {
      dispatch({ type: 'SET_SEARCH', payload: search });
    }, []),

    setLoading: useCallback((loading: boolean) => {
      dispatch({ type: 'SET_LOADING', payload: loading });
    }, []),

    setError: useCallback((error: string) => {
      dispatch({ type: 'SET_ERROR', payload: error });
    }, []),

    setSuccess: useCallback((success: string) => {
      dispatch({ type: 'SET_SUCCESS', payload: success });
    }, []),

    clearMessages: useCallback(() => {
      dispatch({ type: 'CLEAR_MESSAGES' });
    }, []),

    openEditMode: useCallback((user: User) => {
      dispatch({ type: 'OPEN_EDIT_MODE', payload: user });
    }, []),

    closeEditMode: useCallback(() => {
      dispatch({ type: 'CLOSE_EDIT_MODE' });
    }, []),

    updateEditData: useCallback((data: Partial<User>) => {
      dispatch({ type: 'UPDATE_EDIT_DATA', payload: data });
    }, []),

    openResetPassword: useCallback((user: { id: number; username: string }) => {
      dispatch({ type: 'OPEN_RESET_PASSWORD', payload: user });
    }, []),

    closeResetPassword: useCallback(() => {
      dispatch({ type: 'CLOSE_RESET_PASSWORD' });
    }, []),

    setNewPassword: useCallback((password: string) => {
      dispatch({ type: 'SET_NEW_PASSWORD', payload: password });
    }, []),

    setConfirmPassword: useCallback((password: string) => {
      dispatch({ type: 'SET_CONFIRM_PASSWORD', payload: password });
    }, []),

    updatePasswordValidation: useCallback((validation: AdminState['passwordValidation']) => {
      dispatch({ type: 'UPDATE_PASSWORD_VALIDATION', payload: validation });
    }, []),
  };

  return { state, actions };
}
