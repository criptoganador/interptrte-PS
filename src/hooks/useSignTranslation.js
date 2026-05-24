import { useState, useCallback, useRef, useEffect } from "react";
import * as tf from "@tensorflow/tfjs";
import { extractFeatures, calculateDistance } from "../utils/featureExtraction";

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
  // Moldes promedio para validación geométrica estricta
  const centroidsRef = useRef({});

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
      
      // Cargar moldes matemáticos (Centroides)
      const savedCentroids = localStorage.getItem("lsv-centroids");
      if (savedCentroids) {
        centroidsRef.current = JSON.parse(savedCentroids);
        console.log("Moldes de validación cargados.");
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

  // Eliminar el modelo y limpiar estados
  const unloadModel = useCallback(async () => {
    try {
      console.log("Eliminando modelo de traducción de IndexedDB...");
      await tf.io.removeModel("indexeddb://lsv-model");
      console.log("🗑️ Modelo removido con éxito de IndexedDB.");
    } catch (error) {
      console.warn("⚠️ No se pudo eliminar el modelo de IndexedDB o no existía:", error);
    }
    
    // Limpiar LocalStorage
    localStorage.removeItem("lsv-labels");
    localStorage.removeItem("lsv-centroids");
    
    // Limpiar estados y referencias
    setModel(null);
    setIsModelReady(false);
    setCurrentTranslation("");
    labelsRef.current = [];
    centroidsRef.current = {};
    predictionHistoryRef.current = [];
    
    console.log("🧹 Todos los estados del modelo en memoria han sido reseteados.");
  }, []);

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
    if (!isModelReady || !model) return null;

    if (!frame) {
      setCurrentTranslation("");
      predictionHistoryRef.current = [];
      return null;
    }

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
        
        // Encontrar la clase con mayor probabilidad y la segunda mayor (para el vigilante)
        let maxProb = 0;
        let maxIndex = 0;
        let secondMaxProb = 0;
        
        for (let i = 0; i < probabilities.length; i++) {
          if (probabilities[i] > maxProb) {
            secondMaxProb = maxProb;
            maxProb = probabilities[i];
            maxIndex = i;
          } else if (probabilities[i] > secondMaxProb) {
            secondMaxProb = probabilities[i];
          }
        }

        // Vigilante Estricto: Exigir 80% de seguridad y que el modelo no esté dudando
        // (la diferencia entre la mejor opción y la segunda debe ser amplia)
        if (maxProb >= 0.80 && (maxProb - secondMaxProb) > 0.3) {
          const predictedLabel = labelsRef.current[maxIndex] || `Seña ${maxIndex}`;
          
          // === VALIDADOR DE DISTANCIA MATEMÁTICA (Filtro Anti-Desconocidos) ===
          let isValid = true;
          if (predictedLabel !== "REPOSO" && centroidsRef.current[predictedLabel]) {
            const labelCentroids = centroidsRef.current[predictedLabel];
            let minDistance = Infinity;
            
            if (Array.isArray(labelCentroids) && labelCentroids.length > 0) {
              // Comparamos contra todos los moldes grabados (ej: molde mano izquierda, molde mano derecha)
              for (const centroid of labelCentroids) {
                const distance = calculateDistance(features, centroid);
                if (distance < minDistance) {
                  minDistance = distance;
                }
              }
            } else if (labelCentroids && !Array.isArray(labelCentroids)) {
              // Retrocompatibilidad con modelos viejos
              minDistance = calculateDistance(features, labelCentroids);
            }
            
            // Log para calibrar: Puedes ver este valor en la consola de Chrome (F12)
            // console.log(`Seña: ${predictedLabel} | Confianza: ${maxProb.toFixed(2)} | Distancia: ${minDistance.toFixed(2)}`);
            
            // Umbral calibrado de distancia geométrica. 
            // 3.5 es más permisivo para variaciones naturales de la mano.
            if (minDistance > 3.5) {
              isValid = false;
            }
          }

          if (isValid) {
            // Agregar al historial para suavizado (evitar parpadeos)
            predictionHistoryRef.current.push(predictedLabel);
            if (predictionHistoryRef.current.length > 6) {
              predictionHistoryRef.current.shift(); // Mantener solo los últimos 6
            }

            if (predictionHistoryRef.current.length === 6) {
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
              
              // Requerir PERFECCIÓN: 6 de 6 frames idénticos
              if (maxCount === 6) {
                const labelUpper = dominantLabel.toUpperCase();
                if (labelUpper === "REPOSO" || labelUpper === "NADA" || labelUpper === "..." || labelUpper === "RUIDO") {
                  setCurrentTranslation(""); // Ignorar la basura silenciosamente
                } else {
                  setCurrentTranslation(dominantLabel);
                }
              }
            }
          } else {
            // Rechazado por el validador de distancia geométrica (era una seña desconocida)
            if (predictionHistoryRef.current.length > 0) {
              predictionHistoryRef.current = [];
              setCurrentTranslation(""); 
            }
          }
        } else {
          // Si el vigilante detecta dudas, no mostramos nada en pantalla
          // y limpiamos el historial para obligar al usuario a hacer la seña bien
          if (predictionHistoryRef.current.length > 0) {
            predictionHistoryRef.current = [];
            setCurrentTranslation(""); 
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
    unloadModel, // Exportado para permitir limpiar el cerebro en caliente
    setLabels: (labels) => { labelsRef.current = labels; }
  };
}
