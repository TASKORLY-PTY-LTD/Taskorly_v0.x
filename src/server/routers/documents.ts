import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
// import { processPDFFromBase64 } from '@/lib/file-processor'; // Temporarily disabled
// import { RAGPipeline } from '@/lib/rag/pipeline'; // Disabled for now

export const documentsRouter = createTRPCRouter({
  // Upload and process PDF document (server-side processing) - DISABLED
  // uploadPDF: tenantProcedure
  //   .input(
  //     z.object({
  //       fileName: z.string().min(1).max(255),
  //       fileSize: z.number().positive(),
  //       fileData: z.string(), // Base64 encoded PDF data
  //       metadata: z.record(z.any()).optional().default({}),
  //     })
  //   )
  //   .mutation(async ({ ctx, input }) => {
  //     try {
  //       // Process PDF on server side
  //       const processedPDF = await processPDFFromBase64(
  //         input.fileData,
  //         input.fileName,
  //         input.fileSize
  //       );

  //       // Create document record
  //       const { data: document, error: docError } = await ctx.supabaseAdmin
  //         .from('documents')
  //         .insert({
  //           tenant_id: ctx.tenant?.id!,
  //           title: processedPDF.metadata.fileName,
  //           content: processedPDF.content,
  //           content_type: processedPDF.metadata.fileType,
  //           source_url: undefined,
  //           metadata: {
  //             ...input.metadata,
  //             originalFileName: processedPDF.metadata.fileName,
  //             fileSize: processedPDF.metadata.fileSize,
  //             wordCount: processedPDF.metadata.wordCount,
  //             charCount: processedPDF.metadata.charCount,
  //             pageCount: processedPDF.metadata.pageCount,
  //             uploadedAt: new Date().toISOString(),
  //           },
  //         })
  //         .select()
  //         .single();

  //       if (docError || !document) {
  //         throw new TRPCError({
  //           code: 'INTERNAL_SERVER_ERROR',
  //           message: 'Failed to create document',
  //         });
  //       }

  //       // Update document with basic chunk count (1 for the whole document)
  //       await ctx.supabaseAdmin
  //         .from('documents')
  //         .update({
  //           chunk_count: 1,
  //           updated_at: new Date().toISOString(),
  //         })
  //         .eq('id', document.id);

  //       // Log usage
  //       await ctx.supabaseAdmin.from('usage_logs').insert({
  //         tenant_id: ctx.tenant?.id!,
  //         user_id: ctx.user.id,
  //         event_type: 'pdf_upload',
  //         tokens_used: Math.ceil(processedPDF.content.length / 4),
  //         cost_cents: 0,
  //         metadata: {
  //           document_id: document.id,
  //           content_type: processedPDF.metadata.fileType,
  //           chunk_count: 1,
  //           content_length: processedPDF.content.length,
  //           page_count: processedPDF.metadata.pageCount,
  //         },
  //       });

  //       return document;
  //     } catch (error) {
  //       console.error('PDF upload error:', error);
  //       throw new TRPCError({
  //         code: 'INTERNAL_SERVER_ERROR',
  //         message: 'Failed to upload PDF document',
  //       });
  //     }
  //   }),

  // Upload and process document for RAG
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
        // Create document record
        const { data: document, error: docError } = await ctx.supabaseAdmin
          .from('documents')
          .insert({
            tenant_id: ctx.tenant?.id!,
            title: input.title,
            content: input.content,
            content_type: input.contentType,
            source_url: input.sourceUrl,
            metadata: input.metadata,
          })
          .select()
          .single();

        if (docError || !document) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to create document',
          });
        }

        // Skip RAG processing for now - just mark as processed
        // Update document with basic chunk count (1 for the whole document)
        await ctx.supabaseAdmin
          .from('documents')
          .update({
            chunk_count: 1, // Simple: treat whole document as one chunk
            updated_at: new Date().toISOString(),
          })
          .eq('id', document.id);

        // Log usage
        await ctx.supabaseAdmin.from('usage_logs').insert({
          tenant_id: ctx.tenant?.id!,
          user_id: ctx.user.id,
          event_type: 'document_upload',
          tokens_used: Math.ceil(input.content.length / 4), // Rough token estimate
          cost_cents: 0, // No processing cost for now
          metadata: {
            document_id: document.id,
            content_type: input.contentType,
            chunk_count: 1,
            content_length: input.content.length,
          },
        });

        return document;
      } catch (error) {
        console.error('Document upload error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to upload document',
        });
      }
    }),

  // Bulk upload documents
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
          .max(50), // Limit bulk uploads
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Skip RAG pipeline setup for now
        const results = [];
        let totalTokens = 0;
        let totalChunks = 0;

        for (const doc of input.documents) {
          try {
            // Create document record
            const { data: document, error: docError } = await ctx.supabaseAdmin
              .from('documents')
              .insert({
                tenant_id: ctx.tenant?.id!,
                title: doc.title,
                content: doc.content,
                content_type: doc.contentType,
                source_url: doc.sourceUrl,
                metadata: doc.metadata,
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

            // Skip RAG processing - just mark as processed
            const chunkCount = 1; // Simple: treat whole document as one chunk
            
            // Update document with chunk count
            await ctx.supabaseAdmin
              .from('documents')
              .update({
                chunk_count: chunkCount,
                updated_at: new Date().toISOString(),
              })
              .eq('id', document.id);

            totalChunks += chunkCount;
            totalTokens += Math.ceil(doc.content.length / 4);

            results.push({
              title: doc.title,
              success: true,
              documentId: document.id,
              chunkCount,
            });
          } catch (error) {
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
            event_type: 'bulk_document_upload',
            tokens_used: totalTokens,
            cost_cents: Math.ceil(totalTokens * 0.0001), // Embedding cost estimate
            metadata: {
              document_count: input.documents.length,
              successful_uploads: results.filter(r => r.success).length,
              total_chunks: totalChunks,
            },
          });
        }

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
