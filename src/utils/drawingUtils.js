/**
 * Utilidades de dibujo para landmarks de MediaPipe
 * Dibuja manos, rostro y pose corporal sobre un canvas HTML5
 */

import { HAND_CONNECTIONS, POSE_CONNECTIONS, DRAWING_COLORS } from "./mediapipeConfig";

/**
 * Limpia el canvas completamente
 */
export function clearCanvas(ctx, width, height) {
  ctx.clearRect(0, 0, width, height);
}

/**
 * Dibuja un punto landmark con efecto glow
 */
function drawLandmarkPoint(ctx, x, y, radius, color, glowColor) {
  // Glow exterior
  if (glowColor) {
    ctx.beginPath();
    ctx.arc(x, y, radius * 3, 0, 2 * Math.PI);
    ctx.fillStyle = glowColor;
    ctx.fill();
  }

  // Punto principal
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI);
  ctx.fillStyle = color;
  ctx.fill();

  // Borde brillante
  ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

/**
 * Dibuja una conexión entre dos landmarks
 */
function drawConnection(ctx, x1, y1, x2, y2, color, lineWidth = 2) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = "round";
  ctx.stroke();
}

/**
 * Dibuja los landmarks de una mano (21 puntos + conexiones)
 * @param {CanvasRenderingContext2D} ctx - Contexto del canvas
 * @param {Array} landmarks - Array de 21 landmarks normalizados {x, y, z}
 * @param {string} handedness - "Left" o "Right"
 * @param {number} width - Ancho del canvas
 * @param {number} height - Alto del canvas
 */
export function drawHandLandmarks(ctx, landmarks, handedness, width, height) {
  if (!landmarks || landmarks.length === 0) return;

  const colors = DRAWING_COLORS.hand;
  // Nota: MediaPipe devuelve la lateralidad desde la perspectiva de la cámara (espejo)
  const mainColor = handedness === "Left" ? colors.rightHand : colors.leftHand;
  const glowColor = handedness === "Left"
    ? "rgba(0, 255, 209, 0.4)"
    : "rgba(255, 107, 255, 0.4)";

  // Dibujar conexiones primero (debajo de los puntos)
  for (const [start, end] of HAND_CONNECTIONS) {
    const startLm = landmarks[start];
    const endLm = landmarks[end];
    if (startLm && endLm) {
      drawConnection(
        ctx,
        startLm.x * width,
        startLm.y * height,
        endLm.x * width,
        endLm.y * height,
        colors.connection,
        2.5
      );
    }
  }

  // Dibujar puntos
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = lm.x * width;
    const y = lm.y * height;

    // Puntas de los dedos más grandes (índices 4, 8, 12, 16, 20)
    const isFingertip = [4, 8, 12, 16, 20].includes(i);
    const radius = isFingertip ? 5 : 3;

    drawLandmarkPoint(ctx, x, y, radius, mainColor, isFingertip ? glowColor : null);
  }
}

/**
 * Dibuja la malla facial (478 puntos) - versión optimizada
 * Solo dibuja los contornos principales para rendimiento
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} landmarks - 478 puntos faciales normalizados
 * @param {number} width
 * @param {number} height
 */
export function drawFaceMesh(ctx, landmarks, width, height) {
  if (!landmarks || landmarks.length === 0) return;

  const colors = DRAWING_COLORS.face;

  // Contornos principales del rostro para dibujo eficiente
  const faceContours = {
    // Contorno del rostro
    jawline: [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
              397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
              172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
    // Ojo izquierdo
    leftEye: [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
    // Ojo derecho
    rightEye: [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398],
    // Ceja izquierda
    leftEyebrow: [70, 63, 105, 66, 107, 55, 65, 52, 53, 46],
    // Ceja derecha
    rightEyebrow: [300, 293, 334, 296, 336, 285, 295, 282, 283, 276],
    // Labios externos
    lipsOuter: [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185],
    // Labios internos
    lipsInner: [78, 95, 88, 178, 87, 14, 317, 402, 318, 324, 308, 415, 310, 311, 312, 13, 82, 81, 80, 191],
    // Nariz
    nose: [168, 6, 197, 195, 5, 4, 1, 19, 94, 2],
  };

  ctx.save();

  // Dibujar todos los puntos como una nube sutil
  ctx.fillStyle = colors.mesh;
  for (let i = 0; i < landmarks.length; i += 3) {
    const lm = landmarks[i];
    ctx.beginPath();
    ctx.arc(lm.x * width, lm.y * height, 0.8, 0, 2 * Math.PI);
    ctx.fill();
  }

  // Dibujar contornos principales
  for (const [name, indices] of Object.entries(faceContours)) {
    ctx.beginPath();
    const isLips = name.includes("lips");
    const isEye = name.includes("Eye") && !name.includes("brow");

    ctx.strokeStyle = isLips ? "#FF6BFF" : isEye ? "#A78BFA" : colors.connection;
    ctx.lineWidth = isLips || isEye ? 1.5 : 1;
    ctx.globalAlpha = 0.8;

    for (let i = 0; i < indices.length; i++) {
      const lm = landmarks[indices[i]];
      const x = lm.x * width;
      const y = lm.y * height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.stroke();
  }

  ctx.restore();
}

/**
 * Dibuja los landmarks de pose corporal (33 puntos)
 * Solo dibuja torso y brazos (relevante para LSV)
 * @param {CanvasRenderingContext2D} ctx
 * @param {Array} landmarks - 33 puntos de pose normalizados
 * @param {number} width
 * @param {number} height
 */
export function drawPoseLandmarks(ctx, landmarks, width, height) {
  if (!landmarks || landmarks.length === 0) return;

  const colors = DRAWING_COLORS.pose;

  // Solo dibujar landmarks relevantes (torso superior y brazos: 0-16, 23-24)
  const relevantIndices = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 23, 24]);

  // Dibujar conexiones
  for (const [start, end] of POSE_CONNECTIONS) {
    const startLm = landmarks[start];
    const endLm = landmarks[end];
    if (startLm && endLm && relevantIndices.has(start) && relevantIndices.has(end)) {
      // Visibilidad mínima para dibujar
      const startVis = startLm.visibility ?? 1;
      const endVis = endLm.visibility ?? 1;
      if (startVis > 0.3 && endVis > 0.3) {
        ctx.globalAlpha = Math.min(startVis, endVis);
        drawConnection(
          ctx,
          startLm.x * width,
          startLm.y * height,
          endLm.x * width,
          endLm.y * height,
          colors.connection,
          3
        );
      }
    }
  }

  ctx.globalAlpha = 1;

  // Dibujar puntos
  for (const i of relevantIndices) {
    const lm = landmarks[i];
    if (!lm) continue;
    const vis = lm.visibility ?? 1;
    if (vis < 0.3) continue;

    const x = lm.x * width;
    const y = lm.y * height;

    // Hombros y cadera más grandes
    const isJoint = [11, 12, 13, 14, 23, 24].includes(i);
    const radius = isJoint ? 6 : 4;

    ctx.globalAlpha = vis;
    drawLandmarkPoint(ctx, x, y, radius, colors.landmark, isJoint ? colors.glow : null);
  }

  ctx.globalAlpha = 1;
}

/**
 * Dibuja un indicador de FPS en la esquina
 */
export function drawFPSCounter(ctx, fps) {
  ctx.save();
  ctx.font = "bold 14px 'JetBrains Mono', monospace";
  ctx.fillStyle = "#00FFD1";
  ctx.globalAlpha = 0.8;
  ctx.fillText(`${fps} FPS`, 10, 24);
  ctx.restore();
}
