/**
 * useHandDetection — Hook para detección de manos con MediaPipe HandLandmarker
 * Detecta hasta 2 manos con 21 landmarks cada una
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";
import { WASM_CDN, MODEL_URLS, HAND_CONFIG } from "../utils/mediapipeConfig";

export function useHandDetection() {
  const detectorRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const resultsRef = useRef(null);

  // Inicializar el detector
  const initialize = useCallback(async () => {
    if (detectorRef.current) return;
    setIsLoading(true);

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      const handLandmarker = await HandLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URLS.hand,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numHands: HAND_CONFIG.numHands,
        minHandDetectionConfidence: HAND_CONFIG.minHandDetectionConfidence,
        minHandPresenceConfidence: HAND_CONFIG.minHandPresenceConfidence,
        minTrackingConfidence: HAND_CONFIG.minTrackingConfidence,
      });

      detectorRef.current = handLandmarker;
      setIsReady(true);
      console.log("✅ HandLandmarker inicializado");
    } catch (err) {
      console.error("❌ Error inicializando HandLandmarker:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Detectar manos en un frame de video
  const detect = useCallback((videoElement, timestamp) => {
    if (!detectorRef.current || !isEnabled) return null;

    try {
      const results = detectorRef.current.detectForVideo(videoElement, timestamp);
      resultsRef.current = results;
      return results;
    } catch (err) {
      // Silenciar errores de frames inválidos
      return null;
    }
  }, [isEnabled]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
    };
  }, []);

  return useMemo(() => ({
    initialize,
    detect,
    isReady,
    isEnabled,
    setIsEnabled,
    isLoading,
    results: resultsRef,
  }), [initialize, detect, isReady, isEnabled, isLoading]);
}
