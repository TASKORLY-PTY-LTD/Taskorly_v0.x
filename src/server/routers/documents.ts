import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { chunkDocumentWithGemini, type DocumentChunk } from '@/lib/gemini-chunker';
import { processDocumentVectors } from '@/lib/vector-processor';
import { createLogger } from '@/lib/logger';

export const documentsRouter = createTRPCRouter({

  // Upload and process document for RAG with Gemini chunking
  upload: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        contentType: z.string().optional().default('text/plain'),
        sourceUrl: z.string().url().optional(),
        metadata: z.record(z.any()).optional().default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create logger with tenant and user context for better traceability
      const logger = createLogger(ctx.tenant?.id, ctx.user.id);
      
      try {
        // Create document record with processing status
        const { data: document, error: docError } = await ctx.supabaseAdmin
          .from('documents')
          .insert({
            tenant_id: ctx.tenant?.id!,
            title: input.title,
            content: input.content,
            content_type: input.contentType,
            source_url: input.sourceUrl,
            metadata: input.metadata,
            processing_status: 'processing',
            chunk_count: 0, // Will be updated after chunking
          })
          .select()
          .single();

        if (docError || !document) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create document',
          });
        }

        // Log the start of document processing for better monitoring
        await logger.info(`Starting Gemini chunking for document: ${input.title}`, {
          documentId: document.id,
          contentType: input.contentType,
          contentLength: input.content.length,
        });

        try {
          // Use Gemini to chunk the document intelligently
          // This AI-powered chunking creates semantically meaningful chunks rather than simple text splitting
          const chunks = await chunkDocumentWithGemini(
            input.content,
            document.id,
            input.title,
            input.contentType,
            {
              // Increased chunk size for better context preservation and RAG performance
              // 2000 characters provides optimal balance between context richness and retrieval precision
              // This size allows for complete sentences, paragraphs, and logical thought units
              maxChunkSize: 2000,
              
              // Increased overlap to maintain better context continuity between chunks
              // 200 characters ensures smooth transitions and prevents information loss at boundaries
              overlapSize: 200,
              
              // Preserve document structure like headings, paragraphs, and lists
              // This maintains the logical flow of information for better RAG performance
              preserveStructure: true,
              
              // Extract metadata like headings, bullet points, and key phrases from each chunk
              // This metadata enhances search and retrieval accuracy in the RAG system
              extractMetadata: true,
            }
          );

          // Log successful chunking with detailed metrics for monitoring and optimization
          await logger.info(`Generated ${chunks.length} chunks for document: ${input.title}`, {
            documentId: document.id,
            chunkCount: chunks.length,
            averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
            totalContentLength: input.content.length,
            chunkingEfficiency: Math.round((chunks.length / Math.ceil(input.content.length / 1000)) * 100),
          });

          // Store chunks in the database for RAG retrieval
          const chunkInserts = chunks.map((chunk: DocumentChunk) => ({
            document_id: document.id,
            content: chunk.content,
            chunk_index: chunk.chunkIndex,
            metadata: chunk.metadata,
          }));

          const { error: chunksError } = await ctx.supabaseAdmin
            .from('document_chunks')
            .insert(chunkInserts);

          if (chunksError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to store document chunks: ${chunksError.message}`,
            });
          }

          // ===== STEP 3: GENERATE VECTOR EMBEDDINGS AND STORE IN PINECONE =====
          // After successful chunking, we now generate vector embeddings using Gemini AI
          // and store them in Pinecone for semantic search and retrieval
          let vectorProcessingResult = null;
          const vectorProcessingErrors: string[] = [];
          
          try {
            // Process document chunks through the complete vector pipeline
            // This includes: embedding generation with Gemini AI + storage in Pinecone
            vectorProcessingResult = await processDocumentVectors(
              chunks,
              document.id,
              ctx.user.id,
              ctx.tenant?.id!,
              {
                embedding: {
                  model: 'text-embedding-004', // Google's latest embedding model
                  batchSize: 100, // Process up to 100 chunks at once
                  dimensions: 768, // Standard dimensions for text-embedding-004
                },
                pinecone: {
                  namespace: 'default', // Use default namespace with tenant isolation
                },
              }
            );

            // Log vector processing results
            if (vectorProcessingResult.success) {
              await logger.info(`Successfully processed vectors for document: ${input.title}`, {
                documentId: document.id,
                totalChunks: vectorProcessingResult.totalChunks,
                successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
                successfulStorages: vectorProcessingResult.successfulStorages,
                totalTokens: vectorProcessingResult.totalTokens,
                processingTime: vectorProcessingResult.processingTime,
              });
            } else {
              // Log partial success or failure
              await logger.warn(`Vector processing completed with issues for document: ${input.title}`, {
                documentId: document.id,
                success: vectorProcessingResult.success,
                totalChunks: vectorProcessingResult.totalChunks,
                successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
                successfulStorages: vectorProcessingResult.successfulStorages,
                failedEmbeddings: vectorProcessingResult.failedEmbeddings,
                failedStorages: vectorProcessingResult.failedStorages,
                errorCount: vectorProcessingResult.errors.length,
              });
              
              // Collect errors for later reporting
              vectorProcessingErrors.push(...vectorProcessingResult.errors);
            }

          } catch (vectorError) {
            // Log vector processing error but don't fail the entire upload
            const errorMessage = `Vector processing failed: ${vectorError instanceof Error ? vectorError.message : 'Unknown error'}`;
            vectorProcessingErrors.push(errorMessage);
            
            await logger.error(`Vector processing failed for document: ${input.title}`, {
              documentId: document.id,
              chunkCount: chunks.length,
              error: errorMessage,
              stack: vectorError instanceof Error ? vectorError.stack : undefined,
            });
          }

          // Update document with chunk count and mark as completed
          // Note: We mark as completed even if vector processing had issues
          // because the document and chunks are successfully stored in Supabase
          await ctx.supabaseAdmin
            .from('documents')
            .update({
              chunk_count: chunks.length,
              processing_status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log usage with comprehensive token count for cost tracking
          // Include both chunking and embedding token usage
          const chunkingTokens = chunks.reduce((sum: number, chunk: DocumentChunk) => sum + Math.ceil(chunk.content.length / 4), 0);
          const embeddingTokens = vectorProcessingResult?.totalTokens || 0;
          const totalTokens = chunkingTokens + embeddingTokens;
          
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.tenant?.id!,
            user_id: ctx.user.id,
            event_type: 'document_upload_with_chunking_and_vectors',
            tokens_used: totalTokens,
            cost_cents: Math.ceil(totalTokens * 0.0001), // Rough cost estimate
            metadata: {
              document_id: document.id,
              content_type: input.contentType,
              chunk_count: chunks.length,
              content_length: input.content.length,
              chunking_method: 'gemini',
              embedding_method: 'gemini-text-embedding-004',
              vector_processing_success: vectorProcessingResult?.success || false,
              successful_embeddings: vectorProcessingResult?.successfulEmbeddings || 0,
              successful_vector_storages: vectorProcessingResult?.successfulStorages || 0,
              chunking_tokens: chunkingTokens,
              embedding_tokens: embeddingTokens,
              total_tokens: totalTokens,
              average_chunk_size: Math.round(chunks.reduce((sum: number, chunk: DocumentChunk) => sum + chunk.content.length, 0) / chunks.length),
              vector_processing_errors: vectorProcessingErrors,
            },
          });

          // Log successful completion for monitoring and debugging
          await logger.info(`Successfully processed document: ${input.title} with ${chunks.length} chunks and vector embeddings`, {
            documentId: document.id,
            totalTokens,
            chunkingTokens,
            embeddingTokens,
            vectorProcessingSuccess: vectorProcessingResult?.success || false,
            processingTime: Date.now(), // Could be enhanced with actual timing
          });

          return {
            ...document,
            chunk_count: chunks.length,
            processing_status: 'completed',
          };

        } catch (chunkingError) {
          // Update document status to failed
          await ctx.supabaseAdmin
            .from('documents')
            .update({
              processing_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log the chunking error with detailed context for debugging
          await logger.error(`Document chunking failed for: ${input.title}`, {
            documentId: document.id,
            contentType: input.contentType,
            contentLength: input.content.length,
            error: chunkingError instanceof Error ? chunkingError.message : 'Unknown chunking error',
            stack: chunkingError instanceof Error ? chunkingError.stack : undefined,
          });

          // Log the error for tracking purposes
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.tenant?.id!,
            user_id: ctx.user.id,
            event_type: 'document_upload_failed',
            tokens_used: 0,
            cost_cents: 0,
            metadata: {
              document_id: document.id,
              content_type: input.contentType,
              error: chunkingError instanceof Error ? chunkingError.message : 'Unknown chunking error',
              content_length: input.content.length,
            },
          });

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Document upload succeeded but chunking failed: ${chunkingError instanceof Error ? chunkingError.message : 'Unknown error'}`,
          });
        }

      } catch (error) {
        // Log general errors for debugging and monitoring
        await logger.error(`Document upload failed: ${input.title}`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          contentType: input.contentType,
          contentLength: input.content.length,
        });

        // If it's already a TRPCError, re-throw it
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to upload document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Upload and process PDF document with server-side parsing
  // 
  // This mutation handles the complete PDF processing pipeline:
  // 1. Receives base64-encoded PDF data from the client
  // 2. Converts base64 back to binary PDF data
  // 3. Parses PDF using pdf2json library to extract text
  // 4. Creates intelligent chunks using Gemini AI
  // 5. Stores document and chunks in the database
  // 
  // Why server-side? PDF parsing libraries are heavy and not suitable for browsers.
  // Server-side processing provides better security, performance, and reliability.
  uploadPDF: tenantProcedure
    .input(
      z.object({
        title: z.string().min(1).max(255),
        fileData: z.string(), // Base64 encoded PDF data from client
        fileName: z.string(),
        fileSize: z.number(),
        sourceUrl: z.string().url().optional(),
        metadata: z.record(z.any()).optional().default({}),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create logger with tenant and user context for better traceability
      const logger = createLogger(ctx.tenant?.id, ctx.user.id);
      
      try {
        // ===== STEP 1: CONVERT BASE64 TO BINARY PDF DATA =====
        // The client sent us the PDF as a base64 string, so we need to convert it back
        // to binary data that the PDF parsing library can understand
        const pdfBuffer = Buffer.from(input.fileData, 'base64');
        
        // Log the start of PDF processing for better monitoring and debugging
        await logger.info(`Starting PDF parsing for document: ${input.title}`, {
          fileName: input.fileName,
          fileSize: input.fileSize,
        });

        // ===== STEP 2: LOAD PDF PARSING LIBRARY =====
        // We use dynamic import to avoid startup issues that can occur with some PDF libraries
        // This ensures the library only loads when we actually need to parse a PDF
        let PDFParser;
        try {
          PDFParser = (await import('pdf2json')).default;
        } catch (importError) {
          throw new Error(`Failed to load PDF parsing library: ${importError instanceof Error ? importError.message : 'Unknown error'}`);
        }
        
        // ===== STEP 3: PARSE PDF AND EXTRACT TEXT =====
        // pdf2json is an event-driven library, so we need to set up event listeners
        // and use a Promise to handle the asynchronous parsing
        const pdfParser = new PDFParser();
        
        const pdfData = await new Promise<any>((resolve, reject) => {
          // Handle parsing errors (corrupted PDFs, unsupported formats, etc.)
          pdfParser.on('pdfParser_dataError', (errData: any) => {
            reject(new Error(`PDF parsing error: ${errData.parserError}`));
          });
          
          // Handle successful parsing - this event fires when the PDF is fully parsed
          pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
            resolve(pdfData);
          });
          
          // Start the parsing process with our binary PDF data
          pdfParser.parseBuffer(pdfBuffer);
        });

        // ===== STEP 4: EXTRACT TEXT FROM PARSED PDF DATA =====
        // pdf2json returns a complex data structure with text organized by pages and text runs
        // We need to traverse this structure to extract all the readable text
        let content = '';
        if (pdfData.Pages) {
          // Iterate through all pages in the PDF
          for (const page of pdfData.Pages) {
            if (page.Texts) {
              // Each page contains an array of text objects
              for (const text of page.Texts) {
                if (text.R) {
                  // Each text object contains an array of text runs (R)
                  for (const run of text.R) {
                    if (run.T) {
                      // Each run contains the actual text (T) which is URL-encoded
                      // We need to decode it to get the readable text
                      content += decodeURIComponent(run.T) + ' ';
                    }
                  }
                }
              }
            }
          }
        }
        
        // Clean up the extracted text by removing extra whitespace
        content = content.trim();
        
        // ===== STEP 5: VALIDATE EXTRACTED CONTENT =====
        // Check if we successfully extracted meaningful text content
        // This catches cases where the PDF is image-based or corrupted
        if (!content || content.length < 10) {
          throw new Error('No text content could be extracted from this PDF. The PDF might be image-based or corrupted.');
        }

        // ===== STEP 6: CALCULATE METADATA =====
        // Calculate useful metadata about the extracted content
        const wordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
        const charCount = content.length;
        const pageCount = pdfData.Pages ? pdfData.Pages.length : 1;

        // ===== STEP 7: PREPARE ENHANCED METADATA =====
        // Create comprehensive metadata that includes both our calculated values
        // and information extracted from the PDF itself
        const enhancedMetadata = {
          ...input.metadata,
          originalFileName: input.fileName,
          uploadedAt: new Date().toISOString(),
          fileSize: input.fileSize,
          pageCount: pageCount,
          extractionMethod: 'pdf2json', // Track which library we used for extraction
          pdfInfo: {
            pages: pageCount,
            info: pdfData.Info || {}, // PDF metadata from the file itself
            creator: pdfData.Info?.Creator || '', // Software that created the PDF
            producer: pdfData.Info?.Producer || '', // Software that produced the PDF
            title: pdfData.Info?.Title || '', // Title from PDF metadata
            author: pdfData.Info?.Author || '', // Author from PDF metadata
          },
        };

        // Log successful PDF parsing with detailed metrics
        await logger.info(`Successfully parsed PDF: ${input.title}`, {
          fileName: input.fileName,
          pageCount: pageCount,
          wordCount: wordCount,
          charCount: charCount,
          extractionMethod: 'pdf2json',
        });

        // Create document record with processing status
        const { data: document, error: docError } = await ctx.supabaseAdmin
          .from('documents')
          .insert({
            tenant_id: ctx.tenant?.id!,
            title: input.title,
            content: content,
            content_type: 'application/pdf',
            source_url: input.sourceUrl,
            metadata: enhancedMetadata,
            processing_status: 'processing',
            chunk_count: 0, // Will be updated after chunking
          })
          .select()
          .single();

        if (docError || !document) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create document record',
          });
        }

        try {
          // ===== STEP 9: CREATE INTELLIGENT CHUNKS USING GEMINI AI =====
          // Instead of simple text splitting, we use Gemini AI to create semantically meaningful chunks
          // This is crucial for RAG (Retrieval-Augmented Generation) performance because:
          // 1. AI understands context and meaning, not just character counts
          // 2. Chunks maintain logical coherence and complete thoughts
          // 3. Better search and retrieval accuracy in the knowledge base
          // 4. Preserves document structure and relationships between concepts
          const chunks = await chunkDocumentWithGemini(
            content,
            document.id,
            input.title,
            'application/pdf',
            {
              // Chunk size: 2000 characters provides optimal balance between:
              // - Context richness (enough content for meaningful retrieval)
              // - Retrieval precision (not too large to be irrelevant)
              // - Complete sentences and paragraphs (maintains logical units)
              maxChunkSize: 1200,
              
              // Overlap: 200 characters ensures smooth transitions between chunks
              // This prevents information loss at chunk boundaries and maintains context flow
              overlapSize: 100,
              
              // Structure preservation: Maintains headings, paragraphs, lists, etc.
              // This helps the RAG system understand document hierarchy and organization
              preserveStructure: true,
              
              // Metadata extraction: AI identifies key concepts, headings, and important phrases
              // This metadata enhances search accuracy and helps users find relevant information
              extractMetadata: true,
            }
          );

          // Log successful chunking with detailed metrics for monitoring and optimization
          await logger.info(`Generated ${chunks.length} chunks for PDF: ${input.title}`, {
            documentId: document.id,
            chunkCount: chunks.length,
            averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
            totalContentLength: content.length,
            chunkingEfficiency: Math.round((chunks.length / Math.ceil(content.length / 1000)) * 100),
          });

          // Store chunks in the database for RAG retrieval
          const chunkInserts = chunks.map((chunk: DocumentChunk) => ({
            document_id: document.id,
            content: chunk.content,
            chunk_index: chunk.chunkIndex,
            metadata: chunk.metadata,
          }));

          const { error: chunksError } = await ctx.supabaseAdmin
            .from('document_chunks')
            .insert(chunkInserts);

          if (chunksError) {
            throw new TRPCError({
              code: 'INTERNAL_SERVER_ERROR',
              message: `Failed to store document chunks: ${chunksError.message}`,
            });
          }

          // ===== STEP 10: GENERATE VECTOR EMBEDDINGS AND STORE IN PINECONE =====
          // After successful PDF parsing and chunking, we now generate vector embeddings
          // using Gemini AI and store them in Pinecone for semantic search and retrieval
          let vectorProcessingResult = null;
          const vectorProcessingErrors: string[] = [];
          
          try {
            // Process PDF chunks through the complete vector pipeline
            // This includes: embedding generation with Gemini AI + storage in Pinecone
            vectorProcessingResult = await processDocumentVectors(
              chunks,
              document.id,
              ctx.user.tenant_id,
              ctx.user.id,
              {
                embedding: {
                  model: 'text-embedding-004', // Google's latest embedding model
                  batchSize: 100, // Process up to 100 chunks at once
                  dimensions: 768, // Standard dimensions for text-embedding-004
                },
                pinecone: {
                  namespace: `default-${ctx.user.tenant_id}`, // Use default namespace with tenant isolation
                },
              }
            );

            // Log vector processing results
            if (vectorProcessingResult.success) {
              await logger.info(`Successfully processed vectors for PDF: ${input.title}`, {
                documentId: document.id,
                pageCount: pageCount,
                totalChunks: vectorProcessingResult.totalChunks,
                successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
                successfulStorages: vectorProcessingResult.successfulStorages,
                totalTokens: vectorProcessingResult.totalTokens,
                processingTime: vectorProcessingResult.processingTime,
              });
            } else {
              // Log partial success or failure
              await logger.warn(`Vector processing completed with issues for PDF: ${input.title}`, {
                documentId: document.id,
                pageCount: pageCount,
                success: vectorProcessingResult.success,
                totalChunks: vectorProcessingResult.totalChunks,
                successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
                successfulStorages: vectorProcessingResult.successfulStorages,
                failedEmbeddings: vectorProcessingResult.failedEmbeddings,
                failedStorages: vectorProcessingResult.failedStorages,
                errorCount: vectorProcessingResult.errors.length,
              });
              
              // Collect errors for later reporting
              vectorProcessingErrors.push(...vectorProcessingResult.errors);
            }

          } catch (vectorError) {
            // Log vector processing error but don't fail the entire upload
            const errorMessage = `Vector processing failed: ${vectorError instanceof Error ? vectorError.message : 'Unknown error'}`;
            vectorProcessingErrors.push(errorMessage);
            
            await logger.error(`Vector processing failed for PDF: ${input.title}`, {
              documentId: document.id,
              pageCount: pageCount,
              chunkCount: chunks.length,
              error: errorMessage,
              stack: vectorError instanceof Error ? vectorError.stack : undefined,
            });
          }

          // Update document with chunk count and mark as completed
          // Note: We mark as completed even if vector processing had issues
          // because the document and chunks are successfully stored in Supabase
          await ctx.supabaseAdmin
            .from('documents')
            .update({
              chunk_count: chunks.length,
              processing_status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log usage with comprehensive token count for cost tracking
          // Include both chunking and embedding token usage
          const chunkingTokens = chunks.reduce((sum: number, chunk: DocumentChunk) => sum + Math.ceil(chunk.content.length / 4), 0);
          const embeddingTokens = vectorProcessingResult?.totalTokens || 0;
          const totalTokens = chunkingTokens + embeddingTokens;
          
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.user.tenant_id,
            user_id: ctx.user.id,
            event_type: 'pdf_upload_with_chunking_and_vectors',
            tokens_used: totalTokens,
            cost_cents: Math.ceil(totalTokens * 0.0001), // Rough cost estimate
            metadata: {
              document_id: document.id,
              content_type: 'application/pdf',
              chunk_count: chunks.length,
              content_length: content.length,
              page_count: pageCount,
              chunking_method: 'gemini',
              embedding_method: 'gemini-text-embedding-004',
              extraction_method: 'pdf2json',
              vector_processing_success: vectorProcessingResult?.success || false,
              successful_embeddings: vectorProcessingResult?.successfulEmbeddings || 0,
              successful_vector_storages: vectorProcessingResult?.successfulStorages || 0,
              chunking_tokens: chunkingTokens,
              embedding_tokens: embeddingTokens,
              total_tokens: totalTokens,
              average_chunk_size: Math.round(chunks.reduce((sum: number, chunk: DocumentChunk) => sum + chunk.content.length, 0) / chunks.length),
              vector_processing_errors: vectorProcessingErrors,
            },
          });

          // Log successful completion for monitoring and debugging
          await logger.info(`Successfully processed PDF: ${input.title} with ${chunks.length} chunks and vector embeddings`, {
            documentId: document.id,
            totalTokens,
            chunkingTokens,
            embeddingTokens,
            pageCount: pageCount,
            vectorProcessingSuccess: vectorProcessingResult?.success || false,
            processingTime: Date.now(), // Could be enhanced with actual timing
          });

          return {
            ...document,
            chunk_count: chunks.length,
            processing_status: 'completed',
          };

        } catch (chunkingError) {
          // Update document status to failed
          await ctx.supabaseAdmin
            .from('documents')
            .update({
              processing_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log the chunking error with detailed context for debugging
          await logger.error(`PDF chunking failed for: ${input.title}`, {
            documentId: document.id,
            fileName: input.fileName,
            pageCount: pageCount,
            contentLength: content.length,
            error: chunkingError instanceof Error ? chunkingError.message : 'Unknown chunking error',
            stack: chunkingError instanceof Error ? chunkingError.stack : undefined,
          });

          // Log the error for tracking purposes
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.user.tenant_id,
            user_id: ctx.user.id,
            event_type: 'pdf_upload_failed',
            tokens_used: 0,
            cost_cents: 0,
            metadata: {
              document_id: document.id,
              content_type: 'application/pdf',
              error: chunkingError instanceof Error ? chunkingError.message : 'Unknown chunking error',
              content_length: content.length,
              page_count: pageCount,
              extraction_method: 'pdf2json',
            },
          });

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `PDF upload succeeded but chunking failed: ${chunkingError instanceof Error ? chunkingError.message : 'Unknown error'}`,
          });
        }

      } catch (error) {
        // Log general errors for debugging and monitoring
        await logger.error(`PDF upload failed: ${input.title}`, {
          fileName: input.fileName,
          fileSize: input.fileSize,
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        });

        // If it's already a TRPCError, re-throw it
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to upload PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Bulk upload documents with Gemini chunking
  bulkUpload: tenantProcedure
    .input(
      z.object({
        documents: z
          .array(
            z.object({
              title: z.string().min(1).max(255),
              content: z.string().min(1),
              contentType: z.string().optional().default('text/plain'),
              sourceUrl: z.string().url().optional(),
              metadata: z.record(z.any()).optional().default({}),
            })
          )
          .max(10), // Reduced limit for bulk processing with AI
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Create logger with tenant and user context for better traceability
      const logger = createLogger(ctx.tenant?.id, ctx.user.id);
      
      try {
        const results = [];
        let totalTokens = 0;
        let totalChunks = 0;

        // Log the start of bulk processing for monitoring
        await logger.info(`Starting bulk upload of ${input.documents.length} documents`, {
          documentCount: input.documents.length,
          tenantId: ctx.tenant?.id,
        });

        for (const doc of input.documents) {
          try {
            // Create document record with processing status
            const { data: document, error: docError } = await ctx.supabaseAdmin
              .from('documents')
              .insert({
                tenant_id: ctx.tenant?.id!,
                title: doc.title,
                content: doc.content,
                content_type: doc.contentType,
                source_url: doc.sourceUrl,
                metadata: doc.metadata,
                processing_status: 'processing',
                chunk_count: 0,
              })
              .select()
              .single();

            if (docError || !document) {
              results.push({
                title: doc.title,
                success: false,
                error: 'Failed to create document record',
              });
              continue;
            }

            try {
              // Use Gemini to chunk the document with the same detailed configuration
              // This ensures consistent chunking quality across individual and bulk uploads
              const chunks = await chunkDocumentWithGemini(
                doc.content,
                document.id,
                doc.title,
                doc.contentType,
                {
                  // Increased chunk size for better context preservation and RAG performance
                  maxChunkSize: 2000,
                  
                  // Increased overlap to maintain better context continuity between chunks
                  overlapSize: 200,
                  
                  // Preserve document structure like headings, paragraphs, and lists
                  preserveStructure: true,
                  
                  // Extract metadata like headings, bullet points, and key phrases from each chunk
                  extractMetadata: true,
                }
              );

              // Store chunks in the database
              const chunkInserts = chunks.map((chunk: DocumentChunk) => ({
                document_id: document.id,
                content: chunk.content,
                chunk_index: chunk.chunkIndex,
                metadata: chunk.metadata,
              }));

              const { error: chunksError } = await ctx.supabaseAdmin
                .from('document_chunks')
                .insert(chunkInserts);

              if (chunksError) {
                throw new TRPCError({
                  code: 'INTERNAL_SERVER_ERROR',
                  message: `Failed to store chunks: ${chunksError.message}`,
                });
              }

              // ===== STEP 3: GENERATE VECTOR EMBEDDINGS AND STORE IN PINECONE =====
              // Process document chunks through the complete vector pipeline
              let vectorProcessingResult = null;
              const vectorProcessingErrors: string[] = [];
              
              try {
                vectorProcessingResult = await processDocumentVectors(
                  chunks,
                  document.id,
                  ctx.user.id,
                  ctx.tenant?.id!,
                  {
                    embedding: {
                      model: 'text-embedding-004',
                      batchSize: 100,
                      dimensions: 768,
                    },
                    pinecone: {
                      namespace: 'default',
                    },
                  }
                );

                // Log vector processing results for bulk operation
                if (vectorProcessingResult.success) {
                  await logger.info(`Successfully processed vectors for bulk document: ${doc.title}`, {
                    documentId: document.id,
                    totalChunks: vectorProcessingResult.totalChunks,
                    successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
                    successfulStorages: vectorProcessingResult.successfulStorages,
                    bulkOperation: true,
                  });
                } else {
                  await logger.warn(`Vector processing completed with issues for bulk document: ${doc.title}`, {
                    documentId: document.id,
                    success: vectorProcessingResult.success,
                    totalChunks: vectorProcessingResult.totalChunks,
                    successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
                    successfulStorages: vectorProcessingResult.successfulStorages,
                    failedEmbeddings: vectorProcessingResult.failedEmbeddings,
                    failedStorages: vectorProcessingResult.failedStorages,
                    errorCount: vectorProcessingResult.errors.length,
                    bulkOperation: true,
                  });
                  
                  vectorProcessingErrors.push(...vectorProcessingResult.errors);
                }

              } catch (vectorError) {
                const errorMessage = `Vector processing failed: ${vectorError instanceof Error ? vectorError.message : 'Unknown error'}`;
                vectorProcessingErrors.push(errorMessage);
                
                await logger.error(`Vector processing failed for bulk document: ${doc.title}`, {
                  documentId: document.id,
                  chunkCount: chunks.length,
                  error: errorMessage,
                  bulkOperation: true,
                });
              }

              // Update document with chunk count and mark as completed
              await ctx.supabaseAdmin
                .from('documents')
                .update({
                  chunk_count: chunks.length,
                  processing_status: 'completed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', document.id);

              totalChunks += chunks.length;
              const chunkingTokens = chunks.reduce((sum: number, chunk: DocumentChunk) => sum + Math.ceil(chunk.content.length / 4), 0);
              const embeddingTokens = vectorProcessingResult?.totalTokens || 0;
              const docTokens = chunkingTokens + embeddingTokens;
              totalTokens += docTokens;

              results.push({
                title: doc.title,
                success: true,
                documentId: document.id,
                chunkCount: chunks.length,
                tokens: docTokens,
                chunkingTokens,
                embeddingTokens,
                vectorProcessingSuccess: vectorProcessingResult?.success || false,
                vectorProcessingErrors,
              });

              // Log successful processing of individual document in bulk operation
              await logger.info(`Successfully processed bulk document: ${doc.title} with ${chunks.length} chunks`, {
                documentId: document.id,
                chunkCount: chunks.length,
                tokens: docTokens,
                bulkOperation: true,
              });

            } catch (chunkingError) {
              // Update document status to failed
              await ctx.supabaseAdmin
                .from('documents')
                .update({
                  processing_status: 'failed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', document.id);

              // Extract error message from TRPCError or regular Error
              const errorMessage = chunkingError instanceof TRPCError 
                ? chunkingError.message 
                : chunkingError instanceof Error 
                  ? chunkingError.message 
                  : 'Unknown error';

              // Log chunking error for individual document in bulk operation
              await logger.error(`Bulk document chunking failed for: ${doc.title}`, {
                documentId: document.id,
                error: errorMessage,
                bulkOperation: true,
              });

              results.push({
                title: doc.title,
                success: false,
                error: `Chunking failed: ${errorMessage}`,
              });
            }

          } catch (error) {
            // Extract error message from TRPCError or regular Error
            const errorMessage = error instanceof TRPCError 
              ? error.message 
              : error instanceof Error 
                ? error.message 
                : 'Unknown error';

            // Log general error for individual document in bulk operation
            await logger.error(`Bulk document processing failed for: ${doc.title}`, {
              error: errorMessage,
              bulkOperation: true,
            });

            results.push({
              title: doc.title,
              success: false,
              error: errorMessage,
            });
          }
        }

        // Log bulk usage with comprehensive vector processing information
        if (totalTokens > 0) {
          const successfulResults = results.filter(r => r.success);
          const vectorProcessingSuccessCount = successfulResults.filter(r => r.vectorProcessingSuccess).length;
          const totalVectorProcessingErrors = successfulResults.reduce((sum, r) => sum + (r.vectorProcessingErrors?.length || 0), 0);
          
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.tenant?.id!,
            user_id: ctx.user.id,
            event_type: 'bulk_document_upload_with_chunking_and_vectors',
            tokens_used: totalTokens,
            cost_cents: Math.ceil(totalTokens * 0.0001),
            metadata: {
              document_count: input.documents.length,
              successful_uploads: results.filter(r => r.success).length,
              failed_uploads: results.filter(r => !r.success).length,
              total_chunks: totalChunks,
              chunking_method: 'gemini',
              embedding_method: 'gemini-text-embedding-004',
              vector_processing_success_count: vectorProcessingSuccessCount,
              vector_processing_failure_count: successfulResults.length - vectorProcessingSuccessCount,
              total_vector_processing_errors: totalVectorProcessingErrors,
              average_tokens_per_document: Math.round(totalTokens / input.documents.length),
            },
          });
        }

        // Log completion of bulk operation with summary statistics
        const successfulCount = results.filter(r => r.success).length;
        await logger.info(`Bulk upload completed: ${successfulCount}/${input.documents.length} successful`, {
          totalDocuments: input.documents.length,
          successfulDocuments: successfulCount,
          failedDocuments: results.filter(r => !r.success).length,
          totalChunks,
          totalTokens,
          successRate: Math.round((successfulCount / input.documents.length) * 100),
        });

        return {
          results,
          summary: {
            total: input.documents.length,
            successful: results.filter(r => r.success).length,
            failed: results.filter(r => !r.success).length,
            totalChunks,
            totalTokens,
          },
        };
      } catch (error) {
        // Log bulk operation failure
        await logger.error(`Bulk upload operation failed`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          documentCount: input.documents.length,
        });

        // If it's already a TRPCError, re-throw it
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to process bulk upload: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // List documents
  list: tenantProcedure
    .input(
      z.object({
        limit: z.number().max(100).default(50),
        offset: z.number().default(0),
        search: z.string().optional(),
        contentType: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabaseAdmin
        .from('documents')
        .select('*')
        .eq('tenant_id', ctx.tenant.id)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      // Add search filter
      if (input.search) {
        query = query.or(
          `title.ilike.%${input.search}%,content.ilike.%${input.search}%`
        );
      }

      // Add content type filter
      if (input.contentType) {
        query = query.eq('content_type', input.contentType);
      }

      const { data: documents, error } = await query;

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch documents',
        });
      }

      return documents || [];
    }),

  // Get single document
  get: tenantProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: document, error } = await ctx.supabaseAdmin
        .from('documents')
        .select(
          `
          *,
          document_chunks (
            id,
            content,
            chunk_index,
            metadata
          )
        `
        )
        .eq('id', input.documentId)
        .eq('tenant_id', ctx.tenant.id)
        .single();

      if (error || !document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      return document;
    }),

  // Update document
  update: tenantProcedure
    .input(
      z.object({
        documentId: z.string().uuid(),
        title: z.string().min(1).max(255).optional(),
        content: z.string().min(1).optional(),
        metadata: z.record(z.any()).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: any = { updated_at: new Date().toISOString() };

      if (input.title) updateData.title = input.title;
      if (input.metadata) updateData.metadata = input.metadata;

      // If content is being updated, we need to reprocess for RAG
      if (input.content) {
        updateData.content = input.content;

        // First delete existing chunks
        await ctx.supabaseAdmin
          .from('document_chunks')
          .delete()
          .eq('document_id', input.documentId);

        // Skip RAG reprocessing for now - just set chunk count to 1
        updateData.chunk_count = 1;
      }

      const { data: document, error } = await ctx.supabaseAdmin
        .from('documents')
        .update(updateData)
        .eq('id', input.documentId)
        .eq('tenant_id', ctx.tenant.id)
        .select()
        .single();

      if (error || !document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found or update failed',
        });
      }

      return document;
    }),

  // Delete document and its embeddings
  delete: tenantProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get document first to clean up embeddings
        const { data: document } = await ctx.supabaseAdmin
          .from('documents')
          .select('*')
          .eq('id', input.documentId)
          .eq('tenant_id', ctx.tenant.id)
          .single();

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          });
        }

        // ===== STEP 2: CLEAN UP VECTOR EMBEDDINGS FROM PINECONE =====
        // Delete all vector embeddings associated with this document from Pinecone
        try {
          const { deleteDocumentVectors } = await import('@/lib/vector-processor');
          const logger = createLogger(ctx.tenant.id, ctx.user.id);
          
          await deleteDocumentVectors(
            input.documentId,
            ctx.tenant.id,
            ctx.user.id,
            document.chunk_count || 0
          );
          
          // Log successful vector cleanup
          await logger.info(`Successfully deleted vectors for document: ${input.documentId}`, {
            documentId: input.documentId,
            chunkCount: document.chunk_count || 0,
          });
          
        } catch (vectorCleanupError) {
          // Log vector cleanup error but don't fail the document deletion
          const logger = createLogger(ctx.tenant.id, ctx.user.id);
          await logger.warn(`Vector cleanup failed for document: ${input.documentId}`, {
            documentId: input.documentId,
            chunkCount: document.chunk_count || 0,
            error: vectorCleanupError instanceof Error ? vectorCleanupError.message : 'Unknown vector cleanup error',
          });
        }

        // Delete document (chunks will be deleted via CASCADE)
        const { error: deleteError } = await ctx.supabaseAdmin
          .from('documents')
          .delete()
          .eq('id', input.documentId)
          .eq('tenant_id', ctx.tenant.id);

        if (deleteError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to delete document',
          });
        }

        return { success: true };
      } catch (error) {
        // If it's already a TRPCError, re-throw it
        if (error instanceof TRPCError) {
          throw error;
        }
        
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // TODO: Add document statistics
  // getStats: tenantProcedure.query(async ({ ctx }) => {
  //   const { data: stats, error } = await ctx.supabaseAdmin
  //     .from('documents')
  //     .select('id, chunk_count, content_type, created_at')
  //     .eq('tenant_id', ctx.tenant.id);

  //   if (error) {
  //     throw new TRPCError({
  //       code: 'INTERNAL_SERVER_ERROR',
  //       message: 'Failed to fetch document statistics',
  //     });
  //   }

  //   const totalDocuments = stats?.length || 0;
  //   const totalChunks =
  //     stats?.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0) || 0;

  //   const contentTypeStats =
  //     stats?.reduce(
  //       (acc, doc) => {
  //         acc[doc.content_type] = (acc[doc.content_type] || 0) + 1;
  //         return acc;
  //       },
  //       {} as Record<string, number>
  //     ) || {};

  //   const recentUploads =
  //     stats?.filter(doc => {
  //       const uploadDate = new Date(doc.created_at);
  //       const weekAgo = new Date();
  //       weekAgo.setDate(weekAgo.getDate() - 7);
  //       return uploadDate > weekAgo;
  //     }).length || 0;

  //   return {
  //     totalDocuments,
  //     totalChunks,
  //     contentTypeStats,
  //     recentUploads,
  //   };
  // }),
});
