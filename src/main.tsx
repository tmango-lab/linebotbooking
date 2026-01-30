import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import ErrorBoundary from './components/ErrorBoundary.tsx'

// [DEBUG] On-Screen Console for Mobile
const debugDiv = document.createElement('div');
debugDiv.style.position = 'fixed';
debugDiv.style.top = '0';
debugDiv.style.left = '0';
debugDiv.style.width = '100%';
debugDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
debugDiv.style.color = '#0f0';
debugDiv.style.fontSize = '12px';
debugDiv.style.zIndex = '9999';
debugDiv.style.maxHeight = '150px';
debugDiv.style.overflow = 'auto';
debugDiv.style.pointerEvents = 'none'; // Click through
document.body.appendChild(debugDiv);

const log = (msg: string) => {
  debugDiv.innerHTML += `<div>${msg}</div>`;
  console.log(msg);
}

window.onerror = (msg, source, lineno, colno, error) => {
  log(`❌ Global Error: ${msg} (${source}:${lineno})`);
};

window.onunhandledrejection = (event) => {
  log(`❌ Unhandled Rejection: ${event.reason}`);
};

log("🚀 App Starting...");
log(`User Agent: ${navigator.userAgent}`);

try {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  )
  log("✅ Render Called");
} catch (e: any) {
  log(`❌ Render Failed: ${e.message}`);
}
