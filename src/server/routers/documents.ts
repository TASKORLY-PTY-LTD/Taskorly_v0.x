import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { chunkDocumentWithGemini, type DocumentChunk } from '@/lib/gemini-chunker';
import { processDocumentVectors } from '@/lib/vector-processor';
import { createLogger } from '@/lib/logger';

export const documentsRouter = createTRPCRouter({

// This procedure parses the PDF and creates the document record without processing
uploadPDF: tenantProcedure
  .input(
    z.object({
      title: z.string().min(1).max(255),
      fileData: z.string(), // Base64 encoded PDF data from client
      fileName: z.string(),
      fileSize: z.number(),
      sourceUrl: z.string().url().optional(),
      metadata: z.record(z.any()).optional().default({}),
      autoProcess: z.boolean().optional().default(false), // Option to automatically trigger processing
    })
  )
  .mutation(async ({ ctx, input }) => {
    const logger = createLogger(ctx.tenant?.id, ctx.user.id);
    
    try {
      // ===== STEP 1: CONVERT BASE64 TO BINARY PDF DATA =====
      const pdfBuffer = Buffer.from(input.fileData, 'base64');
      
      await logger.info(`Starting PDF parsing for document: ${input.title}`, {
        fileName: input.fileName,
        fileSize: input.fileSize,
      });

      // ===== STEP 2: LOAD PDF PARSING LIBRARY =====
      let PDFParser;
      try {
        PDFParser = (await import('pdf2json')).default;
      } catch (importError) {
        throw new Error(`Failed to load PDF parsing library: ${importError instanceof Error ? importError.message : 'Unknown error'}`);
      }
      
      // ===== STEP 3: PARSE PDF AND EXTRACT TEXT =====
      const pdfParser = new PDFParser();
      
      const pdfData = await new Promise<any>((resolve, reject) => {
        pdfParser.on('pdfParser_dataError', (errData: any) => {
          reject(new Error(`PDF parsing error: ${errData.parserError}`));
        });
        
        pdfParser.on('pdfParser_dataReady', (pdfData: any) => {
          resolve(pdfData);
        });
        
        pdfParser.parseBuffer(pdfBuffer);
      });

      // ===== STEP 4: EXTRACT TEXT FROM PARSED PDF DATA =====
      let content = '';
      if (pdfData.Pages) {
        for (const page of pdfData.Pages) {
          if (page.Texts) {
            for (const text of page.Texts) {
              if (text.R) {
                for (const run of text.R) {
                  if (run.T) {
                    content += decodeURIComponent(run.T) + ' ';
                  }
                }
              }
            }
          }
        }
      }
      
      content = content.trim();
      
      // ===== STEP 5: VALIDATE EXTRACTED CONTENT =====
      if (!content || content.length < 10) {
        throw new Error('No text content could be extracted from this PDF. The PDF might be image-based or corrupted.');
      }

      // ===== STEP 6: CALCULATE METADATA =====
      const wordCount = content.split(/\s+/).filter((word: string) => word.length > 0).length;
      const charCount = content.length;
      const pageCount = pdfData.Pages ? pdfData.Pages.length : 1;

      // ===== STEP 7: PREPARE ENHANCED METADATA =====
      const enhancedMetadata = {
        ...input.metadata,
        originalFileName: input.fileName,
        uploadedAt: new Date().toISOString(),
        fileSize: input.fileSize,
        pageCount: pageCount,
        wordCount: wordCount,
        charCount: charCount,
        extractionMethod: 'pdf2json',
        pdfInfo: {
          pages: pageCount,
          info: pdfData.Info || {},
          creator: pdfData.Info?.Creator || '',
          producer: pdfData.Info?.Producer || '',
          title: pdfData.Info?.Title || '',
          author: pdfData.Info?.Author || '',
        },
      };

      await logger.info(`Successfully parsed PDF: ${input.title}`, {
        fileName: input.fileName,
        pageCount: pageCount,
        wordCount: wordCount,
        charCount: charCount,
        extractionMethod: 'pdf2json',
      });

      // ===== STEP 8: CREATE DOCUMENT RECORD =====
      const { data: document, error: docError } = await ctx.supabaseAdmin
        .from('documents')
        .insert({
          tenant_id: ctx.tenant?.id!,
          title: input.title,
          content: content,
          content_type: 'application/pdf',
          source_url: input.sourceUrl,
          metadata: enhancedMetadata,
          processing_status: 'pending', // Start as pending, not processing
          chunk_count: 0,
        })
        .select()
        .single();

      if (docError || !document) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create document record',
        });
      }

      // Log the PDF upload event
      await ctx.supabaseAdmin.from('usage_logs').insert({
        tenant_id: ctx.tenant?.id!,
        user_id: ctx.user.id,
        event_type: 'pdf_upload',
        tokens_used: 0,
        cost_cents: 0,
        metadata: {
          document_id: document.id,
          content_type: 'application/pdf',
          file_name: input.fileName,
          file_size: input.fileSize,
          page_count: pageCount,
          word_count: wordCount,
          char_count: charCount,
          extraction_method: 'pdf2json',
        },
      });

      await logger.info(`PDF uploaded successfully: ${input.title}`, {
        documentId: document.id,
        pageCount: pageCount,
        contentLength: content.length,
        autoProcess: input.autoProcess,
      });

      return {
        ...document,
        message: input.autoProcess 
          ? 'PDF uploaded and parsed. Processing will begin automatically.' 
          : 'PDF uploaded and parsed successfully. Call processDocument to chunk and vectorize.',
      };

    } catch (error) {
      await logger.error(`PDF upload failed: ${input.title}`, {
        fileName: input.fileName,
        fileSize: input.fileSize,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });

      if (error instanceof TRPCError) {
        throw error;
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to upload PDF: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }
  }),

// This procedure handles chunking and vector generation for an existing document
// Can be used for both PDF and regular text documents
processDocument: tenantProcedure
  .input(
    z.object({
      documentId: z.string().uuid().optional(),
      documentName: z.string().optional(),
      chunkingOptions: z.object({
        maxChunkSize: z.number().optional().default(2000),
        overlapSize: z.number().optional().default(200),
        preserveStructure: z.boolean().optional().default(true),
        extractMetadata: z.boolean().optional().default(true),
      }).optional().default({}),
      vectorOptions: z.object({
        embeddingModel: z.string().optional().default('text-embedding-004'),
        batchSize: z.number().optional().default(100),
        dimensions: z.number().optional().default(768),
        namespace: z.string().optional(),
      }).optional().default({}),
    })
  )
  .mutation(async ({ ctx, input }) => {
    const logger = createLogger(ctx.tenant?.id, ctx.user.id);
    const namespace = input.vectorOptions.namespace || `default-${ctx.tenant?.id}`;
    
    try {
      // Validate that either documentId or documentName is provided
      if (!input.documentId && !input.documentName) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Either documentId or documentName must be provided',
        });
      }

      // Build query based on what's provided
      let query = ctx.supabaseAdmin
        .from('documents')
        .select('*')
        .eq('tenant_id', ctx.tenant?.id!); // Ensure tenant isolation

      if (input.documentId) {
        query = query.eq('id', input.documentId);
      } else if (input.documentName) {
        query = query.eq('title', input.documentName);
      }

      // Fetch the document
      const { data: document, error: fetchError } = await query.single();

      if (fetchError || !document) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      // Check if document is already processed or processing
      if (document.processing_status === 'processing') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Document is already being processed',
        });
      }

      if (document.processing_status === 'completed' && document.chunk_count > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Document has already been processed. Delete existing chunks first to reprocess.',
        });
      }

      // Update status to processing
      await ctx.supabaseAdmin
        .from('documents')
        .update({ processing_status: 'processing' })
        .eq('id', document.id);

      const isPDF = document.content_type === 'application/pdf';
      const pageCount = isPDF ? ((document.metadata as any)?.pageCount || 0) : null;

      await logger.info(`Starting processing for document: ${document.title}`, {
        documentId: document.id,
        contentType: document.content_type,
        contentLength: document.content.length,
        isPDF,
        pageCount,
      });

      try {
        // STEP 1: Chunk the document with Gemini
        const chunks = await chunkDocumentWithGemini(
          document.content,
          document.id,
          document.title,
          document.content_type,
          input.chunkingOptions
        );

        await logger.info(`Generated ${chunks.length} chunks for document: ${document.title}`, {
          documentId: document.id,
          chunkCount: chunks.length,
          averageChunkSize: Math.round(chunks.reduce((sum, chunk) => sum + chunk.content.length, 0) / chunks.length),
          isPDF,
        });

        // STEP 2: Store chunks in database
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

        // STEP 3: Generate and store vector embeddings
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
                model: input.vectorOptions.embeddingModel,
                batchSize: input.vectorOptions.batchSize,
                dimensions: input.vectorOptions.dimensions,
              },
              pinecone: {
                namespace: namespace,
              },
            }
          );

          if (vectorProcessingResult.success) {
            await logger.info(`Successfully processed vectors for document: ${document.title}`, {
              documentId: document.id,
              totalChunks: vectorProcessingResult.totalChunks,
              successfulEmbeddings: vectorProcessingResult.successfulEmbeddings,
              successfulStorages: vectorProcessingResult.successfulStorages,
              totalTokens: vectorProcessingResult.totalTokens,
            });
          } else {
            await logger.warn(`Vector processing completed with issues for document: ${document.title}`, {
              documentId: document.id,
              ...vectorProcessingResult,
            });
            vectorProcessingErrors.push(...vectorProcessingResult.errors);
          }

        } catch (vectorError) {
          const errorMessage = `Vector processing failed: ${vectorError instanceof Error ? vectorError.message : 'Unknown error'}`;
          vectorProcessingErrors.push(errorMessage);
          
          await logger.error(`Vector processing failed for document: ${document.title}`, {
            documentId: document.id,
            error: errorMessage,
          });
        }

        // STEP 4: Update document with final status
        await ctx.supabaseAdmin
          .from('documents')
          .update({
            chunk_count: chunks.length,
            processing_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', document.id);

        // STEP 5: Log usage
        const chunkingTokens = chunks.reduce((sum: number, chunk: DocumentChunk) => 
          sum + Math.ceil(chunk.content.length / 4), 0);
        const embeddingTokens = vectorProcessingResult?.totalTokens || 0;
        const totalTokens = chunkingTokens + embeddingTokens;
        
        const eventType = isPDF ? 'pdf_processing' : 'document_processing';
        const usageMetadata: any = {
          document_id: document.id,
          content_type: document.content_type,
          chunk_count: chunks.length,
          chunking_tokens: chunkingTokens,
          embedding_tokens: embeddingTokens,
          total_tokens: totalTokens,
          chunking_method: 'gemini',
          embedding_method: input.vectorOptions.embeddingModel,
          vector_processing_success: vectorProcessingResult?.success || false,
          vector_processing_errors: vectorProcessingErrors,
          average_chunk_size: Math.round(chunks.reduce((sum: number, chunk: DocumentChunk) => sum + chunk.content.length, 0) / chunks.length),
        };

        if (isPDF && pageCount) {
          usageMetadata.page_count = pageCount;
          usageMetadata.extraction_method = 'pdf2json';
        }
        
        await ctx.supabaseAdmin.from('usage_logs').insert({
          tenant_id: ctx.tenant?.id!,
          user_id: ctx.user.id,
          event_type: eventType,
          tokens_used: totalTokens,
          cost_cents: Math.ceil(totalTokens * 0.0001),
          metadata: usageMetadata,
        });

        await logger.info(`Successfully processed document: ${document.title}`, {
          documentId: document.id,
          chunkCount: chunks.length,
          totalTokens,
          isPDF,
        });

        return {
          documentId: document.id,
          title: document.title,
          contentType: document.content_type,
          chunkCount: chunks.length,
          processingStatus: 'completed',
          vectorProcessingSuccess: vectorProcessingResult?.success || false,
          totalTokens,
          pageCount: isPDF ? pageCount : undefined,
          errors: vectorProcessingErrors.length > 0 ? vectorProcessingErrors : undefined,
        };

      } catch (processingError) {
        // Update document status to failed
        await ctx.supabaseAdmin
          .from('documents')
          .update({
            processing_status: 'failed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', document.id);

        await logger.error(`Document processing failed for: ${document.title}`, {
          documentId: document.id,
          isPDF,
          error: processingError instanceof Error ? processingError.message : 'Unknown error',
        });

        const failedEventType = isPDF ? 'pdf_processing_failed' : 'document_processing_failed';
        await ctx.supabaseAdmin.from('usage_logs').insert({
          tenant_id: ctx.tenant?.id!,
          user_id: ctx.user.id,
          event_type: failedEventType,
          tokens_used: 0,
          cost_cents: 0,
          metadata: {
            document_id: document.id,
            content_type: document.content_type,
            error: processingError instanceof Error ? processingError.message : 'Unknown error',
          },
        });

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Document processing failed: ${processingError instanceof Error ? processingError.message : 'Unknown error'}`,
        });
      }

    } catch (error) {
      await logger.error(`Document processing failed`, {
        documentId: input.documentId,
        documentName: input.documentName,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof TRPCError) {
        throw error;
      }
      
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to process document: ${error instanceof Error ? error.message : 'Unknown error'}`,
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
