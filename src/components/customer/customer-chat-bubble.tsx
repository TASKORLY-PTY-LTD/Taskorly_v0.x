'use client';

import { Bot, User, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { memo, useMemo } from 'react';
import { marked } from 'marked';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  isStreaming?: boolean;
  suggestions?: string[];
  sources?: Array<{
    title: string;
    similarity: number;
  }>;
  tokenCount?: number;
  error?: boolean;
  posContext?: {
    system: string;
    screen: string;
    action?: string;
  };
}

interface CustomerChatBubbleProps {
  message: Message;
  isStreaming: boolean;
  variant?: 'default' | 'overlay' | 'fullscreen';
  onSuggestionClick?: (suggestion: string) => void;
  useCustomLogo?: boolean;
  logoSrc?: string;
  logoAlt?: string;
}

function cleanContent(content: string): string {
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

const CustomerChatBubble = memo(function CustomerChatBubble({
  message,
  isStreaming = false,
  variant = 'default',
  onSuggestionClick,
  useCustomLogo = false,
  logoSrc = '/Brandmark_Reverse.png',
  logoAlt = 'Assistant Logo',
}: CustomerChatBubbleProps) {
  const isUser = message.role === 'user';
  const isOverlay = variant === 'overlay';
  const isFullscreen = variant === 'fullscreen';

  // ===== AI AVATAR SIZE CONTROL SECTION =====
  // This section controls the AI avatar dimensions for all states (thinking, normal, etc.)
  const avatarSize = isOverlay
    ? 'w-6 h-6'
    : variant === 'fullscreen'
      ? 'w-10 h-10' // AI avatar container size (40px)
      : 'w-8 h-8';
  const iconSize = isOverlay
    ? 'w-3 h-3'
    : variant === 'fullscreen'
      ? 'w-6 h-6' // AI avatar icon size (24px)
      : 'w-4 h-4';
  const logoSize =
    variant === 'fullscreen'
      ? { width: 40, height: 40 } // AI avatar image size (40px)
      : { width: 32, height: 32 };

  // Debug: Log the avatar size for troubleshooting (commented out for production)
  // console.log('Avatar debug:', {
  //   variant,
  //   isStreaming,
  //   avatarSize,
  //   logoSize,
  //   isUser,
  //   useCustomLogo,
  // });

  const FormattedMessage = useMemo(() => {
    const content = cleanContent(message.content);
    const html = marked.parse(content);
    return typeof html == 'string' ? html : '';
  }, [message]);

  if (message.isStreaming) {
    return (
      <div className='flex justify-start'>
        <div
          className={`flex items-start space-x-3 ${isOverlay ? 'space-x-2' : ''}`}
        >
          <div
            className={`rounded-full flex items-center justify-center ${avatarSize} ${
              useCustomLogo
                ? ''
                : 'bg-gradient-to-br from-blue-500 to-purple-600'
            }`}
            style={{
              // ===== AI AVATAR CONTAINER FORCED SIZE (THINKING STATE) =====
              width: variant === 'fullscreen' ? '40px' : undefined,
              height: variant === 'fullscreen' ? '40px' : undefined,
              minWidth: variant === 'fullscreen' ? '40px' : undefined,
              minHeight: variant === 'fullscreen' ? '40px' : undefined,
              maxWidth: variant === 'fullscreen' ? '40px' : undefined,
              maxHeight: variant === 'fullscreen' ? '40px' : undefined,
            }}
          >
            {useCustomLogo ? (
              <Image
                src={logoSrc}
                alt={logoAlt}
                width={logoSize.width}
                height={logoSize.height}
                className='rounded-full'
                style={{
                  // ===== AI AVATAR IMAGE FORCED SIZE (THINKING STATE) =====
                  width: variant === 'fullscreen' ? '40px' : undefined,
                  height: variant === 'fullscreen' ? '40px' : undefined,
                  minWidth: variant === 'fullscreen' ? '40px' : undefined,
                  minHeight: variant === 'fullscreen' ? '40px' : undefined,
                  maxWidth: variant === 'fullscreen' ? '40px' : undefined,
                  maxHeight: variant === 'fullscreen' ? '40px' : undefined,
                }}
              />
            ) : (
              <Bot className={`text-white ${iconSize}`} />
            )}
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
          className={`rounded-full flex items-center justify-center ${avatarSize} ${
            isUser
              ? 'bg-gradient-to-br from-green-500 to-emerald-600'
              : useCustomLogo
                ? ''
                : 'bg-gradient-to-br from-blue-500 to-purple-600'
          }`}
          style={{
            // ===== AI AVATAR CONTAINER FORCED SIZE (NORMAL MESSAGE STATE) =====
            width: variant === 'fullscreen' && !isUser ? '40px' : undefined,
            height: variant === 'fullscreen' && !isUser ? '40px' : undefined,
            minWidth: variant === 'fullscreen' && !isUser ? '40px' : undefined,
            minHeight: variant === 'fullscreen' && !isUser ? '40px' : undefined,
            maxWidth: variant === 'fullscreen' && !isUser ? '40px' : undefined,
            maxHeight: variant === 'fullscreen' && !isUser ? '40px' : undefined,
          }}
        >
          {isUser ? (
            <User className={`text-white ${iconSize}`} />
          ) : useCustomLogo ? (
            <Image
              src={logoSrc}
              alt={logoAlt}
              width={logoSize.width}
              height={logoSize.height}
              className='rounded-full'
              style={{
                // ===== AI AVATAR IMAGE FORCED SIZE (NORMAL MESSAGE STATE) =====
                width: variant === 'fullscreen' ? '40px' : undefined,
                height: variant === 'fullscreen' ? '40px' : undefined,
                minWidth: variant === 'fullscreen' ? '40px' : undefined,
                minHeight: variant === 'fullscreen' ? '40px' : undefined,
                maxWidth: variant === 'fullscreen' ? '40px' : undefined,
                maxHeight: variant === 'fullscreen' ? '40px' : undefined,
              }}
            />
          ) : (
            <Bot className={`text-white ${iconSize}`} />
          )}
        </div>

        {/* Message content */}
        <div className='space-y-1'>
          {/* Main message bubble */}
          <div
            className={`${isOverlay ? 'rounded-lg px-3 py-2' : 'rounded-2xl px-4 py-3'} ${
              isUser
                ? 'bg-gradient-to-br from-green-600 to-emerald-700 text-white'
                : variant === 'fullscreen'
                  ? 'bg-white/10 text-white'
                  : 'bg-slate-800/60 backdrop-blur-lg border border-slate-700/50 text-slate-100'
            }`}
          >
            <div
              className={cn(
                'whitespace-pre-wrap leading-tight',
                'prose max-w-none leading-tight text-white',

                // Custom prose styling - reduced margins to eliminate newlines
                'prose-headings:font-semibold prose-headings:mt-0 prose-headings:mb-0 leading-tight',
                'prose-p:mt-0 prose-p:mb-0 prose-p:leading-tight',
                'prose-strong:font-semibold prose-em:italic prose-strong:text-white',
                'prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:leading-tight',
                'prose-code:text-white',
                'prose-pre:bg-gray-100 prose-pre:p-3 prose-pre:rounded-md leading-tight',
                'prose-ul:list-disc prose-ul:leading-tight prose-ul:mt-0 prose-ul:mb-0',
                'prose-ol:list-decimal prose-ol:leading-tight prose-ol:mt-0 prose-ol:mb-0',
                'prose-li:my-0 prose-li:leading-tight prose-li:mt-0 prose-li:mb-0',
                'prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline leading-tight',
                'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic leading-tight',

                // Handle user messages (white text)
                isUser && [
                  'prose-invert', // Inverts colors for dark backgrounds
                  'prose-headings:text-white prose-p:text-white prose-strong:text-white leading-tight',
                  'prose-code:bg-blue-600 prose-code:text-white leading-tight',
                  'prose-a:text-blue-200 hover:prose-a:text-white leading-tight',
                ],

                isStreaming && 'animate-pulse'
              )}
            >
              <div dangerouslySetInnerHTML={{ __html: FormattedMessage }} />
            </div>

            {/* Sources - Added for LLM integration */}
            {!isUser && message.sources && message.sources.length > 0 && (
              <div className='mt-3 pt-3 border-t border-slate-600/50'>
                <div className='text-xs text-slate-400 mb-2'>Sources:</div>
                {message.sources.map((source, index) => (
                  <div key={index} className='text-xs text-slate-300 mb-1'>
                    • {source.title} ({(source.similarity * 100).toFixed(0)}%
                    match)
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
                isUser
                  ? 'text-green-100'
                  : message.error
                    ? 'text-red-200'
                    : 'text-slate-400'
              }`}
            >
              {message.timestamp.toLocaleTimeString([], {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              })}
            </div>
          </div>

          {/* Suggestions */}
          {!isUser && message.suggestions && message.suggestions.length > 0 && (
            <div className='space-y-1'>
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
});

export default CustomerChatBubble;
