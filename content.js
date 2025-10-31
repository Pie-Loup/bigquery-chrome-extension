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
    
    // Start monitoring button state changes for icon updates
    this.startButtonStateMonitoring(button);
    
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
    
    // Multi-language run button text mappings
    const runTextMappings = {
      'en': { base: 'run', current: 'Run current', all: 'Run all' },
      'fr': { base: 'exécuter', current: 'Exécuter actuel', all: 'Exécuter tout' },
      'es': { base: 'ejecutar', current: 'Ejecutar actual', all: 'Ejecutar todo' },
      'de': { base: 'ausführen', current: 'Aktuell ausführen', all: 'Alles ausführen' },
      'it': { base: 'eseguire', current: 'Eseguire corrente', all: 'Eseguire tutto' },
      'pt': { base: 'executar', current: 'Executar atual', all: 'Executar tudo' },
      'nl': { base: 'uitvoeren', current: 'Huidige uitvoeren', all: 'Alles uitvoeren' },
      'pl': { base: 'wykonaj', current: 'Wykonaj bieżący', all: 'Wykonaj wszystko' },
      'ru': { base: 'выполнить', current: 'Выполнить текущий', all: 'Выполнить все' },
      'ja': { base: '実行', current: '現在実行', all: 'すべて実行' },
      'ko': { base: '실행', current: '현재 실행', all: '모두 실행' },
      'zh': { base: '运行', current: '运行当前', all: '运行全部' },
      'zh-tw': { base: '執行', current: '執行目前', all: '執行全部' },
      'ar': { base: 'تشغيل', current: 'تشغيل الحالي', all: 'تشغيل الكل' }
    };
    
    // Detect language based on original text
    let detectedLang = 'en'; // default
    const lowerOriginalText = originalText.toLowerCase().trim();
    
    for (const [lang, mapping] of Object.entries(runTextMappings)) {
      if (lowerOriginalText.includes(mapping.base.toLowerCase())) {
        detectedLang = lang;
        break;
      }
    }
    
    // Determine new text based on mode and detected language
    let newText;
    const mapping = runTextMappings[detectedLang];
    
    if (this.singleQueryMode) {
      newText = mapping.current;
    } else {
      newText = mapping.all;
    }
    
    // Preserve original casing and formatting if it was different
    if (originalText !== originalText.toLowerCase()) {
      // If original had special casing, try to preserve first letter case
      if (originalText[0] === originalText[0].toUpperCase()) {
        newText = newText.charAt(0).toUpperCase() + newText.slice(1);
      }
    }
    
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
    
    // Clone and store icons with their original styles and context
    svgIcons.forEach(icon => {
      const clonedIcon = icon.cloneNode(true);
      
      // Get the computed color from the original icon in its context
      const originalIconStyles = getComputedStyle(icon);
      const computedFill = originalIconStyles.fill;
      const computedColor = originalIconStyles.color;
      
      // Preserve original classes and attributes for CSS inheritance
      if (icon.className) {
        // Handle SVG elements which have read-only className
        try {
          if (icon instanceof SVGElement) {
            // For SVG elements, copy classList manually
            if (icon.classList && icon.classList.length > 0) {
              Array.from(icon.classList).forEach(cls => {
                clonedIcon.classList.add(cls);
              });
            }
          } else {
            clonedIcon.className = icon.className;
          }
        } catch (e) {
          // Fallback: copy class attribute directly
          const classAttr = icon.getAttribute('class');
          if (classAttr) {
            clonedIcon.setAttribute('class', classAttr);
          }
        }
      }
      
      // Copy all original attributes that might affect styling
      Array.from(icon.attributes).forEach(attr => {
        if (attr.name !== 'style') { // Don't copy inline styles, we'll handle those separately
          clonedIcon.setAttribute(attr.name, attr.value);
        }
      });
      
      // Apply spacing and positioning
      clonedIcon.style.marginRight = '6px';
      clonedIcon.style.verticalAlign = 'middle';
      clonedIcon.style.display = 'inline-block';
      
      // Check if button is actually disabled
      const isButtonDisabled = button.disabled || 
                               button.hasAttribute('aria-disabled') ||
                               button.classList.contains('mat-mdc-button-disabled') ||
                               button.classList.contains('cm-disabled') ||
                               button.getAttribute('aria-disabled') === 'true';
      
      if (isButtonDisabled) {
        // Button is disabled - keep the disabled/grey color
        if (computedFill && computedFill !== 'none' && computedFill !== 'rgba(0, 0, 0, 0)') {
          clonedIcon.style.fill = computedFill;
        } else if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)') {
          clonedIcon.style.fill = computedColor;
        } else {
          // Fallback to standard disabled color
          clonedIcon.style.fill = 'rgba(60, 64, 67, 0.38)';
        }
      } else {
        // Button is enabled - use proper active colors
        const isDisabledColor = computedFill && (
          computedFill.includes('0.38') ||  // Common disabled opacity
          computedFill.includes('rgba(60, 64, 67, 0.38)') || // Google Material disabled color
          computedFill === 'rgb(60, 64, 67)' // Grey color
        );
        
        if (computedFill && computedFill !== 'none' && computedFill !== 'rgba(0, 0, 0, 0)' && !isDisabledColor) {
          clonedIcon.style.fill = computedFill;
        } else if (computedColor && computedColor !== 'rgba(0, 0, 0, 0)' && !computedColor.includes('0.38')) {
          clonedIcon.style.fill = computedColor;
        } else {
          // Use button's active text color or force white for primary buttons
          const buttonStyles = getComputedStyle(button);
          const buttonColor = buttonStyles.color;
          
          // For primary buttons or buttons with primary class, force white
          if (button.classList.contains('mat-primary') || 
              button.getAttribute('color') === 'primary' ||
              buttonStyles.backgroundColor.includes('rgb(66, 133, 244)')) { // Google blue
            clonedIcon.style.fill = 'white';
          } else if (buttonColor && buttonColor !== 'rgba(0, 0, 0, 0)') {
            clonedIcon.style.fill = buttonColor;
          } else {
            clonedIcon.style.fill = 'currentColor';
          }
        }
      }
      
      // For SVG, ensure path elements inherit the correct color
      if (clonedIcon.tagName === 'svg') {
        const paths = clonedIcon.querySelectorAll('path');
        paths.forEach(path => {
          if (!isButtonDisabled) {
            // Button is enabled - remove any existing grey/disabled fill styles
            if (path.style.fill && (path.style.fill.includes('0.38') || path.style.fill === 'currentcolor')) {
              path.style.fill = '';
            }
          }
          
          // If path doesn't have explicit fill, make it inherit from svg
          const pathFill = path.getAttribute('fill');
          if (!pathFill || pathFill === 'currentColor' || pathFill === 'currentcolor') {
            path.style.fill = 'inherit';
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

  startButtonStateMonitoring(button) {
    // Avoid multiple observers on the same button
    if (button.dataset.stateMonitoring) {
      return;
    }
    button.dataset.stateMonitoring = 'true';
    
    // Store initial state
    let lastDisabledState = this.isButtonDisabled(button);
    
    // Create mutation observer to watch for state changes
    const observer = new MutationObserver((mutations) => {
      let stateChanged = false;
      
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          const attributeName = mutation.attributeName;
          // Watch for changes in disabled-related attributes
          if (attributeName === 'disabled' || 
              attributeName === 'aria-disabled' || 
              attributeName === 'class') {
            stateChanged = true;
          }
        }
      });
      
      if (stateChanged) {
        const currentDisabledState = this.isButtonDisabled(button);
        if (currentDisabledState !== lastDisabledState) {
          this.updateButtonIconState(button);
          lastDisabledState = currentDisabledState;
        }
      }
    });
    
    // Start observing
    observer.observe(button, {
      attributes: true,
      attributeFilter: ['disabled', 'aria-disabled', 'class']
    });
    
    // Store observer reference for cleanup
    button._stateObserver = observer;
  }

  isButtonDisabled(button) {
    return button.disabled || 
           button.hasAttribute('aria-disabled') ||
           button.classList.contains('mat-mdc-button-disabled') ||
           button.classList.contains('cm-disabled') ||
           button.getAttribute('aria-disabled') === 'true';
  }

  updateButtonIconState(button) {
    // Find the icon in the button
    const icon = button.querySelector('svg[data-icon-name="playIcon"]');
    if (!icon) return;
    
    const isDisabled = this.isButtonDisabled(button);
    
    if (isDisabled) {
      // Button is disabled - set grey color
      icon.style.fill = 'rgba(60, 64, 67, 0.38)';
    } else {
      // Button is enabled - set white color for primary buttons
      const buttonStyles = getComputedStyle(button);
      if (button.classList.contains('mat-primary') || 
          button.getAttribute('color') === 'primary' ||
          buttonStyles.backgroundColor.includes('rgb(66, 133, 244)')) {
        icon.style.fill = 'white';
      } else {
        icon.style.fill = 'currentColor';
      }
    }
    
    // Also update path elements
    const paths = icon.querySelectorAll('path');
    paths.forEach(path => {
      path.style.fill = 'inherit';
    });
  }

  updateAllRunButtons() {
    // Update all intercepted Run buttons
    const interceptedButtons = document.querySelectorAll('[data-smart-execute-intercepted="true"]');
    
    interceptedButtons.forEach(button => {
      this.updateRunButtonText(button);
    });
    
    // Always try to find and update current Run button (in case interception is slow)
    const currentRunButton = this.findRunButton(true); // Silent mode - only log when successful
    if (currentRunButton) {
      this.updateRunButtonText(currentRunButton);
      
      // If this button isn't intercepted yet, intercept it now
      if (!currentRunButton.dataset.smartExecuteIntercepted) {
        this.findAndInterceptRunButton();
      }
    } else {
      // Retry after a short delay in case the UI is still loading
      setTimeout(() => {
        const retryButton = this.findRunButton(true); // Silent mode for retry
        if (retryButton) {
          this.updateRunButtonText(retryButton);
          this.findAndInterceptRunButton();
        }
      }, 1000);
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
    // Use the external QueryDetection module
    return QueryDetection.findCurrentQueryInText(text, cursorPosition);
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
    
    // Priority 1: Use BigQuery's language-independent attributes (most reliable)
    const reliableSelectors = [
      // BigQuery instrumentation ID - most reliable across all languages
      'cfc-progress-button[instrumentationid="bq-run-query-button"] button',
      '[instrumentationid="bq-run-query-button"] button',
      
      // BigQuery test class - reliable for testing environments
      'button.bqui-test-run-query',
      '.bqui-test-run-query',
      
      // BigQuery component classes
      '.cfc-shared-query-run-button button',
      'cfc-progress-button.cfc-shared-query-run-button button',
      
      // Combination of BigQuery classes
      'button.bqui-test-run-query.mat-primary',
      'button[class*="bqui-test-run-query"]',
      
      // Additional fallback selectors
      'button[jslog="100338"]', // BigQuery specific jslog attribute
      'button[cfciamcheck="bigquery.jobs.create"]' // BigQuery IAM check attribute
    ];
    
    for (const selector of reliableSelectors) {
      const button = document.querySelector(selector);
      if (button && button.offsetParent !== null) { // Check that button is visible
        return button;
      } else if (button) {
      }
    }
    
    // Priority 2: Search by BigQuery's play icon (language-independent visual cue)
    const playIconSelectors = [
      // BigQuery uses specific play icon with data-icon-name
      'svg[data-icon-name="playIcon"]',
      'cm-icon svg[data-icon-name="playIcon"]'
    ];
    
    for (const selector of playIconSelectors) {
      const icon = document.querySelector(selector);
      if (icon) {
        // Find the parent button
        const button = icon.closest('button') || icon.closest('[role="button"]');
        if (button && button.offsetParent !== null) {
          return button;
        } else if (button) {
        }
      }
    }
    
    // Priority 3: Search by structural context (BigQuery toolbar structure)
    const structuralSelectors = [
      // Look for buttons in BigQuery's action bar with Material Design classes
      '.cfc-action-bar-content-main button.mat-primary[color="primary"]',
      'mat-toolbar button.mat-primary.mdc-button--unelevated',
      '.cfc-action-bar-toolbar-container button.mat-primary',
      // Additional structural patterns
      '.cfc-action-bar-content-main button[color="primary"]',
      'mat-toolbar button[color="primary"]'
    ];
    
    for (const selector of structuralSelectors) {
      const buttons = document.querySelectorAll(selector);
      for (const button of buttons) {
        // Check if this button has a play icon
        const hasPlayIcon = button.querySelector('svg[data-icon-name="playIcon"]');
        if (hasPlayIcon && button.offsetParent !== null) {
          return button;
        }
      }
    }
    
    // Priority 4: Multi-language text fallback (as last resort)
    const runTexts = {
      'en': ['run', 'execute'],
      'fr': ['exécuter', 'executer', 'lancer'],
      'es': ['ejecutar', 'ejecute', 'correr'],
      'de': ['ausführen', 'ausfuhren', 'laufen'],
      'it': ['eseguire', 'esegui', 'correre'],
      'pt': ['executar', 'execute', 'correr'],
      'nl': ['uitvoeren', 'voer uit', 'draaien'],
      'pl': ['wykonaj', 'uruchom', 'wykonać'],
      'ru': ['выполнить', 'запустить', 'выполни'],
      'ja': ['実行', '実行する', 'じっこう'],
      'ko': ['실행', '실행하다', '수행'],
      'zh': ['运行', '执行', '運行'],
      'zh-tw': ['執行', '運行', '執行'],
      'ar': ['تشغيل', 'تنفيذ', 'يركض']
    };
    
    const allRunTexts = Object.values(runTexts).flat();
    
    const buttons = document.querySelectorAll('button, [role="button"], .mdc-button');
    for (const button of buttons) {
      const text = (button.textContent || button.innerText || '').toLowerCase().trim();
      const ariaLabel = (button.getAttribute('aria-label') || '').toLowerCase();
      const title = (button.getAttribute('title') || '').toLowerCase();
      
      // Check if any of the run texts match
      const textMatches = allRunTexts.some(runText => 
        text.includes(runText.toLowerCase()) || 
        ariaLabel.includes(runText.toLowerCase()) || 
        title.includes(runText.toLowerCase())
      );
      
      if (textMatches && button.offsetParent !== null) {
        // Additional validation: should be in a toolbar or have primary styling
        const isInToolbar = button.closest('mat-toolbar, .cfc-action-bar, [role="toolbar"]');
        const isPrimary = button.classList.contains('mat-primary') || 
                         button.classList.contains('primary') ||
                         button.getAttribute('color') === 'primary';
        
        if (isInToolbar || isPrimary) {
          
          return button;
        }
      }
    }
    
    // Final fallback: Look for any button with play icon, regardless of structure
    const allPlayIcons = document.querySelectorAll('svg[data-icon-name="playIcon"]');
    
    for (const icon of allPlayIcons) {
      const button = icon.closest('button');
      if (button && button.offsetParent !== null) {
        return button;
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
    z-index: 1000;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s;
  }
  
  .bq-smart-execute-indicator.show {
    opacity: 1;
    pointer-events: auto;
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
  
  // Clear any existing timeout
  if (indicator.hideTimeout) {
    clearTimeout(indicator.hideTimeout);
  }
  
  // Set new timeout to hide
  indicator.hideTimeout = setTimeout(() => {
    indicator.classList.remove('show');
    
    // Clean up the element after transition completes
    setTimeout(() => {
      if (indicator && indicator.parentNode && !indicator.classList.contains('show')) {
        indicator.parentNode.removeChild(indicator);
      }
    }, 500); // Wait for transition to complete
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