// content.js
(function() {
    let lastKnownMouseX = window.innerWidth / 2; 
    let lastKnownMouseY = window.innerHeight / 2;
    let isOverloaded = false;      
    let isSpotlightActive = false; 
    let currentSpotlightElement = null;

    const NOISE_SELECTORS = 'nav, aside, footer, iframe, .ads, [role="banner"], [role="complementary"]';

    // CONTINUOUS Wake Up Ping (Prevents Service Worker from sleeping!)
    setInterval(() => {
        try { chrome.runtime.sendMessage({ type: 'ENSURE_OFFSCREEN' }); } catch (e) {}
    }, 2500);

    // --- DUAL-DOT DASHBOARD ---
    const dashboardContainer = document.createElement('div');
    dashboardContainer.style.cssText = 'position:fixed; bottom:15px; left:15px; display:flex; align-items:center; gap:8px; z-index:2147483647; background:rgba(0,0,0,0.85); padding:8px 12px; border-radius:20px; font-family: monospace; color: white; border: 1px solid #444; box-shadow: 0 4px 12px rgba(0,0,0,0.3); pointer-events: none;';
    
    const emotionDot = document.createElement('div');
    emotionDot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:green; box-shadow:0 0 6px rgba(0,255,0,0.6); transition: background 0.2s;';
    
    const motionDot = document.createElement('div');
    motionDot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:#ffffff; box-shadow:0 0 6px rgba(255,255,255,0.4); transition: background 0.2s;';

    const statusText = document.createElement('span');
    statusText.innerText = "[V4] Mouse Active";
    statusText.style.cssText = 'font-size:11px; font-weight:bold; color:#aaa;';

    const telemetryText = document.createElement('span');
    telemetryText.innerText = "F: -- | S: -- | A: --";
    telemetryText.style.cssText = 'font-size:11px; font-weight:bold; color:#4ade80; margin-left: 8px; border-left: 1px solid #555; padding-left: 8px;';

    dashboardContainer.appendChild(emotionDot);
    dashboardContainer.appendChild(motionDot);
    dashboardContainer.appendChild(statusText);
    dashboardContainer.appendChild(telemetryText);
    
    // Attach to HTML root to guarantee it bypasses weird body tags
    document.documentElement.appendChild(dashboardContainer);

    // --- MOUSE TRACKING ---
    let countdownValue = 2.0;
    let countdownInterval = null;
    let movementTimeout = null;

    function resetMouseTimer(e) {
        lastKnownMouseX = e.clientX;
        lastKnownMouseY = e.clientY;

        motionDot.style.background = '#ffffff'; 
        motionDot.style.boxShadow = '0 0 6px rgba(255,255,255,0.4)';
        statusText.innerText = "[V4] Mouse Active";
        statusText.style.color = "#aaa";
        
        clearInterval(countdownInterval);
        clearTimeout(movementTimeout);
        countdownValue = 2.0;

        if (isSpotlightActive && !isOverloaded) resetUI();

        movementTimeout = setTimeout(() => { startCountdown(); }, 100);
    }

    function startCountdown() {
        statusText.innerText = `[V4] Idle: ${countdownValue.toFixed(1)}s`;
        statusText.style.color = "#00bfff";
        
        countdownInterval = setInterval(() => {
            countdownValue -= 0.1;
            
            if (countdownValue <= 0) {
                clearInterval(countdownInterval);
                countdownValue = 0;
                statusText.innerText = "[V4] SPOTLIGHT READY";
                statusText.style.color = "#eab308";
                motionDot.style.background = '#00bfff'; 
                motionDot.style.boxShadow = '0 0 10px #00bfff';

                if (isOverloaded) triggerSpotlightAt(lastKnownMouseX, lastKnownMouseY);
            } else {
                statusText.innerText = `[V4] Idle: ${countdownValue.toFixed(1)}s`;
            }
        }, 100);
    }

    document.addEventListener('mousemove', resetMouseTimer);

    // --- COMMUNICATION INTERFACE ---
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TEPR_TELEMETRY') {
            telemetryText.innerText = `F: ${message.fatigue} | S: ${message.sad} | A: ${message.angry}`;
            telemetryText.style.color = message.isSpike ? '#ff4a4a' : '#4ade80';
        }

        if (message.type === 'TEPR_SPIKE') {
            isOverloaded = true;
            emotionDot.style.background = 'red';
            emotionDot.style.boxShadow = '0 0 10px red';
            if (countdownValue === 0) triggerSpotlightAt(lastKnownMouseX, lastKnownMouseY);
        }
        
        if (message.type === 'TEPR_BASELINE') {
            isOverloaded = false;
            emotionDot.style.background = 'green';
            emotionDot.style.boxShadow = '0 0 6px rgba(0,255,0,0.6)';
            resetUI();
        }
    });

    function triggerSpotlightAt(x, y) {
        let element = document.elementFromPoint(x, y);
        if (!element) return;

        let container = element;
        while (container && container !== document.body && container !== document.documentElement) {
            const tag = container.tagName.toLowerCase();
            if (tag === 'p' || tag === 'article' || tag === 'section' || tag === 'div' || tag === 'main') {
                break; 
            }
            container = container.parentElement;
        }
        
        if (container && container !== document.body) {
            if (currentSpotlightElement === container) return;
            resetUI(); 

            currentSpotlightElement = container;
            container.classList.add('affective-spotlight');
            
            document.querySelectorAll(NOISE_SELECTORS).forEach(el => {
                if (!container.contains(el) && !el.contains(container)) {
                    el.classList.add('affective-suppression');
                }
            });
            
            isSpotlightActive = true;
        } else {
            if (currentSpotlightElement !== null) resetUI();
        }
    }

    function resetUI() {
        document.querySelectorAll('.affective-spotlight').forEach(el => el.classList.remove('affective-spotlight'));
        document.querySelectorAll('.affective-suppression').forEach(el => el.classList.remove('affective-suppression'));
        currentSpotlightElement = null;
        isSpotlightActive = false;
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            isOverloaded = false;
            emotionDot.style.background = 'green';
            resetUI();
        }
    });
})();