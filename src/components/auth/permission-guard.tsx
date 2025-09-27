'use client';

import { useAuth } from '@/providers/auth-provider';
import { ReactNode } from 'react';

interface PermissionGuardProps {
  children: ReactNode;
  permission?: string;
  role?: 'owner' | 'admin' | 'manager' | 'user' | 'guest';
  roles?: ('owner' | 'admin' | 'manager' | 'user' | 'guest')[];
  fallback?: ReactNode;
  requireAuth?: boolean;
}

export function PermissionGuard({
  children,
  permission,
  role,
  roles,
  fallback = null,
  requireAuth = false,
}: PermissionGuardProps) {
  const { user, hasPermission, isAuthenticated } = useAuth();

  // If requireAuth is true and user is not authenticated
  if (requireAuth && !isAuthenticated) {
    return <>{fallback}</>;
  }

  // If specific permission is required
  if (permission && !hasPermission(permission)) {
    return <>{fallback}</>;
  }

  // If specific role is required
  if (role && user?.role !== role) {
    return <>{fallback}</>;
  }

  // If one of multiple roles is required
  if (roles && roles.length > 0 && (!user || !roles.includes(user.role))) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}

// Convenience components for common use cases
export function AdminOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard roles={['owner', 'admin']} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function ManagerOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard roles={['owner', 'admin', 'manager']} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

export function AuthOnly({
  children,
  fallback,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <PermissionGuard requireAuth={true} fallback={fallback}>
      {children}
    </PermissionGuard>
  );
}

// Hook for conditional logic in components
export function usePermissions() {
  const { user, hasPermission, isAuthenticated, isOwner, isAdmin, isManager } =
    useAuth();

  const can = (permission: string) => hasPermission(permission);
  const hasRole = (role: 'owner' | 'admin' | 'manager' | 'user' | 'guest') =>
    user?.role === role;
  const hasAnyRole = (
    roles: ('owner' | 'admin' | 'manager' | 'user' | 'guest')[]
  ) => (user ? roles.includes(user.role) : false);

  return {
    user,
    isAuthenticated,
    isOwner,
    isAdmin,
    isManager,
    can,
    hasRole,
    hasAnyRole,
  };
}
