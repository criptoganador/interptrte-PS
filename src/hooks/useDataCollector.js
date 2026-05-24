/**
 * useDataCollector — Hook para capturar y gestionar secuencias de landmarks
 * Permite grabar muestras, contar repeticiones y exportar el dataset final.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { get, set } from "idb-keyval";

export function useDataCollector() {
  const [dataset, setDataset] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [currentLabel, setCurrentLabel] = useState("");
  const [samplesCount, setSamplesCount] = useState({});
  const [isLoaded, setIsLoaded] = useState(false); // Para evitar sobrescribir al montar

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

  /**
   * Detiene la captura y guarda la muestra en el dataset
   */
  const stopAndSave = useCallback(() => {
    setIsRecording(false);
    const labelToSave = labelRef.current;
    
    if (currentSequenceRef.current.length > 0) {
      const newSample = {
        label: labelToSave,
        timestamp: Date.now(),
        sequence: [...currentSequenceRef.current]
      };

      setDataset((prev) => [...prev, newSample]);
      
      // Actualizar contador de muestras por seña
      setSamplesCount((prev) => ({
        ...prev,
        [labelToSave]: (prev[labelToSave] || 0) + 1
      }));
      
      console.log(`✅ Muestra guardada para: ${labelToSave} (${currentSequenceRef.current.length} frames)`);
    }
  }, []);

  /**
   * Inicia el proceso de grabación con una cuenta regresiva
   */
  const startRecording = useCallback((label) => {
    if (!label) {
      alert("Por favor, ingresa una etiqueta para la seña (ej: HOLA)");
      return;
    }
    if (isRecording) return;

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
    datasetLength: dataset.length
  };
}
