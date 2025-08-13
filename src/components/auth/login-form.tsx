"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/providers/auth-provider";
import { User, Shield, Users, LogIn } from "lucide-react";

const roleOptions = [
  {
    value: "admin" as const,
    label: "Administrator",
    description: "Full system access and management capabilities",
    icon: Shield,
    color: "bg-red-500 hover:bg-red-600",
  },
  {
    value: "manager" as const,
    label: "Manager",
    description: "Moderate access with read permissions on system settings",
    icon: Users,
    color: "bg-blue-500 hover:bg-blue-600",
  },
  {
    value: "user" as const,
    label: "User",
    description: "Standard user access for chat and document viewing",
    icon: User,
    color: "bg-green-500 hover:bg-green-600",
  },
];

export function LoginForm() {
  const [selectedRole, setSelectedRole] = useState<"admin" | "manager" | "user" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async () => {
    if (!selectedRole) return;
    
    setIsLoading(true);
    try {
      await login("demo", "password", selectedRole);
    } catch (error) {
      console.error("Login failed:", error);
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Welcome to Taskorly</CardTitle>
          <CardDescription>
            Select your role to access the RAG Chat System
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            {roleOptions.map((role) => {
              const Icon = role.icon;
              const isSelected = selectedRole === role.value;
              
              return (
                <div
                  key={role.value}
                  className={`p-4 border rounded-lg cursor-pointer transition-all ${
                    isSelected 
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                      : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                  }`}
                  onClick={() => setSelectedRole(role.value)}
                >
                  <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-full text-white ${role.color}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-semibold">{role.label}</h3>
                        {isSelected && (
                          <Badge variant="default" className="text-xs">
                            Selected
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {role.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <Button 
            className="w-full" 
            onClick={handleLogin}
            disabled={!selectedRole || isLoading}
          >
            <LogIn className="mr-2 h-4 w-4" />
            {isLoading ? "Logging in..." : `Login as ${selectedRole ? roleOptions.find(r => r.value === selectedRole)?.label : "Role"}`}
          </Button>

          <div className="text-center text-xs text-gray-500 mt-4">
            Demo Mode - No actual authentication required
          </div>
        </CardContent>
      </Card>
    </div>
  );
}