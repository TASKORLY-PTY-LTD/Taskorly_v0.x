// Taskorly Browser Extension Background Service Worker
// Handles extension lifecycle, messaging, and API communication

class TaskorlyBackgroundService {
  constructor() {
    this.posContexts = new Map(); // Store POS contexts by tab ID
    this.chatSessions = new Map(); // Store active chat sessions
    this.apiBaseUrl = 'https://api.taskorly.com'; // Will be configurable
    
    this.setupMessageListeners();
    this.setupTabListeners();
    
    console.log('Taskorly background service worker initialized');
  }

  setupMessageListeners() {
    // Listen for messages from content scripts and popup
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      console.log('Received message:', message.type, message);
      
      switch (message.type) {
        case 'POS_CONTEXT_UPDATE':
          this.handlePOSContextUpdate(message.data, sender.tab?.id);
          break;
          
        case 'SEND_CHAT_MESSAGE':
          this.handleChatMessage(message.data, sender.tab?.id)
            .then(response => sendResponse(response))
            .catch(error => sendResponse({ error: error.message }));
          return true; // Will respond asynchronously
          
        case 'GET_POS_CONTEXT':
          sendResponse(this.getPOSContext(sender.tab?.id));
          break;
          
        case 'GET_CHAT_HISTORY':
          this.getChatHistory(sender.tab?.id)
            .then(history => sendResponse(history))
            .catch(error => sendResponse({ error: error.message }));
          return true;
          
        case 'POPUP_OPENED':
          this.handlePopupOpened(sendResponse);
          return true;
          
        default:
          console.warn('Unknown message type:', message.type);
      }
    });

    // Listen for external connections (from customer chat app)
    chrome.runtime.onConnect.addListener((port) => {
      if (port.name === 'taskorly-chat') {
        this.handleChatConnection(port);
      }
    });
  }

  setupTabListeners() {
    // Clean up when tabs are closed
    chrome.tabs.onRemoved.addListener((tabId) => {
      this.posContexts.delete(tabId);
      this.chatSessions.delete(tabId);
    });

    // Update context when tabs are updated
    chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
      if (changeInfo.status === 'complete' && tab.url) {
        this.checkPOSSystem(tab);
      }
    });
  }

  handlePOSContextUpdate(data, tabId) {
    if (!tabId) return;
    
    const context = {
      ...data,
      tabId,
      lastUpdated: new Date().toISOString()
    };
    
    this.posContexts.set(tabId, context);
    
    // Notify popup if open
    this.notifyPopup('POS_CONTEXT_UPDATED', context);
    
    // Update badge based on POS system
    this.updateBadge(tabId, data.posSystem);
    
    console.log('POS context updated for tab', tabId, data.posSystem?.type);
  }

  async handleChatMessage(data, tabId) {
    const { message, conversationId } = data;
    const posContext = this.getPOSContext(tabId);
    
    try {
      // Get or create chat session
      let session = this.chatSessions.get(tabId);
      if (!session) {
        session = await this.createChatSession(tabId, posContext);
        this.chatSessions.set(tabId, session);
      }

      // Send message to API
      const response = await this.sendMessageToAPI({
        message,
        conversationId: session.conversationId,
        posContext,
        sessionId: session.sessionId
      });

      // Update local session
      session.messages.push(
        { role: 'user', content: message, timestamp: new Date() },
        { role: 'assistant', content: response.content, timestamp: new Date() }
      );

      return {
        success: true,
        response: response.content,
        suggestions: response.suggestions,
        conversationId: session.conversationId
      };

    } catch (error) {
      console.error('Chat message error:', error);
      
      // Fallback to local response
      return {
        success: false,
        response: this.generateFallbackResponse(message, posContext),
        error: 'Using offline response',
        conversationId: conversationId || 'local'
      };
    }
  }

  async createChatSession(tabId, posContext) {
    const sessionId = `session_${tabId}_${Date.now()}`;
    const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      sessionId,
      conversationId,
      tabId,
      posContext,
      messages: [],
      createdAt: new Date().toISOString()
    };

    try {
      // Notify API of new session
      await this.notifyAPINewSession(session);
    } catch (error) {
      console.warn('Failed to create API session:', error.message);
    }

    return session;
  }

  async sendMessageToAPI(payload) {
    const response = await fetch(`${this.apiBaseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Version': chrome.runtime.getManifest().version
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  }

  async notifyAPINewSession(session) {
    await fetch(`${this.apiBaseUrl}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Extension-Version': chrome.runtime.getManifest().version
      },
      body: JSON.stringify(session)
    });
  }

  generateFallbackResponse(message, posContext) {
    const input = message.toLowerCase();
    const systemType = posContext?.posSystem?.type || 'pos';
    
    // Common POS responses
    if (input.includes('refund')) {
      return 'To process a refund: Go to Transactions → Find the sale → Click Refund → Choose amount → Process. Need help finding a specific transaction?';
    } else if (input.includes('payment') || input.includes('terminal')) {
      return 'Payment issues? Try: 1) Check cables 2) Restart terminal 3) Test connection. What error are you seeing?';
    } else if (input.includes('product') || input.includes('add')) {
      return 'Adding products: Items & Orders → Items → Create Item → Fill details → Save. What type of product are you adding?';
    } else if (input.includes('inventory')) {
      return 'For inventory management: Items & Orders → Items → View your products. You can edit stock levels and track variants here.';
    } else if (input.includes('report') || input.includes('sales')) {
      return 'To view sales reports: Reports → Choose date range → Select report type. What specific metrics do you need help with?';
    } else if (input.includes('customer')) {
      return 'Managing customers: Customers → Add/edit customer info → Link to transactions. What customer task do you need help with?';
    }
    
    const systemNames = {
      'square': 'Square',
      'toast': 'Toast POS',
      'shopify': 'Shopify POS',
      'generic': 'POS System'
    };
    
    const systemName = systemNames[systemType] || 'POS system';
    return `I can help with that! Based on your ${systemName} setup, what specifically would you like assistance with?`;
  }

  getPOSContext(tabId) {
    return tabId ? this.posContexts.get(tabId) : null;
  }

  async getChatHistory(tabId) {
    const session = this.chatSessions.get(tabId);
    return session ? session.messages : [];
  }

  handlePopupOpened(sendResponse) {
    // Get active tab POS context
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      const context = activeTab ? this.getPOSContext(activeTab.id) : null;
      
      sendResponse({
        posContext: context,
        hasActiveChat: activeTab ? this.chatSessions.has(activeTab.id) : false
      });
    });
  }

  handleChatConnection(port) {
    console.log('Chat connection established');
    
    port.onMessage.addListener(async (message) => {
      switch (message.type) {
        case 'CHAT_MESSAGE':
          try {
            const response = await this.handleChatMessage(message.data);
            port.postMessage({
              type: 'CHAT_RESPONSE',
              data: response
            });
          } catch (error) {
            port.postMessage({
              type: 'CHAT_ERROR',
              error: error.message
            });
          }
          break;
          
        case 'GET_CONTEXT':
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const context = tabs[0] ? this.getPOSContext(tabs[0].id) : null;
            port.postMessage({
              type: 'CONTEXT_RESPONSE',
              data: context
            });
          });
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      console.log('Chat connection disconnected');
    });
  }

  notifyPopup(type, data) {
    // Try to send message to popup if it's open
    chrome.runtime.sendMessage({ type, data }).catch(() => {
      // Popup not open, ignore
    });
  }

  updateBadge(tabId, posSystem) {
    if (!posSystem) return;
    
    // Set badge text to show POS system type
    const badgeText = {
      'square': 'SQ',
      'toast': 'TO',
      'shopify': 'SP',
      'generic': 'POS'
    }[posSystem.type] || 'POS';
    
    chrome.action.setBadgeText({ text: badgeText, tabId });
    
    // Set badge color based on system
    const badgeColor = {
      'square': '#3E4348',
      'toast': '#FF6B35', 
      'shopify': '#96BF48',
      'generic': '#6B7280'
    }[posSystem.type] || '#6B7280';
    
    chrome.action.setBadgeBackgroundColor({ color: badgeColor, tabId });
  }

  async checkPOSSystem(tab) {
    // Check if tab URL matches known POS systems
    const url = tab.url.toLowerCase();
    const knownSystems = [
      'squareup.com',
      'toasttab.com', 
      'shopify.com'
    ];
    
    const isPOSSystem = knownSystems.some(system => url.includes(system));
    
    if (isPOSSystem && tab.id) {
      // Inject content scripts if not already injected
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-scripts/pos-detector.js', 'content-scripts/overlay-injector.js']
        });
        
        console.log('Content scripts injected into POS system tab');
      } catch (error) {
        console.warn('Failed to inject scripts:', error);
      }
    }
  }
}

// Initialize background service
const backgroundService = new TaskorlyBackgroundService();

// Handle extension installation
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Taskorly extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Show welcome page or setup
    chrome.tabs.create({
      url: 'https://chat.taskorly.com/extension-welcome'
    });
  }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('Taskorly extension started');
});

// Keep service worker alive with periodic tasks
setInterval(() => {
  // Cleanup old sessions (older than 1 hour)
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  backgroundService.chatSessions.forEach((session, tabId) => {
    if (new Date(session.createdAt).getTime() < oneHourAgo) {
      backgroundService.chatSessions.delete(tabId);
      console.log('Cleaned up old session for tab', tabId);
    }
  });
  
  // Keep alive ping
  console.log('Service worker heartbeat');
}, 30000); // Every 30 seconds