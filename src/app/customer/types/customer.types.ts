import React from 'react';

export type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  screenContext?: ScreenContext;
};

export type ScreenContext = {
  url?: string;
  posSystem?: 'square' | 'toast' | 'shopify' | 'generic';
  currentScreen?: string;
  visibleElements?: string[];
};

export type Suggestion = {
  id: string;
  text: string;
  category: 'pos' | 'general' | 'troubleshoot';
  icon: React.ReactNode;
};
