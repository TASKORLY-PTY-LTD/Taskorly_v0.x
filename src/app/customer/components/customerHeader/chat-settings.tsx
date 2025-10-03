'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Monitor, X, Zap } from 'lucide-react';
import { ChatSettingsProps } from '../../types/customer.types';
import { QUICK_ACTIONS } from '../../constants/suggestions';

export function ChatSettings({
  isVisible,
  onClose,
  messageCount,
  conversationId,
  onNewConversation,
  onQuickAction,
}: ChatSettingsProps) {
  if (!isVisible) return null;

  return (
    <div className='fixed top-20 right-6 w-80 z-50'>
      <Card className='border-0 bg-white/10 backdrop-blur-sm'>
        <div className='p-4'>
          <div className='flex items-center justify-between mb-4'>
            <div className='flex items-center space-x-2'>
              <Monitor className='w-5 h-5 text-blue-400' />
              <h3 className='font-semibold text-white'>Screen Context</h3>
            </div>
            <Button
              variant='ghost'
              size='sm'
              onClick={onClose}
              className='text-slate-400 hover:text-white p-1'
            >
              <X className='w-4 h-4' />
            </Button>
          </div>

          {/* Conversation Management */}
          <div className='mt-4 pt-4 border-t border-slate-700/50'>
            <h4 className='text-sm font-medium text-white mb-2'>
              Conversation
            </h4>
            <div className='space-y-2 text-xs text-slate-400 mb-3'>
              <div>Messages: {messageCount}</div>
              {conversationId && <div>ID: {conversationId.slice(0, 8)}...</div>}
            </div>
            <Button
              variant='outline'
              size='sm'
              onClick={onNewConversation}
              className='w-full justify-start border-teal-400 bg-blue-800/30 hover:border-teal-300 hover:bg-blue-700/50 text-teal-100 hover:text-white'
            >
              <Zap className='w-4 h-4 mr-2' />
              New Conversation
            </Button>
          </div>

          {/* Quick Actions */}
          <div className='mt-4 pt-4 border-t border-slate-700/50'>
            <h4 className='text-sm font-medium text-white mb-2'>
              Quick Actions
            </h4>
            <div className='space-y-2'>
              {QUICK_ACTIONS.map(action => (
                <Button
                  key={action.id}
                  variant='outline'
                  size='sm'
                  onClick={() => onQuickAction(action.action)}
                  className='w-full justify-start border-teal-400 bg-blue-800/30 hover:border-teal-300 hover:bg-blue-700/50 text-teal-100 hover:text-white'
                >
                  {action.icon}
                  <span className='ml-2'>{action.text}</span>
                </Button>
              ))}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
