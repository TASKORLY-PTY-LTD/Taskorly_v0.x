/**
 * Vector embedding service using Gemini AI
 * This service creates vector embeddings for text chunks using Google's Gemini API
 * The embeddings are then stored in Pinecone for semantic search and retrieval
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { env } from './env';
import { createLogger } from './logger';

// Interface for embedding configuration
export interface EmbeddingConfig {
  model: string;
  batchSize: number;
}

// Interface for embedding result
export interface EmbeddingResult {
  embedding: number[];
  metadata: {
    chunkId: string;
    documentId: string;
    tenantId: string;
    chunkIndex: number;
    content: string;
    contentLength: number;
    createdAt: string;
    title?: string;
    chunkType?: string;
    sectionTitle?: string;
  };
}

// Default embedding configuration
const DEFAULT_CONFIG: EmbeddingConfig = {
  model: 'text-embedding-004', // Google's latest embedding model
  batchSize: 100, // Process up to 100 chunks at once
};

/**
 * Initialize Gemini AI client for embeddings
 * This creates a connection to Google's Gemini API specifically for embedding generation
 */
function initializeGeminiEmbeddingClient(): GoogleGenerativeAI {
  if (!env.GOOGLE_API_KEY) {
    throw new Error(
      'Google API key is not configured. Please set GOOGLE_API_KEY in your environment variables.'
    );
  }

  return new GoogleGenerativeAI(env.GOOGLE_API_KEY);
}

/**
 * Generate vector embeddings for text chunks using Gemini AI
 * This function takes an array of text chunks and returns their vector embeddings
 *
 * @param chunks - Array of text chunks to embed
 * @param documentId - Unique identifier for the document
 * @param userId - Unique identifier for the user
 * @param tenantId - Unique identifier for the tenant
 * @param config - Optional embedding configuration
 * @returns Array of embedding results with metadata
 */
export async function generateEmbeddings(
  chunks: Array<{ content: string; chunkIndex: number; chunkId: string }>,
  documentId: string,
  userId: string,
  tenantId: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<EmbeddingResult[]> {
  // Create logger for this operation
  const logger = createLogger(tenantId, userId);

  try {
    // Merge provided config with defaults
    const embeddingConfig = { ...DEFAULT_CONFIG, ...config };

    // Initialize Gemini client
    const genAI = initializeGeminiEmbeddingClient();

    // Log the start of embedding generation
    await logger.info(
      `Starting vector embedding generation for ${chunks.length} chunks`,
      {
        documentId,
        chunkCount: chunks.length,
        model: embeddingConfig.model,
        batchSize: embeddingConfig.batchSize,
      }
    );

    const results: EmbeddingResult[] = [];

    // Process chunks in batches to avoid API rate limits
    for (let i = 0; i < chunks.length; i += embeddingConfig.batchSize) {
      const batch = chunks.slice(i, i + embeddingConfig.batchSize);

      try {
        // Generate embeddings for this batch
        const batchResults = await processBatch(
          batch,
          documentId,
          tenantId,
          embeddingConfig,
          genAI
        );
        results.push(...batchResults);

        // Log progress for monitoring
        await logger.info(
          `Processed embedding batch ${Math.floor(i / embeddingConfig.batchSize) + 1}`,
          {
            documentId,
            batchSize: batch.length,
            totalProcessed: Math.min(
              i + embeddingConfig.batchSize,
              chunks.length
            ),
            totalChunks: chunks.length,
          }
        );

        // Small delay between batches to respect rate limits
        if (i + embeddingConfig.batchSize < chunks.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } catch (batchError) {
        // Log batch error but continue with other batches
        await logger.error(
          `Failed to process embedding batch ${Math.floor(i / embeddingConfig.batchSize) + 1}`,
          {
            documentId,
            batchSize: batch.length,
            error:
              batchError instanceof Error
                ? batchError.message
                : 'Unknown batch error',
          }
        );

        // Continue with next batch instead of failing completely
        continue;
      }
    }

    // Log successful completion
    await logger.info(
      `Successfully generated ${results.length} vector embeddings`,
      {
        documentId,
        totalChunks: chunks.length,
        successfulEmbeddings: results.length,
        failedEmbeddings: chunks.length - results.length,
      }
    );

    return results;
  } catch (error) {
    // Log the error and re-throw for upstream handling
    await logger.error(
      `Vector embedding generation failed for document: ${documentId}`,
      {
        documentId,
        chunkCount: chunks.length,
        error:
          error instanceof Error ? error.message : 'Unknown embedding error',
        stack: error instanceof Error ? error.stack : undefined,
      }
    );

    throw new Error(
      `Failed to generate vector embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Process a batch of chunks to generate embeddings
 * This function handles the actual API call to Gemini for a single batch
 */
async function processBatch(
  batch: Array<{ content: string; chunkIndex: number; chunkId: string }>,
  documentId: string,
  tenantId: string,
  config: EmbeddingConfig,
  genAI: GoogleGenerativeAI
): Promise<EmbeddingResult[]> {
  try {
    // Prepare the text content for embedding
    // We'll embed each chunk individually to maintain proper metadata mapping
    const results: EmbeddingResult[] = [];

    for (const chunk of batch) {
      try {
        // Get the embedding model
        const model = genAI.getGenerativeModel({ model: config.model });

        // Generate embedding for this specific chunk
        const embedding = await model.embedContent({
          content: {
            role: 'user',
            parts: [{ text: chunk.content }],
          },
        });

        // Extract the embedding vector from the response
        const embeddingVector = embedding.embedding.values;

        // Create the embedding result with metadata
        results.push({
          embedding: embeddingVector,
          metadata: {
            chunkId: chunk.chunkId,
            documentId: documentId,
            tenantId: tenantId,
            chunkIndex: chunk.chunkIndex,
            content: chunk.content,
            contentLength: chunk.content.length,
            createdAt: new Date().toISOString(),
            title: `Document ${documentId} - Chunk ${chunk.chunkIndex}`,
          },
        });
      } catch (chunkError) {
        // Log individual chunk error but continue with other chunks in the batch
        console.error(`Failed to embed chunk ${chunk.chunkIndex}:`, chunkError);
        continue;
      }
    }

    return results;
  } catch (error) {
    throw new Error(
      `Batch processing failed: ${error instanceof Error ? error.message : 'Unknown batch error'}`
    );
  }
}

/**
 * Generate a single embedding for a text string
 * This is useful for query embeddings in search operations
 *
 * @param text - Text to embed
 * @param config - Optional embedding configuration
 * @returns Embedding vector as number array
 */
export async function generateSingleEmbedding(
  text: string,
  config: Partial<EmbeddingConfig> = {}
): Promise<number[]> {
  try {
    // Merge provided config with defaults
    const embeddingConfig = { ...DEFAULT_CONFIG, ...config };

    // Initialize Gemini client
    const genAI = initializeGeminiEmbeddingClient();

    // Get the embedding model
    const model = genAI.getGenerativeModel({ model: embeddingConfig.model });

    // Generate embedding for the text
    const embedding = await model.embedContent({
      content: {
        role: 'user',
        parts: [{ text: text }],
      },
    });

    // Extract and return the embedding vector
    return embedding.embedding.values;
  } catch (error) {
    throw new Error(
      `Failed to generate single embedding: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Validate embedding configuration
 * This function checks if the provided configuration is valid
 *
 * @param config - Configuration to validate
 * @returns True if valid, throws error if invalid
 */
export function validateEmbeddingConfig(
  config: Partial<EmbeddingConfig>
): boolean {
  if (config.batchSize && (config.batchSize < 1 || config.batchSize > 1000)) {
    throw new Error('Batch size must be between 1 and 1000');
  }

  return true;
}

/**
 * Get embedding model information
 * This function returns information about the embedding model being used
 *
 * @param config - Optional embedding configuration
 * @returns Model information object
 */
export function getEmbeddingModelInfo(config: Partial<EmbeddingConfig> = {}): {
  model: string;
  maxTokens: number;
  costPerToken: number;
} {
  const embeddingConfig = { ...DEFAULT_CONFIG, ...config };

  return {
    model: embeddingConfig.model,
    maxTokens: 2048, // Standard limit for text-embedding-004
    costPerToken: 0.0000001, // Rough cost estimate per token
  };
}
