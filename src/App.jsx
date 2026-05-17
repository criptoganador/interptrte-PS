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
        </div>
      </main>
    </div>
  );
}

export default App;
