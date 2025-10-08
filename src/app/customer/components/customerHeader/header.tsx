'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings, Loader2 } from 'lucide-react';
import { HeaderProps } from '../../types/customer.types';
import { LOGO_CONFIG } from '../../constants/logo-config';

export function Header({ isLoading, onSettingsClick }: HeaderProps) {
  return (
    <header className='flex items-center justify-between p-6'>
      <div className='flex items-center space-x-4'>
        <div className='w-10 h-10 rounded-xl flex items-center justify-center'>
          <Image
            src={LOGO_CONFIG.main}
            alt={LOGO_CONFIG.altText.assistant}
            width={LOGO_CONFIG.dimensions.medium.width}
            height={LOGO_CONFIG.dimensions.medium.height}
            className='rounded-lg'
          />
        </div>
        <div>
          <h1 className='text-xl font-bold bg-gradient-to-r from-blue-400 to-teal-400 bg-clip-text text-transparent'>
            AI POS Assistant
          </h1>
          <p className='text-sm text-slate-400'>Smart help for your business</p>
        </div>
      </div>

      <div className='flex items-center space-x-3'>
        {isLoading && (
          <Badge variant='outline' className='border-blue-400 text-blue-400'>
            <Loader2 className='w-3 h-3 mr-1 animate-spin' />
            Thinking...
          </Badge>
        )}

        <Button
          variant='outline'
          size='sm'
          onClick={onSettingsClick}
          className='border-teal-400 bg-blue-800/50 hover:border-teal-300 hover:bg-blue-700/70 text-teal-100 hover:text-white'
        >
          <Settings className='w-4 h-4' />
        </Button>
      </div>
    </header>
  );
}
