/**
 * Gemini API integration for document chunking
 * This service uses Google's Gemini API to intelligently chunk documents
 * for better RAG performance and semantic understanding
 */

import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { env } from './env';

// Interface for chunk data structure
export interface DocumentChunk {
  content: string;
  chunkIndex: number;
  metadata: {
    documentId: string;
    originalTitle: string;
    contentType: string;
    wordCount: number;
    charCount: number;
    chunkType?: string; // e.g., 'header', 'paragraph', 'list', 'table'
    sectionTitle?: string; // If the chunk is part of a section
    pageNumber?: number; // If applicable
    createdAt: string;
  };
}

// Interface for chunking configuration
export interface ChunkingConfig {
  maxChunkSize: number; // Maximum characters per chunk
  overlapSize: number; // Overlap between chunks for context
  preserveStructure: boolean; // Whether to preserve document structure
  extractMetadata: boolean; // Whether to extract additional metadata
}

// Default chunking configuration
const DEFAULT_CONFIG: ChunkingConfig = {
  maxChunkSize: 1000, // 1000 characters per chunk
  overlapSize: 100, // 100 character overlap
  preserveStructure: true,
  extractMetadata: true,
};

/**
 * Initialize Gemini AI client
 * This creates a connection to Google's Gemini API using the configured API key
 */
function initializeGeminiClient(): ChatGoogleGenerativeAI {
  if (!env.GOOGLE_API_KEY) {
    throw new Error('Google API key is not configured. Please set GOOGLE_API_KEY in your environment variables.');
  }

  return new ChatGoogleGenerativeAI({
    apiKey: env.GOOGLE_API_KEY,
    model: 'gemini-1.5-flash', // Using the faster model for chunking
  });
}

/**
 * Chunk a document using Gemini AI for intelligent text segmentation
 * This function uses AI to understand document structure and create meaningful chunks
 * 
 * @param content - The full document content to chunk
 * @param documentId - Unique identifier for the document
 * @param title - Document title for context
 * @param contentType - MIME type of the document
 * @param config - Optional chunking configuration
 * @returns Array of document chunks with metadata
 */
export async function chunkDocumentWithGemini(
  content: string,
  documentId: string,
  title: string,
  contentType: string,
  config: Partial<ChunkingConfig> = {}
): Promise<DocumentChunk[]> {
  try {
    // Merge provided config with defaults
    const chunkingConfig = { ...DEFAULT_CONFIG, ...config };
    
    // Initialize Gemini client
    const gemini = initializeGeminiClient();
    
    // Create the chunking prompt for Gemini
    const chunkingPrompt = createChunkingPrompt(content, chunkingConfig);
    
    console.log(`Starting Gemini chunking for document: ${title}`);
    console.log(`Content length: ${content.length} characters`);
    console.log(`Max chunk size: ${chunkingConfig.maxChunkSize} characters`);
    
    // Call Gemini API to get intelligent chunks
    const response = await gemini.invoke([{ role: 'user', content: chunkingPrompt }]);
    
    // Parse the response and create chunks
    const chunks = parseGeminiResponse(response, documentId, title, contentType, chunkingConfig);
    
    console.log(`Successfully created ${chunks.length} chunks for document: ${title}`);
    
    return chunks;
    
  } catch (error) {
    console.error('Error chunking document with Gemini:', error);
    
    // Fallback to simple text chunking if Gemini fails
    console.log('Falling back to simple text chunking...');
    return createSimpleChunks(content, documentId, title, contentType, config);
  }
}

/**
 * Create a detailed prompt for Gemini to intelligently chunk the document
 * This prompt instructs Gemini to understand document structure and create meaningful chunks
 */
function createChunkingPrompt(content: string, config: ChunkingConfig): string {
  return `You are an expert document processor. Your task is to intelligently chunk the following document into meaningful segments for a RAG (Retrieval Augmented Generation) system.

CHUNKING REQUIREMENTS:
- Maximum chunk size: ${config.maxChunkSize} characters
- Overlap between chunks: ${config.overlapSize} characters
- Preserve document structure: ${config.preserveStructure}
- Extract metadata: ${config.extractMetadata}

CHUNKING GUIDELINES:
1. Break at natural boundaries (paragraphs, sections, headers)
2. Maintain context and meaning within each chunk
3. Include relevant metadata for each chunk (section title, chunk type, etc.)
4. Ensure chunks are semantically coherent
5. Preserve important formatting and structure
6. Add overlap between chunks to maintain context

DOCUMENT TO CHUNK:
Title: ${content.substring(0, 100)}...
Content Length: ${content.length} characters

Please analyze this document and return a JSON array of chunks in the following format:
[
  {
    "content": "The actual text content of the chunk",
    "chunkIndex": 0,
    "metadata": {
      "chunkType": "header|paragraph|list|table|section",
      "sectionTitle": "Title of the section this chunk belongs to",
      "pageNumber": 1,
      "wordCount": 150,
      "charCount": 800
    }
  }
]

IMPORTANT: Return ONLY the JSON array, no additional text or formatting. Each chunk should be meaningful and self-contained while staying within the character limit.

DOCUMENT CONTENT:
${content}`;
}

/**
 * Parse Gemini's response and convert it to DocumentChunk objects
 * This function processes the AI response and creates structured chunk data
 */
function parseGeminiResponse(
  response: any,
  documentId: string,
  title: string,
  contentType: string,
  config: ChunkingConfig
): DocumentChunk[] {
  try {
    // Extract the text content from Gemini's response
    let responseText = '';
    
    if (typeof response === 'string') {
      responseText = response;
    } else if (response && typeof response === 'object') {
      // Handle different response formats from ChatGoogleGenerativeAI
      if (response.content) {
        responseText = response.content;
      } else if (response.text) {
        responseText = response.text;
      } else if (response.message && response.message.content) {
        responseText = response.message.content;
      } else if (Array.isArray(response) && response.length > 0) {
        // Handle array of messages
        responseText = response[0].content || response[0].text || '';
      } else {
        responseText = JSON.stringify(response);
      }
    }
    
    console.log('Gemini response received:', responseText.substring(0, 200) + '...');
    
    // Try to parse as JSON
    let chunksData;
    try {
      // Clean the response to extract JSON
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        chunksData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON array found in response');
      }
    } catch (parseError) {
      console.warn('Failed to parse Gemini response as JSON, falling back to simple chunking');
      return createSimpleChunks(responseText, documentId, title, contentType, config);
    }
    
    // Validate and convert to DocumentChunk format
    const chunks: DocumentChunk[] = [];
    const now = new Date().toISOString();
    
    for (let i = 0; i < chunksData.length; i++) {
      const chunkData = chunksData[i];
      
      // Validate required fields
      if (!chunkData.content || typeof chunkData.content !== 'string') {
        console.warn(`Skipping invalid chunk at index ${i}: missing or invalid content`);
        continue;
      }
      
      // Create the chunk object
      const chunk: DocumentChunk = {
        content: chunkData.content.trim(),
        chunkIndex: chunkData.chunkIndex ?? i,
        metadata: {
          documentId,
          originalTitle: title,
          contentType,
          wordCount: chunkData.metadata?.wordCount ?? chunkData.content.split(/\s+/).length,
          charCount: chunkData.content.length,
          chunkType: chunkData.metadata?.chunkType || 'paragraph',
          sectionTitle: chunkData.metadata?.sectionTitle,
          pageNumber: chunkData.metadata?.pageNumber,
          createdAt: now,
        },
      };
      
      // Validate chunk size
      if (chunk.content.length > config.maxChunkSize * 1.1) { // Allow 10% tolerance
        console.warn(`Chunk ${i} exceeds maximum size: ${chunk.content.length} characters`);
      }
      
      chunks.push(chunk);
    }
    
    return chunks;
    
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    throw new Error(`Failed to parse Gemini chunking response: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Fallback function to create simple chunks when Gemini fails
 * This provides basic text chunking as a backup method
 */
function createSimpleChunks(
  content: string,
  documentId: string,
  title: string,
  contentType: string,
  config: Partial<ChunkingConfig> = {}
): DocumentChunk[] {
  const chunkingConfig = { ...DEFAULT_CONFIG, ...config };
  const chunks: DocumentChunk[] = [];
  const now = new Date().toISOString();
  
  // Split content into paragraphs first
  const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
  
  let chunkIndex = 0;
  let currentChunk = '';
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    
    // If adding this paragraph would exceed the limit, save current chunk
    if (currentChunk && (currentChunk.length + trimmedParagraph.length) > chunkingConfig.maxChunkSize) {
      chunks.push(createChunkObject(currentChunk, chunkIndex, documentId, title, contentType, now));
      chunkIndex++;
      currentChunk = trimmedParagraph;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
  }
  
  // Add the last chunk if there's content
  if (currentChunk.trim()) {
    chunks.push(createChunkObject(currentChunk, chunkIndex, documentId, title, contentType, now));
  }
  
  return chunks;
}

/**
 * Helper function to create a chunk object with metadata
 * This standardizes the chunk creation process
 */
function createChunkObject(
  content: string,
  chunkIndex: number,
  documentId: string,
  title: string,
  contentType: string,
  createdAt: string
): DocumentChunk {
  return {
    content: content.trim(),
    chunkIndex,
    metadata: {
      documentId,
      originalTitle: title,
      contentType,
      wordCount: content.split(/\s+/).filter(word => word.length > 0).length,
      charCount: content.length,
      chunkType: 'paragraph',
      createdAt,
    },
  };
}

/**
 * Validate chunking configuration
 * This ensures the configuration is valid before processing
 */
export function validateChunkingConfig(config: Partial<ChunkingConfig>): ChunkingConfig {
  const validatedConfig = { ...DEFAULT_CONFIG, ...config };
  
  if (validatedConfig.maxChunkSize < 100) {
    throw new Error('Maximum chunk size must be at least 100 characters');
  }
  
  if (validatedConfig.overlapSize < 0) {
    throw new Error('Overlap size cannot be negative');
  }
  
  if (validatedConfig.overlapSize >= validatedConfig.maxChunkSize) {
    throw new Error('Overlap size must be less than maximum chunk size');
  }
  
  return validatedConfig;
}

/**
 * Get chunking statistics for monitoring
 * This provides insights into the chunking process
 */
export function getChunkingStats(chunks: DocumentChunk[]): {
  totalChunks: number;
  averageChunkSize: number;
  totalCharacters: number;
  chunkTypes: Record<string, number>;
} {
  const totalChunks = chunks.length;
  const totalCharacters = chunks.reduce((sum, chunk) => sum + chunk.content.length, 0);
  const averageChunkSize = totalChunks > 0 ? Math.round(totalCharacters / totalChunks) : 0;
  
  const chunkTypes: Record<string, number> = {};
  chunks.forEach(chunk => {
    const type = chunk.metadata.chunkType || 'unknown';
    chunkTypes[type] = (chunkTypes[type] || 0) + 1;
  });
  
  return {
    totalChunks,
    averageChunkSize,
    totalCharacters,
    chunkTypes,
  };
}
