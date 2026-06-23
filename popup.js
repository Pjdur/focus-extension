// popup.js

const domainInput = document.getElementById('domain-input');
const presetBtns = document.querySelectorAll('.preset-btn');
const startFocusBtn = document.getElementById('start-focus-btn');
const emptyState = document.getElementById('empty-state');
const blockList = document.getElementById('block-list');
const successAlert = document.getElementById('success-alert');
const errorAlert = document.getElementById('error-alert');

let selectedMinutes = 1; // Default to 1 min

// Handle preset buttons
presetBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    presetBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedMinutes = parseInt(btn.dataset.minutes, 10);
  });
});

// Helper to show alerts
function showAlert(type, message) {
  const targetAlert = type === 'success' ? successAlert : errorAlert;
  const otherAlert = type === 'success' ? errorAlert : successAlert;
  
  otherAlert.style.display = 'none';
  targetAlert.textContent = message;
  targetAlert.style.display = 'block';
  
  setTimeout(() => {
    targetAlert.style.display = 'none';
  }, 3500);
}

// Render active blocked sites
function renderBlockedSites() {
  chrome.runtime.sendMessage({ action: "getBlockedSites" }, (response) => {
    const blockedSites = (response && response.blockedSites) || [];
    
    if (blockedSites.length === 0) {
      emptyState.style.display = 'block';
      blockList.innerHTML = '';
      return;
    }
    
    emptyState.style.display = 'none';
    blockList.innerHTML = '';
    
    const now = Date.now();
    
    blockedSites.forEach(site => {
      const remainingMs = site.endTime - now;
      if (remainingMs <= 0) return; // skip expired items
      
      const totalSeconds = Math.ceil(remainingMs / 1000);
      const mins = Math.floor(totalSeconds / 60);
      const secs = totalSeconds % 60;
      const timeStr = mins > 0 ? `${mins}m ${secs}s left` : `${secs}s left`;
      
      const item = document.createElement('div');
      item.className = 'block-item';
      item.innerHTML = `
        <div class="block-info">
          <span class="block-domain" title="${site.domain}">${site.domain}</span>
          <span class="block-time">${timeStr}</span>
        </div>
        <button class="btn-delete" data-domain="${site.domain}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      `;
      
      // Delete listener
      item.querySelector('.btn-delete').addEventListener('click', (e) => {
        const domain = e.currentTarget.dataset.domain;
        chrome.runtime.sendMessage({ action: "unblockSite", domain: domain }, () => {
          renderBlockedSites();
        });
      });
      
      blockList.appendChild(item);
    });
  });
}

// Start focus session
startFocusBtn.addEventListener('click', () => {
  const domain = domainInput.value.trim();
  
  if (!domain) {
    showAlert('error', 'Please enter a website domain.');
    return;
  }
  
  chrome.runtime.sendMessage({
    action: "blockSite",
    domain: domain,
    minutes: selectedMinutes
  }, (response) => {
    if (response && response.success) {
      showAlert('success', response.message);
      domainInput.value = '';
      renderBlockedSites();
    } else {
      showAlert('error', (response && response.error) || 'Failed to block website.');
    }
  });
});

// Update list live
renderBlockedSites();
const updateInterval = setInterval(renderBlockedSites, 1000);

// Listen for updates from background
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "stateUpdated") {
    renderBlockedSites();
  }
});
