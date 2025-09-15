'use client';

import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { User, Bot, FileText, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { memo, useMemo } from 'react';
import { marked } from 'marked'

interface Source {
  title: string;
  content: string;
  similarity: number;
}

interface Messages {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: Source[];
  tokenCount?: number;
}

interface DemoMessageBubbleProps {
  message: Messages;
  isStreaming?: boolean;
}

function cleanContent(content: string): string {
  return content
    .replace(/\[object Object\]/g, '')           // Remove objects
    .replace(/&#39;/g, "'")                     // Fix entities
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/<br\s*\/?><br\s*\/?>/g, '\n\n')   // Convert <br> tags
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/\n{3,}/g, '\n\n')                 // Clean whitespace
    .trim();
}

// function preprocessContent(content: string): string {
//   return content
//     // Remove [object Object] first
//     .replace(/\[object Object\]/g, '')
    
//     // Fix HTML entities
//     .replace(/&#39;/g, "'")
//     .replace(/&quot;/g, '"')
//     .replace(/&amp;/g, '&')
//     .replace(/&lt;/g, '<')
//     .replace(/&gt;/g, '>')
    
//     // Convert <br> tags to markdown line breaks
//     .replace(/<br\s*\/?><br\s*\/?>/g, '\n\n')
//     .replace(/<br\s*\/?>/g, '\n')
    
//     // Clean up whitespace
//     .replace(/\n{3,}/g, '\n\n')
//     .trim();
// }

// Post-process function to style the HTML output
// function postprocessHTML(html: string): string {
//   return html
//     // Style paragraphs
//     .replace(/<p>/g, '<p class="mb-3">')
    
//     // Style strong tags
//     .replace(/<strong>/g, '<strong class="font-semibold">')
    
//     // Style em tags  
//     .replace(/<em>/g, '<em class="italic">')
    
//     // Style code spans
//     .replace(/<code>/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">')
    
//     // Style code blocks
//     .replace(/<pre><code>/g, '<pre class="bg-gray-100 p-3 rounded-md overflow-x-auto my-3"><code class="text-sm">')
    
//     // Style headings
//     .replace(/<h1>/g, '<h1 class="text-2xl font-bold mt-4 mb-2">')
//     .replace(/<h2>/g, '<h2 class="text-xl font-bold mt-4 mb-2">')
//     .replace(/<h3>/g, '<h3 class="text-lg font-semibold mt-4 mb-2">')
//     .replace(/<h4>/g, '<h4 class="text-base font-semibold mt-3 mb-2">')
//     .replace(/<h5>/g, '<h5 class="text-sm font-semibold mt-3 mb-2">')
//     .replace(/<h6>/g, '<h6 class="text-sm font-medium mt-3 mb-2">')
    
//     // Style lists
//     .replace(/<ul>/g, '<ul class="list-disc list-inside ml-4 mb-4 space-y-1">')
//     .replace(/<ol>/g, '<ol class="list-decimal list-inside ml-4 mb-4 space-y-1">')
//     .replace(/<li>/g, '<li class="leading-relaxed">')
    
//     // Style links
//     .replace(/<a href=/g, '<a class="text-blue-600 hover:text-blue-800 underline" target="_blank" rel="noopener noreferrer" href=')
    
//     // Style blockquotes
//     .replace(/<blockquote>/g, '<blockquote class="border-l-4 border-gray-300 pl-4 italic text-gray-600 my-3">')
    
//     // Style horizontal rules
//     .replace(/<hr>/g, '<hr class="border-gray-300 my-4">')
    
//     // Remove any remaining [object Object] that might have slipped through
//     .replace(/\[object Object\]/g, '');
// }

const MessageBubble = memo(function ChatMessages({ message, isStreaming = false }: DemoMessageBubbleProps){
  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  const FormattedMessage = useMemo(()=>{  
    const content = cleanContent(message.content);
    let html = marked.parse(content);
    // const styledHTML = postprocessHTML(html);
    return typeof html == 'string' ? html : '';
  }, [message]);

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
              'prose prose-sm max-w-none',
              
              // Custom prose styling
              'prose-headings:font-semibold prose-headings:mt-4 prose-headings:mb-2',
              'prose-p:mb-3 prose-p:leading-relaxed',
              'prose-strong:font-semibold prose-em:italic',
              'prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm ',
              'prose-code:text-black',
              'prose-pre:bg-gray-100 prose-pre:p-3 prose-pre:rounded-md',
              'prose-ul:list-disc prose-ol:list-decimal prose-li:my-1',
              'prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline',
              'prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic',
              
              // Handle user messages (white text)
              isUser && [
                'prose-invert', // Inverts colors for dark backgrounds
                'prose-headings:text-white prose-p:text-white prose-strong:text-white',
                'prose-code:bg-blue-600 prose-code:text-white',
                'prose-a:text-blue-200 hover:prose-a:text-white'
              ],
              

              isStreaming && 'animate-pulse'
            )}>
              <div dangerouslySetInnerHTML={{ __html: FormattedMessage }} />
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
});

export default MessageBubble