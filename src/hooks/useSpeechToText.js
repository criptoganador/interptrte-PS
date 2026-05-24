import { useState, useEffect, useCallback, useRef } from "react";

export function useSpeechToText(preferredMicDeviceId) {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]); // Historial de burbujas
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  
  const recognitionRef = useRef(null);
  const audioStreamRef = useRef(null);
  const timerRef = useRef(null);
  const finalRef = useRef("");

  useEffect(() => {
    const requestInitialMicrophone = async () => {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !navigator.mediaDevices.enumerateDevices) return;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasAudioInput = devices.some((device) => device.kind === 'audioinput');
        if (!hasAudioInput) {
          console.warn('No hay ningún dispositivo de audio de entrada disponible.');
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.warn('No se pudo solicitar permiso de micrófono al cargar:', err.name);
      }
    };

    requestInitialMicrophone();

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("⚠️ Este navegador no soporta el reconocimiento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; 
    recognition.interimResults = true; 
    recognition.lang = "es-VE"; 

    recognition.onresult = (event) => {
      let currentInterim = "";
      let currentFinal = "";
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          currentFinal += event.results[i][0].transcript;
        } else {
          currentInterim += event.results[i][0].transcript;
        }
      }
      
      if (currentFinal) {
        setFinalTranscript(prev => {
          const newFinal = prev + currentFinal + " ";
          finalRef.current = newFinal;
          return newFinal;
        });
      }
      setInterimTranscript(currentInterim);
      
      // Manejo de Cajas Dinámicas: Si hay 2.5s de silencio, crear nueva burbuja
      if (timerRef.current) clearTimeout(timerRef.current);
      
      timerRef.current = setTimeout(() => {
        if (finalRef.current.trim() !== "") {
          const newText = finalRef.current.trim();
          setMessages(prev => [...prev, { id: Date.now(), text: newText }]);
          setFinalTranscript(""); // Limpiar para la próxima burbuja
          finalRef.current = "";
        }
      }, 2500); 
    };

    recognition.onerror = (event) => {
      console.error("❌ Error en reconocimiento de voz:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
      // Al apagar el micro, si quedó texto colgado, guardarlo
      if (finalRef.current.trim() !== "") {
        setMessages(prev => [...prev, { id: Date.now(), text: finalRef.current.trim() }]);
        setFinalTranscript("");
        finalRef.current = "";
      }
    };

    recognitionRef.current = recognition;
  }, []);

  const stopAudioStream = useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
  }, []);

  const startListening = useCallback(async () => {
    if (!recognitionRef.current || isListening) return;

    try {
      const mediaConstraints = preferredMicDeviceId
        ? { audio: { deviceId: { exact: preferredMicDeviceId } } }
        : { audio: true };

      if (audioStreamRef.current) {
        stopAudioStream();
      }

      console.log('Iniciando micrófono con constraints:', mediaConstraints);
      audioStreamRef.current = await navigator.mediaDevices.getUserMedia(mediaConstraints);
      recognitionRef.current.start();
      setIsListening(true);
    } catch (err) {
      console.error("Error al iniciar micrófono:", err);
      setIsListening(false);
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        console.warn("Permiso de micrófono denegado. Verifica los permisos del navegador/Electron.");
      }
    }
  }, [isListening, preferredMicDeviceId, stopAudioStream]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
    stopAudioStream();
  }, [isListening, stopAudioStream]);

  const clearTranscript = useCallback(() => {
    setMessages([]);
    setFinalTranscript("");
    setInterimTranscript("");
    finalRef.current = "";
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopAudioStream();
    };
  }, [stopAudioStream]);

  return {
    isListening,
    messages,
    finalTranscript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript
  };
}
