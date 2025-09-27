import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';

export interface RAGConfig {
  llm_provider: string;
  llm_model: string;
  llm_api_key: string;
  embedding_model: string;
  embedding_api_key?: string | null;
  temperature: number;
  max_context_length: number;
  system_prompt: string;
  vector_db_config: any;
  tenant_id: string;
}

export interface RAGResponse {
  type: 'text' | 'context' | 'tool_call' | 'token_count';
  content?: string;
  documents?: any[];
  tool?: any;
  count?: number;
}

export interface SearchResult {
  id: string;
  content: string;
  metadata: any;
  similarity: number;
  document?: any;
}

export class RAGPipeline {
  private config: RAGConfig;
  private llm!: ChatOpenAI | ChatAnthropic | ChatGoogleGenerativeAI;

  constructor(config: RAGConfig) {
    this.config = config;
    this.initializeLLM();
  }

  private initializeLLM() {
    switch (this.config.llm_provider.toLowerCase()) {
      case 'openai':
        this.llm = new ChatOpenAI({
          apiKey: this.config.llm_api_key,
          modelName: this.config.llm_model,
          temperature: this.config.temperature,
          maxTokens: this.config.max_context_length,
          streaming: true,
        });
        break;
      case 'anthropic':
        this.llm = new ChatAnthropic({
          apiKey: this.config.llm_api_key,
          model: this.config.llm_model,
          temperature: this.config.temperature,
          maxTokens: this.config.max_context_length,
        });
        break;
      case 'google': {
        const apiKey = this.config.llm_api_key;
        if (!apiKey) {
          throw new Error(
            'Gemini API key not found. Set GOOGLE_API_KEY in .env.local or provide llm_api_key in config.'
          );
        }
        this.llm = new ChatGoogleGenerativeAI({
          apiKey,
          model: this.config.llm_model,
          temperature: this.config.temperature,
          maxOutputTokens: this.config.max_context_length,
        });
        break;
      }
      default:
        throw new Error(
          `Unsupported LLM provider: ${this.config.llm_provider}`
        );
    }
  }

  /**
   * Process a message with RAG context and optional tool calls
   */
  async *processMessage(
    message: string,
    contextString: string,
    conversationId: string,
    availableTools: any[] = []
  ): AsyncGenerator<RAGResponse> {
    try {
      // Create the prompt template with proper parameter substitution
      const prompt = PromptTemplate.fromTemplate(`System: {systemPrompt}

{contextSection}

User Question: {message}

Instructions:
- Use the context information above to provide accurate, relevant responses
- If no relevant context is found, rely on your general knowledge but mention that no specific documentation was found
- Be conversational and helpful
- Cite sources when using context information

Response:`);

      // Prepare context section
      const contextSection =
        contextString && contextString.trim()
          ? `Relevant Context:\n${contextString}\n\nPlease use this context to provide accurate, well-informed responses.`
          : 'No relevant context found for this query.';

      // Create the processing chain
      const chain = RunnableSequence.from([
        prompt,
        this.llm,
        new StringOutputParser(),
      ]);

      let fullResponse = '';
      let tokenCount = 0;

      // Debug logging
      console.log('Processing message with context:', {
        messageLength: message.length,
        contextLength: contextString?.length || 0,
        hasContext: !!(contextString && contextString.trim()),
      });

      // Stream the response
      const stream = await chain.stream({
        systemPrompt: this.config.system_prompt,
        contextSection: contextSection,
        message: message,
      });

      for await (const chunk of stream) {
        if (typeof chunk === 'string') {
          fullResponse += chunk;
          tokenCount += this.estimateTokens(chunk);
          yield {
            type: 'text',
            content: chunk,
          };
        }
      }

      // Extract tool calls from the response
      const toolCalls = this.extractToolCalls(fullResponse, availableTools);
      for (const toolCall of toolCalls) {
        yield {
          type: 'tool_call',
          tool: toolCall,
        };
      }

      // Provide final token count
      yield {
        type: 'token_count',
        count: tokenCount,
      };

      console.log('Message processed successfully:', {
        responseLength: fullResponse.length,
        tokenCount: tokenCount,
        toolCalls: toolCalls.length,
      });
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error(`Failed to process message: ${(error as Error).message}`);
    }
  }

  /**
   * Search for relevant documents using semantic similarity
   * Note: This method is not implemented as vector search is handled in the chat router
   */
  searchDocuments(query: string, limit: number, threshold: number) {
    throw new Error(
      'Document search should be handled in the chat router using searchSimilarVectors'
    );
  }

  /**
   * Extract potential tool calls from LLM response
   */
  private extractToolCalls(response: string, availableTools: any[]): any[] {
    const toolCalls: any[] = [];

    // Simple tool call detection - look for patterns like "use [tool_name]" or "call [tool_name]"
    const toolCallRegex = /(?:use|call|invoke)\s+(\w+)/gi;
    const matches = response.matchAll(toolCallRegex);

    for (const match of matches) {
      const toolName = match[1]?.toLowerCase();
      const tool = availableTools.find(t => t.name.toLowerCase() === toolName);

      if (tool) {
        toolCalls.push({
          name: tool.name,
          description: tool.description,
          reason: `Detected intent to use ${tool.name} in response`,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Estimate token count for text
   */
  private estimateTokens(text: string): number {
    // Rough estimation: ~4 characters per token
    return Math.ceil(text.length / 4);
  }

  /**
   * Update pipeline configuration
   */
  async updateConfiguration(newConfig: Partial<RAGConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize LLM if provider/model changed
    if (
      newConfig.llm_provider ||
      newConfig.llm_model ||
      newConfig.llm_api_key
    ) {
      this.initializeLLM();
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): RAGConfig {
    return { ...this.config };
  }

  /**
   * Validate configuration
   */
  validateConfig(): boolean {
    const required = [
      'llm_provider',
      'llm_model',
      'llm_api_key',
      'system_prompt',
    ];

    for (const field of required) {
      if (!this.config[field as keyof RAGConfig]) {
        throw new Error(`Missing required config field: ${field}`);
      }
    }

    return true;
  }
}
