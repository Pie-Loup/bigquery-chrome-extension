// Script for the extension popup
document.addEventListener('DOMContentLoaded', function() {
  checkBigQueryStatus();
  loadSettings();
  setupToggle();
});

async function checkBigQueryStatus() {
  const statusDiv = document.getElementById('status');
  
  try {
    // Get current tab
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
    
    if (tab.url && tab.url.includes('console.cloud.google.com/bigquery')) {
      statusDiv.textContent = 'Active on BigQuery ✓';
      statusDiv.className = 'status active';
    } else {
      statusDiv.textContent = 'Not active - Open BigQuery';
      statusDiv.className = 'status inactive';
    }
  } catch (error) {
    statusDiv.textContent = 'Verification error';
    statusDiv.className = 'status inactive';
  }
}

async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get(['singleQueryMode']);
    const singleQueryToggle = document.getElementById('singleQueryToggle');
    
    // By default, single query mode is enabled
    const singleQueryMode = result.singleQueryMode !== undefined ? result.singleQueryMode : true;
    
    singleQueryToggle.checked = singleQueryMode;
    
    updateToggleDescription(singleQueryMode);
  } catch (error) {
    console.error('Error loading settings:', error);
  }
}

function setupToggle() {
  const singleQueryToggle = document.getElementById('singleQueryToggle');
  
  singleQueryToggle.addEventListener('change', async function() {
    const isEnabled = singleQueryToggle.checked;
    
    try {
      // Save preference
      await chrome.storage.sync.set({ singleQueryMode: isEnabled });
      
      // Update description
      updateToggleDescription(isEnabled);
      
      // Notify content script of change
      const [tab] = await chrome.tabs.query({active: true, currentWindow: true});
      if (tab.url && tab.url.includes('console.cloud.google.com/bigquery')) {
        chrome.tabs.sendMessage(tab.id, {
          action: 'updateSingleQueryMode',
          enabled: isEnabled
        });
      }
      
      console.log('Single query mode:', isEnabled ? 'enabled' : 'disabled');
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  });
}

function updateToggleDescription(singleQueryEnabled) {
  // Find Single Query description
  const toggleContainers = document.querySelectorAll('.toggle-container');
  let singleQueryDescription = null;
  
  // Find the correct description by checking the label text
  toggleContainers.forEach(container => {
    const label = container.querySelector('.toggle-label strong');
    const description = container.querySelector('.toggle-description');
    
    if (label && description && label.textContent.includes('Single Query')) {
      singleQueryDescription = description;
    }
  });
  
  // Update Single Query description
  if (singleQueryDescription) {
    if (singleQueryEnabled) {
      singleQueryDescription.textContent = 'Automatic detection of query under cursor';
      singleQueryDescription.style.color = '#137333';
    } else {
      singleQueryDescription.textContent = 'Execute all content (unless manual selection)';
      singleQueryDescription.style.color = '#d93025';
    }
  } else {
    console.warn('Single Query description element not found');
  }
} 