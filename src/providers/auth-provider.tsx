'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { trpc } from '@/utils/trpc';

interface User {
  id: string;
  email: string;
  fullName: string | null;
  name?: string; // For compatibility with app-header
  role: 'owner' | 'admin' | 'manager' | 'user' | 'guest';
  tenantId: string | null;
  permissions: readonly string[]; // This is the correct type
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

// Helper function to safely map API data to the User interface
const mapApiDataToUser = (apiUser: any): User => {
  return {
    id: apiUser.id,
    email: apiUser.email ?? '', // Fallback for safety
    fullName: apiUser.fullName ?? null, // Fallback for safety
    role: apiUser.role,
    tenantId: apiUser.tenantId ?? null,
    permissions: apiUser.permissions ?? [],
  };
};

interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (data: {
    email: string;
    password: string;
    fullName: string;
    tenantName?: string;
    role?: 'owner' | 'admin' | 'manager' | 'user';
  }) => Promise<void>;
  logout: () => void;
  getCurrentRole: () => string;
  refreshUserData: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false); // Prevents refresh loops

  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const refreshTokenMutation = trpc.auth.refreshToken.useMutation(); // <-- ADD THIS
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!accessToken && !user,
    retry: false, // Important: we handle retries manually with our refresh logic
  });

  useEffect(() => {
    const initializeAuth = async () => {
      const savedAuth = localStorage.getItem('auth-data');
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth);
          if (authData.accessToken) {
            setAccessToken(authData.accessToken);
            return;
          }
        } catch (error) {
          console.error('Error parsing saved auth data:', error);
          localStorage.removeItem('auth-data');
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  useEffect(() => {
    if (accessToken && !meQuery.isFetching && !meQuery.isLoading) {
      setIsLoading(false);
    }
  }, [accessToken, meQuery.isFetching, meQuery.isLoading]);

  useEffect(() => {
    if (meQuery.data) {
      setUser(mapApiDataToUser(meQuery.data.user));
      setTenant(meQuery.data.tenant);
    }
  }, [meQuery.data]);

  // --- START: THE FIX - UPGRADED ERROR HANDLING ---
  // This effect now handles expired tokens by attempting a silent refresh.
  useEffect(() => {
    const handleAuthError = async () => {
      if (isRefreshing) return; // Don't try to refresh if we already are
      setIsRefreshing(true);

      console.log('🔒 Auth validation failed, attempting to refresh session...');
      const savedAuth = localStorage.getItem('auth-data');

      if (savedAuth) {
        try {
          const { refreshToken } = JSON.parse(savedAuth);
          if (refreshToken) {
            // Call the new tRPC mutation to get a new session
            const newSession = await refreshTokenMutation.mutateAsync({ refreshToken });

            console.log('✅ Session refreshed successfully.');
            // 1. Update the access token in state. This will cause the `meQuery`
            //    to automatically re-run because its `enabled` flag will be met.
            setAccessToken(newSession.accessToken);

            // 2. Update localStorage with both new tokens
            localStorage.setItem('auth-data', JSON.stringify({
              accessToken: newSession.accessToken,
              refreshToken: newSession.refreshToken,
            }));
            
            setIsRefreshing(false);
            return; // Exit successfully
          }
        } catch (refreshError) {
          console.error('🔴 Session refresh failed:', refreshError);
        }
      }

      // If refresh fails or no refresh token is found, then log out.
      console.log('Could not refresh session, logging out.');
      logout();
      setIsRefreshing(false);
    };

    // Only run the handler if there's an error and we're not already trying to refresh.
    if (meQuery.error && !isRefreshing) {
      handleAuthError();
    }
  }, [meQuery.error, isRefreshing]); // Add isRefreshing to dependencies
  // --- END: THE FIX ---

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });
      
      setUser(mapApiDataToUser(result.user));
      setTenant(result.tenant);
      setAccessToken(result.accessToken);

      // Store both tokens upon login
      localStorage.setItem('auth-data', JSON.stringify({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      }));
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const signup = async (data: {
    email: string;
    password: string;
    fullName: string;
    tenantName?: string;
    role?: 'owner' | 'admin' | 'manager' | 'user';
  }): Promise<void> => {
    try {
      const result = await signupMutation.mutateAsync(data);
      setUser(mapApiDataToUser(result.user));
      setTenant(result.tenant);
      localStorage.removeItem('auth-data');
    } catch (error) {
      console.error('Signup failed:', error);
      throw error;
    }
  };

  const logout = () => {
    setUser(null);
    setTenant(null);
    setAccessToken(null);
    localStorage.removeItem('auth-data');
  };

  const refreshUserData = async () => {
    if (!accessToken) return;
    try {
      const result = await meQuery.refetch();
      if (result.data) {
        setUser(mapApiDataToUser(result.data.user));
        setTenant(result.data.tenant);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // The error handling useEffect will catch this and attempt a refresh
    }
  };

  const isAuthenticated = !!user;
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isManager = user?.role === 'manager' || isAdmin;

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    return user.permissions.some(p => {
      if (p === permission) return true;
      if (p.endsWith(':*') && permission.startsWith(p.slice(0, -1))) return true;
      return false;
    });
  };

  const getCurrentRole = (): string => user?.role || 'guest';

  const value: AuthContextType = {
    user,
    tenant,
    isAuthenticated,
    isOwner,
    isAdmin,
    isManager,
    isLoading: isLoading || loginMutation.isPending || signupMutation.isPending || meQuery.isFetching,
    hasPermission,
    login,
    signup,
    logout,
    getCurrentRole,
    refreshUserData,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}