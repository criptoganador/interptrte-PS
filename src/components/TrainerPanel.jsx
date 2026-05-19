/**
 * TrainerPanel — Interfaz para capturar datos de entrenamiento
 */

import { useState } from "react";

export function TrainerPanel({ collector }) {
  const [labelInput, setLabelInput] = useState("");

  const {
    isRecording,
    countdown,
    samplesCount,
    startRecording,
    clearDataset,
    undoLastSample,
    datasetLength
  } = collector;

  const handleRecord = () => {
    if (!labelInput.trim()) {
      alert("Escribe el nombre de la seña antes de grabar.");
      return;
    }
    startRecording(labelInput.toUpperCase());
  };

  return (
    <aside className="trainer-panel" id="trainer-panel">
      <h2 className="panel-title">
        <span className="panel-icon">🧠</span>
        Entrenador de IA
      </h2>

      <section className="diag-section">
        <h3 className="section-title">Nueva Seña</h3>
        <div className="input-group">
          <input
            type="text"
            className="trainer-input"
            placeholder="Ej: HOLA, GRACIAS..."
            value={labelInput}
            onChange={(e) => setLabelInput(e.target.value)}
            disabled={isRecording || countdown > 0}
          />
        </div>

        <button 
          className={`rec-button ${isRecording ? 'recording' : ''} ${countdown > 0 ? 'counting' : ''}`}
          onClick={handleRecord}
          disabled={isRecording || countdown > 0}
        >
          {countdown > 0 ? (
            <span className="countdown-number">{countdown}</span>
          ) : isRecording ? (
            <span className="rec-text">GRABANDO...</span>
          ) : (
            <>
              <span className="rec-icon">●</span>
              GRABAR MUESTRA
            </>
          )}
        </button>
        <p className="trainer-tip">
          {isRecording 
            ? "¡Mueve las manos ahora!" 
            : "Se grabarán 2 segundos de movimiento."}
        </p>
      </section>

      <section className="diag-section">
        <h3 className="section-title">Estadísticas del Dataset</h3>
        <div className="metric-row">
          <span className="metric-label">Total muestras</span>
          <span className="metric-value">{datasetLength}</span>
        </div>
        
        <div className="samples-list">
          {Object.entries(samplesCount).length > 0 ? (
            Object.entries(samplesCount).map(([label, count]) => (
              <div className="sample-item" key={label}>
                <span className="sample-label">{label}</span>
                <span className="sample-badge">{count}</span>
              </div>
            ))
          ) : (
            <p className="metric-empty">No hay muestras grabadas aún.</p>
          )}
        </div>
      </section>

      <section className="trainer-actions">
        <button className="action-button undo" onClick={undoLastSample} disabled={datasetLength === 0} style={{ borderColor: 'var(--color-warning)', color: 'var(--color-warning)' }}>
          ↩️ DESHACER ÚLTIMA
        </button>
        <button className="action-button clear" onClick={clearDataset} disabled={datasetLength === 0}>
          🗑️ LIMPIAR TODO
        </button>
      </section>
    </aside>
  );
}
