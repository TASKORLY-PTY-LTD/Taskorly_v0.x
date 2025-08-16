import { describe, it, expect, beforeEach, vi, beforeAll } from 'vitest';
import { RAGPipeline } from '../pipeline';
import type { RAGConfig } from '../pipeline';

// Mock dependencies
vi.mock('@langchain/openai');
vi.mock('@langchain/anthropic');
vi.mock('@langchain/google-genai');
vi.mock('@langchain/community/vectorstores/supabase');
vi.mock('@/lib/supabase', () => ({
  supabaseAdmin: {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({ error: null })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(() => ({ data: [], error: null })),
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
      delete: vi.fn(() => ({ eq: vi.fn(() => ({ error: null })) })),
    })),
  },
}));

describe('RAGPipeline', () => {
  let mockConfig: RAGConfig;

  beforeAll(() => {
    vi.stubEnv('ENCRYPTION_KEY', 'test-encryption-key-32-chars-long');
  });

  beforeEach(() => {
    mockConfig = {
      llm_provider: 'openai',
      llm_model: 'gpt-4',
      llm_api_key: 'test-api-key',
      embedding_model: 'text-embedding-3-large',
      embedding_api_key: 'test-embedding-key',
      temperature: 0.7,
      max_context_length: 8000,
      system_prompt: 'You are a helpful assistant.',
      vector_db_config: {},
      tenant_id: 'test-tenant-id',
    };
  });

  describe('constructor', () => {
    it('should initialize with OpenAI provider', () => {
      const pipeline = new RAGPipeline(mockConfig);
      expect(pipeline).toBeInstanceOf(RAGPipeline);
    });

    it('should initialize with Anthropic provider', () => {
      const anthropicConfig = { ...mockConfig, llm_provider: 'anthropic' };
      const pipeline = new RAGPipeline(anthropicConfig);
      expect(pipeline).toBeInstanceOf(RAGPipeline);
    });

    it('should initialize with Google provider', () => {
      const googleConfig = { ...mockConfig, llm_provider: 'google' };
      const pipeline = new RAGPipeline(googleConfig);
      expect(pipeline).toBeInstanceOf(RAGPipeline);
    });

    it('should throw error for unsupported provider', () => {
      const invalidConfig = { ...mockConfig, llm_provider: 'invalid' };
      expect(() => new RAGPipeline(invalidConfig)).toThrow(
        'Unsupported LLM provider: invalid'
      );
    });
  });

  describe('processDocument', () => {
    it('should process a document successfully', async () => {
      const pipeline = new RAGPipeline(mockConfig);
      const mockDocument = {
        id: 'doc-1',
        tenant_id: 'test-tenant-id',
        title: 'Test Document',
        content:
          'This is a test document with some content that should be processed.',
        content_type: 'text/plain',
        source_url: null,
        metadata: {},
      };

      // Mock the text splitter to return chunks
      vi.spyOn(pipeline as any, 'textSplitter', 'get').mockReturnValue({
        splitText: vi.fn().mockResolvedValue(['chunk1', 'chunk2']),
      });

      // Mock vector store addDocuments
      vi.spyOn(pipeline as any, 'vectorStore', 'get').mockReturnValue({
        addDocuments: vi.fn().mockResolvedValue(undefined),
      });

      const chunkCount = await pipeline.processDocument(mockDocument);
      expect(chunkCount).toBe(2);
    });

    it('should handle document processing errors', async () => {
      const pipeline = new RAGPipeline(mockConfig);
      const mockDocument = {
        id: 'doc-1',
        tenant_id: 'test-tenant-id',
        title: 'Test Document',
        content: 'Test content',
        content_type: 'text/plain',
        source_url: null,
        metadata: {},
      };

      // Mock text splitter to throw error
      vi.spyOn(pipeline as any, 'textSplitter', 'get').mockReturnValue({
        splitText: vi.fn().mockRejectedValue(new Error('Processing failed')),
      });

      await expect(pipeline.processDocument(mockDocument)).rejects.toThrow(
        'Failed to process document'
      );
    });
  });

  describe('searchDocuments', () => {
    it('should search documents and return results', async () => {
      const pipeline = new RAGPipeline(mockConfig);

      const mockResults = [
        [
          {
            pageContent: 'Test content',
            metadata: {
              document_id: 'doc-1',
              title: 'Test Doc',
              content_type: 'text/plain',
            },
          },
          0.85,
        ],
      ];

      // Mock vector store search
      vi.spyOn(pipeline as any, 'vectorStore', 'get').mockReturnValue({
        similaritySearchWithScore: vi.fn().mockResolvedValue(mockResults),
      });

      const results = await pipeline.searchDocuments('test query');

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({
        content: 'Test content',
        similarity: 0.85,
        metadata: expect.objectContaining({
          document_id: 'doc-1',
        }),
      });
    });

    it('should filter results by threshold', async () => {
      const pipeline = new RAGPipeline(mockConfig);

      const mockResults = [
        [
          { pageContent: 'Good match', metadata: { document_id: 'doc-1' } },
          0.85,
        ],
        [
          { pageContent: 'Poor match', metadata: { document_id: 'doc-2' } },
          0.5,
        ],
      ];

      // Mock vector store search
      vi.spyOn(pipeline as any, 'vectorStore', 'get').mockReturnValue({
        similaritySearchWithScore: vi.fn().mockResolvedValue(mockResults),
      });

      const results = await pipeline.searchDocuments('test query', 10, 0.7);

      expect(results).toHaveLength(1);
      expect(results[0].content).toBe('Good match');
    });
  });

  describe('estimateTokens', () => {
    it('should estimate token count', () => {
      const pipeline = new RAGPipeline(mockConfig);
      const text = 'This is a test sentence with multiple words.';

      // Access private method via any
      const tokenCount = (pipeline as any).estimateTokens(text);

      expect(tokenCount).toBeGreaterThan(0);
      expect(typeof tokenCount).toBe('number');
    });
  });

  describe('extractToolCalls', () => {
    it('should extract tool calls from response', () => {
      const pipeline = new RAGPipeline(mockConfig);
      const response = 'I will use search tool to find information.';
      const availableTools = [{ name: 'search', description: 'Search tool' }];

      // Access private method
      const toolCalls = (pipeline as any).extractToolCalls(
        response,
        availableTools
      );

      expect(toolCalls).toHaveLength(1);
      expect(toolCalls[0]).toMatchObject({
        name: 'search',
        description: 'Search tool',
      });
    });

    it('should return empty array when no tools detected', () => {
      const pipeline = new RAGPipeline(mockConfig);
      const response = 'This is a regular response without tool calls.';
      const availableTools = [{ name: 'search', description: 'Search tool' }];

      const toolCalls = (pipeline as any).extractToolCalls(
        response,
        availableTools
      );

      expect(toolCalls).toHaveLength(0);
    });
  });
});
