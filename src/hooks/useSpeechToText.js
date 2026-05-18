import { useState, useEffect, useCallback, useRef } from "react";

export function useSpeechToText() {
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState([]); // Historial de burbujas
  const [finalTranscript, setFinalTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  
  const recognitionRef = useRef(null);
  const timerRef = useRef(null);
  const finalRef = useRef("");

  useEffect(() => {
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

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Error al iniciar micrófono:", err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, [isListening]);

  const clearTranscript = useCallback(() => {
    setMessages([]);
    setFinalTranscript("");
    setInterimTranscript("");
    finalRef.current = "";
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

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
