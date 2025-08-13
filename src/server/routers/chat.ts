import { z } from 'zod';
import { createTRPCRouter, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { RAGPipeline } from '@/lib/rag/pipeline';
import { MCPManager } from '@/lib/mcp/manager';

export const chatRouter = createTRPCRouter({
  // Send message and get streaming response
  sendMessage: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      message: z.string().min(1),
      includeContext: z.boolean().default(true),
      maxTokens: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Get conversation and verify access
        const { data: conversation, error: convError } = await ctx.supabaseAdmin
          .from('conversations')
          .select('*')
          .eq('id', input.conversationId)
          .eq('tenant_id', ctx.tenant?.id)
          .single();

        if (convError || !conversation) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Conversation not found',
          });
        }

        // Save user message
        const { data: userMessage, error: messageError } = await ctx.supabaseAdmin
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
          .eq('tenant_id', ctx.tenant?.id)
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
        const availableTools = await mcpManager.getAvailableTools(ctx.tenant?.id!);

        // Generate response using RAG + MCP
        const responseStream = await ragPipeline.processMessage(
          input.message,
          input.conversationId,
          availableTools
        );

        let assistantContent = '';
        let retrievedDocs: any[] = [];
        let toolCalls: any[] = [];
        let tokenCount = 0;

        // Process the stream
        for await (const chunk of responseStream) {
          if (chunk.type === 'text') {
            assistantContent += chunk.content;
          } else if (chunk.type === 'context') {
            retrievedDocs = chunk.documents;
          } else if (chunk.type === 'tool_call') {
            toolCalls.push(chunk);
          } else if (chunk.type === 'token_count') {
            tokenCount = chunk.count;
          }
        }

        // Save assistant response
        const { data: assistantMessage, error: assistantError } = await ctx.supabaseAdmin
          .from('messages')
          .insert({
            conversation_id: input.conversationId,
            role: 'assistant',
            content: assistantContent,
            retrieved_documents: retrievedDocs.length > 0 ? retrievedDocs : null,
            tool_calls: toolCalls.length > 0 ? toolCalls : null,
            token_count: tokenCount,
          })
          .select()
          .single();

        if (assistantError) {
          console.error('Failed to save assistant message:', assistantError);
        }

        // Log usage
        await ctx.supabaseAdmin
          .from('usage_logs')
          .insert({
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
  getConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .query(async ({ ctx, input }) => {
      const { data: conversation, error: convError } = await ctx.supabaseAdmin
        .from('conversations')
        .select(`
          *,
          messages (
            *
          )
        `)
        .eq('id', input.conversationId)
        .eq('tenant_id', ctx.tenant?.id)
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
  createConversation: protectedProcedure
    .input(z.object({
      title: z.string().optional(),
      systemPrompt: z.string().optional(),
    }))
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
  listConversations: protectedProcedure
    .input(z.object({
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ ctx, input }) => {
      const { data: conversations, error } = await ctx.supabaseAdmin
        .from('conversations')
        .select(`
          *,
          messages (
            id,
            role,
            content,
            created_at
          )
        `)
        .eq('tenant_id', ctx.tenant?.id)
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
  updateConversation: protectedProcedure
    .input(z.object({
      conversationId: z.string().uuid(),
      title: z.string().optional(),
      systemPrompt: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const updateData: any = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.systemPrompt !== undefined) updateData.system_prompt = input.systemPrompt;
      updateData.updated_at = new Date().toISOString();

      const { data: conversation, error } = await ctx.supabaseAdmin
        .from('conversations')
        .update(updateData)
        .eq('id', input.conversationId)
        .eq('tenant_id', ctx.tenant?.id)
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
  deleteConversation: protectedProcedure
    .input(z.object({ conversationId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabaseAdmin
        .from('conversations')
        .delete()
        .eq('id', input.conversationId)
        .eq('tenant_id', ctx.tenant?.id)
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
  searchDocuments: protectedProcedure
    .input(z.object({
      query: z.string(),
      limit: z.number().default(10),
      threshold: z.number().default(0.7),
    }))
    .query(async ({ ctx, input }) => {
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
});