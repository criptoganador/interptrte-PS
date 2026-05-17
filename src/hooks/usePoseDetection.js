/**
 * usePoseDetection — Hook para detección de pose corporal con MediaPipe PoseLandmarker
 * Detecta 33 puntos del cuerpo (torso, brazos, hombros)
 */

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { FilesetResolver, PoseLandmarker } from "@mediapipe/tasks-vision";
import { WASM_CDN, MODEL_URLS, POSE_CONFIG } from "../utils/mediapipeConfig";

export function usePoseDetection() {
  const detectorRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isEnabled, setIsEnabled] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const resultsRef = useRef(null);

  const initialize = useCallback(async () => {
    if (detectorRef.current) return;
    setIsLoading(true);

    try {
      const vision = await FilesetResolver.forVisionTasks(WASM_CDN);

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URLS.pose,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numPoses: POSE_CONFIG.numPoses,
        minPoseDetectionConfidence: POSE_CONFIG.minPoseDetectionConfidence,
        minPosePresenceConfidence: POSE_CONFIG.minPosePresenceConfidence,
        minTrackingConfidence: POSE_CONFIG.minTrackingConfidence,
      });

      detectorRef.current = poseLandmarker;
      setIsReady(true);
      console.log("✅ PoseLandmarker inicializado");
    } catch (err) {
      console.error("❌ Error inicializando PoseLandmarker:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const detect = useCallback((videoElement, timestamp) => {
    if (!detectorRef.current || !isEnabled) return null;

    try {
      const results = detectorRef.current.detectForVideo(videoElement, timestamp);
      resultsRef.current = results;
      return results;
    } catch (err) {
      return null;
    }
  }, [isEnabled]);

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
