/**
 * Convierte un frame en crudo de MediaPipe en un vector de características de 126 valores.
 * Anclaje: Nariz (pose[0]) o Muñeca si no hay pose.
 * Formato: [Mano Derecha (63), Mano Izquierda (63)]
 */
export function extractFeatures(frame) {
  // Inicializamos ambas manos con ceros (por si alguna no aparece en cámara)
  let rightHand = new Array(63).fill(0);
  let leftHand = new Array(63).fill(0);

  // Si no hay manos, regresamos null para que el sistema lo ignore
  if (!frame || !frame.hands || frame.hands.length === 0) {
    return null;
  }

  // Definir punto de anclaje (Centro del Universo de la IA)
  // Intentamos usar la Nariz (pose 0)
  let origin = { x: 0.5, y: 0.5, z: 0 }; // default si todo falla
  if (frame.pose && frame.pose.length > 0) {
    origin = frame.pose[0];
  } else if (frame.hands[0].length > 0) {
    origin = frame.hands[0][0]; // Fallback a la primera muñeca detectada
  }

  // Calcular factor de escala (Distancia entre los hombros) para Invarianza de Escala
  let scale = 1.0;
  if (frame.pose && frame.pose.length > 12) {
    const leftShoulder = frame.pose[11];
    const rightShoulder = frame.pose[12];
    scale = Math.sqrt(
      Math.pow(leftShoulder.x - rightShoulder.x, 2) +
      Math.pow(leftShoulder.y - rightShoulder.y, 2) +
      Math.pow(leftShoulder.z - rightShoulder.z, 2)
    );
  }
  
  // Fallback si no hay hombros visibles: usar el tamaño de la mano
  if (scale < 0.01 && frame.hands[0].length > 9) {
    const wrist = frame.hands[0][0];
    const middleFinger = frame.hands[0][9];
    scale = Math.sqrt(
      Math.pow(wrist.x - middleFinger.x, 2) +
      Math.pow(wrist.y - middleFinger.y, 2) +
      Math.pow(wrist.z - middleFinger.z, 2)
    );
    scale = scale * 4; // Ajuste empírico porque la mano es más pequeña que los hombros
  }
  
  // Evitar división por cero
  if (scale < 0.01) scale = 1.0;

  // Procesar cada mano detectada
  for (let i = 0; i < frame.hands.length; i++) {
    const hand = frame.hands[i];
    
    // Obtener lateralidad (Izquierda o Derecha)
    // MediaPipe invierte esto en la vista frontal, nos guiaremos por el string que devuelva
    const handedness = frame.handednesses && frame.handednesses[i] 
      ? frame.handednesses[i] 
      : (i === 0 ? "Right" : "Left"); // Fallback

    // Normalizar puntos restando el origen (la nariz) y dividiendo por la escala
    const normalizedHand = hand.flatMap(p => [
      (p.x - origin.x) / scale,
      (p.y - origin.y) / scale,
      (p.z - origin.z) / scale
    ]);

    const isLeft = handedness.toLowerCase() === "left";
    if (isLeft) {
      leftHand = normalizedHand;
    } else {
      rightHand = normalizedHand;
    }
  }

  // El vector final siempre tiene 126 posiciones, sin importar si falta una mano
  return [...rightHand, ...leftHand];
}

/**
 * Calcula la distancia Euclidiana entre dos vectores de características (esqueletos).
 * Se usa para el Validador Matemático (Out-of-Distribution Detection).
 * @param {number[]} featuresA Vector actual
 * @param {number[]} featuresB Molde (Centroide) guardado
 * @returns {number} Distancia geométrica
 */
export function calculateDistance(featuresA, featuresB) {
  if (!featuresA || !featuresB || featuresA.length !== featuresB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < featuresA.length; i++) {
    sum += (featuresA[i] - featuresB[i]) ** 2;
  }
  return Math.sqrt(sum);
}
