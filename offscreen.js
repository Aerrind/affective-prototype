// offscreen.js

const MODEL_URL = chrome.runtime.getURL('/models'); 
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });

const WEIGHT_ANGER = 1.2;
const WEIGHT_SAD = 1.5;
const FATIGUE_THRESHOLD = 0.4; 

let isSpikeActive = false;
let isEngineRunning = false;
let activeStream = null;
let modelsLoaded = false;
let bootAttempts = 0;

window.addEventListener('load', async () => {
    console.log("[Offscreen] WAKING UP. Booting AI...");
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        console.log("[Offscreen] AI Models Loaded successfully.");
        aggressivelyClaimCamera();
    } catch (e) {
        console.error("[Offscreen] Failed to load models:", e);
    }
});

function aggressivelyClaimCamera() {
    if (isEngineRunning || !modelsLoaded) return;
    
    bootAttempts++;
    console.log(`[Offscreen] Attempting to claim camera... (Attempt ${bootAttempts})`);

    navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
        .then((stream) => {
            console.log("[Offscreen] SUCCESS: Camera hardware claimed!");
            activeStream = stream;
            
            const video = document.getElementById('offscreen-video');
            video.srcObject = activeStream;
            
            activeStream.getTracks()[0].onended = () => {
                console.warn("[Offscreen] OS killed the camera stream.");
                isEngineRunning = false;
                setTimeout(aggressivelyClaimCamera, 2000);
            };
            
            video.onloadedmetadata = () => {
                video.play();
                isEngineRunning = true;
                bootAttempts = 0; // Reset counter
                runDetectionLoop(video);
            };
        })
        .catch((err) => {
            console.error("[Offscreen] ERROR claiming camera:", err.name, err.message);
            // If it fails, wait 3 seconds and try again. Forever.
            setTimeout(aggressivelyClaimCamera, 3000);
        });
}

async function runDetectionLoop(videoElement) {
    if (!isEngineRunning) return; 

    try {
        const detection = await faceapi
            .detectSingleFace(videoElement, DETECTOR_OPTIONS)
            .withFaceExpressions();

        if (detection) {
            const expressions = detection.expressions;
            const fatigueScore = ((expressions.angry || 0) * WEIGHT_ANGER) + ((expressions.sad || 0) * WEIGHT_SAD);

            if (fatigueScore >= FATIGUE_THRESHOLD) {
                if (!isSpikeActive) {
                    isSpikeActive = true;
                    chrome.runtime.sendMessage({ type: 'TEPR_SPIKE' });
                }
            } else {
                if (isSpikeActive) {
                    isSpikeActive = false;
                    chrome.runtime.sendMessage({ type: 'TEPR_BASELINE' });
                }
            }
        }
    } catch (e) {
        console.error("[Offscreen] Detection loop error:", e);
    }

    if (isEngineRunning) {
        requestAnimationFrame(() => runDetectionLoop(videoElement));
    }
}

chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'PAUSE_CAMERA') {
        console.log("[Offscreen] Command received: Dropping camera lock.");
        if (activeStream) {
            activeStream.getTracks().forEach(t => t.stop());
            activeStream = null;
        }
        isEngineRunning = false;
    }
    if (message.type === 'RESUME_CAMERA') {
        console.log("[Offscreen] Command received: Reclaiming camera lock.");
        aggressivelyClaimCamera();
    }
});