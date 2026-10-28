import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZONES } from '../config/zones'
import { portfolioContent } from '../data/portfolioContent'
import { useExperienceStore } from '../store/useExperienceStore'

/**
 * Badge global de estándares técnicos (checklist del reclutador).
 *
 * Vive fuera del canvas para poder anunciarse y pausarse con el teclado. El
 * estado abierto/cerrado vive en Zustand: así sobrevive a los cambios de zona
 * y a los vuelos de cámara, que desmontan otras capas del HUD.
 *
 * En escritorio arranca abierto (los tres estándares visibles sin interacción)
 * y en móvil plegado, para no tapar el pipeline AI; el botón lo alterna. Las
 * clases `zone-*` permiten esquivar
 * los HUD que ya ocupan la esquina superior derecha (métricas AI y stats de la
 * Digital Twin) sin duplicar posiciones en JavaScript.
 */

const tech = portfolioContent.recruiter.techBadge

export default function TechBadge() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const open = useExperienceStore((s) => s.techBadgeOpen)
  const setOpen = useExperienceStore((s) => s.setTechBadgeOpen)

  const zone = ZONES[activeZone]

  return (
    <motion.aside
      className={`tech-badge zone-${activeZone}${open ? ' is-open' : ''}`}
      style={
        {
          ['--accent' as string]: zone?.accent ?? '#00f0ff',
          ['--accent-text' as string]: zone?.accentText ?? '#00ffff',
        } as CSSProperties
      }
      aria-label="Technical standards"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 160, damping: 22 }}
    >
      <button
        type="button"
        className="tech-badge-toggle"
        aria-expanded={open}
        aria-controls="tech-badge-list"
        onClick={() => setOpen(!open)}
      >
        <span className="tech-badge-spark" aria-hidden="true">
          ⚡
        </span>
        <span className="tech-badge-title">{tech.label}</span>
        <span
          className={`tech-badge-chevron${open ? ' is-open' : ''}`}
          aria-hidden="true"
        >
          ⌄
        </span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.ul
            id="tech-badge-list"
            className="tech-badge-list"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 220, damping: 26 }}
          >
            {tech.items.map((item) => (
              <li className="tech-badge-item" key={item.label}>
                <span className="tech-badge-icon" aria-hidden="true">
                  {item.icon}
                </span>
                {item.label}
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </motion.aside>
  )
}
