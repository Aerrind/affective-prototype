// background.js

let isOptionsPageOpen = false;

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

async function setupOffscreen() {
    if (isOptionsPageOpen) return;
    
    // Safest way to handle offscreen creation in MV3
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['USER_MEDIA'],
            justification: 'Emotion Tracking'
        });
    } catch (err) {
        // If it throws an error saying "Only a single offscreen document may be created", ignore it! That means it's working.
    }
}

chrome.runtime.onInstalled.addListener(setupOffscreen);
chrome.runtime.onStartup.addListener(setupOffscreen);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ENSURE_OFFSCREEN' || message.type === 'RESUME_CAMERA') {
        setupOffscreen();
        sendResponse({status: "ok"});
    }
    
    if (message.type === 'PAUSE_CAMERA') {
        chrome.offscreen.closeDocument().catch(() => {});
    }
    
    if (message.type === 'TEPR_SPIKE' || message.type === 'TEPR_BASELINE' || message.type === 'TEPR_TELEMETRY') {
        // BROADCAST to all valid tabs. This prevents the "DevTools open" routing failure.
        chrome.tabs.query({}, (tabs) => {
            for (let tab of tabs) {
                if (tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
                    chrome.tabs.sendMessage(tab.id, message).catch(() => {});
                }
            }
        });
    }
    return true; // Keep channel open
});

chrome.runtime.onConnect.addListener((port) => {
    if (port.name === 'options-lifecycle') {
        isOptionsPageOpen = true; 
        chrome.offscreen.closeDocument().catch(() => {});
        port.onDisconnect.addListener(() => {
            isOptionsPageOpen = false; 
            setupOffscreen();
        });
    }
});