// Browser Extension Overlay Injector
// Injects the Taskorly chat overlay into POS systems

class TaskorlyOverlayInjector {
  constructor() {
    this.isInjected = false;
    this.overlay = null;
    this.isVisible = false;
    this.posContext = null;
    
    // Listen for POS context updates
    this.setupContextListener();
    
    // Initialize overlay after page load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.injectOverlay());
    } else {
      this.injectOverlay();
    }
  }

  setupContextListener() {
    // Listen for context updates from POS detector
    window.addEventListener('message', (event) => {
      if (event.data.type === 'TASKORLY_POS_UPDATE') {
        this.posContext = event.data.context;
        this.updateOverlayContext();
      }
    });

    // Check for existing context
    if (window.taskOrlyPOSContext) {
      this.posContext = window.taskOrlyPOSContext;
    }
  }

  injectOverlay() {
    if (this.isInjected) return;

    // Create overlay container
    this.overlay = document.createElement('div');
    this.overlay.id = 'taskorly-overlay';
    this.overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    `;

    // Create chat widget
    this.createChatWidget();
    
    // Inject CSS
    this.injectStyles();
    
    // Add to page
    document.body.appendChild(this.overlay);
    this.isInjected = true;

    console.log('Taskorly overlay injected successfully');
  }

  createChatWidget() {
    const chatWidget = document.createElement('div');
    chatWidget.id = 'taskorly-chat-widget';
    chatWidget.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      width: 60px;
      height: 60px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      border-radius: 50%;
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 32px rgba(59, 130, 246, 0.3);
      transition: all 0.3s ease;
      border: 3px solid rgba(255, 255, 255, 0.2);
    `;

    // Bot icon
    chatWidget.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 8V4H8"/>
        <rect width="16" height="12" x="4" y="8" rx="2"/>
        <path d="M2 14h2"/>
        <path d="M20 14h2"/>
        <path d="M15 13v2"/>
        <path d="M9 13v2"/>
      </svg>
    `;

    // Hover effects
    chatWidget.addEventListener('mouseenter', () => {
      chatWidget.style.transform = 'scale(1.1)';
      chatWidget.style.boxShadow = '0 12px 40px rgba(59, 130, 246, 0.4)';
    });

    chatWidget.addEventListener('mouseleave', () => {
      chatWidget.style.transform = 'scale(1)';
      chatWidget.style.boxShadow = '0 8px 32px rgba(59, 130, 246, 0.3)';
    });

    // Click handler
    chatWidget.addEventListener('click', () => {
      this.toggleChatInterface();
    });

    this.overlay.appendChild(chatWidget);
    this.chatWidget = chatWidget;
  }

  toggleChatInterface() {
    if (this.isVisible) {
      this.hideChatInterface();
    } else {
      this.showChatInterface();
    }
  }

  showChatInterface() {
    if (this.chatInterface) {
      this.chatInterface.style.display = 'block';
      this.isVisible = true;
      return;
    }

    // Create full chat interface
    this.chatInterface = document.createElement('div');
    this.chatInterface.id = 'taskorly-chat-interface';
    this.chatInterface.style.cssText = `
      position: fixed;
      bottom: 100px;
      right: 20px;
      width: 400px;
      height: 600px;
      background: rgba(15, 23, 42, 0.95);
      backdrop-filter: blur(16px);
      border-radius: 16px;
      border: 1px solid rgba(100, 116, 139, 0.3);
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
      pointer-events: auto;
      z-index: 2147483646;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `;

    // Create interface content
    this.createChatHeader();
    this.createChatMessages();
    this.createChatInput();

    this.overlay.appendChild(this.chatInterface);
    this.isVisible = true;

    // Initialize with welcome message
    this.addMessage('assistant', this.getWelcomeMessage());
  }

  hideChatInterface() {
    if (this.chatInterface) {
      this.chatInterface.style.display = 'none';
      this.isVisible = false;
    }
  }

  createChatHeader() {
    const header = document.createElement('div');
    header.style.cssText = `
      padding: 16px 20px;
      border-bottom: 1px solid rgba(100, 116, 139, 0.3);
      display: flex;
      align-items: center;
      justify-content: between;
    `;

    const posStatus = this.posContext ? this.posContext.posSystem : 'unknown';
    const systemName = this.getSystemDisplayName(posStatus);

    header.innerHTML = `
      <div style="display: flex; align-items: center; flex: 1;">
        <div style="width: 32px; height: 32px; background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-right: 12px;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M12 8V4H8"/>
            <rect width="16" height="12" x="4" y="8" rx="2"/>
          </svg>
        </div>
        <div>
          <div style="color: white; font-weight: 600; font-size: 14px;">Taskorly</div>
          <div style="color: #10b981; font-size: 12px; display: flex; align-items: center;">
            <div style="width: 6px; height: 6px; background: #10b981; border-radius: 50%; margin-right: 6px;"></div>
            ${systemName} Connected
          </div>
        </div>
      </div>
      <button id="taskorly-close" style="background: none; border: none; color: #94a3b8; cursor: pointer; padding: 4px;">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="m18 6-12 12"/>
          <path d="m6 6 12 12"/>
        </svg>
      </button>
    `;

    // Close button handler
    header.querySelector('#taskorly-close').addEventListener('click', () => {
      this.hideChatInterface();
    });

    this.chatInterface.appendChild(header);
  }

  createChatMessages() {
    this.messagesContainer = document.createElement('div');
    this.messagesContainer.id = 'taskorly-messages';
    this.messagesContainer.style.cssText = `
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 16px;
    `;

    this.chatInterface.appendChild(this.messagesContainer);
  }

  createChatInput() {
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      padding: 16px;
      border-top: 1px solid rgba(100, 116, 139, 0.3);
    `;

    inputContainer.innerHTML = `
      <div style="display: flex; gap: 8px; margin-bottom: 12px;">
        <input 
          id="taskorly-input" 
          type="text" 
          placeholder="Ask about ${this.getSystemDisplayName()}..."
          style="
            flex: 1;
            background: rgba(30, 41, 59, 0.8);
            border: 1px solid rgba(100, 116, 139, 0.5);
            border-radius: 8px;
            padding: 10px 12px;
            color: white;
            font-size: 14px;
            outline: none;
          "
        />
        <button 
          id="taskorly-send"
          style="
            background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
            border: none;
            border-radius: 8px;
            padding: 10px 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="m22 2-7 20-4-9-9-4Z"/>
            <path d="M22 2 11 13"/>
          </svg>
        </button>
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        <button class="taskorly-suggestion" data-text="How do I process a refund?">Refund</button>
        <button class="taskorly-suggestion" data-text="Payment not working">Payment issue</button>
        <button class="taskorly-suggestion" data-text="Add new product">Add product</button>
      </div>
    `;

    // Input handlers
    const input = inputContainer.querySelector('#taskorly-input');
    const sendButton = inputContainer.querySelector('#taskorly-send');
    
    const sendMessage = () => {
      const text = input.value.trim();
      if (text) {
        this.handleUserMessage(text);
        input.value = '';
      }
    };

    sendButton.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') sendMessage();
    });

    // Suggestion handlers
    inputContainer.querySelectorAll('.taskorly-suggestion').forEach(btn => {
      btn.addEventListener('click', () => {
        this.handleUserMessage(btn.dataset.text);
      });
    });

    this.chatInterface.appendChild(inputContainer);
  }

  addMessage(role, content) {
    const message = document.createElement('div');
    message.style.cssText = `
      display: flex;
      ${role === 'user' ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}
    `;

    const isUser = role === 'user';
    const avatar = isUser ? 
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
        <circle cx="12" cy="7" r="4"/>
      </svg>` :
      `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
        <path d="M12 8V4H8"/>
        <rect width="16" height="12" x="4" y="8" rx="2"/>
      </svg>`;

    message.innerHTML = `
      <div style="
        display: flex; 
        align-items: flex-start; 
        gap: 8px; 
        max-width: 280px;
        ${isUser ? 'flex-direction: row-reverse;' : ''}
      ">
        <div style="
          width: 24px; 
          height: 24px; 
          border-radius: 50%; 
          background: linear-gradient(135deg, ${isUser ? '#10b981, #059669' : '#3b82f6, #8b5cf6'}); 
          display: flex; 
          align-items: center; 
          justify-content: center;
          flex-shrink: 0;
        ">
          ${avatar}
        </div>
        <div style="
          padding: 10px 14px;
          border-radius: 12px;
          font-size: 14px;
          line-height: 1.4;
          ${isUser ? 
            'background: linear-gradient(135deg, #10b981, #059669); color: white;' :
            'background: rgba(30, 41, 59, 0.8); color: #e2e8f0; border: 1px solid rgba(100, 116, 139, 0.3);'
          }
        ">
          ${content}
        </div>
      </div>
    `;

    this.messagesContainer.appendChild(message);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  handleUserMessage(content) {
    this.addMessage('user', content);
    
    // Show typing indicator
    this.showTypingIndicator();
    
    // Simulate response delay
    setTimeout(() => {
      this.hideTypingIndicator();
      this.addMessage('assistant', this.generateResponse(content));
    }, 1000 + Math.random() * 1000);
  }

  showTypingIndicator() {
    this.typingIndicator = document.createElement('div');
    this.typingIndicator.style.cssText = `
      display: flex;
      justify-content: flex-start;
    `;
    
    this.typingIndicator.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <div style="
          width: 24px; 
          height: 24px; 
          border-radius: 50%; 
          background: linear-gradient(135deg, #3b82f6, #8b5cf6); 
          display: flex; 
          align-items: center; 
          justify-content: center;
        ">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
            <path d="M12 8V4H8"/>
            <rect width="16" height="12" x="4" y="8" rx="2"/>
          </svg>
        </div>
        <div style="
          padding: 10px 14px;
          border-radius: 12px;
          background: rgba(30, 41, 59, 0.8);
          border: 1px solid rgba(100, 116, 139, 0.3);
          display: flex;
          align-items: center;
          gap: 4px;
        ">
          <div class="typing-dot" style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; animation: typing 1.5s infinite;"></div>
          <div class="typing-dot" style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; animation: typing 1.5s infinite 0.2s;"></div>
          <div class="typing-dot" style="width: 6px; height: 6px; background: #3b82f6; border-radius: 50%; animation: typing 1.5s infinite 0.4s;"></div>
        </div>
      </div>
    `;
    
    this.messagesContainer.appendChild(this.typingIndicator);
    this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
  }

  hideTypingIndicator() {
    if (this.typingIndicator) {
      this.typingIndicator.remove();
      this.typingIndicator = null;
    }
  }

  generateResponse(userInput) {
    const input = userInput.toLowerCase();
    
    if (input.includes('refund')) {
      return 'To process a refund: Go to Transactions → Find the sale → Click Refund → Choose amount → Process. Need help finding a specific transaction?';
    } else if (input.includes('payment') || input.includes('terminal')) {
      return 'Payment issues? Try: 1) Check cables 2) Restart terminal 3) Test connection. What error are you seeing?';
    } else if (input.includes('product') || input.includes('add')) {
      return 'Adding products: Items & Orders → Items → Create Item → Fill details → Save. What type of product are you adding?';
    } else if (input.includes('inventory')) {
      return 'For inventory management: Items & Orders → Items → View your products. You can edit stock levels, set low stock alerts, and track variants here.';
    } else if (input.includes('report') || input.includes('sales')) {
      return 'To view sales reports: Reports → Choose date range → Select report type. I can help you understand any specific metrics you\'re seeing.';
    }
    
    const systemName = this.getSystemDisplayName();
    return `I can help with that! Based on your ${systemName} setup, what specifically would you like assistance with?`;
  }

  getWelcomeMessage() {
    const systemName = this.getSystemDisplayName();
    const currentScreen = this.posContext?.context?.currentScreen || 'dashboard';
    
    return `Hi! I can see you're using ${systemName} on the ${currentScreen} screen. How can I help you today?`;
  }

  getSystemDisplayName(system = null) {
    const posType = system || (this.posContext?.posSystem?.type) || 'POS';
    
    const displayNames = {
      'square': 'Square',
      'toast': 'Toast POS', 
      'shopify': 'Shopify POS',
      'generic': 'POS System'
    };
    
    return displayNames[posType] || 'POS System';
  }

  updateOverlayContext() {
    // Update overlay based on new POS context
    if (this.chatInterface && this.isVisible) {
      // Could update header, suggestions, etc.
      console.log('Updated POS context:', this.posContext);
    }
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      @keyframes typing {
        0%, 60%, 100% { transform: translateY(0); }
        30% { transform: translateY(-10px); }
      }
      
      .taskorly-suggestion {
        background: rgba(51, 65, 85, 0.8);
        border: 1px solid rgba(100, 116, 139, 0.5);
        color: #cbd5e1;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 12px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .taskorly-suggestion:hover {
        background: rgba(71, 85, 105, 0.8);
        border-color: rgba(100, 116, 139, 0.7);
      }
      
      #taskorly-input:focus {
        border-color: rgba(59, 130, 246, 0.5);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
      }
      
      #taskorly-messages::-webkit-scrollbar {
        width: 6px;
      }
      
      #taskorly-messages::-webkit-scrollbar-track {
        background: rgba(30, 41, 59, 0.3);
        border-radius: 3px;
      }
      
      #taskorly-messages::-webkit-scrollbar-thumb {
        background: rgba(100, 116, 139, 0.5);
        border-radius: 3px;
      }
      
      #taskorly-messages::-webkit-scrollbar-thumb:hover {
        background: rgba(100, 116, 139, 0.7);
      }
    `;
    
    document.head.appendChild(style);
  }
}

// Initialize overlay injector
const overlayInjector = new TaskorlyOverlayInjector();

console.log('Taskorly overlay injector initialized');