/**
 * App — Layout principal del Intérprete de Lengua de Señas Venezolana
 * Integra CameraView, DiagnosticsPanel y Header
 */

import { useState, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { CameraView } from "./components/CameraView";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { TrainerPanel } from "./components/TrainerPanel";
import { SignTrainer } from "./components/SignTrainer";
import { useDataCollector } from "./hooks/useDataCollector";
import { useSignTranslation } from "./hooks/useSignTranslation";
import { useSpeechToText } from "./hooks/useSpeechToText";
import { AvatarReplay } from "./components/AvatarReplay";
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

  // === VOZ A SEÑAS (BIDIRECCIONAL) ===
  const [replaySequence, setReplaySequence] = useState(null);
  const [spokenWord, setSpokenWord] = useState("");

  const handleWordMatch = useCallback((word) => {
    console.log("🔍 Buscando seña para:", word);
    // Buscar en el dataset una muestra con esa etiqueta
    const match = collector.dataset.find(s => s.label.toUpperCase() === word);
    if (match) {
      console.log("🎯 ¡Coincidencia encontrada! Reproduciendo seña para:", word);
      setReplaySequence(match.sequence);
      setSpokenWord(word);
    }
  }, [collector.dataset]);

  const { isListening, startListening, stopListening } = useSpeechToText(handleWordMatch);

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
          onFrameRecord={collector.recordFrame}
          isRecording={collector.isRecording}
          collector={collector}
          translation={translation}
        />
        <div className="side-panels">
          <DiagnosticsPanel diagnostics={diagnostics} />
          <TrainerPanel collector={collector} />
          <SignTrainer 
            dataset={collector._dataset || collector.dataset} 
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
          
          {/* Panel de Avatar / Voz a Señas */}
          <section className="diag-section" style={{ marginTop: '10px' }}>
            <h3 className="section-title">Voz a Señas (Oyente)</h3>
            <button 
              onClick={isListening ? stopListening : startListening}
              style={{
                width: '100%',
                padding: '10px',
                background: isListening ? 'var(--color-warning)' : 'var(--color-primary)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginBottom: '10px',
                fontWeight: 'bold'
              }}
            >
              {isListening ? "🛑 Detener Micrófono" : "🎤 Activar Micrófono"}
            </button>
            
            {replaySequence ? (
              <div>
                <p style={{ textAlign: 'center', marginBottom: '5px', fontSize: '0.9rem' }}>
                  Mostrando seña: <strong style={{ color: 'var(--color-primary)' }}>{spokenWord}</strong>
                </p>
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <AvatarReplay sequence={replaySequence} width={250} height={187} />
                </div>
              </div>
            ) : (
              <div style={{ 
                height: '187px', 
                background: 'rgba(0,0,0,0.2)', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#777',
                borderRadius: '8px',
                border: '1px solid rgba(255,255,255,0.05)',
                fontSize: '0.9rem',
                textAlign: 'center',
                padding: '10px'
              }}>
                {isListening ? "Escuchando... Di una palabra grabada (ej: HOLA)" : "Activa el micro para escuchar al profesor"}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

export default App;
