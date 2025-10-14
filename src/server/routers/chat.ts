import { z } from 'zod';
import { createTRPCRouter, publicProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { RAGPipeline } from '@/lib/PipelineLogic/pipeline';
import { generateSingleEmbedding } from '@/lib/PipelineLogic/vector-embedder';
import { searchSimilarVectors } from '@/lib/Connections/pinecone-client';
import { buildSystemPrompt } from './settings';

export const chatRouter = createTRPCRouter({
  // Handles sending messages to the AI and receiving responses
  sendMessage: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid().optional(),
        message: z.string().min(1),
        includeContext: z.boolean().default(true),
        maxTokens: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        //Step 1: Fetch user settings from database
        const { data: settings, error: settingsError } = await ctx.supabaseAdmin
          .from('Settings')
          .select('*')
          .eq('UserId', ctx.user.id)
          .maybeSingle();

        if (settingsError) {
          console.error('Error fetching settings:', settingsError);
        }

        //Step 2: Build system prompt from settings (with fallback to defaults)
        const systemPromptBase = settings
          ? buildSystemPrompt(settings)
          : buildSystemPrompt({
              Description: null,
              Industry: null,
              Setting_id: 0,
              Tenant_Id: ctx.user.tenant_id,
              UserId: ctx.user.id,
            });

        let retrievedDocs: any[] = [];
        let contextString = '';

        // Step 3: Generate embedding for the user's query (RAG)
        if (input.includeContext) {
          console.log('Generating embedding for query:', input.message);

          const queryEmbedding = await generateSingleEmbedding(input.message, {
            model: 'text-embedding-004',
          });

          console.log(
            `Searching Pinecone for relevant documents... default-${ctx.user.tenant_id}`
          );

          const searchResults = await searchSimilarVectors(
            queryEmbedding,
            ctx.user.tenant_id || 'public-tenant',
            ctx.user.id,
            {
              topK: 5,
              includeMetadata: true,
              config: { namespace: `default-${ctx.user.tenant_id}` },
            }
          );

          console.log('Search results from Pinecone:', {
            totalMatches: searchResults?.length || 0,
            firstResult: searchResults?.[0]
              ? {
                  id: searchResults[0].id,
                  score: searchResults[0].score,
                  hasContent: !!searchResults[0].metadata?.content,
                }
              : null,
          });

          // Process search results
          if (searchResults && searchResults.length > 0) {
            retrievedDocs = searchResults
              .filter(result => result.score >= 0.3)
              .map(result => ({
                id: result.id,
                content: result.metadata.content || '',
                title: result.metadata.documentId || 'Unknown Document',
                similarity: result.score,
                metadata: result.metadata,
              }));

            contextString = retrievedDocs
              .map(doc => `Document: ${doc.title}\nContent: ${doc.content}`)
              .join('\n\n---\n\n');

            console.log(`Found ${retrievedDocs.length} relevant documents.`);
          }
        }

        // Step 4: Enhanced system prompt with context
        const enhancedSystemPrompt = contextString
          ? `${systemPromptBase}\n\nRelevant Context:\n${contextString}\n\nPlease use this context to provide accurate, well-informed responses. If the context doesn't contain relevant information, rely on your general knowledge but mention that no specific documentation was found.`
          : systemPromptBase;

        console.log('Enhanced system prompt:', {
          length: enhancedSystemPrompt.length,
          includesContext: enhancedSystemPrompt.includes('Relevant Context'),
          includesIndustry: settings?.Industry ? true : false,
          industry: settings?.Industry,
        });

        // Step 5: Configure RAG Pipeline
        const config = {
          llm_provider: 'google',
          llm_model: 'gemini-2.0-flash-exp',
          llm_api_key: process.env.GOOGLE_API_KEY ?? '',
          embedding_model: 'text-embedding-004',
          temperature: 0.7,
          max_context_length: 4096,
          system_prompt: enhancedSystemPrompt,
          vector_db_config: {
            Provider: 'Pinecone',
            api_key: process.env.PINECONE_API_KEY,
            environment: process.env.PINECONE_ENVIRONMENT,
            index_name: process.env.PINECONE_INDEX_NAME,
            namespace: `default-${ctx.user.tenant_id}`,
          },
          tenant_id: ctx.user.tenant_id || 'public-tenant',
        };

        // Step 6: Process message with RAG pipeline
        const ragPipeline = new RAGPipeline(config);
        const availableTools: any[] = [];
        const responseStream = await ragPipeline.processMessage(
          input.message,
          contextString,
          input.conversationId ?? 'public-conv-id',
          availableTools
        );

        let assistantContent = '';
        const toolCalls: any[] = [];
        let tokenCount = 0;

        // Step 7: Process response stream
        for await (const chunk of responseStream) {
          if (chunk.type === 'text') {
            assistantContent += chunk.content;
          } else if (chunk.type === 'tool_call') {
            toolCalls.push(chunk);
          } else if (chunk.type === 'token_count') {
            tokenCount = chunk.count || 0;
          }
        }

        return {
          content: assistantContent,
          retrievedDocs,
          toolCalls,
          tokenCount,
          contextUsed: retrievedDocs.length > 0,
        };
      } catch (error) {
        console.error('Chat error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to process message: ${error instanceof Error ? error.message : 'Unknown error'}`,
        });
      }
    }),

  // Create new conversation (stateless, returns a random UUID)
  createConversation: tenantProcedure
    .input(
      z.object({
        title: z.string().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // Generate a random UUID for stateless conversation
      const uuid =
        typeof crypto !== 'undefined' && crypto.randomUUID
          ? crypto.randomUUID()
          : require('crypto').randomUUID();
      return {
        id: uuid,
        title: input.title ?? '',
        system_prompt: input.systemPrompt ?? '',
      };
    }),

  // Legacy chatRouter implementation (Supabase, tenant, demo logic)
  // This code is preserved for reference and is not currently active.
  /*
  sendMessage: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        message: z.string().min(1),
        includeContext: z.boolean().default(true),
        maxTokens: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Get conversation and verify access
        const { data: conversation, error: convError } = await ctx.supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', input.conversationId)
          .eq('tenant_id', ctx.tenant!.id)
          .single();

        if (convError || !conversation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Conversation not found',
          });
        }

        // Save user message
        const { data: userMessage, error: messageError } =
          await ctx.supabaseAdmin
            .from('messages')
            .insert({
              conversation_id: input.conversationId,
              role: 'user',
              content: input.message,
            })
            .select()
            .single();

        if (messageError || !userMessage) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to save message',
          });
        }

        // Get tenant configuration
        const { data: config } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('*')
          .eq('tenant_id', ctx.tenant!.id)
          .single();

        if (!config) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tenant configuration not found',
          });
        }

        // Initialize RAG pipeline
        const ragPipeline = new RAGPipeline(config);

        // Get available MCP tools
        const mcpManager = new MCPManager();
        const availableTools = await mcpManager.getAvailableTools(
          ctx.tenant?.id!
        );

        // Generate response using RAG + MCP
        const responseStream = await ragPipeline.processMessage(
          input.message,
          input.conversationId,
          availableTools
        );

        let assistantContent = '';
        let retrievedDocs: any[] = [];
        const toolCalls: any[] = [];
        let tokenCount = 0;

        // Process the stream
        for await (const chunk of responseStream) {
          if (chunk.type === 'text') {
            assistantContent += chunk.content;
          } else if (chunk.type === 'context') {
            retrievedDocs = chunk.documents || [];
          } else if (chunk.type === 'tool_call') {
            toolCalls.push(chunk);
          } else if (chunk.type === 'token_count') {
            tokenCount = chunk.count || 0;
          }
        }

        // Save assistant response
        const { data: assistantMessage, error: assistantError } =
          await ctx.supabaseAdmin
            .from('messages')
            .insert({
              conversation_id: input.conversationId,
              role: 'assistant',
              content: assistantContent,
              retrieved_documents:
                retrievedDocs.length > 0 ? retrievedDocs : null,
              tool_calls: toolCalls.length > 0 ? toolCalls : null,
              token_count: tokenCount,
            })
            .select()
            .single();

        if (assistantError) {
          console.error('Failed to save assistant message:', assistantError);
        }

        // Log usage
        await ctx.supabaseAdmin.from('usage_logs').insert({
          tenant_id: ctx.tenant?.id!,
          user_id: ctx.user.id,
          conversation_id: input.conversationId,
          event_type: 'message',
          tokens_used: tokenCount,
          cost_cents: Math.ceil(tokenCount * 0.002), // Rough estimate
          metadata: {
            model: config.llm_model,
            retrieved_docs_count: retrievedDocs.length,
            tool_calls_count: toolCalls.length,
          },
        });

        return {
          messageId: assistantMessage?.id,
          content: assistantContent,
          retrievedDocs,
          toolCalls,
          tokenCount,
        };
      } catch (error) {
        console.error('Chat error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process message',
        });
      }
    }),

  // Get conversation history
  getConversation: tenantProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: conversation, error: convError } = await ctx.supabaseAdmin
        .from('conversations')
        .select(
          `
          *,
          messages (
            *
          )
        `
        )
        .eq('id', input.conversationId)
        .eq('tenant_id', ctx.tenant.id)
        .single();

      if (convError || !conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found',
        });
      }

      return conversation;
    }),

  // Create new conversation
  createConversation: tenantProcedure
    .input(
      z.object({
        title: z.string().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: conversation, error } = await ctx.supabaseAdmin
        .from('conversations')
        .insert({
          tenant_id: ctx.tenant?.id!,
          user_id: ctx.user.id,
          title: input.title,
          system_prompt: input.systemPrompt,
        })
        .select()
        .single();

      if (error || !conversation) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create conversation',
        });
      }

      return conversation;
    }),

  // List conversations for user
  listConversations: tenantProcedure
    .input(
      z.object({
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const { data: conversations, error } = await ctx.supabaseAdmin
        .from('conversations')
        .select(
          `
          *,
          messages (
            id,
            role,
            content,
            created_at
          )
        `
        )
        .eq('tenant_id', ctx.tenant.id)
        .eq('user_id', ctx.user.id)
        .order('updated_at', { ascending: false })
        .range(input.offset, input.offset + input.limit - 1);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch conversations',
        });
      }

      return conversations || [];
    }),

  // Update conversation
  updateConversation: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid(),
        title: z.string().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.systemPrompt !== undefined)
        updateData.system_prompt = input.systemPrompt;
      updateData.updated_at = new Date().toISOString();

      const { data: conversation, error } = await ctx.supabaseAdmin
        .from('conversations')
        .update(updateData)
        .eq('id', input.conversationId)
        .eq('tenant_id', ctx.tenant.id)
        .eq('user_id', ctx.user.id)
        .select()
        .single();

      if (error || !conversation) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Conversation not found or access denied',
        });
      }

      return conversation;
    }),

  // Delete conversation
  deleteConversation: tenantProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', input.conversationId)
        .eq('tenant_id', ctx.tenant.id)
        .eq('user_id', ctx.user.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete conversation',
        });
      }

      return { success: true };
    }),

  // RAG document search
  searchDocuments: tenantProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().default(10),
        threshold: z.number().default(0.7),
      })
    )
    .query(async ({ ctx, input }) => {
      try {
        // Get tenant configuration
        const { data: config } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('*')
          .eq('tenant_id', ctx.tenant!.id)
          .single();

        if (!config) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Tenant configuration not found',
          });
        }

        // Initialize RAG pipeline and perform search
        const ragPipeline = new RAGPipeline(config);
        const results = await ragPipeline.searchDocuments(
          input.query,
          input.limit,
          input.threshold
        );

        return results;
      } catch (error) {
        console.error('Document search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search documents',
        });
      }
    }),
  */
});