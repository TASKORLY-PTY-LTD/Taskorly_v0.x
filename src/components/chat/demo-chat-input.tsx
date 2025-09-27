'use client';

import { useState, useRef, KeyboardEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DemoChatInputProps {
  onSendMessage: (message: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
}

export function DemoChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Ask me anything about your company information...',
}: DemoChatInputProps) {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = async () => {
    if (!message.trim() || isLoading || disabled) return;

    const messageToSend = message.trim();
    setMessage('');
    setIsLoading(true);

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      await onSendMessage(messageToSend);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInputChange = (value: string) => {
    setMessage(value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  };

  return (
    <div className='p-4 bg-white border-t'>
      <div className='max-w-4xl mx-auto'>
        <div className='flex items-end gap-3'>
          <div className='flex-1'>
            <Textarea
              ref={textareaRef}
              value={message}
              onChange={e => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder}
              disabled={disabled || isLoading}
              className={cn(
                'resize-none min-h-[44px] max-h-32',
                'focus:ring-2 focus:ring-blue-500 focus:border-transparent',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
              rows={1}
            />
          </div>
          <Button
            onClick={handleSubmit}
            disabled={!message.trim() || disabled || isLoading}
            size='default'
            className='h-11 px-4 bg-blue-500 hover:bg-blue-600 text-white'
          >
            {isLoading ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Send className='w-4 h-4' />
            )}
          </Button>
        </div>

        {/* Helper text */}
        <div className='mt-2 text-xs text-gray-500 text-center'>
          Press Enter to send, Shift+Enter for new line
        </div>
      </div>
    </div>
  );
}
