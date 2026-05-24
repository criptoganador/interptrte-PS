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
   * Procesa el frame completo, hace la inferencia y devuelve la traducción estabilizada.
   * 
   * UMBRALES CALIBRADOS para datos diversos (misma seña con diferentes manos/posiciones):
   * - Confianza mínima: 60% (antes 80%) — permite más variación
   * - Brecha mínima: 0.15 (antes 0.3) — no exige dominio absoluto
   * - Distancia centroide: 6.0 (antes 3.5) — tolera mano derecha vs izquierda
   * - Consenso: 4 de 6 (antes 6/6) — permite frames ruidosos
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

        const predictedLabel = labelsRef.current[maxIndex] || `Seña ${maxIndex}`;
        const gap = maxProb - secondMaxProb;

        // 🔍 DIAGNÓSTICO SIEMPRE ACTIVO (ver en Consola F12 del navegador)
        // Throttle: solo loguear cada ~500ms para no saturar la consola
        if (!window._lastDiagLog || performance.now() - window._lastDiagLog > 500) {
          window._lastDiagLog = performance.now();
          console.log(
            `🧠 IA dice: "${predictedLabel}" | Confianza: ${(maxProb * 100).toFixed(1)}% | Brecha: ${(gap * 100).toFixed(1)}% | ` +
            `Filtro confianza: ${maxProb >= 0.60 ? '✅' : '❌'} (≥60%) | Filtro brecha: ${gap > 0.15 ? '✅' : '❌'} (>15%)`
          );
        }

        // Vigilante Adaptativo: Exigir 60% de seguridad y brecha razonable
        // (relajado para tolerar grabaciones diversas con ambas manos y posiciones)
        if (maxProb >= 0.60 && gap > 0.15) {
          
          // === VALIDADOR DE DISTANCIA MATEMÁTICA (Filtro Anti-Desconocidos) ===
          let isValid = true;
          let minDistance = 0;
          
          if (predictedLabel !== "REPOSO" && centroidsRef.current[predictedLabel]) {
            const labelCentroids = centroidsRef.current[predictedLabel];
            minDistance = Infinity;
            
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
            
            // 🔍 Log de distancia (solo cuando pasa el primer filtro)
            if (!window._lastDistLog || performance.now() - window._lastDistLog > 500) {
              window._lastDistLog = performance.now();
              console.log(
                `📏 Distancia al molde más cercano de "${predictedLabel}": ${minDistance.toFixed(2)} | ` +
                `Filtro distancia: ${minDistance <= 6.0 ? '✅' : '❌'} (≤6.0)`
              );
            }
            
            // Umbral calibrado de distancia geométrica. 
            // 6.0 es más permisivo para tolerar mano derecha vs izquierda
            // (el vector cambia completamente de posición: slots 0-62 vs 63-125)
            if (minDistance > 6.0) {
              isValid = false;
            }
          }

          if (isValid) {
            // Agregar al historial para suavizado (evitar parpadeos)
            predictionHistoryRef.current.push(predictedLabel);
            if (predictionHistoryRef.current.length > 6) {
              predictionHistoryRef.current.shift(); // Mantener solo los últimos 6
            }

            if (predictionHistoryRef.current.length >= 4) {
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
              
              // Consenso por MAYORÍA: al menos 4 de los últimos 6 frames deben coincidir
              // (antes exigía 6/6, lo cual era casi imposible con datos diversos)
              const requiredConsensus = Math.min(4, predictionHistoryRef.current.length);
              if (maxCount >= requiredConsensus) {
                const labelUpper = dominantLabel.toUpperCase();
                if (labelUpper === "REPOSO" || labelUpper === "NADA" || labelUpper === "..." || labelUpper === "RUIDO" || labelUpper === "__UNSURE__") {
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
          // No pasó el filtro de confianza/brecha — la IA no está segura
          // No limpiamos el historial agresivamente para permitir recuperación
          // Solo limpiamos si llevamos muchos frames dudosos seguidos
          predictionHistoryRef.current.push("__UNSURE__");
          if (predictionHistoryRef.current.length > 6) {
            predictionHistoryRef.current.shift();
          }
          // Si los últimos 6 frames fueron todos dudosos, limpiar
          const unsureCount = predictionHistoryRef.current.filter(l => l === "__UNSURE__").length;
          if (unsureCount >= 5) {
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
