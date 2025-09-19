/**
 * Vector processing orchestrator
 * This service coordinates the complete vector processing pipeline:
 * 1. Generate embeddings using Gemini AI
 * 2. Store embeddings in Pinecone
 * 3. Handle errors and provide comprehensive logging
 * 4. Track usage and costs
 */

import { generateEmbeddings, type EmbeddingResult } from './vector-embedder';
import { storeEmbeddings, type VectorUpsertResult } from './pinecone-client';
import { createLogger } from './logger';
import type { DocumentChunk } from './gemini-chunker';

// Interface for vector processing configuration
export interface VectorProcessingConfig {
  embedding: {
    model: string;
    batchSize: number;
    dimensions?: number;
  };
  pinecone: {
    namespace?: string;
  };
}

// Interface for vector processing result
export interface VectorProcessingResult {
  success: boolean;
  totalChunks: number;
  successfulEmbeddings: number;
  successfulStorages: number;
  failedEmbeddings: number;
  failedStorages: number;
  totalTokens: number;
  processingTime: number;
  errors: string[];
}

// Default configuration
const DEFAULT_CONFIG: VectorProcessingConfig = {
  embedding: {
    model: 'text-embedding-004',
    batchSize: 100,
    dimensions: 768,
  },
  pinecone: {
    namespace: 'default',
  },
};

/**
 * Process document chunks through the complete vector pipeline
 * This function handles the entire process from text chunks to stored vectors
 * 
 * @param chunks - Array of document chunks to process
 * @param documentId - Unique identifier for the document
 * @param tenantId - Unique identifier for the tenant
 * @param config - Optional processing configuration
 * @returns Vector processing result with detailed metrics
 */
export async function processDocumentVectors(
  chunks: DocumentChunk[],
  documentId: string,
  tenantId: string,
  config: Partial<VectorProcessingConfig> = {}
): Promise<VectorProcessingResult> {
  // Create logger for this operation
  const logger = createLogger(tenantId, '00000000-0000-0000-0000-000000000000');
  
  // Record start time for performance tracking
  const startTime = Date.now();
  
  try {
    // Merge provided config with defaults
    const processingConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Log the start of vector processing
    await logger.info(`Starting vector processing for document: ${documentId}`, {
      documentId,
      chunkCount: chunks.length,
      embeddingModel: processingConfig.embedding.model,
      batchSize: processingConfig.embedding.batchSize,
    });

    // Prepare chunks for embedding generation
    const chunksForEmbedding = chunks.map((chunk, index) => ({
      content: chunk.content,
      chunkIndex: chunk.chunkIndex,
      chunkId: `${tenantId}-${documentId}-chunk-${chunk.chunkIndex}`,
    }));

    // ===== STEP 1: GENERATE EMBEDDINGS =====
    let embeddings: EmbeddingResult[] = [];
    const embeddingErrors: string[] = [];
    
    try {
      embeddings = await generateEmbeddings(
        chunksForEmbedding,
        documentId,
        tenantId,
        processingConfig.embedding
      );
      
      // Log successful embedding generation
      await logger.info(`Successfully generated ${embeddings.length} embeddings`, {
        documentId,
        totalChunks: chunks.length,
        successfulEmbeddings: embeddings.length,
        failedEmbeddings: chunks.length - embeddings.length,
      });
      
    } catch (embeddingError) {
      const errorMessage = `Embedding generation failed: ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`;
      embeddingErrors.push(errorMessage);
      
      await logger.error(`Embedding generation failed for document: ${documentId}`, {
        documentId,
        chunkCount: chunks.length,
        error: errorMessage,
      });
      
      // If no embeddings were generated, we can't proceed with storage
      if (embeddings.length === 0) {
        return {
          success: false,
          totalChunks: chunks.length,
          successfulEmbeddings: 0,
          successfulStorages: 0,
          failedEmbeddings: chunks.length,
          failedStorages: 0,
          totalTokens: 0,
          processingTime: Date.now() - startTime,
          errors: embeddingErrors,
        };
      }
    }

    // ===== STEP 2: STORE EMBEDDINGS IN PINECONE =====
    let storageResult: VectorUpsertResult | null = null;
    const storageErrors: string[] = [];
    
    if (embeddings.length > 0) {
      try {
        storageResult = await storeEmbeddings(
          embeddings,
          tenantId,
          processingConfig.pinecone
        );
        
        // Log successful storage
        await logger.info(`Successfully stored ${storageResult.upsertedCount} vectors in Pinecone`, {
          documentId,
          totalEmbeddings: embeddings.length,
          upsertedCount: storageResult.upsertedCount,
          failedCount: storageResult.failedCount,
        });
        
        // Add any storage errors to our error list
        storageErrors.push(...storageResult.errors);
        
      } catch (storageError) {
        const errorMessage = `Vector storage failed: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`;
        storageErrors.push(errorMessage);
        
        await logger.error(`Vector storage failed for document: ${documentId}`, {
          documentId,
          embeddingCount: embeddings.length,
          error: errorMessage,
        });
      }
    }

    // ===== STEP 3: CALCULATE METRICS AND COSTS =====
    const processingTime = Date.now() - startTime;
    const totalTokens = calculateTokenUsage(chunks);
    const allErrors = [...embeddingErrors, ...storageErrors];
    
    // Determine overall success
    const success = embeddings.length > 0 && (storageResult?.success || false);
    
    // Log final results
    await logger.info(`Vector processing completed for document: ${documentId}`, {
      documentId,
      success,
      totalChunks: chunks.length,
      successfulEmbeddings: embeddings.length,
      successfulStorages: storageResult?.upsertedCount || 0,
      failedEmbeddings: chunks.length - embeddings.length,
      failedStorages: storageResult?.failedCount || 0,
      totalTokens,
      processingTime,
      errorCount: allErrors.length,
    });

    return {
      success,
      totalChunks: chunks.length,
      successfulEmbeddings: embeddings.length,
      successfulStorages: storageResult?.upsertedCount || 0,
      failedEmbeddings: chunks.length - embeddings.length,
      failedStorages: storageResult?.failedCount || 0,
      totalTokens,
      processingTime,
      errors: allErrors,
    };

  } catch (error) {
    // Log unexpected errors
    const processingTime = Date.now() - startTime;
    const errorMessage = `Vector processing failed unexpectedly: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    await logger.error(`Vector processing failed for document: ${documentId}`, {
      documentId,
      chunkCount: chunks.length,
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
      processingTime,
    });

    return {
      success: false,
      totalChunks: chunks.length,
      successfulEmbeddings: 0,
      successfulStorages: 0,
      failedEmbeddings: chunks.length,
      failedStorages: 0,
      totalTokens: 0,
      processingTime,
      errors: [errorMessage],
    };
  }
}

/**
 * Calculate token usage for cost tracking
 * This function estimates the number of tokens used for embedding generation
 * 
 * @param chunks - Array of document chunks
 * @returns Estimated token count
 */
function calculateTokenUsage(chunks: DocumentChunk[]): number {
  // Rough estimation: 1 token ≈ 4 characters for English text
  // This is a simplified calculation for cost tracking
  return chunks.reduce((total, chunk) => {
    return total + Math.ceil(chunk.content.length / 4);
  }, 0);
}

/**
 * Process vectors for a single chunk
 * This function handles vector processing for individual chunks (useful for updates)
 * 
 * @param chunk - Single document chunk to process
 * @param documentId - Unique identifier for the document
 * @param tenantId - Unique identifier for the tenant
 * @param config - Optional processing configuration
 * @returns Vector processing result
 */
export async function processSingleChunkVectors(
  chunk: DocumentChunk,
  documentId: string,
  tenantId: string,
  config: Partial<VectorProcessingConfig> = {}
): Promise<VectorProcessingResult> {
  // Convert single chunk to array format
  const chunks = [chunk];
  
  // Process using the main function
  return processDocumentVectors(chunks, documentId, tenantId, config);
}

/**
 * Delete vectors for a document
 * This function removes all vectors associated with a specific document
 * 
 * @param documentId - Unique identifier for the document
 * @param tenantId - Unique identifier for the tenant
 * @param chunkCount - Number of chunks to delete (for generating IDs)
 * @param config - Optional processing configuration
 * @returns Deletion result
 */
export async function deleteDocumentVectors(
  documentId: string,
  tenantId: string,
  chunkCount: number,
  config: Partial<VectorProcessingConfig> = {}
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  // Create logger for this operation
  const logger = createLogger(tenantId, '00000000-0000-0000-0000-000000000000');
  
  try {
    // Generate vector IDs to delete
    const vectorIds = Array.from({ length: chunkCount }, (_, index) => 
      `${tenantId}-${documentId}-chunk-${index}`
    );
    
    // Import deleteVectors function
    const { deleteVectors } = await import('./pinecone-client');
    
    // Delete vectors from Pinecone
    const result = await deleteVectors(vectorIds, tenantId, config.pinecone);
    
    // Log deletion results
    await logger.info(`Deleted ${result.deletedCount} vectors for document: ${documentId}`, {
      documentId,
      requestedCount: vectorIds.length,
      deletedCount: result.deletedCount,
      errorCount: result.errors.length,
    });
    
    return result;
    
  } catch (error) {
    const errorMessage = `Vector deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    
    await logger.error(`Vector deletion failed for document: ${documentId}`, {
      documentId,
      chunkCount,
      error: errorMessage,
    });
    
    return {
      success: false,
      deletedCount: 0,
      errors: [errorMessage],
    };
  }
}

/**
 * Validate vector processing configuration
 * This function checks if the provided configuration is valid
 * 
 * @param config - Configuration to validate
 * @returns True if valid, throws error if invalid
 */
export function validateVectorProcessingConfig(config: Partial<VectorProcessingConfig>): boolean {
  const processingConfig = { ...DEFAULT_CONFIG, ...config };
  
  // Validate embedding configuration
  if (processingConfig.embedding.batchSize < 1 || processingConfig.embedding.batchSize > 1000) {
    throw new Error('Embedding batch size must be between 1 and 1000');
  }
  
  if (processingConfig.embedding.dimensions && (processingConfig.embedding.dimensions < 1 || processingConfig.embedding.dimensions > 2048)) {
    throw new Error('Embedding dimensions must be between 1 and 2048');
  }
  
  return true;
}
