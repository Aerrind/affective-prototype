// options.js
let lifecyclePort = null;
try {
    lifecyclePort = chrome.runtime.connect({ name: 'options-lifecycle' });
} catch (e) {
    console.error("Failed to connect to background. Please refresh this page.", e);
}

const WEIGHTS = { sadness: 1.5, anger: 1.2, fear: 1.3, neutral: 0.8, happiness: -1.5 };
let optionsStream = null;

window.addEventListener('beforeunload', () => {
    if (optionsStream) {
        optionsStream.getTracks().forEach(t => t.stop());
    }
});

document.getElementById('request-cam').addEventListener('click', async () => {
    document.getElementById('status-box').innerText = "Acquiring hardware lock...";
    document.getElementById('status-box').style.color = "#eab308";

    try { chrome.runtime.sendMessage({ type: 'PAUSE_CAMERA' }); } catch(e){}

    setTimeout(async () => {
        try {
            document.getElementById('tracker-view').style.display = "flex";

            await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
            await faceapi.nets.faceExpressionNet.loadFromUri('/models');

            optionsStream = await navigator.mediaDevices.getUserMedia({ video: true });
            const videoElement = document.getElementById('webcam');
            videoElement.srcObject = optionsStream;

            document.getElementById('status-box').innerText = "Calibration Active.";
            document.getElementById('status-box').style.color = "#4ade80"; 

            startVisualizer(videoElement);
        } catch (err) {
            document.getElementById('status-box').innerText = "Error: Camera access denied.";
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
            } else {
                hudStatus.innerText = "NO FACE DETECTED";
                hudStatus.style.color = "#ff4a4a";
            }
        }, 200);
    });
}