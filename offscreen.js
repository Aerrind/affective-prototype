// offscreen.js

let isEngineRunning = false;
let isSpikeActive = false;
let lastTelemetryTime = 0;

async function init() {
    // THE FIX: Auto-resolve the path. This guarantees it finds the models 
    // exactly how it did when the camera successfully turned on previously.
    const possiblePaths = [
        chrome.runtime.getURL('models'),
        '/models'
    ];

    let modelsLoaded = false;

    for (let path of possiblePaths) {
        try {
            await faceapi.nets.tinyFaceDetector.loadFromUri(path);
            await faceapi.nets.faceExpressionNet.loadFromUri(path);
            modelsLoaded = true;
            break; // Models found! Break out of the loop.
        } catch (e) {
            // Silently try the next path
        }
    }

    if (modelsLoaded) {
        claimCamera();
    } else {
        broadcastError('MDL'); 
    }
}

function claimCamera() {
    if (isEngineRunning) return;

    navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 480 } } })
        .then((stream) => {
            const video = document.getElementById('offscreen-video');
            video.srcObject = stream;
            
            stream.getTracks()[0].onended = () => {
                isEngineRunning = false;
                setTimeout(claimCamera, 1000);
            };

            video.onloadedmetadata = () => {
                video.width = video.videoWidth || 640;
                video.height = video.videoHeight || 480;
                video.play();
                isEngineRunning = true;
                
                // Start the un-freezable mathematical timer loop
                detectLoop(video);
            };
        })
        .catch((err) => {
            broadcastError('CAM'); 
            setTimeout(claimCamera, 3000);
        });
}

async function detectLoop(video) {
    if (!isEngineRunning) return;

    try {
        const detection = await faceapi.detectSingleFace(video, new faceapi.TinyFaceDetectorOptions()).withFaceExpressions();
        
        if (detection) {
            const ex = detection.expressions;
            // Calculate fatigue based on your project weights
            const fatigue = (ex.angry || 0) * 1.2 + (ex.sad || 0) * 1.5;

            if (fatigue >= 0.4) {
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
                    fatigue: fatigue.toFixed(2), 
                    sad: (ex.sad||0).toFixed(2), 
                    angry: (ex.angry||0).toFixed(2),
                    isSpike: isSpikeActive
                }).catch(()=>{});
            }
        } else {
            // Heartbeat: Camera is running, but sees no face right now
            const now = Date.now();
            if (now - lastTelemetryTime > 500) {
                lastTelemetryTime = now;
                chrome.runtime.sendMessage({ 
                    type: 'TEPR_TELEMETRY', fatigue: '0.00', sad: '0.00', angry: '0.00', isSpike: false 
                }).catch(()=>{});
            }
        }
    } catch (e) {
        // Keep the loop alive even if a frame drops
    }

    // THE FIX: This forces the loop to run in the background, 
    // bypassing Chrome's aggressive background throttling.
    if (isEngineRunning) {
        setTimeout(() => detectLoop(video), 200); 
    }
}

function broadcastError(code) {
    chrome.runtime.sendMessage({ type: 'TEPR_TELEMETRY', fatigue: code, sad: code, angry: code, isSpike: false }).catch(()=>{});
}

window.addEventListener('load', init);