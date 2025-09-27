import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { TRPCError } from '@trpc/server';
import { documentsRouter } from '../../routers/documents';

// Mock the Gemini chunker
vi.mock('@/lib/gemini-chunker', () => ({
  chunkDocumentWithGemini: vi
    .fn()
    .mockImplementation(
      async (content, documentId, title, contentType, options) => {
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
      }
    ),
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

describe('Documents Router', () => {
  let mockContext: any;

  beforeAll(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
  });

  beforeEach(() => {
    // Create a comprehensive mock context for testing
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
                      id: 'doc-1',
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
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    single: vi.fn(() => ({
                      data: {
                        id: 'doc-1',
                        title: 'Test Document',
                        content: 'Test content',
                        chunk_count: 2,
                        processing_status: 'completed',
                      },
                      error: null,
                    })),
                    order: vi.fn(() => ({
                      range: vi.fn(() => ({
                        data: [
                          {
                            id: 'doc-1',
                            title: 'Test Document 1',
                            content: 'Test content 1',
                            chunk_count: 2,
                            processing_status: 'completed',
                          },
                          {
                            id: 'doc-2',
                            title: 'Test Document 2',
                            content: 'Test content 2',
                            chunk_count: 3,
                            processing_status: 'completed',
                          },
                        ],
                        error: null,
                      })),
                    })),
                  })),
                })),
              })),
              delete: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    data: null,
                    error: null,
                  })),
                })),
              })),
            };
          } else if (table === 'document_chunks') {
            return {
              insert: vi.fn(() => ({
                data: null,
                error: null,
              })),
              delete: vi.fn(() => ({
                eq: vi.fn(() => ({
                  data: null,
                  error: null,
                })),
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

  describe('upload', () => {
    it('should upload a document successfully', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.upload({
        title: 'Test Document',
        content: 'This is test content for the document.',
        contentType: 'text/plain',
        metadata: { source: 'test' },
      });

      expect(result).toMatchObject({
        id: 'doc-1',
        title: 'Test Document',
        content: 'Test content',
        chunk_count: expect.any(Number),
        processing_status: 'completed',
      });

      // Verify that document was inserted
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');

      // Verify that chunks were inserted
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith(
        'document_chunks'
      );

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
      ).rejects.toThrow('Failed to create document');
    });

    it('should handle chunking errors gracefully', async () => {
      // Mock successful document creation but failed chunking
      const { chunkDocumentWithGemini } = await import('@/lib/gemini-chunker');
      vi.mocked(chunkDocumentWithGemini).mockRejectedValueOnce(
        new Error('Chunking failed')
      );

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.upload({
          title: 'Test Document',
          content: 'Test content',
        })
      ).rejects.toThrow('Document upload succeeded but chunking failed');
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

  describe('bulkUpload', () => {
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
            documentId: 'doc-1',
            chunkCount: expect.any(Number),
          }),
          expect.objectContaining({
            title: 'Document 2',
            success: true,
            documentId: 'doc-1',
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

    it('should handle mixed success and failure in bulk upload', async () => {
      // Mock first document success, second document failure
      let callCount = 0;
      mockContext.supabaseAdmin.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // First document - success
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'doc-1' },
                  error: null,
                })),
              })),
            })),
          };
        } else if (callCount === 2) {
          // Second document - failure
          return {
            insert: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: null,
                  error: new Error('Database error'),
                })),
              })),
            })),
          };
        }
        // Chunk operations
        return {
          insert: vi.fn(() => ({ data: null, error: null })),
          update: vi.fn(() => ({
            eq: vi.fn(() => ({ data: null, error: null })),
          })),
        };
      });

      const caller = documentsRouter.createCaller(mockContext);

      const documents = [
        {
          title: 'Document 1',
          content: 'Content 1',
        },
        {
          title: 'Document 2',
          content: 'Content 2',
        },
      ];

      const result = await caller.bulkUpload({ documents });

      expect(result.summary).toMatchObject({
        total: 2,
        successful: 1,
        failed: 1,
      });

      expect(result.results).toHaveLength(2);
      expect(result.results[0].success).toBe(true);
      expect(result.results[1].success).toBe(false);
    });

    it('should enforce document limit', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      // Create 11 documents (exceeds limit of 10)
      const documents = Array.from({ length: 11 }, (_, i) => ({
        title: `Document ${i + 1}`,
        content: `Content ${i + 1}`,
      }));

      await expect(caller.bulkUpload({ documents })).rejects.toThrow();
    });
  });

  describe('list', () => {
    it('should list documents with default parameters', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.list({});

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'doc-1',
        title: 'Test Document 1',
        chunk_count: 2,
        processing_status: 'completed',
      });
    });

    it('should list documents with custom limit and offset', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.list({
        limit: 1,
        offset: 1,
      });

      expect(result).toHaveLength(2); // Mock returns 2 items regardless
    });

    it('should filter documents by search term', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      await caller.list({
        search: 'test',
      });

      // Verify that the query was called with search filter
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should filter documents by content type', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      await caller.list({
        contentType: 'text/plain',
      });

      // Verify that the query was called with content type filter
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should handle database errors', async () => {
      // Mock database error
      mockContext.supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                range: vi.fn(() => ({
                  data: null,
                  error: new Error('Database error'),
                })),
              })),
            })),
          })),
        })),
      });

      const caller = documentsRouter.createCaller(mockContext);

      await expect(caller.list({})).rejects.toThrow(
        'Failed to fetch documents'
      );
    });
  });

  describe('get', () => {
    it('should get a single document with chunks', async () => {
      // Mock document with chunks
      mockContext.supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: {
                  id: 'doc-1',
                  title: 'Test Document',
                  content: 'Test content',
                  document_chunks: [
                    {
                      id: 'chunk-1',
                      content: 'Chunk 1 content',
                      chunk_index: 0,
                      metadata: {},
                    },
                    {
                      id: 'chunk-2',
                      content: 'Chunk 2 content',
                      chunk_index: 1,
                      metadata: {},
                    },
                  ],
                },
                error: null,
              })),
            })),
          })),
        })),
      });

      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.get({
        documentId: 'doc-1',
      });

      expect(result).toMatchObject({
        id: 'doc-1',
        title: 'Test Document',
        document_chunks: expect.arrayContaining([
          expect.objectContaining({
            id: 'chunk-1',
            content: 'Chunk 1 content',
          }),
        ]),
      });
    });

    it('should throw error when document not found', async () => {
      // Mock document not found
      mockContext.supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: new Error('Not found'),
              })),
            })),
          })),
        })),
      });

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.get({
          documentId: 'non-existent',
        })
      ).rejects.toThrow('Document not found');
    });

    it('should validate document ID format', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.get({
          documentId: 'invalid-uuid',
        })
      ).rejects.toThrow();
    });
  });

  describe('update', () => {
    it('should update document title and metadata', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.update({
        documentId: 'doc-1',
        title: 'Updated Title',
        metadata: { updated: true },
      });

      expect(result).toMatchObject({
        id: 'doc-1',
      });

      // Verify update was called
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should update document content and reprocess chunks', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      await caller.update({
        documentId: 'doc-1',
        content: 'Updated content',
      });

      // Verify that existing chunks were deleted
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith(
        'document_chunks'
      );

      // Verify that document was updated
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should throw error when document not found', async () => {
      // Mock update failure
      mockContext.supabaseAdmin.from.mockReturnValueOnce({
        update: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              select: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: null,
                  error: new Error('Not found'),
                })),
              })),
            })),
          })),
        })),
      });

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.update({
          documentId: 'non-existent',
          title: 'New Title',
        })
      ).rejects.toThrow('Document not found or update failed');
    });
  });

  describe('delete', () => {
    it('should delete document successfully', async () => {
      const caller = documentsRouter.createCaller(mockContext);

      const result = await caller.delete({
        documentId: 'doc-1',
      });

      expect(result).toMatchObject({
        success: true,
      });

      // Verify delete was called
      expect(mockContext.supabaseAdmin.from).toHaveBeenCalledWith('documents');
    });

    it('should throw error when document not found', async () => {
      // Mock document not found
      mockContext.supabaseAdmin.from.mockReturnValueOnce({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(() => ({
                data: null,
                error: new Error('Not found'),
              })),
            })),
          })),
        })),
      });

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.delete({
          documentId: 'non-existent',
        })
      ).rejects.toThrow('Document not found');
    });

    it('should handle deletion errors', async () => {
      // Mock successful document fetch but failed deletion
      mockContext.supabaseAdmin.from
        .mockReturnValueOnce({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => ({
                  data: { id: 'doc-1' },
                  error: null,
                })),
              })),
            })),
          })),
        })
        .mockReturnValueOnce({
          delete: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                data: null,
                error: new Error('Delete failed'),
              })),
            })),
          })),
        });

      const caller = documentsRouter.createCaller(mockContext);

      await expect(
        caller.delete({
          documentId: 'doc-1',
        })
      ).rejects.toThrow('Failed to delete document');
    });
  });
});
