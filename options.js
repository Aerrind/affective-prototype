// options.js

const WEIGHTS = { sadness: 1.5, anger: 1.2, fear: 1.3, neutral: 0.8, happiness: -1.5 };
const FATIGUE_THRESHOLD = 0.4;
let optionsStream = null;

// THE FIX: Establish a permanent tether to the background script. 
// When you close this tab, Chrome automatically snaps this connection.
const port = chrome.runtime.connect({ name: 'options-dashboard' });

// --- DUAL-DOT DASHBOARD UI (Injected into Options Page) ---
const dashboardContainer = document.createElement('div');
dashboardContainer.style.cssText = 'position:fixed; bottom:15px; left:15px; display:flex; align-items: center; gap:12px; z-index:9999999; background:rgba(0,0,0,0.8); padding:10px 15px; border-radius:20px; border: 1px solid #444; color: white; font-family: monospace;';

const emotionDot = document.createElement('div');
emotionDot.style.cssText = 'width:18px; height:18px; border-radius:50%; background:green; box-shadow:0 0 8px rgba(0,255,0,0.5); transition: background 0.2s;';

const motionDot = document.createElement('div');
motionDot.style.cssText = 'width:18px; height:18px; border-radius:50%; background:#ffffff; box-shadow:0 0 8px rgba(255,255,255,0.3); transition: background 0.2s;';

const timerText = document.createElement('div');
timerText.innerText = "Mouse Active";
timerText.style.cssText = 'font-size: 14px; font-weight: bold; min-width: 100px; text-align: center; color: #aaa;';

dashboardContainer.appendChild(emotionDot);
dashboardContainer.appendChild(motionDot);
dashboardContainer.appendChild(timerText);
document.body.appendChild(dashboardContainer);

// --- MOUSE TRACKING LOGIC ---
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
    countdownValue = 2.0; 

    movementTimeout = setTimeout(() => {
        isMouseMoving = false;
        startCountdown();
    }, 100);
}

function startCountdown() {
    timerText.innerText = `Idle: ${countdownValue.toFixed(1)}s`;
    timerText.style.color = "#00bfff"; 
    
    countdownInterval = setInterval(() => {
        countdownValue -= 0.1;
        
        if (countdownValue <= 0) {
            clearInterval(countdownInterval);
            countdownValue = 0;
            timerText.innerText = "SPOTLIGHT READY";
            timerText.style.color = "#eab308"; 
            motionDot.style.background = '#00bfff'; 
            motionDot.style.boxShadow = '0 0 12px #00bfff';
        } else {
            timerText.innerText = `Idle: ${countdownValue.toFixed(1)}s`;
        }
    }, 100);
}

document.addEventListener('mousemove', resetMouseTimer);

document.getElementById('request-cam').addEventListener('click', async () => {
    document.getElementById('status-box').innerText = "Acquiring hardware lock...";
    document.getElementById('status-box').style.color = "#eab308";

    // Tell background to pause its invisible tracking
    chrome.runtime.sendMessage({ type: 'PAUSE_CAMERA' });

    setTimeout(async () => {
        try {
            document.getElementById('tracker-view').style.display = "flex";

            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await faceapi.nets.faceExpressionNet.loadFromUri('/models');

            optionsStream = await navigator.mediaDevices.getUserMedia({ video: true });
            
            const videoElement = document.getElementById('webcam');
            videoElement.srcObject = optionsStream;

            document.getElementById('status-box').innerText = "Calibration Active. You may close this tab when done.";
            document.getElementById('status-box').style.color = "#4ade80"; 

            startVisualizer(videoElement);
        } catch (err) {
            document.getElementById('status-box').innerText = "Error: Camera access denied.";
            document.getElementById('status-box').style.color = "#ff4a4a"; 
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
                
                hudEmotions.innerText = `S: ${emotions.sad.toFixed(2)} | A: ${emotions.angry.toFixed(2)} | F: ${emotions.fearful.toFixed(2)} | H: ${emotions.happy.toFixed(2)} | N: ${emotions.neutral.toFixed(2)}`;

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