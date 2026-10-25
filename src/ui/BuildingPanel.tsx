import { motion, AnimatePresence } from 'framer-motion'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { CityBuildingData } from '../store/useExperienceStore'

/**
 * Panel contextual del edificio seleccionado (lateral derecho).
 *
 * Aparece SOLO en la zona Digital Twin cuando hay `selectedBuilding`.
 * Animación con Framer Motion: entra deslizando desde la derecha
 * (`x: 100% → 0`) con spring y sale igual.
 *
 * Datos: se suscribe al edificio concreto (selector), así solo re-renderiza
 * cuando cambian SU energía/temperatura, no cada tick IoT global.
 */
export default function BuildingPanel() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const selected = useExperienceStore((s) => s.selectedBuilding) as CityBuildingData | null
  const setSelectedBuilding = useExperienceStore((s) => s.setSelectedBuilding)

  const zone = ZONES[activeZone]
  const visible = activeZone === 4 && selected != null
  const accent = zone?.accent ?? '#00ff88'

  return (
    <AnimatePresence>
      {visible && selected && (
        <motion.aside
          key="building-panel"
          className="building-panel"
          style={{ ['--accent' as string]: accent } as React.CSSProperties}
          role="tabpanel"
          aria-label={`Building Node ${String(selected.id + 1).padStart(3, '0')}`}
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 26, stiffness: 210, mass: 0.9 }}
        >
          {/* Cabecera */}
          <motion.div
            className="bp-head"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
          >
            <div>
              <div className="bp-kicker">BUILDING NODE</div>
              <h3 className="bp-id">
                #{String(selected.id + 1).padStart(3, '0')}
              </h3>
            </div>
            <button
              type="button"
              className="detail-close"
              aria-label="Cerrar panel"
              onClick={() => setSelectedBuilding(null)}
            >
              ×
            </button>
          </motion.div>

          <div className="hud-accent-line" style={{ background: accent }} />

          {/* Estado */}
          <motion.div
            className="bp-row"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.18 }}
          >
            <span className="bp-label">STATUS</span>
            <span className={`bp-status bp-status--${selected.status}`}>
              <span className="bp-status-dot" aria-hidden="true" />
              {selected.status.toUpperCase().replace('-', ' ')}
            </span>
          </motion.div>

          {/* Energía (barra animada) */}
          <motion.div
            className="bp-block"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.26 }}
          >
            <div className="bp-row">
              <span className="bp-label">ENERGY LEVEL</span>
              <span className="bp-value">{Math.round(selected.energy)}%</span>
            </div>
            <div className="bp-bar">
              <motion.div
                className="bp-bar-fill"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: selected.energy / 100 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                style={{ background: accent }}
              />
            </div>
          </motion.div>

          {/* Temperatura */}
          <motion.div
            className="bp-row"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.34 }}
          >
            <span className="bp-label">TEMPERATURE</span>
            <span className="bp-value">{selected.temperature.toFixed(1)}°C</span>
          </motion.div>

          {/* Mini-chart SVG (ligero, sin librerías) */}
          <motion.div
            className="bp-block"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.42 }}
          >
            <div className="bp-row">
              <span className="bp-label">ENERGY HISTORY</span>
              <span className="bp-value bp-value--dim">60 s</span>
            </div>
            <MiniChart values={selected.history} color={accent} />
          </motion.div>

          {/* Reset view */}
          <motion.button
            type="button"
            className="bp-reset"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => setSelectedBuilding(null)}
          >
            ⟲ RESET VIEW
          </motion.button>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

/**
 * Mini gráfico de líneas en SVG puro (24 puntos).
 * Sin librerías: `polyline` + viewBox escalable.
 */
function MiniChart({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return null

  const W = 240
  const H = 64
  const max = 100
  const stepX = W / (values.length - 1)

  const points = values
    .map((v, i) => `${(i * stepX).toFixed(1)},${(H - (v / max) * H).toFixed(1)}`)
    .join(' ')

  const areaPoints = `0,${H} ${points} ${W},${H}`

  return (
    <svg
      className="bp-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* Relleno de área (sutil) */}
      <polygon points={areaPoints} fill={color} opacity={0.12} />
      {/* Línea principal */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}