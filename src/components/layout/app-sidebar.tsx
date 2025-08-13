"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { useDevMode } from "@/providers/dev-mode-provider";
import { useAuth } from "@/providers/auth-provider";
import { 
  MessageSquare, 
  FileText, 
  Settings, 
  Server, 
  Search,
  Home,
  Database
} from "lucide-react";

const menuItems = [
  {
    title: "Dashboard",
    url: "/",
    icon: Home,
  },
  {
    title: "Chat",
    url: "/chat-v2",
    icon: MessageSquare,
  },
  {
    title: "Documents", 
    url: "/documents",
    icon: FileText,
  },
  {
    title: "Search",
    url: "/search", 
    icon: Search,
  },
];

const systemItems = [
  {
    title: "MCP Servers",
    url: "/servers",
    icon: Server,
    permission: "servers:read",
  },
  {
    title: "Vector Store", 
    url: "/vector-store",
    icon: Database,
    permission: "admin:*",
  },
  {
    title: "Settings",
    url: "/settings",
    icon: Settings,
    permission: "settings:read",
  },
];

export function AppSidebar() {
  const { mockMCPServers } = useDevMode();
  const { hasPermission } = useAuth();
  
  const connectedServers = mockMCPServers.filter(server => server.status === "connected").length;
  const totalServers = mockMCPServers.length;
  
  // Filter system items based on permissions
  const visibleSystemItems = systemItems.filter(item => 
    !item.permission || hasPermission(item.permission)
  );

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleSystemItems.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {visibleSystemItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <a href={item.url} className="flex items-center justify-between">
                      <div className="flex items-center">
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.title}</span>
                      </div>
                      {item.title === "MCP Servers" && (
                        <Badge 
                          variant={connectedServers === totalServers ? "default" : "secondary"}
                          className="ml-2 text-xs"
                        >
                          {connectedServers}/{totalServers}
                        </Badge>
                      )}
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
    </Sidebar>
  );
}