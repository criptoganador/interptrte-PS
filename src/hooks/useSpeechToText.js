import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Hook para usar el reconocimiento de voz nativo del navegador (Speech-to-Text).
 * @param {Function} onWordMatch - Callback que se ejecuta cuando se detecta una palabra finalizada.
 */
export function useSpeechToText(onWordMatch) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("⚠️ Este navegador no soporta el reconocimiento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Seguir escuchando aunque el usuario haga pausas
    recognition.interimResults = false; // Solo queremos resultados finales para evitar falsos positivos
    recognition.lang = "es-VE"; // Español de Venezuela

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          const spokenText = event.results[i][0].transcript.trim();
          console.log("🎙️ Escuchado:", spokenText);
          
          setTranscript(spokenText);
          
          // Separar la frase en palabras y enviarlas al callback
          if (onWordMatch) {
            const words = spokenText.toUpperCase().split(/\s+/);
            words.forEach(word => {
              // Limpiar puntuación básica
              const cleanWord = word.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g,"");
              if (cleanWord) {
                onWordMatch(cleanWord);
              }
            });
          }
        }
      }
    };

    recognition.onerror = (event) => {
      console.error("❌ Error en reconocimiento de voz:", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  }, [onWordMatch]);

  const startListening = useCallback(() => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log("🎙️ Micrófono activado...");
      } catch (err) {
        console.error("Error al iniciar micrófono:", err);
      }
    }
  }, [isListening]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      console.log("🎙️ Micrófono desactivado.");
    }
  }, [isListening]);

  return {
    isListening,
    transcript,
    startListening,
    stopListening
  };
}
