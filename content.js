// content.js
(function() {
    // 1. WAKE UP THE BACKGROUND SCRIPT IMMEDIATELY (Dual-Ping Safety Net)
    try {
        chrome.runtime.sendMessage({ type: 'ENSURE_OFFSCREEN' });
        chrome.runtime.sendMessage({ type: 'RESUME_CAMERA' }); // Force the camera on
    } catch (e) {}

    let lastKnownMouseX = window.innerWidth / 2; 
    let lastKnownMouseY = window.innerHeight / 2;
    let isOverloaded = false;      
    let isSpotlightActive = false; 
    let currentSpotlightElement = null;
    let globalSpotlightTimer = null;
    let isMouseMoving = false;
    let movementTimeout = null;

    const PAUSE_DURATION = 2000; 

    // --- DASHBOARD UI ---
    const dashboard = document.createElement('div');
    dashboard.style.cssText = 'position:fixed; bottom:15px; left:15px; display:flex; gap:8px; z-index:9999999; pointer-events:none; background:rgba(0,0,0,0.5); padding:6px; border-radius:20px;';
    
    const emotionDot = document.createElement('div');
    emotionDot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:green; box-shadow:0 0 4px rgba(0,255,0,0.5); transition: background 0.2s;';
    
    const motionDot = document.createElement('div');
    motionDot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:#ffffff; box-shadow:0 0 4px rgba(255,255,255,0.3); transition: background 0.2s;';
    
    dashboard.appendChild(emotionDot);
    dashboard.appendChild(motionDot);
    document.body.appendChild(dashboard);

    // --- MOUSE TRACKING ---
    document.addEventListener('mousemove', (e) => {
        lastKnownMouseX = e.clientX;
        lastKnownMouseY = e.clientY;
        isMouseMoving = true;

        motionDot.style.background = '#ffffff'; 
        motionDot.style.boxShadow = '0 0 4px rgba(255,255,255,0.3)';

        if (isSpotlightActive && isOverloaded) {
            triggerSpotlight();
            return;
        }

        clearTimeout(globalSpotlightTimer);
        clearTimeout(movementTimeout);

        movementTimeout = setTimeout(() => {
            isMouseMoving = false;
        }, 100);
    });

    setInterval(() => {
        if (!isMouseMoving) { 
            clearTimeout(globalSpotlightTimer);
            motionDot.style.background = '#00bfff'; 
            motionDot.style.boxShadow = '0 0 8px #00bfff';

            if (isOverloaded) {
                globalSpotlightTimer = setTimeout(triggerSpotlight, PAUSE_DURATION);
            }
        }
    }, 500);

    // --- AI TRACKING ---
    chrome.runtime.onMessage.addListener((message) => {
        if (message.type === 'TEPR_SPIKE') {
            emotionDot.style.background = 'red';
            emotionDot.style.boxShadow = '0 0 8px red';
            isOverloaded = true;
            
            if (!isMouseMoving) {
                clearTimeout(globalSpotlightTimer);
                globalSpotlightTimer = setTimeout(triggerSpotlight, PAUSE_DURATION);
            }
        } else if (message.type === 'TEPR_BASELINE') {
            emotionDot.style.background = 'green';
            emotionDot.style.boxShadow = '0 0 4px rgba(0,255,0,0.5)';
            isOverloaded = false;
            clearTimeout(globalSpotlightTimer);
            resetUI();
        }
    });

    function triggerSpotlight() {
        let target = document.elementFromPoint(lastKnownMouseX, lastKnownMouseY);
        if (!target) return;

        let container = target;
        const structuralTags = ['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'FORM', 'UL', 'P'];

        while (container && container !== document.body) {
            let rect = container.getBoundingClientRect();
            let style = window.getComputedStyle(container);
            let isGoodSize = rect.width > 100 && rect.height > 50;
            let isVisible = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || structuralTags.includes(container.tagName);

            if (isGoodSize && isVisible) break; 
            container = container.parentElement;
        }
        
        if (container && container !== document.body) {
            if (currentSpotlightElement === container) return;
            resetUI(); 

            currentSpotlightElement = container;
            container.classList.add('affective-spotlight');
            
            document.querySelectorAll('nav, aside, footer, iframe, .ads').forEach(el => {
                if (!container.contains(el) && !el.contains(container)) {
                    el.classList.add('affective-suppression');
                }
            });
            isSpotlightActive = true;
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
            clearTimeout(globalSpotlightTimer);
            resetUI();
        }
    });
})();