import React, { useState, useEffect } from "react";

export function SplashScreen({ onComplete }) {
  const [progress, setProgress] = useState(0);
  const [bootLogs, setBootLogs] = useState([]);
  const [fadeClass, setFadeClass] = useState("");

  const logsList = [
    { time: 300, text: "🚀 Iniciando Asicme Studio..." },
    { time: 800, text: "👁️ Conectando MediaPipe Vision WASM Engine..." },
    { time: 1400, text: "🧠 Inicializando Tensores y Redes Neuronales TensorFlow.js..." },
    { time: 2000, text: "🖐️ Calibrando HandLandmarker (60 FPS Tracking)..." },
    { time: 2600, text: "🎭 Iniciando malla de 478 puntos FaceLandmarker..." },
    { time: 3100, text: "🤸 Sincronizando PoseLandmarker con el Avatar 3D..." },
    { time: 3600, text: "🤟 Enlazando diccionario de IndexedDB local..." },
    { time: 4100, text: "✨ Sistema Listo. ¡Entrada autorizada!" }
  ];

  useEffect(() => {
    // 1. Simulación fluida de barra de progreso (4.5 segundos en total)
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + 1;
      });
    }, 45);

    // 2. Desencadenar los logs de la terminal cibernética uno por uno
    const logTimers = logsList.map((log) => {
      return setTimeout(() => {
        setBootLogs((prev) => [...prev, log.text]);
      }, log.time);
    });

    // 3. Iniciar el desvanecimiento (fade-out) suave al terminar (4.5s)
    const fadeTimer = setTimeout(() => {
      setFadeClass("fade-out-splash");
    }, 4500);

    // 4. Completar y ocultar el splash screen (5.0s)
    const completeTimer = setTimeout(() => {
      if (onComplete) onComplete();
    }, 5000);

    return () => {
      clearInterval(interval);
      logTimers.forEach(clearTimeout);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`splash-screen-container ${fadeClass}`} style={styles.container}>
      {/* Elementos ambientales de luz en el fondo (Cyber Glow) */}
      <div style={styles.glowCyan}></div>
      <div style={styles.glowPurple}></div>

      {/* Tarjeta central Glassmorphic */}
      <div style={styles.glassCard}>
        {/* LOGO DE ASICME STUDIO */}
        <div style={styles.logoContainer}>
          <img 
            src="/logoAsicme.png" 
            alt="Logo Asicme Studio" 
            style={styles.logo} 
            onError={(e) => {
              // Fallback elegante en caso de problemas con la imagen
              e.target.style.display = 'none';
            }}
          />
          {/* Aura de pulso brillante detrás del logo */}
          <div className="logo-pulse-aura" style={styles.pulseAura}></div>
        </div>

        {/* TÍTULO Y SUBTÍTULO */}
        <h1 style={styles.companyTitle}>ASICME STUDIO</h1>
        <h2 style={styles.appSubtitle}>INTÉRPRETE DIGITAL DE LENGUAJE DE SEÑAS</h2>

        {/* BARRA DE PROGRESO DE INICIO */}
        <div style={styles.progressContainer}>
          <div style={styles.progressBarBackground}>
            <div 
              style={{
                ...styles.progressBarFill,
                width: `${progress}%`
              }}
            ></div>
          </div>
          <div style={styles.progressLabel}>
            <span>CARGANDO SISTEMA HOLOGRÁFICO</span>
            <span>{progress}%</span>
          </div>
        </div>

        {/* TERMINAL DE LOGS CIBERNÉTICOS */}
        <div style={styles.terminal}>
          <div style={styles.terminalHeader}>
            <span style={styles.terminalDotRed}></span>
            <span style={styles.terminalDotYellow}></span>
            <span style={styles.terminalDotGreen}></span>
            <span style={styles.terminalTitle}>ASICME OS v2.0.4 - BOOT SEQUENCE</span>
          </div>
          <div style={styles.terminalBody} className="custom-scrollbar">
            {bootLogs.map((log, idx) => (
              <div key={idx} style={styles.terminalLine}>
                <span style={styles.terminalPrompt}>&gt;</span> {log}
              </div>
            ))}
          </div>
        </div>

        {/* FOOTER DE LA EMPRESA */}
        <div style={styles.footer}>
          © 2026 ASICME STUDIO. ALL RIGHTS RESERVED.
        </div>
      </div>

      {/* Agregar animación de pulso y fade-out mediante estilos inyectados */}
      <style>{`
        @keyframes splashPulse {
          0% { transform: scale(1); opacity: 0.25; filter: blur(15px); }
          50% { transform: scale(1.1); opacity: 0.55; filter: blur(25px); }
          100% { transform: scale(1); opacity: 0.25; filter: blur(15px); }
        }
        .logo-pulse-aura {
          animation: splashPulse 2.5s infinite ease-in-out;
        }
        .fade-out-splash {
          opacity: 0 !important;
          transform: scale(1.05) !important;
          pointer-events: none !important;
        }
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 209, 0.2);
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}

const styles = {
  container: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    background: "#07070a",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 99999,
    overflow: "hidden",
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
    opacity: 1,
    transform: "scale(1)"
  },
  glowCyan: {
    position: "absolute",
    top: "20%",
    left: "15%",
    width: "350px",
    height: "350px",
    borderRadius: "50%",
    background: "rgba(0, 255, 209, 0.08)",
    filter: "blur(90px)",
    pointerEvents: "none"
  },
  glowPurple: {
    position: "absolute",
    bottom: "20%",
    right: "15%",
    width: "350px",
    height: "350px",
    borderRadius: "50%",
    background: "rgba(124, 58, 237, 0.08)",
    filter: "blur(90px)",
    pointerEvents: "none"
  },
  glassCard: {
    width: "480px",
    padding: "35px",
    background: "rgba(255, 255, 255, 0.02)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "20px",
    boxShadow: "0 20px 80px rgba(0, 0, 0, 0.7)",
    backdropFilter: "blur(15px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    position: "relative",
    zIndex: 2
  },
  logoContainer: {
    position: "relative",
    width: "120px",
    height: "120px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px"
  },
  logo: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    position: "relative",
    zIndex: 3,
    filter: "drop-shadow(0 0 15px rgba(0, 255, 209, 0.35))"
  },
  pulseAura: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: "rgba(0, 255, 209, 0.3)",
    zIndex: 1
  },
  companyTitle: {
    fontSize: "1.7rem",
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: "0.22em",
    margin: "0 0 8px 0",
    textAlign: "center",
    textShadow: "0 2px 10px rgba(255, 255, 255, 0.1)"
  },
  appSubtitle: {
    fontSize: "0.72rem",
    fontWeight: "700",
    color: "var(--color-primary, #00FFD1)",
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    margin: "0 0 28px 0",
    textAlign: "center",
    textShadow: "0 0 8px rgba(0, 255, 209, 0.25)"
  },
  progressContainer: {
    width: "100%",
    marginBottom: "24px"
  },
  progressBarBackground: {
    width: "100%",
    height: "6px",
    background: "rgba(255, 255, 255, 0.05)",
    borderRadius: "3px",
    overflow: "hidden",
    marginBottom: "8px"
  },
  progressBarFill: {
    height: "100%",
    background: "linear-gradient(90deg, #7C3AED, #00FFD1)",
    borderRadius: "3px",
    boxShadow: "0 0 12px rgba(0, 255, 209, 0.6)",
    transition: "width 0.1s linear"
  },
  progressLabel: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: "0.68rem",
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.4)",
    letterSpacing: "0.06em"
  },
  terminal: {
    width: "100%",
    background: "#050508",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "10px",
    padding: "12px",
    fontFamily: "'JetBrains Mono', 'Courier New', monospace",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box"
  },
  terminalHeader: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    borderBottom: "1px solid rgba(255,255,255,0.05)",
    paddingBottom: "8px",
    marginBottom: "8px"
  },
  terminalDotRed: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#ef4444"
  },
  terminalDotYellow: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#f59e0b"
  },
  terminalDotGreen: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#10b981"
  },
  terminalTitle: {
    fontSize: "0.6rem",
    color: "rgba(255,255,255,0.3)",
    marginLeft: "5px",
    letterSpacing: "0.05em"
  },
  terminalBody: {
    height: "90px",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "4px"
  },
  terminalLine: {
    fontSize: "0.64rem",
    color: "rgba(0, 255, 209, 0.85)",
    lineHeight: "1.4",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  terminalPrompt: {
    color: "#7C3AED",
    fontWeight: "bold"
  },
  footer: {
    fontSize: "0.58rem",
    color: "rgba(255, 255, 255, 0.2)",
    letterSpacing: "0.08em",
    marginTop: "25px",
    textAlign: "center"
  }
};
