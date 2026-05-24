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

  // Procesar cada mano detectada
  for (let i = 0; i < frame.hands.length; i++) {
    const hand = frame.hands[i];
    
    // Obtener lateralidad (Izquierda o Derecha)
    // MediaPipe invierte esto en la vista frontal, nos guiaremos por el string que devuelva
    const handedness = frame.handednesses && frame.handednesses[i] 
      ? frame.handednesses[i] 
      : (i === 0 ? "Right" : "Left"); // Fallback

    // Normalizar puntos restando el origen (la nariz)
    const normalizedHand = hand.flatMap(p => [
      p.x - origin.x,
      p.y - origin.y,
      p.z - origin.z
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
