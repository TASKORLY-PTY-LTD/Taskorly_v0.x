import { Message } from '../types/customer.types';
import { POS_SYSTEM_PROMPT } from '../constants/pos-system';
import { createMessage, createErrorMessage } from '../utils/message-utils';

export interface ChatServiceConfig {
  systemPrompt?: string;
  includeContext?: boolean;
}

export interface SendMessageParams {
  content: string;
  conversationId?: string;
  config?: ChatServiceConfig;
}

export interface SendMessageResult {
  message: Message;
  conversationId: string;
}

export interface ChatServiceDependencies {
  sendMessageMutation: any;
  createConversationMutation: any;
}

export class ChatService {
  constructor(private deps: ChatServiceDependencies) {}

  /**
   * Sends a message and returns the response
   */
  async sendMessage({
    content,
    conversationId,
    config = {},
  }: SendMessageParams): Promise<SendMessageResult> {
    const { systemPrompt = POS_SYSTEM_PROMPT, includeContext = true } = config;

    try {
      // Create conversation if needed
      let convId = conversationId;
      if (!convId) {
        const conv = await this.deps.createConversationMutation.mutateAsync({
          title: 'Customer Support Chat',
          systemPrompt,
        });
        convId = conv.id;
      }

      // Send message to Gemini LLM via RAG pipeline
      const response = await this.deps.sendMessageMutation.mutateAsync({
        conversationId: convId!,
        message: content,
        includeContext,
        systemPrompt,
      });

      // Create assistant message
      const assistantMessage = createMessage('assistant', response.content, {
        sources: response.retrievedDocs,
        tokenCount: response.tokenCount,
      });

      return {
        message: assistantMessage,
        conversationId: convId!,
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  }

  /**
   * Creates a new conversation
   */
  async createConversation(
    title: string = 'Customer Support Chat',
    systemPrompt: string = POS_SYSTEM_PROMPT
  ) {
    try {
      const conversation =
        await this.deps.createConversationMutation.mutateAsync({
          title,
          systemPrompt,
        });
      return conversation;
    } catch (error) {
      console.error('Failed to create conversation:', error);
      throw error;
    }
  }

  /**
   * Gets the loading state of mutations
   */
  get isLoading(): boolean {
    return (
      this.deps.sendMessageMutation.isLoading ||
      this.deps.createConversationMutation.isLoading
    );
  }

  /**
   * Gets any error from mutations
   */
  get error(): Error | null {
    return (
      this.deps.sendMessageMutation.error ||
      this.deps.createConversationMutation.error ||
      null
    );
  }
}
