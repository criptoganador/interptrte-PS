/**
 * App — Layout principal del Intérprete de Lengua de Señas Venezolana
 * Integra CameraView, DiagnosticsPanel y Header
 */

import { useState, useRef, useCallback, useMemo } from "react";
import { Header } from "./components/Header";
import { CameraView } from "./components/CameraView";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { TrainerPanel } from "./components/TrainerPanel";
import { SignTrainer } from "./components/SignTrainer";
import { useDataCollector } from "./hooks/useDataCollector";
import { useSignTranslation } from "./hooks/useSignTranslation";
import { ListenerPanel } from "./components/ListenerPanel";
import "./App.css";

function App() {
  const [diagnostics, setDiagnostics] = useState({
    fps: 0,
    handsDetected: 0,
    handedness: [],
    handConfidence: [],
    faceDetected: false,
    topExpressions: [],
    poseDetected: false,
    modelStatus: {
      hand: "loading",
      face: "loading",
      pose: "loading",
    },
  });

  const collector = useDataCollector();
  const translation = useSignTranslation();

  // Enlazar el borrado del dataset con la remoción física e instantánea del modelo entrenado
  const collectorWithUnload = useMemo(() => ({
    ...collector,
    clearDataset: async () => {
      collector.clearDataset();
      await translation.unloadModel();
    }
  }), [collector, translation]);

  // Refs para los detectores (se llenan desde CameraView)
  const detectorsRef = useRef(null);

  const handleDiagnosticsUpdate = useCallback((data) => {
    // Si es una función (del exposer), guardar refs
    if (typeof data === "function") return;

    // Guardar referencia a detectores si vienen
    if (data._detectors) {
      detectorsRef.current = data._detectors;
      return;
    }

    setDiagnostics(data);
  }, []);

  // Obtener detectores para el Header
  const getDetectors = () => {
    if (!detectorsRef.current) {
      return {
        handDetection: { isEnabled: true, setIsEnabled: () => {}, isReady: false, isLoading: true },
        faceDetection: { isEnabled: true, setIsEnabled: () => {}, isReady: false, isLoading: true },
        poseDetection: { isEnabled: true, setIsEnabled: () => {}, isReady: false, isLoading: true },
      };
    }
    return detectorsRef.current;
  };

  const detectors = getDetectors();

  return (
    <div className="app-container" id="app-container">
      <Header
        cameraStatus={diagnostics.modelStatus.hand === "loading" ? "loading" : "ready"}
        deviceName=""
        handDetection={detectors.handDetection}
        faceDetection={detectors.faceDetection}
        poseDetection={detectors.poseDetection}
      />

      <main className="app-main" id="app-main">
        <CameraView 
          onDiagnosticsUpdate={handleDiagnosticsUpdate} 
          onFrameRecord={collectorWithUnload.recordFrame}
          isRecording={collectorWithUnload.isRecording}
          collector={collectorWithUnload}
          translation={translation}
        />
        
        {/* PANEL CENTRAL: MODO OYENTE (Súper Visible) */}
        <div className="listener-column">
          <ListenerPanel dataset={collectorWithUnload._dataset || collectorWithUnload.dataset} />
        </div>

        <div className="side-panels">
          <DiagnosticsPanel diagnostics={diagnostics} />
          <TrainerPanel collector={collectorWithUnload} />
          <SignTrainer 
            dataset={collectorWithUnload._dataset || collectorWithUnload.dataset} 
            onModelTrained={translation.loadModel}
          />
          
          {/* Selector de Voz (Movido aquí a petición del usuario) */}
          {translation.voices && translation.voices.length > 0 && (
            <section className="diag-section voice-selector" style={{ marginTop: '10px' }}>
              <h3 className="section-title">Configuración de Voz</h3>
              <div className="input-group">
                <select 
                  value={translation.selectedVoiceURI} 
                  onChange={(e) => translation.changeVoice(e.target.value)}
                  style={{ 
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)', 
                    color: 'white', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    padding: '8px', 
                    borderRadius: '4px',
                    fontSize: '0.9rem',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  {translation.voices.filter(v => v.lang.startsWith("es")).map(v => (
                    <option key={v.voiceURI} value={v.voiceURI} style={{ background: '#222', color: 'white' }}>
                      {v.name.includes("Sabina") || v.name.includes("Helena") || v.name.includes("Laura") ? "👩 Voz Mujer" : 
                       v.name.includes("Pablo") || v.name.includes("Tomas") ? "👨 Voz Hombre" : 
                       `🗣️ ${v.name}`}
                    </option>
                  ))}
                </select>
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
