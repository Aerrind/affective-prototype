// content.js
(function() {
    let lastKnownMouseX = window.innerWidth / 2; 
    let lastKnownMouseY = window.innerHeight / 2;
    let isOverloaded = false;      
    let isSpotlightActive = false; 
    let currentSpotlightElement = null;
    let globalSpotlightTimer = null;

    const PAUSE_DURATION = 2000; // 2 seconds of stillness required
    const NOISE_SELECTORS = 'nav, aside, footer, iframe, .ads, [role="banner"], [role="complementary"]';

    // --- DUAL-DOT DEBUGGING DASHBOARD ---
    const dashboardContainer = document.createElement('div');
    dashboardContainer.style.cssText = 'position:fixed; bottom:15px; left:15px; display:flex; gap:8px; z-index:9999999; pointer-events:none; background:rgba(0,0,0,0.5); padding:6px; border-radius:20px;';
    
    // Dot 1: Emotion Spike Indicator
    const emotionDot = document.createElement('div');
    emotionDot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:green; box-shadow:0 0 4px rgba(0,255,0,0.5); transition: background 0.2s;';
    
    // Dot 2: Mouse Stillness Indicator
    const motionDot = document.createElement('div');
    motionDot.style.cssText = 'width:14px; height:14px; border-radius:50%; background:#ffffff; box-shadow:0 0 4px rgba(255,255,255,0.3); transition: background 0.2s;';
    
    dashboardContainer.appendChild(emotionDot);
    dashboardContainer.appendChild(motionDot);
    document.body.appendChild(dashboardContainer);
    // ------------------------------------

    // TRACK MOUSE MOVEMENT
    document.addEventListener('mousemove', (e) => {
        lastKnownMouseX = e.clientX;
        lastKnownMouseY = e.clientY;

        // Visual feedback: Mouse is moving actively
        motionDot.style.background = '#ffffff'; 
        motionDot.style.boxShadow = '0 0 4px rgba(255,255,255,0.3)';

        // If the spotlight is already active, allow looking around inside it
        if (isSpotlightActive && isOverloaded) {
            triggerSpotlight();
            return;
        }

        // Cancel countdown because mouse moved
        clearTimeout(globalSpotlightTimer);

        // System re-evaluates once movement pauses
        startStillnessTimeout();
    });

    function startStillnessTimeout() {
        // Triggered when mouse drift stops
        clearTimeout(globalSpotlightTimer);
        
        // Visual feedback: Mouse has halted
        motionDot.style.background = '#00bfff'; 
        motionDot.style.boxShadow = '0 0 8px #00bfff';

        // Dual-Key Condition check
        if (isOverloaded) {
            globalSpotlightTimer = setTimeout(() => {
                triggerSpotlight();
            }, PAUSE_DURATION);
        }
    }

    // Capture natural drop in movement velocity if mouse isn't generating mousemove events
    let checkMotionStall = setInterval(() => {
        if (motionDot.style.background === 'rgb(255, 255, 255)' || motionDot.style.background === '#ffffff') {
            // If no mousemove event hit for a brief beat, flag it as still
            startStillnessTimeout();
        }
    }, 500);

    // LISTEN TO THE AI BIOMETRICS
    chrome.runtime.onMessage.addListener((message, sender, senderResponse) => {
        console.log("[Content] Received message:", message.type);
        
        if (message.type === 'TEPR_SPIKE') {
            console.log("[Content] Setting emotion dot to RED");
            emotionDot.style.background = 'red';
            emotionDot.style.boxShadow = '0 0 8px red';
            isOverloaded = true;
            
            // If mouse is already still when the expression occurs, check timing
            if (motionDot.style.background === 'rgb(0, 191, 255)' || motionDot.style.background === '#00bfff') {
                console.log("[Content] Mouse already still - starting spotlight timer");
                clearTimeout(globalSpotlightTimer);
                globalSpotlightTimer = setTimeout(() => {
                    triggerSpotlight();
                }, PAUSE_DURATION);
            }

        } else if (message.type === 'TEPR_BASELINE') {
            console.log("[Content] Setting emotion dot to GREEN");
            emotionDot.style.background = 'green';
            emotionDot.style.boxShadow = '0 0 4px rgba(0,255,0,0.5)';
            isOverloaded = false;
            clearTimeout(globalSpotlightTimer);
            resetUI();
        }
    });
    
    console.log("[Content] Script initialized - dashboard created");

    function triggerSpotlight() {
        let target = document.elementFromPoint(lastKnownMouseX, lastKnownMouseY);
        if (!target) return;

        let container = target;
        const structuralTags = ['DIV', 'SECTION', 'ARTICLE', 'MAIN', 'FORM', 'UL', 'P', 'SPAN', 'H1', 'H2', 'H3'];

        while (container && container !== document.body) {
            let rect = container.getBoundingClientRect();
            let style = window.getComputedStyle(container);
            
            let isGoodSize = rect.width > 100 && rect.height > 50;
            let isVisible = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || structuralTags.includes(container.tagName);

            if (isGoodSize && isVisible) {
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
            clearTimeout(globalSpotlightTimer);
            resetUI();
            try { chrome.runtime.sendMessage({ type: 'RECALIBRATE_TEPR' }); } catch (err) {}
        }
    });
})();