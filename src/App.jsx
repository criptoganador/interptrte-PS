/**
 * App — Layout principal del Intérprete de Lengua de Señas Venezolana
 * Integra CameraView, DiagnosticsPanel y Header
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { Header } from "./components/Header";
import { CameraView } from "./components/CameraView";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { TrainerPanel } from "./components/TrainerPanel";
import { SignTrainer } from "./components/SignTrainer";
import { useDataCollector } from "./hooks/useDataCollector";
import { useSignTranslation } from "./hooks/useSignTranslation";
import { ListenerPanel } from "./components/ListenerPanel";
import { Auth } from "./components/Auth";
import "./App.css";

function App() {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('lsv-user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('lsv-token') || null);

  const handleLogin = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('lsv-user');
    localStorage.removeItem('lsv-token');
    setUser(null);
    setToken(null);
  };

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
  const { syncCommunityFromCloud } = collector;
  const translation = useSignTranslation();

  useEffect(() => {
    if (user && token && syncCommunityFromCloud) {
      syncCommunityFromCloud().catch((err) => {
        console.error('Error en la descarga comunitaria automática:', err);
      });
    }
  }, [user, token, syncCommunityFromCloud]);

  // Enlazar el borrado del dataset con la remoción física e instantánea del modelo entrenado
  const collectorWithUnload = useMemo(() => ({
    ...collector,
    clearDataset: async () => {
      collector.clearDataset();
      await translation.unloadModel();
    }
  }), [collector, translation]);

  // Estado para los detectores (se sincroniza desde CameraView para evitar lecturas de Ref en render)
  const [detectors, setDetectors] = useState({
    handDetection: { isEnabled: true, setIsEnabled: () => {}, isReady: false, isLoading: true },
    faceDetection: { isEnabled: true, setIsEnabled: () => {}, isReady: false, isLoading: true },
    poseDetection: { isEnabled: true, setIsEnabled: () => {}, isReady: false, isLoading: true },
  });

  const handleDiagnosticsUpdate = useCallback((data) => {
    // Si es una función (del exposer), guardar refs
    if (typeof data === "function") return;

    // Guardar referencia a detectores si vienen
    if (data._detectors) {
      setDetectors(data._detectors);
      return;
    }

    setDiagnostics(data);
  }, []);

  const [activeRightTab, setActiveRightTab] = useState("chat");
  const [isCompact, setIsCompact] = useState(window.innerWidth <= 900);
  const [isTheatreMode, setIsTheatreMode] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsCompact(window.innerWidth <= 900);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!user || !token) {
    return <Auth onLogin={handleLogin} />;
  }

  return (
    <div className="app-container" id="app-container">
      <Header
        cameraStatus={diagnostics.modelStatus.hand === "loading" ? "loading" : "ready"}
        deviceName=""
        handDetection={detectors.handDetection}
        faceDetection={detectors.faceDetection}
        poseDetection={detectors.poseDetection}
        onLogout={handleLogout}
        user={user}
      />

      <main className={`app-main ${isTheatreMode ? "theatre-active" : ""}`} id="app-main">
        <CameraView 
          onDiagnosticsUpdate={handleDiagnosticsUpdate} 
          onFrameRecord={collectorWithUnload.recordFrame}
          isRecording={collectorWithUnload.isRecording}
          collector={collectorWithUnload}
          translation={translation}
          isTheatreMode={isTheatreMode}
          onToggleTheatreMode={() => setIsTheatreMode(prev => !prev)}
        />
        
        {/* PANEL CENTRAL: MODO OYENTE O ENTRENADOR (Según el tamaño) */}
        <div className="listener-column">
          {isCompact && (
            <div className="column-tabs-selector">
              <button 
                className={`tab-btn ${activeRightTab === "chat" ? "active" : ""}`}
                onClick={() => setActiveRightTab("chat")}
              >
                💬 Modo Oyente
              </button>
              <button 
                className={`tab-btn ${activeRightTab === "trainer" ? "active" : ""}`}
                onClick={() => setActiveRightTab("trainer")}
              >
                🧠 Entrenador e IA
              </button>
            </div>
          )}

          {(!isCompact || activeRightTab === "chat") ? (
            <ListenerPanel dataset={collectorWithUnload._dataset || collectorWithUnload.dataset} />
          ) : (
            <div className="tab-trainer-content">
              <TrainerPanel collector={collectorWithUnload} />
              <SignTrainer 
                dataset={collectorWithUnload._dataset || collectorWithUnload.dataset} 
                onModelTrained={translation.loadModel}
                syncCommunityFromCloud={collectorWithUnload.syncCommunityFromCloud}
              />
              <DiagnosticsPanel diagnostics={diagnostics} />
              
              {/* Selector de Voz */}
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
          )}
        </div>

        {/* PANEL SECUNDARIO DESKTOP (Solo visible si hay espacio amplio) */}
        {!isCompact && !isTheatreMode && (
          <div className="side-panels">
            <DiagnosticsPanel diagnostics={diagnostics} />
            <TrainerPanel collector={collectorWithUnload} />
            <SignTrainer 
              dataset={collectorWithUnload._dataset || collectorWithUnload.dataset} 
              onModelTrained={translation.loadModel}
              syncCommunityFromCloud={collectorWithUnload.syncCommunityFromCloud}
            />
            
            {/* Selector de Voz */}
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
        )}
      </main>
    </div>
  );
}

export default App;
