import React from 'react';
import { Square, Shield, Sparkles, Monitor } from 'lucide-react';
import { Suggestion } from '../types/customer.types';

export const MOCK_SUGGESTIONS: Suggestion[] = [
  {
    id: '1',
    text: 'How do I process a refund in Square?',
    category: 'pos',
    icon: React.createElement(Square, { className: 'h-4 w-4' }),
  },
  {
    id: '2',
    text: 'Payment terminal not responding',
    category: 'troubleshoot',
    icon: React.createElement(Shield, { className: 'h-4 w-4' }),
  },
  {
    id: '3',
    text: 'How to add a new product?',
    category: 'pos',
    icon: React.createElement(Sparkles, { className: 'h-4 w-4' }),
  },
  {
    id: '4',
    text: 'Generate daily sales report',
    category: 'general',
    icon: React.createElement(Monitor, { className: 'h-4 w-4' }),
  },
];
