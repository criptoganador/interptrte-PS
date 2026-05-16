/**
 * Configuración centralizada de MediaPipe Tasks Vision
 * URLs de modelos, WASM runtime, y constantes de detección
 */

// CDN base para los assets de WASM de MediaPipe
export const WASM_CDN = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";

// URLs de los modelos pre-entrenados
export const MODEL_URLS = {
  hand: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
  face: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task",
  pose: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
};

// Configuración de detección de manos
export const HAND_CONFIG = {
  numHands: 2,
  minHandDetectionConfidence: 0.5,
  minHandPresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

// Configuración de detección facial
export const FACE_CONFIG = {
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minFacePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
  outputFaceBlendshapes: true,
  outputFacialTransformationMatrixes: false,
};

// Configuración de detección de pose
export const POSE_CONFIG = {
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
};

// Configuración de la cámara PS3 Eye
export const CAMERA_CONFIG = {
  width: 640,
  height: 480,
  frameRate: 60,
};

// Conexiones entre landmarks de las manos (21 puntos)
export const HAND_CONNECTIONS = [
  // Pulgar
  [0, 1], [1, 2], [2, 3], [3, 4],
  // Índice
  [0, 5], [5, 6], [6, 7], [7, 8],
  // Medio
  [0, 9], [9, 10], [10, 11], [11, 12],
  // Anular
  [0, 13], [13, 14], [14, 15], [15, 16],
  // Meñique
  [0, 17], [17, 18], [18, 19], [19, 20],
  // Palma
  [5, 9], [9, 13], [13, 17],
];

// Conexiones del esqueleto corporal (pose)
export const POSE_CONNECTIONS = [
  // Torso
  [11, 12], [11, 23], [12, 24], [23, 24],
  // Brazo izquierdo
  [11, 13], [13, 15],
  // Brazo derecho
  [12, 14], [14, 16],
  // Mano izquierda
  [15, 17], [15, 19], [15, 21], [17, 19],
  // Mano derecha
  [16, 18], [16, 20], [16, 22], [18, 20],
  // Cara
  [0, 1], [1, 2], [2, 3], [3, 7],
  [0, 4], [4, 5], [5, 6], [6, 8],
  [9, 10],
];

// Colores para dibujar landmarks
export const DRAWING_COLORS = {
  hand: {
    landmark: "#00FFD1",       // Cyan-verde
    connection: "#00C9A7",     // Verde medio
    glow: "rgba(0, 255, 209, 0.4)",
    leftHand: "#FF6BFF",       // Rosa para mano izquierda
    rightHand: "#00FFD1",      // Cyan para mano derecha
  },
  face: {
    landmark: "#A78BFA",       // Púrpura suave
    connection: "#7C3AED",     // Púrpura medio
    mesh: "rgba(167, 139, 250, 0.15)",
    glow: "rgba(124, 58, 237, 0.3)",
  },
  pose: {
    landmark: "#FBBF24",       // Amarillo dorado
    connection: "#F59E0B",     // Naranja
    glow: "rgba(251, 191, 36, 0.3)",
  },
};
