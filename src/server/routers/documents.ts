import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { RAGPipeline } from '@/lib/rag/pipeline';

export const documentsRouter = createTRPCRouter({
  // Upload and process document for RAG
  upload: protectedProcedure
    .input(z.object({
      title: z.string().min(1).max(255),
      content: z.string().min(1),
      contentType: z.string().optional().default('text/plain'),
      sourceUrl: z.string().url().optional(),
      metadata: z.record(z.any()).optional().default({}),
    }))
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

        // Get tenant configuration for RAG processing
        const { data: config } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('*')
          .eq('tenant_id', ctx.tenant?.id)
          .single();

        if (!config) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tenant configuration not found',
          });
        }

        // Process document for RAG (chunk, embed, store)
        try {
          const ragPipeline = new RAGPipeline(config);
          const chunkCount = await ragPipeline.processDocument(document);
          
          // Update document with chunk count
          await ctx.supabaseAdmin
            .from('documents')
            .update({ 
              chunk_count: chunkCount,
              updated_at: new Date().toISOString(),
            })
            .eq('id', document.id);

          // Log usage
          await ctx.supabaseAdmin
            .from('usage_logs')
            .insert({
              tenant_id: ctx.tenant?.id!,
              user_id: ctx.user.id,
              event_type: 'document_upload',
              tokens_used: Math.ceil(input.content.length / 4), // Rough token estimate
              cost_cents: Math.ceil((input.content.length / 4) * 0.0001), // Embedding cost estimate
              metadata: {
                document_id: document.id,
                content_type: input.contentType,
                chunk_count: chunkCount,
                content_length: input.content.length,
              },
            });

        } catch (ragError) {
          console.error('RAG processing error:', ragError);
          // Don't fail the upload, but log the error
          await ctx.supabaseAdmin
            .from('documents')
            .update({ 
              metadata: { 
                ...input.metadata, 
                processing_error: ragError.message || 'Unknown RAG processing error' 
              } 
            })
            .eq('id', document.id);
        }

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
  bulkUpload: protectedProcedure
    .input(z.object({
      documents: z.array(z.object({
        title: z.string().min(1).max(255),
        content: z.string().min(1),
        contentType: z.string().optional().default('text/plain'),
        sourceUrl: z.string().url().optional(),
        metadata: z.record(z.any()).optional().default({}),
      })).max(50), // Limit bulk uploads
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get tenant configuration
        const { data: config } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('*')
          .eq('tenant_id', ctx.tenant?.id)
          .single();

        if (!config) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tenant configuration not found',
          });
        }

        const ragPipeline = new RAGPipeline(config);
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

            // Process for RAG
            try {
              const chunkCount = await ragPipeline.processDocument(document);
              
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

            } catch (ragError) {
              console.error(`RAG processing error for ${doc.title}:`, ragError);
              await ctx.supabaseAdmin
                .from('documents')
                .update({ 
                  metadata: { 
                    ...doc.metadata, 
                    processing_error: ragError.message || 'Unknown RAG processing error' 
                  } 
                })
                .eq('id', document.id);

              results.push({
                title: doc.title,
                success: false,
                documentId: document.id,
                error: 'RAG processing failed',
              });
            }

          } catch (error) {
            results.push({
              title: doc.title,
              success: false,
              error: error.message || 'Unknown error',
            });
          }
        }

        // Log bulk usage
        if (totalTokens > 0) {
          await ctx.supabaseAdmin
            .from('usage_logs')
            .insert({
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
  list: protectedProcedure
    .input(z.object({
      limit: z.number().default(50).max(100),
      offset: z.number().default(0),
      search: z.string().optional(),
      contentType: z.string().optional(),
    }))
    .query(async ({ ctx, input }) => {
      let query = ctx.supabaseAdmin
        .from('documents')
        .select('*')
        .eq('tenant_id', ctx.tenant?.id!)
        .order('created_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      // Add search filter
      if (input.search) {
        query = query.or(`title.ilike.%${input.search}%,content.ilike.%${input.search}%`);
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
  get: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: document, error } = await ctx.supabaseAdmin
        .from('documents')
        .select(`
          *,
          document_chunks (
            id,
            content,
            chunk_index,
            metadata
          )
        `)
        .eq('id', input.documentId)
        .eq('tenant_id', ctx.tenant?.id!)
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
  update: protectedProcedure
    .input(z.object({
      documentId: z.string().uuid(),
      title: z.string().min(1).max(255).optional(),
      content: z.string().min(1).optional(),
      metadata: z.record(z.any()).optional(),
    }))
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

        // Get tenant configuration
        const { data: config } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('*')
          .eq('tenant_id', ctx.tenant?.id)
          .single();

        if (config) {
          try {
            const ragPipeline = new RAGPipeline(config);
            const { data: document } = await ctx.supabaseAdmin
              .from('documents')
              .select('*')
              .eq('id', input.documentId)
              .single();

            if (document) {
              const updatedDoc = { ...document, ...updateData };
              const chunkCount = await ragPipeline.processDocument(updatedDoc);
              updateData.chunk_count = chunkCount;
            }
          } catch (error) {
            console.error('RAG reprocessing error:', error);
            updateData.metadata = { 
              ...updateData.metadata, 
              processing_error: 'Failed to reprocess for RAG' 
            };
          }
        }
      }

      const { data: document, error } = await ctx.supabaseAdmin
        .from('documents')
        .update(updateData)
        .eq('id', input.documentId)
        .eq('tenant_id', ctx.tenant?.id!)
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
  delete: protectedProcedure
    .input(z.object({ documentId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get document first to clean up embeddings
        const { data: document } = await ctx.supabaseAdmin
          .from('documents')
          .select('*')
          .eq('id', input.documentId)
          .eq('tenant_id', ctx.tenant?.id!)
          .single();

        if (!document) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Document not found',
          });
        }

        // Delete from vector database if needed
        if (document.embedding_id) {
          try {
            const { data: config } = await ctx.supabaseAdmin
              .from('tenant_configurations')
              .select('*')
              .eq('tenant_id', ctx.tenant?.id)
              .single();

            if (config) {
              const ragPipeline = new RAGPipeline(config);
              await ragPipeline.deleteDocument(document.embedding_id);
            }
          } catch (error) {
            console.error('Failed to delete from vector database:', error);
          }
        }

        // Delete document (chunks will be deleted via CASCADE)
        const { error: deleteError } = await ctx.supabaseAdmin
          .from('documents')
          .delete()
          .eq('id', input.documentId)
          .eq('tenant_id', ctx.tenant?.id!);

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

  // Get document statistics
  getStats: protectedProcedure
    .query(async ({ ctx }) => {
      const { data: stats, error } = await ctx.supabaseAdmin
        .from('documents')
        .select('id, chunk_count, content_type, created_at')
        .eq('tenant_id', ctx.tenant?.id!);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch document statistics',
        });
      }

      const totalDocuments = stats?.length || 0;
      const totalChunks = stats?.reduce((sum, doc) => sum + (doc.chunk_count || 0), 0) || 0;
      
      const contentTypeStats = stats?.reduce((acc, doc) => {
        acc[doc.content_type] = (acc[doc.content_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const recentUploads = stats?.filter(doc => {
        const uploadDate = new Date(doc.created_at);
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        return uploadDate > weekAgo;
      }).length || 0;

      return {
        totalDocuments,
        totalChunks,
        contentTypeStats,
        recentUploads,
      };
    }),
});