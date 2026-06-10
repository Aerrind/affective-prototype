// background.js
chrome.runtime.onInstalled.addListener(async () => {
    await setupOffscreenDocument('offscreen.html');
});

async function setupOffscreenDocument(path) {
    const existingContexts = await chrome.runtime.getContexts({
        contextTypes: ['OFFSCREEN_DOCUMENT'],
        documentUrls: [chrome.runtime.getURL(path)]
    });

    if (existingContexts.length > 0) return;

    await chrome.offscreen.createDocument({
        url: path,
        reasons: ['USER_MEDIA'],
        justification: 'Tracks emotion to manage cognitive load UI.'
    });
}

// THE ROUTER: Robust tab targeted delivery
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("[Background] Received message:", message.type, "from", sender);
    
    if (message.type === 'TEPR_SPIKE' || message.type === 'TEPR_BASELINE') {
        // Explicitly isolate the active web tab in the user's view
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs || tabs.length === 0) {
                console.log("[Background] No active tabs found");
                return;
            }
            
            const activeTab = tabs[0];
            console.log("[Background] Active tab:", activeTab.url);
            
            // Safety guard: Don't send messages to internal chrome:// settings pages
            if (activeTab.id && activeTab.url && !activeTab.url.startsWith('chrome')) {
                console.log("[Background] Forwarding", message.type, "to tab", activeTab.id);
                chrome.tabs.sendMessage(activeTab.id, { type: message.type }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.log("[Background] Message delivery issue:", chrome.runtime.lastError.message);
                    } else {
                        console.log("[Background] Message delivered successfully");
                    }
                });
            } else {
                console.log("[Background] Skipping chrome:// or internal page");
            }
        });
    }
});