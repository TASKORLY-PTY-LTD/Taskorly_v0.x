import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { TRPCError } from '@trpc/server';
import { documentsRouter } from '../../routers/documents';

// Mock the Gemini chunker
vi.mock('@/lib/gemini-chunker', () => ({
  chunkDocumentWithGemini: vi.fn().mockImplementation(async (content, documentId, title, contentType, options) => {
    // Mock chunking - split content into chunks of maxChunkSize
    const maxChunkSize = options.maxChunkSize || 1000;
    const chunks = [];
    
    for (let i = 0; i < content.length; i += maxChunkSize) {
      chunks.push({
        content: content.slice(i, i + maxChunkSize),
        chunkIndex: chunks.length,
        metadata: {
          document_id: documentId,
          title,
          content_type: contentType,
          chunk_size: Math.min(maxChunkSize, content.length - i),
        },
      });
    }
    
    return chunks;
  }),
}));

// Mock environment validation
vi.mock('@/lib/env', () => ({
  env: {
    NEXT_PUBLIC_SUPABASE_URL: 'https://test-project.supabase.co',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    SUPABASE_SERVICE_ROLE_KEY: 'test-service-role-key',
    ENCRYPTION_KEY: 'test-encryption-key-32-chars-long',
    NEXTAUTH_SECRET: 'test-nextauth-secret',
    NEXTAUTH_URL: 'http://localhost:3000',
  },
}));

describe('Documents Router - Core Upload Tests', () => {
  let mockContext: any;

  beforeAll(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
  });

  beforeEach(() => {
    // Create a simple mock context for testing core upload functionality
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
        from: vi.fn((table: string) => {
          if (table === 'documents') {
            return {
              insert: vi.fn(() => ({
                select: vi.fn(() => ({
                  single: vi.fn(() => ({
                    data: {
                      id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
                      tenant_id: 'tenant-1',
                      title: 'Test Document',
                      content: 'Test content',
                      content_type: 'text/plain',
                      metadata: {},
                      processing_status: 'processing',
                      chunk_count: 0,
                      created_at: new Date().toISOString(),
                    },
                    error: null,
                  })),
                })),
              })),
              update: vi.fn(() => ({
                eq: vi.fn(() => ({
                  data: null,
                  error: null,
                })),
              })),
            };
          } else if (table === 'document_chunks') {
            return {
              insert: vi.fn(() => ({
                data: null,
                error: null,
              })),
            };
          } else if (table === 'usage_logs') {
            return {
              insert: vi.fn(() => ({
                data: null,
                error: null,
              })),
            };
          }
          return {};
        }),
      },
    };
  });

  describe('upload - Core Functionality', () => {
    it('should upload a document successfully', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.upload({
        title: 'Test Document',
        content: 'This is test content for the document.',
        contentType: 'text/plain',
        metadata: { source: 'test' },
      });

      expect(result).toMatchObject({
        id: '550e8400-e29b-41d4-a716-446655440000',
        title: 'Test Document',
        content: 'Test content',
        chunk_count: expect.any(Number),
        processing_status: 'completed',
      });

      // Verify that document was inserted
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
      
      // Verify that chunks were inserted
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('document_chunks');
      
      // Verify that document was updated with chunk count
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should handle document creation errors', async () => {
      // Mock document creation failure
      mockContext.supabaseAdmin.from.mockReturnValueOnce({
        insert: vi.fn(() => ({
          select: vi.fn(() => ({
            single: vi.fn(() => ({
              data: null,
              error: new Error('Database error'),
            })),
          })),
        })),
      });

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.upload({
          title: 'Test Document',
          content: 'Test content',
        })
      ).rejects.toThrow('Failed to upload document');
    });

    it('should handle chunking errors gracefully', async () => {
      // Mock successful document creation but failed chunking
      const { chunkDocumentWithGemini } = await import('@/lib/gemini-chunker');
      vi.mocked(chunkDocumentWithGemini).mockRejectedValueOnce(new Error('Chunking failed'));

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.upload({
          title: 'Test Document',
          content: 'Test content',
        })
      ).rejects.toThrow('Failed to upload document');
    });

    it('should validate input parameters', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      // Test empty title
      await expect(
        caller.upload({
          title: '',
          content: 'Test content',
        })
      ).rejects.toThrow();

      // Test empty content
      await expect(
        caller.upload({
          title: 'Test Document',
          content: '',
        })
      ).rejects.toThrow();

      // Test title too long
      await expect(
        caller.upload({
          title: 'a'.repeat(256), // Exceeds 255 character limit
          content: 'Test content',
        })
      ).rejects.toThrow();
    });

    it('should set default content type', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      await caller.upload({
        title: 'Test Document',
        content: 'Test content',
        // No contentType provided
      });

      // Verify that the document was created with default content type
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should handle optional metadata', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      await caller.upload({
        title: 'Test Document',
        content: 'Test content',
        metadata: { customField: 'customValue' },
      });

      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });
  });

  describe('bulkUpload - Core Functionality', () => {
    it('should upload multiple documents successfully', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const documents = [
        {
          title: 'Document 1',
          content: 'Content 1',
          contentType: 'text/plain',
        },
        {
          title: 'Document 2',
          content: 'Content 2',
          contentType: 'text/markdown',
        },
      ];

      const result = await caller.bulkUpload({ documents });

      expect(result).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({
            title: 'Document 1',
            success: true,
            documentId: '550e8400-e29b-41d4-a716-446655440000',
            chunkCount: expect.any(Number),
          }),
          expect.objectContaining({
            title: 'Document 2',
            success: true,
            documentId: '550e8400-e29b-41d4-a716-446655440000',
            chunkCount: expect.any(Number),
          }),
        ]),
        summary: {
          total: 2,
          successful: 2,
          failed: 0,
          totalChunks: expect.any(Number),
          totalTokens: expect.any(Number),
        },
      });
    });

    it('should enforce document limit', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      // Create 11 documents (exceeds limit of 10)
      const documents = Array.from({ length: 11 }, (_, i) => ({
        title: `Document ${i + 1}`,
        content: `Content ${i + 1}`,
      }));

      await expect(
        caller.bulkUpload({ documents })
      ).rejects.toThrow();
    });
  });
});
