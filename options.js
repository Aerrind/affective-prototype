// options.js

const WEIGHTS = { sadness: 1.5, anger: 1.2, fear: 1.3, neutral: 0.8, happiness: -1.5 };
const FATIGUE_THRESHOLD = 0.4;
let optionsStream = null;

// --- DUAL-DOT DASHBOARD UI (Injected into Options Page) ---
const dashboardContainer = document.createElement('div');
dashboardContainer.style.cssText = 'position:fixed; bottom:15px; left:15px; display:flex; align-items: center; gap:12px; z-index:9999999; background:rgba(0,0,0,0.8); padding:10px 15px; border-radius:20px; border: 1px solid #444; color: white; font-family: monospace;';

const emotionDot = document.createElement('div');
emotionDot.style.cssText = 'width:18px; height:18px; border-radius:50%; background:green; box-shadow:0 0 8px rgba(0,255,0,0.5); transition: background 0.2s;';

const motionDot = document.createElement('div');
motionDot.style.cssText = 'width:18px; height:18px; border-radius:50%; background:#ffffff; box-shadow:0 0 8px rgba(255,255,255,0.3); transition: background 0.2s;';

// Visual Countdown Timer UI
const timerText = document.createElement('div');
timerText.innerText = "Mouse Active";
timerText.style.cssText = 'font-size: 14px; font-weight: bold; min-width: 100px; text-align: center; color: #aaa;';

dashboardContainer.appendChild(emotionDot);
dashboardContainer.appendChild(motionDot);
dashboardContainer.appendChild(timerText);
document.body.appendChild(dashboardContainer);

// --- MOUSE TRACKING LOGIC WITH VISUAL TIMER ---
let isMouseMoving = false;
let movementTimeout = null;
let isOverloaded = false; 

let countdownValue = 2.0;
let countdownInterval = null;

function resetMouseTimer() {
    isMouseMoving = true;
    motionDot.style.background = '#ffffff'; 
    motionDot.style.boxShadow = '0 0 8px rgba(255,255,255,0.3)';
    timerText.innerText = "Mouse Active";
    timerText.style.color = "#aaa";
    
    clearInterval(countdownInterval);
    clearTimeout(movementTimeout);
    countdownValue = 2.0; // Reset to 2 seconds

    // Detect when mouse STOPS moving (after 100ms of no events)
    movementTimeout = setTimeout(() => {
        isMouseMoving = false;
        startCountdown();
    }, 100);
}

function startCountdown() {
    timerText.innerText = `Idle: ${countdownValue.toFixed(1)}s`;
    timerText.style.color = "#00bfff"; // Switch to blue
    
    countdownInterval = setInterval(() => {
        countdownValue -= 0.1;
        
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            countdownValue = 0;
            timerText.innerText = "SPOTLIGHT READY";
            timerText.style.color = "#eab308"; // Switch to yellow alert
            motionDot.style.background = '#00bfff'; 
            motionDot.style.boxShadow = '0 0 12px #00bfff';
            
            if (isOverloaded) {
                console.log("[Options UI] Dual-Key Met: Mouse Paused + Emotion Spiked.");
            }
        } else {
            timerText.innerText = `Idle: ${countdownValue.toFixed(1)}s`;
        }
    }, 100);
}

// Track movements anywhere on the dashboard
document.addEventListener('mousemove', resetMouseTimer);
// -----------------------------------------------------------

// Return hardware access to the offscreen document immediately when tab closes
window.addEventListener('beforeunload', () => {
    if (optionsStream) {
        optionsStream.getTracks().forEach(t => t.stop());
    }
    chrome.runtime.sendMessage({ type: 'RESUME_CAMERA' });
});

document.getElementById('request-cam').addEventListener('click', async () => {
    document.getElementById('status-box').innerText = "Acquiring hardware lock...";
    document.getElementById('status-box').style.color = "#eab308";

    // Tell the background process to let go of the camera
    chrome.runtime.sendMessage({ type: 'PAUSE_CAMERA' });

    setTimeout(async () => {
        try {
            document.getElementById('tracker-view').style.display = "flex";

            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await faceapi.nets.faceExpressionNet.loadFromUri('/models');

            // Claim the camera for the dashboard
            optionsStream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            const videoElement = document.getElementById('webcam');
            videoElement.srcObject = optionsStream;

            document.getElementById('status-box').innerText = "Calibration Active. You may close this tab when done.";
            document.getElementById('status-box').style.color = "#4ade80"; 

            startVisualizer(videoElement);
        } catch (err) {
            document.getElementById('status-box').innerText = "Error: Camera access denied. Check Site Settings!";
            document.getElementById('status-box').style.color = "#ff4a4a"; 
            console.error(err);
        }
    }, 500);
});

function startVisualizer(videoElement) {
    const canvas = document.getElementById('output_canvas');
    const displaySize = { width: videoElement.width, height: videoElement.height };
    faceapi.matchDimensions(canvas, displaySize);

    const hudStatus = document.getElementById('hud-status');
    const hudFatigue = document.getElementById('hud-fatigue');
    const hudEmotions = document.getElementById('hud-emotions');

    videoElement.addEventListener('play', () => {
        setInterval(async () => {
            if (videoElement.paused || videoElement.ended) return;

            const detections = await faceapi.detectSingleFace(
                videoElement, 
                new faceapi.TinyFaceDetectorOptions()
            ).withFaceExpressions();
            
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);

            if (detections) {
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                faceapi.draw.drawDetections(canvas, resizedDetections);
                faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

                const emotions = detections.expressions;
                const fatigue = (emotions.sad * WEIGHTS.sadness) + (emotions.angry * WEIGHTS.anger);

                hudStatus.innerText = "TRACKING";
                hudStatus.style.color = "#4ade80";
                hudFatigue.innerText = fatigue.toFixed(3);
                
                // Show ALL relevant emotions in the dashboard
                hudEmotions.innerText = `S: ${emotions.sad.toFixed(2)} | A: ${emotions.angry.toFixed(2)} | F: ${emotions.fearful.toFixed(2)} | H: ${emotions.happy.toFixed(2)} | N: ${emotions.neutral.toFixed(2)}`;

                // --- CONNECT AI TO THE DOT ---
                if (fatigue >= FATIGUE_THRESHOLD) {
                    isOverloaded = true;
                    emotionDot.style.background = 'red';
                    emotionDot.style.boxShadow = '0 0 12px red';
                } else {
                    isOverloaded = false;
                    emotionDot.style.background = 'green';
                    emotionDot.style.boxShadow = '0 0 8px rgba(0,255,0,0.5)';
                }

            } else {
                hudStatus.innerText = "NO FACE DETECTED";
                hudStatus.style.color = "#ff4a4a";
            }
        }, 200);
    });
}