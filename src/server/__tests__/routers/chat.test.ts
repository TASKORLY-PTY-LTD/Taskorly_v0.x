import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { TRPCError } from '@trpc/server';
import { chatRouter } from '../../routers/chat';
import { createTRPCContext } from '../../trpc';

// Mock dependencies
vi.mock('@/lib/rag/pipeline', () => ({
  RAGPipeline: vi.fn().mockImplementation(() => ({
    processMessage: vi.fn().mockImplementation(async function* () {
      yield { type: 'context', documents: [] };
      yield { type: 'text', content: 'Test response' };
      yield { type: 'token_count', count: 100 };
    }),
    searchDocuments: vi.fn().mockResolvedValue([
      {
        id: 'chunk-1',
        content: 'Test content',
        similarity: 0.85,
        metadata: { document_id: 'doc-1', title: 'Test Doc' },
      },
    ]),
  })),
}));

vi.mock('@/lib/mcp/manager', () => ({
  MCPManager: vi.fn().mockImplementation(() => ({
    getAvailableTools: vi.fn().mockResolvedValue([]),
  })),
}));

describe('Chat Router', () => {
  let mockContext: any;

  beforeAll(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
  });

  beforeEach(() => {
    mockContext = {
      user: {
        id: 'user-1',
        email: 'test@example.com',
        role: 'user',
      },
      tenant: {
        id: 'tenant-1',
        name: 'Test Tenant',
      },
      supabaseAdmin: {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: {
                    id: 'conv-1',
                    tenant_id: 'tenant-1',
                    user_id: 'user-1',
                    title: 'Test Conversation',
                  },
                  error: null,
                })),
              })),
              order: vi.fn(() => ({
                limit: vi.fn(() => ({ data: [], error: null })),
                range: vi.fn(() => ({ data: [], error: null })),
              })),
            })),
          })),
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn(() => ({
                data: { id: 'msg-1', content: 'Test message' },
                error: null,
              })),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  select: vi.fn(() => ({
                    single: vi.fn(() => ({
                      data: { id: 'conv-1' },
                      error: null,
                    })),
                  })),
                })),
              })),
            })),
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({ error: null })),
              })),
            })),
          })),
        })),
      },
    };
  });

  describe('sendMessage', () => {
    it('should send message successfully', async () => {
      // Mock tenant configuration
      mockContext.supabaseAdmin.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => ({
              data: {
                llm_provider: 'openai',
                llm_model: 'gpt-4',
                llm_api_key: 'encrypted-key',
                embedding_model: 'text-embedding-3-large',
                temperature: 0.7,
                max_context_length: 8000,
                system_prompt: 'You are helpful',
                vector_db_config: {},
                tenant_id: 'tenant-1',
              },
              error: null,
            })),
          })),
        })),
      });

      const caller = chatRouter.createCaller(mockContext);

      const result = await caller.sendMessage({
        conversationId: 'conv-1',
        message: 'Hello, how are you?',
        includeContext: true,
      });

      expect(result).toMatchObject({
        content: 'Test response',
        tokenCount: 100,
        retrievedDocs: [],
        toolCalls: [],
      });
    });

    it('should throw error when conversation not found', async () => {
      // Mock conversation not found
      mockContext.supabaseAdmin
        .from()
        .select()
        .eq()
        .eq()
        .single.mockReturnValueOnce({
          data: null,
          error: new Error('Not found'),
        });

      const caller = chatRouter.createCaller(mockContext);

      await expect(
        caller.sendMessage({
          conversationId: 'non-existent',
          message: 'Hello',
          includeContext: true,
        })
      ).rejects.toThrow('Conversation not found');
    });

    it('should throw error when tenant config not found', async () => {
      // Mock conversation exists but config doesn't
      mockContext.supabaseAdmin.from
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => ({ data: { id: 'conv-1' }, error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          insert: () => ({
            select: () => ({
              single: () => ({ data: { id: 'msg-1' }, error: null }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              single: () => ({ data: null, error: null }),
            }),
          }),
        });

      const caller = chatRouter.createCaller(mockContext);

      await expect(
        caller.sendMessage({
          conversationId: 'conv-1',
          message: 'Hello',
          includeContext: true,
        })
      ).rejects.toThrow('Tenant configuration not found');
    });
  });

  describe('getConversation', () => {
    it('should get conversation with messages', async () => {
      mockContext.supabaseAdmin
        .from()
        .select()
        .eq()
        .eq()
        .single.mockReturnValueOnce({
          data: {
            id: 'conv-1',
            title: 'Test Conversation',
            messages: [{ id: 'msg-1', role: 'user', content: 'Hello' }],
          },
          error: null,
        });

      const caller = chatRouter.createCaller(mockContext);

      const result = await caller.getConversation({
        conversationId: 'conv-1',
      });

      expect(result).toMatchObject({
        id: 'conv-1',
        title: 'Test Conversation',
        messages: expect.arrayContaining([
          expect.objectContaining({ content: 'Hello' }),
        ]),
      });
    });

    it('should throw error when conversation not found', async () => {
      mockContext.supabaseAdmin
        .from()
        .select()
        .eq()
        .eq()
        .single.mockReturnValueOnce({
          data: null,
          error: new Error('Not found'),
        });

      const caller = chatRouter.createCaller(mockContext);

      await expect(
        caller.getConversation({
          conversationId: 'non-existent',
        })
      ).rejects.toThrow('Conversation not found');
    });
  });

  describe('createConversation', () => {
    it('should create new conversation', async () => {
      mockContext.supabaseAdmin
        .from()
        .insert()
        .select()
        .single.mockReturnValueOnce({
          data: {
            id: 'new-conv',
            title: 'New Conversation',
            tenant_id: 'tenant-1',
            user_id: 'user-1',
          },
          error: null,
        });

      const caller = chatRouter.createCaller(mockContext);

      const result = await caller.createConversation({
        title: 'New Conversation',
        systemPrompt: 'Be helpful',
      });

      expect(result).toMatchObject({
        id: 'new-conv',
        title: 'New Conversation',
      });
    });

    it('should handle creation errors', async () => {
      mockContext.supabaseAdmin
        .from()
        .insert()
        .select()
        .single.mockReturnValueOnce({
          data: null,
          error: new Error('Creation failed'),
        });

      const caller = chatRouter.createCaller(mockContext);

      await expect(
        caller.createConversation({
          title: 'New Conversation',
        })
      ).rejects.toThrow('Failed to create conversation');
    });
  });

  describe('listConversations', () => {
    it('should list user conversations', async () => {
      mockContext.supabaseAdmin
        .from()
        .select()
        .eq()
        .eq()
        .order()
        .range.mockReturnValueOnce({
          data: [
            {
              id: 'conv-1',
              title: 'Conversation 1',
              messages: [],
            },
          ],
          error: null,
        });

      const caller = chatRouter.createCaller(mockContext);

      const result = await caller.listConversations({
        limit: 10,
        offset: 0,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'conv-1',
        title: 'Conversation 1',
      });
    });
  });

  describe('searchDocuments', () => {
    it('should search documents with RAG pipeline', async () => {
      // Mock tenant configuration
      mockContext.supabaseAdmin
        .from()
        .select()
        .eq()
        .single.mockReturnValueOnce({
          data: {
            llm_provider: 'openai',
            llm_model: 'gpt-4',
            tenant_id: 'tenant-1',
          },
          error: null,
        });

      const caller = chatRouter.createCaller(mockContext);

      const result = await caller.searchDocuments({
        query: 'test search',
        limit: 5,
        threshold: 0.8,
      });

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'chunk-1',
        content: 'Test content',
        similarity: 0.85,
      });
    });
  });
});
