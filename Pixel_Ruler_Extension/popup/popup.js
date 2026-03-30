/**
 * Pixel Ruler + Alignment Checker - Popup Functionality
 */

class PopupController {
  constructor() {
    this.currentTab = null;
    this.premiumActive = false;
    this.currentState = {
      active: false,
      showRulers: true,
      showGuides: true,
      showGrid: false,
      measureMode: false
    };
    this.PAYMENT_URL = 'https://rulerguide.netlify.app/pay.html';
    this.INSTALL_ID_KEY = 'pixelRulerInstallId';
    
    // *** IMPORTANT: Replace with YOUR Netlify function URL after deploy ***
    this.VERIFY_URL = 'https://rulerguide.netlify.app/.netlify/functions/verify';
    
    this.elements = {};
    this.initialized = false;
    this.init();
  }
  
  async init() {
    try {
      console.log('🚀 Initializing PopupController...');
      
      // Get DOM elements first
      this.getElements();
      
      // Get current active tab
      this.currentTab = await this.getCurrentTab();
      console.log('📋 Current tab obtained:', this.currentTab?.url);
      
      // Check premium status
      await this.checkPremiumStatus();
      
      // Bind event listeners
      this.bindEvents();
      
      // Load current state
      await this.loadState();
      
      // Update UI
      this.updateUI();
      this.updatePremiumUI();
      
      // Load settings
      await this.loadSettings();
      
      // Listen for payment success from the payment tab
      this.listenForPaymentSuccess();
      
      this.initialized = true;
      console.log('✅ PopupController initialized successfully');
      
    } catch (error) {
      console.error('❌ Failed to initialize popup:', error);
      this.showError('Failed to initialize extension: ' + error.message);
    }
  }
  
  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) {
        throw new Error('No active tab found');
      }
      return tab;
    } catch (error) {
      console.error('❌ Failed to get current tab:', error);
      throw new Error('Unable to access current tab');
    }
  }
  
  getElements() {
    console.log('📝 Getting DOM elements...');
    
    const elementIds = [
      'toggleBtn', 'statusIndicator', 'statusText',
      'rulersToggle', 'guidesToggle', 'gridToggle', 'measureToggle',
      'clearGuidesBtn', 'gridSize', 'rulerColor', 'guideColor',
      'helpLink', 'feedbackLink', 'howToUseBtn',
      'premiumSection', 'premiumActiveSection', 'upgradeBtn'
    ];
    
    this.elements = {};
    const missingElements = [];
    
    for (const id of elementIds) {
      const element = document.getElementById(id);
      if (element) {
        this.elements[id] = element;
      } else {
        missingElements.push(id);
        console.warn(`⚠️ Element not found: ${id}`);
      }
    }
    
    if (missingElements.length > 0) {
      throw new Error(`Missing DOM elements: ${missingElements.join(', ')}`);
    }
    
    console.log('✅ All DOM elements found');
  }
  
  bindEvents() {
    console.log('🔗 Binding event listeners...');
    
    try {
      // Main toggle button
      if (this.elements.toggleBtn) {
        this.elements.toggleBtn.addEventListener('click', () => {
          this.toggleRulers();
        });
      }
      
      // Feature toggles
      if (this.elements.rulersToggle) {
        this.elements.rulersToggle.addEventListener('change', (e) => {
          this.toggleFeature('toggleRulers', e.target.checked);
        });
      }
      
      if (this.elements.guidesToggle) {
        this.elements.guidesToggle.addEventListener('change', (e) => {
          this.toggleFeature('toggleGuides', e.target.checked);
        });
      }
      
      if (this.elements.gridToggle) {
        this.elements.gridToggle.addEventListener('change', (e) => {
          this.toggleFeature('toggleGrid', e.target.checked);
        });
      }
      
      if (this.elements.measureToggle) {
        this.elements.measureToggle.addEventListener('change', (e) => {
          this.toggleFeature('toggleMeasure', e.target.checked);
        });
      }
      
      // Action buttons
      if (this.elements.clearGuidesBtn) {
        this.elements.clearGuidesBtn.addEventListener('click', () => {
          this.clearGuides();
        });
      }
      
      // Settings
      if (this.elements.gridSize) {
        this.elements.gridSize.addEventListener('change', (e) => {
          this.updateSetting('gridSize', parseInt(e.target.value));
        });
      }
      
      if (this.elements.rulerColor) {
        this.elements.rulerColor.addEventListener('change', (e) => {
          this.updateSetting('rulerColor', e.target.value);
        });
      }
      
      if (this.elements.guideColor) {
        this.elements.guideColor.addEventListener('change', (e) => {
          this.updateSetting('guideColor', e.target.value);
        });
      }
      
      // Links
      if (this.elements.helpLink) {
        this.elements.helpLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.openHelp();
        });
      }
      
      if (this.elements.feedbackLink) {
        this.elements.feedbackLink.addEventListener('click', (e) => {
          e.preventDefault();
          this.openFeedback();
        });
      }
      
      // How to use button
      if (this.elements.howToUseBtn) {
        this.elements.howToUseBtn.addEventListener('click', () => {
          this.showHowToUse();
        });
      }
      
      // Premium upgrade button — opens payment page in new tab
      if (this.elements.upgradeBtn) {
        this.elements.upgradeBtn.addEventListener('click', () => {
          this.openPaymentPage();
        });
      }
      
      // Intercept premium feature toggles
      document.querySelectorAll('.premium-feature').forEach(el => {
        el.addEventListener('click', (e) => {
          if (!this.premiumActive) {
            e.preventDefault();
            e.stopPropagation();
            const checkbox = el.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = !checkbox.checked; // revert
            this.showUpgradePrompt();
          }
        }, true);
      });
      
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        this.handleKeyboard(e);
      });
      
      console.log('✅ Event listeners bound successfully');
      
    } catch (error) {
      console.error('❌ Failed to bind events:', error);
      throw new Error('Failed to setup event handlers');
    }
  }
  
  async loadState() {
    try {
      if (!this.currentTab) {
        throw new Error('No active tab found');
      }
      
      // Send message to content script to get current state
      const response = await chrome.tabs.sendMessage(this.currentTab.id, {
        action: 'getStatus'
      });
      
      if (response) {
        this.currentState = response;
      }
      
    } catch (error) {
      console.log('Content script not loaded yet or tab not supported');
      
      // Load from storage as fallback
      const stored = await chrome.storage.local.get([
        'pixelRulerActive',
        'showRulers',
        'showGuides',
        'showGrid',
        'measureMode'
      ]);
      
      this.currentState = {
        active: stored.pixelRulerActive || false,
        showRulers: stored.showRulers !== false,
        showGuides: stored.showGuides !== false,
        showGrid: stored.showGrid || false,
        measureMode: stored.measureMode || false
      };
    }
  }
  
  async loadSettings() {
    try {
      const stored = await chrome.storage.local.get(['pixelRulerSettings']);
      
      if (stored.pixelRulerSettings) {
        const settings = stored.pixelRulerSettings;
        this.elements.gridSize.value = settings.gridSize || 10;
        this.elements.rulerColor.value = settings.rulerColor || '#007acc';
        this.elements.guideColor.value = settings.guideColor || '#ff6b35';
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }
  
  updateUI() {
    console.log('🎨 Updating UI with state:', this.currentState);
    
    try {
      // Update main toggle button
      if (this.elements.toggleBtn) {
        this.elements.toggleBtn.classList.toggle('active', this.currentState.active);
        this.elements.toggleBtn.innerHTML = this.currentState.active
          ? `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="m15 9-6 6"/>
              <path d="m9 9 6 6"/>
            </svg>
            <span>Deactivate Rulers</span>
          `
          : `
            <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            <span>Activate Rulers</span>
          `;
      }
      
      // Update status indicator
      if (this.elements.statusIndicator && this.elements.statusText) {
        const statusDot = this.elements.statusIndicator.querySelector('.status-dot');
        if (statusDot) {
          statusDot.classList.toggle('active', this.currentState.active);
        }
        this.elements.statusText.textContent = this.currentState.active ? 'Active' : 'Inactive';
      }
      
      // Update feature toggles
      if (this.elements.rulersToggle) {
        this.elements.rulersToggle.checked = this.currentState.showRulers;
      }
      if (this.elements.guidesToggle) {
        this.elements.guidesToggle.checked = this.currentState.showGuides;
      }
      if (this.elements.gridToggle) {
        this.elements.gridToggle.checked = this.currentState.showGrid;
      }
      if (this.elements.measureToggle) {
        this.elements.measureToggle.checked = this.currentState.measureMode;
      }
      
      // Enable/disable controls based on active state
      const controls = [
        this.elements.rulersToggle,
        this.elements.guidesToggle,
        this.elements.gridToggle,
        this.elements.measureToggle,
        this.elements.clearGuidesBtn
      ].filter(Boolean); // Remove null/undefined elements
      
      controls.forEach(control => {
        if (control) {
          control.disabled = !this.currentState.active;
          if (control.parentElement) {
            control.parentElement.style.opacity = this.currentState.active ? '1' : '0.5';
          }
        }
      });
      
      console.log('✅ UI updated successfully');
      
    } catch (error) {
      console.error('❌ Failed to update UI:', error);
    }
  }
  
  async toggleRulers() {
    console.log('🔄 Toggle rulers requested');
    
    if (!this.initialized) {
      console.error('❌ PopupController not initialized');
      this.showError('Extension not ready');
      return;
    }
    
    try {
      console.log('📤 Sending toggle message to content script...');
      const response = await this.sendMessageToContent('toggle');
      console.log('📬 Toggle response received:', response);
      
      if (response && typeof response.active === 'boolean') {
        this.currentState.active = response.active;
        this.updateUI();
        console.log('✅ Rulers toggled successfully. Active:', response.active);
      } else {
        console.warn('⚠️ Invalid response from content script:', response);
        this.showError('Invalid response from extension');
      }
    } catch (error) {
      console.error('❌ Failed to toggle rulers:', error);
      this.showError('Failed to toggle rulers: ' + error.message);
    }
  }
  
  async toggleFeature(action, enabled) {
    try {
      if (!this.currentState.active) return;
      
      const response = await this.sendMessageToContent(action);
      
      if (response) {
        // Update local state based on response
        switch (action) {
          case 'toggleRulers':
            this.currentState.showRulers = response.showRulers;
            break;
          case 'toggleGuides':
            this.currentState.showGuides = response.showGuides;
            break;
          case 'toggleGrid':
            this.currentState.showGrid = response.showGrid;
            break;
          case 'toggleMeasure':
            this.currentState.measureMode = response.measureMode;
            break;
        }
        
        this.updateUI();
      }
    } catch (error) {
      console.error(`Failed to ${action}:`, error);
      // Revert checkbox state
      const checkbox = document.getElementById(action.replace('toggle', '').toLowerCase() + 'Toggle');
      if (checkbox) {
        checkbox.checked = !enabled;
      }
    }
  }
  
  async clearGuides() {
    try {
      if (!this.currentState.active) return;
      
      const response = await this.sendMessageToContent('clearGuides');
      
      if (response && response.success) {
        this.showSuccessToast('All guides cleared');
      }
    } catch (error) {
      console.error('Failed to clear guides:', error);
      this.showError('Failed to clear guides');
    }
  }
  
  async updateSetting(key, value) {
    try {
      // Load existing settings
      const stored = await chrome.storage.local.get(['pixelRulerSettings']);
      const settings = stored.pixelRulerSettings || {};
      
      // Update setting
      settings[key] = value;
      
      // Save to storage
      await chrome.storage.local.set({ pixelRulerSettings: settings });
      
      // Apply setting immediately if rulers are active
      if (this.currentState.active) {
        // You could send a message to content script to update settings
        // For now, they'll be applied next time the rulers are activated
      }
      
    } catch (error) {
      console.error('Failed to update setting:', error);
    }
  }
  
  async sendMessageToContent(action) {
    console.log('🔄 sendMessageToContent called with action:', action);
    
    if (!this.currentTab) {
      console.error('❌ No active tab found');
      throw new Error('No active tab');
    }

    console.log('📋 Current tab:', {
      id: this.currentTab.id,
      url: this.currentTab.url,
      title: this.currentTab.title
    });

    // Skip if on extension pages or chrome:// pages
    if (!this.currentTab.url || 
        this.currentTab.url.startsWith('chrome://') || 
        this.currentTab.url.startsWith('chrome-extension://') ||
        this.currentTab.url.startsWith('edge://') ||
        this.currentTab.url.startsWith('moz-extension://')) {
      console.error('❌ Cannot run on browser internal pages:', this.currentTab.url);
      throw new Error('This extension cannot run on browser internal pages');
    }
    
    console.log('✅ Tab URL is valid, attempting to send message...');
    
    // Since content scripts are defined in manifest, they should already be injected
    // We'll try multiple times with increasing delays to handle loading timing
    const maxRetries = 3;
    let lastError = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`📤 Attempt ${attempt}/${maxRetries}: Sending message to tab:`, this.currentTab.id);
        
        const response = await chrome.tabs.sendMessage(this.currentTab.id, { action });
        console.log('📬 Received response:', response);
        return response;
        
      } catch (error) {
        console.log(`⚠️ Attempt ${attempt} failed:`, error.message);
        lastError = error;
        
        if (error.message.includes('Could not establish connection') || 
            error.message.includes('Receiving end does not exist')) {
          
          if (attempt < maxRetries) {
            // Wait before retrying (content script might still be loading)
            const delay = attempt * 300; // 300ms, 600ms, 900ms
            console.log(`⏳ Waiting ${delay}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          } else {
            console.error('❌ Content script not responding after all retries');
            throw new Error('Extension not ready. Please refresh the page and try again.');
          }
        } else {
          // For other errors, don't retry
          console.error('❌ Non-connection error:', error);
          throw error;
        }
      }
    }
    
    // If we get here, all retries failed
    console.error('❌ All retry attempts failed. Last error:', lastError);
    throw new Error('Failed to communicate with extension. Please refresh the page and try again.');
  }
  
  handleKeyboard(e) {
    // Handle keyboard shortcuts in popup
    if (e.ctrlKey || e.metaKey) {
      switch (e.key.toLowerCase()) {
        case 'r':
          if (e.shiftKey) {
            e.preventDefault();
            this.elements.rulersToggle.click();
          }
          break;
        case 'g':
          if (e.shiftKey) {
            e.preventDefault();
            this.elements.guidesToggle.click();
          }
          break;
        case 'm':
          e.preventDefault();
          this.elements.measureToggle.click();
          break;
      }
    }
    
    if (e.key === 'Escape') {
      // Close popup
      window.close();
    }
  }
  
  showError(message) {
    this.showToast(message, 'error');
  }
  
  showSuccessToast(message) {
    this.showToast(message, 'success');
  }
  
  showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Style the toast
    Object.assign(toast.style, {
      position: 'fixed',
      top: '10px',
      right: '10px',
      background: type === 'error' ? '#ff4757' : type === 'success' ? '#2ed573' : '#007acc',
      color: 'white',
      padding: '8px 12px',
      borderRadius: '4px',
      fontSize: '12px',
      zIndex: '10000',
      animation: 'slideIn 0.3s ease-out'
    });
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
      toast.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (toast.parentElement) {
          toast.parentElement.removeChild(toast);
        }
      }, 300);
    }, 3000);
  }
  
  openHelp() {
    chrome.tabs.create({
      url: 'https://atul0016.github.io/pixel-ruler-website/privacy-policy.html'
    });
  }
  
  openFeedback() {
    chrome.tabs.create({
      url: 'mailto:your.email@example.com?subject=Pixel Ruler Feedback'
    });
  }

  // ========== PREMIUM / PAYPAL METHODS ==========

  async checkPremiumStatus() {
    try {
      const result = await chrome.storage.local.get(['premiumActive']);
      this.premiumActive = result.premiumActive === true;
      console.log('💎 Premium status:', this.premiumActive);
    } catch (e) {
      console.error('Failed to check premium status:', e);
      this.premiumActive = false;
    }
  }

  updatePremiumUI() {
    // Toggle premium sections
    if (this.elements.premiumSection) {
      this.elements.premiumSection.style.display = this.premiumActive ? 'none' : 'block';
    }
    if (this.elements.premiumActiveSection) {
      this.elements.premiumActiveSection.style.display = this.premiumActive ? 'block' : 'none';
    }

    // Lock/unlock premium features
    document.querySelectorAll('.premium-feature').forEach(el => {
      if (this.premiumActive) {
        el.classList.remove('locked');
      } else {
        el.classList.add('locked');
      }
    });

    // Hide/show PRO badges
    document.querySelectorAll('.pro-badge').forEach(badge => {
      badge.style.display = this.premiumActive ? 'none' : 'inline-block';
    });
  }

  showUpgradePrompt() {
    this.showToast('This is a PRO feature — Upgrade for $1.00!', 'info');
    setTimeout(() => this.openPaymentPage(), 800);
  }

  async getOrCreateInstallId() {
    const result = await chrome.storage.local.get([this.INSTALL_ID_KEY]);
    if (result[this.INSTALL_ID_KEY]) {
      return result[this.INSTALL_ID_KEY];
    }

    const installId = (crypto && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;

    await chrome.storage.local.set({ [this.INSTALL_ID_KEY]: installId });
    return installId;
  }

  async openPaymentPage() {
    const installId = await this.getOrCreateInstallId();
    const url = new URL(this.PAYMENT_URL);
    url.searchParams.set('ext', 'pixel-ruler');
    url.searchParams.set('installId', installId);
    chrome.tabs.create({ url: url.toString() });
  }

  listenForPaymentSuccess() {
    // Poll chrome.storage for premium activation (set by pay.html via background.js)
    // Also re-check when popup is opened
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes.premiumActive && changes.premiumActive.newValue === true) {
        this.premiumActive = true;
        this.updatePremiumUI();
        this.showSuccessToast('Premium unlocked! All features are yours.');
      }
    });
  }

  // ========== END PREMIUM / PAYPAL METHODS ==========
  
  showHowToUse() {
    // Create and show how-to-use modal overlay
    const overlay = document.createElement('div');
    overlay.className = 'how-to-use-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      animation: fadeIn 0.3s ease-out;
    `;
    
    const modal = document.createElement('div');
    modal.className = 'how-to-use-modal';
    modal.style.cssText = `
      background: white;
      border-radius: 12px;
      width: 90%;
      max-width: 450px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      animation: slideIn 0.3s ease-out;
    `;
    
    modal.innerHTML = `
      <div style="padding: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
          <h2 style="margin: 0; color: #007acc; font-size: 18px;">How to Use Pixel Ruler</h2>
          <button class="close-btn" style="background: none; border: none; font-size: 20px; cursor: pointer; color: #666;">×</button>
        </div>
        
        <div style="font-size: 13px; line-height: 1.5; color: #444;">
          <div style="margin-bottom: 16px;">
            <h3 style="color: #007acc; margin-bottom: 8px; font-size: 14px;">🚀 Getting Started</h3>
            <div style="margin-bottom: 6px;"><strong>1.</strong> Click "Activate Rulers" to enable the tool</div>
            <div style="margin-bottom: 6px;"><strong>2.</strong> Rulers will appear on the edges of any webpage</div>
            <div><strong>3.</strong> Start creating guides and measuring elements!</div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <h3 style="color: #007acc; margin-bottom: 8px; font-size: 14px;">📏 Creating Guides</h3>
            <div style="margin-bottom: 4px;"><strong>Vertical:</strong> Shift + double-click anywhere</div>
            <div style="margin-bottom: 4px;"><strong>Horizontal:</strong> Alt + double-click anywhere</div>
            <div style="margin-bottom: 4px;"><strong>Smart Auto:</strong> Just double-click (picks best type)</div>
            <div style="margin-bottom: 4px;"><strong>Force Next:</strong> Ctrl+V (vertical) or Ctrl+H (horizontal)</div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <h3 style="color: #007acc; margin-bottom: 8px; font-size: 14px;">🛠️ Managing Guides</h3>
            <div style="margin-bottom: 4px;"><strong>Move:</strong> Drag any guide line</div>
            <div style="margin-bottom: 4px;"><strong>Delete:</strong> Right-click on guide</div>
            <div style="margin-bottom: 4px;"><strong>Clear All:</strong> Use "Clear All Guides" button</div>
            <div><strong>Quick Delete:</strong> Press Delete/Backspace key</div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <h3 style="color: #007acc; margin-bottom: 8px; font-size: 14px;">📐 Measuring</h3>
            <div style="margin-bottom: 4px;"><strong>1.</strong> Enable "Measure Mode" in popup</div>
            <div style="margin-bottom: 4px;"><strong>2.</strong> Click and drag between any two points</div>
            <div><strong>3.</strong> See live distance measurements</div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <h3 style="color: #007acc; margin-bottom: 8px; font-size: 14px;">⌨️ Keyboard Shortcuts</h3>
            <div style="margin-bottom: 4px;"><strong>Ctrl+Shift+R:</strong> Toggle rulers</div>
            <div style="margin-bottom: 4px;"><strong>Ctrl+Shift+G:</strong> Toggle guides</div>
            <div style="margin-bottom: 4px;"><strong>Ctrl+M:</strong> Toggle measure mode</div>
            <div><strong>Escape:</strong> Exit measure mode</div>
          </div>
          
          <div style="background: #f8f9fa; padding: 12px; border-radius: 6px; margin-top: 16px;">
            <div style="font-size: 12px; color: #666; text-align: center;">
              <strong>💡 Pro Tip:</strong> Use Shift + double-click for precise vertical guides!
            </div>
          </div>
        </div>
      </div>
    `;
    
    // Add close functionality
    const closeBtn = modal.querySelector('.close-btn');
    const closeModal = () => {
      overlay.style.animation = 'fadeIn 0.2s ease-out reverse';
      setTimeout(() => overlay.remove(), 200);
    };
    
    closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    // Add animations
    const style = document.createElement('style');
    style.textContent = `
      @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }
      @keyframes slideIn {
        from { transform: scale(0.9) translateY(-20px); opacity: 0; }
        to { transform: scale(1) translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  }
}

// Initialize popup when DOM is loaded
console.log('🚀 Popup script loading...');

function initializePopup() {
  try {
    console.log('🎯 Initializing popup...');
    new PopupController();
  } catch (error) {
    console.error('❌ Critical popup initialization error:', error);
    
    // Show error message in popup
    const body = document.body;
    if (body) {
      body.innerHTML = `
        <div style="padding: 20px; text-align: center; color: #ff4757;">
          <h3>Extension Error</h3>
          <p>Failed to initialize popup: ${error.message}</p>
          <p style="font-size: 12px; opacity: 0.7;">Please refresh the page and try again</p>
        </div>
      `;
    }
  }
}

if (document.readyState === 'loading') {
  console.log('⏳ Waiting for DOM to load...');
  document.addEventListener('DOMContentLoaded', initializePopup);
} else {
  console.log('✅ DOM already loaded, initializing immediately');
  initializePopup();
}