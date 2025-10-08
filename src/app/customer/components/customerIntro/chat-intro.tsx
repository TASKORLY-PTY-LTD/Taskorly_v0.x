'use client';

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { ChatIntroProps } from '../../types/customer.types';
import { FEATURES, SAMPLE_QUESTIONS } from '../../constants/suggestions';
import { LOGO_CONFIG } from '../../constants/logo-config';

export function ChatIntro({ isVisible, onSuggestionClick }: ChatIntroProps) {
  if (!isVisible) return null;

  return (
    <div className='px-6 pb-6'>
      <div className='bg-white/10 rounded-2xl p-8 backdrop-blur-sm'>
        <div className='text-center mb-6'>
          <div className='w-16 h-16 flex items-center justify-center mx-auto mb-4'>
            <Image
              src={LOGO_CONFIG.main}
              alt={LOGO_CONFIG.altText.assistant}
              width={LOGO_CONFIG.dimensions.large.width}
              height={LOGO_CONFIG.dimensions.large.height}
              className='rounded-lg'
            />
          </div>
          <h2 className='text-2xl font-bold mb-2'>
            Welcome to your AI POS Assistant
          </h2>
          <p className='text-slate-300'>
            Get instant help with your POS system, from processing refunds to
            adding products
          </p>
        </div>

        {/* Info Cards */}
        <div className='grid md:grid-cols-3 gap-4 mb-6'>
          {FEATURES.map((feature, index) => (
            <div key={index} className='bg-white/5 rounded-xl p-4 text-center'>
              <div className='w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center mx-auto mb-3'>
                <div className='text-teal-300'>{feature.icon}</div>
              </div>
              <h3 className='font-semibold text-white mb-1 text-sm'>
                {feature.title}
              </h3>
              <p className='text-xs text-slate-400'>{feature.description}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions - Sample Questions */}
        <div className='text-center'>
          <p className='text-slate-300 mb-4 text-sm'>Try asking:</p>
          <div className='flex flex-wrap gap-2 justify-center'>
            {SAMPLE_QUESTIONS.map((question, index) => (
              <Button
                key={index}
                variant='outline'
                size='sm'
                onClick={() => onSuggestionClick(question)}
                className='text-xs border-teal-400 bg-blue-800/30 hover:border-teal-300 hover:bg-blue-700/50 text-teal-100 hover:text-white'
              >
                {question}
                <ArrowRight className='w-3 h-3 ml-2' />
              </Button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
