import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { encrypt, decrypt } from '@/lib/encryption';

export const configRouter = createTRPCRouter({
  // Get tenant configuration
  getConfig: protectedProcedure
    .query(async ({ ctx }) => {
      const { data: config, error } = await ctx.supabaseAdmin
        .from('tenant_configurations')
        .select('*')
        .eq('tenant_id', ctx.tenant?.id!)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found is OK
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch configuration',
        });
      }

      // Don't return API keys in the response, just indicate if they exist
      if (config) {
        return {
          ...config,
          llm_api_key: config.llm_api_key ? '[ENCRYPTED]' : null,
          embedding_api_key: config.embedding_api_key ? '[ENCRYPTED]' : null,
        };
      }

      return null;
    }),

  // Create or update tenant configuration (admin only)
  updateConfig: adminProcedure
    .input(z.object({
      llm_provider: z.enum(['openai', 'anthropic', 'google']).optional(),
      llm_model: z.string().optional(),
      llm_api_key: z.string().optional(),
      embedding_model: z.string().optional(),
      embedding_api_key: z.string().optional(),
      temperature: z.number().min(0).max(2).optional(),
      max_context_length: z.number().min(1000).max(100000).optional(),
      system_prompt: z.string().optional(),
      vector_db_config: z.record(z.any()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // Prepare update data
        const updateData: any = {};
        
        if (input.llm_provider !== undefined) updateData.llm_provider = input.llm_provider;
        if (input.llm_model !== undefined) updateData.llm_model = input.llm_model;
        if (input.embedding_model !== undefined) updateData.embedding_model = input.embedding_model;
        if (input.temperature !== undefined) updateData.temperature = input.temperature;
        if (input.max_context_length !== undefined) updateData.max_context_length = input.max_context_length;
        if (input.system_prompt !== undefined) updateData.system_prompt = input.system_prompt;
        if (input.vector_db_config !== undefined) updateData.vector_db_config = input.vector_db_config;

        // Encrypt API keys if provided
        if (input.llm_api_key !== undefined) {
          updateData.llm_api_key = encrypt(input.llm_api_key);
        }
        if (input.embedding_api_key !== undefined) {
          updateData.embedding_api_key = input.embedding_api_key ? encrypt(input.embedding_api_key) : null;
        }

        updateData.updated_at = new Date().toISOString();

        // Try to update first, then insert if doesn't exist
        const { data: existingConfig } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('id')
          .eq('tenant_id', ctx.tenant?.id!)
          .single();

        if (existingConfig) {
          // Update existing
          const { error } = await ctx.supabaseAdmin
            .from('tenant_configurations')
            .update(updateData)
            .eq('tenant_id', ctx.tenant?.id!);

          if (error) {
            throw error;
          }
        } else {
          // Create new
          const { error } = await ctx.supabaseAdmin
            .from('tenant_configurations')
            .insert({
              tenant_id: ctx.tenant?.id!,
              llm_provider: input.llm_provider || 'openai',
              llm_model: input.llm_model || 'gpt-4',
              llm_api_key: input.llm_api_key ? encrypt(input.llm_api_key) : '',
              embedding_model: input.embedding_model || 'text-embedding-ada-002',
              embedding_api_key: input.embedding_api_key ? encrypt(input.embedding_api_key) : null,
              temperature: input.temperature ?? 0.7,
              max_context_length: input.max_context_length ?? 4000,
              system_prompt: input.system_prompt || 'You are a helpful AI assistant that can access and search through documents to provide accurate, relevant responses.',
              vector_db_config: input.vector_db_config || {},
              ...updateData,
            });

          if (error) {
            throw error;
          }
        }

        return { success: true };
      } catch (error) {
        console.error('Error updating configuration:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update configuration',
        });
      }
    }),

  // Get decrypted API key for internal use (server-side only)
  getDecryptedApiKey: protectedProcedure
    .input(z.object({
      keyType: z.enum(['llm_api_key', 'embedding_api_key']),
    }))
    .query(async ({ ctx, input }) => {
      const { data: config, error } = await ctx.supabaseAdmin
        .from('tenant_configurations')
        .select(input.keyType)
        .eq('tenant_id', ctx.tenant?.id!)
        .single();

      if (error || !config) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Configuration not found',
        });
      }

      const encryptedKey = config[input.keyType];
      if (!encryptedKey) {
        return null;
      }

      try {
        return decrypt(encryptedKey);
      } catch (error) {
        console.error('Error decrypting API key:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to decrypt API key',
        });
      }
    }),

  // Test configuration by making a simple API call
  testConfig: adminProcedure
    .mutation(async ({ ctx }) => {
      try {
        // Get configuration
        const { data: config, error } = await ctx.supabaseAdmin
          .from('tenant_configurations')
          .select('*')
          .eq('tenant_id', ctx.tenant?.id!)
          .single();

        if (error || !config) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Configuration not found',
          });
        }

        // Test LLM connection
        const llmApiKey = decrypt(config.llm_api_key);
        let llmTest = false;
        let embeddingTest = false;

        // Simple test based on provider
        switch (config.llm_provider) {
          case 'openai':
            try {
              const response = await fetch('https://api.openai.com/v1/models', {
                headers: {
                  'Authorization': `Bearer ${llmApiKey}`,
                },
              });
              llmTest = response.ok;
            } catch {
              llmTest = false;
            }
            break;
          case 'anthropic':
            try {
              const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                  'x-api-key': llmApiKey,
                  'anthropic-version': '2023-06-01',
                  'content-type': 'application/json',
                },
                body: JSON.stringify({
                  model: config.llm_model,
                  max_tokens: 1,
                  messages: [{ role: 'user', content: 'test' }],
                }),
              });
              llmTest = response.status !== 401; // Not unauthorized
            } catch {
              llmTest = false;
            }
            break;
          default:
            llmTest = true; // Assume valid for unsupported providers
        }

        // Test embedding API if different from LLM
        if (config.embedding_api_key) {
          const embeddingApiKey = decrypt(config.embedding_api_key);
          try {
            const response = await fetch('https://api.openai.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${embeddingApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                model: config.embedding_model,
                input: 'test',
              }),
            });
            embeddingTest = response.ok;
          } catch {
            embeddingTest = false;
          }
        } else {
          embeddingTest = llmTest; // Same key
        }

        return {
          llm: llmTest,
          embedding: embeddingTest,
          overall: llmTest && embeddingTest,
        };
      } catch (error) {
        console.error('Error testing configuration:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to test configuration',
        });
      }
    }),

  // Get usage statistics
  getUsageStats: protectedProcedure
    .input(z.object({
      days: z.number().default(30),
    }))
    .query(async ({ ctx, input }) => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - input.days);

      const { data: stats, error } = await ctx.supabaseAdmin
        .from('usage_logs')
        .select('*')
        .eq('tenant_id', ctx.tenant?.id!)
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch usage statistics',
        });
      }

      const totalTokens = stats?.reduce((sum, log) => sum + (log.tokens_used || 0), 0) || 0;
      const totalCost = stats?.reduce((sum, log) => sum + (log.cost_cents || 0), 0) || 0;
      const totalMessages = stats?.filter(log => log.event_type === 'message').length || 0;
      const totalDocuments = stats?.filter(log => log.event_type === 'document_upload').length || 0;
      const totalToolCalls = stats?.filter(log => log.event_type === 'tool_execution').length || 0;

      // Group by day
      const dailyStats = stats?.reduce((acc, log) => {
        const date = log.created_at.split('T')[0];
        if (!acc[date]) {
          acc[date] = { tokens: 0, cost: 0, messages: 0, documents: 0, tools: 0 };
        }
        acc[date].tokens += log.tokens_used || 0;
        acc[date].cost += log.cost_cents || 0;
        if (log.event_type === 'message') acc[date].messages++;
        if (log.event_type === 'document_upload') acc[date].documents++;
        if (log.event_type === 'tool_execution') acc[date].tools++;
        return acc;
      }, {} as Record<string, any>) || {};

      return {
        summary: {
          totalTokens,
          totalCost,
          totalMessages,
          totalDocuments,
          totalToolCalls,
        },
        daily: dailyStats,
      };
    }),
});