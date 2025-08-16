'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useDevApi } from '@/hooks/use-dev-api';
import { Send, Loader2 } from 'lucide-react';

export function ChatInput() {
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { sendMessage } = useDevApi();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!message.trim() || isLoading) return;

    const messageToSend = message.trim();
    setMessage('');
    setIsLoading(true);

    try {
      await sendMessage(messageToSend);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className='border-t p-4'>
      <form onSubmit={handleSubmit} className='flex space-x-2'>
        <Textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder='Ask me anything about your documents...'
          className='min-h-[60px] max-h-[120px] resize-none'
          disabled={isLoading}
        />
        <Button
          type='submit'
          size='icon'
          disabled={!message.trim() || isLoading}
          className='h-[60px] w-[60px]'
        >
          {isLoading ? (
            <Loader2 className='h-4 w-4 animate-spin' />
          ) : (
            <Send className='h-4 w-4' />
          )}
        </Button>
      </form>
      <p className='text-xs text-muted-foreground mt-2'>
        Press Enter to send, Shift+Enter for new line
      </p>
    </div>
  );
}
