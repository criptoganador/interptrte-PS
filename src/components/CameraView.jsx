/**
 * CameraView — Componente principal de video + canvas overlay
 * Integra los 3 detectores y renderiza landmarks en tiempo real
 */

import { useRef, useEffect, useCallback, useState } from "react";
import { useCamera } from "../hooks/useCamera";
import { useHandDetection } from "../hooks/useHandDetection";
import { useFaceDetection } from "../hooks/useFaceDetection";
import { usePoseDetection } from "../hooks/usePoseDetection";
import {
  clearCanvas,
  drawHandLandmarks,
  drawFaceMesh,
  drawPoseLandmarks,
} from "../utils/drawingUtils";

export function CameraView({ onDiagnosticsUpdate }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), value: 0 });
  const lastTimestampRef = useRef(0);
  const [isInitialized, setIsInitialized] = useState(false);

  const camera = useCamera();
  const handDetection = useHandDetection();
  const faceDetection = useFaceDetection();
  const poseDetection = usePoseDetection();

  // Inicializar todo al montar
  useEffect(() => {
    async function init() {
      // Iniciar cámara
      await camera.startCamera();

      // Inicializar detectores en paralelo
      await Promise.all([
        handDetection.initialize(),
        faceDetection.initialize(),
        poseDetection.initialize(),
      ]);

      setIsInitialized(true);
    }

    init();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      camera.stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loop de detección y renderizado
  const detectionLoop = useCallback(() => {
    const video = camera.videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectionLoop);
      return;
    }

    // Sincronizar tamaño del canvas con el video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext("2d");
    const now = performance.now();

    // Evitar timestamps duplicados (MediaPipe lo requiere)
    if (now <= lastTimestampRef.current) {
      animationRef.current = requestAnimationFrame(detectionLoop);
      return;
    }
    lastTimestampRef.current = now;

    // Calcular FPS
    fpsRef.current.frames++;
    if (now - fpsRef.current.lastTime >= 1000) {
      fpsRef.current.value = fpsRef.current.frames;
      fpsRef.current.frames = 0;
      fpsRef.current.lastTime = now;
    }

    // Limpiar canvas
    clearCanvas(ctx, canvas.width, canvas.height);

    // === DETECCIÓN ===
    let handResults = null;
    let faceResults = null;
    let poseResults = null;

    // Detectar pose (dibujar primero, debajo de todo)
    poseResults = poseDetection.detect(video, now);
    if (poseResults?.landmarks?.[0]) {
      drawPoseLandmarks(ctx, poseResults.landmarks[0], canvas.width, canvas.height);
    }

    // Detectar rostro
    faceResults = faceDetection.detect(video, now);
    if (faceResults?.faceLandmarks?.[0]) {
      drawFaceMesh(ctx, faceResults.faceLandmarks[0], canvas.width, canvas.height);
    }

    // Detectar manos (dibujar encima de todo)
    handResults = handDetection.detect(video, now);
    if (handResults?.landmarks) {
      for (let i = 0; i < handResults.landmarks.length; i++) {
        const handedness = handResults.handednesses?.[i]?.[0]?.categoryName || "Right";
        drawHandLandmarks(ctx, handResults.landmarks[i], handedness, canvas.width, canvas.height);
      }
    }

    // === ACTUALIZAR DIAGNÓSTICOS ===
    if (onDiagnosticsUpdate) {
      const topExpressions = faceResults?.faceBlendshapes
        ? faceDetection.getTopExpressions(faceResults.faceBlendshapes, 5)
        : [];

      onDiagnosticsUpdate({
        fps: fpsRef.current.value,
        handsDetected: handResults?.landmarks?.length || 0,
        handedness: handResults?.handednesses?.map((h) => h[0]?.categoryName) || [],
        handConfidence: handResults?.handednesses?.map((h) => h[0]?.score) || [],
        faceDetected: (faceResults?.faceLandmarks?.length || 0) > 0,
        topExpressions,
        poseDetected: (poseResults?.landmarks?.length || 0) > 0,
        modelStatus: {
          hand: handDetection.isLoading ? "loading" : handDetection.isReady ? (handDetection.isEnabled ? "ready" : "disabled") : "error",
          face: faceDetection.isLoading ? "loading" : faceDetection.isReady ? (faceDetection.isEnabled ? "ready" : "disabled") : "error",
          pose: poseDetection.isLoading ? "loading" : poseDetection.isReady ? (poseDetection.isEnabled ? "ready" : "disabled") : "error",
        },
      });
    }

    animationRef.current = requestAnimationFrame(detectionLoop);
  }, [camera.videoRef, handDetection, faceDetection, poseDetection, onDiagnosticsUpdate]);

  // Iniciar loop cuando todo esté listo
  useEffect(() => {
    if (camera.status === "ready" && isInitialized) {
      detectionLoop();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [camera.status, isInitialized, detectionLoop]);

  // Exponer los detectores para el Header
  useEffect(() => {
    if (onDiagnosticsUpdate) {
      onDiagnosticsUpdate((prev) => ({
        ...prev,
        _detectors: { handDetection, faceDetection, poseDetection },
        _camera: camera,
      }));
    }
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="camera-view" id="camera-view">
      {/* Estado de carga */}
      {(camera.status === "idle" || camera.status === "loading") && (
        <div className="camera-overlay loading-overlay" id="camera-loading">
          <div className="loading-content">
            <div className="loading-spinner-large" />
            <p className="loading-text">
              {camera.status === "idle"
                ? "Preparando cámara..."
                : "Conectando con PS3 Eye..."}
            </p>
            <p className="loading-subtext">
              Cargando modelos de IA ({
                [handDetection.isLoading, faceDetection.isLoading, poseDetection.isLoading]
                  .filter(Boolean).length
              }/3)
            </p>
          </div>
        </div>
      )}

      {/* Error */}
      {(camera.status === "error" || camera.status === "denied") && (
        <div className="camera-overlay error-overlay" id="camera-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <p className="error-text">{camera.error}</p>
            <button
              className="retry-button"
              id="btn-retry-camera"
              onClick={camera.startCamera}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Video (siempre presente pero puede estar oculto) */}
      <video
        ref={camera.videoRef}
        className="camera-video"
        id="camera-video"
        autoPlay
        playsInline
        muted
      />

      {/* Canvas overlay para landmarks */}
      <canvas
        ref={canvasRef}
        className="landmarks-canvas"
        id="landmarks-canvas"
      />

      {/* Borde glow cuando detecta manos */}
      {camera.status === "ready" && (
        <div
          className={`detection-glow ${
            handDetection.results?.current?.landmarks?.length > 0
              ? "glow-active"
              : ""
          }`}
        />
      )}

      {/* Exponer detectores al padre */}
      <DetectorExposer
        camera={camera}
        handDetection={handDetection}
        faceDetection={faceDetection}
        poseDetection={poseDetection}
      />
    </div>
  );
}

/**
 * Componente invisible para pasar refs de detectores al padre via callback ref
 */
function DetectorExposer({ camera, handDetection, faceDetection, poseDetection }) {
  // Usamos un div invisible con data attrs para que el padre pueda acceder
  return (
    <div
      style={{ display: "none" }}
      ref={(el) => {
        if (el) {
          el._detectors = { handDetection, faceDetection, poseDetection };
          el._camera = camera;
        }
      }}
      className="detector-exposer"
    />
  );
}
