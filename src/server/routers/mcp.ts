import { z } from 'zod';
import {
  createTRPCRouter,
  protectedProcedure,
  adminProcedure,
  tenantProcedure,
  adminTenantProcedure,
} from '../trpc';
import { TRPCError } from '@trpc/server';
import { MCPManager } from '@/lib/mcp/manager';
import { encrypt, decrypt } from '@/lib/encryption';

const mcpManager = new MCPManager();

export const mcpRouter = createTRPCRouter({
  // List available tools for tenant
  listTools: tenantProcedure.query(async ({ ctx }) => {
    try {
      const tools = await mcpManager.getAvailableTools(ctx.tenant.id);
      return tools;
    } catch (error) {
      console.error('Error listing MCP tools:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to list available tools',
      });
    }
  }),

  // Execute a tool
  // executeTool: tenantProcedure
  //   .input(
  //     z.object({
  //       toolName: z.string(),
  //       args: z.record(z.any()),
  //     })
  //   )
  //   .mutation(async ({ ctx, input }) => {
  //     try {
  //       const result = await mcpManager.executeTool(
  //         ctx.tenant.id,
  //         input.toolName,
  //         input.args
  //       );

  //       // Log usage
  //       await ctx.supabaseAdmin.from('usage_logs').insert({
  //         tenant_id: ctx.tenant.id,
  //         user_id: ctx.user.id,
  //         event_type: 'tool_execution',
  //         tokens_used: 0, // Tools don't use tokens directly
  //         cost_cents: 0,
  //         metadata: {
  //           tool_name: input.toolName,
  //           args: input.args,
  //           success: !!result,
  //         },
  //       });

  //       return result;
  //     } catch (error) {
  //       console.error('Error executing tool:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: `Failed to execute tool: ${(error as Error).message}`,
  //       });
  //     }
  //   }),

  // List MCP servers for tenant
  listServers: tenantProcedure.query(async ({ ctx }) => {
    const { data: servers, error } = await ctx.supabaseAdmin
      .from('mcp_servers')
      .select('*')
      .eq('tenant_id', ctx.tenant.id);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch MCP servers',
      });
    }

    return servers || [];
  }),

  // Add new MCP server (admin only)
  // addServer: adminTenantProcedure
  //   .input(
  //     z.object({
  //       name: z.string().min(1).max(255),
  //       description: z.string().optional(),
  //       server_url: z.string().url().optional(),
  //       server_command: z.string().optional(),
  //       server_args: z.array(z.string()).optional(),
  //       server_env: z.record(z.string()).optional(),
  //       capabilities: z.record(z.any()).optional(),
  //     })
  //   )
  //   .mutation(async ({ ctx, input }) => {
  //     try {
  //       const serverId = await mcpManager.addServer(ctx.tenant.id, {
  //         name: input.name,
  //         description: input.description ?? undefined,
  //         server_url: input.server_url ?? undefined,
  //         server_command: input.server_command ?? undefined,
  //         server_args: input.server_args ?? undefined,
  //         server_env: input.server_env ?? undefined,
  //         capabilities: input.capabilities ?? undefined,
  //       });
  //       return { id: serverId };
  //     } catch (error) {
  //       console.error('Error adding MCP server:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: 'Failed to add MCP server',
  //       });
  //     }
  //   }),

  // Update MCP server (admin only)
  updateServer: adminTenantProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        description: z.string().optional(),
        server_url: z.string().url().optional(),
        server_command: z.string().optional(),
        server_args: z.array(z.string()).optional(),
        server_env: z.record(z.string()).optional(),
        is_active: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { serverId, ...updates } = input;

      try {
        await mcpManager.updateServer(ctx.tenant.id, serverId, {
          name: updates.name ?? undefined,
          description: updates.description ?? undefined,
          server_url: updates.server_url ?? undefined,
          server_command: updates.server_command ?? undefined,
          server_args: updates.server_args ?? undefined,
          server_env: updates.server_env ?? undefined,
          is_active: updates.is_active ?? undefined,
        });
        return { success: true };
      } catch (error) {
        console.error('Error updating MCP server:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update MCP server',
        });
      }
    }),

  // Remove MCP server (admin only)
  removeServer: adminTenantProcedure
    .input(
      z.object({
        serverId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        await mcpManager.removeServer(ctx.tenant.id, input.serverId);
        return { success: true };
      } catch (error) {
        console.error('Error removing MCP server:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to remove MCP server',
        });
      }
    }),

  // Get server health status
  getServerHealth: tenantProcedure.query(async ({ ctx }) => {
    try {
      const health = await mcpManager.getServerHealth(ctx.tenant.id);
      return health;
    } catch (error) {
      console.error('Error getting server health:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get server health status',
      });
    }
  }),

  // Initialize servers for tenant
  initializeServers: tenantProcedure.mutation(async ({ ctx }) => {
    try {
      await mcpManager.initializeServers(ctx.tenant.id);
      return { success: true };
    } catch (error) {
      console.error('Error initializing MCP servers:', error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to initialize MCP servers',
      });
    }
  }),

  // Manage API keys for MCP servers
  addApiKey: adminTenantProcedure
    .input(
      z.object({
        serverId: z.string().uuid().optional(),
        name: z.string().min(1).max(255),
        keyName: z.string().min(1).max(255),
        value: z.string().min(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Encrypt the API key value
        const encryptedValue = encrypt(input.value);

        const { data: apiKey, error } = await ctx.supabaseAdmin
          .from('api_keys')
          .insert({
            tenant_id: ctx.tenant.id,
            mcp_server_id: input.serverId ?? null,
            name: input.name,
            key_name: input.keyName,
            encrypted_value: encryptedValue,
          })
          .select()
          .single();

        if (error || !apiKey) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to add API key',
          });
        }

        return { id: apiKey.id };
      } catch (error) {
        console.error('Error adding API key:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to add API key',
        });
      }
    }),

  // List API keys (without values)
  listApiKeys: tenantProcedure.query(async ({ ctx }) => {
    const { data: apiKeys, error } = await ctx.supabaseAdmin
      .from('api_keys')
      .select('id, name, key_name, mcp_server_id, created_at, updated_at')
      .eq('tenant_id', ctx.tenant.id);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch API keys',
      });
    }

    return apiKeys || [];
  }),

  // Update API key
  updateApiKey: adminTenantProcedure
    .input(
      z.object({
        keyId: z.string().uuid(),
        name: z.string().min(1).max(255).optional(),
        value: z.string().min(1).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { keyId, ...updates } = input;
      const updateData: any = {};

      if (updates.name) updateData.name = updates.name;
      if (updates.value) updateData.encrypted_value = encrypt(updates.value);
      updateData.updated_at = new Date().toISOString();

      const { error } = await ctx.supabaseAdmin
        .from('api_keys')
        .update(updateData)
        .eq('id', keyId)
        .eq('tenant_id', ctx.tenant.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update API key',
        });
      }

      return { success: true };
    }),

  // Delete API key
  deleteApiKey: adminTenantProcedure
    .input(
      z.object({
        keyId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabaseAdmin
        .from('api_keys')
        .delete()
        .eq('id', input.keyId)
        .eq('tenant_id', ctx.tenant.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete API key',
        });
      }

      return { success: true };
    }),
});
