'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useDevApi } from '@/hooks/use-dev-api';
import { Send, Loader2, Paperclip, Mic } from 'lucide-react';

export function LangUIChatInput() {
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
    <div className='border-t bg-white p-4'>
      <form onSubmit={handleSubmit}>
        <div className='relative flex items-end gap-3'>
          {/* Input Container */}
          <div className='flex-1 relative'>
            <div className='relative'>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder='Type your message here...'
                className='w-full min-h-[44px] max-h-[120px] px-4 py-3 pr-12 bg-slate-50 border border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors placeholder:text-slate-400'
                disabled={isLoading}
                rows={1}
                style={{
                  height: 'auto',
                  minHeight: '44px',
                }}
                onInput={e => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = 'auto';
                  target.style.height = target.scrollHeight + 'px';
                }}
              />

              {/* Attachment Button */}
              <Button
                type='button'
                variant='ghost'
                size='icon'
                className='absolute right-2 bottom-2 h-7 w-7 text-slate-400 hover:text-slate-600'
                disabled={isLoading}
              >
                <Paperclip className='h-4 w-4' />
              </Button>
            </div>

            {/* Suggestions */}
            {message.length === 0 && (
              <div className='absolute bottom-full mb-2 left-0 right-0'>
                <div className='flex gap-2 overflow-x-auto pb-2'>
                  {[
                    'Summarize my documents',
                    'What are the key concepts?',
                    'Help me understand this topic',
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      type='button'
                      onClick={() => setMessage(suggestion)}
                      className='flex-shrink-0 px-3 py-1.5 text-xs bg-blue-50 text-blue-600 rounded-full border border-blue-200 hover:bg-blue-100 transition-colors'
                      disabled={isLoading}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Send Button */}
          <Button
            type='submit'
            size='icon'
            disabled={!message.trim() || isLoading}
            className='h-11 w-11 rounded-2xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 flex-shrink-0'
          >
            {isLoading ? (
              <Loader2 className='h-5 w-5 animate-spin' />
            ) : (
              <Send className='h-5 w-5' />
            )}
          </Button>
        </div>

        {/* Helper Text */}
        <div className='flex items-center justify-between mt-2 px-1'>
          <p className='text-xs text-slate-500'>
            Press{' '}
            <kbd className='px-1.5 py-0.5 text-xs bg-slate-100 rounded border'>
              Enter
            </kbd>{' '}
            to send,{' '}
            <kbd className='px-1.5 py-0.5 text-xs bg-slate-100 rounded border'>
              Shift
            </kbd>{' '}
            +{' '}
            <kbd className='px-1.5 py-0.5 text-xs bg-slate-100 rounded border'>
              Enter
            </kbd>{' '}
            for new line
          </p>
          <div className='flex items-center gap-1'>
            <Button
              type='button'
              variant='ghost'
              size='icon'
              className='h-6 w-6 text-slate-400 hover:text-slate-600'
              disabled={isLoading}
            >
              <Mic className='h-3 w-3' />
            </Button>
            <span className='text-xs text-slate-400'>
              {message.length}/2000
            </span>
          </div>
        </div>
      </form>
    </div>
  );
}
