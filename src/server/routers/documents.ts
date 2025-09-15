import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { chunkDocumentWithGemini, type DocumentChunk } from '@/lib/gemini-chunker';
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

          // Update document with chunk count and mark as completed
          await ctx.supabaseAdmin
            .from('documents')
            .update({
              chunk_count: chunks.length,
              processing_status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log usage with actual token count for cost tracking and optimization
          const totalTokens = chunks.reduce((sum: number, chunk: DocumentChunk) => sum + Math.ceil(chunk.content.length / 4), 0);
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.tenant?.id!,
            user_id: ctx.user.id,
            event_type: 'document_upload_with_chunking',
            tokens_used: totalTokens,
            cost_cents: Math.ceil(totalTokens * 0.0001), // Rough cost estimate
            metadata: {
              document_id: document.id,
              content_type: input.contentType,
              chunk_count: chunks.length,
              content_length: input.content.length,
              chunking_method: 'gemini',
              average_chunk_size: Math.round(chunks.reduce((sum: number, chunk: DocumentChunk) => sum + chunk.content.length, 0) / chunks.length),
            },
          });

          // Log successful completion for monitoring and debugging
          await logger.info(`Successfully processed document: ${input.title} with ${chunks.length} chunks`, {
            documentId: document.id,
            totalTokens,
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
              const docTokens = chunks.reduce((sum: number, chunk: DocumentChunk) => sum + Math.ceil(chunk.content.length / 4), 0);
              totalTokens += docTokens;

              results.push({
                title: doc.title,
                success: true,
                documentId: document.id,
                chunkCount: chunks.length,
                tokens: docTokens,
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

        // Log bulk usage
        if (totalTokens > 0) {
          await ctx.supabaseAdmin.from('usage_logs').insert({
            tenant_id: ctx.tenant?.id!,
            user_id: ctx.user.id,
            event_type: 'bulk_document_upload_with_chunking',
            tokens_used: totalTokens,
            cost_cents: Math.ceil(totalTokens * 0.0001),
            metadata: {
              document_count: input.documents.length,
              successful_uploads: results.filter(r => r.success).length,
              failed_uploads: results.filter(r => !r.success).length,
              total_chunks: totalChunks,
              chunking_method: 'gemini',
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

        // Skip vector database cleanup for now (no RAG processing)

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
