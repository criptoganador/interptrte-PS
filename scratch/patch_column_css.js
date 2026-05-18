const fs = require('fs');
const path = require('path');

const cssPath = path.resolve('C:/Users/jhoan/Desktop/app de desarrollo/interprete PS/src/App.css');
let css = fs.readFileSync(cssPath, 'utf8');

// 1. Reemplazar la definición de .listener-panel para incluir .listener-column y fijar el ancho
css = css.replace(
  /\/\*\s*={12,}\s*Listener\s*Panel\s*\(Modo\s*Oyente\)\s*={12,}\s*\*\/[\s\r\n]*\.listener-panel\s*\{\s*margin-top:\s*10px;\s*display:\s*flex;\s*flex-direction:\s*column;\s*gap:\s*10px;\s*\}/g,
  `/* ============================================
   Listener Panel (Modo Oyente)
   ============================================ */
.listener-column {
  width: 350px;
  min-width: 350px;
  max-width: 350px;
  height: 100%;
  border-left: 1px solid var(--glass-border);
  border-right: 1px solid var(--glass-border);
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.listener-panel {
  display: flex;
  flex-direction: column;
  gap: 15px;
  height: 100%;
  padding: var(--space-lg);
  box-sizing: border-box;
}`
);

// 2. Reemplazar la definición de .listener-screen para que use flex: 1
css = css.replace(
  /\.listener-screen\s*\{\s*min-height:\s*150px;\s*max-height:\s*250px;\s*background:\s*rgba\(0,\s*0,\s*0,\s*0\.4\);\s*border:\s*1px\s*solid\s*rgba\(255,\s*255,\s*255,\s*0\.1\);\s*border-radius:\s*8px;\s*padding:\s*12px;\s*overflow-y:\s*auto;\s*position:\s*relative;\s*font-size:\s*1\.1rem;\s*line-height:\s*1\.5;\s*display:\s*flex;\s*flex-direction:\s*column;\s*\}/g,
  `.listener-screen {
  flex: 1;
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 15px;
  overflow-y: auto;
  position: relative;
  font-size: 1.1rem;
  line-height: 1.5;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}`
);

fs.writeFileSync(cssPath, css, 'utf8');
console.log('App.css column patch applied successfully.');
