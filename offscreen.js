// offscreen.js

const MODEL_URL = chrome.runtime.getURL('models'); 
const DETECTOR_OPTIONS = new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.3 });

const WEIGHT_ANGER = 1.2;
const WEIGHT_SAD = 1.5;
const FATIGUE_THRESHOLD = 0.4; 

let isSpikeActive = false;
let isEngineRunning = false;
let modelsLoaded = false;
let lastTelemetryTime = 0;

window.addEventListener('load', async () => {
    try {
        await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
        modelsLoaded = true;
        aggressivelyClaimCamera();
    } catch (e) {
        // ERROR ROUTING: Tell the dashboard the models failed to load
        setInterval(() => {
            chrome.runtime.sendMessage({ 
                type: 'TEPR_TELEMETRY', fatigue: 'MDL', sad: 'MDL', angry: 'MDL', isSpike: true
            }).catch(()=>{});
        }, 1000);
    }
});

function aggressivelyClaimCamera() {
    if (isEngineRunning || !modelsLoaded) return;

    navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 640 }, height: { ideal: 480 } } 
    })
    .then((stream) => {
        const video = document.getElementById('offscreen-video');
        video.srcObject = stream;
        
        stream.getTracks()[0].onended = () => {
            isEngineRunning = false;
            setTimeout(aggressivelyClaimCamera, 2000);
        };
        
        video.onloadedmetadata = () => {
            video.width = video.videoWidth || 640;
            video.height = video.videoHeight || 480;
            video.play();
            isEngineRunning = true;
            runDetectionLoop(video);
        };
    })
    .catch((err) => {
        // ERROR ROUTING: Tell the dashboard the camera was blocked by the OS/Browser
        chrome.runtime.sendMessage({ 
            type: 'TEPR_TELEMETRY', fatigue: 'CAM', sad: 'CAM', angry: 'CAM', isSpike: true
        }).catch(()=>{});
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
            const angryScore = expressions.angry || 0;
            const sadScore = expressions.sad || 0;
            const fatigueScore = (angryScore * WEIGHT_ANGER) + (sadScore * WEIGHT_SAD);

            if (fatigueScore >= FATIGUE_THRESHOLD) {
                if (!isSpikeActive) {
                    isSpikeActive = true;
                    chrome.runtime.sendMessage({ type: 'TEPR_SPIKE' }).catch(()=>{});
                }
            } else {
                if (isSpikeActive) {
                    isSpikeActive = false;
                    chrome.runtime.sendMessage({ type: 'TEPR_BASELINE' }).catch(()=>{});
                }
            }

            const now = Date.now();
            if (now - lastTelemetryTime > 250) { 
                lastTelemetryTime = now;
                chrome.runtime.sendMessage({ 
                    type: 'TEPR_TELEMETRY', 
                    fatigue: fatigueScore.toFixed(2), 
                    sad: sadScore.toFixed(2), 
                    angry: angryScore.toFixed(2),
                    isSpike: isSpikeActive
                }).catch(()=>{});
            }
        } else {
            // Heartbeat: Let the UI know the AI is running but sees no face
            const now = Date.now();
            if (now - lastTelemetryTime > 500) {
                lastTelemetryTime = now;
                chrome.runtime.sendMessage({ 
                    type: 'TEPR_TELEMETRY', fatigue: '0.00', sad: '0.00', angry: '0.00', isSpike: false
                }).catch(()=>{});
            }
        }
    } catch (e) {
        // Keep loop alive on error
    }

    if (isEngineRunning) {
        requestAnimationFrame(() => runDetectionLoop(videoElement));
    }
}