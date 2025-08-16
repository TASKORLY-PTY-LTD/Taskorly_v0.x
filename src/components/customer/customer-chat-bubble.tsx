'use client';

import { Bot, User, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  suggestions?: string[];
  posContext?: {
    system: string;
    screen: string;
    action?: string;
  };
}

interface CustomerChatBubbleProps {
  message: Message;
  variant?: 'default' | 'overlay' | 'fullscreen';
  onSuggestionClick?: (suggestion: string) => void;
}

export function CustomerChatBubble({
  message,
  variant = 'default',
  onSuggestionClick,
}: CustomerChatBubbleProps) {
  const isUser = message.role === 'user';
  const isOverlay = variant === 'overlay';
  const isFullscreen = variant === 'fullscreen';

  if (message.isStreaming) {
    return (
      <div className='flex justify-start'>
        <div
          className={`flex items-start space-x-3 ${isOverlay ? 'space-x-2' : ''}`}
        >
          <div
            className={`rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center ${
              isOverlay ? 'w-6 h-6' : 'w-8 h-8'
            }`}
          >
            <Bot
              className={`text-white ${isOverlay ? 'w-3 h-3' : 'w-4 h-4'}`}
            />
          </div>
          <div
            className={`rounded-2xl px-4 py-3 bg-slate-800/60 backdrop-blur-lg border border-slate-700/50 ${
              isOverlay ? 'px-3 py-2 rounded-lg' : ''
            }`}
          >
            <div className='flex items-center space-x-2'>
              <div className='flex space-x-1'>
                <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce'></div>
                <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-200'></div>
                <div className='w-2 h-2 bg-blue-400 rounded-full animate-bounce animation-delay-400'></div>
              </div>
              <span
                className={`text-slate-400 ${isOverlay ? 'text-xs' : 'text-sm'}`}
              >
                AI is thinking...
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex items-start max-w-2xl ${
          isOverlay ? 'max-w-[280px] space-x-2' : 'space-x-3'
        } ${isUser ? 'flex-row-reverse space-x-reverse' : ''}`}
      >
        {/* Avatar */}
        <div
          className={`rounded-full flex items-center justify-center ${
            isOverlay ? 'w-6 h-6' : 'w-8 h-8'
          } ${
            isUser
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : 'bg-gradient-to-br from-blue-500 to-purple-600'
          }`}
        >
          {isUser ? (
            <User
              className={`text-white ${isOverlay ? 'w-3 h-3' : 'w-4 h-4'}`}
            />
          ) : (
            <Bot
              className={`text-white ${isOverlay ? 'w-3 h-3' : 'w-4 h-4'}`}
            />
          )}
        </div>

        {/* Message content */}
        <div className='space-y-2'>
          {/* Main message bubble */}
          <div
            className={`${isOverlay ? 'rounded-lg px-3 py-2' : 'rounded-2xl px-4 py-3'} ${
              isUser
                ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white'
                : 'bg-slate-800/60 backdrop-blur-lg border border-slate-700/50 text-slate-100'
            }`}
          >
            <div
              className={`whitespace-pre-wrap ${isOverlay ? 'text-sm' : ''}`}
            >
              {message.content}
            </div>

            {/* POS Context indicator */}
            {!isUser && message.posContext && (
              <div className='flex items-center space-x-2 mt-2 pt-2 border-t border-slate-600/30'>
                <Sparkles className='w-3 h-3 text-blue-400' />
                <span className='text-xs text-blue-400'>
                  {message.posContext.system} • {message.posContext.screen}
                </span>
              </div>
            )}

            {/* Timestamp */}
            <div
              className={`mt-2 ${isOverlay ? 'text-xs' : 'text-xs'} ${
                isUser ? 'text-green-100' : 'text-slate-400'
              }`}
            >
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>

          {/* Suggestions */}
          {!isUser && message.suggestions && message.suggestions.length > 0 && (
            <div className='space-y-2'>
              <div
                className={`${isOverlay ? 'text-xs' : 'text-sm'} text-slate-400 font-medium`}
              >
                Quick actions:
              </div>
              <div className='flex flex-wrap gap-2'>
                {message.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => onSuggestionClick?.(suggestion)}
                    className={`${
                      isOverlay ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1'
                    } bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 border border-slate-600/50 rounded-lg transition-colors`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}
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
    </div>
  );
}
