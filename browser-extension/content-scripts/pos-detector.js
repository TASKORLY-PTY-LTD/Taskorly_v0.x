// POS System Detection and Context Extraction
class POSDetector {
  constructor() {
    this.posSystem = null;
    this.currentContext = {};
    this.detectPOSSystem();
  }

  detectPOSSystem() {
    const hostname = window.location.hostname;
    const url = window.location.href;
    
    // Square POS Detection
    if (hostname.includes('squareup.com') || hostname.includes('square.com')) {
      this.posSystem = {
        type: 'square',
        name: 'Square',
        version: this.detectSquareVersion(),
        color: '#3E4348'
      };
    }
    // Toast POS Detection  
    else if (hostname.includes('toasttab.com')) {
      this.posSystem = {
        type: 'toast',
        name: 'Toast POS',
        version: this.detectToastVersion(),
        color: '#FF6B35'
      };
    }
    // Shopify POS Detection
    else if (hostname.includes('shopify.com') && url.includes('/admin')) {
      this.posSystem = {
        type: 'shopify',
        name: 'Shopify POS',
        version: this.detectShopifyVersion(),
        color: '#96BF48'
      };
    }
    // Generic/Unknown POS
    else if (this.detectGenericPOS()) {
      this.posSystem = {
        type: 'generic',
        name: 'POS System',
        version: 'Unknown',
        color: '#6B7280'
      };
    }

    if (this.posSystem) {
      this.extractContext();
      this.notifyExtension();
    }
  }

  detectSquareVersion() {
    // Look for Square version indicators
    const versionEl = document.querySelector('[data-testid="app-version"]');
    if (versionEl) return versionEl.textContent;
    
    const scriptTags = document.getElementsByTagName('script');
    for (let script of scriptTags) {
      if (script.src && script.src.includes('square') && script.src.includes('v')) {
        const match = script.src.match(/v(\d+\.\d+)/);
        if (match) return match[1];
      }
    }
    return 'Unknown';
  }

  detectToastVersion() {
    // Toast POS version detection
    const buildInfo = document.querySelector('meta[name="build-info"]');
    if (buildInfo) return buildInfo.content;
    return 'Unknown';
  }

  detectShopifyVersion() {
    // Shopify admin version
    const shopifyGlobal = window.Shopify;
    if (shopifyGlobal && shopifyGlobal.version) {
      return shopifyGlobal.version;
    }
    return 'Unknown';
  }

  detectGenericPOS() {
    // Generic POS system detection based on common patterns
    const posKeywords = [
      'pos', 'point-of-sale', 'checkout', 'payment', 'register',
      'cashier', 'transaction', 'receipt', 'inventory', 'sale'
    ];
    
    const title = document.title.toLowerCase();
    const bodyText = document.body.textContent.toLowerCase();
    
    return posKeywords.some(keyword => 
      title.includes(keyword) || bodyText.includes(keyword)
    );
  }

  extractContext() {
    if (!this.posSystem) return;

    this.currentContext = {
      url: window.location.href,
      title: document.title,
      timestamp: new Date().toISOString(),
      posSystem: this.posSystem.type,
      currentScreen: this.identifyCurrentScreen(),
      visibleElements: this.extractVisibleElements(),
      userActions: this.getRecentActions()
    };
  }

  identifyCurrentScreen() {
    const url = window.location.pathname;
    const title = document.title.toLowerCase();
    
    // Common screen patterns
    if (url.includes('/dashboard') || title.includes('dashboard')) {
      return 'dashboard';
    } else if (url.includes('/checkout') || title.includes('checkout')) {
      return 'checkout';
    } else if (url.includes('/inventory') || title.includes('inventory')) {
      return 'inventory';
    } else if (url.includes('/reports') || title.includes('reports')) {
      return 'reports';
    } else if (url.includes('/customers') || title.includes('customers')) {
      return 'customers';
    } else if (url.includes('/settings') || title.includes('settings')) {
      return 'settings';
    } else if (url.includes('/transactions') || title.includes('transactions')) {
      return 'transactions';
    }
    
    return 'unknown';
  }

  extractVisibleElements() {
    const elements = [];
    
    // Common POS UI elements
    const selectors = [
      '[data-testid*="checkout"]',
      '[data-testid*="payment"]', 
      '[data-testid*="product"]',
      '[data-testid*="inventory"]',
      '.checkout-button',
      '.payment-button',
      '.refund-button',
      '.add-item-button',
      '.pos-button',
      '[class*="pos-"]',
      '[id*="pos-"]'
    ];

    selectors.forEach(selector => {
      const els = document.querySelectorAll(selector);
      els.forEach(el => {
        if (this.isElementVisible(el)) {
          elements.push({
            type: this.getElementType(el),
            text: el.textContent?.trim() || '',
            selector: selector,
            position: this.getElementPosition(el)
          });
        }
      });
    });

    return elements.slice(0, 10); // Limit to 10 elements
  }

  isElementVisible(element) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && 
           rect.top >= 0 && rect.left >= 0 &&
           rect.top < window.innerHeight && rect.left < window.innerWidth;
  }

  getElementType(element) {
    const tagName = element.tagName.toLowerCase();
    const className = element.className || '';
    const testId = element.getAttribute('data-testid') || '';
    
    if (tagName === 'button' || className.includes('button')) return 'button';
    if (tagName === 'input') return 'input';
    if (tagName === 'select') return 'select';
    if (testId.includes('checkout')) return 'checkout';
    if (testId.includes('payment')) return 'payment';
    
    return 'element';
  }

  getElementPosition(element) {
    const rect = element.getBoundingClientRect();
    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2)
    };
  }

  getRecentActions() {
    // This would track recent user interactions
    // For now, return empty array
    return [];
  }

  notifyExtension() {
    // Send context to background script
    if (window.chrome && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'POS_CONTEXT_UPDATE',
        data: {
          posSystem: this.posSystem,
          context: this.currentContext
        }
      });
    }

    // Also make it available globally for the overlay
    window.taskOrlyPOSContext = {
      posSystem: this.posSystem,
      context: this.currentContext,
      detector: this
    };
  }

  // Monitor for context changes
  startContextMonitoring() {
    // Watch for URL changes (SPA navigation)
    let lastUrl = window.location.href;
    const observer = new MutationObserver(() => {
      if (window.location.href !== lastUrl) {
        lastUrl = window.location.href;
        setTimeout(() => {
          this.extractContext();
          this.notifyExtension();
        }, 500);
      }
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Watch for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        this.extractContext();
        this.notifyExtension();
      }
    });
  }
}

// Initialize POS detection
const posDetector = new POSDetector();
posDetector.startContextMonitoring();

console.log('Taskorly POS Detector initialized:', posDetector.posSystem);