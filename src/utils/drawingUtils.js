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
 * Dibuja una esfera sombreada en 3D con perspectiva y reflejos
 */
function draw3DSphere(ctx, x, y, z = 0, radius = 5, baseColor = "#fff") {
  ctx.save();
  
  // Perspectiva basada en la profundidad Z (MediaPipe Z suele ir de -1.0 a 1.0)
  // Cuanto más negativo, más cerca (más grande). Más positivo, más lejos (más pequeño).
  const scale = 1.0 - (z * 0.45);
  const r = Math.max(1.5, radius * scale);
  
  // Crear gradiente radial para simular volumen 3D con brillo superior izquierdo
  const grad = ctx.createRadialGradient(
    x - r * 0.25, y - r * 0.25, r * 0.08, // Centro del brillo
    x, y, r // Limite exterior
  );
  
  // Brillo -> Color base -> Sombra de profundidad
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.18, "#ffffff");
  grad.addColorStop(0.35, baseColor);
  grad.addColorStop(0.9, shadeColor(baseColor, -50)); // Oscurecer el borde
  grad.addColorStop(1, "rgba(0,0,0,0.7)");
  
  ctx.beginPath();
  ctx.arc(x, y, r, 0, 2 * Math.PI);
  ctx.fillStyle = grad;
  
  // Sombra suave en el lienzo para realismo
  ctx.shadowColor = "rgba(0, 0, 0, 0.6)";
  ctx.shadowBlur = r * 0.5;
  ctx.shadowOffsetX = r * 0.2;
  ctx.shadowOffsetY = r * 0.2;
  
  ctx.fill();
  
  // Borde fino de luz ambiental
  ctx.shadowColor = "transparent"; // Resetear sombra para el trazo
  ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
  
  ctx.restore();
}

/**
 * Dibuja un cilindro sombreada en 3D (tubo) que une dos articulaciones con profundidad
 */
function draw3DCylinder(ctx, x1, y1, z1, x2, y2, z2, baseColor, width = 6) {
  ctx.save();
  
  // Escala de perspectiva para cada extremo
  const scale1 = 1.0 - (z1 * 0.45);
  const scale2 = 1.0 - (z2 * 0.45);
  const w1 = Math.max(1, width * scale1);
  const w2 = Math.max(1, width * scale2);
  
  // Vector director y perpendicular
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.1) {
    ctx.restore();
    return;
  }
  
  const nx = -dy / len;
  const ny = dx / len;
  
  // Polígono trapezoidal del tubo
  const p1x = x1 + nx * (w1 / 2);
  const p1y = y1 + ny * (w1 / 2);
  const p2x = x2 + nx * (w2 / 2);
  const p2y = y2 + ny * (w2 / 2);
  const p3x = x2 - nx * (w2 / 2);
  const p3y = y2 - ny * (w2 / 2);
  const p4x = x1 - nx * (w1 / 2);
  const p4y = y1 - ny * (w1 / 2);
  
  // Gradiente lineal transversal para simular luz sobre cilindro (brillo en medio)
  const grad = ctx.createLinearGradient(
    x1 + nx * (w1 / 2), y1 + ny * (w1 / 2),
    x1 - nx * (w1 / 2), y1 - ny * (w1 / 2)
  );
  
  grad.addColorStop(0, shadeColor(baseColor, -60)); // Sombra izquierda
  grad.addColorStop(0.2, baseColor);
  grad.addColorStop(0.4, "#ffffff"); // Reflejo brillante de luz
  grad.addColorStop(0.5, "#ffffff");
  grad.addColorStop(0.7, baseColor);
  grad.addColorStop(1, shadeColor(baseColor, -80)); // Sombra derecha profunda
  
  ctx.beginPath();
  ctx.moveTo(p1x, p1y);
  ctx.lineTo(p2x, p2y);
  ctx.lineTo(p3x, p3y);
  ctx.lineTo(p4x, p4y);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();
  
  // Redondear extremos para unirlos perfectamente con las esferas
  ctx.beginPath();
  ctx.arc(x1, y1, w1 / 2, 0, 2 * Math.PI);
  ctx.fillStyle = baseColor;
  ctx.fill();
  
  ctx.beginPath();
  ctx.arc(x2, y2, w2 / 2, 0, 2 * Math.PI);
  ctx.fillStyle = baseColor;
  ctx.fill();
  
  ctx.restore();
}

/**
 * Función auxiliar para aclarar/oscurecer colores hex/rgba de forma rápida
 */
function shadeColor(color, percent) {
  if (color.startsWith("rgba") || color.startsWith("rgb")) {
    // Para simplificar, si es rgb(a) devolvemos un color de sombra genérico
    return percent < 0 ? "rgba(0,0,0,0.6)" : "rgba(255,255,255,0.4)";
  }
  
  let R = parseInt(color.substring(1, 3), 16);
  let G = parseInt(color.substring(3, 5), 16);
  let B = parseInt(color.substring(5, 7), 16);

  R = parseInt((R * (100 + percent)) / 100);
  G = parseInt((G * (100 + percent)) / 100);
  B = parseInt((B * (100 + percent)) / 100);

  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;

  R = R > 0 ? R : 0;
  G = G > 0 ? G : 0;
  B = B > 0 ? B : 0;

  const rHex = R.toString(16).padStart(2, '0');
  const gHex = G.toString(16).padStart(2, '0');
  const bHex = B.toString(16).padStart(2, '0');

  return `#${rHex}${gHex}${bHex}`;
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

  // Dibujar conexiones primero como cilindros 3D (debajo de las esferas)
  for (const [start, end] of HAND_CONNECTIONS) {
    const startLm = landmarks[start];
    const endLm = landmarks[end];
    if (startLm && endLm) {
      draw3DCylinder(
        ctx,
        startLm.x * width,
        startLm.y * height,
        startLm.z || 0,
        endLm.x * width,
        endLm.y * height,
        endLm.z || 0,
        colors.connection,
        3.5 // Tubo de dedos
      );
    }
  }

  // Dibujar puntos como esferas 3D
  for (let i = 0; i < landmarks.length; i++) {
    const lm = landmarks[i];
    const x = lm.x * width;
    const y = lm.y * height;
    const z = lm.z || 0;

    // Puntas de los dedos más grandes (índices 4, 8, 12, 16, 20)
    const isFingertip = [4, 8, 12, 16, 20].includes(i);
    const radius = isFingertip ? 5.5 : 3.5;

    draw3DSphere(ctx, x, y, z, radius, mainColor);
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

  // 1. Rellenar silueta sólida del rostro (cabeza humana)
  ctx.beginPath();
  for (let i = 0; i < faceContours.jawline.length; i++) {
    const lm = landmarks[faceContours.jawline[i]];
    if (lm) {
      const x = lm.x * width;
      const y = lm.y * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(167, 139, 250, 0.12)"; // Púrpura sutil de cara
  ctx.fill();

  // 2. Rellenar ojos en color brillante translúcido
  const fillEye = (indices, eyeColor) => {
    ctx.beginPath();
    for (let i = 0; i < indices.length; i++) {
      const lm = landmarks[indices[i]];
      if (lm) {
        const x = lm.x * width;
        const y = lm.y * height;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    }
    ctx.closePath();
    ctx.fillStyle = eyeColor;
    ctx.fill();
  };
  fillEye(faceContours.leftEye, "rgba(0, 255, 209, 0.35)"); // Cyan futurista
  fillEye(faceContours.rightEye, "rgba(0, 255, 209, 0.35)");

  // 3. Rellenar labios en color sutil
  ctx.beginPath();
  for (let i = 0; i < faceContours.lipsOuter.length; i++) {
    const lm = landmarks[faceContours.lipsOuter[i]];
    if (lm) {
      const x = lm.x * width;
      const y = lm.y * height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  }
  ctx.closePath();
  ctx.fillStyle = "rgba(255, 107, 255, 0.3)"; // Labios rosas futuristas
  ctx.fill();

  // 4. Dibujar contornos principales
  for (const [name, indices] of Object.entries(faceContours)) {
    ctx.beginPath();
    const isLips = name.includes("lips");
    const isEye = name.includes("Eye") && !name.includes("brow");

    ctx.strokeStyle = isLips ? "#FF6BFF" : isEye ? "#00FFD1" : colors.connection;
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

  // --- 1. DIBUJAR SILUETA DEL TORSO ---
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];

  if (leftShoulder && rightShoulder && leftHip && rightHip) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(leftShoulder.x * width, leftShoulder.y * height);
    ctx.lineTo(rightShoulder.x * width, rightShoulder.y * height);
    ctx.lineTo(rightHip.x * width, rightHip.y * height);
    ctx.lineTo(leftHip.x * width, leftHip.y * height);
    ctx.closePath();
    
    // Gradiente futurista (de púrpura brillante a transparente)
    const torsoGrad = ctx.createLinearGradient(
      0, rightShoulder.y * height,
      0, rightHip.y * height
    );
    torsoGrad.addColorStop(0, "rgba(124, 58, 237, 0.35)"); // Violeta
    torsoGrad.addColorStop(1, "rgba(124, 58, 237, 0.02)");
    
    ctx.fillStyle = torsoGrad;
    ctx.fill();
    
    ctx.strokeStyle = "rgba(124, 58, 237, 0.5)";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();
  }

  // Dibujar conexiones como cilindros 3D
  for (const [start, end] of POSE_CONNECTIONS) {
    const startLm = landmarks[start];
    const endLm = landmarks[end];
    if (startLm && endLm && relevantIndices.has(start) && relevantIndices.has(end)) {
      // Visibilidad mínima para dibujar
      const startVis = startLm.visibility ?? 1;
      const endVis = endLm.visibility ?? 1;
      if (startVis > 0.3 && endVis > 0.3) {
        ctx.save();
        ctx.globalAlpha = Math.min(startVis, endVis);
        
        // Identificar si es conexión de brazo (hombro, codo, muñeca)
        const isArm = ([11, 13].includes(start) && end === 15) || 
                      ([12, 14].includes(start) && end === 16) ||
                      (start === 11 && end === 13) ||
                      (start === 12 && end === 14);

        draw3DCylinder(
          ctx,
          startLm.x * width,
          startLm.y * height,
          startLm.z || 0,
          endLm.x * width,
          endLm.y * height,
          endLm.z || 0,
          colors.connection,
          isArm ? 8.5 : 4.5 // Grosor del cilindro del brazo
        );
        ctx.restore();
      }
    }
  }

  ctx.globalAlpha = 1;

  // Dibujar puntos como esferas 3D
  for (const i of relevantIndices) {
    const lm = landmarks[i];
    if (!lm) continue;
    const vis = lm.visibility ?? 1;
    if (vis < 0.3) continue;

    const x = lm.x * width;
    const y = lm.y * height;
    const z = lm.z || 0;

    // Hombros y cadera más grandes
    const isJoint = [11, 12, 13, 14, 23, 24].includes(i);
    const radius = isJoint ? 7 : 5;

    ctx.save();
    ctx.globalAlpha = vis;
    draw3DSphere(ctx, x, y, z, radius, colors.landmark);
    ctx.restore();
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
