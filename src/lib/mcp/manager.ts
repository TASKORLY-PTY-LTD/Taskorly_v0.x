import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { supabaseAdmin } from '@/lib/supabase';
import { decrypt } from '@/lib/encryption';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  handler?: string;
  serverId: string;
}

export interface MCPServer {
  id: string;
  name: string;
  description?: string;
  server_url?: string;
  server_command?: string;
  server_args?: string[];
  server_env?: Record<string, string>;
  capabilities?: any;
  is_active: boolean;
  client?: Client;
}

export class MCPManager {
  private connectedServers: Map<string, { server: MCPServer; client: Client }> =
    new Map();
  private availableTools: Map<string, MCPTool[]> = new Map();

  constructor() {
    this.initializeServers = this.initializeServers.bind(this);
  }

  /**
   * Initialize MCP servers for a tenant
   */
  async initializeServers(tenantId: string): Promise<void> {
    try {
      // Get active MCP servers for the tenant
      const { data: servers, error } = await supabaseAdmin
        .from('mcp_servers')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching MCP servers:', error);
        return;
      }

      // Connect to each server
      for (const server of servers || []) {
        try {
          await this.connectToServer(tenantId, server);
        } catch (error) {
          console.error(
            `Failed to connect to MCP server ${server.name}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error('Error initializing MCP servers:', error);
    }
  }

  /**
   * Connect to a specific MCP server
   */
  private async connectToServer(
    tenantId: string,
    serverConfig: any
  ): Promise<void> {
    const cacheKey = `${tenantId}:${serverConfig.id}`;

    // Skip if already connected
    if (this.connectedServers.has(cacheKey)) {
      return;
    }

    let transport;
    let client;

    try {
      // Create appropriate transport
      if (serverConfig.server_url) {
        // HTTP/SSE transport
        transport = new SSEClientTransport(new URL(serverConfig.server_url));
      } else if (serverConfig.server_command) {
        // Stdio transport for local processes
        transport = new StdioClientTransport({
          command: serverConfig.server_command,
          args: serverConfig.server_args || [],
          env: {
            ...process.env,
            ...serverConfig.server_env,
          },
        });
      } else {
        throw new Error(
          `Invalid server configuration for ${serverConfig.name}`
        );
      }

      // Create and connect client
      client = new Client(
        {
          name: `taskorly-client-${tenantId}`,
          version: '1.0.0',
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
          },
        }
      );

      await client.connect(transport);

      // Get server capabilities and tools
      const capabilities = await client.listTools();
      const tools: MCPTool[] = capabilities.tools.map(tool => ({
        name: tool.name,
        description: tool.description || 'No description provided',
        inputSchema: tool.inputSchema,
        serverId: serverConfig.id,
      }));

      // Cache the connection
      this.connectedServers.set(cacheKey, {
        server: serverConfig,
        client,
      });

      // Cache available tools
      this.availableTools.set(cacheKey, tools);

      console.log(`Connected to MCP server: ${serverConfig.name}`);
    } catch (error) {
      console.error(
        `Error connecting to MCP server ${serverConfig.name}:`,
        error
      );

      // Clean up on error
      if (client) {
        try {
          await client.close();
        } catch (closeError) {
          console.error('Error closing failed client:', closeError);
        }
      }
      throw error;
    }
  }

  /**
   * Get available tools for a tenant
   */
  async getAvailableTools(tenantId: string): Promise<MCPTool[]> {
    // Initialize servers if not already done
    if (!this.hasConnectedServers(tenantId)) {
      await this.initializeServers(tenantId);
    }

    const allTools: MCPTool[] = [];

    for (const [cacheKey, tools] of this.availableTools.entries()) {
      if (cacheKey.startsWith(`${tenantId}:`)) {
        allTools.push(...tools);
      }
    }

    return allTools;
  }

  /**
   * Execute a tool call
   */
  async executeTool(
    tenantId: string,
    toolName: string,
    args: any
  ): Promise<any> {
    const cacheKey = this.findServerForTool(tenantId, toolName);

    if (!cacheKey) {
      throw new Error(`Tool ${toolName} not found for tenant ${tenantId}`);
    }

    const connection = this.connectedServers.get(cacheKey);

    if (!connection) {
      throw new Error(`No connection found for tool ${toolName}`);
    }

    try {
      const result = await connection.client.callTool({
        name: toolName,
        arguments: args,
      });

      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName}:`, error);
      throw error;
    }
  }

  /**
   * Add a new MCP server
   */
  // async addServer(
  //   tenantId: string,
  //   serverConfig: {
  //     name: string;
  //     description?: string;
  //     server_url?: string;
  //     server_command?: string;
  //     server_args?: string[];
  //     server_env?: Record<string, string>;
  //     capabilities?: any;
  //   }
  // ): Promise<string> {
  //   try {
  //     // Insert server configuration
  //     const { data: server, error } = await supabaseAdmin
  //       .from('mcp_servers')
  //       .insert({
  //         tenant_id: tenantId,
  //         name: serverConfig.name,
  //         description: serverConfig.description,
  //         server_url: serverConfig.server_url,
  //         server_command: serverConfig.server_command,
  //         server_args: serverConfig.server_args,
  //         server_env: serverConfig.server_env || {},
  //         capabilities: serverConfig.capabilities || {},
  //         is_active: true,
  //       })
  //       .select()
  //       .single();

  //     if (error || !server) {
  //       throw new Error(`Failed to add server: ${error?.message}`);
  //     }

  //     // Try to connect to the new server
  //     try {
  //       await this.connectToServer(tenantId, server);
  //     } catch (connectionError) {
  //       console.warn(
  //         `Server added but connection failed: ${(connectionError as Error).message}`
  //       );

  //       // Mark server as inactive if connection fails
  //       await supabaseAdmin
  //         .from('mcp_servers')
  //         .update({ is_active: false })
  //         .eq('id', server.id);
  //     }

  //     return server.id;
  //   } catch (error) {
  //     console.error('Error adding MCP server:', error);
  //     throw error;
  //   }
  // }

  /**
   * Remove an MCP server
   */
  async removeServer(tenantId: string, serverId: string): Promise<void> {
    const cacheKey = `${tenantId}:${serverId}`;

    try {
      // Close connection if exists
      const connection = this.connectedServers.get(cacheKey);
      if (connection) {
        await connection.client.close();
        this.connectedServers.delete(cacheKey);
        this.availableTools.delete(cacheKey);
      }

      // Remove from database
      const { error } = await supabaseAdmin
        .from('mcp_servers')
        .delete()
        .eq('id', serverId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to remove server: ${error.message}`);
      }
    } catch (error) {
      console.error('Error removing MCP server:', error);
      throw error;
    }
  }

  /**
   * Update server configuration
   */
  async updateServer(
    tenantId: string,
    serverId: string,
    updates: {
      name?: string;
      description?: string;
      server_url?: string;
      server_command?: string;
      server_args?: string[];
      server_env?: Record<string, string>;
      is_active?: boolean;
    }
  ): Promise<void> {
    try {
      // Update database
      const { error } = await supabaseAdmin
        .from('mcp_servers')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', serverId)
        .eq('tenant_id', tenantId);

      if (error) {
        throw new Error(`Failed to update server: ${error.message}`);
      }

      // If server was deactivated, disconnect
      if (updates.is_active === false) {
        const cacheKey = `${tenantId}:${serverId}`;
        const connection = this.connectedServers.get(cacheKey);

        if (connection) {
          await connection.client.close();
          this.connectedServers.delete(cacheKey);
          this.availableTools.delete(cacheKey);
        }
      }
      // If server was activated or config changed, reconnect
      else if (
        updates.is_active === true ||
        updates.server_url ||
        updates.server_command
      ) {
        // Get updated server config
        const { data: server } = await supabaseAdmin
          .from('mcp_servers')
          .select('*')
          .eq('id', serverId)
          .single();

        if (server) {
          // Disconnect existing if any
          const cacheKey = `${tenantId}:${serverId}`;
          const existingConnection = this.connectedServers.get(cacheKey);

          if (existingConnection) {
            await existingConnection.client.close();
            this.connectedServers.delete(cacheKey);
            this.availableTools.delete(cacheKey);
          }

          // Reconnect with new config
          await this.connectToServer(tenantId, server);
        }
      }
    } catch (error) {
      console.error('Error updating MCP server:', error);
      throw error;
    }
  }

  /**
   * Get server status and health
   */
  async getServerHealth(tenantId: string): Promise<
    Record<
      string,
      {
        status: 'connected' | 'disconnected' | 'error';
        toolCount: number;
        lastError?: string;
      }
    >
  > {
    const health: Record<string, any> = {};

    // Get all servers for tenant
    const { data: servers } = await supabaseAdmin
      .from('mcp_servers')
      .select('*')
      .eq('tenant_id', tenantId);

    for (const server of servers || []) {
      const cacheKey = `${tenantId}:${server.id}`;
      const connection = this.connectedServers.get(cacheKey);
      const tools = this.availableTools.get(cacheKey) || [];

      health[server.name] = {
        status: connection
          ? 'connected': server.enabled ? 'disconnected' : 'error',
        lastError: connection ? undefined : server.enabled ? undefined : 'Server is inactive',
        toolCount: tools.length,
      };
    }

    return health;
  }

  /**
   * Cleanup connections for a tenant
   */
  async cleanup(tenantId: string): Promise<void> {
    const keysToRemove: string[] = [];

    for (const [cacheKey, connection] of this.connectedServers.entries()) {
      if (cacheKey.startsWith(`${tenantId}:`)) {
        try {
          await connection.client.close();
        } catch (error) {
          console.error('Error closing MCP connection:', error);
        }
        keysToRemove.push(cacheKey);
      }
    }

    // Clean up caches
    for (const key of keysToRemove) {
      this.connectedServers.delete(key);
      this.availableTools.delete(key);
    }
  }

  /**
   * Cleanup all connections
   */
  async cleanupAll(): Promise<void> {
    for (const [, connection] of this.connectedServers.entries()) {
      try {
        await connection.client.close();
      } catch (error) {
        console.error('Error closing MCP connection:', error);
      }
    }

    this.connectedServers.clear();
    this.availableTools.clear();
  }

  /**
   * Helper methods
   */
  private hasConnectedServers(tenantId: string): boolean {
    for (const cacheKey of this.connectedServers.keys()) {
      if (cacheKey.startsWith(`${tenantId}:`)) {
        return true;
      }
    }
    return false;
  }

  private findServerForTool(tenantId: string, toolName: string): string | null {
    for (const [cacheKey, tools] of this.availableTools.entries()) {
      if (
        cacheKey.startsWith(`${tenantId}:`) &&
        tools.some(tool => tool.name === toolName)
      ) {
        return cacheKey;
      }
    }
    return null;
  }
}

// Global instance
export const mcpManager = new MCPManager();

// Cleanup on process exit
process.on('SIGINT', async () => {
  await mcpManager.cleanupAll();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await mcpManager.cleanupAll();
  process.exit(0);
});
