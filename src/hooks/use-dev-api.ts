'use client';

import { useDevMode } from '@/providers/dev-mode-provider';

// Dev mode API hooks that simulate real API calls with mock data
export function useDevApi() {
  const {
    isDevMode,
    mockMessages,
    addMockMessage,
    // mockDocuments,
    // addMockDocument,
  } = useDevMode();

  const sendMessage = async (content: string): Promise<void> => {
    if (!isDevMode) {
      // In production mode, this would call the real API
      throw new Error('Production API not implemented');
    }

    // Add user message
    addMockMessage({
      content,
      role: 'user',
    });

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Generate mock assistant response
    const responses = [
      'I understand your question. Let me search through your documents for relevant information.',
      'Based on your uploaded documents, I can provide some insights on this topic.',
      "That's an interesting question. I've found several relevant passages in your document collection.",
      'Let me analyze the content in your documents to provide a comprehensive answer.',
    ];

    const randomResponse =
      responses[Math.floor(Math.random() * responses.length)] ||
      "I'm sorry, I don't have a response at the moment.";

    addMockMessage({
      content: randomResponse,
      role: 'assistant',
      // sources: mockDocuments.slice(0, 2).map(doc => ({
      //   id: doc.id,
      //   title: doc.title,
      //   content: doc.content.slice(0, 100) + '...',
      //   similarity: Math.random() * 0.3 + 0.7, // 0.7-1.0 range
      // })),
    });
  };

  const uploadDocument = async (file: File): Promise<void> => {
    throw new Error('Use trpc mutation instead');
  };

  const searchDocuments = async (query: string) => {
    throw new Error('Use trpc query instead');
  };

  return {
    sendMessage,
    uploadDocument,
    searchDocuments,
    isDevMode,
  };
}