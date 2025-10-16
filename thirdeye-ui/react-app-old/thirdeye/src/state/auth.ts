import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface User {
  id: string;
  email: string;
  name?: string | null;
  role: string;
  status: string;
  emailVerified: boolean;
  lastLoginAt?: Date | null;
  lastLoginIp?: string | null;
  twoFactorEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  expiresAt: number | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isRefreshing: boolean;
}

interface AuthActions {
  setAuth: (user: User, accessToken: string, refreshToken: string, expiresIn?: number) => void;
  clearAuth: () => void;
  updateUser: (user: Partial<User>) => void;
  setLoading: (loading: boolean) => void;
  setRefreshing: (refreshing: boolean) => void;
}

interface AuthStore extends AuthState, AuthActions {}

export const useAuth = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      expiresAt: null,
      isAuthenticated: false,
      isLoading: false,
      isRefreshing: false,

      setAuth: (user, accessToken, refreshToken, expiresIn = 3600) => {
        const expiresAt = Date.now() + (expiresIn * 1000);
        set({
          user,
          accessToken,
          refreshToken,
          expiresAt,
          isAuthenticated: true,
          isLoading: false,
          isRefreshing: false,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          expiresAt: null,
          isAuthenticated: false,
          isLoading: false,
          isRefreshing: false,
        });
      },

      updateUser: (userUpdate) => {
        const currentUser = get().user;
        if (currentUser) {
          set({
            user: { ...currentUser, ...userUpdate },
          });
        }
      },

      setLoading: (loading) => {
        set({ isLoading: loading });
      },

      setRefreshing: (refreshing) => {
        set({ isRefreshing: refreshing });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        expiresAt: state.expiresAt,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

export const useAuthActions = useAuth;

// Helper functions to get tokens
export const getAccessToken = () => useAuth.getState().accessToken;
export const getRefreshToken = () => useAuth.getState().refreshToken;

// Export combined store for convenience
export const useAuthStore = useAuth;