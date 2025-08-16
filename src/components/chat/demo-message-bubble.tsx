'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Bot, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Source {
  title: string;
  content: string;
  similarity: number;
}

interface DemoMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  tokenCount?: number;
}

interface DemoMessageBubbleProps {
  message: DemoMessage;
  isStreaming?: boolean;
}

export function DemoMessageBubble({ message, isStreaming = false }: DemoMessageBubbleProps) {
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  return (
    <div className={cn(
      'flex w-full gap-4',
      isUser ? 'justify-end' : 'justify-start'
    )}>
      {/* Avatar */}
      {isAssistant && (
        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
          <Bot className="w-4 h-4 text-white" />
        </div>
      )}

      {/* Message bubble */}
      <div className={cn(
        'max-w-[80%] space-y-3',
        isUser && 'order-first'
      )}>
        <Card className={cn(
          'p-4',
          isUser
            ? 'bg-blue-500 text-white border-blue-500'
            : 'bg-white border-gray-200'
        )}>
          <div className="space-y-3">
            {/* Message content */}
            <div className={cn(
              'whitespace-pre-wrap leading-relaxed',
              isStreaming && 'animate-pulse'
            )}>
              {message.content}
            </div>

            {/* Metadata */}
            <div className={cn(
              'flex items-center justify-between text-xs',
              isUser ? 'text-blue-100' : 'text-gray-500'
            )}>
              <span>
                {message.timestamp.toLocaleTimeString()}
              </span>
              {message.tokenCount && (
                <span className="flex items-center gap-1">
                  <span>{message.tokenCount} tokens</span>
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Sources */}
        {isAssistant && message.sources && message.sources.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <FileText className="w-4 h-4" />
              <span>Sources ({message.sources.length})</span>
            </div>
            <div className="grid gap-2">
              {message.sources.map((source, index) => (
                <Card key={index} className="p-3 bg-gray-50 border-gray-200">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm text-gray-900">
                        {source.title}
                      </h4>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(source.similarity * 100)}% match
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">
                      {source.content}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 text-blue-600 hover:text-blue-700 p-0"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View source
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center flex-shrink-0">
          <User className="w-4 h-4 text-white" />
        </div>
      )}
    </div>
  );
}