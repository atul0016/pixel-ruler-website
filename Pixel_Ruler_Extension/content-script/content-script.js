/**
 * Pixel Ruler + Alignment Checker
 * Content Script - Main functionality
 */

class PixelRuler {
  constructor() {
    this.isActive = false;
    this.showRulers = false;
    this.showGrid = false;
    this.showGuides = true;
    this.guides = [];
    this.isDragging = false;
    this.measureMode = false;
    this.measureStart = null;
    this.measureEnd = null;
    this.forceGuideType = null; // 'horizontal', 'vertical', or null for auto
    
    // DOM elements
    this.container = null;
    this.horizontalRuler = null;
    this.verticalRuler = null;
    this.gridOverlay = null;
    this.tooltip = null;
    this.measureLine = null;
    
    // Settings
    this.settings = {
      rulerColor: '#007acc',
      guideColor: '#ff6b35',
      gridSize: 10,
      gridOpacity: 0.1,
      snapTolerance: 5
    };
    
    this.init();
  }
  
  async init() {
    // Load settings from storage
    await this.loadSettings();
    
    // Create UI elements
    this.createContainer();
    this.createRulers();
    this.createGrid();
    this.createTooltip();
    this.createMeasureLine();
    
    // Bind events
    this.bindEvents();
    
    // Listen for extension messages
    this.listenForMessages();
    
    // Check if should be active on load
    const shouldBeActive = await this.getShouldBeActive();
    if (shouldBeActive) {
      this.toggle();
    }
  }
  
  createContainer() {
    this.container = document.createElement('div');
    this.container.id = 'pixel-ruler-container';
    this.container.className = 'pixel-ruler-container';
    document.body.appendChild(this.container);
  }
  
  createRulers() {
    // Horizontal ruler
    this.horizontalRuler = document.createElement('div');
    this.horizontalRuler.className = 'pixel-ruler horizontal-ruler';
    this.horizontalRuler.innerHTML = this.generateRulerMarks('horizontal');
    this.container.appendChild(this.horizontalRuler);
    
    // Vertical ruler
    this.verticalRuler = document.createElement('div');
    this.verticalRuler.className = 'pixel-ruler vertical-ruler';
    this.verticalRuler.innerHTML = this.generateRulerMarks('vertical');
    this.container.appendChild(this.verticalRuler);
  }
  
  generateRulerMarks(orientation) {
    const maxSize = orientation === 'horizontal' 
      ? Math.max(document.body.scrollWidth, window.innerWidth) 
      : Math.max(document.body.scrollHeight, window.innerHeight);
    
    let marks = '';
    const pixelsPerMark = 10;
    
    for (let i = 0; i <= maxSize; i += pixelsPerMark) {
      const isMajor = i % 50 === 0;
      const isMinor = i % 100 === 0;
      
      if (orientation === 'horizontal') {
        marks += `<div class="ruler-mark ${isMinor ? 'minor' : isMajor ? 'major' : ''}" 
                  style="left: ${i}px;${isMinor ? ` --label: '${i}';` : ''}" 
                  data-pixel="${i}"></div>`;
      } else {
        marks += `<div class="ruler-mark ${isMinor ? 'minor' : isMajor ? 'major' : ''}" 
                  style="top: ${i}px;${isMinor ? ` --label: '${i}';` : ''}" 
                  data-pixel="${i}"></div>`;
      }
    }
    
    return marks;
  }
  
  createGrid() {
    this.gridOverlay = document.createElement('div');
    this.gridOverlay.className = 'pixel-ruler grid-overlay';
    this.gridOverlay.style.backgroundSize = `${this.settings.gridSize}px ${this.settings.gridSize}px`;
    this.container.appendChild(this.gridOverlay);
  }
  
  createTooltip() {
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'pixel-ruler tooltip';
    this.container.appendChild(this.tooltip);
  }
  
  createMeasureLine() {
    this.measureLine = document.createElement('div');
    this.measureLine.className = 'pixel-ruler measure-line';
    this.container.appendChild(this.measureLine);
  }
  
  bindEvents() {
    // Mouse events for guides and measurement
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mousedown', this.handleMouseDown.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    document.addEventListener('click', this.handleClick.bind(this));
    
    // Keyboard events
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Scroll events to update rulers
    window.addEventListener('scroll', this.updateRulersOnScroll.bind(this));
    window.addEventListener('resize', this.handleResize.bind(this));
    
    // Context menu for guides
    document.addEventListener('contextmenu', this.handleRightClick.bind(this));
  }
  
  handleMouseMove(e) {
    if (!this.isActive) return;
    
    // Update tooltip position and content
    this.updateTooltip(e);
    
    // Handle guide dragging
    if (this.isDragging && this.draggedGuide) {
      this.updateGuidePosition(this.draggedGuide, e);
    }
    
    // Handle measurement mode
    if (this.measureMode && this.measureStart) {
      this.updateMeasurement(e);
    }
  }
  
  handleMouseDown(e) {
    if (!this.isActive) return;
    
    // Check if clicking on a guide
    const guide = e.target.closest('.alignment-guide');
    if (guide) {
      this.isDragging = true;
      this.draggedGuide = guide;
      e.preventDefault();
      return;
    }
    
    // Start measurement if in measure mode
    if (this.measureMode && !this.measureStart) {
      this.startMeasurement(e);
    }
  }
  
  handleMouseUp(e) {
    if (!this.isActive) return;
    
    // End guide dragging
    this.isDragging = false;
    this.draggedGuide = null;
    
    // End measurement
    if (this.measureMode && this.measureStart) {
      this.endMeasurement(e);
    }
  }
  
  handleClick(e) {
    if (!this.isActive) return;
    
    // Double-click to create guide
    if (e.detail === 2) {
      this.createGuide(e);
    }
  }
  
  handleKeyDown(e) {
    if (!this.isActive) return;
    
    // Handle keyboard shortcuts
    switch(e.key) {
      case 'Escape':
        this.clearMeasurement();
        this.measureMode = false;
        break;
      case 'm':
      case 'M':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.toggleMeasureMode();
        }
        break;
      case 'g':
      case 'G':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.toggleGuides();
        }
        break;
      case 'r':
      case 'R':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.toggleRulers();
        }
        break;
      case 'h':
      case 'H':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.forceGuideType = 'horizontal';
          console.log('🔄 Next guide will be horizontal (Ctrl+H pressed)');
          this.showTemporaryMessage('Next guide: Horizontal - Double-click anywhere');
        }
        break;
      case 'v':
      case 'V':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          this.forceGuideType = 'vertical';
          console.log('🔄 Next guide will be vertical (Ctrl+V pressed)');
          this.showTemporaryMessage('Next guide: Vertical - Double-click anywhere');
        }
        break;
      case 'Delete':
      case 'Backspace':
        this.deleteSelectedGuide();
        break;
    }
  }
  
  handleRightClick(e) {
    if (!this.isActive) return;
    
    const guide = e.target.closest('.alignment-guide');
    if (guide) {
      e.preventDefault();
      this.deleteGuide(guide);
    }
  }
  
  createGuide(e) {
    console.log('🎯 Creating guide...');
    const guide = document.createElement('div');
    guide.className = 'pixel-ruler alignment-guide';
    
    // Determine guide type with improved logic
    let isVertical = false;
    
    if (this.forceGuideType) {
      // User explicitly chose guide type with Ctrl+H or Ctrl+V
      isVertical = this.forceGuideType === 'vertical';
      console.log(`📏 Using forced guide type: ${this.forceGuideType}`);
      this.forceGuideType = null; // Reset after use
    } else if (e.shiftKey) {
      // Shift+double-click creates vertical guide
      isVertical = true;
      console.log('📏 Shift+double-click detected - creating vertical guide');
    } else if (e.altKey) {
      // Alt+double-click creates horizontal guide
      isVertical = false;
      console.log('📏 Alt+double-click detected - creating horizontal guide');
    } else {
      // Smart auto-detection based on click position and rulers
      const rect = this.container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Check if clicked on or near rulers
      const nearLeftRuler = x < 30; // Within 30px of left edge (ruler area)
      const nearTopRuler = y < 30;  // Within 30px of top edge (ruler area)
      
      if (nearLeftRuler && !nearTopRuler) {
        // Clicking on left ruler area creates vertical guide
        isVertical = true;
        console.log('📏 Clicked near left ruler - creating vertical guide');
      } else if (nearTopRuler && !nearLeftRuler) {
        // Clicking on top ruler area creates horizontal guide
        isVertical = false;
        console.log('📏 Clicked near top ruler - creating horizontal guide');
      } else {
        // Default behavior: alternate between types or use distance from center
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        const distanceFromCenterX = Math.abs(e.clientX - centerX);
        const distanceFromCenterY = Math.abs(e.clientY - centerY);
        
        // Create the guide type that would be more useful based on position
        isVertical = distanceFromCenterX > distanceFromCenterY;
        console.log(`📏 Auto-detection: vertical=${isVertical} (distX:${distanceFromCenterX}, distY:${distanceFromCenterY})`);
      }
    }
    
    if (isVertical) {
      guide.classList.add('vertical');
      guide.style.left = e.clientX + 'px';
      guide.style.top = '0px';
      guide.style.width = '1px';
      guide.style.height = '100vh';
      console.log(`✅ Created vertical guide at x=${e.clientX}px`);
    } else {
      guide.classList.add('horizontal');
      guide.style.top = e.clientY + 'px';
      guide.style.left = '0px';
      guide.style.width = '100vw';
      guide.style.height = '1px';
      console.log(`✅ Created horizontal guide at y=${e.clientY}px`);
    }
    
    guide.setAttribute('data-guide-id', Date.now().toString());
    this.container.appendChild(guide);
    this.guides.push(guide);
    
    // Flash the guide to show it was created
    guide.style.opacity = '1';
    guide.style.background = '#00ff00';
    setTimeout(() => {
      guide.style.background = this.settings.guideColor;
      guide.style.opacity = '0.8';
    }, 200);
    
    console.log(`✅ Guide created successfully. Total guides: ${this.guides.length}`);
  }
  
  updateGuidePosition(guide, e) {
    if (guide.classList.contains('vertical')) {
      guide.style.left = (e.clientX + window.scrollX) + 'px';
    } else {
      guide.style.top = (e.clientY + window.scrollY) + 'px';
    }
  }
  
  deleteGuide(guide) {
    const index = this.guides.indexOf(guide);
    if (index > -1) {
      this.guides.splice(index, 1);
      guide.remove();
      console.log(`✅ Guide deleted. Remaining guides: ${this.guides.length}`);
    }
  }
  
  deleteSelectedGuide() {
    // For now, delete the most recently created guide
    // In the future, this could be enhanced to track selected guides
    if (this.guides.length > 0) {
      const lastGuide = this.guides[this.guides.length - 1];
      this.deleteGuide(lastGuide);
      console.log('🗑️ Deleted most recent guide');
    } else {
      console.log('⚠️ No guides to delete');
    }
  }
  
  updateTooltip(e) {
    const elementUnderMouse = document.elementFromPoint(e.clientX, e.clientY);
    if (!elementUnderMouse || elementUnderMouse.closest('#pixel-ruler-container')) {
      this.tooltip.style.display = 'none';
      return;
    }
    
    const rect = elementUnderMouse.getBoundingClientRect();
    const x = Math.round(e.clientX);
    const y = Math.round(e.clientY);
    
    this.tooltip.innerHTML = `
      <div>X: ${x}px, Y: ${y}px</div>
      <div>Element: ${rect.width}×${rect.height}px</div>
      <div>Position: ${Math.round(rect.left)}px, ${Math.round(rect.top)}px</div>
    `;
    
    this.tooltip.style.left = (e.clientX + 15) + 'px';
    this.tooltip.style.top = (e.clientY - 60) + 'px';
    this.tooltip.style.display = 'block';
  }
  
  startMeasurement(e) {
    this.measureStart = { x: e.clientX, y: e.clientY };
    this.measureLine.style.display = 'block';
  }
  
  updateMeasurement(e) {
    if (!this.measureStart) return;
    
    const deltaX = e.clientX - this.measureStart.x;
    const deltaY = e.clientY - this.measureStart.y;
    const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
    
    // Update line position and rotation
    const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;
    const centerX = this.measureStart.x + deltaX / 2;
    const centerY = this.measureStart.y + deltaY / 2;
    
    this.measureLine.style.left = this.measureStart.x + 'px';
    this.measureLine.style.top = this.measureStart.y + 'px';
    this.measureLine.style.width = distance + 'px';
    this.measureLine.style.height = '2px';
    this.measureLine.style.transform = `rotate(${angle}deg)`;
    this.measureLine.style.transformOrigin = '0 0';
    
    // Show measurement
    this.measureLine.setAttribute('data-measurement', 
      `${Math.round(distance)}px (${Math.abs(Math.round(deltaX))}×${Math.abs(Math.round(deltaY))})`
    );
  }
  
  endMeasurement(e) {
    // Keep the measurement line visible until next measurement or escape
    this.measureStart = null;
  }
  
  clearMeasurement() {
    this.measureLine.style.display = 'none';
    this.measureStart = null;
  }
  
  showTemporaryMessage(text, duration = 2000) {
    // Remove any existing message
    const existingMessage = document.getElementById('pixel-ruler-temp-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create message element
    const message = document.createElement('div');
    message.id = 'pixel-ruler-temp-message';
    message.className = 'pixel-ruler temp-message';
    message.textContent = text;
    message.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 6px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 2147483647;
      animation: fadeInOut 0.3s ease-in-out;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    
    document.body.appendChild(message);
    
    // Auto-remove after duration
    setTimeout(() => {
      if (message.parentElement) {
        message.style.animation = 'fadeInOut 0.3s ease-in-out reverse';
        setTimeout(() => {
          if (message.parentElement) {
            message.remove();
          }
        }, 300);
      }
    }, duration);
  }
  
  toggle() {
    this.isActive = !this.isActive;
    this.container.style.display = this.isActive ? 'block' : 'none';
    this.updateRulers();
    
    // Save state
    chrome.storage.local.set({ pixelRulerActive: this.isActive });
    
    return this.isActive;
  }
  
  toggleRulers() {
    this.showRulers = !this.showRulers;
    this.horizontalRuler.style.display = this.showRulers ? 'block' : 'none';
    this.verticalRuler.style.display = this.showRulers ? 'block' : 'none';
    chrome.storage.local.set({ showRulers: this.showRulers });
  }
  
  toggleGuides() {
    this.showGuides = !this.showGuides;
    this.guides.forEach(guide => {
      guide.style.display = this.showGuides ? 'block' : 'none';
    });
  }
  
  toggleGrid() {
    this.showGrid = !this.showGrid;
    this.gridOverlay.style.display = this.showGrid ? 'block' : 'none';
  }
  
  toggleMeasureMode() {
    this.measureMode = !this.measureMode;
    document.body.style.cursor = this.measureMode ? 'crosshair' : '';
    
    if (!this.measureMode) {
      this.clearMeasurement();
    }
  }
  
  clearAllGuides() {
    this.guides.forEach(guide => guide.remove());
    this.guides = [];
  }
  
  updateRulers() {
    if (!this.isActive) return;
    
    // Regenerate ruler marks if needed
    const horizontalMarks = this.generateRulerMarks('horizontal');
    const verticalMarks = this.generateRulerMarks('vertical');
    
    this.horizontalRuler.innerHTML = horizontalMarks;
    this.verticalRuler.innerHTML = verticalMarks;
  }
  
  updateRulersOnScroll() {
    if (!this.isActive || !this.showRulers) return;
    
    // Update ruler position to stay in viewport
    this.horizontalRuler.style.top = window.scrollY + 'px';
    this.verticalRuler.style.left = window.scrollX + 'px';
  }
  
  handleResize() {
    if (this.isActive) {
      this.updateRulers();
    }
  }
  
  async loadSettings() {
    const stored = await chrome.storage.local.get([
      'pixelRulerSettings',
      'showRulers',
      'showGrid',
      'showGuides'
    ]);
    
    if (stored.pixelRulerSettings) {
      Object.assign(this.settings, stored.pixelRulerSettings);
    }
    
    this.showRulers = stored.showRulers !== false; // Default true
    this.showGrid = stored.showGrid || false;
    this.showGuides = stored.showGuides !== false; // Default true
  }
  
  async getShouldBeActive() {
    const stored = await chrome.storage.local.get(['pixelRulerActive']);
    return stored.pixelRulerActive || false;
  }
  
  listenForMessages() {
    console.log('🎉 PixelRuler content script initialized');
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      console.log('📨 Content script received message:', request);
      console.log('👤 Message sender:', sender);
      
      let response = null;
      
      try {
        switch(request.action) {
          case 'toggle':
            console.log('🔄 Processing toggle action');
            response = { active: this.toggle() };
            console.log('✅ Toggle response:', response);
            break;
          case 'toggleRulers':
            console.log('📐 Processing toggleRulers action');
            this.toggleRulers();
            response = { showRulers: this.showRulers };
            console.log('✅ ToggleRulers response:', response);
            break;
          case 'toggleGuides':
            console.log('📏 Processing toggleGuides action');
            this.toggleGuides();
            response = { showGuides: this.showGuides };
            console.log('✅ ToggleGuides response:', response);
            break;
          case 'toggleGrid':
            console.log('⚏ Processing toggleGrid action');
            this.toggleGrid();
            response = { showGrid: this.showGrid };
            console.log('✅ ToggleGrid response:', response);
            break;
          case 'clearGuides':
            console.log('🧹 Processing clearGuides action');
            this.clearAllGuides();
            response = { success: true };
            console.log('✅ ClearGuides response:', response);
            break;
          case 'toggleMeasure':
            console.log('📏 Processing toggleMeasure action');
            this.toggleMeasureMode();
            response = { measureMode: this.measureMode };
            console.log('✅ ToggleMeasure response:', response);
            break;
          case 'getStatus':
            console.log('📊 Processing getStatus action');
            response = {
              active: this.isActive,
              showRulers: this.showRulers,
              showGuides: this.showGuides,
              showGrid: this.showGrid,
              measureMode: this.measureMode
            };
            console.log('✅ GetStatus response:', response);
            break;
          default:
            console.warn('⚠️ Unknown action:', request.action);
            response = { error: 'Unknown action' };
        }
        
        console.log('📬 Sending response:', response);
        sendResponse(response);
        
      } catch (error) {
        console.error('❌ Error processing message:', error);
        console.error('📋 Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack
        });
        
        const errorResponse = { 
          error: error.message,
          success: false 
        };
        console.log('📬 Sending error response:', errorResponse);
        sendResponse(errorResponse);
      }
      
      // Return true to indicate we'll send a response asynchronously
      return true;
    });
  }
}

// Initialize the pixel ruler when DOM is ready
console.log('🚀 PixelRuler content script loading...');
console.log('📋 Document ready state:', document.readyState);

if (document.readyState === 'loading') {
  console.log('⏳ Waiting for DOMContentLoaded...');
  document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM loaded, initializing PixelRuler');
    new PixelRuler();
  });
} else {
  console.log('✅ DOM already loaded, initializing PixelRuler immediately');
  new PixelRuler();
}