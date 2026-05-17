import React, { useRef, useEffect, useState } from "react";
import { drawHandLandmarks, drawFaceMesh, drawPoseLandmarks, clearCanvas } from "../utils/drawingUtils";

/**
 * Componente que reproduce una secuencia de landmarks grabados (Avatar de Alambre).
 * @param {Array} sequence - Array de frames con landmarks.
 * @param {number} width - Ancho del canvas.
 * @param {number} height - Alto del canvas.
 */
export function AvatarReplay({ sequence, width = 300, height = 225 }) {
  const canvasRef = useRef(null);
  const timerRef = useRef(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sequence || sequence.length === 0) return;

    const ctx = canvas.getContext("2d");
    let frameIdx = 0;

    const play = () => {
      clearCanvas(ctx, canvas.width, canvas.height);

      const frame = sequence[frameIdx];
      if (frame) {
        // 1. Dibujar pose corporal (torso y brazos)
        if (frame.pose && frame.pose.length > 0) {
          drawPoseLandmarks(ctx, frame.pose, canvas.width, canvas.height);
        }
        
        // 2. Dibujar malla facial
        if (frame.face && frame.face.length > 0) {
          drawFaceMesh(ctx, frame.face, canvas.width, canvas.height);
        }

        // 3. Dibujar manos
        if (frame.hands && frame.hands.length > 0) {
          for (let i = 0; i < frame.hands.length; i++) {
            const handedness = frame.handednesses?.[i] || "Right";
            drawHandLandmarks(ctx, frame.hands[i], handedness, canvas.width, canvas.height);
          }
        }
      }

      setCurrentFrame(frameIdx);
      frameIdx = (frameIdx + 1) % sequence.length; // Volver al inicio al terminar

      // Reproducir a ~30 FPS
      timerRef.current = setTimeout(play, 1000 / 30);
    };

    play();

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [sequence]);

  return (
    <div className="avatar-replay" style={{ 
      position: 'relative', 
      width: width, 
      height: height,
      background: '#111',
      borderRadius: '8px',
      overflow: 'hidden',
      border: '1px solid rgba(255,255,255,0.1)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)'
    }}>
      <canvas 
        ref={canvasRef} 
        width={width} 
        height={height}
        style={{ width: '100%', height: '100%' }}
      />
      <div style={{ 
        position: 'absolute', 
        bottom: '5px', 
        left: '5px', 
        fontSize: '0.75rem', 
        color: 'rgba(255,255,255,0.5)',
        background: 'rgba(0,0,0,0.6)',
        padding: '2px 6px',
        borderRadius: '3px'
      }}>
        🤖 Avatar ({currentFrame + 1}/{sequence?.length || 0})
      </div>
    </div>
  );
}
