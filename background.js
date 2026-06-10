// background.js

let creatingLock;

// Allow left-clicking the extension icon to open the Options Dashboard immediately
chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

async function hasOffscreenDocument(path) {
    const offscreenUrl = chrome.runtime.getURL(path);
    if (chrome.runtime.getContexts) {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT'],
            documentUrls: [offscreenUrl]
        });
        return contexts.length > 0;
    } else {
        const matchedClients = await clients.matchAll();
        for (const client of matchedClients) {
            if (client.url === offscreenUrl) return true;
        }
        return false;
    }
}

async function setupOffscreen() {
    const path = 'offscreen.html';
    if (creatingLock) {
        await creatingLock;
        return;
    }

    const exists = await hasOffscreenDocument(path);
    if (exists) return;

    try {
        creatingLock = chrome.offscreen.createDocument({
            url: path,
            reasons: ['USER_MEDIA'],
            justification: 'Tracks emotion to manage cognitive load UI.'
        });
        await creatingLock;
    } catch (err) {
        if (!err.message.includes('already created') && !err.message.includes('single offscreen document')) {
            console.error("[Background] Offscreen creation error:", err);
        }
    } finally {
        creatingLock = null;
    }
}

chrome.runtime.onInstalled.addListener(setupOffscreen);
chrome.runtime.onStartup.addListener(setupOffscreen);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ENSURE_OFFSCREEN') {
        setupOffscreen();
    }
    if (message.type === 'TEPR_SPIKE' || message.type === 'TEPR_BASELINE') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && !tabs[0].url.startsWith('chrome')) {
                chrome.tabs.sendMessage(tabs[0].id, { type: message.type }).catch(() => {});
            }
        });
    }
});