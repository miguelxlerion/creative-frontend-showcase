import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZONES } from '../config/zones'
import { portfolioContent } from '../data/portfolioContent'
import { useExperienceStore } from '../store/useExperienceStore'
import AIToolIcon from './AIToolIcon'

/**
 * Leyenda interactiva de la zona 02.
 *
 * Los cuatro botones son la versión DOM de los elementos 3D clicables del
 * pipeline (editor, nodos del cerebro y CI/CD). Todos escriben
 * `activeSubSection`, la misma fuente que usan el DetailPanel, la cámara y
 * el resumen sr-only, así que no hay un estado paralelo que sincronizar.
 *
 * Se queda visible mientras hay un panel abierto: el botón activo se marca
 * con `aria-pressed` y permite cerrar la ficha volviendo a pulsarlo.
 */

const AI_ZONE_INDEX = 2

/** Mismos colores que los nodos del cerebro y la salida CI/CD. */
const TOOL_COLORS: Record<string, string> = {
  copilot: '#b026ff',
  cursor: '#9d5cff',
  rag: '#d15bff',
  automation: '#00ff88',
}

export default function AIWorkflowLegend() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const phase = useExperienceStore((s) => s.phase)
  const isGuideModeActive = useExperienceStore((s) => s.isGuideModeActive)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)
  const setOpenDropdown = useExperienceStore((s) => s.setOpenDropdown)

  const zone = ZONES[AI_ZONE_INDEX]
  const isVisible =
    activeZone === AI_ZONE_INDEX && phase === 'experience' && !isGuideModeActive

  const toggleTool = (id: string) => {
    // El menú de pestañas (z-80) taparía el panel si quedara abierto.
    setOpenDropdown(-1)
    setActiveSubSection(activeSubSection === id ? null : id)
  }

  const accentStyle = {
    ['--accent' as string]: zone.accent,
    ['--accent-text' as string]: zone.accentText,
  } as CSSProperties

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.nav
          key="ai-legend"
          className="ai-legend"
          style={accentStyle}
          aria-label="AI workflow tools"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 14 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="ai-legend-title" aria-hidden="true">
            <span className="ai-legend-dot" />
            AI STACK
          </span>

          {portfolioContent.section03.subButtons.map((tool, index) => {
            const isActive = activeSubSection === tool.id
            return (
              <motion.button
                key={tool.id}
                type="button"
                className={`ai-legend-btn${isActive ? ' is-active' : ''}`}
                style={{ ['--tool' as string]: TOOL_COLORS[tool.id] ?? zone.accent } as CSSProperties}
                aria-pressed={isActive}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.04 * index, duration: 0.3 }}
                onClick={() => toggleTool(tool.id)}
              >
                <AIToolIcon name={tool.icon} size={15} />
                <span className="ai-legend-btn-label">{tool.label}</span>
              </motion.button>
            )
          })}
        </motion.nav>
      )}
    </AnimatePresence>
  )
}
