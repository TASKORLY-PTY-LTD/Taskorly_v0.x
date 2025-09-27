import { z } from 'zod';
import { createTRPCRouter, publicProcedure, tenantProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { RAGPipeline } from '@/lib/rag/pipeline';
import { generateSingleEmbedding } from '@/lib/vector-embedder';
import { searchSimilarVectors } from '@/lib/pinecone-client';

export const chatRouter = createTRPCRouter({
  // Enhanced sendMessage with RAG functionality
  sendMessage: tenantProcedure
    .input(
      z.object({
        conversationId: z.string().uuid().optional(),
        message: z.string().min(1),
        includeContext: z.boolean().default(true),
        maxTokens: z.number().optional(),
        systemPrompt: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        let retrievedDocs: any[] = [];
        let contextString = '';

        // Step 1: Generate embedding for the user's query
        if (input.includeContext) {
          console.log('Generating embedding for query:', input.message);

          const queryEmbedding = await generateSingleEmbedding(input.message, {
            model: 'text-embedding-004', // Use the same model as vector-embedder
          });

          // Step 2: Search Pinecone for relevant documents
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

          // Step 3: Process search results
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

            // Build context string for the LLM
            contextString = retrievedDocs
              .map(doc => `Document: ${doc.title}\nContent: ${doc.content}`)
              .join('\n\n---\n\n');

            console.log(`Found ${retrievedDocs.length} relevant documents.`);
          }
        }

        // Step 4: Enhanced system prompt with context
        const enhancedSystemPrompt = input.systemPrompt
          ? `${input.systemPrompt}\n\n${contextString ? `\nRelevant Context:\n${contextString}\n\nPlease use this context to provide accurate, well-informed responses. If the context doesn't contain relevant information, rely on your general knowledge but mention that no specific documentation was found.` : ''}`
          : `You are a helpful AI assistant. ${contextString ? `\n\nRelevant Context:\n${contextString}\n\nUse this context to provide accurate responses.` : ''}`;

        console.log('Enhanced system prompt:', {
          length: enhancedSystemPrompt.length,
          includesContext: enhancedSystemPrompt.includes('Relevant Context'),
          context: contextString,
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

        // Step 8: Add source citation if context was used
        // if (retrievedDocs.length > 0 && assistantContent) {
        //   assistantContent += '\n\n---\n**Sources:**\n' +
        //     retrievedDocs.map(doc => `• ${doc.title} (${Math.round(doc.similarity * 100)}% relevance)`).join('\n');
        // }

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

  // Standalone document search endpoint
  searchDocuments: tenantProcedure
    .input(
      z.object({
        query: z.string().min(1),
        limit: z.number().default(10),
        threshold: z.number().default(0.3),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        // Generate embedding for search query
        console.log('Generating embedding for search query:', input.query);

        const queryEmbedding = await generateSingleEmbedding(input.query, {
          model: 'text-embedding-004',
        });

        // Search Pinecone
        console.log('Searching Pinecone...');

        const searchResults = await searchSimilarVectors(
          queryEmbedding,
          ctx.tenant?.id || 'public-tenant',
          ctx.user.id,
          {
            topK: input.limit,
            includeMetadata: true,
            config: { namespace: `default-${ctx.user.tenant_id}` },
          }
        );

        // Process and return results
        const results = searchResults
          .filter(result => result.score >= input.threshold)
          .map(result => ({
            id: result.id,
            score: result.score,
            content: result.metadata.content || '',
            title: result.metadata.documentId || 'Unknown',
            metadata: result.metadata,
          }));

        return {
          query: input.query,
          results,
          totalResults: results.length,
        };
      } catch (error) {
        console.error('Document search error:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to search documents',
        });
      }
    }),

  // Test vector search connectivity
  testVectorSearch: tenantProcedure
    .input(
      z.object({
        testQuery: z.string().default('test query'),
      })
    )
    .query(async ({ input, ctx }) => {
      try {
        const embedding = await generateSingleEmbedding(input.testQuery, {
          model: 'text-embedding-004',
        });

        const results = await searchSimilarVectors(
          embedding,
          ctx.tenant?.id || 'public-tenant',
          ctx.user.id,
          {
            topK: 3,
            includeMetadata: true,
          }
        );

        return {
          success: true,
          embeddingDimensions: embedding.length,
          resultsFound: results.length,
          sampleResults: results.slice(0, 2).map(result => ({
            id: result.id,
            score: result.score,
            hasMetadata: !!result.metadata,
          })),
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
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
