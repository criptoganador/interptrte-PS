import React, { useEffect, useRef, useState } from "react";
import { useSpeechToText } from "../hooks/useSpeechToText";
import { AvatarReplay } from "./AvatarReplay";

export function ListenerPanel({ dataset, preferredMicDeviceId }) {
  const { 
    isListening, 
    messages,
    finalTranscript, 
    interimTranscript, 
    startListening, 
    stopListening,
    clearTranscript 
  } = useSpeechToText(preferredMicDeviceId);

  const [activeSequence, setActiveSequence] = useState(null);
  const [activeWord, setActiveWord] = useState("");

  // Ref para auto-scroll hacia abajo cuando haya mucho texto
  const textContainerRef = useRef(null);

  useEffect(() => {
    if (textContainerRef.current) {
      textContainerRef.current.scrollTop = textContainerRef.current.scrollHeight;
    }
  }, [messages, finalTranscript, interimTranscript]);

  // Escuchar el texto hablado y buscar coincidencias en el dataset local
  useEffect(() => {
    if (!dataset || dataset.length === 0) {
      console.log("🎤 ListenerPanel: Dataset vacío o no cargado aún.");
      return;
    }

    // Combinar texto activo en mayúsculas
    const fullText = (finalTranscript + " " + interimTranscript).trim().toUpperCase();
    const cleanText = fullText.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");
    const words = cleanText.split(/\s+/).filter(w => w.length > 0);

    console.log("🎤 ListenerPanel: Texto de voz detectado:", { fullText, words });
    console.log("💾 Dataset de señas disponibles para emparejar:", dataset.map(s => s.label.toUpperCase()));

    let foundMatch = false;

    // 1. Buscar en el texto en tiempo real (de atrás hacia adelante)
    for (let i = words.length - 1; i >= 0; i--) {
      const word = words[i];
      const sample = dataset.find(s => s.label.toUpperCase() === word);
      if (sample && sample.sequence && sample.sequence.length > 0) {
        console.log(`🎉 ¡Coincidencia en tiempo real encontrada para seña: "${sample.label}"!`);
        setActiveSequence(sample.sequence);
        setActiveWord(sample.label);
        foundMatch = true;
        break;
      }
    }

    // 2. Si no hay coincidencia en el texto actual, buscar en la última burbuja sellada
    if (!foundMatch && messages.length > 0) {
      const lastMsg = messages[messages.length - 1].text.toUpperCase();
      const lastClean = lastMsg.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, "");
      const lastWords = lastClean.split(/\s+/).filter(w => w.length > 0);

      console.log("🎤 ListenerPanel: Buscando coincidencia en última burbuja sellada:", lastWords);

      for (let i = lastWords.length - 1; i >= 0; i--) {
        const word = lastWords[i];
        const sample = dataset.find(s => s.label.toUpperCase() === word);
        if (sample && sample.sequence && sample.sequence.length > 0) {
          console.log(`🎉 ¡Coincidencia en burbuja sellada encontrada para seña: "${sample.label}"!`);
          setActiveSequence(sample.sequence);
          setActiveWord(sample.label);
          foundMatch = true;
          break;
        }
      }
    }
  }, [finalTranscript, interimTranscript, messages, dataset]);

  const hasContent = messages.length > 0 || finalTranscript || interimTranscript;

  const handleClear = () => {
    clearTranscript();
    setActiveSequence(null);
    setActiveWord("");
  };

  return (
    <section className="diag-section listener-panel">
      <h3 className="section-title">Modo Oyente (Subtítulos)</h3>
      
      <div className="listener-controls">
        <button 
          className={`action-button ${isListening ? 'stop-listening' : 'start-listening'}`}
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? "🛑 Detener Micrófono" : "🎤 Activar Micrófono"}
        </button>
        <button 
          className="action-button clear-text"
          onClick={handleClear}
          disabled={!hasContent}
        >
          🗑️ Borrar Todo
        </button>
      </div>

      {/* REPRODUCTOR DE AVATAR (Traductor de Texto a Señas - Movido arriba para evitar cortes de pantalla) */}
      {activeSequence ? (
        <div className="avatar-translation-container" style={{ 
          border: '1px solid rgba(0, 255, 209, 0.25)',
          background: 'rgba(0, 255, 209, 0.02)',
          borderRadius: '8px',
          padding: '10px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '5px',
          width: '100%',
          flexShrink: 0
        }}>
          <div style={{ fontSize: '0.85rem', color: 'var(--color-primary)', fontWeight: 'bold' }}>
            🤟 Traductor a Señas: "{activeWord}"
          </div>
          <AvatarReplay sequence={activeSequence} width={310} height={200} />
        </div>
      ) : (
        <div className="avatar-translation-container idle" style={{ 
          border: '1px solid rgba(255, 255, 255, 0.05)',
          background: 'rgba(255, 255, 255, 0.01)',
          borderRadius: '8px',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          width: '100%',
          height: '240px',
          flexShrink: 0,
          textAlign: 'center',
          color: 'var(--text-tertiary)'
        }}>
          <div style={{ fontSize: '28px', opacity: 0.5 }}>🤖</div>
          <div style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--text-secondary)' }}>
            Avatar de Lengua de Señas
          </div>
          <p style={{ fontSize: '0.72rem', maxWidth: '220px', lineHeight: '1.4', margin: 0 }}>
            Habla al micrófono. Si dices una palabra del dataset, el avatar la deletreará en señas aquí en vivo.
          </p>
        </div>
      )}

      <div className="listener-screen" ref={textContainerRef}>
        {!hasContent && !isListening && (
          <p className="placeholder-text">
            El texto aparecerá aquí cuando el profesor hable.
          </p>
        )}
        
        {isListening && !hasContent && (
          <p className="placeholder-text listening-pulse">
            Escuchando...
          </p>
        )}

        <div className="chat-history">
          {messages.map((msg) => (
            <div key={msg.id} className="chat-bubble completed-bubble">
              {msg.text}
            </div>
          ))}
          
          {(finalTranscript || interimTranscript) && (
            <div className="chat-bubble active-bubble">
              <span className="final-text">{finalTranscript}</span>
              <span className="interim-text">{interimTranscript}</span>
              <span className="typing-indicator">...</span>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
