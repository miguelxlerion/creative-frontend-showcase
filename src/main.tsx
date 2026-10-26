import React from 'react'
import { createRoot } from 'react-dom/client'
import { MotionConfig } from 'framer-motion'
import App from './App'
import './styles.css'

const root = document.getElementById('root')

if (!root) {
  console.error('[main] Root element not found!')
} else {
  createRoot(root).render(
    <React.StrictMode>
      {/* Con movimiento reducido, Framer Motion desactiva las animaciones de
          transformación (desplazamientos, escalas y layouts); los fundidos de
          opacidad se mantienen porque no desplazan contenido. */}
      <MotionConfig reducedMotion="user">
        <App />
      </MotionConfig>
    </React.StrictMode>,
  )
}
