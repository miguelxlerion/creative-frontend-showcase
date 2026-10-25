import { motion, AnimatePresence } from 'framer-motion'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { portfolioContent } from '../data/portfolioContent'

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
  const hasSubButtons = zone?.subButtons.length ?? 0 > 0
  const isOpen = hasSubButtons && activeSubSection !== null

  if (!isOpen) return null

  // Buscar contenido en portfolioContent (section01, section02, etc.)
  const sectionKey = `section0${activeZone + 1}` as keyof typeof portfolioContent
  const sectionData = portfolioContent[sectionKey] as
    | { subButtons: readonly { id: string; title: string; description: string; metrics: string[] }[] }
    | { scrollTexts: readonly { title: string; text: string }[] }
    | { buildingDetail: { title: string; description: string; metrics: string[] } }
    | undefined
  const sectionContent = 'subButtons' in (sectionData ?? {})
    ? (sectionData as { subButtons: readonly { id: string; title: string; description: string; metrics: string[] }[] }).subButtons.find(
        (btn) => btn.id === activeSubSection
      )
    : null

  if (!sectionContent) return null

  const { title, description, metrics } = sectionContent
  const accent = zone.accent

  const handleClose = () => {
    setActiveSubSection(null)
  }

  return (
    <AnimatePresence mode="wait">
      <motion.aside
        key="detail-panel"
        className="detail-panel"
        style={{ ['--accent' as string]: accent } as React.CSSProperties}
        role="dialog"
        aria-modal="true"
        aria-label={title}
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
          <div>
            <div className="dp-kicker">DETAIL VIEW</div>
            <h3 className="dp-title">{title}</h3>
          </div>
          <button
            type="button"
            className="dp-close"
            aria-label="Cerrar panel"
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
                  color: accent,
                }}
              >
                {metric}
              </span>
            ))}
          </motion.div>
        )}
      </motion.aside>
    </AnimatePresence>
  )
}