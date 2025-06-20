// BigQuery Smart Execute - Content Script
class BigQuerySmartExecute {
  constructor() {
    this.editor = null;
    this.bigQueryEditor = null;
    this.singleQueryMode = true; // Default enabled
    this.init();
  }

  init() {
    
    // Load settings
    this.loadSettings();
    
    // Listen to popup messages
    this.setupMessageListener();
    
    // Wait for BigQuery editor to load
    this.waitForBigQueryEditor();
    
    // Add multiple event listeners to ensure capturing Ctrl+Enter
    this.addKeyboardListeners();
  }

  async loadSettings() {
    try {
      const result = await chrome.storage.sync.get(['singleQueryMode']);
      this.singleQueryMode = result.singleQueryMode !== undefined ? result.singleQueryMode : true;
      
      // Update Run buttons after loading settings
      setTimeout(() => {
        this.updateAllRunButtons();
      }, 2000);
    } catch (error) {
      console.error('Error loading settings:', error);
      this.singleQueryMode = true; // Default value
    }
  }

  setupMessageListener() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'updateSingleQueryMode') {
        this.singleQueryMode = request.enabled;
        
        // Update text of all Run buttons
        this.updateAllRunButtons();
        
        showMessage(this.singleQueryMode ? 
          'Single query mode enabled - Button: "Run current"' : 
          'Single query mode disabled - Button: "Run all"');
      }
    });
  }

  addKeyboardListeners() {
    
    // Document level listener (most reliable)
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        this.executeCurrentQuery();
      }
    }, true);
    
    // Attach directly to editor when available
    setTimeout(() => {
      this.attachEditorListener();
    }, 2000);
  }

  attachEditorListener() {
    const editorContainer = document.querySelector('.cfc-code-editor-editor');
    if (editorContainer) {
      editorContainer.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          this.executeCurrentQuery();
        }
      }, true);
    } else {
      // Try other selectors silently
      const alternatives = ['.cfc-code-editor', '[class*="cfc-code-editor"]'];
      for (const selector of alternatives) {
        const element = document.querySelector(selector);
        if (element) {
          element.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              this.executeCurrentQuery();
            }
          }, true);
          return;
        }
      }
      // Only warn if no editor found at all
      
    }
  }

  waitForBigQueryEditor() {
    const checkForEditor = () => {
      // Search for custom BigQuery editor
      const editorContainer = document.querySelector('.cfc-code-editor-editor');
      if (editorContainer) {
        
        this.setupBigQueryEditor(editorContainer);
        return;
      }
      
      // Alternative: search for other BigQuery editor selectors
      const alternatives = [
        '.cfc-code-editor',
        '.cfc-code-editor-editor-fill',
        '[class*="cfc-code-editor"]'
      ];
      
      for (const selector of alternatives) {
        const element = document.querySelector(selector);
        if (element) {
          
          this.setupBigQueryEditor(element);
          return;
        }
      }
      
      // Retry silently
      setTimeout(checkForEditor, 1000);
    };
    checkForEditor();
  }

  setupBigQueryEditor(editorElement) {
    this.bigQueryEditor = editorElement;
    
    // Search for textarea or contenteditable div in the editor
    const textArea = editorElement.querySelector('textarea');
    const contentEditable = editorElement.querySelector('[contenteditable="true"]');
    
    if (textArea) {
      this.editorInput = textArea;
    } else if (contentEditable) {
      this.editorInput = contentEditable;
    } else {
      this.editorInput = editorElement;
    }
    
    // Intercept Run button to respect our logic
    this.interceptRunButton();
  }

  executeCurrentQuery() {
    if (!this.bigQueryEditor || !this.editorInput) {
      console.warn('BigQuery editor not available');
      return;
    }

    try {
      
      // Priority 1: Check if there's a manual selection
      const manualSelection = this.getManualSelection();
      if (manualSelection && manualSelection.length > 0) {
        this.triggerExecution();
        return;
      }
      
      // Priority 2: Single query mode disabled → execute all
      if (!this.singleQueryMode) {
        this.triggerExecution();
        return;
      }
      
      // Priority 3: Single query mode enabled → find and execute current query
      const fullText = this.getEditorContent();
      const cursorPosition = this.getCursorPosition();
      
      if (!fullText) {
        console.warn('Unable to retrieve content');
        showMessage('Error: content not accessible, or no query detected');
        return;
      }
      
      // Find current query
      const currentQuery = this.findCurrentQueryInText(fullText, cursorPosition);
      
      if (currentQuery) {
        
        // Select query in editor
        this.selectTextInEditor(currentQuery);
        
        // Wait for selection to be applied
        setTimeout(() => {
          this.triggerExecution();
        }, 200);
      } else {
        showMessage('No query detected - full execution');
        
        // Fallback: execute all content
        this.triggerExecution();
      }
    } catch (e) {
      console.error('Error during execution:', e);
      showMessage('Execution error');
    }
  }

  getEditorContent() {
    if (!this.editorInput) {
      console.warn('No editor input available');
      return '';
    }
    
    try {
      if (this.editorInput.tagName === 'TEXTAREA') {
        return this.editorInput.value || '';
      } else if (this.editorInput.contentEditable === 'true') {
        return this.editorInput.textContent || this.editorInput.innerText || '';
      } else {
        // Try to find content in child elements
        const textNode = this.editorInput.querySelector('[class*="view-line"]');
        if (textNode) {
          return textNode.textContent || textNode.innerText || '';
        }
        return this.editorInput.textContent || this.editorInput.innerText || '';
      }
    } catch (error) {
      console.error('Error getting editor content:', error);
      return '';
    }
  }

  getCursorPosition() {
    if (this.editorInput.tagName === 'TEXTAREA') {
      return this.editorInput.selectionStart;
    } else {
      // For contenteditable divs, it's more complex
      const selection = window.getSelection();
      if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        return range.startOffset;
      }
      return 0;
    }
  }

  getManualSelection() {
    if (this.editorInput.tagName === 'TEXTAREA') {
      // For textarea
      const start = this.editorInput.selectionStart;
      const end = this.editorInput.selectionEnd;
      
      if (start !== end) {
        const selectedText = this.editorInput.value.substring(start, end);
        return selectedText.trim();
      }
    } else {
      // For contenteditable and complex elements
      const selection = window.getSelection();
      
      if (selection.rangeCount > 0) {
        const selectedText = selection.toString();
        if (selectedText && selectedText.trim().length > 0) {
          return selectedText.trim();
        }
      }
      
      // Also check if BigQuery has its own selection in the editor
      const bigQuerySelection = this.getBigQueryEditorSelection();
      if (bigQuerySelection) {
        return bigQuerySelection;
      }
    }
    
    return null;
  }

  interceptRunButton() {
    // Wait a bit for the interface to be fully loaded
    setTimeout(() => {
      this.findAndInterceptRunButton();
    }, 1000);
    
    // Retry periodically in case the interface changes
    setInterval(() => {
      this.findAndInterceptRunButton();
    }, 5000);
  }

  findAndInterceptRunButton() {
    // Search for Run button if not already intercepted
    const runButton = this.findRunButton();
    
    if (runButton && !runButton.dataset.smartExecuteIntercepted) {
      
      // Mark as intercepted to avoid duplicates
      runButton.dataset.smartExecuteIntercepted = 'true';
      
      // Intercept click
      runButton.addEventListener('click', (event) => {
        // Don't intercept if in bypass mode
        if (runButton.dataset.smartExecuteIntercepted === 'bypassed') {
          return;
        }
        
        // Prevent default behavior
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        
        // Use our priority logic
        this.executeCurrentQuery();
        
      }, true); // true = capture phase to intercept before BigQuery
      
      // Add temporary visual indicator
      this.addRunButtonIndicator(runButton);
    }
  }

  addRunButtonIndicator(button) {
    // Sauvegarder le texte original s'il n'est pas déjà sauvé
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || button.innerText || 'Run';
    }
    
    // Update button text according to mode
    this.updateRunButtonText(button);
    
    // Add permanent indication in title
    if (!button.title.includes('Smart Execute')) {
      const originalTitle = button.title || button.getAttribute('aria-label') || 'Run';
      button.title = `${originalTitle} (Smart Execute - Priority: Selection > Single Query > All)`;
    }
    
    // Add subtle temporary border to indicate detection
    const originalBorder = button.style.border;
    const originalBoxShadow = button.style.boxShadow;
    
    button.style.border = '1px solid #4285f4';
    button.style.boxShadow = '0 0 3px rgba(66, 133, 244, 0.3)';
    button.style.transition = 'all 0.3s ease';
    
    // Restore original visual state but keep text and title
    setTimeout(() => {
      button.style.border = originalBorder;
      button.style.boxShadow = originalBoxShadow;
      button.style.transition = '';
    }, 2000);
  }

  updateRunButtonText(button) {
    if (!button) return;
    
    // Save original text if not already saved (text only, not including HTML)
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent || button.innerText || 'Run';
    }
    
    const originalText = button.dataset.originalText;
    
    // Determine new text based on mode
    let newText;
    if (this.singleQueryMode) {
      // Single query mode: "Run current"
      if (originalText.toLowerCase().includes('run')) {
        newText = originalText.replace(/run/gi, 'Run current');
      } else {
        newText = 'Run current';
      }
    } else {
      // Complete mode: "Run all"
      if (originalText.toLowerCase().includes('run')) {
        newText = originalText.replace(/run/gi, 'Run all');
      } else {
        newText = 'Run all';
      }
    }
    
    // Clean text to avoid duplicates
    newText = newText.replace(/Run current current/gi, 'Run current')
                   .replace(/Run all all/gi, 'Run all')
                   .replace(/current all/gi, this.singleQueryMode ? 'current' : 'all')
                   .replace(/all current/gi, this.singleQueryMode ? 'current' : 'all');
    
    // Update text while preserving icons
    if (button.textContent !== newText) {
      this.updateButtonTextPreservingIcons(button, newText);
      
      // Small animation to show change
      button.style.transition = 'color 0.3s ease';
      button.style.color = '#4285f4';
      setTimeout(() => {
        button.style.color = '';
        button.style.transition = '';
      }, 300);
    }
  }

  updateButtonTextPreservingIcons(button, newText) {
    // Save original button styles to prevent style corruption
    const originalBackgroundColor = getComputedStyle(button).backgroundColor;
    const originalColor = getComputedStyle(button).color;
    
    // Find and preserve any SVG icons
    const svgIcons = button.querySelectorAll('svg, .material-icons, [class*="icon"]');
    const preservedIcons = [];
    
    // Clone and store icons with their original styles
    svgIcons.forEach(icon => {
      const clonedIcon = icon.cloneNode(true);
      
      // Save original icon styles
      const originalIconStyles = getComputedStyle(icon);
      
      // Apply spacing and positioning
      clonedIcon.style.marginRight = '6px';
      clonedIcon.style.verticalAlign = 'middle';
      clonedIcon.style.display = 'inline-block';
      
      // Preserve icon color - try multiple methods
      clonedIcon.style.fill = originalIconStyles.fill || 'currentColor';
      clonedIcon.style.color = originalIconStyles.color || 'inherit';
      
      // For SVG, make sure path elements inherit color correctly
      if (clonedIcon.tagName === 'svg') {
        const paths = clonedIcon.querySelectorAll('path');
        paths.forEach(path => {
          if (!path.getAttribute('fill') || path.getAttribute('fill') === 'currentColor') {
            path.style.fill = 'currentColor';
          }
        });
      }
      
      preservedIcons.push(clonedIcon);
    });
    
    // Update text content carefully
    button.textContent = newText;
    
    // Re-add icons at the beginning
    preservedIcons.forEach(icon => {
      button.insertBefore(icon, button.firstChild);
    });
    
    // Restore original button styles if they were changed
    const currentBackgroundColor = getComputedStyle(button).backgroundColor;
    const currentColor = getComputedStyle(button).color;
    
    if (currentBackgroundColor !== originalBackgroundColor || 
        currentColor !== originalColor) {
      // Force restore styles without using !important
      button.style.backgroundColor = '';
      button.style.color = '';
      button.style.background = '';
    }
  }

  updateAllRunButtons() {
    // Update all intercepted Run buttons
    const interceptedButtons = document.querySelectorAll('[data-smart-execute-intercepted="true"]');
    interceptedButtons.forEach(button => {
      this.updateRunButtonText(button);
    });
    
    // If no button found, try to find and update current Run button
    if (interceptedButtons.length === 0) {
      const currentRunButton = this.findRunButton();
      if (currentRunButton) {
        this.updateRunButtonText(currentRunButton);
      }
    }
  }

  getBigQueryEditorSelection() {
    // Search for editor elements that might contain a selection
    const editorLines = this.bigQueryEditor.querySelectorAll('.view-line');
    let hasSelection = false;
    let selectedText = '';
    
    // Check if lines are visually selected
    editorLines.forEach(line => {
      if (line.classList.contains('selected') || 
          line.getAttribute('aria-selected') === 'true' ||
          line.style.backgroundColor) {
        hasSelection = true;
        selectedText += line.textContent + '\n';
      }
    });
    
    if (hasSelection && selectedText.trim()) {
      return selectedText.trim();
    }
    
    // Check elements with selection classes
    const selectedElements = this.bigQueryEditor.querySelectorAll(
      '.selected, [aria-selected="true"], .highlight, .selection'
    );
    
    if (selectedElements.length > 0) {
      selectedText = Array.from(selectedElements)
        .map(el => el.textContent)
        .join('\n')
        .trim();
      
      if (selectedText) {
        return selectedText;
      }
    }
    
    return null;
  }

  findCurrentQueryInText(text, cursorPosition) {
    
    // Convert cursor position to approximate line/column
    const textBeforeCursor = text.substring(0, cursorPosition);
    const lines = text.split('\n');
    const linesBeforeCursor = textBeforeCursor.split('\n');
    const currentLineIndex = linesBeforeCursor.length - 1;
    
    // Find start and end of current query
    let startLine = currentLineIndex;
    let endLine = currentLineIndex;
    
    // Search upward to find query start
    for (let i = currentLineIndex; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.endsWith(';')) {
        if (i < currentLineIndex) {
          startLine = i + 1;
          break;
        }
      }
      if (i === 0) {
        startLine = 0;
      }
    }
    
    // Search downward to find query end
    for (let i = currentLineIndex; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.endsWith(';')) {
        endLine = i;
        break;
      }
      if (i === lines.length - 1) {
        endLine = i;
      }
    }
    
    // Extract query text
    const queryLines = lines.slice(startLine, endLine + 1);
    const queryText = queryLines.join('\n').trim();
    
    if (queryText && (queryText.toLowerCase().includes('select') || 
                      queryText.toLowerCase().includes('with') ||
                      queryText.toLowerCase().includes('insert') ||
                      queryText.toLowerCase().includes('update') ||
                      queryText.toLowerCase().includes('delete'))) {
      return {
        text: queryText,
        startLine: startLine,
        endLine: endLine,
        startPosition: lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0),
        endPosition: lines.slice(0, endLine + 1).join('\n').length
      };
    }
    
    return null;
  }

  selectTextInEditor(queryInfo) {
    
    if (this.editorInput.tagName === 'TEXTAREA') {
      // For textarea, use setSelectionRange
      this.editorInput.focus();
      this.editorInput.setSelectionRange(queryInfo.startPosition, queryInfo.endPosition);
    } else {
      // For contenteditable, use Selection API
      try {
        const range = document.createRange();
        const textNode = this.getFirstTextNode(this.editorInput);
        
        if (textNode) {
          range.setStart(textNode, Math.min(queryInfo.startPosition, textNode.textContent.length));
          range.setEnd(textNode, Math.min(queryInfo.endPosition, textNode.textContent.length));
          
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          
        }
      } catch (e) {
        console.warn('Error during contenteditable selection:', e);
      }
    }
  }

  getFirstTextNode(element) {
    if (element.nodeType === Node.TEXT_NODE) {
      return element;
    }
    for (let child of element.childNodes) {
      const textNode = this.getFirstTextNode(child);
      if (textNode) return textNode;
    }
    return null;
  }

  triggerExecution() {
    
    // Method 1: Find BigQuery "Run" button and simulate native click
    const runButton = this.findRunButton();
    if (runButton) {
      
      // Temporarily disable our interception for this click
      const wasIntercepted = runButton.dataset.smartExecuteIntercepted;
      runButton.dataset.smartExecuteIntercepted = 'bypassed';
      
      // Click the button
      runButton.click();
      
      // Restore interception after short delay
      setTimeout(() => {
        runButton.dataset.smartExecuteIntercepted = wasIntercepted;
      }, 500);
      
      return;
    }
    
    // Method 2: Use events on BigQuery editor
    try {
      if (this.editorInput) {
        const keydownEvent = new KeyboardEvent('keydown', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });
        
        const keyupEvent = new KeyboardEvent('keyup', {
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
          ctrlKey: true,
          bubbles: true,
          cancelable: true
        });
        
        this.editorInput.focus();
        this.editorInput.dispatchEvent(keydownEvent);
        this.editorInput.dispatchEvent(keyupEvent);
        return;
      }
    } catch (e) {
      console.warn('Error with BigQuery editor:', e);
    }
    
         // Method 3: Fallback - event on BigQuery container
     const editorContainer = document.querySelector('.cfc-code-editor') || 
                             document.querySelector('[class*="cfc-code-editor"]');
     if (editorContainer) {
       const event = new KeyboardEvent('keydown', {
         key: 'Enter',
         code: 'Enter',
         keyCode: 13,
         ctrlKey: true,
         bubbles: true,
         cancelable: true
       });
       
       editorContainer.dispatchEvent(event);
     } else {
       console.error('No execution method available');
       showMessage('Error: cannot execute');
     }
  }

  findRunButton() {
    
    // Search for "Run" button in BigQuery interface
    const selectors = [
      'button[data-testid="run-button"]',
      'button[aria-label*="Run"]',
      'button[aria-label*="run"]',
      'button[title*="Run"]',
      'button[title*="run"]',
      '.run-button',
      '[data-tooltip*="Run"]',
      '[data-tooltip*="run"]',
      'button[data-value="run"]'
    ];
    
    for (const selector of selectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) { // Check that button is visible
        return button;
      }
    }
    
    // Search by text in all buttons
    const buttons = document.querySelectorAll('button, [role="button"], .mdc-button');
    for (const button of buttons) {
      const text = button.textContent?.toLowerCase() || '';
      const ariaLabel = button.getAttribute('aria-label')?.toLowerCase() || '';
      const title = button.getAttribute('title')?.toLowerCase() || '';
      
      if ((text.includes('run') || ariaLabel.includes('run') || title.includes('run')) && 
          button.offsetParent !== null) {
        return button;
      }
    }
    
    // Search specifically for buttons with play icon (triangle)
    const iconButtons = document.querySelectorAll('button mat-icon, button i, [role="button"] mat-icon');
    for (const icon of iconButtons) {
      const iconText = icon.textContent?.toLowerCase() || '';
      const iconClass = icon.className?.toLowerCase() || '';
      
      if (iconText.includes('play') || iconClass.includes('play') || 
          iconText.includes('arrow') || iconClass.includes('arrow')) {
        const button = icon.closest('button') || icon.closest('[role="button"]');
        if (button && button.offsetParent !== null) {
          return button;
        }
      }
    }
    
    return null;
  }


}

// Initialize plugin when page loads
if (window.location.hostname === 'console.cloud.google.com' && 
    window.location.pathname.includes('bigquery')) {
  new BigQuerySmartExecute();
}

// Add visual indicator
const style = document.createElement('style');
style.textContent = `
  .bq-smart-execute-indicator {
    position: fixed;
    top: 10px;
    right: 10px;
    background: #4285f4;
    color: white;
    padding: 8px 12px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
    opacity: 0;
    transition: opacity 0.3s;
  }
  
  .bq-smart-execute-indicator.show {
    opacity: 1;
  }
`;
document.head.appendChild(style);

// Function to display temporary message
function showMessage(text, duration = 2000) {
  let indicator = document.querySelector('.bq-smart-execute-indicator');
  if (!indicator) {
    indicator = document.createElement('div');
    indicator.className = 'bq-smart-execute-indicator';
    document.body.appendChild(indicator);
  }
  
  indicator.textContent = text;
  indicator.classList.add('show');
  
  setTimeout(() => {
    indicator.classList.remove('show');
  }, duration);
}

// Welcome message with delay to let settings load
setTimeout(async () => {
  // Get current state of both modes
  try {
    const result = await chrome.storage.sync.get(['singleQueryMode']);
    const singleQueryMode = result.singleQueryMode !== undefined ? result.singleQueryMode : true;
    
    let message = 'BigQuery';
    
    if (singleQueryMode) {
      message += ' - Single query mode enabled';
    } else {
      message += ' - Complete mode enabled';
    }
    
    showMessage(message, 4000);
  } catch (error) {
    showMessage('Error loading settings', 4000);
  }
}, 2000); 