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

export function CameraView({ onDiagnosticsUpdate, onFrameRecord, isRecording, collector, translation }) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const fpsRef = useRef({ frames: 0, lastTime: performance.now(), value: 0 });
  const lastTimestampRef = useRef(0);
  const lastDiagUpdateRef = useRef(0); // Para el throttle de diagnósticos
  const [isInitialized, setIsInitialized] = useState(false);
  const [sentence, setSentence] = useState([]); // Estado para la frase completa

  // Auto-hablar y limpiar frase tras 4 segundos de inactividad
  useEffect(() => {
    if (sentence.length > 0) {
      const timer = setTimeout(() => {
        if (sentence.length > 1) {
          // Si hay más de una palabra, la lee de corrido con mejor fluidez
          translation.speakText(sentence.join(" "));
        }
        setSentence([]); // Limpiar la pantalla para la siguiente oración
      }, 4000); // 4 segundos de pausa

      return () => clearTimeout(timer);
    }
  }, [sentence, translation]);

  const camera = useCamera();
  const handDetection = useHandDetection();
  const faceDetection = useFaceDetection();
  const poseDetection = usePoseDetection();

  // Ref para acceder siempre a la última traducción en el loop sin causar re-renders
  const translationRef = useRef(translation);
  useEffect(() => {
    translationRef.current = translation;
  }, [translation]);

  // Para evitar hablar múltiples veces la misma seña seguida
  const lastSpokenRef = useRef("");

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

    // === GRABACIÓN DE DATOS (HITO 2) ===
    if (isRecording && onFrameRecord) {
      onFrameRecord({
        hands: handResults?.landmarks || [],
        handednesses: handResults?.handednesses?.map(h => h[0]?.categoryName) || [],
        face: faceResults?.faceLandmarks?.[0] || [],
        pose: poseResults?.landmarks?.[0] || [],
        blendshapes: faceResults?.faceBlendshapes?.[0]?.categories || []
      });
    } else {
      // === TRADUCCIÓN EN TIEMPO REAL (HITO 4) ===
      // Solo traducimos si NO estamos grabando muestras
      let currentSign = null;
      
      if (handResults && handResults.landmarks.length > 0) {
        currentSign = translationRef.current.translateFrame({
          hands: handResults.landmarks,
          handednesses: handResults.handednesses?.map(h => h[0]?.categoryName) || [],
          pose: poseResults?.landmarks?.[0] || []
        });
      } else {
        // Le avisamos a la IA que no hay manos para que limpie su historial
        currentSign = translationRef.current.translateFrame(null);
        // Si baja la mano, olvidamos la última seña que dijimos
        lastSpokenRef.current = "";
      }
      
      // Si hay una seña nueva y estable, y es diferente a la última hablada
      if (currentSign && currentSign !== lastSpokenRef.current) {
        lastSpokenRef.current = currentSign;
        
        // Añadir a la oración
        setSentence(prev => [...prev, currentSign]);
        
        // Hablar automáticamente
        translationRef.current.speakText(currentSign);
      }
    }

    // === ACTUALIZAR DIAGNÓSTICOS (Throttle: 200ms) ===
    if (onDiagnosticsUpdate && (now - lastDiagUpdateRef.current > 200)) {
      lastDiagUpdateRef.current = now;
      
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
  }, [camera.videoRef, handDetection, faceDetection, poseDetection, onDiagnosticsUpdate, onFrameRecord, isRecording]);

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
      {/* Menú de selección de Cámara (solo visible si hay más de 1) */}
      {camera.cameras && camera.cameras.length > 1 && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 50 }}>
          <select 
            value={camera.selectedDeviceId} 
            onChange={(e) => camera.switchCamera(e.target.value)}
            style={{ 
              background: 'rgba(0,0,0,0.6)', 
              color: 'white', 
              border: '1px solid rgba(255,255,255,0.3)', 
              padding: '4px 8px', 
              borderRadius: '4px',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '180px',
              textOverflow: 'ellipsis'
            }}
            title="Cambiar Cámara"
          >
            {camera.cameras.map((cam, idx) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                📷 {cam.label || `Cámara ${idx + 1}`}
              </option>
            ))}
          </select>
        </div>
      )}

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

      {/* Barra de subtítulos / traducción / oraciones */}
      <div className="subtitle-bar" id="subtitle-bar" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        
        {/* Línea Superior: La frase construida */}
        {!isRecording && sentence.length > 0 && (
          <div className="sentence-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <p className="sentence-text" style={{ fontSize: '1.4rem', color: '#fff', fontWeight: 'bold', margin: 0, textAlign: 'center' }}>
              {sentence.length > 7 
                ? "... " + sentence.slice(-7).join(" ") 
                : sentence.join(" ")}
            </p>
          </div>
        )}

        {/* Línea Inferior: La seña actual o estado de grabación */}
        <div className="subtitle-content-bottom" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="subtitle-content" style={{ flex: 1 }}>
            <span className="subtitle-icon">
              {isRecording ? "🔴" : collector?.countdown > 0 ? "⏳" : translation.currentTranslation ? "🗣️" : "🤟"}
            </span>
            <p className={`subtitle-text ${isRecording || translation.currentTranslation ? 'detected' : ''}`} id="subtitle-text" style={{ fontSize: isRecording ? '1.2rem' : '1.1rem', color: translation.currentTranslation ? 'var(--color-primary)' : 'inherit' }}>
              {collector?.countdown > 0 
                ? `Prepárate... ${collector.countdown}` 
                : isRecording 
                  ? `GRABANDO: ${collector.currentLabel || 'SEÑA'}` 
                  : translation.currentTranslation 
                    ? `Detectando: [ ${translation.currentTranslation} ]`
                    : sentence.length === 0 
                      ? "Empieza a hacer señas para armar una frase..."
                      : "Sigue haciendo señas..."}
            </p>
          </div>
          
          <div className="subtitle-indicators" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {translation.voices && translation.voices.length > 0 && (
              <select 
                value={translation.selectedVoiceURI} 
                onChange={(e) => translation.changeVoice(e.target.value)}
                style={{ 
                  background: 'rgba(0,0,0,0.5)', 
                  color: 'white', 
                  border: '1px solid rgba(255,255,255,0.3)', 
                  padding: '4px', 
                  borderRadius: '4px',
                  fontSize: '0.85rem',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '120px',
                  textOverflow: 'ellipsis'
                }}
                title="Seleccionar Voz"
              >
                {translation.voices.map(v => (
                  <option key={v.voiceURI} value={v.voiceURI}>
                    {v.name.includes("Sabina") || v.name.includes("Helena") || v.name.includes("Laura") ? "👩 Voz Mujer" : 
                     v.name.includes("Pablo") || v.name.includes("Tomas") ? "👨 Voz Hombre" : 
                     `🗣️ ${v.name.split(' ')[1] || 'Voz'}`}
                  </option>
                ))}
              </select>
            )}
            {handDetection.results?.current?.landmarks?.length > 0 && (
              <span className="indicator-badge hand-badge">
                🖐️ {handDetection.results.current.landmarks.length} mano{handDetection.results.current.landmarks.length > 1 ? "s" : ""}
              </span>
            )}
            {faceDetection.results?.current?.faceLandmarks?.length > 0 && (
              <span className="indicator-badge face-badge">😊 Rostro</span>
            )}
          </div>
        </div>
      </div>

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
