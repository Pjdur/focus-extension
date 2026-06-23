// blocked.js

const domainNameEl = document.getElementById('domain-name');
const timerDisplayEl = document.getElementById('timer-display');
const unblockEarlyBtn = document.getElementById('unblock-early-btn');

// Get domain from query parameter
const urlParams = new URLSearchParams(window.location.search);
let domain = urlParams.get('domain');

if (!domain) {
  domain = "distracting website";
}

domainNameEl.textContent = domain;

let timerInterval;

function updateCountdown() {
  chrome.storage.local.get(['blockedSites'], (result) => {
    const blockedSites = result.blockedSites || [];
    const site = blockedSites.find(s => s.domain === domain);
    
    if (!site) {
      // Not blocked anymore! Show completion and redirect.
      clearInterval(timerInterval);
      timerDisplayEl.textContent = "00:00";
      timerDisplayEl.style.color = "#14b8a6";
      document.querySelector('h1').textContent = "Focus Completed!";
      unblockEarlyBtn.style.display = "none";
      setTimeout(() => {
        window.location.href = `https://${domain}`;
      }, 1500);
      return;
    }
    
    const now = Date.now();
    const remainingMs = site.endTime - now;
    
    if (remainingMs <= 0) {
      clearInterval(timerInterval);
      timerDisplayEl.textContent = "00:00";
      chrome.runtime.sendMessage({ action: "unblockSite", domain: domain });
      return;
    }
    
    const totalSeconds = Math.ceil(remainingMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    const formattedMinutes = String(minutes).padStart(2, '0');
    const formattedSeconds = String(seconds).padStart(2, '0');
    
    timerDisplayEl.textContent = `${formattedMinutes}:${formattedSeconds}`;
  });
}

// Update immediately and then every second
updateCountdown();
timerInterval = setInterval(updateCountdown, 1000);

// Unblock early action
unblockEarlyBtn.addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: "unblockSite", domain: domain });
});

// Listen for state updates to immediately react
chrome.runtime.onMessage.addListener((request) => {
  if (request.action === "stateUpdated") {
    updateCountdown();
  }
});