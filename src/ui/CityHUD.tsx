import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShallow } from 'zustand/react/shallow'
import { useExperienceStore } from '../store/useExperienceStore'
import type { CityEnergyFilter } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'

/** Niveles de consumo disponibles en el filtro (ALL = sin filtro). */
const ENERGY_FILTERS: ReadonlyArray<{
  id: CityEnergyFilter
  label: string
  color: string
}> = [
  { id: 'all', label: 'ALL', color: '#eef6ff' },
  { id: 'normal', label: 'NORMAL', color: '#00ff88' },
  { id: 'high-energy', label: 'HIGH', color: '#00f0ff' },
  { id: 'alert', label: 'ALERT', color: '#ff0055' },
]

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
  const accentText = ZONES[4]?.accentText ?? '#66ffb3'
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

  // Estado del sistema y contadores del filtro derivados del MISMO recorrido
  // de los datos IoT. `useShallow` evita re-renders cuando los tres números
  // no cambian; aun así el HUD sólo se repinta como mucho cada 2 s.
  const counts = useExperienceStore(
    useShallow((s) => {
      let normal = 0
      let high = 0
      let alert = 0
      for (const b of s.cityData) {
        if (b.status === 'normal') normal++
        else if (b.status === 'high-energy') high++
        else alert++
      }
      return { normal, high, alert }
    }),
  )

  const energyFilter = useExperienceStore((s) => s.energyFilter)
  const setEnergyFilter = useExperienceStore((s) => s.setEnergyFilter)

  // Umbrales calibrados contra el equilibrio de la simulación (~34 alert y
  // ~134 high-energy de 560): así la ciudad lee OPTIMAL la mayor parte del
  // tiempo y sólo asciende a ELEVATED/WARNING cuando un bache de ticks
  // acumula picos por encima de lo esperado.
  const systemStatus =
    counts.alert > 70
      ? ('CRITICAL' as const)
      : counts.alert > 52 || counts.high > 190
        ? ('WARNING' as const)
        : counts.alert > 40 || counts.high > 165
          ? ('ELEVATED' as const)
          : ('OPTIMAL' as const)

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
          style={
            {
              ['--accent' as string]: accent,
              ['--accent-text' as string]: accentText,
            } as React.CSSProperties
          }
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          role="region"
          aria-label="Digital Twin telemetry and energy filter"
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
            <span className="city-nodes">
              {counts.normal + counts.high + counts.alert} NODES
            </span>
            <span className="city-meta-sep" aria-hidden="true">
              ·
            </span>
            <span className="city-tick">LIVE IoT</span>
          </div>

          <div className="city-filter" role="group" aria-label="Filter buildings by energy consumption">
            <span className="city-filter-label">ENERGY CONSUMPTION</span>
            <div className="city-filter-chips">
              {ENERGY_FILTERS.map((option) => {
                const active = energyFilter === option.id
                const count =
                  option.id === 'all'
                    ? counts.normal + counts.high + counts.alert
                    : option.id === 'normal'
                      ? counts.normal
                      : option.id === 'high-energy'
                        ? counts.high
                        : counts.alert
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`city-chip${active ? ' is-active' : ''}`}
                    data-city-filter={option.id}
                    aria-pressed={active}
                    aria-label={`${option.label} — ${count} buildings`}
                    style={
                      { ['--chip-color' as string]: option.color } as React.CSSProperties
                    }
                    onClick={() =>
                      // Volver a pulsar el nivel activo lo desactiva (vuelve a
                      // ALL). En ALL el clic es idempotente.
                      setEnergyFilter(active && option.id !== 'all' ? 'all' : option.id)
                    }
                  >
                    <span className="city-chip-dot" aria-hidden="true" />
                    <span className="city-chip-label">{option.label}</span>
                    <span className="city-chip-count" aria-hidden="true">
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          <p className="city-hud-hint">
            {energyFilter === 'all'
              ? 'CLICK A BUILDING TO INSPECT'
              : 'FILTER ACTIVE · CLICK A LIT BUILDING'}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
