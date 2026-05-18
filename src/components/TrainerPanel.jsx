/**
 * TrainerPanel — Interfaz para capturar datos de entrenamiento
 * Ahora con soporte integrado de respaldo y auto-guardado en Google Drive.
 */

import { useState } from "react";

export function TrainerPanel({ collector }) {
  const [labelInput, setLabelInput] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [clientIdInput, setClientIdInput] = useState(collector.gdrive?.clientId || "");

  const {
    isRecording,
    countdown,
    samplesCount,
    startRecording,
    clearDataset,
    undoLastSample,
    datasetLength,
    gdrive
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

      {/* SECCIÓN DE RESPALDO EN LA NUBE (Google Drive) */}
      {gdrive && (
        <section className="diag-section gdrive-sync-section" style={{ borderLeft: '3px solid #34a853' }}>
          <h3 className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              ☁️ Respaldo en la Nube
            </span>
            <button 
              onClick={() => setShowSettings(!showSettings)} 
              style={{ 
                background: 'transparent', 
                border: 'none', 
                color: showSettings ? '#34a853' : 'rgba(255, 255, 255, 0.4)', 
                cursor: 'pointer',
                fontSize: '1rem',
                transition: 'color 0.2s',
                outline: 'none',
                padding: '2px 6px'
              }}
              title="Ajustes de Google Drive"
            >
              ⚙️
            </button>
          </h3>

          {showSettings && (
            <div className="gdrive-settings" style={{ 
              background: 'rgba(255,255,255,0.03)', 
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: '6px', 
              padding: '10px', 
              margin: '10px 0 5px 0',
              fontSize: '0.8rem'
            }}>
              <label style={{ display: 'block', marginBottom: '5px', color: 'rgba(255,255,255,0.6)', fontWeight: 'bold' }}>
                Google OAuth Client ID:
              </label>
              <input 
                type="text" 
                placeholder="Pegar Google Client ID..."
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'white',
                  padding: '8px',
                  borderRadius: '4px',
                  marginBottom: '8px',
                  fontSize: '0.75rem',
                  outline: 'none'
                }}
              />
              <button 
                onClick={() => {
                  gdrive.updateClientId(clientIdInput.trim());
                  setShowSettings(false);
                  alert("¡Google Client ID guardado con éxito!");
                }}
                style={{
                  background: '#34a853',
                  color: 'white',
                  border: 'none',
                  padding: '6px 10px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  width: '100%',
                  fontSize: '0.8rem'
                }}
              >
                Guardar Ajustes
              </button>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', marginTop: '8px', lineHeight: '1.3' }}>
                Para sincronizar en la nube necesitas un Client ID de Google Cloud Console con el origen de redirección configurado para esta app.
              </p>
            </div>
          )}

          <div style={{ marginTop: '10px' }}>
            {gdrive.isConnected ? (
              <div className="gdrive-status-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className={`sync-indicator-dot ${
                      gdrive.syncStatus === 'syncing' ? 'syncing' :
                      gdrive.syncStatus === 'success' ? 'success' :
                      gdrive.syncStatus === 'error' ? 'error' : 'connected'
                    }`} style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      display: 'inline-block',
                      backgroundColor: 
                        gdrive.syncStatus === 'syncing' ? '#fbbc05' :
                        gdrive.syncStatus === 'success' ? '#34a853' :
                        gdrive.syncStatus === 'error' ? '#ea4335' : '#4285f4',
                      boxShadow: '0 0 8px currentColor'
                    }} />
                    <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>
                      {gdrive.syncStatus === 'syncing' ? '🔄 Guardando en Drive...' :
                       gdrive.syncStatus === 'success' ? '✅ Nube Sincronizada' :
                       gdrive.syncStatus === 'error' ? '❌ Error de Sincronización' :
                       '☁️ Respaldo en la Nube Activo'}
                    </span>
                  </div>
                </div>

                {gdrive.lastSyncTime && (
                  <p style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.4)', margin: '4px 0 10px 0' }}>
                    Último guardado: <strong>{gdrive.lastSyncTime}</strong>
                  </p>
                )}

                <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
                  <button 
                    onClick={() => gdrive.syncDataset(collector.dataset)} 
                    style={{
                      flex: 1,
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: 'white',
                      padding: '6px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.06)'}
                  >
                    🔄 Forzar Guardado
                  </button>
                  <button 
                    onClick={gdrive.logout} 
                    style={{
                      background: 'rgba(234, 67, 53, 0.1)',
                      border: '1px solid rgba(234, 67, 53, 0.2)',
                      color: '#ea4335',
                      padding: '6px 10px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '0.75rem',
                      fontWeight: 'bold',
                      transition: 'background-color 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(234, 67, 53, 0.15)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(234, 67, 53, 0.1)'}
                  >
                    Salir
                  </button>
                </div>
              </div>
            ) : (
              <div className="gdrive-login-box">
                <p style={{ fontSize: '0.75rem', color: 'rgba(255, 255, 255, 0.5)', marginBottom: '10px', lineHeight: '1.4' }}>
                  Sincroniza tus señas automáticamente con tu cuenta de Google para respaldarlas y recuperarlas al instante.
                </p>
                <button 
                  onClick={gdrive.login} 
                  disabled={!gdrive.clientId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px',
                    width: '100%',
                    background: gdrive.clientId ? '#ffffff' : 'rgba(255, 255, 255, 0.1)',
                    color: gdrive.clientId ? '#1f1f1f' : 'rgba(255, 255, 255, 0.3)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    cursor: gdrive.clientId ? 'pointer' : 'not-allowed',
                    fontWeight: 'bold',
                    fontSize: '0.8rem',
                    transition: 'all 0.2s',
                    outline: 'none'
                  }}
                  onMouseEnter={(e) => { if (gdrive.clientId) e.currentTarget.style.backgroundColor = '#f8f9fa'; }}
                  onMouseLeave={(e) => { if (gdrive.clientId) e.currentTarget.style.backgroundColor = '#ffffff'; }}
                >
                  <svg viewBox="0 0 48 48" width="16" height="16" style={{ display: 'block', opacity: gdrive.clientId ? 1 : 0.3 }}>
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.5 24c0-1.55-.15-3.24-.47-4.77H24v9.03h12.75c-.53 2.87-2.18 5.3-4.63 6.93l7.2 5.58C43.52 36.57 46.5 30.77 46.5 24z" />
                    <path fill="#FBBC05" d="M10.54 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.98-6.19z" fillRule="evenodd" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.2-5.58c-2.11 1.41-4.8 2.27-8.69 2.27-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  Conectar Google Drive
                </button>
                {!gdrive.clientId && (
                  <p style={{ fontSize: '0.7rem', color: 'var(--color-warning)', marginTop: '8px', textAlign: 'center' }}>
                    ⚠️ Haz clic en el icono ⚙️ arriba para configurar tu Google Client ID.
                  </p>
                )}
              </div>
            )}
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
