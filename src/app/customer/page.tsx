'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { trpc } from '@/utils/trpc';
import { POS_SYSTEM_PROMPT } from '../page';
import {
  Send,
  Mic,
  Paperclip,
  User,
  Camera,
  Square,
  Loader2,
  CheckCircle,
  FileText,
  ArrowRight,
  Settings,
  MessageSquare,
  Bot,
  Monitor,
  Zap,
  Sparkles,
  Shield,
} from 'lucide-react';
import CustomerChatBubble from '@/components/customer/customer-chat-bubble';

// Updated Message interface to match CustomerChatBubble requirements
interface Message {
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

const FEATURES = [
  {
    icon: <MessageSquare className="w-4 h-4" />,
    title: 'Smart Help',
    description: 'Get instant answers about your POS system',
  },
  {
    icon: <Zap className="w-4 h-4" />,
    title: 'Quick Actions',
    description: 'Process refunds, add products, and more',
  },
  {
    icon: <FileText className="w-4 h-4" />,
    title: 'Documentation',
    description: 'Access guides and troubleshooting tips',
  },
];

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

const SAMPLE_QUESTIONS = [
  'How do I process a refund?',
  'Help me add a new product',
  'Troubleshoot payment terminal',
  'Show me sales reports',
];

export default function CustomerChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWelcomeVisible, setIsWelcomeVisible] = useState(true);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [screenContext, setScreenContext] = useState<ScreenContext>({
    posSystem: 'square',
    currentScreen: 'dashboard',
    url: 'https://squareup.com/dashboard',
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // tRPC mutations
  const sendMessage = trpc.chat.sendMessage.useMutation();
  const createConversation = trpc.chat.createConversation.useMutation();

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

  // Generate contextual suggestions based on response
  const generateSuggestions = (content: string): string[] => {
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
  };

  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // Add user message immediately
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
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
          systemPrompt: POS_SYSTEM_PROMPT,
        });
        convId = conv.id;
        setConversationId(convId);
      }

      // Send message to Gemini LLM via RAG pipeline
      const response = await sendMessage.mutateAsync({
        conversationId: convId ?? undefined,
        message: content.trim(),
        includeContext: true,
        systemPrompt: POS_SYSTEM_PROMPT,
      });

      // Add assistant message with suggestions
      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.content,
        timestamp: new Date(),
        sources: response.retrievedDocs,
        tokenCount: response.tokenCount,
        suggestions: generateSuggestions(response.content),
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
        error: true, // Boolean flag for error state
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuggestionClick = (suggestion: Suggestion | string) => {
    const text = typeof suggestion === 'string' ? suggestion : suggestion.text;
    handleSendMessage(text);
  };

  const captureScreen = () => {
    setScreenContext(prev => ({
      ...prev,
      currentScreen: 'captured',
      visibleElements: ['checkout-button', 'product-grid', 'payment-options'],
    }));
  };

  const clearConversation = () => {
    setMessages([]);
    setConversationId(null);
    setIsWelcomeVisible(true);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-blue-900 via-slate-800 to-teal-900 text-white'>
      {/* Animated background */}
      <div className='fixed inset-0 overflow-hidden pointer-events-none'>
        <div className='absolute -top-40 -right-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob'></div>
        <div className='absolute -bottom-40 -left-40 w-80 h-80 bg-teal-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000'></div>
      </div>

      <div className='relative z-10 min-h-screen flex flex-col'>
        {/* Header */}
        <header className='flex items-center justify-between p-6'>
          <div className='flex items-center space-x-4'>
            <div className='w-10 h-10 rounded-xl flex items-center justify-center'>
              <Image
                src='/logo.png'
                alt='AI Assistant'
                width={40}
                height={40}
                className='rounded-lg' />
            </div>
            <div>
              <h1 className='text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent'>
                AI POS Assistant
              </h1>
              <p className='text-sm text-slate-400'>Smart help for your business</p>
            </div>
          </div>

          <div className='flex items-center space-x-3'>
            {/* {screenContext.posSystem && (
              <Badge
              variant='outline'
              className='border-teal-400 text-teal-400 bg-blue-800/50'
              >
              <CheckCircle className='w-3 h-3 mr-1' />
              {screenContext.posSystem.charAt(0).toUpperCase() +
                screenContext.posSystem.slice(1)}{' '}
              Connected
              </Badge>
              )} */}

            {isLoading && (
              <Badge variant="outline" className="border-blue-400 text-blue-400">
                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                Thinking...
              </Badge>
            )}

            <Button
              variant='outline'
              className='border-teal-400 text-teal-400 bg-blue-800/50'
            >
              <Camera className='w-4 h-4 mr-2' />
              Capture Screen
            </Button>

            <Button
              variant='outline'
              size='sm'
              onClick={() => setShowSidebar(!showSidebar)}
              className='border-teal-400 bg-blue-800/50 hover:border-teal-300 hover:bg-blue-700/70 text-teal-100 hover:text-white'
            >
              <Settings className='w-4 h-4' />
            </Button>
          </div>
        </header>

        {/* Welcome Section */}
        {isWelcomeVisible && (
          <div className='px-6 pb-6'>
            <div className='bg-white/10 rounded-2xl p-8 backdrop-blur-sm'>
              <div className='text-center mb-6'>
                <div className='w-16 h-16 bg-gradient-to-br from-blue-500 to-teal-500 rounded-2xl flex items-center justify-center mx-auto mb-4'>
                  <Bot className='w-8 h-8 text-white' />
                </div>
                <h2 className='text-2xl font-bold mb-2'>
                  Welcome to your AI POS Assistant
                </h2>
                <p className='text-slate-300'>
                  Get instant help with your POS system, from processing refunds to adding products
                </p>
              </div>

              {/* Features */}
              <div className='grid md:grid-cols-3 gap-4 mb-6'>
                {FEATURES.map((feature, index) => (
                  <div key={index} className='bg-white/5 rounded-xl p-4 text-center'>
                    <div className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3'>
                      <div className='text-teal-300'>{feature.icon}</div>
                    </div>
                    <h3 className='font-semibold text-white mb-1 text-sm'>
                      {feature.title}
                    </h3>
                    <p className='text-xs text-slate-400'>
                      {feature.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Sample Questions */}
              <div className='text-center'>
                <p className='text-slate-300 mb-4 text-sm'>Try asking:</p>
                <div className='flex flex-wrap gap-2 justify-center'>
                  {SAMPLE_QUESTIONS.map((question, index) => (
                    <Button
                      key={index}
                      variant='outline'
                      size='sm'
                      onClick={() => handleSuggestionClick(question)}
                      className='text-xs border-teal-400 bg-blue-800/30 hover:border-teal-300 hover:bg-blue-700/50 text-teal-100 hover:text-white'
                    >
                      {question}
                      <ArrowRight className='w-3 h-3 ml-2' />
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Main chat area */}
        <div className='flex-1 flex'>
          {/* Chat messages */}
          <div className='flex-1 flex flex-col'>
            <ScrollArea className='flex-1 px-6 py-4'>
              <div className='space-y-6 max-w-4xl mx-auto'>
                {messages.length === 0 && !isWelcomeVisible ? (
                  <div className='flex flex-col items-center justify-center h-64 text-center'>
                    <div className='w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mb-4'>
                      <Sparkles className='w-8 h-8 text-teal-300' />
                    </div>
                    <h3 className='text-lg font-semibold text-white mb-2'>
                      Ready to help with your POS system
                    </h3>
                    <p className='text-slate-400'>
                      Ask me anything about your business operations
                    </p>
                  </div>
                ) : (
                  messages.map(message => (
                    <CustomerChatBubble
                      key={message.id}
                      message={message}
                      isStreaming={message.isStreaming || false}
                      useCustomLogo={true}
                      logoSrc="/logo.png"
                      logoAlt="Taskorly Logo"
                      variant="fullscreen"
                      onSuggestionClick={(suggestion) => handleSendMessage(suggestion)} />
                  ))
                )}

                {/* Loading with CustomerChatBubble */}
                {isLoading && (
                  <CustomerChatBubble
                    message={{
                      id: 'loading',
                      role: 'assistant',
                      content: '',
                      timestamp: new Date(),
                      isStreaming: true
                    }}
                    isStreaming={true}
                    useCustomLogo={true}
                    logoSrc="/logo.png"
                    logoAlt="Taskorly Logo"
                    variant="fullscreen" />
                )}
              </div>
            </ScrollArea>

            {/* Input area */}
            <div className='p-6'>
              <div className='max-w-4xl mx-auto'>
                {/* Quick suggestions when not loading */}
                {!isLoading && messages.length > 0 && (
                  <div className='mb-4'>
                    <div className='flex flex-wrap gap-2'>
                      {MOCK_SUGGESTIONS.map(suggestion => (
                        <Button
                          key={suggestion.id}
                          variant='outline'
                          size='sm'
                          onClick={() => handleSuggestionClick(suggestion)}
                          className='text-xs border-teal-400 bg-blue-800/50 hover:border-teal-300 hover:bg-blue-700/70 text-teal-100 hover:text-white hover:shadow-lg hover:shadow-teal-500/25'
                        >
                          {suggestion.icon}
                          <span className='ml-2'>{suggestion.text}</span>
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Input */}
                <div className='relative'>
                  <div className='flex items-center space-x-3 bg-white/10 rounded-2xl p-3'>
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
                      disabled={isLoading} />

                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-slate-400 hover:text-slate-300 p-2'
                    >
                      <Paperclip className='w-4 h-4' />
                    </Button>

                    <Button
                      variant='ghost'
                      size='sm'
                      className='text-slate-400 hover:text-slate-300 p-2'
                    >
                      <Mic className='w-4 h-4' />
                    </Button>

                    <Button
                      onClick={() => handleSendMessage(inputValue)}
                      disabled={!inputValue.trim() || isLoading}
                      size='sm'
                      className='bg-gradient-to-r from-blue-500 to-teal-500 hover:from-blue-600 hover:to-teal-600 text-white'
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

          {/* Context sidebar - MOVED INSIDE the flex container */}
          {showSidebar && (
            <div className='w-80 p-4'>
              <Card className='border-0 bg-white/10 backdrop-blur-sm'>
                <div className='p-4'>
                  <div className='flex items-center space-x-2 mb-4'>
                    <Monitor className='w-5 h-5 text-blue-400' />
                    <h3 className='font-semibold text-white'>Screen Context</h3>
                  </div>

                  <div className='space-y-3 text-sm'>
                    <div>
                      <span className='text-slate-300'>System:</span>
                      <span className='ml-2 text-white capitalize'>
                        {screenContext.posSystem}
                      </span>
                    </div>

                    <div>
                      <span className='text-slate-300'>Current Page:</span>
                      <span className='ml-2 text-white'>
                        {screenContext.currentScreen}
                      </span>
                    </div>

                    {screenContext.url && (
                      <div>
                        <span className='text-slate-300'>URL:</span>
                        <span className='ml-2 text-slate-400 text-xs break-all'>
                          {screenContext.url}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Conversation Management */}
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
                      onClick={clearConversation}
                      className='w-full justify-start border-slate-600 hover:bg-slate-700/50 text-slate-300'
                    >
                      <Zap className='w-4 h-4 mr-2' />
                      New Conversation
                    </Button>
                  </div>

                  {/* Quick Actions */}
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
          )}
        </div>
      </div><style jsx>{`
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
      `}</style></div>)
};