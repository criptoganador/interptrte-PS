/**
 * TrainerPanel — Interfaz para capturar datos de entrenamiento
 * Incluye el editor de texto con mensajes del Grabador Inteligente
 */

import { useState, useEffect } from "react";

export function TrainerPanel({ collector }) {
  const [labelInput, setLabelInput] = useState("");

  const {
    isRecording,
    countdown,
    samplesCount,
    startRecording,
    clearDataset,
    undoLastSample,
    datasetLength,
    recorderMessage,
    clearRecorderMessage
  } = collector;

  const handleRecord = () => {
    if (!labelInput.trim()) {
      alert("Escribe el nombre de la seña antes de grabar.");
      return;
    }
    startRecording(labelInput.toUpperCase());
  };

  // Auto-limpiar el mensaje después de 8 segundos
  useEffect(() => {
    if (recorderMessage) {
      const timer = setTimeout(() => {
        clearRecorderMessage();
      }, 8000);
      return () => clearTimeout(timer);
    }
  }, [recorderMessage, clearRecorderMessage]);

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

      {/* === EDITOR DE TEXTO: Mensajes del Grabador Inteligente === */}
      {recorderMessage && (
        <section className="diag-section recorder-message-section">
          <div 
            className={`recorder-message ${recorderMessage.type}`}
            onClick={clearRecorderMessage}
            title="Clic para cerrar"
          >
            <div className="recorder-message-header">
              {recorderMessage.type === "duplicate" && "🔁 Grabador Inteligente"}
              {recorderMessage.type === "success" && "✅ Sistema"}
              {recorderMessage.type === "error" && "⚠️ Error"}
            </div>
            <div className="recorder-message-body">
              {recorderMessage.text}
            </div>
            <div className="recorder-message-dismiss">
              Toca para cerrar
            </div>
          </div>
        </section>
      )}

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

      <section className="diag-section">
        <h3 className="section-title">Resumido</h3>
        <p style={{ fontSize: '0.9rem', lineHeight: '1.5', margin: 0 }}>
          Las muestras nuevas se guardan automáticamente. Si hay señas comunitarias nuevas, verás un aviso para entrenar la IA.
        </p>
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
