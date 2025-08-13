"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface User {
  id: string;
  email: string;
  name: string;
  role: "admin" | "manager" | "user" | "guest";
  permissions: string[];
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isLoading: boolean;
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string, role?: "admin" | "manager" | "user") => Promise<void>;
  logout: () => void;
  getCurrentRole: () => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Mock user data for dev mode
const mockUsers = {
  admin: {
    id: "1",
    email: "admin@example.com",
    name: "Admin User",
    role: "admin" as const,
    permissions: ["admin:*", "manager:*", "user:*", "servers:*", "settings:*", "analytics:*", "vector-store:*"]
  },
  manager: {
    id: "2",
    email: "manager@example.com", 
    name: "Manager User",
    role: "manager" as const,
    permissions: ["manager:*", "user:*", "servers:read", "settings:read", "analytics:read", "documents:*", "chat:*"]
  },
  user: {
    id: "3", 
    email: "user@example.com",
    name: "Regular User",
    role: "user" as const,
    permissions: ["user:read", "chat:*", "documents:read"]
  }
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  // Load user from localStorage on mount
  useEffect(() => {
    const savedUser = localStorage.getItem('auth-user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (error) {
        console.error('Error parsing saved user:', error);
        localStorage.removeItem('auth-user');
      }
    }
    setIsLoading(false);
  }, []);
  
  const isAuthenticated = !!user;
  const isAdmin = user?.role === "admin";
  const isManager = user?.role === "manager";
  
  const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    
    // Admin has all permissions
    if (user.role === "admin") return true;
    
    // Check specific permissions
    return user.permissions.some(p => {
      if (p === permission) return true;
      if (p.endsWith(":*") && permission.startsWith(p.slice(0, -1))) return true;
      return false;
    });
  };

  const login = async (email: string, password: string, role?: "admin" | "manager" | "user"): Promise<void> => {
    // Mock login - in production this would call your auth API
    let selectedUser: User;
    
    if (role) {
      selectedUser = mockUsers[role];
    } else if (email === mockUsers.admin.email) {
      selectedUser = mockUsers.admin;
    } else if (email === mockUsers.manager.email) {
      selectedUser = mockUsers.manager;
    } else {
      selectedUser = mockUsers.user;
    }
    
    setUser(selectedUser);
    localStorage.setItem('auth-user', JSON.stringify(selectedUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('auth-user');
  };

  const getCurrentRole = (): string => {
    return user?.role || "guest";
  };

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isAdmin,
    isManager,
    isLoading,
    hasPermission,
    login,
    logout,
    getCurrentRole,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}