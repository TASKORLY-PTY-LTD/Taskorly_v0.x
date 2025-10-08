import React from 'react';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  suggestions?: string[];
  screenContext?: ScreenContext;
  sources?: Array<{
    title: string;
    content: string;
    similarity: number;
  }>;
  tokenCount?: number;
  error?: boolean;
  posContext?: {
    system: string;
    screen: string;
    action?: string;
  };
};

export type ScreenContext = {
  url?: string;
  posSystem?: 'square' | 'toast' | 'shopify' | 'generic';
  currentScreen?: string;
  visibleElements?: string[];
};

export type Suggestion = {
  id: string;
  text: string;
  category: 'pos' | 'general' | 'troubleshoot';
  icon: React.ReactNode;
};

export type MessageRole = 'user' | 'assistant';
export type SuggestionCategory = 'pos' | 'general' | 'troubleshoot';
export type ChatVariant = 'default' | 'overlay' | 'fullscreen';

export interface CustomerChatBubbleProps {
  message: Message;
  isStreaming: boolean;
  variant?: ChatVariant;
  onSuggestionClick?: (suggestion: string) => void;
  useCustomLogo?: boolean;
  logoSrc?: string;
  logoAlt?: string;
}

export interface ChatIntroProps {
  isVisible: boolean;
  onSuggestionClick: (suggestion: string) => void;
}

export interface HeaderProps {
  isLoading: boolean;
  onSettingsClick: () => void;
}

export interface ChatSettingsProps {
  isVisible: boolean;
  onClose: () => void;
  messageCount: number;
  conversationId: string | null;
  onNewConversation: () => void;
  onQuickAction: (action: string) => void;
}

export interface InputBoxProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  onSendMessage: (message: string) => void;
  onSuggestionClick: (suggestion: any) => void;
  isLoading: boolean;
  hasMessages: boolean;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: number;
}

export interface ChatError {
  message: string;
  code?: string;
  timestamp: Date;
}
