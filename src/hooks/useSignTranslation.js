import { useState, useCallback, useRef, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import { extractFeatures } from "../utils/featureExtraction";

export function useSignTranslation() {
  const [model, setModel] = useState(null);
  const [isModelReady, setIsModelReady] = useState(false);
  const [currentTranslation, setCurrentTranslation] = useState("");
  
  // Estado para las voces
  const [voices, setVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState("");
  
  // Array de historial para estabilizar predicciones (suavizado)
  const predictionHistoryRef = useRef([]);
  // Etiquetas por defecto, se sobrescribirán con las de LocalStorage
  const labelsRef = useRef([]); 

  // Cargar el modelo desde IndexedDB (creado por el entrenamiento)
  const loadModel = useCallback(async () => {
    try {
      console.log("Cargando modelo de traducción desde IndexedDB...");
      // Intentar cargar desde IndexedDB primero
      const loadedModel = await tf.loadLayersModel("indexeddb://lsv-model");
      setModel(loadedModel);
      
      // Cargar etiquetas guardadas en LocalStorage
      const savedLabels = localStorage.getItem("lsv-labels");
      if (savedLabels) {
        labelsRef.current = JSON.parse(savedLabels);
        console.log("Etiquetas cargadas:", labelsRef.current);
      }
      
      setIsModelReady(true);
      console.log("✅ Modelo cargado correctamente desde base de datos interna.");
    } catch (error) {
      console.warn("⚠️ No se encontró modelo en IndexedDB. Entrena la IA primero.");
      setIsModelReady(false);
    }
  }, []);

  // Cargar al iniciar
  useEffect(() => {
    loadModel();
  }, [loadModel]);

  // Cargar voces disponibles
  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      if (availableVoices.length > 0) {
        // Filtrar voces en español (incluye es-ES, es-MX, etc)
        const spanishVoices = availableVoices.filter(v => v.lang.startsWith("es"));
        setVoices(spanishVoices);
        
        if (spanishVoices.length > 0 && !selectedVoiceURI) {
          // Autoseleccionar una voz femenina de Microsoft (ej. Sabina) si está disponible, o la primera por defecto
          const femaleVoice = spanishVoices.find(v => v.name.includes("Sabina") || v.name.includes("Helena") || v.name.includes("Laura"));
          setSelectedVoiceURI(femaleVoice ? femaleVoice.voiceURI : spanishVoices[0].voiceURI);
        }
      }
    };
    
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, [selectedVoiceURI]);

  /**
   * Procesa el frame completo, hace la inferencia y devuelve la traducción estabilizada
   */
  const translateFrame = useCallback((frame) => {
    if (!isModelReady || !model || !frame) return null;

    const features = extractFeatures(frame);
    if (!features) {
      setCurrentTranslation("");
      predictionHistoryRef.current = [];
      return null;
    }

    // Ejecutar predicción de forma segura
    tf.tidy(() => {
      try {
        const inputTensor = tf.tensor2d([features]);
        const prediction = model.predict(inputTensor);
        const probabilities = prediction.dataSync();
        
        // Encontrar la clase con mayor probabilidad
        let maxProb = 0;
        let maxIndex = 0;
        for (let i = 0; i < probabilities.length; i++) {
          if (probabilities[i] > maxProb) {
            maxProb = probabilities[i];
            maxIndex = i;
          }
        }

        // Exigir casi 100% de seguridad (0.95) a la red neuronal
        if (maxProb > 0.95) {
          const predictedLabel = labelsRef.current[maxIndex] || `Seña ${maxIndex}`;
          
          // Agregar al historial para suavizado (evitar parpadeos)
          predictionHistoryRef.current.push(predictedLabel);
          if (predictionHistoryRef.current.length > 5) {
            predictionHistoryRef.current.shift(); // Mantener solo los últimos 5
          }

          if (predictionHistoryRef.current.length === 5) {
            const counts = {};
            let dominantLabel = predictedLabel;
            let maxCount = 0;
            
            for (const label of predictionHistoryRef.current) {
              counts[label] = (counts[label] || 0) + 1;
              if (counts[label] > maxCount) {
                maxCount = counts[label];
                dominantLabel = label;
              }
            }
            
            // Requerir PERFECCIÓN: 5 de 5 frames idénticos para evitar CUALQUIER lectura accidental
            if (maxCount === 5) {
              const labelUpper = dominantLabel.toUpperCase();
              if (labelUpper === "REPOSO" || labelUpper === "NADA" || labelUpper === "..." || labelUpper === "RUIDO") {
                setCurrentTranslation(""); // Ignorar la basura silenciosamente
              } else {
                setCurrentTranslation(dominantLabel);
              }
            }
          }
        }
      } catch (error) {
        console.warn("⚠️ El modelo actual no es compatible con la nueva IA (63 vs 126 puntos). Por favor, presiona 'ENTRENAR IA' de nuevo para actualizar el cerebro.");
      }
    });

    return currentTranslation;
  }, [isModelReady, model, currentTranslation]);

  /**
   * Función para que la computadora hable (Text to Speech)
   */
  const speakText = (text) => {
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedVoiceURI) {
      const availableVoices = window.speechSynthesis.getVoices();
      const voice = availableVoices.find(v => v.voiceURI === selectedVoiceURI);
      if (voice) utterance.voice = voice;
    } else {
      utterance.lang = "es-ES";
    }
    
    // Ajuste de tono para simular voz de mujer si la voz es masculina
    utterance.pitch = 1.2; // 1.2 es más agudo (más femenino)
    utterance.rate = 1.0;  // Velocidad normal
    
    window.speechSynthesis.speak(utterance);
  };

  const changeVoice = (uri) => {
    setSelectedVoiceURI(uri);
  };

  return {
    isModelReady,
    currentTranslation,
    translateFrame,
    speakText,
    voices,
    selectedVoiceURI,
    changeVoice,
    loadModel, // Exportamos para poder recargar desde el SignTrainer
    setLabels: (labels) => { labelsRef.current = labels; }
  };
}
