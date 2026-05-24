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
  
  // Soporte para múltiples cámaras
  const [cameras, setCameras] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [microphones, setMicrophones] = useState([]);
  const [selectedMicId, setSelectedMicId] = useState("");

  const enumerateMediaDevices = useCallback(async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      const audioDevices = devices.filter(device => device.kind === 'audioinput');

      setCameras(videoDevices);
      setMicrophones(audioDevices);

      return { videoDevices, audioDevices };
    } catch (err) {
      console.warn('Error enumerando dispositivos:', err);
      return { videoDevices: [], audioDevices: [] };
    }
  }, []);

  const startCamera = useCallback(async () => {
    setStatus("loading");
    setError(null);

    try {
      const { videoDevices, audioDevices } = await enumerateMediaDevices();

      let cameraDeviceId = selectedDeviceId && videoDevices.some((d) => d.deviceId === selectedDeviceId)
        ? selectedDeviceId
        : videoDevices[0]?.deviceId || "";

      let micDeviceId = selectedMicId && audioDevices.some((d) => d.deviceId === selectedMicId)
        ? selectedMicId
        : audioDevices[0]?.deviceId || "";

      if (!selectedDeviceId && cameraDeviceId) {
        setSelectedDeviceId(cameraDeviceId);
      }
      if (!selectedMicId && micDeviceId) {
        setSelectedMicId(micDeviceId);
      }

      const audioConstraints = micDeviceId ? { deviceId: { exact: micDeviceId } } : null;
      const constraints = {
        video: {
          width: { ideal: CAMERA_CONFIG.width },
          height: { ideal: CAMERA_CONFIG.height },
          frameRate: { ideal: CAMERA_CONFIG.frameRate },
          ...(cameraDeviceId ? { deviceId: { exact: cameraDeviceId } } : {})
        },
        ...(audioConstraints ? { audio: audioConstraints } : {}),
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Actualizar selección de dispositivos si se eligieron automáticamente
      if (!selectedDeviceId && cameraDeviceId) {
        setSelectedDeviceId(cameraDeviceId);
      }
      if (!selectedMicId && micDeviceId) {
        setSelectedMicId(micDeviceId);
      }

      // Obtener nombre del dispositivo
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        setDeviceName(videoTrack.label || "Cámara detectada");
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        const checkReady = () => {
          if (videoRef.current && videoRef.current.readyState >= 2) {
            setStatus("ready");
          }
        };

        videoRef.current.addEventListener("loadeddata", checkReady, { once: true });
        checkReady();
      }
    } catch (err) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setStatus("denied");
        setError("Permiso de cámara denegado. Por favor, permite el acceso a la cámara.");
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        const { videoDevices } = await enumerateMediaDevices();
        if (videoDevices.length > 0) {
          setSelectedDeviceId(videoDevices[0].deviceId);
          setStatus("loading");
          await startCamera();
          return;
        }

        setStatus("error");
        setError("No se encontró ninguna cámara. Verifica que la PS3 Eye esté conectada.");
      } else {
        setStatus("error");
        setError(`Error al acceder a la cámara: ${err.message}`);
      }
      console.error("Camera error:", err);
    }
  }, [selectedDeviceId, selectedMicId, cameras.length, microphones.length]); // Añadir dependencias

  // Cambiar de cámara en tiempo real
  const switchCamera = useCallback((deviceId) => {
    if (deviceId === selectedDeviceId) return;
    setSelectedDeviceId(deviceId);
  }, [selectedDeviceId]);

  const switchMicrophone = useCallback((deviceId) => {
    if (deviceId === selectedMicId) return;
    setSelectedMicId(deviceId);
  }, [selectedMicId]);

  const hasStartedRef = useRef(false);

  useEffect(() => {
    const handleDeviceChange = async () => {
      const { audioDevices, videoDevices } = await enumerateMediaDevices();

      if (!selectedMicId && audioDevices.length > 0) {
        setSelectedMicId(audioDevices[0].deviceId);
        if (status === 'ready' || status === 'idle') {
          startCamera();
        }
      }

      if (selectedMicId && !audioDevices.some((device) => device.deviceId === selectedMicId) && audioDevices.length > 0) {
        setSelectedMicId(audioDevices[0].deviceId);
      }

      if (!selectedDeviceId && videoDevices.length > 0) {
        setSelectedDeviceId(videoDevices[0].deviceId);
      }
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateMediaDevices, selectedDeviceId, selectedMicId, startCamera, status]);

  useEffect(() => {
    if (!streamRef.current) return;
    if (!hasStartedRef.current) {
      hasStartedRef.current = true;
      return;
    }

    streamRef.current.getTracks().forEach((track) => track.stop());
    startCamera();
  }, [selectedDeviceId, selectedMicId, startCamera]);

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
    cameras,
    microphones,
    selectedDeviceId,
    selectedMicId,
    switchCamera,
    switchMicrophone,
    startCamera,
    stopCamera,
  };
}
