// Taskorly Browser Extension Popup Script
class TaskorlyPopup {
  constructor() {
    this.posContext = null;
    this.isOverlayEnabled = false;
    this.chatMessages = [];
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadInitialState();
    
    console.log('Taskorly popup initialized');
  }

  initializeElements() {
    // Header elements
    this.posStatus = document.getElementById('pos-status');
    this.settingsBtn = document.getElementById('settings-btn');
    
    // POS section elements
    this.posCard = document.getElementById('pos-card');
    this.posName = document.getElementById('pos-name');
    this.posDetails = document.getElementById('pos-details');
    this.posIndicator = document.getElementById('pos-indicator');
    
    // Action section elements
    this.actionsSection = document.getElementById('actions-section');
    this.actionButtons = document.querySelectorAll('.action-button');
    
    // Chat elements
    this.chatMessages = document.getElementById('chat-messages');
    this.chatInput = document.getElementById('chat-input');
    this.sendButton = document.getElementById('send-button');
    this.openFullscreenBtn = document.getElementById('open-fullscreen');
    
    // Footer elements
    this.toggleOverlayBtn = document.getElementById('toggle-overlay');
    this.helpButton = document.getElementById('help-button');
    
    // Loading overlay
    this.loadingOverlay = document.getElementById('loading');
  }

  setupEventListeners() {
    // Settings button
    this.settingsBtn.addEventListener('click', () => this.openSettings());
    
    // Action buttons
    this.actionButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        this.handleQuickAction(action);
      });
    });
    
    // Chat input
    this.chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendChatMessage();
      }
    });
    
    // Send button
    this.sendButton.addEventListener('click', () => this.sendChatMessage());
    
    // Open fullscreen chat
    this.openFullscreenBtn.addEventListener('click', () => this.openFullscreenChat());
    
    // Toggle overlay
    this.toggleOverlayBtn.addEventListener('click', () => this.toggleOverlay());
    
    // Help button
    this.helpButton.addEventListener('click', () => this.openHelp());
    
    // Listen for background script messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'POS_CONTEXT_UPDATED') {
        this.updatePOSContext(message.data);
      }
    });
  }

  async loadInitialState() {
    try {
      this.showLoading(true);
      
      // Get initial state from background script
      const response = await this.sendMessage({ type: 'POPUP_OPENED' });
      
      if (response.posContext) {
        this.updatePOSContext(response.posContext);
      }
      
      this.isOverlayEnabled = response.hasActiveChat || false;
      this.updateOverlayButton();
      
      // Load chat history if available
      if (response.hasActiveChat) {
        await this.loadChatHistory();
      }
      
    } catch (error) {
      console.error('Failed to load initial state:', error);
      this.posStatus.textContent = 'Connection failed';
    } finally {
      this.showLoading(false);
    }
  }

  async sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  }

  updatePOSContext(context) {
    this.posContext = context;
    
    if (context && context.posSystem) {
      const { posSystem } = context;
      
      // Update header status
      this.posStatus.textContent = `Connected to ${posSystem.name}`;
      
      // Update POS card
      this.posCard.className = 'pos-card connected';
      this.posName.textContent = posSystem.name;
      this.posDetails.textContent = `${context.context?.currentScreen || 'Dashboard'} • ${posSystem.version}`;
      
      // Show actions section
      this.actionsSection.style.display = 'block';
      
      // Enable chat input
      this.chatInput.disabled = false;
      this.sendButton.disabled = false;
      this.toggleOverlayBtn.disabled = false;
      
      // Update chat placeholder
      this.chatInput.placeholder = `Ask about ${posSystem.name}...`;
      
    } else {
      // No POS system detected
      this.posStatus.textContent = 'No POS system detected';
      this.posCard.className = 'pos-card disconnected';
      this.posName.textContent = 'No POS System Detected';
      this.posDetails.textContent = 'Navigate to a supported POS system';
      this.actionsSection.style.display = 'none';
      
      // Disable interactive elements
      this.chatInput.disabled = true;
      this.sendButton.disabled = true;
      this.toggleOverlayBtn.disabled = true;
      this.chatInput.placeholder = 'Connect to a POS system first...';
    }
  }

  async handleQuickAction(action) {
    const actionMessages = {
      refund: 'How do I process a refund?',
      payment: 'I\'m having payment terminal issues',
      product: 'How do I add a new product?',
      reports: 'Show me sales reports'
    };
    
    const message = actionMessages[action];
    if (message) {
      this.chatInput.value = message;
      await this.sendChatMessage();
    }
  }

  async sendChatMessage() {
    const message = this.chatInput.value.trim();
    if (!message || !this.posContext) return;
    
    // Add user message to chat
    this.addChatMessage('user', message);
    this.chatInput.value = '';
    
    // Show typing indicator
    this.showTypingIndicator();
    
    try {
      // Send message to background script
      const response = await this.sendMessage({
        type: 'SEND_CHAT_MESSAGE',
        data: {
          message,
          conversationId: this.currentConversationId
        }
      });
      
      if (response.success) {
        this.addChatMessage('assistant', response.response);
        this.currentConversationId = response.conversationId;
      } else {
        this.addChatMessage('assistant', response.response || 'Sorry, I encountered an error. Please try again.');
      }
      
    } catch (error) {
      console.error('Chat message error:', error);
      this.addChatMessage('assistant', 'Sorry, I\'m having trouble connecting. Please try again.');
    } finally {
      this.hideTypingIndicator();
    }
  }

  addChatMessage(role, content) {
    const messageEl = document.createElement('div');
    messageEl.className = `message ${role}-message`;
    
    const isUser = role === 'user';
    const avatarIcon = isUser ? 
      `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
       <circle cx="12" cy="7" r="4"/>` :
      `<path d="M12 8V4H8"/>
       <rect width="16" height="12" x="4" y="8" rx="2"/>`;
    
    messageEl.innerHTML = `
      <div class="message-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          ${avatarIcon}
        </svg>
      </div>
      <div class="message-content">${content}</div>
    `;
    
    this.chatMessages.appendChild(messageEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  showTypingIndicator() {
    if (document.querySelector('.typing-indicator')) return;
    
    const typingEl = document.createElement('div');
    typingEl.className = 'message assistant-message typing-indicator';
    typingEl.innerHTML = `
      <div class="message-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 8V4H8"/>
          <rect width="16" height="12" x="4" y="8" rx="2"/>
        </svg>
      </div>
      <div class="message-content" style="display: flex; align-items: center; gap: 4px;">
        <div class="typing-dots">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
        <span style="font-size: 12px; color: #94a3b8;">AI is thinking...</span>
      </div>
    `;
    
    this.chatMessages.appendChild(typingEl);
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  hideTypingIndicator() {
    const indicator = document.querySelector('.typing-indicator');
    if (indicator) {
      indicator.remove();
    }
  }

  async loadChatHistory() {
    try {
      const history = await this.sendMessage({ type: 'GET_CHAT_HISTORY' });
      
      if (history && history.length > 0) {
        // Clear existing messages except the welcome message
        const welcomeMessage = this.chatMessages.querySelector('.message');
        this.chatMessages.innerHTML = '';
        if (welcomeMessage) {
          this.chatMessages.appendChild(welcomeMessage);
        }
        
        // Add history messages
        history.slice(-3).forEach(msg => {
          this.addChatMessage(msg.role, msg.content);
        });
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  }

  async toggleOverlay() {
    try {
      // Get current active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab) return;
      
      // Inject or toggle overlay script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          if (window.taskOrlyOverlayInjector) {
            window.taskOrlyOverlayInjector.toggleChatInterface();
          }
        }
      });
      
      this.isOverlayEnabled = !this.isOverlayEnabled;
      this.updateOverlayButton();
      
    } catch (error) {
      console.error('Failed to toggle overlay:', error);
    }
  }

  updateOverlayButton() {
    if (this.isOverlayEnabled) {
      this.toggleOverlayBtn.textContent = 'Hide Overlay';
      this.toggleOverlayBtn.classList.add('active');
    } else {
      this.toggleOverlayBtn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Enable Overlay
      `;
      this.toggleOverlayBtn.classList.remove('active');
    }
  }

  openFullscreenChat() {
    chrome.tabs.create({
      url: 'https://chat.taskorly.com/'
    });
  }

  openSettings() {
    chrome.tabs.create({
      url: 'https://chat.taskorly.com/extension-settings'
    });
  }

  openHelp() {
    chrome.tabs.create({
      url: 'https://chat.taskorly.com/help'
    });
  }

  showLoading(show) {
    this.loadingOverlay.style.display = show ? 'flex' : 'none';
  }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new TaskorlyPopup();
});

// Add typing dots animation
const style = document.createElement('style');
style.textContent = `
  .typing-dots {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  
  .typing-dot {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #3b82f6;
    animation: typingDot 1.4s infinite both;
  }
  
  .typing-dot:nth-child(2) {
    animation-delay: 0.2s;
  }
  
  .typing-dot:nth-child(3) {
    animation-delay: 0.4s;
  }
  
  @keyframes typingDot {
    0%, 80%, 100% {
      transform: scale(0.8);
      opacity: 0.5;
    }
    40% {
      transform: scale(1);
      opacity: 1;
    }
  }
`;
document.head.appendChild(style);