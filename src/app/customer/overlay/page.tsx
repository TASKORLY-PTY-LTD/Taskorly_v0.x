'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Send,
  Mic,
  Paperclip,
  Minimize2,
  Maximize2,
  Square,
  Bot,
  User,
  X,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface OverlayProps {
  isMinimized?: boolean;
  onToggleSize?: () => void;
  onClose?: () => void;
}

export default function CustomerOverlayPage() {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <div className='h-screen bg-slate-900 p-4'>
      <div className='h-full flex items-center justify-center'>
        <OverlayChat
          isMinimized={isMinimized}
          onToggleSize={() => setIsMinimized(!isMinimized)}
          onClose={() => console.log('Close overlay')}
        />
      </div>
    </div>
  );
}

function OverlayChat({
  isMinimized = false,
  onToggleSize,
  onClose,
}: OverlayProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content:
        "Hi! I can see you're using Square POS. How can I help you today?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async (content: string) => {
    if (!content.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsStreaming(true);

    // Simulate AI response
    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: generateQuickResponse(content),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);
      setIsStreaming(false);
    }, 1000);
  };

  const generateQuickResponse = (userInput: string): string => {
    if (userInput.toLowerCase().includes('refund')) {
      return 'To process a refund: Go to Transactions → Find the sale → Click Refund → Choose amount → Process. Need help finding a specific transaction?';
    } else if (
      userInput.toLowerCase().includes('payment') ||
      userInput.toLowerCase().includes('terminal')
    ) {
      return 'Payment issues? Try: 1) Check cables 2) Restart terminal 3) Test connection. What error are you seeing?';
    } else if (
      userInput.toLowerCase().includes('product') ||
      userInput.toLowerCase().includes('add')
    ) {
      return 'Adding products: Items & Orders → Items → Create Item → Fill details → Save. What type of product are you adding?';
    }

    return `I can help with that! Based on your Square setup, what specifically would you like assistance with?`;
  };

  if (isMinimized) {
    return (
      <div className='fixed bottom-4 right-4 z-50'>
        <Button
          onClick={onToggleSize}
          className='w-14 h-14 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg border-2 border-white/20'
        >
          <Bot className='w-6 h-6 text-white' />
        </Button>
        <Badge className='absolute -top-2 -right-2 w-6 h-6 p-0 bg-red-500 text-white text-xs flex items-center justify-center'>
          1
        </Badge>
      </div>
    );
  }

  return (
    <Card className='w-96 h-[600px] bg-slate-900/95 border-slate-700/50 backdrop-blur-xl shadow-2xl fixed bottom-4 right-4 z-50'>
      {/* Header */}
      <div className='flex items-center justify-between p-4 border-b border-slate-700/50'>
        <div className='flex items-center space-x-3'>
          <div className='w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center'>
            <Bot className='w-4 h-4 text-white' />
          </div>
          <div>
            <h3 className='font-semibold text-white text-sm'>Taskorly</h3>
            <div className='flex items-center space-x-1'>
              <Square className='w-3 h-3 text-green-400' />
              <span className='text-xs text-green-400'>Square Connected</span>
            </div>
          </div>
        </div>

        <div className='flex items-center space-x-1'>
          <Button
            variant='ghost'
            size='sm'
            onClick={onToggleSize}
            className='w-8 h-8 p-0 text-slate-400 hover:text-slate-300'
          >
            <Minimize2 className='w-4 h-4' />
          </Button>
          <Button
            variant='ghost'
            size='sm'
            onClick={onClose}
            className='w-8 h-8 p-0 text-slate-400 hover:text-slate-300'
          >
            <X className='w-4 h-4' />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className='flex-1 h-[400px]'>
        <div className='p-4 space-y-4'>
          {messages.map(message => (
            <div
              key={message.id}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`flex items-start space-x-2 max-w-[280px] ${
                  message.role === 'user'
                    ? 'flex-row-reverse space-x-reverse'
                    : ''
                }`}
              >
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-green-500 to-emerald-600'
                      : 'bg-gradient-to-br from-blue-500 to-purple-600'
                  }`}
                >
                  {message.role === 'user' ? (
                    <User className='w-3 h-3 text-white' />
                  ) : (
                    <Bot className='w-3 h-3 text-white' />
                  )}
                </div>

                <div
                  className={`rounded-lg px-3 py-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white'
                      : 'bg-slate-800/80 text-slate-100 border border-slate-700/50'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            </div>
          ))}

          {isStreaming && (
            <div className='flex justify-start'>
              <div className='flex items-start space-x-2'>
                <div className='w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center'>
                  <Bot className='w-3 h-3 text-white' />
                </div>
                <div className='bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-2'>
                  <div className='flex space-x-1'>
                    <div className='w-1 h-1 bg-blue-400 rounded-full animate-bounce'></div>
                    <div className='w-1 h-1 bg-blue-400 rounded-full animate-bounce animation-delay-200'></div>
                    <div className='w-1 h-1 bg-blue-400 rounded-full animate-bounce animation-delay-400'></div>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className='p-4 border-t border-slate-700/50'>
        <div className='flex items-center space-x-2'>
          <input
            type='text'
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyPress={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage(inputValue);
              }
            }}
            placeholder='Ask about Square POS...'
            className='flex-1 bg-slate-800/80 text-white placeholder-slate-400 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 border border-slate-700/50'
            disabled={isStreaming}
          />

          <Button
            variant='ghost'
            size='sm'
            className='w-8 h-8 p-0 text-slate-400 hover:text-slate-300'
          >
            <Mic className='w-4 h-4' />
          </Button>

          <Button
            onClick={() => handleSendMessage(inputValue)}
            disabled={!inputValue.trim() || isStreaming}
            size='sm'
            className='w-8 h-8 p-0 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white'
          >
            <Send className='w-3 h-3' />
          </Button>
        </div>

        {/* Quick suggestions */}
        <div className='mt-3 flex flex-wrap gap-1'>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleSendMessage('How do I process a refund?')}
            className='text-xs px-2 py-1 h-auto border-slate-600 hover:bg-slate-700/50 text-slate-300'
          >
            Refund
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleSendMessage('Payment not working')}
            className='text-xs px-2 py-1 h-auto border-slate-600 hover:bg-slate-700/50 text-slate-300'
          >
            Payment issue
          </Button>
          <Button
            variant='outline'
            size='sm'
            onClick={() => handleSendMessage('Add new product')}
            className='text-xs px-2 py-1 h-auto border-slate-600 hover:bg-slate-700/50 text-slate-300'
          >
            Add product
          </Button>
        </div>
      </div>

      <style jsx>{`
        .animation-delay-200 {
          animation-delay: 200ms;
        }
        .animation-delay-400 {
          animation-delay: 400ms;
        }
      `}</style>
    </Card>
  );
}
