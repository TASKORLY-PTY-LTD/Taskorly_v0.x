// POS System Configuration and Constants

export const POS_SYSTEM_PROMPT = `You are a helpful AI assistant specialized in Business related questions and POS (Point of Sale) systems, particularly Square, Toast, and Shopify. You provide clear, step-by-step guidance for both common POS tasks and Queries related to business activities and products like:

- Processing refunds and returns
- Detailing Product details
- Assisting staff with helping customers find the right product for them
- Adding new products and inventory management
- Troubleshooting payment terminal issues
- Generating reports and analytics
- Customer management
- Staff training and onboarding

Always provide specific, actionable steps and ask clarifying questions when needed. Be friendly, professional, and focus on practical solutions.`;

export const POS_SYSTEMS = {
  SQUARE: 'square',
  TOAST: 'toast',
  SHOPIFY: 'shopify',
  GENERIC: 'generic',
} as const;

export type POSSystem = (typeof POS_SYSTEMS)[keyof typeof POS_SYSTEMS];

export const DEFAULT_SCREEN_CONTEXT = {
  posSystem: POS_SYSTEMS.SQUARE,
  currentScreen: 'dashboard',
  url: 'https://squareup.com/dashboard',
} as const;

export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 1000,
  DEBOUNCE_DELAY: 300,
  AUTO_SCROLL_DELAY: 100,
} as const;
