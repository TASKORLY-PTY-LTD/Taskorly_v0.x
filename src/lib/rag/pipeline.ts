import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { Document } from 'langchain/document';
import { PromptTemplate } from '@langchain/core/prompts';
import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { supabaseAdmin } from '@/lib/supabase';
import type { Database } from '@/types/database.types';

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
  // private embeddings!: OpenAIEmbeddings;
  // private vectorStore!: SupabaseVectorStore;
  // private textSplitter!: RecursiveCharacterTextSplitter;

  constructor(config: RAGConfig) {
    this.config = config;
    this.initializeLLM();
    // this.initializeEmbeddings();
    // this.initializeVectorStore();
    // this.initializeTextSplitter();
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
        // Use config.llm_api_key if provided, else fallback to process.env.GOOGLE_API_KEY
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

  private initializeEmbeddings() {
    // const apiKey = this.config.embedding_api_key || this.config.llm_api_key;
    // this.embeddings = new OpenAIEmbeddings({
    //   apiKey,
    //   modelName: this.config.embedding_model,
    // });
  }

  private initializeVectorStore() {
    // this.vectorStore = new SupabaseVectorStore(this.embeddings, {
    //   client: supabaseAdmin,
    //   tableName: 'document_chunks',
    //   queryName: 'match_documents',
    //   filter: { tenant_id: this.config.tenant_id },
    // });
  }

  private initializeTextSplitter() {
    // this.textSplitter = new RecursiveCharacterTextSplitter({
    //   chunkSize: 1000,
    //   chunkOverlap: 200,
    //   separators: ['\n\n', '\n', ' ', ''],
    // });
  }

  /**
   * Process a document by chunking, embedding, and storing it
   */
  // async processDocument(document: any): Promise<number> {
  //   try {
  //     // Split document into chunks
  //     const chunks = await this.textSplitter.splitText(document.content);
  //
  //     // Create Document objects with metadata
  //     const docs = chunks.map(
  //       (chunk, index) =>
  //         new Document({
  //           pageContent: chunk,
  //           metadata: {
  //             document_id: document.id,
  //             tenant_id: document.tenant_id,
  //             title: document.title,
  //             content_type: document.content_type,
  //             source_url: document.source_url,
  //             chunk_index: index,
  //             ...document.metadata,
  //           },
  //         })
  //     );
  //
  //     // Add documents to vector store
  //     // await this.vectorStore.addDocuments(docs);
  //
  //     // Store chunk records in database
  //     // const chunkRecords = docs.map((doc, index) => ({
  //     //   document_id: document.id,
  //     //   tenant_id: document.tenant_id,
  //     //   content: doc.pageContent,
  //     //   chunk_index: index,
  //     //   metadata: doc.metadata,
  //     // }));
  //
  //     // const { error } = await supabaseAdmin
  //     //   .from('document_chunks')
  //     //   .insert(chunkRecords);
  //
  //     // if (error) {
  //     //   console.error('Error storing chunk records:', error);
  //     //   throw error;
  //     // }
  //
  //     return chunks.length;
  //   } catch (error) {
  //     console.error('Error processing document:', error);
  //     throw new Error(
  //       `Failed to process document: ${(error as Error).message}`
  //     );
  //   }
  // }

  /**
   * Search for relevant documents using semantic similarity
   */
  // async searchDocuments(
  //   query: string,
  //   limit: number = 10,
  //   threshold: number = 0.7
  // ): Promise<SearchResult[]> {
  //   try {
  //     // const results = await this.vectorStore.similaritySearchWithScore(
  //     //   query,
  //     //   limit,
  //     //   { tenant_id: this.config.tenant_id }
  //     // );
  //
  //     // return results
  //     //   .filter(([, score]) => score >= threshold)
  //     //   .map(([doc, score]) => ({
  //     //     id: doc.metadata.chunk_id || doc.metadata.document_id,
  //     //     content: doc.pageContent,
  //     //     metadata: doc.metadata,
  //     //     similarity: score,
  //     //     document: {
  //     //       id: doc.metadata.document_id,
  //     //       title: doc.metadata.title,
  //     //       content_type: doc.metadata.content_type,
  //     //       source_url: doc.metadata.source_url,
  //     //     },
  //     //   }));
  //
  //     throw new Error(
  //       `Failed to search documents: Semantic search is disabled (Supabase/VectorStore commented out)`
  //     );
  //   } catch (error) {
  //     console.error('Error searching documents:', error);
  //     throw new Error(
  //       `Failed to search documents: ${(error as Error).message}`
  //     );
  //   }
  // }

  /**
   * Process a message with RAG context and optional tool calls
   */
  async *processMessage(
    message: string,
    conversationId: string,
    availableTools: any[] = []
  ): AsyncGenerator<RAGResponse> {
    try {
      // 1. Retrieve relevant context
      // const relevantDocs = await this.searchDocuments(message, 5, 0.7);

      // if (relevantDocs.length > 0) {
      //   yield {
      //     type: 'context',
      //     documents: relevantDocs,
      //   };
      // }

      // 2. Get conversation history
      // const { data: messages } = await supabaseAdmin
      //   .from('messages')
      //   .select('role, content')
      //   .eq('conversation_id', conversationId)
      //   .order('created_at', { ascending: true })
      //   .limit(10);

      // 3. Build context string
      // const contextString = relevantDocs
      //   .map(
      //     doc =>
      //       `Content: ${doc.content}\nSource: ${doc.document?.title || 'Unknown'}`
      //   )
      //   .join('\n\n---\n\n');

      // 4. Build conversation history
      // const conversationHistory =
      //   messages?.map(msg => `${msg.role}: ${msg.content}`).join('\n') || '';

      // 5. Create RAG prompt
      // const ragPrompt = PromptTemplate.fromTemplate(`
      // ${this.config.system_prompt}
      //
      // Context Information:
      // ${contextString ? `\n${contextString}\n` : 'No relevant context found.'}
      //
      // Conversation History:
      // ${conversationHistory}
      //
      // Available Tools:
      // ${availableTools.length > 0 ? availableTools.map(tool => `- ${tool.name}: ${tool.description}`).join('\n') : 'No tools available.'}
      //
      // Current Message: {message}
      //
      // Instructions:
      // - Use the context information to provide accurate, relevant responses
      // - If no relevant context is found, rely on your general knowledge
      // - If you need to use a tool, indicate which tool and why
      // - Be conversational and helpful
      // - Cite sources when using context information
      //
      // Response:`);

      // 6. Create the chain

      // Stateless Gemini-only response
      const prompt = `${this.config.system_prompt}\n\nCurrent Message: ${message}\n`;
      const chain = RunnableSequence.from([
        PromptTemplate.fromTemplate(prompt),
        this.llm,
        new StringOutputParser(),
      ]);

      let fullResponse = '';
      let tokenCount = 0;

      // const stream = await chain.stream({
      //   message,
      //   context: contextString,
      //   history: conversationHistory,
      //   tools: availableTools,
      // });
      const stream = await chain.stream({ message });
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

      // 8. Check for tool calls in the response
      const toolCalls = this.extractToolCalls(fullResponse, availableTools);
      for (const toolCall of toolCalls) {
        yield {
          type: 'tool_call',
          tool: toolCall,
        };
      }

      // 9. Provide final token count
      yield {
        type: 'token_count',
        count: tokenCount,
      };
    } catch (error) {
      console.error('Error processing message:', error);
      throw new Error(`Failed to process message: ${(error as Error).message}`);
    }
  }

  /**
   * Delete document embeddings from vector store
   */
  // async deleteDocument(embeddingId: string): Promise<void> {
  //   try {
  //     // Delete from vector store (implementation depends on vector DB)
  //     // For Supabase, we'll delete the chunks  which will cascade
  //     // const { error } = await supabaseAdmin
  //     //   .from('document_chunks')
  //     //   .delete()
  //     //   .eq('embedding_id', embeddingId);
  //
  //     // if (error) {
  //     //   console.error('Error deleting document chunks:', error);
  //     //   throw error;
  //     // }
  //   } catch (error) {
  //     console.error('Error deleting document:', error);
  //     throw new Error(`Failed to delete document: ${(error as Error).message}`);
  //   }
  // }

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
   * Update vector store configuration
   */
  async updateConfiguration(newConfig: Partial<RAGConfig>): Promise<void> {
    this.config = { ...this.config, ...newConfig };

    // Reinitialize components if needed
    if (
      newConfig.llm_provider ||
      newConfig.llm_model ||
      newConfig.llm_api_key
    ) {
      this.initializeLLM();
    }

    // Commented out embedding/vector store reinitialization
    // if (newConfig.embedding_model || newConfig.embedding_api_key) {
    //   this.initializeEmbeddings();
    //   this.initializeVectorStore();
    // }
  }

  /**
   * Get pipeline statistics
   */
  // async getStats(): Promise<{
  //   totalChunks: number;
  //   totalDocuments: number;
  //   avgChunksPerDocument: number;
  // }> {
  //   const { data: chunks, error: chunksError } = await supabaseAdmin
  //     .from('document_chunks')
  //     .select('document_id')
  //     .eq('tenant_id', this.config.tenant_id);
  //
  //   const { data: documents, error: docsError } = await supabaseAdmin
  //     .from('documents')
  //     .select('id')
  //     .eq('tenant_id', this.config.tenant_id);
  //
  //   if (chunksError || docsError) {
  //     throw new Error('Failed to fetch pipeline statistics');
  //   }
  //
  //   const totalChunks = chunks?.length || 0;
  //   const totalDocuments = documents?.length || 0;
  //   const avgChunksPerDocument =
  //     totalDocuments > 0 ? totalChunks / totalDocuments : 0;
  //
  //   return {
  //     totalChunks,
  //     totalDocuments,
  //     avgChunksPerDocument: Math.round(avgChunksPerDocument * 100) / 100,
  //   };
  // }
}
