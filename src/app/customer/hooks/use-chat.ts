import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, ScreenContext, Suggestion } from '../types/customer.types';
import { ChatService } from '../services/chat-service';
import {
  createMessage,
  createErrorMessage,
  validateMessage,
} from '../utils/message-utils';
import { DEFAULT_SCREEN_CONTEXT } from '../constants/pos-system';
import { trpc } from '@/utils/trpc';

export interface UseChatOptions {
  initialMessages?: Message[];
  onError?: (error: Error) => void;
  onMessageSent?: (message: Message) => void;
  onMessageReceived?: (message: Message) => void;
}

export interface UseChatReturn {
  // State
  messages: Message[];
  inputValue: string;
  isLoading: boolean;
  isWelcomeVisible: boolean;
  conversationId: string | null;
  showSidebar: boolean;
  screenContext: ScreenContext;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  setInputValue: (value: string) => void;
  clearConversation: () => void;
  handleSuggestionClick: (suggestion: Suggestion | string) => void;
  handleQuickAction: (action: string) => void;
  captureScreen: () => void;
  setShowSidebar: (show: boolean) => void;

  // Refs
  scrollRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const {
    initialMessages = [],
    onError,
    onMessageSent,
    onMessageReceived,
  } = options;

  // tRPC hooks
  const sendMessageMutation = trpc.chat.sendMessage.useMutation();
  const createConversationMutation = trpc.chat.createConversation.useMutation();

  // Create chat service with tRPC dependencies
  const chatService = new ChatService({
    sendMessageMutation,
    createConversationMutation,
  });

  // State
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [screenContext, setScreenContext] = useState<ScreenContext>(
    DEFAULT_SCREEN_CONTEXT
  );

  // Refs
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Hide welcome when messages exist
  useEffect(() => {
    setIsWelcomeVisible(messages.length === 0);
  }, [messages.length]);

  // Send message handler
  const sendMessage = useCallback(
    async (content: string) => {
      // Validate message
      const validation = validateMessage(content);
      if (!validation.isValid) {
        onError?.(new Error(validation.error || 'Invalid message'));
        return;
      }

      // Add user message immediately
      const userMessage = createMessage('user', content);
      setMessages(prev => [...prev, userMessage]);
      setInputValue('');
      setIsLoading(true);

      // Callback for user message
      onMessageSent?.(userMessage);

      try {
        const result = await chatService.sendMessage({
          content: content.trim(),
          conversationId: conversationId || undefined,
        });

        // Update conversation ID if it's new
        if (!conversationId) {
          setConversationId(result.conversationId);
        }

        // Add assistant message
        setMessages(prev => [...prev, result.message]);
        onMessageReceived?.(result.message);
      } catch (error) {
        console.error('Failed to send message:', error);

        // Add error message
        const errorMessage = createErrorMessage();
        setMessages(prev => [...prev, errorMessage]);
        onError?.(error as Error);
      } finally {
        setIsLoading(false);
      }
    },
    [conversationId, onError, onMessageSent, onMessageReceived, chatService]
  );

  // Clear conversation
  const clearConversation = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setIsWelcomeVisible(true);
  }, []);

  // Handle suggestion click
  const handleSuggestionClick = useCallback(
    (suggestion: Suggestion | string) => {
      const text =
        typeof suggestion === 'string' ? suggestion : suggestion.text;
      sendMessage(text);
    },
    [sendMessage]
  );

  // Handle quick action
  const handleQuickAction = useCallback(
    (action: string) => {
      sendMessage(action);
    },
    [sendMessage]
  );

  // Capture screen context
  const captureScreen = useCallback(() => {
    setScreenContext(prev => ({
      ...prev,
      currentScreen: 'captured',
      visibleElements: ['checkout-button', 'product-grid', 'payment-options'],
    }));
  }, []);

  return {
    // State
    messages,
    inputValue,
    isLoading,
    isWelcomeVisible,
    conversationId,
    showSidebar,
    screenContext,

    // Actions
    sendMessage,
    setInputValue,
    clearConversation,
    handleSuggestionClick,
    handleQuickAction,
    captureScreen,
    setShowSidebar,

    // Refs
    scrollRef,
    inputRef,
  };
}
