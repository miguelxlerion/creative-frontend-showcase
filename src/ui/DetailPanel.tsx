import { motion, AnimatePresence } from 'framer-motion'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { getSubSectionContent } from '../data/portfolioContent'
import AIToolIcon from './AIToolIcon'

/**
 * Panel de detalle inteligente que se alimenta del store:
 * - Lee `activeZone` y `activeSubSection`
 * - Busca el contenido en `portfolioContent.ts`
 * - Se muestra solo cuando hay `activeSubSection` en zonas 0-3
 * - Se cierra al hacer clic en X o al cambiar de zona
 */

export default function DetailPanel() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)

  // Solo se muestra en zonas 0-3 cuando hay sub-botón activo
  const zone = ZONES[activeZone]
  const hasSubButtons = (zone?.subButtons.length ?? 0) > 0
  const isOpen = hasSubButtons && activeSubSection !== null

  if (!isOpen) return null

  // Contenido compartido con el resumen sr-only (misma fuente ⇒ misma lectura).
  const sectionContent = getSubSectionContent(activeZone, activeSubSection)

  if (!sectionContent) return null

  const { title, description, metrics, icon, usage, flow, beforeAfter } = sectionContent
  const accent = zone.accent
  const accentText = zone.accentText
  // La zona AI es la única con contenido enriquecido: el icono activa el
  // tratamiento de título en acento y los bloques extra del panel.
  const isRich = Boolean(icon)

  const handleClose = () => {
    const zoneId = zone.id
    setActiveSubSection(null)
    // El botón de cierre se desmonta con el panel: sin mover el foco, un
    // usuario de teclado caería en <body>. La pestaña de la zona sigue en el DOM.
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(`[data-zone-btn="${zoneId}"]`)
        ?.focus()
    })
  }

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key="detail-panel"
        id="detail-panel"
        className="detail-panel"
        style={
          {
            ['--accent' as string]: accent,
            ['--accent-text' as string]: accentText,
          } as React.CSSProperties
        }
        role="dialog"
        aria-labelledby="detail-panel-title"
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: 'spring', damping: 26, stiffness: 210, mass: 0.9 }}
      >
        {/* Cabecera */}
        <motion.div
          className="dp-head"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08 }}
        >
          <div className="dp-head-main">
            <div className="dp-kicker">
              {isRich ? 'AI TOOL · DETAIL VIEW' : 'DETAIL VIEW'}
            </div>
            <div className="dp-title-row">
              {icon && (
                <span className="dp-icon" aria-hidden="true">
                  <AIToolIcon name={icon} size={21} />
                </span>
              )}
              <h3
                className={`dp-title${isRich ? ' is-accent' : ''}`}
                id="detail-panel-title"
              >
                {title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            className="dp-close"
            aria-label="Close detail panel"
            onClick={handleClose}
          >
            ×
          </button>
        </motion.div>

        <div className="dp-divider" style={{ background: accent }} />

        {/* Descripción */}
        <motion.div
          className="dp-description"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.16, duration: 0.4 }}
        >
          <p>{description}</p>
        </motion.div>

        {/* Métricas de uso (sólo zona AI): dos cifras grandes por herramienta. */}
        {usage && usage.length > 0 && (
          <motion.div
            className="dp-usage"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            {usage.map((item) => (
              <div className="dp-usage-item" key={item.label}>
                <span className="dp-usage-label">{item.label}</span>
                <span className="dp-usage-value">{item.value}</span>
              </div>
            ))}
          </motion.div>
        )}

        {/* Métricas */}
        {metrics.length > 0 && (
          <motion.div
            className="dp-metrics"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.24, duration: 0.4 }}
          >
            {metrics.map((metric) => (
              <span
                key={metric}
                className="dp-metric"
                style={{
                  borderColor: accent,
                  color: accentText,
                }}
              >
                {metric}
              </span>
            ))}
          </motion.div>
        )}

        {/* Pipeline RAG: PDF → Chunking → Vector DB → LLM → Response */}
        {flow && flow.length > 0 && (
          <motion.div
            className="dp-flow"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32, duration: 0.4 }}
          >
            <span className="dp-block-label">RETRIEVAL PIPELINE</span>
            <ol className="dp-flow-track">
              {flow.map((step, index) => (
                <li className="dp-flow-step" key={step}>
                  <span className="dp-flow-index" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span>{step}</span>
                  {index < flow.length - 1 && (
                    <span className="dp-flow-arrow" aria-hidden="true">
                      →
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </motion.div>
        )}

        {/* Antes / después (sólo Automation) */}
        {beforeAfter && (
          <motion.div
            className="dp-ba"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.36, duration: 0.4 }}
          >
            <span className="dp-block-label">{beforeAfter.label}</span>
            <div className="dp-ba-row">
              <div className="dp-ba-card is-before">
                <span className="dp-ba-tag">MANUAL</span>
                <strong className="dp-ba-value">{beforeAfter.before}</strong>
              </div>
              <span className="dp-ba-arrow" aria-hidden="true">
                →
              </span>
              <div className="dp-ba-card is-after">
                <span className="dp-ba-tag">AUTOMATED</span>
                <strong className="dp-ba-value">{beforeAfter.after}</strong>
              </div>
            </div>
          </motion.div>
        )}
      </motion.aside>
    </AnimatePresence>
  )
}