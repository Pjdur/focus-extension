// background.js

// Normalize user input to domain/host name
function normalizeDomain(input) {
  let domain = input.trim().toLowerCase();
  if (domain.includes("://")) {
    domain = domain.substring(domain.indexOf("://") + 3);
  }
  const firstSlash = domain.indexOf("/");
  if (firstSlash !== -1) {
    domain = domain.substring(0, firstSlash);
  }
  const firstQuestion = domain.indexOf("?");
  if (firstQuestion !== -1) {
    domain = domain.substring(0, firstQuestion);
  }
  const firstHash = domain.indexOf("#");
  if (firstHash !== -1) {
    domain = domain.substring(0, firstHash);
  }
  if (domain.startsWith("www.")) {
    domain = domain.substring(4);
  }
  return domain;
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['blockedSites', 'nextRuleId'], (result) => {
    if (!result.blockedSites) {
      chrome.storage.local.set({ blockedSites: [], nextRuleId: 1 });
    }
  });
});

// Alarm listener to lift block
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("unblock_")) {
    const domain = alarm.name.substring("unblock_".length);
    unblockSite(domain);
  }
});

// Function to unblock a site
function unblockSite(domain) {
  chrome.storage.local.get(['blockedSites'], (result) => {
    let blockedSites = result.blockedSites || [];
    const siteIndex = blockedSites.findIndex(s => s.domain === domain);

    if (siteIndex !== -1) {
      const site = blockedSites[siteIndex];

      // Remove rule from Declarative Net Request
      chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: [site.id]
      }, () => {
        if (chrome.runtime.lastError) {
          console.error("Error removing rule: ", chrome.runtime.lastError);
        } else {
          console.log(`Unblocked domain: ${domain}`);
        }

        // Remove from storage list
        blockedSites.splice(siteIndex, 1);
        chrome.storage.local.set({ blockedSites: blockedSites }, () => {
          // Notify popup and active tabs that state updated
          chrome.runtime.sendMessage({ action: "stateUpdated" }).catch(err => {
            // Ignore error if popup/tab is not listening
          });
        });
      });
    }
  });
}

// Function to block a site
function blockSite(domainInput, minutes, callback) {
  const domain = normalizeDomain(domainInput);
  if (!domain) {
    if (callback) callback({ success: false, error: "Invalid domain name" });
    return;
  }

  chrome.storage.local.get(['blockedSites', 'nextRuleId'], (result) => {
    let blockedSites = result.blockedSites || [];
    let nextRuleId = result.nextRuleId || 1;

    // Check if already blocked
    const existingIndex = blockedSites.findIndex(s => s.domain === domain);
    const durationMs = minutes * 60 * 1000;
    const endTime = Date.now() + durationMs;

    if (existingIndex !== -1) {
      // Just update endTime and reset alarm
      blockedSites[existingIndex].endTime = endTime;
      chrome.storage.local.set({ blockedSites: blockedSites }, () => {
        chrome.alarms.create(`unblock_${domain}`, { delayInMinutes: minutes });
        chrome.runtime.sendMessage({ action: "stateUpdated" }).catch(() => { });
        if (callback) callback({ success: true, message: `Updated focus timer for ${domain}` });
      });
      return;
    }

    const ruleId = nextRuleId;
    nextRuleId++;
    
    const redirectUrl = chrome.runtime.getURL(`blocked.html?domain=${encodeURIComponent(domain)}`);

    const newRule = {
      id: ruleId,
      priority: 1,
      action: {
        type: 'redirect',
        // 1. Back to your original method!
        redirect: { url: redirectUrl }
      },
      condition: {
        // 2. Keep the '||' anchor to prevent the infinite loop!
        urlFilter: `||${domain}`,
        resourceTypes: ['main_frame']
      }
    };

    chrome.declarativeNetRequest.updateDynamicRules({
      addRules: [newRule]
    }, () => {
      if (chrome.runtime.lastError) {
        console.error("Error updating rules: ", chrome.runtime.lastError);
        if (callback) callback({ success: false, error: chrome.runtime.lastError.message });
        return;
      }

      blockedSites.push({
        domain: domain,
        id: ruleId,
        endTime: endTime
      });

      chrome.storage.local.set({
        blockedSites: blockedSites,
        nextRuleId: nextRuleId
      }, () => {
        // Set alarm
        chrome.alarms.create(`unblock_${domain}`, { delayInMinutes: minutes });

        // Notify of state update
        chrome.runtime.sendMessage({ action: "stateUpdated" }).catch(() => { });

        if (callback) callback({ success: true, message: `Successfully blocked ${domain}` });
      });
    });
  });
}

// Handle messages
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "blockSite") {
    blockSite(request.domain, request.minutes, sendResponse);
    return true; // async response
  } else if (request.action === "unblockSite") {
    unblockSite(request.domain);
    sendResponse({ success: true });
  } else if (request.action === "getBlockedSites") {
    chrome.storage.local.get(['blockedSites'], (result) => {
      sendResponse({ blockedSites: result.blockedSites || [] });
    });
    return true;
  }
});

// Re-register alarms on startup in case service worker was cold-started
chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.get(['blockedSites'], (result) => {
    const blockedSites = result.blockedSites || [];
    const now = Date.now();

    blockedSites.forEach(site => {
      const remainingMs = site.endTime - now;
      if (remainingMs <= 0) {
        unblockSite(site.domain);
      } else {
        // Recreate the alarm for remaining duration
        const delayInMinutes = remainingMs / (60 * 1000);
        chrome.alarms.create(`unblock_${site.domain}`, { delayInMinutes: delayInMinutes });
      }
    });
  });
});
