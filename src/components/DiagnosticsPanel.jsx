/**
 * DiagnosticsPanel — Panel lateral con métricas en tiempo real
 * Muestra FPS, manos detectadas, expresiones faciales, confianza
 */

export function DiagnosticsPanel({ diagnostics }) {
  const {
    fps = 0,
    handsDetected = 0,
    handedness = [],
    handConfidence = [],
    faceDetected = false,
    topExpressions = [],
    poseDetected = false,
    modelStatus = {},
  } = diagnostics;

  return (
    <aside className="diagnostics-panel" id="diagnostics-panel">
      <h2 className="panel-title">
        <span className="panel-icon">📊</span>
        Diagnóstico
      </h2>

      {/* Rendimiento */}
      <section className="diag-section" id="diag-performance">
        <h3 className="section-title">Rendimiento</h3>
        <div className="metric-row">
          <span className="metric-label">FPS</span>
          <span
            className={`metric-value fps-value ${
              fps >= 30 ? "fps-good" : fps >= 15 ? "fps-ok" : "fps-bad"
            }`}
          >
            {fps}
          </span>
        </div>
      </section>

      {/* Estado de Modelos */}
      <section className="diag-section" id="diag-models">
        <h3 className="section-title">Modelos IA</h3>
        <ModelStatus
          name="HandLandmarker"
          icon="🖐️"
          status={modelStatus.hand}
        />
        <ModelStatus
          name="FaceLandmarker"
          icon="😊"
          status={modelStatus.face}
        />
        <ModelStatus
          name="PoseLandmarker"
          icon="🧍"
          status={modelStatus.pose}
        />
      </section>

      {/* Detección de Manos */}
      <section className="diag-section" id="diag-hands">
        <h3 className="section-title">🖐️ Manos</h3>
        <div className="metric-row">
          <span className="metric-label">Detectadas</span>
          <span className="metric-value">{handsDetected}</span>
        </div>
        {handedness.map((hand, i) => (
          <div className="metric-row" key={i}>
            <span className="metric-label">
              {hand === "Left" ? "→ Derecha" : "← Izquierda"}
            </span>
            <span className="metric-value confidence">
              {handConfidence[i] ? `${Math.round(handConfidence[i] * 100)}%` : "—"}
            </span>
          </div>
        ))}
        {handsDetected === 0 && (
          <div className="metric-empty">
            Muestra tus manos a la cámara
          </div>
        )}
      </section>

      {/* Detección Facial */}
      <section className="diag-section" id="diag-face">
        <h3 className="section-title">😊 Expresión Facial</h3>
        <div className="metric-row">
          <span className="metric-label">Rostro</span>
          <span className={`metric-value ${faceDetected ? "detected" : ""}`}>
            {faceDetected ? "Detectado" : "No detectado"}
          </span>
        </div>
        {topExpressions.length > 0 && (
          <div className="expressions-list">
            {topExpressions.map((expr, i) => (
              <div className="expression-item" key={i}>
                <span className="expr-name">{formatExpression(expr.name)}</span>
                <div className="expr-bar-container">
                  <div
                    className="expr-bar"
                    style={{ width: `${expr.score}%` }}
                  />
                </div>
                <span className="expr-score">{expr.score}%</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Detección de Pose */}
      <section className="diag-section" id="diag-pose">
        <h3 className="section-title">🧍 Pose Corporal</h3>
        <div className="metric-row">
          <span className="metric-label">Cuerpo</span>
          <span className={`metric-value ${poseDetected ? "detected" : ""}`}>
            {poseDetected ? "Detectado" : "No detectado"}
          </span>
        </div>
      </section>

      {/* Info del proyecto */}
      <section className="diag-section diag-info" id="diag-info">
        <p className="info-text">
          <strong>Intérprete LSV</strong> · Hito 1
          <br />
          MediaPipe Tasks Vision · WASM
        </p>
      </section>
    </aside>
  );
}

function ModelStatus({ name, icon, status }) {
  const labels = {
    loading: "Cargando...",
    ready: "Listo",
    error: "Error",
    disabled: "Desactivado",
  };
  const statusClass = status || "disabled";

  return (
    <div className={`model-status model-${statusClass}`}>
      <span className="model-icon">{icon}</span>
      <span className="model-name">{name}</span>
      <span className={`model-badge badge-${statusClass}`}>
        {labels[statusClass] || "—"}
      </span>
    </div>
  );
}

/**
 * Formatea nombres de blendshapes de MediaPipe a español legible
 */
function formatExpression(name) {
  const translations = {
    browDownLeft: "Ceño izq ↓",
    browDownRight: "Ceño der ↓",
    browInnerUp: "Cejas ↑",
    browOuterUpLeft: "Ceja izq ↑",
    browOuterUpRight: "Ceja der ↑",
    eyeBlinkLeft: "Parpadeo izq",
    eyeBlinkRight: "Parpadeo der",
    eyeSquintLeft: "Entrecerrar izq",
    eyeSquintRight: "Entrecerrar der",
    eyeWideLeft: "Ojo abierto izq",
    eyeWideRight: "Ojo abierto der",
    jawOpen: "Boca abierta",
    mouthSmileLeft: "Sonrisa izq",
    mouthSmileRight: "Sonrisa der",
    mouthFrownLeft: "Ceño fruncido",
    mouthPucker: "Labios fruncidos",
    cheekPuff: "Mejillas infladas",
    mouthOpen: "Boca abierta",
    noseSneerLeft: "Nariz arrugada",
  };
  return translations[name] || name;
}
