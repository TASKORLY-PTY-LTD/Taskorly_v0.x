/**
 * Pinecone vector database integration service
 * This service handles storing, updating, and querying vector embeddings in Pinecone
 * It provides a clean interface for vector operations in the RAG system
 */

import { Pinecone } from '@pinecone-database/pinecone';
import { env } from './env';
import { createLogger } from './logger';
import type { EmbeddingResult } from './vector-embedder';
import _ from 'lodash';
import { id } from 'zod/v4/locales';

// Interface for Pinecone configuration
export interface PineconeConfig {
  apiKey: string;
  environment: string;
  indexName: string;
  namespace?: string;
}

// Interface for vector search result
export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: {
    chunkId: string;
    documentId: string;
    tenantId: string;
    chunkIndex: number;
    content: string;
    contentLength: number;
    createdAt: string;
  };
}

// Interface for vector upsert result
export interface VectorUpsertResult {
  success: boolean;
  upsertedCount: number;
  failedCount: number;
  errors: string[];
}

// Default Pinecone configuration
const DEFAULT_CONFIG: PineconeConfig = {
  apiKey: env.PINECONE_API_KEY || '',
  environment: env.PINECONE_ENVIRONMENT || '',
  indexName: env.PINECONE_INDEX_NAME || '',
  namespace: 'default', // Default namespace for all vectors
};

/**
 * Initialize Pinecone client
 * This creates a connection to the Pinecone vector database
 */
function initializePineconeClient(): Pinecone {
  if (!env.PINECONE_API_KEY) {
    throw new Error('Pinecone API key is not configured. Please set PINECONE_API_KEY in your environment variables.');
  }
  
  if (!env.PINECONE_INDEX_NAME) {
    throw new Error('Pinecone index name is not configured. Please set PINECONE_INDEX_NAME in your environment variables.');
  }

  return new Pinecone({
    apiKey: env.PINECONE_API_KEY,
  });
}

/**
 * Get Pinecone index instance
 * This returns the configured Pinecone index for vector operations
 */
async function getPineconeIndex(config: Partial<PineconeConfig> = {}) {
  const pineconeConfig = _.merge({}, DEFAULT_CONFIG, config );
  const pinecone = initializePineconeClient();
  
  return pinecone.index(pineconeConfig.indexName);
}

/**
 * Store vector embeddings in Pinecone
 * This function takes embedding results and stores them in the Pinecone vector database
 * 
 * @param embeddings - Array of embedding results to store
 * @param tenantId - Unique identifier for the tenant (used for namespace isolation)
 * @param userId - Unique identifier for the user (for logging purposes)
 * @param config - Optional Pinecone configuration
 * @returns Upsert result with success/failure information
 */
export async function storeEmbeddings(
  embeddings: EmbeddingResult[],
  tenantId: string,
  userId: string,
  config: Partial<PineconeConfig> = {namespace: `default-${tenantId}` }
): Promise<VectorUpsertResult> {
  // Create logger for this operation
  const logger = createLogger(tenantId, userId);
  
  try {
    // Merge provided config with defaults
    const pineconeConfig = _.merge({}, DEFAULT_CONFIG, config );
    
    // Get Pinecone index
    const index = await getPineconeIndex(pineconeConfig);
    
    // Log the start of vector storage
    await logger.info(`Starting vector storage for ${embeddings.length} embeddings`, {
      embeddingCount: embeddings.length,
      indexName: pineconeConfig.indexName,
      namespace: `${pineconeConfig.namespace}`,
    });

    // Prepare vectors for upsert
    const vectors = embeddings.map((embedding, index) => ({
      id: `${tenantId}-${embedding.metadata.documentId}-${embedding.metadata.chunkId}`,
      values: embedding.embedding,
      metadata: {
        chunkId: embedding.metadata.chunkId,
        documentId: embedding.metadata.documentId,
        tenantId: embedding.metadata.tenantId,
        content: embedding.metadata.content,
        chunkIndex: embedding.metadata.chunkIndex,
        contentLength: embedding.metadata.contentLength,
        createdAt: embedding.metadata.createdAt,
      },
    }));

    // Upsert vectors to Pinecone in batches
    const batchSize = 100; // Pinecone recommended batch size
    let upsertedCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      
      try {
        // Upsert batch to Pinecone
        await index.namespace(`${pineconeConfig.namespace}`).upsert(batch);
        upsertedCount += batch.length;
        
        // Log batch progress
        await logger.info(`Upserted vector batch ${Math.floor(i / batchSize) + 1}`, {
          batchSize: batch.length,
          totalProcessed: Math.min(i + batchSize, vectors.length),
          totalVectors: vectors.length,
        });
        
      } catch (batchError) {
        // Log batch error and continue with other batches
        const errorMessage = `Batch ${Math.floor(i / batchSize) + 1} failed: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`;
        errors.push(errorMessage);
        failedCount += batch.length;
        
        await logger.error(`Failed to upsert vector batch ${Math.floor(i / batchSize) + 1}`, {
          batchSize: batch.length,
          error: batchError instanceof Error ? batchError.message : 'Unknown batch error',
        });
      }
    }

    // Log completion
    await logger.info(`Vector storage completed: ${upsertedCount} successful, ${failedCount} failed`, {
      totalEmbeddings: embeddings.length,
      upsertedCount,
      failedCount,
      errorCount: errors.length,
    });

    return {
      success: upsertedCount > 0,
      upsertedCount,
      failedCount,
      errors,
    };

  } catch (error) {
    // Log the error and re-throw for upstream handling
    await logger.error(`Vector storage failed`, {
      embeddingCount: embeddings.length,
      error: error instanceof Error ? error.message : 'Unknown storage error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    throw new Error(`Failed to store vectors in Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Search for similar vectors in Pinecone
 * This function performs semantic search using vector similarity
 * 
 * @param queryEmbedding - Query vector for similarity search
 * @param tenantId - Unique identifier for the tenant (used for namespace filtering)
 * @param userId - Unique identifier for the user (for logging purposes)
 * @param options - Search options
 * @returns Array of search results with similarity scores
 */
export async function searchSimilarVectors(
  queryEmbedding: number[],
  tenantId: string,
  userId: string,
  options: {
    topK?: number;
    filter?: Record<string, any>;
    includeMetadata?: boolean;
    config?: Partial<PineconeConfig>;
  } = {}
): Promise<VectorSearchResult[]> {
  // Create logger for this operation
  const logger = createLogger(tenantId, userId);
  
  try {
    // Merge provided config with defaults
    const pineconeConfig = _.merge({}, DEFAULT_CONFIG, options?.config );
    
    // Get Pinecone index
    const index = await getPineconeIndex(pineconeConfig);
    
    // Prepare search options
    const searchOptions = {
      vector: queryEmbedding,
      topK: options.topK || 10,
      includeMetadata: options.includeMetadata !== false, // Default to true
      filter: {
        tenantId: { $eq: tenantId },
        ...options.filter,
      },
    };

    // Log the search operation
    await logger.info(`Starting vector search`, {
      topK: searchOptions.topK,
      hasFilter: !!options.filter,
      namespace: `${pineconeConfig.namespace}`,
    });

    // Perform the search
    const searchResponse = await index.namespace(`${pineconeConfig.namespace}`).query(searchOptions);

    // Transform results to our interface
    const results: VectorSearchResult[] = searchResponse.matches?.map(match => ({
      id: match.id || '',
      score: match.score || 0,
      metadata: {
        chunkId: match.metadata?.chunkId as string || '',
        documentId: match.metadata?.documentId as string || '',
        tenantId: match.metadata?.tenantId as string || '',
        chunkIndex: match.metadata?.chunkIndex as number || 0,
        content: match.metadata?.content as string || '',
        contentLength: match.metadata?.contentLength as number || 0,
        createdAt: match.metadata?.createdAt as string || '',
      },
    })) || [];

    // Log search results
    await logger.info(`Vector search completed: ${results.length} results found`, {
      resultCount: results.length,
      averageScore: results.length > 0 ? results.reduce((sum, r) => sum + r.score, 0) / results.length : 0,
    });

    return results;

  } catch (error) {
    // Log the error and re-throw for upstream handling
    await logger.error(`Vector search failed`, {
      topK: options.topK,
      error: error instanceof Error ? error.message : 'Unknown search error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    
    throw new Error(`Failed to search vectors in Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Delete vectors from Pinecone
 * This function removes vectors associated with a specific document or tenant
 * 
 * @param ids - Array of vector IDs to delete
 * @param tenantId - Unique identifier for the tenant (used for namespace filtering)
 * @param userId - Unique identifier for the user (for logging purposes)
 * @param config - Optional Pinecone configuration
 * @returns Deletion result
 */
export async function deleteVectors(
  ids: string[],
  tenantId: string,
  userId: string,
  config: Partial<PineconeConfig> = {namespace: `default-${tenantId}` }
): Promise<{ success: boolean; deletedCount: number; errors: string[] }> {
  const logger = createLogger(tenantId, userId);
  
  try {
    const pineconeConfig = _.merge({}, DEFAULT_CONFIG, config);
    const index = await getPineconeIndex(pineconeConfig);
    
    await logger.info(`Starting individual vector deletion for ${ids.length} vectors`, {
      vectorCount: ids.length,
      namespace: pineconeConfig.namespace,
    });

    let deletedCount = 0;
    const errors: string[] = [];

    // Delete each vector individually
    for (const vectorId of ids) {
      try {
        await index.namespace(`${pineconeConfig.namespace}`).deleteOne(vectorId);
        deletedCount++;
      } catch (error) {
        const errorMessage = `Failed to delete vector ${vectorId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMessage);
        
        await logger.warn(`Individual vector deletion failed`, {
          vectorId,
          error: errorMessage,
        });
      }
    }

    await logger.info(`Completed individual deletions: ${deletedCount}/${ids.length} successful`, {
      totalVectors: ids.length,
      deletedCount,
      errorCount: errors.length,
    });

    return {
      success: deletedCount > 0,
      deletedCount,
      errors,
    };

  } catch (error) {
    await logger.error(`Vector deletion failed`, {
      vectorCount: ids.length,
      error: error instanceof Error ? error.message : 'Unknown deletion error',
    });
    
    throw new Error(`Failed to delete vectors from Pinecone: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get vector statistics for a tenant
 * This function provides information about stored vectors
 * 
 * @param tenantId - Unique identifier for the tenant
 * @param config - Optional Pinecone configuration
 * @returns Vector statistics
 */
export async function getVectorStats(
  tenantId: string,
  config: Partial<PineconeConfig> = {namespace: `default-${tenantId}` }
): Promise<{
  totalVectors: number;
  namespace: string;
  indexName: string;
}> {
  try {
    // Merge provided config with defaults
    const pineconeConfig = _.merge({}, DEFAULT_CONFIG, config );
    
    // Get Pinecone index
    const index = await getPineconeIndex(pineconeConfig);
    
    // Get index statistics
    const stats = await index.describeIndexStats();
    
    return {
      totalVectors: stats.totalRecordCount || 0,
      namespace: `${pineconeConfig.namespace}-${tenantId}`,
      indexName: pineconeConfig.indexName,
    };

  } catch (error) {
    throw new Error(`Failed to get vector statistics: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate Pinecone configuration
 * This function checks if the provided configuration is valid
 * 
 * @param config - Configuration to validate
 * @returns True if valid, throws error if invalid
 */
export function validatePineconeConfig(config: Partial<PineconeConfig>): boolean {
  const pineconeConfig = _.merge({}, DEFAULT_CONFIG, config );
  
  if (!pineconeConfig.apiKey) {
    throw new Error('Pinecone API key is required');
  }
  
  if (!pineconeConfig.indexName) {
    throw new Error('Pinecone index name is required');
  }
  
  if (!pineconeConfig.environment) {
    throw new Error('Pinecone environment is required');
  }
  
  return true;
}
