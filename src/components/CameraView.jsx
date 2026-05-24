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

export function CameraView({ 
  onDiagnosticsUpdate, 
  onFrameRecord, 
  isRecording, 
  collector, 
  translation,
  isTheatreMode,
  onToggleTheatreMode,
  onPreferredMicChange
}) {
  const canvasRef = useRef(null);
  const animationRef = useRef(null);
  const fpsRef = useRef(null);
  const detectionLoopRef = useRef(null);
  const lastTimestampRef = useRef(0);
  const lastDiagUpdateRef = useRef(0); // Para el throttle de diagnósticos
  const [isInitialized, setIsInitialized] = useState(false);
  const [handsCount, setHandsCount] = useState(0);
  const handsCountRef = useRef(0);
  const [sentence, setSentence] = useState([]); // Estado para la frase completa

  // Referencia para mantener actualizado el prop translation sin provocar re-creación de callbacks
  const translationRef = useRef(translation);
  
  useEffect(() => {
    translationRef.current = translation;
  }, [translation]);

  // Auto-hablar y limpiar frase tras 2 segundos de inactividad
  useEffect(() => {
    if (sentence.length > 0) {
      const timer = setTimeout(() => {
        if (sentence.length > 1) {
          // Si hay más de una palabra, la lee de corrido con mejor fluidez
          translationRef.current.speakText(sentence.join(" "));
        }
        setSentence([]); // Limpiar la pantalla para la siguiente oración
      }, 2000); // 2 segundos de pausa (antes 3000)

      return () => clearTimeout(timer);
    }
    // Solo dependemos de 'sentence' para que los updates del modelo no reseteen el timer infinito
  }, [sentence]);

  const {
    videoRef: cameraVideoRef,
    status: cameraStatus,
    error: cameraError,
    deviceName: cameraDeviceName,
    cameras: availableCameras,
    microphones: availableMicrophones,
    selectedDeviceId,
    selectedMicId,
    switchCamera,
    switchMicrophone,
    startCamera,
    stopCamera,
  } = useCamera();

  useEffect(() => {
    if (typeof onPreferredMicChange === "function") {
      onPreferredMicChange(selectedMicId);
    }
  }, [selectedMicId, onPreferredMicChange]);

  const handDetection = useHandDetection();
  const faceDetection = useFaceDetection();
  const poseDetection = usePoseDetection();



  // Para evitar hablar múltiples veces la misma seña seguida
  const lastSpokenRef = useRef("");

  // Inicializar todo al montar
  useEffect(() => {
    async function init() {
      // Iniciar cámara
      await startCamera();

      // Permitir que el loop de detección inicie inmediatamente para mostrar el video
      setIsInitialized(true);

      // Inicializar detectores secuencialmente por prioridad para no saturar la red ni congelar la GPU
      // 1. Manos (Vital para la traducción, queremos que aparezca rápido)
      await handDetection.initialize();
      // 2. Pose (Anclaje del cuerpo)
      await poseDetection.initialize();
      // 3. Rostro (Más pesado, carga en segundo plano)
      faceDetection.initialize(); // Sin await para que termine de cargar cuando pueda
    }

    init();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      stopCamera();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Loop de detección y renderizado
  const detectionLoop = useCallback(() => {
    const video = cameraVideoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || video.readyState < 2) {
      animationRef.current = requestAnimationFrame(detectionLoopRef.current);
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
      animationRef.current = requestAnimationFrame(detectionLoopRef.current);
      return;
    }
    lastTimestampRef.current = now;

    // Inicializar FPS lazily para evitar funciones impuras en render
    if (!fpsRef.current) {
      fpsRef.current = { frames: 0, lastTime: now, value: 0 };
    }

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
    // Detectar pose (dibujar primero, debajo de todo)
    const poseResults = poseDetection.detect(video, now);
    if (poseResults?.landmarks?.[0]) {
      drawPoseLandmarks(ctx, poseResults.landmarks[0], canvas.width, canvas.height);
    }

    // Detectar rostro
    const faceResults = faceDetection.detect(video, now);
    if (faceResults?.faceLandmarks?.[0]) {
      drawFaceMesh(ctx, faceResults.faceLandmarks[0], canvas.width, canvas.height);
    }

    // Detectar manos (dibujar encima de todo)
    const handResults = handDetection.detect(video, now);
    if (handResults?.landmarks) {
      for (let i = 0; i < handResults.landmarks.length; i++) {
        const handedness = handResults.handednesses?.[i]?.[0]?.categoryName || "Right";
        drawHandLandmarks(ctx, handResults.landmarks[i], handedness, canvas.width, canvas.height);
      }
    }

    // Sincronizar número de manos detectadas de forma reactiva (evitando render lag)
    const currentHandsCount = handResults?.landmarks?.length || 0;
    if (currentHandsCount !== handsCountRef.current) {
      handsCountRef.current = currentHandsCount;
      setHandsCount(currentHandsCount);
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
        if (window._noHandsTimer) {
          clearTimeout(window._noHandsTimer);
          window._noHandsTimer = null;
        }
        currentSign = translationRef.current.translateFrame({
          hands: handResults.landmarks,
          handednesses: handResults.handednesses?.map(h => h[0]?.categoryName) || [],
          pose: poseResults?.landmarks?.[0] || []
        });
      } else {
        // Le avisamos a la IA que no hay manos para que limpie su historial
        currentSign = translationRef.current.translateFrame(null);
        // Si baja la mano, esperamos 400ms antes de olvidar la última seña. 
        // Esto evita tartamudeos (flicker) pero permite cambiar de mano rápido.
        if (!window._noHandsTimer) {
          window._noHandsTimer = setTimeout(() => {
            lastSpokenRef.current = "";
            window._noHandsTimer = null;
          }, 400); // Antes 1000
        }
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

    animationRef.current = requestAnimationFrame(detectionLoopRef.current);
  }, [cameraVideoRef, handDetection, faceDetection, poseDetection, onDiagnosticsUpdate, onFrameRecord, isRecording]);

  // Sincronizar referencia del loop para evitar TDZ en llamadas recursivas
  useEffect(() => {
    detectionLoopRef.current = detectionLoop;
  }, [detectionLoop]);

  // Iniciar loop cuando todo esté listo
  useEffect(() => {
    if (cameraStatus === "ready" && isInitialized) {
      detectionLoop();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraStatus, isInitialized, detectionLoop]);

  // Exponer los detectores para el Header (fuera de render)
  useEffect(() => {
    if (onDiagnosticsUpdate) {
      onDiagnosticsUpdate((prev) => ({
        ...prev,
        _detectors: { handDetection, faceDetection, poseDetection },
        _camera: {
          videoRef: cameraVideoRef,
          status: cameraStatus,
          error: cameraError,
          deviceName: cameraDeviceName,
          cameras: availableCameras,
          selectedDeviceId,
          switchCamera,
          startCamera,
          stopCamera
        },
      }));
    }
    // Solo al montar
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="camera-view" id="camera-view">
      {/* Menú de selección de Cámara y Micrófono */}
      <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 50, display: 'flex', gap: '8px', alignItems: 'center' }}>
        <div style={{
          color: 'white',
          background: 'rgba(0,0,0,0.6)',
          border: '1px solid rgba(255,255,255,0.3)',
          padding: '4px 8px',
          borderRadius: '4px',
          fontSize: '0.8rem',
          whiteSpace: 'nowrap'
        }}>
          🎤 Micrófono y voz
        </div>

        {availableCameras && availableCameras.length > 1 && (
          <select 
            value={selectedDeviceId} 
            onChange={(e) => switchCamera(e.target.value)}
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
            {availableCameras.map((cam, idx) => (
              <option key={cam.deviceId} value={cam.deviceId}>
                📷 {cam.label || `Cámara ${idx + 1}`}
              </option>
            ))}
          </select>
        )}

        {availableMicrophones && availableMicrophones.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              value={selectedMicId}
              onChange={(e) => switchMicrophone(e.target.value)}
              style={{
                background: 'rgba(0,0,0,0.6)',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.3)',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                outline: 'none',
                cursor: 'pointer',
                maxWidth: '220px',
                textOverflow: 'ellipsis'
              }}
              title="Seleccionar Micrófono"
            >
              {availableMicrophones.map((mic, idx) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  🎤 {mic.label || `Micrófono ${idx + 1}`}
                </option>
              ))}
            </select>
          </div>
        )}

        {translation.voices && translation.voices.length > 0 && (
          <select
            value={translation.selectedVoiceURI}
            onChange={(e) => translation.changeVoice(e.target.value)}
            style={{
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '0.8rem',
              outline: 'none',
              cursor: 'pointer',
              maxWidth: '220px',
              textOverflow: 'ellipsis'
            }}
            title="Seleccionar voz para la lectura"
          >
            {translation.voices.filter(v => v.lang.startsWith('es')).map((v, idx) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name.includes('Sabina') || v.name.includes('Helena') || v.name.includes('Laura') ? '👩 Voz Mujer' :
                 v.name.includes('Pablo') || v.name.includes('Tomas') ? '👨 Voz Hombre' :
                 `🗣️ ${v.name}`}
              </option>
            ))}
          </select>
        )}

        {availableMicrophones && availableMicrophones.length === 0 && (
          <div style={{
            color: 'white',
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.3)',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '0.8rem'
          }}>
            🎤 Sin micrófono
          </div>
        )}
      </div>

      {/* Estado de carga */}
      {(cameraStatus === "idle" || cameraStatus === "loading") && (
        <div className="camera-overlay loading-overlay" id="camera-loading">
          <div className="loading-content">
            <div className="loading-spinner-large" />
            <p className="loading-text">
              {cameraStatus === "idle"
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
      {(cameraStatus === "error" || cameraStatus === "denied") && (
        <div className="camera-overlay error-overlay" id="camera-error">
          <div className="error-content">
            <span className="error-icon">⚠️</span>
            <p className="error-text">{cameraError}</p>
            <button
              className="retry-button"
              id="btn-retry-camera"
              onClick={startCamera}
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Video (siempre presente pero puede estar oculto) */}
      <video
        ref={cameraVideoRef}
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
      {cameraStatus === "ready" && (
        <div
          className={`detection-glow ${
            handsCount > 0
              ? "glow-active"
              : ""
          }`}
        />
      )}

      {/* Subtítulos tipo YouTube (CC) */}
      <div className="youtube-subtitles-container">
        {collector?.countdown > 0 && (
          <div className="youtube-cc-line">
            ⏳ Prepárate... {collector.countdown}
          </div>
        )}
        
        {isRecording && !collector?.countdown && (
          <div className="youtube-cc-line recording">
            🔴 GRABANDO SEÑA: {collector.currentLabel || 'SEÑA'}
          </div>
        )}

        {!isRecording && !collector?.countdown && translation.currentTranslation && (
          <div className="youtube-cc-line translation">
            {translation.currentTranslation}
          </div>
        )}

        {!isRecording && !collector?.countdown && !translation.currentTranslation && sentence.length > 0 && (
          <div className="youtube-cc-line">
            {sentence.join(" ")}
          </div>
        )}

        {!isRecording && !collector?.countdown && !translation.currentTranslation && sentence.length === 0 && (
          <div className="youtube-cc-line" style={{ opacity: 0.5, fontSize: '15px' }}>
            [ Esperando señas en Lengua de Señas Venezolana ]
          </div>
        )}
      </div>

      {/* Barra de Controles tipo YouTube Player */}
      <div className="youtube-controls-bar">
        {/* Barra roja de reproducción decorativa */}
        <div className="youtube-progress-line">
          <div className="youtube-progress-fill" />
        </div>

        <div className="youtube-controls-left">
          <div className="youtube-live-badge">
            <span className="youtube-live-dot" />
            En Vivo
          </div>
          <span className="youtube-device-info">
            {cameraDeviceName || "Cámara Activa"}
          </span>
        </div>

        <div className="youtube-controls-right">
          <span className="youtube-badge cc">CC</span>
          <span className="youtube-badge hd">HD</span>

          {/* Botón de Modo Cine / Teatro estilo YouTube */}
          <button 
            className="youtube-control-btn theatre-toggle-btn"
            onClick={onToggleTheatreMode}
            title={isTheatreMode ? "Modo por defecto" : "Modo cine (Agrandar cámara)"}
            style={{
              background: "transparent",
              border: "none",
              color: "white",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              opacity: 0.8,
              transition: "opacity 0.15s, transform 0.15s",
              outline: "none"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = 1; e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = 0.8; e.currentTarget.style.transform = "scale(1)"; }}
          >
            {isTheatreMode ? (
              // Icono de modo por defecto (pantalla más pequeña)
              <svg viewBox="0 0 36 36" width="22" height="22" fill="white">
                <path d="M25 17H11v2h14v-2zm3-6H8c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V13c0-1.1-.9-2-2-2zm-1 11H9V14h18v8z" />
              </svg>
            ) : (
              // Icono de modo cine (pantalla ancha)
              <svg viewBox="0 0 36 36" width="22" height="22" fill="white">
                <path d="M28 11H8c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h20c1.1 0 2-.9 2-2V13c0-1.1-.9-2-2-2zm-1 11H9v-8h18v8z" />
              </svg>
            )}
          </button>

          {handsCount > 0 && (
            <span className="youtube-badge hands">
              🖐️ {handsCount} Mano{handsCount > 1 ? "s" : ""}
            </span>
          )}
        </div>
      </div>

      {/* Exponer detectores al padre */}
      <DetectorExposer
        cameraRef={cameraVideoRef}
        cameraStatus={cameraStatus}
        cameraDeviceName={cameraDeviceName}
        cameraError={cameraError}
        availableCameras={availableCameras}
        selectedDeviceId={selectedDeviceId}
        switchCamera={switchCamera}
        startCamera={startCamera}
        stopCamera={stopCamera}
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
function DetectorExposer({
  cameraRef,
  cameraStatus,
  cameraDeviceName,
  cameraError,
  availableCameras,
  selectedDeviceId,
  switchCamera,
  startCamera,
  stopCamera,
  handDetection,
  faceDetection,
  poseDetection
}) {
  // Usamos un div invisible con data attrs para que el padre pueda acceder
  return (
    <div
      style={{ display: "none" }}
      ref={(el) => {
        if (el) {
          el._detectors = { handDetection, faceDetection, poseDetection };
          el._camera = {
            videoRef: cameraRef,
            status: cameraStatus,
            error: cameraError,
            deviceName: cameraDeviceName,
            cameras: availableCameras,
            selectedDeviceId,
            switchCamera,
            startCamera,
            stopCamera
          };
        }
      }}
      className="detector-exposer"
    />
  );
}
