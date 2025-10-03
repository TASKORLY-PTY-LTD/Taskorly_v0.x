import { Message } from '../types/customer.types';

/**
 * Cleans and formats message content for display
 */
export function cleanContent(content: string): string {
  return content
    .replace(/\[object Object\]/g, '')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/<br\s*\/?><br\s*\/?>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Generates contextual suggestions based on message content
 */
export function generateSuggestions(content: string): string[] {
  const suggestions = [];

  if (content.toLowerCase().includes('refund')) {
    suggestions.push('Show me refund policies', 'Process another refund');
  }
  if (content.toLowerCase().includes('product')) {
    suggestions.push('Add inventory tracking', 'Set up categories');
  }
  if (content.toLowerCase().includes('payment')) {
    suggestions.push('Test payment terminal', 'Check connection');
  }

  return suggestions.slice(0, 3);
}

/**
 * Creates a new message object with proper typing
 */
export function createMessage(
  role: 'user' | 'assistant',
  content: string,
  options: Partial<Omit<Message, 'id' | 'role' | 'content' | 'timestamp'>> = {}
): Message {
  return {
    id: `${role}-${Date.now()}`,
    role,
    content: content.trim(),
    timestamp: new Date(),
    ...options,
  };
}

/**
 * Creates an error message
 */
export function createErrorMessage(
  content: string = 'Sorry, I encountered an error processing your message. Please try again.'
): Message {
  return createMessage('assistant', content, { error: true });
}

/**
 * Creates a loading message for streaming
 */
export function createLoadingMessage(): Message {
  return createMessage('assistant', '', { isStreaming: true });
}

/**
 * Formats timestamp for display
 */
export function formatTimestamp(timestamp: Date): string {
  return timestamp.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Validates message content
 */
export function validateMessage(content: string): {
  isValid: boolean;
  error?: string;
} {
  if (!content || !content.trim()) {
    return { isValid: false, error: 'Message cannot be empty' };
  }

  if (content.length > 1000) {
    return { isValid: false, error: 'Message is too long' };
  }

  return { isValid: true };
}
