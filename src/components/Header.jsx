/**
 * Header — Barra superior con nombre del proyecto y controles de detectores
 */

import { useState } from "react";

export function Header({
  cameraStatus,
  deviceName,
  handDetection,
  faceDetection,
  poseDetection,
  onLogout,
  user
}) {
  const [showControls, setShowControls] = useState(false);

  const statusIndicator = {
    idle: { color: "#6B7280", label: "Inactiva" },
    loading: { color: "#FBBF24", label: "Conectando..." },
    ready: { color: "#00FFD1", label: "Activa" },
    error: { color: "#EF4444", label: "Error" },
    denied: { color: "#EF4444", label: "Sin permiso" },
  };

  const current = statusIndicator[cameraStatus] || statusIndicator.idle;

  return (
    <header className="app-header" id="app-header">
      <div className="header-left">
        <div className="logo-container">
          <span className="logo-icon">🤟</span>
          <div className="logo-text">
            <h1>Intérprete LSV</h1>
            <span className="logo-subtitle">Lengua de Señas Venezolana</span>
          </div>
        </div>
      </div>

      <div className="header-center">
        <div className="camera-status" id="camera-status-indicator">
          <span
            className="status-dot"
            style={{
              backgroundColor: current.color,
              boxShadow: `0 0 8px ${current.color}`,
            }}
          />
          <span className="status-text">{current.label}</span>
          {deviceName && cameraStatus === "ready" && (
            <span className="device-name">{deviceName}</span>
          )}
        </div>
      </div>

      <div className="header-right" style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
        {user && (
          <div style={{ fontSize: '12px', color: 'var(--color-primary)' }}>
            {user.email}
          </div>
        )}
        
        {onLogout && (
          <button 
            className="controls-toggle" 
            onClick={onLogout}
            title="Cerrar Sesión"
            style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}
          >
            <span className="toggle-label">Salir</span>
          </button>
        )}

        <button
          className="controls-toggle"
          id="btn-toggle-controls"
          onClick={() => setShowControls(!showControls)}
          title="Controles de detectores"
        >
          <span className="toggle-icon">⚙️</span>
          <span className="toggle-label">Detectores</span>
        </button>

        {showControls && (
          <div className="detector-controls" id="detector-controls-panel">
            <DetectorToggle
              id="toggle-hand"
              label="🖐️ Manos"
              enabled={handDetection.isEnabled}
              ready={handDetection.isReady}
              loading={handDetection.isLoading}
              onToggle={() => handDetection.setIsEnabled(!handDetection.isEnabled)}
            />
            <DetectorToggle
              id="toggle-face"
              label="😊 Rostro"
              enabled={faceDetection.isEnabled}
              ready={faceDetection.isReady}
              loading={faceDetection.isLoading}
              onToggle={() => faceDetection.setIsEnabled(!faceDetection.isEnabled)}
            />
            <DetectorToggle
              id="toggle-pose"
              label="🧍 Pose"
              enabled={poseDetection.isEnabled}
              ready={poseDetection.isReady}
              loading={poseDetection.isLoading}
              onToggle={() => poseDetection.setIsEnabled(!poseDetection.isEnabled)}
            />
          </div>
        )}
      </div>
    </header>
  );
}

function DetectorToggle({ id, label, enabled, ready, loading, onToggle }) {
  return (
    <div className="detector-toggle" id={id}>
      <span className="detector-label">{label}</span>
      <div className="toggle-status">
        {loading && <span className="loading-spinner" />}
        {!loading && ready && <span className="ready-badge">✓</span>}
        {!loading && !ready && <span className="not-ready-badge">—</span>}
      </div>
      <button
        className={`toggle-switch ${enabled ? "active" : ""}`}
        onClick={onToggle}
        aria-label={`${enabled ? "Desactivar" : "Activar"} ${label}`}
      >
        <span className="toggle-thumb" />
      </button>
    </div>
  );
}
