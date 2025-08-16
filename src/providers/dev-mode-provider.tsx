'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface MockChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant' | 'system';
  timestamp: Date;
  sources?: Array<{
    id: string;
    title: string;
    content: string;
    similarity: number;
  }>;
}

interface MockDocument {
  id: string;
  title: string;
  content: string;
  type: 'pdf' | 'txt' | 'md' | 'docx';
  size: number;
  uploadedAt: Date;
  status: 'processing' | 'ready' | 'error';
}

interface MockMCPServer {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error';
  type: 'rag' | 'search' | 'analysis' | 'custom';
  endpoint: string;
}

interface DevModeContextType {
  isDevMode: boolean;
  toggleDevMode: () => void;
  mockMessages: MockChatMessage[];
  addMockMessage: (message: Omit<MockChatMessage, 'id' | 'timestamp'>) => void;
  mockDocuments: MockDocument[];
  addMockDocument: (document: Omit<MockDocument, 'id' | 'uploadedAt'>) => void;
  mockMCPServers: MockMCPServer[];
  updateMCPServerStatus: (id: string, status: MockMCPServer['status']) => void;
}

const DevModeContext = createContext<DevModeContextType | undefined>(undefined);

const initialMockMessages: MockChatMessage[] = [
  {
    id: '1',
    content:
      "Hello! I'm your RAG assistant. I can help you search and analyze your documents.",
    role: 'assistant',
    timestamp: new Date(Date.now() - 10000),
  },
  {
    id: '2',
    content:
      'Can you help me understand the main concepts in my uploaded documents?',
    role: 'user',
    timestamp: new Date(Date.now() - 8000),
  },
  {
    id: '3',
    content:
      "I've analyzed your documents and found several key concepts including machine learning, natural language processing, and vector embeddings. Would you like me to elaborate on any of these topics?",
    role: 'assistant',
    timestamp: new Date(Date.now() - 5000),
    sources: [
      {
        id: 'doc1',
        title: 'Machine Learning Basics.pdf',
        content:
          'Machine learning is a subset of artificial intelligence that enables computers to learn and improve from experience without being explicitly programmed...',
        similarity: 0.92,
      },
      {
        id: 'doc2',
        title: 'NLP Guide.md',
        content:
          'Natural Language Processing (NLP) is a branch of AI that helps computers understand, interpret and manipulate human language...',
        similarity: 0.88,
      },
    ],
  },
];

const initialMockDocuments: MockDocument[] = [
  {
    id: 'doc1',
    title: 'Machine Learning Basics.pdf',
    content:
      'A comprehensive guide to machine learning fundamentals, covering supervised and unsupervised learning techniques.',
    type: 'pdf',
    size: 2048576,
    uploadedAt: new Date(Date.now() - 86400000),
    status: 'ready',
  },
  {
    id: 'doc2',
    title: 'NLP Guide.md',
    content:
      'Natural Language Processing techniques and applications in modern AI systems.',
    type: 'md',
    size: 1024512,
    uploadedAt: new Date(Date.now() - 43200000),
    status: 'ready',
  },
  {
    id: 'doc3',
    title: 'Research Paper Draft.docx',
    content:
      'Draft research paper on vector embeddings and semantic search applications.',
    type: 'docx',
    size: 3145728,
    uploadedAt: new Date(Date.now() - 3600000),
    status: 'processing',
  },
];

const initialMockMCPServers: MockMCPServer[] = [
  {
    id: 'rag-server',
    name: 'RAG Pipeline Server',
    status: 'connected',
    type: 'rag',
    endpoint: 'localhost:8001',
  },
  {
    id: 'search-server',
    name: 'Document Search Server',
    status: 'connected',
    type: 'search',
    endpoint: 'localhost:8002',
  },
  {
    id: 'analysis-server',
    name: 'Content Analysis Server',
    status: 'disconnected',
    type: 'analysis',
    endpoint: 'localhost:8003',
  },
];

export function DevModeProvider({ children }: { children: ReactNode }) {
  const [isDevMode, setIsDevMode] = useState(true);
  const [mockMessages, setMockMessages] =
    useState<MockChatMessage[]>(initialMockMessages);
  const [mockDocuments, setMockDocuments] =
    useState<MockDocument[]>(initialMockDocuments);
  const [mockMCPServers, setMockMCPServers] = useState<MockMCPServer[]>(
    initialMockMCPServers
  );

  const toggleDevMode = () => {
    setIsDevMode(!isDevMode);
  };

  const addMockMessage = (
    message: Omit<MockChatMessage, 'id' | 'timestamp'>
  ) => {
    const newMessage: MockChatMessage = {
      ...message,
      id: Date.now().toString(),
      timestamp: new Date(),
    };
    setMockMessages(prev => [...prev, newMessage]);
  };

  const addMockDocument = (
    document: Omit<MockDocument, 'id' | 'uploadedAt'>
  ) => {
    const newDocument: MockDocument = {
      ...document,
      id: Date.now().toString(),
      uploadedAt: new Date(),
    };
    setMockDocuments(prev => [...prev, newDocument]);
  };

  const updateMCPServerStatus = (
    id: string,
    status: MockMCPServer['status']
  ) => {
    setMockMCPServers(prev =>
      prev.map(server => (server.id === id ? { ...server, status } : server))
    );
  };

  const value: DevModeContextType = {
    isDevMode,
    toggleDevMode,
    mockMessages,
    addMockMessage,
    mockDocuments,
    addMockDocument,
    mockMCPServers,
    updateMCPServerStatus,
  };

  return (
    <DevModeContext.Provider value={value}>{children}</DevModeContext.Provider>
  );
}

export function useDevMode() {
  const context = useContext(DevModeContext);
  if (context === undefined) {
    throw new Error('useDevMode must be used within a DevModeProvider');
  }
  return context;
}
