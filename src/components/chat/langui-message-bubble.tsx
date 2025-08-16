'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Bot, User, FileText } from 'lucide-react';

interface MessageBubbleProps {
  message: {
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
  };
}

export function LangUIMessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div
      className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} mb-4`}
    >
      <div
        className={`flex max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'} gap-3`}
      >
        {/* Avatar */}
        <div className='flex-shrink-0'>
          <Avatar className='h-8 w-8'>
            <AvatarFallback
              className={`${
                isUser
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-200 text-slate-700'
              }`}
            >
              {isUser ? (
                <User className='h-4 w-4' />
              ) : (
                <Bot className='h-4 w-4' />
              )}
            </AvatarFallback>
          </Avatar>
        </div>

        {/* Message Content */}
        <div
          className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
        >
          {/* Message Bubble */}
          <div
            className={`relative px-4 py-3 rounded-2xl max-w-full ${
              isUser
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-slate-100 text-slate-900 rounded-bl-md border'
            }`}
          >
            <p className='text-sm whitespace-pre-wrap leading-relaxed'>
              {message.content}
            </p>

            {/* Bubble tail */}
            <div
              className={`absolute top-4 w-3 h-3 ${
                isUser
                  ? 'right-[-6px] bg-blue-500 rounded-bl-full'
                  : 'left-[-6px] bg-slate-100 border-l border-b rounded-br-full'
              }`}
            />
          </div>

          {/* Sources for AI messages */}
          {message.sources && message.sources.length > 0 && !isUser && (
            <div className='mt-3 space-y-2 w-full'>
              <p className='text-xs font-medium text-slate-600 px-1'>
                📎 Sources ({message.sources.length})
              </p>
              <div className='grid gap-2'>
                {message.sources.slice(0, 3).map(source => (
                  <div
                    key={source.id}
                    className='flex items-start gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer'
                  >
                    <FileText className='h-4 w-4 text-slate-500 mt-0.5 flex-shrink-0' />
                    <div className='flex-1 min-w-0'>
                      <div className='flex items-center justify-between gap-2 mb-1'>
                        <p className='text-xs font-medium text-slate-700 truncate'>
                          {source.title}
                        </p>
                        <Badge
                          variant='secondary'
                          className='text-xs px-1.5 py-0.5'
                        >
                          {(source.similarity * 100).toFixed(0)}%
                        </Badge>
                      </div>
                      <p className='text-xs text-slate-600 line-clamp-2'>
                        {source.content}
                      </p>
                    </div>
                  </div>
                ))}
                {message.sources.length > 3 && (
                  <p className='text-xs text-slate-500 px-1'>
                    +{message.sources.length - 3} more sources
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p
            className={`text-xs text-slate-500 mt-2 px-1 ${
              isUser ? 'text-right' : 'text-left'
            }`}
          >
            {message.timestamp.toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </div>
      </div>
    </div>
  );
}
