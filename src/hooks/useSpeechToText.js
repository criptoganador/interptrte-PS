import { useState, useEffect, useCallback, useRef } from "react";
import * as Vosk from 'vosk-browser';

export function useSpeechToText(preferredMicDeviceId) {
  const [isListening, setIsListening] = useState(false);
  const [isModelLoading, setIsModelLoading] = useState(false);
  const [messages, setMessages] = useState([]); // Historial de burbujas
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [recognitionError, setRecognitionError] = useState("");
  
  const modelRef = useRef(null);
  const recognizerRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioStreamRef = useRef(null);
  const finalRef = useRef("");
  const timerRef = useRef(null);

  // Inicializar modelo Vosk offline al montar
  useEffect(() => {
    let isMounted = true;
    const initVosk = async () => {
      try {
        if (!modelRef.current) {
          setIsModelLoading(true);
          // Ruta al archivo del modelo en la carpeta public
          const model = await Vosk.createModel('/models/vosk-model-small-es-0.42.zip');
          if (isMounted) {
            modelRef.current = model;
            setIsModelLoading(false);
            console.log("✅ Modelo Vosk cargado exitosamente");
          } else {
            model.terminate();
          }
        }
      } catch (err) {
        console.error("❌ Error cargando modelo Vosk offline:", err);
        if (isMounted) {
          setRecognitionError("No se pudo cargar el modelo de IA offline. Verifica que se descargó correctamente.");
          setIsModelLoading(false);
        }
      }
    };
    initVosk();

    return () => {
      isMounted = false;
      if (modelRef.current) {
        modelRef.current.terminate();
      }
    };
  }, []);

  const stopAudioStream = useCallback(async () => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (audioContextRef.current) {
      if (audioContextRef.current.state !== 'closed') {
        await audioContextRef.current.close().catch(console.error);
      }
      audioContextRef.current = null;
    }
    if (recognizerRef.current) {
      recognizerRef.current.free();
      recognizerRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(async () => {
    if (isListening || !modelRef.current) {
      if (!modelRef.current) setRecognitionError("El modelo de IA offline aún está cargando.");
      return;
    }

    try {
      setRecognitionError("");
      
      // SOLUCIÓN 2: Limpieza exhaustiva antes de pedir un nuevo stream
      await stopAudioStream(); 

      // SOLUCIÓN 1: Validar si el deviceId sigue existiendo para no mandar un ID fantasma o caducado
      let validDeviceId = null;
      if (preferredMicDeviceId) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const deviceExists = devices.some(d => d.kind === 'audioinput' && d.deviceId === preferredMicDeviceId);
        if (deviceExists) {
          validDeviceId = preferredMicDeviceId;
        } else {
          console.warn("El micrófono preferido ya no está conectado o el ID caducó. Usando el predeterminado.");
        }
      }

      const mediaConstraints = validDeviceId
        ? { audio: { deviceId: { exact: validDeviceId }, echoCancellation: true, noiseSuppression: true } }
        : { audio: { echoCancellation: true, noiseSuppression: true } };

      const stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      audioStreamRef.current = stream;

      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;

      // Crear reconocedor usando el modelo cargado
      const recognizer = new modelRef.current.KaldiRecognizer(16000);
      recognizerRef.current = recognizer;

      recognizer.on("result", (message) => {
        const text = message.result.text;
        if (text && text.trim() !== "") {
          setFinalTranscript(prev => {
             const newFinal = (prev + " " + text).trim();
             finalRef.current = newFinal;
             return newFinal;
          });
          setInterimTranscript("");
          
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            if (finalRef.current.trim() !== "") {
              setMessages(prev => [...prev, { id: Date.now(), text: finalRef.current.trim() }]);
              setFinalTranscript("");
              finalRef.current = "";
            }
          }, 2500);
        }
      });

      recognizer.on("partialresult", (message) => {
        const partial = message.result.partial;
        if (partial && partial.trim() !== "") {
           setInterimTranscript(partial);
        }
      });

      const source = audioContext.createMediaStreamSource(stream);
      const recognizerNode = audioContext.createScriptProcessor(4096, 1, 1);
      
      recognizerNode.onaudioprocess = (event) => {
        try {
          if (recognizerRef.current) {
            recognizerRef.current.acceptWaveform(event.inputBuffer);
          }
        } catch (error) {
          console.error("Error en procesamiento de audio Vosk:", error);
        }
      };

      source.connect(recognizerNode);
      recognizerNode.connect(audioContext.destination);

      setIsListening(true);
    } catch (err) {
      console.error("Error al iniciar micrófono o modelo:", err);
      setIsListening(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError" || err.name === "OverconstrainedError") {
        setRecognitionError('Permiso de micrófono denegado o dispositivo desconectado. Verifica los permisos.');
      } else {
        setRecognitionError('Error al iniciar el micrófono: ' + (err.message || err.name));
      }
      await stopAudioStream();
    }
  }, [isListening, preferredMicDeviceId, stopAudioStream]);

  // Escuchar activamente cuando se conecta/desconecta un USB en caliente
  useEffect(() => {
    const handleDeviceChange = async () => {
      // Refresca la lista interna de dispositivos de Chromium automáticamente
      await navigator.mediaDevices.enumerateDevices();
    };
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
  }, []);

  const stopListening = useCallback(() => {
    stopAudioStream();
    if (finalRef.current.trim() !== "") {
      setMessages(prev => [...prev, { id: Date.now(), text: finalRef.current.trim() }]);
      setFinalTranscript("");
      finalRef.current = "";
    }
  }, [stopAudioStream]);

  const clearTranscript = useCallback(() => {
    setMessages([]);
    setFinalTranscript("");
    setInterimTranscript("");
    setRecognitionError("");
    finalRef.current = "";
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  return {
    isListening,
    isModelLoading,
    messages,
    finalTranscript,
    interimTranscript,
    recognitionError,
    startListening,
    stopListening,
    clearTranscript
  };
}
