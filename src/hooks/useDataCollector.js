/**
 * useDataCollector — Hook para capturar y gestionar secuencias de landmarks
 * Permite grabar muestras, contar repeticiones y exportar el dataset final.
 * 
 * 🧠 GRABADOR INTELIGENTE: Verifica si una señal ya fue grabada en la misma
 * forma, posición y ubicación antes de guardarla. Si detecta un duplicado,
 * avisa al usuario en lugar de grabar una copia inútil.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { get, set } from "idb-keyval";
import { extractFeatures, calculateDistance } from "../utils/featureExtraction";

// Umbral de similitud: si la distancia entre dos muestras es menor a esto,
// se consideran duplicadas (misma forma, posición y ubicación).
// Valor calibrado: 1.5 es muy estricto (captura casi-clones exactos).
const DUPLICATE_DISTANCE_THRESHOLD = 1.5;

export function useDataCollector() {
  const [dataset, setDataset] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("");
  const [samplesCount, setSamplesCount] = useState({});
  const [isLoaded, setIsLoaded] = useState(false); // Para evitar sobrescribir al montar

  // Estado para mensajes de feedback del grabador inteligente
  const [recorderMessage, setRecorderMessage] = useState(null);
  // recorderMessage = { type: "duplicate" | "success" | "error", text: "..." }

  // Carga inicial desde la base de datos local
  useEffect(() => {
    get("lsv-dataset").then((savedData) => {
      if (savedData && savedData.length > 0) {
        setDataset(savedData);
        // Reconstruir contadores
        const counts = {};
        savedData.forEach(s => {
          counts[s.label] = (counts[s.label] || 0) + 1;
        });
        setSamplesCount(counts);
        console.log(`💾 Cargadas ${savedData.length} muestras desde la base de datos local.`);
      }
      setIsLoaded(true);
    }).catch(err => {
      console.error("Error leyendo base de datos local:", err);
      setIsLoaded(true);
    });
  }, []);

  // Sincronización automática con la base de datos local
  useEffect(() => {
    if (isLoaded) {
      set("lsv-dataset", dataset).catch(err => console.error("Error guardando en base de datos local:", err));
    }
  }, [dataset, isLoaded]);

  // Referencias para evitar problemas de closures en procesos asíncronos
  const currentSequenceRef = useRef([]);
  const labelRef = useRef("");
  const recordingTimerRef = useRef(null);
  // Referencia al dataset actual para acceso dentro de callbacks sin stale closures
  const datasetRef = useRef([]);
  useEffect(() => {
    datasetRef.current = dataset;
  }, [dataset]);

  /**
   * Calcula el centroide (vector promedio de features) de una secuencia de frames.
   * Retorna null si no hay frames válidos con manos detectadas.
   */
  const computeCentroid = useCallback((sequence) => {
    const validFeatures = [];

    for (const frame of sequence) {
      const features = extractFeatures(frame);
      if (features) {
        validFeatures.push(features);
      }
    }

    if (validFeatures.length === 0) return null;

    // Promediar todos los vectores de features
    const centroid = new Array(126).fill(0);
    for (const features of validFeatures) {
      for (let i = 0; i < 126; i++) {
        centroid[i] += features[i];
      }
    }
    for (let i = 0; i < 126; i++) {
      centroid[i] /= validFeatures.length;
    }

    return centroid;
  }, []);

  /**
   * Verifica si la nueva muestra es un duplicado de alguna existente del mismo label.
   * Compara los centroides (forma promedio de la mano) de la nueva muestra con los existentes.
   * 
   * @returns {{ isDuplicate: boolean, matchIndex: number, distance: number }}
   */
  const checkForDuplicate = useCallback((newSequence, label) => {
    const newCentroid = computeCentroid(newSequence);
    
    if (!newCentroid) {
      return { isDuplicate: false, matchIndex: -1, distance: Infinity, noHands: true };
    }

    // Buscar muestras existentes del mismo label
    const existingSamples = datasetRef.current.filter(s => s.label === label);

    for (let idx = 0; idx < existingSamples.length; idx++) {
      const existingCentroid = computeCentroid(existingSamples[idx].sequence);
      if (!existingCentroid) continue;

      const distance = calculateDistance(newCentroid, existingCentroid);

      console.log(`🔍 Comparando nueva muestra de "${label}" con muestra #${idx + 1}: distancia = ${distance.toFixed(3)}`);

      if (distance < DUPLICATE_DISTANCE_THRESHOLD) {
        return { isDuplicate: true, matchIndex: idx + 1, distance };
      }
    }

    return { isDuplicate: false, matchIndex: -1, distance: Infinity };
  }, [computeCentroid]);

  /**
   * Detiene la captura y verifica duplicados antes de guardar
   */
  const stopAndSave = useCallback(() => {
    setIsRecording(false);
    const labelToSave = labelRef.current;
    
    if (currentSequenceRef.current.length > 0) {
      const sequence = [...currentSequenceRef.current];

      // === GRABADOR INTELIGENTE: Verificar duplicados ===
      const result = checkForDuplicate(sequence, labelToSave);

      if (result.noHands) {
        // No se detectaron manos en la grabación
        setRecorderMessage({
          type: "error",
          text: `⚠️ No se detectaron manos en la grabación de "${labelToSave}". Intenta de nuevo mostrando las manos a la cámara.`
        });
        console.log(`❌ Grabación de "${labelToSave}" rechazada: no hay manos visibles.`);
        return;
      }

      if (result.isDuplicate) {
        // ¡DUPLICADO DETECTADO! No guardamos y avisamos al usuario
        setRecorderMessage({
          type: "duplicate",
          text: `🔁 ¡Señal "${labelToSave}" duplicada! Ya existe una muestra (#${result.matchIndex}) con la misma forma y posición (distancia: ${result.distance.toFixed(2)}). Intenta variar ligeramente el ángulo o la posición de la mano.`
        });
        console.log(`🚫 Muestra duplicada detectada para "${labelToSave}" (coincide con muestra #${result.matchIndex}, distancia: ${result.distance.toFixed(3)})`);
        return;
      }

      // === No es duplicado: Guardar normalmente ===
      const newSample = {
        label: labelToSave,
        timestamp: Date.now(),
        sequence: sequence
      };

      setDataset((prev) => [...prev, newSample]);
      
      // Actualizar contador de muestras por seña
      setSamplesCount((prev) => ({
        ...prev,
        [labelToSave]: (prev[labelToSave] || 0) + 1
      }));

      setRecorderMessage({
        type: "success",
        text: `✅ Muestra guardada para "${labelToSave}" (${sequence.length} frames). ¡Señal única verificada!`
      });
      
      console.log(`✅ Muestra guardada para: ${labelToSave} (${sequence.length} frames)`);
    }
  }, [checkForDuplicate]);

  /**
   * Inicia el proceso de grabación con una cuenta regresiva
   */
  const startRecording = useCallback((label) => {
    if (!label) {
      alert("Por favor, ingresa una etiqueta para la seña (ej: HOLA)");
      return;
    }
    if (isRecording) return;

    // Limpiar mensajes anteriores al iniciar nueva grabación
    setRecorderMessage(null);

    labelRef.current = label; // Guardar en ref para acceso asíncrono
    setCurrentLabel(label);   // Guardar en estado para la UI
    setCountdown(6);

    // Cuenta regresiva
    const cdInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(cdInterval);
          
          // Iniciar grabación real
          setIsRecording(true);
          currentSequenceRef.current = [];
          
          // Detener grabación tras 2 segundos
          recordingTimerRef.current = setTimeout(() => {
            stopAndSave();
          }, 2000);
          
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [isRecording, stopAndSave]);

  /**
   * Función que debe llamarse en cada frame del loop de la cámara
   */
  const recordFrame = useCallback((landmarks) => {
    if (isRecording) {
      currentSequenceRef.current.push(landmarks);
    }
  }, [isRecording]);

  /**
   * Exporta el dataset acumulado a un archivo JSON
   */
  const exportDataset = useCallback(() => {
    if (dataset.length === 0) {
      alert("No hay datos para exportar. Graba algunas señas primero.");
      return;
    }

    const dataStr = JSON.stringify(dataset, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `dataset_lsv_${Date.now()}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  }, [dataset]);

  const clearDataset = () => {
    setDataset([]);
    setSamplesCount({});
    setRecorderMessage(null);
    
    // Borrar de IndexedDB
    set("lsv-dataset", []).catch(err => console.error("Error al limpiar BD:", err));
    
    // Borrar el modelo entrenado
    localStorage.removeItem("lsv-labels");
    
    console.log("🧹 Dataset y base de datos local limpiados.");
    alert("¡Base de datos borrada con éxito!");
  };

  const undoLastSample = useCallback(() => {
    setDataset((prev) => {
      if (prev.length === 0) return prev;
      
      const newDataset = [...prev];
      const removedSample = newDataset.pop(); // Remove the last item
      
      // Update samplesCount
      setSamplesCount((prevCount) => {
        const newCount = { ...prevCount };
        if (newCount[removedSample.label]) {
          newCount[removedSample.label] -= 1;
          if (newCount[removedSample.label] <= 0) {
            delete newCount[removedSample.label];
          }
        }
        return newCount;
      });
      
      console.log(`↩️ Muestra eliminada: ${removedSample.label}`);
      return newDataset;
    });
  }, []);

  /**
   * Limpia el mensaje del grabador inteligente
   */
  const clearRecorderMessage = useCallback(() => {
    setRecorderMessage(null);
  }, []);

  return {
    isRecording,
    countdown,
    currentLabel,
    samplesCount,
    startRecording,
    recordFrame,
    exportDataset,
    clearDataset,
    undoLastSample,
    dataset,
    datasetLength: dataset.length,
    // === NUEVOS: Grabador Inteligente ===
    recorderMessage,
    clearRecorderMessage
  };
}
