// options.js

// Establish the physical port wire to the background script
const lifecyclePort = chrome.runtime.connect({ name: 'options-lifecycle' });
let activeStream = null;

window.addEventListener('beforeunload', () => {
    if (activeStream) activeStream.getTracks().forEach(t => t.stop());
});

document.getElementById('request-cam').addEventListener('click', async () => {
    document.getElementById('status-box').innerText = "Requesting permission...";
    document.getElementById('status-box').style.color = "#eab308";
    
    try {
        activeStream = await navigator.mediaDevices.getUserMedia({ video: true });
        
        const video = document.getElementById('webcam');
        video.srcObject = activeStream;
        video.style.display = "inline-block";
        
        document.getElementById('status-box').innerText = "SUCCESS! Camera permission granted.\nClose this tab completely and refresh your normal websites to see the tracker.";
        document.getElementById('status-box').style.color = "#4ade80";

    } catch (err) {
        document.getElementById('status-box').innerText = "Error: Camera access denied. Click the lock icon in the URL bar to allow it.";
        document.getElementById('status-box').style.color = "#ff4a4a";
    }
});