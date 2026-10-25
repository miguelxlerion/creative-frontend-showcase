import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/**
 * HUD superior-izquierdo de la zona Digital Twin.
 *
 * Solo se monta en la zona 4 (AnimatePresence gestiona la entrada/salida).
 * Contenido:
 *  - Título "ECO-SMART CITY TWIN"
 *  - Indicador "System Status" calculado desde los datos IoT en vivo
 *  - Contador FPS en tiempo real (rAF, sin re-renders por frame:
 *    solo setFps cuando cambia el valor entero, como mucho 1/s)
 */
export default function CityHUD() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const visible = activeZone === 4
  const accent = ZONES[4]?.accent ?? '#00ff88'
  const [fps, setFps] = useState(60)

  // Contador FPS: muestrea 1 vez por segundo vía rAF.
  useEffect(() => {
    if (!visible) return

    let frames = 0
    let last = performance.now()
    let raf = 0
    let lastFps = 60

    const tick = () => {
      frames++
      const now = performance.now()
      if (now - last >= 1000) {
        const value = Math.round((frames * 1000) / (now - last))
        // Solo re-renderiza si el entero cambió (evita repaints inútiles).
        if (value !== lastFps) {
          lastFps = value
          setFps(value)
        }
        frames = 0
        last = now
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [visible])

  // Estado del sistema derivado de los datos IoT (selector con reduce).
  // Umbrales calibrados contra el equilibrio de la simulación (~34 alert y
  // ~134 high-energy de 560): así la ciudad lee OPTIMAL la mayor parte del
  // tiempo y sólo asciende a ELEVATED/WARNING cuando un bache de ticks
  // acumula picos por encima de lo esperado.
  const systemStatus = useExperienceStore((s) => {
    let alerts = 0
    let high = 0
    for (const b of s.cityData) {
      if (b.status === 'alert') alerts++
      else if (b.status === 'high-energy') high++
    }
    if (alerts > 70) return 'CRITICAL' as const
    if (alerts > 52 || high > 190) return 'WARNING' as const
    if (alerts > 40 || high > 165) return 'ELEVATED' as const
    return 'OPTIMAL' as const
  })

  const statusClass =
    systemStatus === 'OPTIMAL'
      ? 'ok'
      : systemStatus === 'ELEVATED'
        ? 'warn'
        : 'crit'

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="city-hud"
          className="city-hud"
          style={{ ['--accent' as string]: accent } as React.CSSProperties}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          aria-hidden="true"
        >
          <div className="city-hud-title">ECO-SMART CITY TWIN</div>

          <div className="city-hud-row">
            <span className={`city-status city-status--${statusClass}`}>
              <span className="city-status-dot" aria-hidden="true" />
              SYSTEM STATUS: {systemStatus}
            </span>
          </div>

          <div className="city-hud-row city-hud-meta">
            <span className="city-fps">
              {fps < 50 ? '⚠ ' : '✓ '}
              {fps} FPS
            </span>
            <span className="city-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="city-nodes">560 NODES</span>
            <span className="city-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="city-tick">LIVE IoT</span>
          </div>

          <p className="city-hud-hint">CLICK A BUILDING TO INSPECT</p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
