import React from 'react';
import { Square, Shield, Sparkles, Monitor, MessageSquare, Zap, FileText, ArrowRight } from 'lucide-react';
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

export const SAMPLE_QUESTIONS = [
  'How do I process a refund?',
  'Help me add a new product',
  'Troubleshoot payment terminal',
  'Show me sales reports',
];

export const FEATURES = [
  {
    icon: <MessageSquare className='w-4 h-4' />,
    title: 'Smart Help',
    description: 'Get instant answers about your POS system',
  },
  {
    icon: <Zap className='w-4 h-4' />,
    title: 'Quick Actions',
    description: 'Process refunds, add products, and more',
  },
  {
    icon: <FileText className='w-4 h-4' />,
    title: 'Documentation',
    description: 'Access guides and troubleshooting tips',
  },
];

export const QUICK_ACTIONS = [
  {
    id: 'refund',
    text: 'Process Refund',
    action: 'How do I process a refund?',
    icon: <Zap className='w-4 h-4' />,
  },
  {
    id: 'add-product',
    text: 'Add Product',
    action: 'How do I add a new product?',
    icon: <Sparkles className='w-4 h-4' />,
  },
  {
    id: 'troubleshoot',
    text: 'Troubleshoot',
    action: 'My payment terminal is not working',
    icon: <Shield className='w-4 h-4' />,
  },
];
