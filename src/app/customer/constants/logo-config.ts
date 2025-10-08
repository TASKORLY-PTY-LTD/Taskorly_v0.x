// Logo configuration for customer components
// This centralizes all logo paths and makes it easy to change logos across the app

// Centralized logo paths - easy to change in one place
// This approach avoids hardcoded paths while being compatible with Next.js
//
// 🎯 HOW TO CHANGE LOGOS (Super Easy!):
// 1. Replace logo files in /public/newLogoReverse/ directory
// 2. Update LOGO_NAME below if you want different filenames
// 3. Update LOGO_BASE_PATH if you want different directory
// 4. Done! All components automatically use new logos
const LOGO_BASE_PATH = '/newLogoReverse';
const LOGO_NAME = 'Brandmark_Reverse';

export const LOGO_CONFIG = {
  // Main logo (centralized path)
  main: `${LOGO_BASE_PATH}/${LOGO_NAME}.png`,

  // Favicon and app icons
  favicon: {
    '16x16': `${LOGO_BASE_PATH}/${LOGO_NAME}-16x16.png`,
    '32x32': `${LOGO_BASE_PATH}/${LOGO_NAME}-32x32.png`,
  },

  // Alt text for accessibility
  altText: {
    main: 'Taskorly Logo',
    assistant: 'AI Assistant',
    favicon: 'Taskorly',
  },

  // Dimensions for different use cases
  dimensions: {
    small: { width: 24, height: 24 },
    medium: { width: 40, height: 40 },
    large: { width: 52, height: 52 },
    chatAvatar: { width: 40, height: 40 },
  },
} as const;

// Helper function to get logo with dimensions
export function getLogoConfig(
  size: keyof typeof LOGO_CONFIG.dimensions = 'medium'
) {
  return {
    src: LOGO_CONFIG.main,
    alt: LOGO_CONFIG.altText.main,
    ...LOGO_CONFIG.dimensions[size],
  };
}

// Helper function to get favicon config
export function getFaviconConfig() {
  return {
    '16x16': LOGO_CONFIG.favicon['16x16'],
    '32x32': LOGO_CONFIG.favicon['32x32'],
    shortcut: LOGO_CONFIG.favicon['32x32'],
    apple: LOGO_CONFIG.favicon['32x32'],
  };
}
