/**
 * useFaceDetection — Hook para detección facial con MediaPipe FaceLandmarker
 * Detecta 478 puntos faciales + blendshapes para expresiones
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { FilesetResolver, FaceLandmarker } from "@mediapipe/tasks-vision";
import { WASM_CDN, MODEL_URLS, FACE_CONFIG } from "../utils/mediapipeConfig";

export function useFaceDetection() {
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

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: MODEL_URLS.face,
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: FACE_CONFIG.numFaces,
        minFaceDetectionConfidence: FACE_CONFIG.minFaceDetectionConfidence,
        minFacePresenceConfidence: FACE_CONFIG.minFacePresenceConfidence,
        minTrackingConfidence: FACE_CONFIG.minTrackingConfidence,
        outputFaceBlendshapes: FACE_CONFIG.outputFaceBlendshapes,
        outputFacialTransformationMatrixes: FACE_CONFIG.outputFacialTransformationMatrixes,
      });

      detectorRef.current = faceLandmarker;
      setIsReady(true);
      console.log("✅ FaceLandmarker inicializado");
    } catch (err) {
      console.error("❌ Error inicializando FaceLandmarker:", err);
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

  // Extraer las expresiones principales de los blendshapes
  const getTopExpressions = useCallback((blendshapes, topN = 3) => {
    if (!blendshapes || blendshapes.length === 0) return [];

    const categories = blendshapes[0]?.categories || [];
    return [...categories]
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((c) => ({
        name: c.categoryName,
        score: Math.round(c.score * 100),
      }));
  }, []);

  useEffect(() => {
    return () => {
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
    };
  }, []);

  return {
    initialize,
    detect,
    getTopExpressions,
    isReady,
    isEnabled,
    setIsEnabled,
    isLoading,
    results: resultsRef,
  };
}
