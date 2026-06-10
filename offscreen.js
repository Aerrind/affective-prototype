// offscreen.js

// Configuration Constants
const MODEL_URL = chrome.runtime.getURL('/models'); // Ensured root-level routing
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ 
    inputSize: 224, 
    scoreThreshold: 0.3 
});

// Weights mapping to your project defense guidelines
const WEIGHT_ANGER = 1.2;
const WEIGHT_SAD = 1.5;
const FATIGUE_THRESHOLD = 1.0;

let isSpikeActive = false;

// Wait for the window and library to load fully before starting hardware hooks
window.addEventListener('load', () => {
    if (typeof faceapi !== 'undefined') {
        console.log("[Offscreen] face-api.min.js loaded. Initializing models...");
        initTracker();
    } else {
        console.error("[Offscreen] Critical Error: faceapi is undefined. Check script order in offscreen.html.");
    }
});

async function initTracker() {
    try {
        // Aligned perfectly with your working options page directory setup
        console.log("[Offscreen] Loading models from:", MODEL_URL);
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        console.log("[Offscreen] TinyFaceDetector loaded");
        
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        console.log("[Offscreen] FaceExpressionNet loaded");
        console.log("[Offscreen] AI Models loaded successfully.");

        // Request webcam access
        console.log("[Offscreen] Requesting camera access...");
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: 640, height: 480 } 
        });
        
        console.log("[Offscreen] Camera access granted - stream received");
        const video = document.getElementById('offscreen-video');
        if (video) {
            video.srcObject = stream;
            video.onloadedmetadata = () => {
                video.play();
                console.log("[Offscreen] Webcam active. Starting detection pipeline...");
                runDetectionLoop(video);
            };
        } else {
            console.error("[Offscreen] Video element not found!");
        }
    } catch (err) {
        console.error("[Offscreen] Tracker initialization failed:", err);
    }
}

async function runDetectionLoop(videoElement) {
    async function detectFrame() {
        try {
            const detection = await faceapi
                .detectSingleFace(videoElement, DETECTOR_OPTIONS)
                .withFaceExpressions();

            if (!detection) {
                // Uncomment for frame-by-frame logging:
                // console.log("[Offscreen] No face detected");
                chrome.runtime.sendMessage({ type: 'STATUS_UPDATE', status: 'NO_FACE_DETECTED' });
                requestAnimationFrame(detectFrame);
                return;
            }

            const expressions = detection.expressions;
            const angryProb = expressions.angry || 0;
            const sadProb = expressions.sad || 0;

            // Decision Fatigue Intervener Formula
            const fatigueScore = (angryProb * WEIGHT_ANGER) + (sadProb * WEIGHT_SAD);

            console.log("[Offscreen] Face detected - Angry:", angryProb.toFixed(2), 
                       "Sad:", sadProb.toFixed(2), "Fatigue Score:", fatigueScore.toFixed(3));

            // Structure a diagnostic broadcast payload
            chrome.runtime.sendMessage({
                type: 'AI_DIAGNOSTICS_UPDATE',
                fatigueScore: fatigueScore.toFixed(3),
                topEmotions: `A: ${angryProb.toFixed(2)} | S: ${sadProb.toFixed(2)}`
            });

            // Evaluate Threshold State vs Baseline State
            if (fatigueScore >= FATIGUE_THRESHOLD) {
                if (!isSpikeActive) {
                    isSpikeActive = true;
                    console.log("[Offscreen] TEPR_SPIKE triggered - sending to background");
                    chrome.runtime.sendMessage({ type: 'TEPR_SPIKE' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("[Offscreen] Message failed:", chrome.runtime.lastError);
                        }
                    });
                }
            } else {
                if (isSpikeActive) {
                    isSpikeActive = false;
                    console.log("[Offscreen] TEPR_BASELINE triggered - sending to background");
                    chrome.runtime.sendMessage({ type: 'TEPR_BASELINE' }, (response) => {
                        if (chrome.runtime.lastError) {
                            console.error("[Offscreen] Message failed:", chrome.runtime.lastError);
                        }
                    });
                }
            }

        } catch (loopError) {
            console.error("[Offscreen] Error during frame processing:", loopError);
        }

        requestAnimationFrame(detectFrame);
    }

    requestAnimationFrame(detectFrame);
}

// Handle explicit manual recalibrations or resets from options page / content keys
chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'RECALIBRATE_TEPR') {
        isSpikeActive = false;
        console.log("[Offscreen] Resetting baseline states.");
    }
});