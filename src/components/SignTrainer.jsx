/**
 * SignTrainer — Utilidad para entrenar el modelo de IA usando el dataset en memoria.
 * Ahora completamente automatizado: toma el dataset de los props y guarda en IndexedDB.
 */

import React, { useState, useEffect, useRef } from 'react';
import * as tf from '@tensorflow/tfjs';
import { extractFeatures } from '../utils/featureExtraction';

export function SignTrainer({ dataset, onModelTrained }) {
  const [trainingStatus, setTrainingStatus] = useState('idle'); // idle, training, finished
  const [logs, setLogs] = useState([]);
  const [accuracy, setAccuracy] = useState(0);

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

    // Extraer características de las muestras grabadas por el usuario
    jsonData.forEach(sample => {
      const middleFrameIndex = Math.floor(sample.sequence.length / 2);
      const frame = sample.sequence[middleFrameIndex];
      
      const features = extractFeatures(frame);
      if (features) {
        inputs.push(features);
        const output = new Array(labels.length).fill(0);
        output[labelMap[sample.label]] = 1;
        outputs.push(output);
      }
    });

    // === INYECCIÓN DE RUIDO SINTÉTICO ===
    // Generamos datos "falsos" o "rotos" para enseñarle a la IA qué es basura.
    // Usamos la mitad del total de muestras como ruido.
    const numNoiseSamples = Math.max(15, Math.floor(inputs.length * 0.5));
    const validInputsLength = inputs.length;

    for (let i = 0; i < numNoiseSamples; i++) {
      if (validInputsLength > 0) {
        const baseIdx = Math.floor(Math.random() * validInputsLength);
        // Distorsionamos agresivamente las coordenadas (movimientos al azar, fuera de lugar)
        const noiseFeature = inputs[baseIdx].map(val => val + (Math.random() * 2 - 1));
        
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

    const { xs, ys, labels, inputSize, outputSize } = processData(dataset);

    if (labels.length < 2) {
      addLog("⚠️ Necesitas grabar al menos 2 señas diferentes.");
      return;
    }

    setTrainingStatus('training');
    setAccuracy(0);
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
      optimizer: tf.train.adam(0.01), 
      loss: 'categoricalCrossentropy', 
      metrics: ['accuracy'] 
    });

    await model.fit(xs, ys, { 
      epochs: 30, 
      validationSplit: 0.1, 
      callbacks: { 
        onEpochEnd: (epoch, logs) => setAccuracy(logs.acc) 
      } 
    });

    addLog("💾 Guardando modelo en el navegador...");
    
    // Guardado automático sin archivos
    await model.save('indexeddb://lsv-model');
    localStorage.setItem("lsv-labels", JSON.stringify(labels));

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
            <div className="progress-bar-fill" style={{width: `${accuracy * 100}%`}}></div>
          </div>
          
          <div className="button-group">
            <button 
              className="action-button train" 
              onClick={trainModel} 
              disabled={trainingStatus === 'training' || uniqueLabels.length < 2}
            >
              {trainingStatus === 'training' ? 'ENTRENANDO...' : '🏋️ ENTRENAR IA'}
            </button>
          </div>
          
          {uniqueLabels.length < 2 && (
            <p style={{fontSize: '10px', color: 'var(--color-warning)', marginTop: '4px'}}>
              Graba al menos 2 señas distintas para entrenar.
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
