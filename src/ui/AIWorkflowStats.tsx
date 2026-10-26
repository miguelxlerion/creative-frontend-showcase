import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ZONES } from '../config/zones'
import { portfolioContent } from '../data/portfolioContent'
import { useExperienceStore } from '../store/useExperienceStore'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Panel de métricas de la zona 02.
 *
 * Las cifras viven en `portfolioContent.section03.stats`; aquí sólo se
 * anima el conteo. Es decorativo (`aria-hidden`): el mismo contenido no
 * aporta nada al lector de pantalla y un aria-live con números cambiando
 * sería ruido. Al entrar en la zona el conteo arranca de cero; con
 * movimiento reducido se pinta el valor final de golpe.
 */

const AI_ZONE_INDEX = 2
const COUNT_MS = 1300

type StatDef = (typeof portfolioContent.section03.stats)[number]

function formatStat(value: number, format: StatDef['format']): string {
  if (format === 'k') return `${(value / 1000).toFixed(1)}k`
  if (format === 'decimal') return value.toFixed(1)
  return String(Math.round(value))
}

export default function AIWorkflowStats() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const phase = useExperienceStore((s) => s.phase)
  const guided = useExperienceStore((s) => s.guided)
  const reducedMotion = useReducedMotion()

  const isVisible =
    activeZone === AI_ZONE_INDEX && phase === 'experience' && !guided

  // 0..1: multiplica la cifra final, así el formato (147, 2.3k, 3.2) se
  // recalcula sobre el valor parcial sin duplicar lógica por stat.
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    if (!isVisible) {
      setProgress(0)
      return
    }

    if (reducedMotion) {
      setProgress(1)
      return
    }

    setProgress(0)
    let raf = 0
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / COUNT_MS)
      // easeOutCubic: arranca rápido y frena en la cifra final.
      setProgress(1 - Math.pow(1 - t, 3))
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [isVisible, reducedMotion])

  const zone = ZONES[AI_ZONE_INDEX]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.aside
          key="ai-stats"
          className="ai-stats"
          style={
            {
              ['--accent' as string]: zone.accent,
              ['--accent-text' as string]: zone.accentText,
            } as CSSProperties
          }
          aria-hidden="true"
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 18 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="ai-stats-kicker">
            <span className="ai-stats-live" />
            TODAY · AI METRICS
          </div>

          <div className="ai-stats-list">
            {portfolioContent.section03.stats.map((stat) => (
              <div className="ai-stats-row" key={stat.id}>
                <span className="ai-stats-label">{stat.label}</span>
                <span className="ai-stats-value">
                  {formatStat(stat.value * progress, stat.format)}
                  {'unit' in stat && stat.unit ? (
                    <span className="ai-stats-unit"> {stat.unit}</span>
                  ) : null}
                </span>
              </div>
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
