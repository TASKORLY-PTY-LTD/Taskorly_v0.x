'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import MessageBubble from '@/components/chat/message-bubble';
import { DemoChatInput } from '@/components/chat/demo-chat-input';
import { trpc } from '@/utils/trpc';
import { useEffect, useRef, useState } from 'react';
import {
  MessageSquare,
  FileText,
  Zap,
  Users,
  ArrowRight,
  Sparkles,
  Bot,
  CheckCircle,
  Loader2,
} from 'lucide-react';

const FEATURES = [
  {
    icon: <MessageSquare className="w-5 h-5" />,
    title: 'Intelligent Chat',
    description:
      'Ask questions about your company documents and get AI-powered answers',
  },
  {
    icon: <FileText className="w-5 h-5" />,
    title: 'Document Search',
    description:
      'Semantic search across all your uploaded documents with relevance scoring',
  },
  {
    icon: <Zap className="w-5 h-5" />,
    title: 'Real-time Responses',
    description: 'Get instant, contextual responses with source citations',
  },
];

const SAMPLE_QUESTIONS = [
  'What are the main concepts in my documents?',
  'Summarize the key points from the uploaded files',
  'Help me understand the technical details',
  'What are the business implications discussed?',
];

interface Messages {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Array<{
    title: string;
    content: string;
    similarity: number;
  }>;
  tokenCount?: number;
}

export default function ChatV2Page() {
  const [messages, setMessages] = useState<Messages[]>([]);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

//   const sendDemoMessage = trpc.chat.sendDemoMessage.useMutation();
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const createConversation = trpc.chat.createConversation.useMutation();

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    setIsWelcomeVisible(messages.length === 0);
  }, [messages.length]);

  // Store conversationId in state
  const [conversationId, setConversationId] = useState<string | null>(null);

  const handleSendMessage = async (messageContent: string) => {
    if (isLoading) return;

    // Add user message immediately
    const userMessage: Messages = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      let convId = conversationId;
      if (!convId) {
        // Create a new conversation if none exists
        const conv = await createConversation.mutateAsync({});
        convId = conv.id;
        setConversationId(convId);
      }

      const response = await sendMessage.mutateAsync({
        conversationId: convId ?? undefined,
        message: messageContent,
        includeContext: true,
      });

      // Add assistant message
      const assistantMessage: Messages = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        sources: response.retrievedDocs,
        tokenCount: response.tokenCount,
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Add error message
      const errorMessage: Messages = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSampleQuestion = (question: string) => {
    handleSendMessage(question);
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Welcome Section */}
      {isWelcomeVisible && (
        <div className="bg-gradient-to-br from-blue-50 to-indigo-100 border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="text-center">
              <div className="flex justify-center mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl flex items-center justify-center">
                  <Bot className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-4xl font-bold tracking-tight text-gray-900 mb-4">
                Experience AI-Powered Document Chat
              </h1>
              <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
                This demo showcases how your customers can interact with an AI
                assistant to get answers about your company information,
                products, and services.
              </p>

              {/* Features Grid */}
              <div className="grid md:grid-cols-3 gap-6 mb-8">
                {FEATURES.map((feature, index) => (
                  <Card
                    key={index}
                    className="p-6 bg-white/80 backdrop-blur-sm border-0 shadow-lg"
                  >
                    <div className="flex items-center justify-center w-12 h-12 bg-blue-100 rounded-xl mb-4 mx-auto">
                      <div className="text-blue-600">{feature.icon}</div>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {feature.description}
                    </p>
                  </Card>
                ))}
              </div>

              {/* Sample Questions */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Try asking:
                </h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {SAMPLE_QUESTIONS.map((question, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      onClick={() => handleSampleQuestion(question)}
                      className="bg-white/90 hover:bg-white border-blue-200 hover:border-blue-300 text-gray-700 hover:text-blue-700"
                    >
                      {question}
                      <ArrowRight className="w-3 h-3 ml-2" />
                    </Button>
                  ))}
                </div>
              </div>

              {/* Demo Badge */}
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">
                  Powered by advanced RAG technology
                </span>
              </div>
            </div>
          </div>



        </div>
      )}

      {/* Chat Interface */}
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6">
        <div
          className={`flex-1 flex flex-col bg-white rounded-xl border shadow-sm ${
            isWelcomeVisible ? 'mt-0' : 'mt-4'
          }`}
        >
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-xl">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div>
                <h2 className="font-semibold text-gray-900">
                  AI Document Assistant
                </h2>
                <p className="text-xs text-gray-500">
                  Ask me about your company information
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="secondary"
                className="bg-green-100 text-green-700 border-green-200"
              >
                <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                Online
              </Badge>
              <span className="text-xs text-gray-500 bg-white px-3 py-1 rounded-full border">
                {messages.length} messages
              </span>
              {isLoading && (
                <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                  <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                  Thinking...
                </Badge>
              )}
            </div>
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-6" ref={scrollRef}>
            <div className="max-w-4xl mx-auto">
              {messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-3xl flex items-center justify-center mb-6">
                    <Sparkles className="w-10 h-10 text-blue-500" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-3">
                    Ready to help with your questions
                  </h3>
                  <p className="text-gray-600 max-w-md mb-8">
                    I can search through documents, answer questions about your
                    company, and provide detailed insights based on your
                    uploaded content.
                  </p>
                  <div className="grid grid-cols-2 gap-4 w-full max-w-lg">
                    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      <FileText className="w-4 h-4 text-blue-500" />
                      <span>Document search</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
                      <MessageSquare className="w-4 h-4 text-green-500" />
                      <span>Contextual answers</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {messages.map(message => (
                    <MessageBubble key={message.id} message={message} />
                  ))}
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      <div className="ml-4 max-w-[80%]">
                        <Card className="p-4 bg-white border-gray-200">
                          <div className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                            <span className="text-gray-600">Analyzing your question...</span>
                          </div>
                        </Card>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Chat Input */}
          <div className="border-t bg-gray-50/80 rounded-b-xl">
            <DemoChatInput
              onSendMessage={handleSendMessage}
              disabled={isLoading}
              placeholder="Ask me anything about your company information..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
