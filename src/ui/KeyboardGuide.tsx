import { useCallback, useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { portfolioContent } from '../data/portfolioContent'
import { ZONES } from '../config/zones'
import { useExperienceStore } from '../store/useExperienceStore'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Guía de teclado previa a la intro.
 *
 * Es el primer acto (`phase === 'keys'`): presenta todos los atajos reales del
 * sitio antes del título cinemático. La animación es puramente CSS (entrada
 * escalonada de filas + "pulsación" de cada tecla + barrido) para no montar
 * un bucle de rAF extra sobre el Canvas, que ya está renderizando detrás.
 *
 * El copy vive en `portfolioContent.keyboardGuide`; este componente sólo pinta.
 */
export default function KeyboardGuide() {
  const setPhase = useExperienceStore((s) => s.setPhase)
  const setZone = useExperienceStore((s) => s.setZone)
  const reducedMotion = useReducedMotion()
  const startRef = useRef<HTMLButtonElement>(null)
  const guide = portfolioContent.keyboardGuide

  const focusAfterCommit = useCallback((selector: string) => {
    // Doble rAF: el acto de destino se monta en el commit que sigue a
    // setPhase; el primer frame aún puede ver el DOM anterior.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>(selector)?.focus()
      })
    })
  }, [])

  const startIntro = useCallback(() => {
    setPhase('intro')
    focusAfterCommit('.intro-layer .cine-skip')
  }, [focusAfterCommit, setPhase])

  const skipToPortfolio = useCallback(() => {
    setZone(0)
    setPhase('experience')
    // El foco entra en la tira de pestañas: el usuario de teclado ya puede
    // navegar con ←/→ sin pasar por todo el documento.
    focusAfterCommit(`[data-zone-btn="${ZONES[0]?.id ?? 'architecture'}"]`)
  }, [focusAfterCommit, setPhase, setZone])

  // Foco inicial en la acción principal: Enter continúa sin buscar el botón.
  // Se retrasa lo justo para que la entrada de la guía se vea completa; con
  // movimiento reducido no hay animación que esperar.
  useEffect(() => {
    const timer = window.setTimeout(
      () => {
        // Si el usuario ya tabuló al skip link antes de que termine la
        // entrada, no le robamos el foco de vuelta al CTA.
        const active = document.activeElement
        if (active && active !== document.body) return
        startRef.current?.focus()
      },
      reducedMotion ? 0 : 560,
    )
    return () => window.clearTimeout(timer)
  }, [reducedMotion])

  // Escape salta la guía; Enter/Space continúa cuando el foco no está ya en
  // un control (si lo está, manda la activación nativa del botón).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      if (event.key === 'Escape') {
        event.preventDefault()
        startIntro()
        return
      }

      if (event.key !== 'Enter' && event.key !== ' ') return
      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('button, a[href], input, select, textarea, [role="button"]')) return
      event.preventDefault()
      startIntro()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [startIntro])

  return (
    <div className="cine-layer keys-layer">
      <div className="cine-letterbox cine-letterbox--top" aria-hidden="true" />
      <div className="cine-letterbox cine-letterbox--bottom" aria-hidden="true" />

      <section
        className="keys-panel"
        role="dialog"
        aria-labelledby="keys-title"
        aria-describedby="keys-desc"
      >
        <div className="keys-scan" aria-hidden="true" />

        <header className="keys-head">
          <p className="keys-kicker">
            <span className="keys-pulse" aria-hidden="true" />
            {guide.kicker}
          </p>
          <h1 id="keys-title" className="keys-title">
            {guide.title}
          </h1>
          <p id="keys-desc" className="keys-desc">
            {guide.description}
          </p>
        </header>

        <div className="keys-actions">
          <button ref={startRef} type="button" className="cine-cta keys-start" onClick={startIntro}>
            <span className="cine-cta-glyph" aria-hidden="true">
              ▶
            </span>
            {guide.start}
          </button>
          <button type="button" className="keys-skip" onClick={skipToPortfolio}>
            {guide.skip}
          </button>
        </div>

        <p className="keys-hint">{guide.hint}</p>

        <ul className="keys-list">
          {guide.shortcuts.map((shortcut, index) => (
            <li
              key={`${shortcut.action}-${index}`}
              className="keys-row"
              style={{ '--row': index } as CSSProperties}
            >
              <span className="keys-caps">
                {shortcut.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </span>
              <span className="keys-action">{shortcut.action}</span>
            </li>
          ))}
        </ul>

        <p className="keys-note">{guide.note}</p>
      </section>
    </div>
  )
}
