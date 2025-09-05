import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { chunkDocumentWithGemini, type DocumentChunk } from '@/lib/gemini-chunker';


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

        console.log(`Starting Gemini chunking for document: ${input.title}`);

        try {
          // Use Gemini to chunk the document intelligently
          const chunks = await chunkDocumentWithGemini(
            input.content,
            document.id,
            input.title,
            input.contentType,
            {
              maxChunkSize: 1000, // 1000 characters per chunk
              overlapSize: 100,   // 100 character overlap
              preserveStructure: true,
              extractMetadata: true,
            }
          );

          console.log(`Generated ${chunks.length} chunks for document: ${input.title}`);

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
            console.error('Error inserting chunks:', chunksError);
            throw new Error(`Failed to store document chunks: ${chunksError.message}`);
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

          // Log usage with actual token count
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

          console.log(`Successfully processed document: ${input.title} with ${chunks.length} chunks`);

          return {
            ...document,
            chunk_count: chunks.length,
            processing_status: 'completed',
          };

        } catch (chunkingError) {
          console.error('Gemini chunking failed:', chunkingError);
          
          // Update document status to failed
          await ctx.supabaseAdmin
            .from('documents')
            .update({
              processing_status: 'failed',
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log the error
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
        console.error('Document upload error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload document',
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
      try {
        const results = [];
        let totalTokens = 0;
        let totalChunks = 0;

        console.log(`Starting bulk upload of ${input.documents.length} documents`);

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
              // Use Gemini to chunk the document
              const chunks = await chunkDocumentWithGemini(
                doc.content,
                document.id,
                doc.title,
                doc.contentType,
                {
                  maxChunkSize: 1000,
                  overlapSize: 100,
                  preserveStructure: true,
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
                throw new Error(`Failed to store chunks: ${chunksError.message}`);
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

              console.log(`Successfully processed bulk document: ${doc.title} with ${chunks.length} chunks`);

            } catch (chunkingError) {
              console.error(`Chunking failed for document: ${doc.title}`, chunkingError);
              
              // Update document status to failed
              await ctx.supabaseAdmin
                .from('documents')
                .update({
                  processing_status: 'failed',
                  updated_at: new Date().toISOString(),
                })
                .eq('id', document.id);

              results.push({
                title: doc.title,
                success: false,
                error: `Chunking failed: ${chunkingError instanceof Error ? chunkingError.message : 'Unknown error'}`,
              });
            }

          } catch (error) {
            console.error(`Error processing document: ${doc.title}`, error);
            results.push({
              title: doc.title,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
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

        console.log(`Bulk upload completed: ${results.filter(r => r.success).length}/${input.documents.length} successful`);

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
        console.error('Bulk upload error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process bulk upload',
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
        console.error('Document deletion error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete document',
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
