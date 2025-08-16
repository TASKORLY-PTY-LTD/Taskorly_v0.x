import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { MCPManager } from '../manager';

// Mock dependencies
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    listTools: vi.fn().mockResolvedValue({
      tools: [
        {
          name: 'test-tool',
          description: 'Test tool',
          inputSchema: { type: 'object' },
        },
      ],
    }),
    callTool: vi.fn().mockResolvedValue({ result: 'success' }),
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn(() => ({ data: [], error: null })),
          single: vi.fn(() => ({ data: null, error: null })),
        })),
      })),
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn(() => ({ data: { id: 'server-1' }, error: null })),
        })),
      })),
      update: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      })),
      delete: vi.fn(() => ({
        eq: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
      })),
    })),
  },
}));

describe('MCPManager', () => {
  let manager: MCPManager;

  beforeAll(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
  });

  beforeEach(() => {
    manager = new MCPManager();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create MCPManager instance', () => {
      expect(manager).toBeInstanceOf(MCPManager);
    });
  });

  describe('initializeServers', () => {
    it('should initialize servers for tenant', async () => {
      const tenantId = 'test-tenant';

      await manager.initializeServers(tenantId);

      // Should not throw and complete successfully
      expect(true).toBe(true);
    });

    it('should handle initialization errors gracefully', async () => {
      const tenantId = 'test-tenant';

      // Mock Supabase to return error
      vi.mocked(vi.importActual('@/lib/supabase'))
        .supabaseAdmin.from()
        .select()
        .eq()
        .eq.mockReturnValueOnce({
          data: null,
          error: new Error('Database error'),
        });

      await expect(manager.initializeServers(tenantId)).resolves.not.toThrow();
    });
  });

  describe('getAvailableTools', () => {
    it('should return empty array when no servers connected', async () => {
      const tenantId = 'test-tenant';

      const tools = await manager.getAvailableTools(tenantId);

      expect(tools).toEqual([]);
    });

    it('should initialize servers if not connected', async () => {
      const tenantId = 'test-tenant';
      const spy = vi.spyOn(manager, 'initializeServers');

      await manager.getAvailableTools(tenantId);

      expect(spy).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('executeTool', () => {
    it('should throw error when tool not found', async () => {
      const tenantId = 'test-tenant';
      const toolName = 'non-existent-tool';
      const args = {};

      await expect(
        manager.executeTool(tenantId, toolName, args)
      ).rejects.toThrow(`Tool ${toolName} not found for tenant ${tenantId}`);
    });
  });

  describe('addServer', () => {
    it('should add server successfully', async () => {
      const tenantId = 'test-tenant';
      const serverConfig = {
        name: 'test-server',
        description: 'Test MCP server',
        server_command: 'node',
        server_args: ['server.js'],
      };

      const serverId = await manager.addServer(tenantId, serverConfig);

      expect(serverId).toBe('server-1');
    });

    it('should handle server addition errors', async () => {
      const tenantId = 'test-tenant';
      const serverConfig = {
        name: 'test-server',
        server_command: 'node',
        server_args: ['server.js'],
      };

      // Mock database error
      vi.mocked(vi.importActual('@/lib/supabase'))
        .supabaseAdmin.from()
        .insert()
        .select()
        .single.mockReturnValueOnce({
          data: null,
          error: new Error('Insert failed'),
        });

      await expect(manager.addServer(tenantId, serverConfig)).rejects.toThrow(
        'Failed to add server'
      );
    });
  });

  describe('removeServer', () => {
    it('should remove server successfully', async () => {
      const tenantId = 'test-tenant';
      const serverId = 'server-1';

      await expect(
        manager.removeServer(tenantId, serverId)
      ).resolves.not.toThrow();
    });
  });

  describe('updateServer', () => {
    it('should update server configuration', async () => {
      const tenantId = 'test-tenant';
      const serverId = 'server-1';
      const updates = {
        name: 'updated-server',
        is_active: false,
      };

      await expect(
        manager.updateServer(tenantId, serverId, updates)
      ).resolves.not.toThrow();
    });
  });

  describe('getServerHealth', () => {
    it('should return health status for servers', async () => {
      const tenantId = 'test-tenant';

      const health = await manager.getServerHealth(tenantId);

      expect(health).toEqual({});
    });
  });

  describe('cleanup', () => {
    it('should cleanup connections for tenant', async () => {
      const tenantId = 'test-tenant';

      await expect(manager.cleanup(tenantId)).resolves.not.toThrow();
    });
  });

  describe('cleanupAll', () => {
    it('should cleanup all connections', async () => {
      await expect(manager.cleanupAll()).resolves.not.toThrow();
    });
  });
});
