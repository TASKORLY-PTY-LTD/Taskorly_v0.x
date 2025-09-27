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
  tenantId: string;
  permissions: string[];
}

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

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

  // tRPC mutations and queries
  const loginMutation = trpc.auth.login.useMutation();
  const signupMutation = trpc.auth.signup.useMutation();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    enabled: !!accessToken && !user,
    retry: false,
  });

  // Load user from localStorage on mount
  useEffect(() => {
    const initializeAuth = async () => {
      const savedAuth = localStorage.getItem('auth-data');
      if (savedAuth) {
        try {
          const authData = JSON.parse(savedAuth);

          // If we have a token, we'll let the meQuery validate it
          // If the token is expired, the meQuery will fail and we'll handle it
          if (authData.accessToken) {
            setAccessToken(authData.accessToken);
            // Don't set user/tenant immediately - let meQuery validate the token first
          } else {
            // No token, so we can't be authenticated
            setUser(null);
            setTenant(null);
          }
        } catch (error) {
          console.error('Error parsing saved auth data:', error);
          localStorage.removeItem('auth-data');
        }
      }
      // Only set isLoading false after initializing auth
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  // Auto-fetch user data when we have a token but no user
  useEffect(() => {
    if (meQuery.data) {
      setUser({
        ...meQuery.data.user,
        role: meQuery.data.user.role as
          | 'owner'
          | 'admin'
          | 'manager'
          | 'user'
          | 'guest',
        permissions: [...meQuery.data.user.permissions],
      });
      setTenant(meQuery.data.tenant);
    }
  }, [meQuery.data]);

  // Handle meQuery errors (e.g., expired token)
  useEffect(() => {
    if (meQuery.error) {
      console.log('🔒 Auth validation failed, clearing auth data');
      // Clear auth data and reset state
      setUser(null);
      setTenant(null);
      setAccessToken(null);
      localStorage.removeItem('auth-data');
    }
  }, [meQuery.error]);

  const isAuthenticated = !!user;
  const isOwner = user?.role === 'owner';
  const isAdmin = user?.role === 'admin' || user?.role === 'owner';
  const isManager =
    user?.role === 'manager' ||
    user?.role === 'admin' ||
    user?.role === 'owner';

  const hasPermission = (permission: string): boolean => {
    if (!user) return false;

    // Owner and Admin have all permissions
    if (user.role === 'owner' || user.role === 'admin') return true;

    // Check specific permissions
    return user.permissions.some(p => {
      if (p === permission) return true;
      if (p.endsWith(':*') && permission.startsWith(p.slice(0, -1)))
        return true;
      return false;
    });
  };

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const result = await loginMutation.mutateAsync({ email, password });

      const authData = {
        user: result.user,
        tenant: result.tenant,
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      };

      setUser({
        ...result.user,
        role: result.user.role as
          | 'owner'
          | 'admin'
          | 'manager'
          | 'user'
          | 'guest',
        permissions: [...result.user.permissions],
      });
      setTenant(result.tenant);
      setAccessToken(result.accessToken);

      localStorage.setItem('auth-data', JSON.stringify(authData));
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

      const authData = {
        user: result.user,
        tenant: result.tenant,
        accessToken: null, // Signup doesn't return tokens
        refreshToken: null,
      };

      setUser({
        ...result.user,
        role: result.user.role as
          | 'owner'
          | 'admin'
          | 'manager'
          | 'user'
          | 'guest',
        permissions: [...result.user.permissions],
      });
      setTenant(result.tenant);

      localStorage.setItem('auth-data', JSON.stringify(authData));
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
      // This would trigger the meQuery to refetch
      const result = await meQuery.refetch();
      if (result.data) {
        setUser({
          ...result.data.user,
          role: result.data.user.role as
            | 'owner'
            | 'admin'
            | 'manager'
            | 'user'
            | 'guest',
          permissions: [...result.data.user.permissions],
        });
        setTenant(result.data.tenant);
      }
    } catch (error) {
      console.error('Failed to refresh user data:', error);
      // If refresh fails, logout the user
      logout();
    }
  };

  const getCurrentRole = (): string => {
    return user?.role || 'guest';
  };

  const value: AuthContextType = {
    user,
    tenant,
    isAuthenticated,
    isOwner,
    isAdmin,
    isManager,
    isLoading:
      isLoading ||
      loginMutation.isPending ||
      signupMutation.isPending ||
      meQuery.isFetching,
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
