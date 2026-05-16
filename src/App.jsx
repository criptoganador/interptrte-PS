/**
 * App — Layout principal del Intérprete de Lengua de Señas Venezolana
 * Integra CameraView, DiagnosticsPanel y Header
 */

import { useState, useRef, useCallback } from "react";
import { Header } from "./components/Header";
import { CameraView } from "./components/CameraView";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
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
        <CameraView onDiagnosticsUpdate={handleDiagnosticsUpdate} />
        <DiagnosticsPanel diagnostics={diagnostics} />
      </main>
    </div>
  );
}

export default App;
