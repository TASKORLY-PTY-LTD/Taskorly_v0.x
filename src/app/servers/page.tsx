"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useDevMode } from "@/providers/dev-mode-provider";
import { 
  Server, 
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Settings,
  RefreshCw,
  Activity
} from "lucide-react";

export default function ServersPage() {
  const { mockMCPServers, updateMCPServerStatus } = useDevMode();

  const handleRefreshServer = (id: string) => {
    // Simulate server refresh
    updateMCPServerStatus(id, "connected");
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "connected":
        return "default";
      case "disconnected":
        return "secondary";
      case "error":
        return "destructive";
      default:
        return "outline";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "connected":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "disconnected":
        return <XCircle className="h-4 w-4 text-gray-500" />;
      case "error":
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Server className="h-4 w-4" />;
    }
  };

  const connectedCount = mockMCPServers.filter(s => s.status === "connected").length;
  const totalCount = mockMCPServers.length;

  return (
    <div className="flex-1 space-y-4 p-4 md:p-6 pt-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">MCP Servers</h1>
        <p className="text-muted-foreground">
          Manage and monitor your Model Context Protocol servers.
        </p>
      </div>

      {/* Status Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servers</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
            <p className="text-xs text-muted-foreground">
              MCP server instances
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{connectedCount}</div>
            <p className="text-xs text-muted-foreground">
              Active connections
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              <Badge variant={connectedCount > 0 ? "default" : "destructive"}>
                {connectedCount === totalCount ? "Healthy" : "Degraded"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              System status
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Server List */}
      <Card>
        <CardHeader>
          <CardTitle>Server Instances</CardTitle>
          <CardDescription>
            Monitor and manage your MCP server connections.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {mockMCPServers.map((server) => (
              <div
                key={server.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center space-x-4">
                  {getStatusIcon(server.status)}
                  <div>
                    <h3 className="font-medium">{server.name}</h3>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {server.type}
                      </Badge>
                      <span>{server.endpoint}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Badge variant={getStatusColor(server.status) as any} className="text-xs">
                    {server.status}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRefreshServer(server.id)}
                    className="h-8 w-8"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {mockMCPServers.length === 0 && (
            <div className="text-center py-8">
              <Server className="mx-auto h-12 w-12 text-muted-foreground/50" />
              <h3 className="mt-4 text-lg font-semibold">No servers configured</h3>
              <p className="text-muted-foreground">
                Add MCP servers to get started with enhanced AI capabilities.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}