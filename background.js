/**
 * Pixel Ruler + Alignment Checker - Background Service Worker
 */

// Extension installation and startup
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Pixel Ruler extension installed/updated:', details.reason);
  
  if (details.reason === 'install') {
    // Set default settings on first install
    await chrome.storage.local.set({
      pixelRulerSettings: {
        rulerColor: '#007acc',
        guideColor: '#ff6b35',
        gridSize: 10,
        gridOpacity: 0.1,
        snapTolerance: 5
      },
      pixelRulerActive: false,
      showRulers: true,
      showGuides: true,
      showGrid: false,
      measureMode: false
    });
    
    // Show welcome notification on first install
    console.log('Extension installed successfully! Click the extension icon to get started.');
  }
  
  if (details.reason === 'update') {
    // Handle updates if needed
    console.log('Extension updated to version:', chrome.runtime.getManifest().version);
  }
  
  // Create context menu items
  chrome.contextMenus.create({
    id: 'pixel-ruler-toggle',
    title: 'Toggle Pixel Ruler',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'pixel-ruler-measure',
    title: 'Enable Measure Mode',
    contexts: ['page']
  });
  
  chrome.contextMenus.create({
    id: 'pixel-ruler-clear',
    title: 'Clear All Guides',
    contexts: ['page']
  });
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  console.log('Command received:', command);
  
  try {
    // Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      console.error('No active tab found');
      return;
    }
    
    // Skip if on extension pages or chrome:// pages
    if (!tab.url || 
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('chrome-extension://') ||
        tab.url.startsWith('edge://') ||
        tab.url.startsWith('moz-extension://')) {
      console.log('Cannot run on browser internal pages');
      return;
    }
    
    let action;
    switch (command) {
      case 'toggle_rulers':
        action = 'toggleRulers';
        break;
      case 'toggle_guides':
        action = 'toggleGuides';
        break;
      case 'clear_guides':
        action = 'clearGuides';
        break;
      default:
        console.log('Unknown command:', command);
        return;
    }
    
    // Try to send message to content script
    try {
      await chrome.tabs.sendMessage(tab.id, { action });
      console.log(`Command ${command} executed successfully`);
    } catch (error) {
      if (error.message.includes('Could not establish connection')) {
        // Content script not injected yet, inject it
        console.log('Content script not found, injecting...');
        
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content-script/content-script.js']
        });
        
        await chrome.scripting.insertCSS({
          target: { tabId: tab.id },
          files: ['content-script/content-script.css']
        });
        
        // Wait a moment for script to initialize
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tab.id, { action });
            console.log(`Command ${command} executed after injection`);
          } catch (retryError) {
            console.error('Failed to execute command after injection:', retryError);
          }
        }, 100);
      } else {
        console.error('Failed to execute command:', error);
      }
    }
    
  } catch (error) {
    console.error('Error handling command:', error);
  }
});

// Note: chrome.action.onClicked is not used because we have a popup defined in manifest.json

// Handle tab updates (when navigating to new pages)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only process when tab is completely loaded
  if (changeInfo.status !== 'complete') return;
  
  // Skip browser internal pages
  if (!tab.url || 
      tab.url.startsWith('chrome://') || 
      tab.url.startsWith('chrome-extension://') ||
      tab.url.startsWith('edge://') ||
      tab.url.startsWith('moz-extension://')) {
    return;
  }
  
  try {
    // Check if rulers were active in storage
    const stored = await chrome.storage.local.get(['pixelRulerActive']);
    
    if (stored.pixelRulerActive) {
      // Re-inject content script if it was active
      console.log('Re-injecting content script for active rulers on tab:', tabId);
      
      await chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content-script/content-script.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tabId },
        files: ['content-script/content-script.css']
      });
    }
    
  } catch (error) {
    // Silently handle errors (tab might not support content scripts)
    console.log('Could not inject content script on tab update:', error.message);
  }
});

// Handle messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request);
  
  switch (request.action) {
    case 'updateBadge':
      // Update extension badge to show active status
      chrome.action.setBadgeText({
        tabId: sender.tab?.id,
        text: request.active ? '●' : ''
      });
      
      chrome.action.setBadgeBackgroundColor({
        tabId: sender.tab?.id,
        color: request.active ? '#2ed573' : '#ff4757'
      });
      break;
      
    case 'showNotification':
      // Show system notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: request.title || 'Pixel Ruler',
        message: request.message
      });
      break;
      
    case 'openOptions':
      // Open extension options page
      chrome.runtime.openOptionsPage();
      break;
      
    default:
      console.log('Unknown background message:', request.action);
  }
  
  // Always send response to avoid "response not sent" errors
  sendResponse({ success: true });
});

// Handle storage changes (sync settings across tabs)
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local') {
    console.log('Storage changed:', changes);
    
    // Broadcast settings changes to all tabs
    chrome.tabs.query({}, (tabs) => {
      tabs.forEach(tab => {
        if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'settingsChanged',
            changes: changes
          }).catch(() => {
            // Ignore errors (content script might not be injected)
          });
        }
      });
    });
  }
});

// Handle extension start (browser startup)
chrome.runtime.onStartup.addListener(() => {
  console.log('Browser started, extension active');
  
  // Reset active state on browser startup
  chrome.storage.local.set({ pixelRulerActive: false });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (!tab) return;
  
  let action;
  switch (info.menuItemId) {
    case 'pixel-ruler-toggle':
      action = 'toggle';
      break;
    case 'pixel-ruler-measure':
      action = 'toggleMeasure';
      break;
    case 'pixel-ruler-clear':
      action = 'clearGuides';
      break;
    default:
      return;
  }
  
  try {
    await chrome.tabs.sendMessage(tab.id, { action });
  } catch (error) {
    // Try to inject content script first
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script/content-script.js']
      });
      
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content-script/content-script.css']
      });
      
      setTimeout(async () => {
        await chrome.tabs.sendMessage(tab.id, { action });
      }, 100);
      
    } catch (injectionError) {
      console.error('Failed to inject content script from context menu:', injectionError);
    }
  }
});

console.log('Pixel Ruler background script loaded');

// ========== PAYMENT SUCCESS DETECTION ==========
// When the payment page (pay.html) completes, it sets #payment-success in the URL.
// We detect this and activate premium.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (!changeInfo.url) return;

  let parsed;
  try {
    parsed = new URL(changeInfo.url);
  } catch {
    return;
  }

  if (!parsed.hash.startsWith('#payment-success')) return;

  // Supports both old hash (#payment-success) and new hash (#payment-success&ext=pixel-ruler)
  const rawHashParams = parsed.hash.replace('#payment-success', '').replace(/^&/, '');
  const hashParams = new URLSearchParams(rawHashParams);
  const ext = hashParams.get('ext') || parsed.searchParams.get('ext') || 'pixel-ruler';

  if (ext !== 'pixel-ruler') return;

  console.log('💎 Payment success detected! Activating premium...');
  await chrome.storage.local.set({ premiumActive: true });
  setTimeout(() => {
    chrome.tabs.remove(tabId).catch(() => {});
  }, 3000);
});