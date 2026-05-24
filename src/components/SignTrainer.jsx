/**
 * SignTrainer — Utilidad para entrenar el modelo de IA usando el dataset en memoria.
 * Ahora completamente automatizado: toma el dataset de los props y guarda en IndexedDB.
 */

import { useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import { extractFeatures } from '../utils/featureExtraction';

export function SignTrainer({ dataset, onModelTrained }) {
  const [trainingStatus, setTrainingStatus] = useState('idle'); // idle, training, finished
  const [logs, setLogs] = useState([]);
  const [progress, setProgress] = useState(0);

  const addLog = (msg) => setLogs(prev => [msg, ...prev].slice(0, 10));

  // Procesar los datos en crudo e inyectar ruido para robustez
  const processData = (jsonData) => {
    const labels = [...new Set(jsonData.map(item => item.label))];
    
    // Asegurarnos de que exista la clase REPOSO para atrapar la basura/ruido
    if (!labels.includes("REPOSO")) {
      labels.push("REPOSO");
    }

    const labelMap = Object.fromEntries(labels.map((label, i) => [label, i]));
    const inputs = [];
    const outputs = [];

    // Extraer características de todos los frames válidos de las secuencias grabadas por el usuario
    jsonData.forEach(sample => {
      let validFramesInSample = 0;
      
      sample.sequence.forEach(frame => {
        const features = extractFeatures(frame);
        if (features) {
          inputs.push(features);
          const output = new Array(labels.length).fill(0);
          output[labelMap[sample.label]] = 1;
          outputs.push(output);
          validFramesInSample++;
        }
      });
      
      console.log(`🧠 Muestra [${sample.label}]: Se cosecharon ${validFramesInSample} frames con manos/poses válidas.`);
    });

    if (inputs.length === 0) {
      return null;
    }

    // === INYECCIÓN DE RUIDO SINTÉTICO MEJORADO (VIGILANTE) ===
    // Generamos datos "falsos" o "rotos" para enseñarle a la IA qué es basura.
    const numNoiseSamples = Math.max(10, Math.floor(inputs.length * 1.5));
    const validInputsLength = inputs.length;

    for (let i = 0; i < numNoiseSamples; i++) {
      if (validInputsLength > 0) {
        const baseIdx = Math.floor(Math.random() * validInputsLength);
        
        // Tipo de ruido aleatorio: 
        // 1. Ruido ligero (para enseñar márgenes estrictos, poses casi iguales pero incorrectas)
        // 2. Ruido agresivo (poses totalmente diferentes)
        const noiseType = Math.random();
        let noiseFeature;
        
        if (noiseType > 0.5) {
          // Ruido engañoso (ligeramente diferente)
          noiseFeature = inputs[baseIdx].map(val => val + (Math.random() * 0.3 - 0.15));
        } else {
          // Ruido agresivo (fuera de lugar)
          noiseFeature = inputs[baseIdx].map(val => val + (Math.random() * 2 - 1));
        }
        
        inputs.push(noiseFeature);
        const output = new Array(labels.length).fill(0);
        output[labelMap["REPOSO"]] = 1;
        outputs.push(output);
      }
    }

    return {
      xs: tf.tensor2d(inputs),
      ys: tf.tensor2d(outputs),
      labels,
      inputSize: 126, // 63 derecha + 63 izquierda
      outputSize: labels.length
    };
  };

  const trainModel = async () => {
    if (!dataset || dataset.length === 0) {
      addLog("⚠️ No hay datos para entrenar.");
      return;
    }

    const processed = processData(dataset);
    
    if (!processed) {
      addLog("⚠️ No se detectaron manos visibles en las muestras. Asegúrate de mostrar las manos en cámara al grabar.");
      setTrainingStatus('idle');
      return;
    }

    const { xs, ys, labels, inputSize, outputSize } = processed;

    if (labels.length < 2) { // Recuerda que 'labels' ya incluye 'REPOSO' por lo que si hay 1 seña del usuario, length es 2
      addLog("⚠️ Necesitas grabar al menos 1 seña.");
      return;
    }

    setTrainingStatus('training');
    setProgress(0);
    addLog(`🧠 Iniciando red neuronal (${labels.length} señas)...`);

    const model = tf.sequential();
    // Capa 1: Extrae patrones complejos (aumentado a 128 neuronas)
    model.add(tf.layers.dense({ inputShape: [inputSize], units: 128, activation: 'relu' }));
    // Capa de olvido: Apaga el 20% de las neuronas al azar para evitar que la IA "memorice" (Overfitting) y la obliga a "entender"
    model.add(tf.layers.dropout({ rate: 0.2 }));
    // Capa 2: Filtra los patrones hacia una decisión más clara
    model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
    // Capa de salida: Decide cuál es la seña ganadora
    model.add(tf.layers.dense({ units: outputSize, activation: 'softmax' }));
    
    model.compile({ 
      optimizer: tf.train.adam(0.005), 
      loss: 'categoricalCrossentropy', 
      metrics: ['accuracy'] 
    });

    // === HACK: Evitar que TF.js pause el entrenamiento cuando la pestaña está en segundo plano ===
    const originalRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = function(callback) {
      if (document.hidden) {
        return setTimeout(() => callback(performance.now()), 100);
      }
      return originalRAF(callback);
    };

    try {
      await model.fit(xs, ys, { 
        epochs: 50, 
        validationSplit: 0.1, 
        callbacks: { 
          onEpochEnd: (epoch) => setProgress((epoch + 1) / 50) 
        } 
      });
    } finally {
      // Restaurar siempre requestAnimationFrame
      window.requestAnimationFrame = originalRAF;
    }

    addLog("💾 Guardando modelo en el navegador...");
    
    // Guardado automático sin archivos
    await model.save('indexeddb://lsv-model');
    localStorage.setItem("lsv-labels", JSON.stringify(labels));

    // === CÁLCULO DE MOLDES (CENTROIDES) DE ALTA PRECISIÓN ===
    const centroids = {};
    labels.forEach(label => {
      if (label === "REPOSO") return;
      
      const samples = dataset.filter(item => item.label === label);
      if (samples.length === 0) return;
      
      centroids[label] = [];
      
      // Creamos un centroide (molde) por cada MUESTRA grabada. 
      // Esto permite que la misma seña se pueda hacer con la mano derecha o izquierda sin que se promedien y se rompan.
      samples.forEach(sample => {
        const sampleFeatures = [];
        sample.sequence.forEach(frame => {
          const features = extractFeatures(frame);
          if (features) {
            sampleFeatures.push(features);
          }
        });
        
        if (sampleFeatures.length > 0) {
          const centroid = new Array(126).fill(0);
          sampleFeatures.forEach(features => {
            for (let i = 0; i < 126; i++) {
              centroid[i] += features[i];
            }
          });
          for (let i = 0; i < 126; i++) {
            centroid[i] /= sampleFeatures.length;
          }
          centroids[label].push(centroid);
        }
      });
    });
    localStorage.setItem("lsv-centroids", JSON.stringify(centroids));
    addLog("📏 Moldes matemáticos guardados.");

    setTrainingStatus('finished');
    addLog("🏆 ¡Entrenado y Listo!");

    // Avisar a la app que el modelo está listo para traducir
    if (onModelTrained) {
      onModelTrained();
    }
  };

  const uniqueLabels = dataset ? [...new Set(dataset.map(item => item.label))] : [];

  return (
    <section className="diag-section trainer-lab">
      <h3 className="section-title">Laboratorio de IA</h3>
      
      {(!dataset || dataset.length === 0) ? (
        <div className="dataset-stats" style={{textAlign: 'center', padding: '20px'}}>
          <p>Graba algunas señas arriba para empezar.</p>
        </div>
      ) : (
        <div className="trainer-controls">
          <p style={{fontSize: '11px'}}>Muestras: {dataset.length} | Señas: {uniqueLabels.length}</p>
          
          <div className="progress-bar-bg">
            <div className="progress-bar-fill" style={{width: `${progress * 100}%`}}></div>
          </div>
          
          <div className="button-group">
            <button 
              className="action-button train" 
              onClick={trainModel} 
              disabled={trainingStatus === 'training' || uniqueLabels.length < 1}
            >
              {trainingStatus === 'training' ? 'ENTRENANDO...' : '🏋️ ENTRENAR IA'}
            </button>
          </div>
          
          {uniqueLabels.length < 1 && (
            <p style={{fontSize: '10px', color: 'var(--color-warning)', marginTop: '4px'}}>
              Graba al menos 1 seña para entrenar.
            </p>
          )}
        </div>
      )}

      <div className="training-logs" style={{height: '60px'}}>
        {logs.map((log, i) => <div key={i}>{log}</div>)}
      </div>
    </section>
  );
}
