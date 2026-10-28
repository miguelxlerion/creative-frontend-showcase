import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZONES } from '../config/zones'
import { portfolioContent } from '../data/portfolioContent'
import { useExperienceStore } from '../store/useExperienceStore'

/**
 * Brief textual de la zona 02.
 *
 * La escena 3D muestra el flujo, pero sus etiquetas compiten con la cámara y
 * con el resto del HUD. Este overlay deja la secuencia escrita en una sola
 * línea —INPUT · CODE → AI PROCESSING · COPILOT/CURSOR/RAG → OUTPUT · CI/CD—
 * y añade el dato de velocidad que pide el checklist del reclutador.
 *
 * No es decorativo (`aria-hidden`): es contenido de la sección, así que se
 * mantiene legible y el resumen sr-only lo anuncia con las mismas cadenas.
 */

const AI_ZONE_INDEX = 2
const brief = portfolioContent.section03.pipelineBrief

export default function AIWorkflowBrief() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const phase = useExperienceStore((s) => s.phase)
  const isGuideModeActive = useExperienceStore((s) => s.isGuideModeActive)

  const isVisible =
    activeZone === AI_ZONE_INDEX && phase === 'experience' && !isGuideModeActive
  const zone = ZONES[AI_ZONE_INDEX]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          key="ai-brief"
          className="ai-brief"
          style={
            {
              ['--accent' as string]: zone.accent,
              ['--accent-text' as string]: zone.accentText,
            } as CSSProperties
          }
          aria-label="AI workflow pipeline"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: 'spring', stiffness: 140, damping: 22 }}
        >
          <div className="ai-brief-head">
            <span className="ai-brief-kicker">
              <span className="ai-brief-dot" aria-hidden="true" />
              {brief.kicker}
            </span>
            <span className="ai-brief-tools">{brief.tools}</span>
          </div>

          <ol className="ai-brief-flow">
            {brief.stages.map((stage, index) => (
              <li className="ai-brief-step" key={stage.id}>
                <span className="ai-brief-stage">
                  <span className="ai-brief-stage-label">{stage.label}</span>
                  <span className="ai-brief-stage-detail">{stage.detail}</span>
                </span>
                {index < brief.stages.length - 1 && (
                  <span className="ai-brief-arrow" aria-hidden="true">
                    →
                  </span>
                )}
              </li>
            ))}
          </ol>

          <p className="ai-brief-note">{brief.note}</p>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
