// blocked.js

const domainNameEl = document.getElementById('domain-name');
const timerDisplayEl = document.getElementById('timer-display');
const unblockEarlyBtn = document.getElementById('unblock-early-btn');
const quoteTextEl = document.getElementById('quote-text');
const quoteAuthorEl = document.getElementById('quote-author');

const quotes = [
  { text: "Concentrate all your thoughts upon the work at hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { text: "Your focus determines your reality.", author: "Qui-Gon Jinn" },
  { text: "Focus is a matter of deciding what things you're not going to do.", author: "John Carmack" },
  { text: "It is during our darkest moments that we must focus to see the light.", author: "Aristotle" },
  { text: "Keep your attention focused entirely on what is truly your own concern.", author: "Epictetus" },
  { text: "Deep work is the superpower of the 21st century.", author: "Cal Newport" }
];

// Display a random quote
const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
quoteTextEl.textContent = `"${randomQuote.text}"`;
quoteAuthorEl.textContent = `- ${randomQuote.author}`;

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
