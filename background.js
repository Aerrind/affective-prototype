// background.js

let isOptionsOpen = false;

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

async function setupOffscreen() {
    if (isOptionsOpen) return; // Will not boot if Options tab holds the hardware lock
    
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL('offscreen.html')]
    });
    
    if (existingContexts.length > 0) return;

    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'Emotion tracking'
        });
    } catch (err) {}
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'PING') {
        setupOffscreen();
        sendResponse({ status: "alive" });
        return false;
    }
    
    if (msg.type === 'TEPR_TELEMETRY' || msg.type === 'TEPR_SPIKE' || msg.type === 'TEPR_BASELINE') {
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                // Route the AI data exclusively to regular websites
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
                    chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
                }
            }
        });
    }
    
    return true;
});

// THE FIX: Bulletproof hardware lock manager
chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'options-lifecycle') {
        isOptionsOpen = true;
        chrome.offscreen.closeDocument().catch(() => {}); // Kill background AI
        
        port.onDisconnect.addListener(() => {
            isOptionsOpen = false;
            setupOffscreen(); // Reboot background AI the millisecond the tab closes
        });
    }
});

chrome.runtime.onStartup.addListener(setupOffscreen);
chrome.runtime.onInstalled.addListener(setupOffscreen);