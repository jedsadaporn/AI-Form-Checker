"use client";

import { useEffect, useRef, useState, useCallback } from "react";

const CONNECTIONS = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6],
  [5, 7], [7, 9],
  [6, 8], [8, 10],
  [5, 11], [6, 12],
  [11, 12],
  [11, 13], [13, 15],
  [12, 14], [14, 16],
];

export default function Home() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectorRef = useRef<any>(null);
  const animationRef = useRef<number>(0);
  const streamRef = useRef<MediaStream | null>(null);
  const isRunningRef = useRef(false); // ✅ ใช้ ref แทน state ใน async loop

  const [isRunning, setIsRunning] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const drawPoses = useCallback((poses: any[], canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const pose of poses) {
      const kps = pose.keypoints;

      // วาด skeleton
      ctx.strokeStyle = "#00ff88";
      ctx.lineWidth = 2;
      for (const [i, j] of CONNECTIONS) {
        const a = kps[i], b = kps[j];
        if ((a.score ?? 0) > 0.3 && (b.score ?? 0) > 0.3) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }

      // วาด dots
      for (const kp of kps) {
        if ((kp.score ?? 0) > 0.3) {
          ctx.beginPath();
          ctx.arc(kp.x, kp.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = "#ff4444";
          ctx.fill();
          ctx.strokeStyle = "#fff";
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }
      }
    }
  }, []);

  const startCamera = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!detectorRef.current) {
        const tf = await import("@tensorflow/tfjs");
        await import("@tensorflow/tfjs-backend-webgl");
        const poseDetection = await import("@tensorflow-models/pose-detection");
        await tf.ready();
        detectorRef.current = await poseDetection.createDetector(
          poseDetection.SupportedModels.MoveNet,
          { modelType: "SinglePose.Lightning" }
        );
      }

      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;

      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play();

      // ✅ รอให้ video พร้อมสมบูรณ์ก่อน (แก้ cropRegion error)
      await new Promise<void>((resolve) => {
        if (video.readyState >= 2) return resolve();
        video.addEventListener("loadeddata", () => resolve(), { once: true });
      });

      isRunningRef.current = true;
      setIsRunning(true);

      const detect = async () => {
        if (!isRunningRef.current) return; // ✅ หยุด loop ทันทีเมื่อปิดกล้อง

        const canvas = canvasRef.current;
        if (video && canvas && detectorRef.current) {
          // ✅ sync canvas กับ video ทุก frame
          if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
          }

          try {
            const poses = await detectorRef.current.estimatePoses(video);
            drawPoses(poses, canvas);
          } catch (e) {
            // ข้าม frame ที่ error
          }
        }

        animationRef.current = requestAnimationFrame(detect);
      };

      detect();
    } catch (err) {
      console.error("เปิดกล้องไม่ได้:", err);
    }

    setIsLoading(false);
  }, [drawPoses]);

  const stopCamera = useCallback(() => {
    isRunningRef.current = false; // ✅ หยุด loop ก่อน
    cancelAnimationFrame(animationRef.current);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (videoRef.current) videoRef.current.srcObject = null;

    // ✅ clear canvas หลัง loop หยุด
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (canvas) canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    }, 50);

    setIsRunning(false);
  }, []);

  useEffect(() => {
    return () => {
      isRunningRef.current = false;
      cancelAnimationFrame(animationRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: 24 }}>
      <h1>AI Form Checker</h1>

      <div style={{ position: "relative", width: 640, height: 480, background: "#111", borderRadius: 12, overflow: "hidden" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{ width: "100%", height: "100%", display: "block", objectFit: "cover" }}
        />
        {/* ✅ Canvas ซ้อนทับ video ตรงๆ */}
        <canvas
          ref={canvasRef}
          style={{
            position: "absolute",
            top: 0, left: 0,
            width: "100%", height: "100%",
          }}
        />
      </div>

      <button
        onClick={isRunning ? stopCamera : startCamera}
        disabled={isLoading}
        style={{
          padding: "12px 32px",
          fontSize: 16,
          borderRadius: 8,
          border: "none",
          cursor: isLoading ? "wait" : "pointer",
          background: isRunning ? "#ef4444" : "#22c55e",
          color: "white",
          fontWeight: "bold",
        }}
      >
        {isLoading ? "กำลังโหลด..." : isRunning ? "⏹ ปิดกล้อง" : "▶ เปิดกล้อง"}
      </button>
    </div>
  );
}
