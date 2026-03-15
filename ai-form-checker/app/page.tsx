"use client";

import { useRef, useState } from "react";
import * as poseDetection from "@tensorflow-models/pose-detection";
import "@tensorflow/tfjs";

export default function Home() {

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [detector, setDetector] = useState<poseDetection.PoseDetector | null>(null);

  const startCamera = async () => {

    const video = videoRef.current;
    if (!video) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      video: true
    });

    streamRef.current = stream;

    video.srcObject = stream;
    video.play();

    if (!detector) {

      const model = poseDetection.SupportedModels.MoveNet;

      const detectorConfig = {
        modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
      };

      const newDetector = await poseDetection.createDetector(model, detectorConfig);

      setDetector(newDetector);

      detectPose(newDetector);
    }

  };

  const stopCamera = () => {

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

  };

  const detectPose = async (det: poseDetection.PoseDetector) => {

    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const poses = await det.estimatePoses(video);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    poses.forEach((pose) => {

      pose.keypoints.forEach((keypoint) => {

        if (keypoint.score && keypoint.score > 0.4) {

          ctx.beginPath();
          ctx.arc(keypoint.x, keypoint.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = "red";
          ctx.fill();

        }

      });

    });

    requestAnimationFrame(() => detectPose(det));

  };

  return (
    <div style={{ textAlign: "center" }}>

      <h1>AI Form Checker</h1>

      <button onClick={startCamera}>
        Start Camera
      </button>

      <button onClick={stopCamera}>
        Stop Camera
      </button>

      <br /><br />

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        width={640}
        height={480}
        style={{ display: "none" }}
      />

      <canvas
        ref={canvasRef}
        width={640}
        height={480}
      />

    </div>
  );
}