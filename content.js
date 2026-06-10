// content.js
(function() {
    // 1. Keep Background Awake
    setInterval(() => {
        try { chrome.runtime.sendMessage({ type: 'PING' }); } catch(e){}
    }, 2000);

    // 2. Build the UI
    const ui = document.createElement('div');
    ui.style.cssText = 'position:fixed; bottom:20px; left:20px; display:flex; gap:10px; z-index:2147483647; background:rgba(0,0,0,0.9); padding:12px 18px; border-radius:8px; font-family:monospace; color:#fff; border:1px solid #555; pointer-events:none; align-items:center;';
    
    const dot = document.createElement('div');
    dot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:gray; box-shadow:0 0 8px gray;';
    
    const text = document.createElement('div');
    text.innerText = "[V5] Waiting for AI...";
    text.style.fontWeight = "bold";

    ui.appendChild(dot);
    ui.appendChild(text);
    document.documentElement.appendChild(ui);

    // 3. Receive Data
    chrome.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'TEPR_TELEMETRY') {
            text.innerText = `F: ${msg.fatigue} | S: ${msg.sad} | A: ${msg.angry}`;
            
            if (msg.fatigue === 'CAM' || msg.fatigue === 'MDL') {
                text.style.color = "#ff4a4a";
                dot.style.background = "red";
                dot.style.boxShadow = "0 0 8px red";
            } else if (msg.isSpike) {
                text.style.color = "#eab308";
                dot.style.background = "#eab308";
                dot.style.boxShadow = "0 0 12px #eab308";
            } else {
                text.style.color = "#4ade80";
                dot.style.background = "green";
                dot.style.boxShadow = "0 0 8px green";
            }
        }
    });
})();