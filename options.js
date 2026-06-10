// options.js

const WEIGHTS = { sadness: 1.5, anger: 1.2, fear: 1.3, neutral: 0.8, happiness: -1.5 };

document.getElementById('request-cam').addEventListener('click', async () => {
    try {
        document.getElementById('status-box').innerText = "Loading AI Models...";
        document.getElementById('status-box').style.color = "#eab308"; 
        
        // Reveal the dashboard
        document.getElementById('tracker-view').style.display = "flex";
        
        // 1. Load the models from your local folder
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models');
        await faceapi.nets.faceExpressionNet.loadFromUri('/models');

        // 2. Start the camera
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        const videoElement = document.getElementById('webcam');
        videoElement.srcObject = stream;
        
        document.getElementById('status-box').innerText = "Camera Active. Tracking Fatigue...";
        document.getElementById('status-box').style.color = "#4ade80"; 

        startVisualizer(videoElement);
        
    } catch (err) {
        document.getElementById('status-box').innerText = "Error: Camera access denied or models missing.";
        document.getElementById('status-box').style.color = "#ff4a4a"; 
        console.error("Initialization Error:", err);
    }
});

function startVisualizer(videoElement) {
    const canvas = document.getElementById('output_canvas');
    const displaySize = { width: videoElement.width, height: videoElement.height };
    faceapi.matchDimensions(canvas, displaySize);

    // Update the HUD elements
    const hudStatus = document.getElementById('hud-status');
    const hudFatigue = document.getElementById('hud-fatigue');
    const hudEmotions = document.getElementById('hud-emotions');

    videoElement.addEventListener('play', () => {
        setInterval(async () => {
            const detections = await faceapi.detectSingleFace(
                videoElement, 
                new faceapi.TinyFaceDetectorOptions()
            ).withFaceExpressions();
            
            const context = canvas.getContext('2d');
            context.clearRect(0, 0, canvas.width, canvas.height);

            if (detections) {
                // Draw boxes and expressions on the video feed
                const resizedDetections = faceapi.resizeResults(detections, displaySize);
                faceapi.draw.drawDetections(canvas, resizedDetections);
                faceapi.draw.drawFaceExpressions(canvas, resizedDetections);

                // Calculate the Fatigue Score
                const emotions = detections.expressions;
                const fatigue = (emotions.sad * WEIGHTS.sadness) +
                                (emotions.angry * WEIGHTS.anger) +
                                (emotions.fearful * WEIGHTS.fear) +
                                (emotions.neutral * WEIGHTS.neutral) +
                                (emotions.happy * WEIGHTS.happiness);

                // Update HUD
                hudStatus.innerText = "TRACKING";
                hudStatus.style.color = "#4ade80";
                hudFatigue.innerText = fatigue.toFixed(3);
                hudEmotions.innerText = `S: ${emotions.sad.toFixed(2)} | A: ${emotions.angry.toFixed(2)} | H: ${emotions.happy.toFixed(2)}`;
            } else {
                hudStatus.innerText = "NO FACE DETECTED";
                hudStatus.style.color = "#ff4a4a";
                hudFatigue.innerText = "--";
                hudEmotions.innerText = "--";
            }
        }, 200);
    });
}