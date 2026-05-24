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

  const normalizeCentroids = useCallback((centroids) => {
    if (!centroids || typeof centroids !== 'object') return {};
    const normalized = {};
    Object.entries(centroids).forEach(([label, value]) => {
      if (Array.isArray(value)) {
        normalized[label] = value;
      } else if (value && typeof value === 'object') {
        normalized[label] = [value];
      }
    });
    return normalized;
  }, []);

  const mergeCentroids = useCallback((baseCentroids, incomingCentroids) => {
    const merged = { ...baseCentroids };
    Object.entries(incomingCentroids).forEach(([label, centroids]) => {
      if (!Array.isArray(centroids)) return;
      if (!Array.isArray(merged[label])) {
        merged[label] = [];
      }
      merged[label] = [...merged[label], ...centroids];
    });
    return merged;
  }, []);

  const mergeCommunityData = useCallback(async (data) => {
    if (!data || !Array.isArray(data.dataset_json)) {
      return { added: 0, labelsAdded: 0 };
    }

    const existingLabels = new Set(JSON.parse(localStorage.getItem('lsv-labels') || '[]'));
    const existingCentroids = normalizeCentroids(JSON.parse(localStorage.getItem('lsv-centroids') || '{}'));

    const newSamples = [];
    const newCounts = { ...samplesCount };
    let labelsAdded = 0;

    data.dataset_json.forEach((sample) => {
      if (!sample || !sample.label || !Array.isArray(sample.sequence)) return;

      const duplicateCheck = checkForDuplicate(sample.sequence, sample.label);
      if (duplicateCheck.isDuplicate) return;

      newSamples.push(sample);
      newCounts[sample.label] = (newCounts[sample.label] || 0) + 1;
      if (!existingLabels.has(sample.label)) {
        existingLabels.add(sample.label);
        labelsAdded += 1;
      }
    });

    if (newSamples.length > 0) {
      setDataset((prev) => [...prev, ...newSamples]);
      setSamplesCount(newCounts);
      await set('lsv-dataset', [...datasetRef.current, ...newSamples]);
    }

    const mergedLabels = [...existingLabels];
    localStorage.setItem('lsv-labels', JSON.stringify(mergedLabels));

    const remoteCentroids = normalizeCentroids(data.centroids_json || {});
    const mergedCentroids = mergeCentroids(existingCentroids, remoteCentroids);
    localStorage.setItem('lsv-centroids', JSON.stringify(mergedCentroids));

    return { added: newSamples.length, labelsAdded };
  }, [checkForDuplicate, mergeCentroids, normalizeCentroids, samplesCount]);

  const [communitySyncStatus, setCommunitySyncStatus] = useState('idle');

  const syncCommunityFromCloud = useCallback(async () => {
    const token = localStorage.getItem('lsv-token');
    if (!token) return;

    setCommunitySyncStatus('syncing');
    try {
      const response = await fetch('http://localhost:3001/api/sync/community', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setRecorderMessage({ type: 'info', text: 'ℹ️ No hay datos comunitarios disponibles por ahora.' });
          setCommunitySyncStatus('idle');
          return { added: 0, labelsAdded: 0 };
        }
        throw new Error('Error al descargar datos comunitarios');
      }

      const data = await response.json();
      const { added, labelsAdded } = await mergeCommunityData(data);
      console.log(`🔄 Descargadas ${added} nuevas muestras comunitarias. Etiquetas nuevas: ${labelsAdded}.`);

      if (added > 0) {
        setRecorderMessage({
          type: 'success',
          text: `✅ Se descargaron ${added} muestras nuevas de la comunidad. Entrena la IA para que aprenda estas señas.`
        });
      } else {
        setRecorderMessage({
          type: 'success',
          text: 'ℹ️ No hay muestras comunitarias nuevas para agregar. Tu dataset ya está actualizado.'
        });
      }

      setCommunitySyncStatus('success');
      setTimeout(() => setCommunitySyncStatus('idle'), 2500);
      return { added, labelsAdded };
    } catch (error) {
      console.error('Error sincronizando comunidad:', error);
      setRecorderMessage({ type: 'error', text: '❌ No se pudo descargar datos comunitarios. Revisa tu conexión.' });
      setCommunitySyncStatus('error');
      setTimeout(() => setCommunitySyncStatus('idle'), 2500);
      return { added: 0, labelsAdded: 0 };
    }
  }, [mergeCommunityData]);

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

      const newDataset = [...datasetRef.current, newSample];
      setDataset(newDataset);
      
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

      // Compartir la muestra nueva automáticamente si el usuario está autenticado.
      void uploadToCloud({
        datasetToUpload: newDataset,
        silent: true
      });
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

  /**
   * Sincronizar datos hacia la nube (respaldo)
   */
  const [syncStatus, setSyncStatus] = useState('idle');

  const uploadToCloud = useCallback(async ({
    datasetToUpload,
    labels_json,
    centroids_json,
    silent = false
  }) => {
    const token = localStorage.getItem('lsv-token');
    if (!token) {
      if (!silent) {
        alert("Inicia sesión primero para guardar en la nube.");
      }
      return { success: false };
    }

    const payload = {
      dataset_json: datasetToUpload || datasetRef.current,
      labels_json: labels_json || JSON.parse(localStorage.getItem('lsv-labels') || '[]'),
      centroids_json: centroids_json || JSON.parse(localStorage.getItem('lsv-centroids') || '{}')
    };

    if (!silent) {
      setSyncStatus('syncing');
    }

    try {
      const response = await fetch('http://localhost:3001/api/sync/upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('Error al sincronizar');

      if (!silent) {
        setSyncStatus('success');
        setRecorderMessage({ type: 'success', text: '✅ Datos respaldados en la nube exitosamente.' });
        setTimeout(() => setSyncStatus('idle'), 3000);
      }

      return { success: true };
    } catch (error) {
      console.error(error);
      if (!silent) {
        setSyncStatus('error');
        setRecorderMessage({ type: 'error', text: '❌ Error al subir a la nube.' });
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
      return { success: false };
    }
  }, []);

  const syncToCloud = useCallback(async (options = { silent: false }) => {
    return uploadToCloud({ silent: options.silent });
  }, [uploadToCloud]);

  /**
   * Descargar datos desde la nube
   */
  const syncFromCloud = useCallback(async () => {
    const token = localStorage.getItem('lsv-token');
    if (!token) {
      alert("Inicia sesión primero para descargar tus datos.");
      return;
    }

    setSyncStatus('syncing');
    try {
      const response = await fetch('http://localhost:3001/api/sync/download', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          setRecorderMessage({ type: 'error', text: '⚠️ No tienes datos guardados en la nube todavía.' });
          setSyncStatus('idle');
          return;
        }
        throw new Error('Error al descargar');
      }

      const data = await response.json();
      
      // Restaurar Dataset
      if (data.dataset_json && Array.isArray(data.dataset_json)) {
        setDataset(data.dataset_json);
        // Reconstruir contadores
        const counts = {};
        data.dataset_json.forEach(s => {
          counts[s.label] = (counts[s.label] || 0) + 1;
        });
        setSamplesCount(counts);
        await set("lsv-dataset", data.dataset_json);
      }

      // Restaurar parámetros del modelo (Etiquetas y Centroides)
      if (data.labels_json) {
        localStorage.setItem("lsv-labels", JSON.stringify(data.labels_json));
      }
      if (data.centroids_json) {
        localStorage.setItem("lsv-centroids", JSON.stringify(data.centroids_json));
      }

      setSyncStatus('success');
      setRecorderMessage({ 
        type: 'success', 
        text: '✅ Datos descargados de la nube. Por favor haz clic en "ENTRENAR IA" para reactivar el modelo.' 
      });
      setTimeout(() => setSyncStatus('idle'), 5000);
    } catch (error) {
      console.error(error);
      setSyncStatus('error');
      setRecorderMessage({ type: 'error', text: '❌ Error al descargar desde la nube.' });
      setTimeout(() => setSyncStatus('idle'), 3000);
    }
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
    clearRecorderMessage,
    // === NUEVOS: Nube ===
    syncToCloud,
    syncFromCloud,
    syncCommunityFromCloud,
    syncStatus,
    communitySyncStatus
  };
}
