'use client';

/*
 * CUSTOMER CHAT PAGE - GEMINI LLM INTEGRATION
 * 
 * This page has been updated to use the Gemini LLM via RAG pipeline instead of mock responses.
 * The original mock implementation has been preserved as comments for reference.
 * 
 * Key changes:
 * - Added tRPC integration for LLM calls
 * - Replaced mock responses with real LLM responses
 * - Added conversation management
 * - Enhanced UI to show sources and token counts
 * - Changed isStreaming to isLoading for better LLM state management
 * 
 * To revert to mock mode, uncomment the mock implementation and comment out the LLM code.
 */

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/utils/trpc';
import { POS_SYSTEM_PROMPT } from '../page'; // Added for LLM integration
import {
  MessageSquare,
  Send,
  Mic,
  Paperclip,
  Zap,
  Monitor,
  Shield,
  Sparkles,
  Bot,
  User,
  Camera,
  Square,
  Loader2, // Added for LLM loading states
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  screenContext?: ScreenContext;
  // Added for LLM integration:
  sources?: Array<{
    title: string;
    content: string;
    similarity: number;
  }>;
  tokenCount?: number;
  error?: string;
}

interface ScreenContext {
  url?: string;
  posSystem?: 'square' | 'toast' | 'shopify' | 'generic';
  currentScreen?: string;
  visibleElements?: string[];
}

interface Suggestion {
  id: string;
  text: string;
  category: 'pos' | 'general' | 'troubleshoot';
  icon: React.ReactNode;
}

const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    id: '1',
    text: 'How do I process a refund in Square?',
    category: 'pos',
    icon: <Square className='h-4 w-4' />,
  },
  {
    id: '2',
    text: 'Payment terminal not responding',
    category: 'troubleshoot',
    icon: <Shield className='h-4 w-4' />,
  },
  {
    id: '3',
    text: 'How to add a new product?',
    category: 'pos',
    icon: <Sparkles className='h-4 w-4' />,
  },
  {
    id: '4',
    text: 'Generate daily sales report',
    category: 'general',
    icon: <Monitor className='h-4 w-4' />,
  },
];

export default function CustomerChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I'm your AI assistant for POS systems. I can help you with Square, troubleshooting, or any questions about your system. What can I help you with today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false); // Changed from isStreaming for LLM integration
  const [conversationId, setConversationId] = useState<string | null>(null); // Added for LLM conversation management
  const [screenContext, setScreenContext] = useState<ScreenContext>({
    posSystem: 'square',
    currentScreen: 'dashboard',
    url: 'https://squareup.com/dashboard',
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations for Gemini LLM integration (added for LLM functionality)
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const createConversation = trpc.chat.createConversation.useMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      screenContext,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      // Create conversation if needed
      let convId = conversationId;
      if (!convId) {
        const conv = await createConversation.mutateAsync({
          title: 'Customer Support Chat',
          systemPrompt: POS_SYSTEM_PROMPT, // Using system prompt from page.tsx
        });
        convId = conv.id;
        setConversationId(convId);
      }

      // Send message to Gemini LLM via RAG pipeline
      const response = await sendMessage.mutateAsync({
        conversationId: convId ?? undefined,
        message: content.trim(),
        includeContext: true,
        systemPrompt: POS_SYSTEM_PROMPT, // Using system prompt from page.tsx
      });

      // Add assistant message
      const assistantMessage: Message = {
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
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'assistant',
        content: 'Sorry, I encountered an error processing your message. Please try again.',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }

    /* ORIGINAL MOCK IMPLEMENTATION (COMMENTED OUT)
    // Mock implementation - uncomment to use instead of LLM
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
      screenContext,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateMockResponse(content, screenContext),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsStreaming(false);
    }, 1500);
    */
  };


  const handleSuggestionClick = (suggestion: Suggestion) => {
    handleSendMessage(suggestion.text);
  };

  /* ORIGINAL MOCK RESPONSE FUNCTION (COMMENTED OUT)
  const generateMockResponse = (
    userInput: string,
    context: ScreenContext
  ): string => {
    if (userInput.toLowerCase().includes('refund')) {
      return '🔄 To process a refund in Square:\n\n1. Navigate to your Square Dashboard\n2. Go to "Transactions" in the left menu\n3. Find the transaction you want to refund\n4. Click "Refund" and select full or partial\n5. Process the refund to the original payment method\n\nI can see you\'re currently on your Square dashboard - would you like me to guide you through this step by step?';
    } else if (
      userInput.toLowerCase().includes('payment') ||
      userInput.toLowerCase().includes('terminal')
    ) {
      return '🛡️ Payment terminal issues can usually be resolved by:\n\n1. Check all cable connections\n2. Restart the terminal (hold power for 10 seconds)\n3. Ensure stable internet connection\n4. Contact Square support if issue persists\n\nBased on your current screen, I can help troubleshoot specific error messages. What exactly is happening with your terminal?';
    } else if (
      userInput.toLowerCase().includes('product') ||
      userInput.toLowerCase().includes('add')
    ) {
      return '✨ Adding new products in Square:\n\n1. From your dashboard, click "Items & Orders"\n2. Select "Items" from the menu\n3. Click "+ Create Item"\n4. Fill in product details (name, price, category)\n5. Add photos and set inventory tracking if needed\n6. Save your new item\n\nWould you like me to walk through any specific product setup requirements?';
    }

    return `I understand you're asking about "${userInput}". Based on your Square POS system, I can provide specific guidance. Could you share more details about what you're trying to accomplish?`;
  };
  */

  const captureScreen = () => {
    // Mock screen capture
    setScreenContext(prev => ({
      ...prev,
      currentScreen: 'captured',
      visibleElements: ['checkout-button', 'product-grid', 'payment-options'],
    }));
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white'>
      {/* Animated background elements */}
      <div className='absolute inset-0 overflow-hidden'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob'></div>
        <div className='absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000'></div>
        <div className='absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-cyan-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000'></div>
      </div>

      <div className='relative z-10 h-screen flex flex-col'>
        {/* Header */}
        <header className='flex items-center justify-between p-6 border-b border-slate-700/50 backdrop-blur-lg bg-slate-800/30'>
          <div className='flex items-center space-x-4'>
            <div className='w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center'>
              <Bot className='w-6 h-6 text-white' />
            </div>
            <div>
              <h1 className='text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent'>
                Taskorly Assistant
              </h1>
              <p className='text-sm text-slate-400'>AI-powered POS support</p>
            </div>
          </div>

          <div className='flex items-center space-x-3'>
            {screenContext.posSystem && (
              <Badge
                variant='outline'
                className='border-blue-400 text-blue-400'
              >
                <Square className='w-3 h-3 mr-1' />
                {screenContext.posSystem.charAt(0).toUpperCase() +
                  screenContext.posSystem.slice(1)}{' '}
                Connected
              </Badge>
            )}

            <Button
              variant='outline'
              size='sm'
              onClick={captureScreen}
              className='border-slate-600 hover:border-slate-500 hover:bg-slate-800'
            >
              <Camera className='w-4 h-4 mr-2' />
              Capture Screen
            </Button>
          </div>
        </header>

        {/* Main chat area */}
        <div className='flex-1 flex'>
          {/* Chat messages */}
          <div className='flex-1 flex flex-col'>
            <ScrollArea className='flex-1 px-6 py-4'>
              <div className='space-y-6 max-w-4xl mx-auto'>
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`flex items-start space-x-3 max-w-2xl ${
                        message.role === 'user'
                          ? 'flex-row-reverse space-x-reverse'
                          : ''
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                            : message.error
                            ? 'bg-gradient-to-br from-red-500 to-red-600'
                            : 'bg-gradient-to-br from-blue-500 to-purple-600'
                        }`}
                      >
                        {message.role === 'user' ? (
                          <User className='w-4 h-4 text-white' />
                        ) : message.error ? (
                          <Shield className='w-4 h-4 text-white' />
                        ) : (
                          <Bot className='w-4 h-4 text-white' />
                        )}
                      </div>

                      {/* Message bubble */}
                      <div
                        className={`rounded-2xl px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white'
                            : message.error
                            ? 'bg-gradient-to-br from-red-800/60 to-red-900/60 border border-red-700/50 text-red-100'
                            : 'bg-slate-800/60 backdrop-blur-lg border border-slate-700/50 text-slate-100'
                        }`}
                      >
                        <div className='whitespace-pre-wrap'>
                          {message.content}
                        </div>
                        
                        {/* Sources - Added for LLM integration */}
                        {message.sources && message.sources.length > 0 && (
                          <div className='mt-3 pt-3 border-t border-slate-600/50'>
                            <div className='text-xs text-slate-400 mb-2'>Sources:</div>
                            {message.sources.map((source, index) => (
                              <div key={index} className='text-xs text-slate-300 mb-1'>
                                • {source.title} ({(source.similarity * 100).toFixed(0)}% match)
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Token count - Added for LLM integration */}
                        {message.tokenCount && (
                          <div className='text-xs text-slate-400 mt-2'>
                            Tokens: {message.tokenCount}
                          </div>
                        )}

                        <div
                          className={`text-xs mt-2 ${
                            message.role === 'user'
                              ? 'text-green-100'
                              : message.error
                              ? 'text-red-200'
                              : 'text-slate-400'
                          }`}
                        >
                          {message.timestamp.toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Loading indicator - changed from isStreaming to isLoading for LLM integration */}
                {isLoading && (
                  <div className='flex justify-start'>
                    <div className='flex items-start space-x-3'>
                      <div className='w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'>
                        <Loader2 className='w-4 h-4 text-white animate-spin' />
                      </div>
                      <div className='bg-slate-800/60 backdrop-blur-lg border border-slate-700/50 rounded-2xl px-4 py-3'>
                        <div className='flex items-center space-x-2'>
                          <div className='flex space-x-1'>
                            <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce'></div>
                            <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-200'></div>
                            <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-400'></div>
                          </div>
                          <span className='text-sm text-slate-400'>
                            AI is thinking...
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className='border-t border-slate-700/50 bg-slate-800/30 backdrop-blur-lg p-6'>
              <div className='max-w-4xl mx-auto'>
                {/* Suggestions */}
                <div className='mb-4'>
                  <div className='flex flex-wrap gap-2'>
                    {MOCK_SUGGESTIONS.map(suggestion => (
                      <Button
                        key={suggestion.id}
                        variant='outline'
                        size='sm'
                        onClick={() => handleSuggestionClick(suggestion)}
                        className='text-xs border-slate-600 hover:border-slate-500 hover:bg-slate-700/50 text-slate-300'
                      >
                        {suggestion.icon}
                        <span className='ml-2'>{suggestion.text}</span>
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Input */}
                <div className='relative'>
                  <div className='flex items-center space-x-3 bg-slate-900/60 backdrop-blur-lg border border-slate-700/50 rounded-2xl p-3'>
                    <input
                      ref={inputRef}
                      type='text'
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      onKeyPress={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage(inputValue);
                        }
                      }}
                      placeholder='Ask me anything about your POS system...'
                      className='flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none text-sm'
                      disabled={isLoading} // Changed from isStreaming for LLM integration
                    />

                    <div className='flex items-center space-x-2'>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-slate-400 hover:text-slate-300'
                      >
                        <Paperclip className='w-4 h-4' />
                      </Button>

                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-slate-400 hover:text-slate-300'
                      >
                        <Mic className='w-4 h-4' />
                      </Button>

                      <Button
                        onClick={() => handleSendMessage(inputValue)}
                        disabled={!inputValue.trim() || isLoading} // Changed from isStreaming for LLM integration
                        size='sm'
                        className='bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
                      >
                        {isLoading ? (
                          <Loader2 className='w-4 h-4 animate-spin' />
                        ) : (
                          <Send className='w-4 h-4' />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Context sidebar */}
          <div className='w-80 border-l border-slate-700/50 bg-slate-800/20 backdrop-blur-lg p-4'>
            <Card className='bg-slate-900/60 border-slate-700/50 backdrop-blur-lg'>
              <div className='p-4'>
                <div className='flex items-center space-x-2 mb-4'>
                  <Monitor className='w-5 h-5 text-blue-400' />
                  <h3 className='font-semibold text-white'>Screen Context</h3>
                </div>

                <div className='space-y-3 text-sm'>
                  <div>
                    <span className='text-slate-400'>System:</span>
                    <span className='ml-2 text-white capitalize'>
                      {screenContext.posSystem}
                    </span>
                  </div>

                  <div>
                    <span className='text-slate-400'>Current Page:</span>
                    <span className='ml-2 text-white'>
                      {screenContext.currentScreen}
                    </span>
                  </div>

                  {screenContext.url && (
                    <div>
                      <span className='text-slate-400'>URL:</span>
                      <span className='ml-2 text-blue-400 text-xs break-all'>
                        {screenContext.url}
                      </span>
                    </div>
                  )}
                </div>

                {/* Conversation Management - Added for LLM integration */}
                <div className='mt-4 pt-4 border-t border-slate-700/50'>
                  <h4 className='text-sm font-medium text-white mb-2'>
                    Conversation
                  </h4>
                  <div className='space-y-2 text-xs text-slate-400 mb-3'>
                    <div>Messages: {messages.length}</div>
                    {conversationId && (
                      <div>ID: {conversationId.slice(0, 8)}...</div>
                    )}
                  </div>
                  <Button
                    variant='outline'
                    size='sm'
                    onClick={() => {
                      setMessages([]);
                      setConversationId(null);
                      console.log('Cleared messages, starting fresh conversation');
                    }}
                    className='w-full justify-start border-slate-600 hover:bg-slate-700/50 text-slate-300'
                  >
                    <Zap className='w-4 h-4 mr-2' />
                    New Conversation
                  </Button>
                </div>

                {/* Quick Actions - Updated to work with LLM instead of mock responses */}
                <div className='mt-4 pt-4 border-t border-slate-700/50'>
                  <h4 className='text-sm font-medium text-white mb-2'>
                    Quick Actions
                  </h4>
                  <div className='space-y-2'>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleSendMessage('How do I process a refund?')}
                      className='w-full justify-start border-slate-600 hover:bg-slate-700/50 text-slate-300'
                    >
                      <Zap className='w-4 h-4 mr-2' />
                      Process Refund
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleSendMessage('How do I add a new product?')}
                      className='w-full justify-start border-slate-600 hover:bg-slate-700/50 text-slate-300'
                    >
                      <Sparkles className='w-4 h-4 mr-2' />
                      Add Product
                    </Button>
                    <Button
                      variant='outline'
                      size='sm'
                      onClick={() => handleSendMessage('My payment terminal is not working')}
                      className='w-full justify-start border-slate-600 hover:bg-slate-700/50 text-slate-300'
                    >
                      <Shield className='w-4 h-4 mr-2' />
                      Troubleshoot
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </div>
  );
}
