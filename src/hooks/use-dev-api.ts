'use client';

import { useDevMode } from '@/providers/dev-mode-provider';

// Dev mode API hooks that simulate real API calls with mock data
export function useDevApi() {
  const {
    isDevMode,
    mockMessages,
    addMockMessage,
    mockDocuments,
    addMockDocument,
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
      sources: mockDocuments.slice(0, 2).map(doc => ({
        id: doc.id,
        title: doc.title,
        content: doc.content.slice(0, 100) + '...',
        similarity: Math.random() * 0.3 + 0.7, // 0.7-1.0 range
      })),
    });
  };

  const uploadDocument = async (file: File): Promise<void> => {
    if (!isDevMode) {
      // In production mode, this would call the real API
      throw new Error('Production API not implemented');
    }

    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 2000));

    const fileType =
      (file.name.split('.').pop() as 'pdf' | 'txt' | 'md' | 'docx') || 'txt';

    addMockDocument({
      title: file.name,
      content: `Mock content for ${file.name}. This would contain the actual extracted text from the uploaded file.`,
      type: fileType,
      size: file.size,
      status: 'processing',
    });

    // Simulate processing completion
    setTimeout(() => {
      // In a real implementation, this would update the document status
      console.log(`Document ${file.name} processing completed`);
    }, 3000);
  };

  const searchDocuments = async (query: string) => {
    if (!isDevMode) {
      // In production mode, this would call the real API
      throw new Error('Production API not implemented');
    }

    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 500));

    // Return mock search results
    return mockDocuments
      .filter(
        doc =>
          doc.title.toLowerCase().includes(query.toLowerCase()) ||
          doc.content.toLowerCase().includes(query.toLowerCase())
      )
      .map(doc => ({
        ...doc,
        relevanceScore: Math.random() * 0.4 + 0.6, // 0.6-1.0 range
      }));
  };

  return {
    sendMessage,
    uploadDocument,
    searchDocuments,
    isDevMode,
  };
}
