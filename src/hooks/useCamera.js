/**
 * useCamera — Hook para acceder a la cámara PS3 Eye
 * Maneja permisos, stream de video y estados de conexión
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { CAMERA_CONFIG } from "../utils/mediapipeConfig";

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error | denied
  const [error, setError] = useState(null);
  const [deviceName, setDeviceName] = useState("");

  const startCamera = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const constraints = {
        video: {
          width: { ideal: CAMERA_CONFIG.width },
          height: { ideal: CAMERA_CONFIG.height },
          frameRate: { ideal: CAMERA_CONFIG.frameRate },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Obtener nombre del dispositivo
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setDeviceName(videoTrack.label || "Cámara detectada");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadeddata = () => {
          setStatus("ready");
        };
      }
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setStatus("denied");
        setError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        setStatus("error");
        setError("No se encontró ninguna cámara. Verifica que la PS3 Eye esté conectada.");
      } else {
        setStatus("error");
        setError(`Error al acceder a la cámara: ${err.message}`);
      }
      console.error("Camera error:", err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  // Cleanup al desmontar
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  return {
    videoRef,
    status,
    error,
    deviceName,
    startCamera,
    stopCamera,
  };
}
