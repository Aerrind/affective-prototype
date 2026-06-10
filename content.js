// content.js
(function() {
    let lastKnownMouseX = window.innerWidth / 2;
    let lastKnownMouseY = window.innerHeight / 2;
    let isOverloaded = false;
    let isSpotlightActive = false;
    let currentSpotlightElement = null;

    const NOISE_SELECTORS = 'nav, aside, footer, iframe, .ads, [role="banner"], [role="complementary"]';
    
    // Set strictly to 4 seconds based on decision fatigue research
    const IDLE_THRESHOLD = 4.0; 

    // Keep Background Awake
    setInterval(() => {
        try { chrome.runtime.sendMessage({ type: 'PING' }); } catch (e) {}
    }, 2500);

    // --- ACADEMIC TELEMETRY DASHBOARD ---
    const dashboard = document.createElement('div');
    dashboard.style.cssText = 'position:fixed; bottom:20px; left:20px; z-index:2147483647; background:rgba(15, 23, 42, 0.95); padding:15px; border-radius:12px; font-family: "Courier New", monospace; color: #e2e8f0; border: 1px solid #334155; box-shadow: 0 10px 25px rgba(0,0,0,0.5); pointer-events: none; min-width: 280px; display: flex; flex-direction: column; gap: 8px;';

    // Title
    const title = document.createElement('div');
    title.innerHTML = '<strong style="color:#38bdf8; font-size: 13px;">[ Cognitive Load Telemetry ]</strong>';
    title.style.borderBottom = '1px solid #334155';
    title.style.paddingBottom = '6px';
    title.style.marginBottom = '4px';

    // 1. AI Status (Detection of Emotions)
    const aiStatusRow = document.createElement('div');
    aiStatusRow.style.fontSize = '12px';
    aiStatusRow.innerHTML = 'Detection: <span id="dash-ai" style="color:#facc15; font-weight:bold;">Initializing AI...</span>';

    // 2. Mouse Idle Timer
    const idleRow = document.createElement('div');
    idleRow.style.fontSize = '12px';
    idleRow.innerHTML = 'Mouse Idle: <span id="dash-idle" style="color:#94a3b8; font-weight:bold;">0.0s</span> <span style="color:#64748b;">/ 4.0s</span>';

    // 3. Fatigue Score
    const fatigueRow = document.createElement('div');
    fatigueRow.style.fontSize = '12px';
    fatigueRow.innerHTML = 'Fatigue Load: <span id="dash-fatigue" style="color:#94a3b8; font-weight:bold;">0.00</span> <span style="color:#64748b;">/ 0.40 (Spike Threshold)</span>';

    // 4. Raw Emotions
    const emotionsRow = document.createElement('div');
    emotionsRow.style.fontSize = '12px';
    emotionsRow.innerHTML = 'Emotions: <span id="dash-emotions" style="color:#94a3b8; font-weight:bold;">S: 0.00 | A: 0.00</span>';

    // Append all UI elements to the dashboard
    dashboard.appendChild(title);
    dashboard.appendChild(aiStatusRow);
    dashboard.appendChild(idleRow);
    dashboard.appendChild(fatigueRow);
    dashboard.appendChild(emotionsRow);

    document.documentElement.appendChild(dashboard);

    // DOM references for rapid updating
    const dashAi = dashboard.querySelector('#dash-ai');
    const dashIdle = dashboard.querySelector('#dash-idle');
    const dashFatigue = dashboard.querySelector('#dash-fatigue');
    const dashEmotions = dashboard.querySelector('#dash-emotions');

    // --- MOUSE TRACKING ENGINE ---
    let countdownValue = IDLE_THRESHOLD;
    let countdownInterval = null;
    let movementTimeout = null;

    function resetMouseTimer(e) {
        lastKnownMouseX = e.clientX;
        lastKnownMouseY = e.clientY;

        dashIdle.innerText = "0.0s";
        dashIdle.style.color = "#94a3b8";

        clearInterval(countdownInterval);
        clearTimeout(movementTimeout);
        countdownValue = IDLE_THRESHOLD;

        if (isSpotlightActive && !isOverloaded) resetUI();

        movementTimeout = setTimeout(() => { startCountdown(); }, 100);
    }

    function startCountdown() {
        dashIdle.innerText = `${countdownValue.toFixed(1)}s`;
        dashIdle.style.color = "#38bdf8";

        countdownInterval = setInterval(() => {
            countdownValue -= 0.1;

            if (countdownValue <= 0) {
                clearInterval(countdownInterval);
                countdownValue = 0;
                dashIdle.innerText = "READY";
                dashIdle.style.color = "#facc15";

                // Trigger Spotlight if both variables (Idle + High Fatigue) are met
                if (isOverloaded) triggerSpotlightAt(lastKnownMouseX, lastKnownMouseY);
            } else {
                dashIdle.innerText = `${countdownValue.toFixed(1)}s`;
            }
        }, 100);
    }

    document.addEventListener('mousemove', resetMouseTimer);

    // --- AI COMMUNICATION INTERFACE ---
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TEPR_TELEMETRY') {
            
            // Handle specific UI states based on AI telemetry
            if (message.fatigue === 'CAM') {
                dashAi.innerText = "Camera Blocked";
                dashAi.style.color = "#f87171";
                dashFatigue.innerText = "--";
                dashEmotions.innerText = "--";
            } else if (message.fatigue === 'MDL') {
                dashAi.innerText = "Model Error";
                dashAi.style.color = "#f87171";
                dashFatigue.innerText = "--";
                dashEmotions.innerText = "--";
            } else if (message.fatigue === '0.00' && message.sad === '0.00' && !message.isSpike) {
                dashAi.innerText = "No Face Detected";
                dashAi.style.color = "#f87171";
                dashFatigue.innerText = "0.00";
                dashEmotions.innerText = "S: 0.00 | A: 0.00";
            } else {
                dashAi.innerText = "Active & Tracking";
                dashAi.style.color = "#4ade80";
                dashFatigue.innerText = message.fatigue;
                dashEmotions.innerText = `Sadness: ${message.sad} | Anger: ${message.angry}`;

                // Visually emphasize when fatigue crosses the threshold
                if (message.isSpike) {
                    dashFatigue.style.color = "#f87171"; // Red alert color
                } else {
                    dashFatigue.style.color = "#4ade80"; // Safe green color
                }
            }
        }

        if (message.type === 'TEPR_SPIKE') {
            isOverloaded = true;
            if (countdownValue === 0) triggerSpotlightAt(lastKnownMouseX, lastKnownMouseY);
        }

        if (message.type === 'TEPR_BASELINE') {
            isOverloaded = false;
            resetUI();
        }
    });

    // --- COGNITIVE SPOTLIGHT LOGIC ---
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
            resetUI();
        }
    });
})();