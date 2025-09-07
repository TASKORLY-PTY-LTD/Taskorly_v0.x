import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { RAGPipeline } from '@/lib/rag/pipeline';

export const chatRouter = createTRPCRouter({
  // Send message and get streaming response
  sendMessage: publicProcedure
    .input(
      z.object({
        conversationId: z.string().uuid().optional(),
        message: z.string().min(1),
        includeContext: z.boolean().default(true),
        maxTokens: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Directly use Gemini LLM (RAGPipeline)
        // CONST CONFIG!!
        const config = {
          llm_provider: 'google',
          llm_model: 'gemini-2.5-flash-lite',
          llm_api_key: process.env.GOOGLE_API_KEY ?? '',
          embedding_model: 'text-embedding-ada-002',
          temperature: 0.7,
          max_context_length: 2048,
          system_prompt: 'You are a helpful assistant.',
          vector_db_config: {},
          tenant_id: 'public-tenant',
        };
        const ragPipeline = new RAGPipeline(config);
        const availableTools: any[] = [];
        const responseStream = await ragPipeline.processMessage(
          input.message,
          input.conversationId ?? 'public-conv-id',
          availableTools
        );

        let assistantContent = '';
        let retrievedDocs: any[] = [];
        const toolCalls: any[] = [];
        let tokenCount = 0;

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

        return {
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

  // Create new conversation (stateless, returns a random UUID)
  createConversation: publicProcedure
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

  // Demo message handler for public chat-v2 page
  sendDemoMessage: publicProcedure
    .input(
      z.object({
        message: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        // Generate mock responses based on input
        const mockResponses = [
          {
            trigger: ['document', 'file', 'upload'],
            response: `I can help you work with documents! Based on your question about "${input.message}", here are some key capabilities:

📄 **Document Processing**: I can analyze PDFs, Word docs, text files, and more
🔍 **Smart Search**: Find relevant information across all your uploaded content
🎯 **Contextual Answers**: Get precise answers with source citations
📊 **Insights**: Extract key themes and summarize complex information

Would you like to know more about how our RAG (Retrieval Augmented Generation) system works?`,
            sources: [
              {
                title: 'Demo Document - Company Policies.pdf',
                content: 'This is a demonstration of how document sources would appear when I reference specific information from your uploaded files...',
                similarity: 0.92
              },
              {
                title: 'Demo Document - Product Manual.docx',
                content: 'Another example showing how I can pull relevant context from multiple documents to provide comprehensive answers...',
                similarity: 0.87
              }
            ]
          },
          {
            trigger: ['ai', 'artificial intelligence', 'machine learning', 'technology'],
            response: `Great question about AI technology! Here's what powers this demonstration:

🧠 **Advanced Language Models**: Using state-of-the-art LLMs (GPT, Claude, Gemini)
🔗 **RAG Architecture**: Retrieval Augmented Generation for accurate, source-backed responses
⚡ **Real-time Processing**: Instant document search and context retrieval
🎯 **Multi-Modal Support**: Handle text, images, and structured data

This demo shows how your customers could interact with an AI trained on your specific company knowledge base. The AI can understand context, maintain conversation history, and provide accurate information about your products and services.`,
            sources: [
              {
                title: 'AI Architecture Overview.md',
                content: 'Technical documentation explaining the RAG pipeline, vector embeddings, and semantic search capabilities...',
                similarity: 0.95
              }
            ]
          },
          {
            trigger: ['help', 'support', 'question', 'how'],
            response: `I'm here to help! This is a demo of an AI-powered customer support system. Here's what I can assist with:

❓ **Answer Questions**: About your products, services, and company policies
🔧 **Troubleshooting**: Guide users through common issues step-by-step
📋 **Information Lookup**: Find specific details from your documentation
💬 **Natural Conversation**: Maintain context throughout our discussion

In a production deployment, I would be trained on your specific:
- Product documentation
- FAQ databases
- Support articles
- Company policies
- Technical manuals

Try asking me something specific about your business needs!`,
            sources: []
          },
          {
            trigger: ['company', 'business', 'service', 'product'],
            response: `Thanks for asking about our business capabilities! This demo showcases how AI can transform customer experience:

🏢 **Business Intelligence**: I can analyze your company data and provide insights
📈 **Customer Support**: 24/7 automated assistance with escalation to human agents
🔄 **Process Automation**: Streamline repetitive tasks and workflows
📊 **Analytics**: Track customer interactions and identify improvement opportunities

Key benefits for your organization:
- Reduce response times from hours to seconds
- Scale customer support without growing headcount
- Ensure consistent, accurate information delivery
- Capture customer insights for product development

Would you like to see how this could integrate with your existing systems?`,
            sources: [
              {
                title: 'Business Integration Guide.pdf',
                content: 'Comprehensive guide covering API integrations, webhook configurations, and deployment strategies...',
                similarity: 0.89
              }
            ]
          }
        ];

        // Find matching response or use default
        const matchedResponse = mockResponses.find(response =>
          response.trigger.some(trigger =>
            input.message.toLowerCase().includes(trigger.toLowerCase())
          )
        );

        const defaultResponse = `Thank you for your message: "${input.message}"

This is a demonstration of our AI-powered document chat system. In a real deployment, I would:

🔍 Search through your uploaded documents for relevant information
🎯 Provide precise answers with source citations
💬 Maintain conversation context and history
⚡ Respond in real-time with streaming updates

Some example questions you could try:
- "What are the key features of your product?"
- "How do I get technical support?"
- "Tell me about your company policies"
- "What documentation do you have available?"

This demo shows the potential for transforming customer experience with AI!`;

        const response = matchedResponse || {
          response: defaultResponse,
          sources: [
            {
              title: 'Demo Documentation.md',
              content: 'This is an example of how source documents would be referenced in responses...',
              similarity: 0.85
            }
          ]
        };

        return {
          content: response.response,
          sources: response.sources,
          tokenCount: Math.floor(response.response.length / 4), // Rough estimate
        };
      } catch (error) {
        console.error('Demo chat error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process demo message',
        });
      }
    }),
  */
});

/*
// Legacy chatRouter implementation (Supabase, tenant, demo logic)
// This code is preserved for reference and is not currently active.
// ...existing code...
*/
