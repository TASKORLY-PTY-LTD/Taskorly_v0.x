'use client';

import { Button } from '@/components/ui/button';
import { Paperclip, Mic, Send, Loader2, Sparkles } from 'lucide-react';
import { InputBoxProps } from '../../types/customer.types';
import { MOCK_SUGGESTIONS } from '../../constants/suggestions';

export function InputBox({
  inputValue,
  setInputValue,
  onSendMessage,
  onSuggestionClick,
  isLoading,
  hasMessages,
}: InputBoxProps) {
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      onSendMessage(inputValue);
    }
  };

  return (
    <div className='p-6'>
      <div className='max-w-4xl mx-auto'>
        {/* Ready to help message when no messages */}
        {!hasMessages && (
          <div className='flex flex-col items-center justify-center text-center py-20 mb-6'>
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
        )}

        {/* Quick suggestions when not loading and has messages */}
        {!isLoading && hasMessages && (
          <div className='mb-4'>
            <div className='flex flex-wrap gap-2'>
              {MOCK_SUGGESTIONS.map(suggestion => (
                <Button
                  key={suggestion.id}
                  variant='outline'
                  size='sm'
                  onClick={() => onSuggestionClick(suggestion)}
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
              type='text'
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder='Ask me anything about your POS system...'
              className='flex-1 bg-transparent text-white placeholder-slate-400 focus:outline-none text-sm'
              disabled={isLoading}
            />

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
              onClick={() => onSendMessage(inputValue)}
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
  );
}
