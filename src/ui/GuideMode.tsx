import { useCallback, useEffect, useRef, type CSSProperties } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { GUIDE_CITY_BUILDING_ID, GUIDE_STEPS } from '../config/guideSteps'
import { portfolioContent } from '../data/portfolioContent'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * GUIDED MODE — recorrido automático de seis pasos que reproduce el video.
 *
 * La escena la dirige `CameraController` (pose por paso con lerp 0.05) y los
 * anillos 3D viven en `GuideHighlights`. Este componente es la capa DOM:
 *  - oscurece lo que no es el sujeto activo (backdrop con foco central),
 *  - guioniza zona, panel del edificio y scroll del Configurator,
 *  - muestra la ficha glass con progreso, chips y controles,
 *  - atrapa Tab dentro del diálogo y cierra con Escape.
 *
 * El auto-avance es un `setTimeout` por paso; cualquier control (Next/Prev)
 * lo reinicia porque el efecto depende de `currentGuideStep`.
 */

const guideCopy = portfolioContent.guideMode

/** Pasos donde el sujeto no es el centro exacto de la pantalla y conviene
 *  mantener algo más de contexto en el backdrop. */
const FOCUS_GRADIENT =
  'radial-gradient(circle at 50% 44%, rgba(5, 6, 14, 0) 0 24%, rgba(5, 6, 14, 0.42) 58%, rgba(3, 4, 10, 0.76) 100%)'

export default function GuideMode() {
  const isActive = useExperienceStore((s) => s.isGuideModeActive)
  const stepIndex = useExperienceStore((s) => s.currentGuideStep)
  const complete = useExperienceStore((s) => s.guideComplete)
  const cardRef = useRef<HTMLElement>(null)

  const stepConfig = GUIDE_STEPS[stepIndex]
  const stepText = guideCopy.steps[stepIndex]
  const zone = stepConfig ? ZONES[stepConfig.zoneIndex] : ZONES[0]

  /**
   * Preparar el escenario de cada paso. `setZone` limpia sub-temas, filtros y
   * selección; por eso el edificio del paso 5 se fija DESPUÉS y el scroll del
   * paso 6 también (setZone resetea `guidedProductStep`).
   */
  useEffect(() => {
    if (!isActive) return
    const config = GUIDE_STEPS[stepIndex]
    if (!config) return

    const store = useExperienceStore.getState()
    store.setZone(config.zoneIndex)

    if (config.highlight === 'city') {
      const building =
        store.cityData.find((item) => item.id === GUIDE_CITY_BUILDING_ID) ?? null
      store.setSelectedBuilding(building)
    }

    if (config.productScroll) {
      store.setGuidedProductStep(config.productScroll.explodePage)
    }
  }, [isActive, stepIndex])

  /** Reloj del paso: avanza solo y, en el paso 6, salta al despiece. */
  useEffect(() => {
    if (!isActive || complete) return
    const config = GUIDE_STEPS[stepIndex]
    if (!config) return

    let productTimer: number | null = null
    if (config.productScroll) {
      productTimer = window.setTimeout(() => {
        useExperienceStore
          .getState()
          .setGuidedProductStep(config.productScroll!.finalPage)
      }, config.duration * config.productScroll.switchAt)
    }

    const advanceTimer = window.setTimeout(() => {
      const store = useExperienceStore.getState()
      if (store.currentGuideStep >= GUIDE_STEPS.length - 1) {
        store.setGuideComplete(true)
      } else {
        store.setGuideStep(store.currentGuideStep + 1)
      }
    }, config.duration)

    return () => {
      window.clearTimeout(advanceTimer)
      if (productTimer !== null) window.clearTimeout(productTimer)
    }
  }, [isActive, stepIndex, complete])

  const closeGuide = useCallback(() => {
    useExperienceStore.getState().setGuideModeActive(false)
    // El botón GUIDED MODE se remonta al salir del tour: dos frames después
    // ya existe y recupera el foco, igual que en el PreOrderModal.
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        document
          .querySelector<HTMLButtonElement>('[data-guide-start]')
          ?.focus()
      })
    })
  }, [])

  const goNext = useCallback(() => {
    const store = useExperienceStore.getState()
    if (!store.isGuideModeActive || store.guideComplete) return
    if (store.currentGuideStep >= GUIDE_STEPS.length - 1) {
      store.setGuideComplete(true)
    } else {
      store.setGuideStep(store.currentGuideStep + 1)
    }
  }, [])

  const goPrev = useCallback(() => {
    const store = useExperienceStore.getState()
    if (!store.isGuideModeActive) return
    // Desde la pantalla final, ← vuelve al último paso en vez de no hacer nada.
    if (store.guideComplete) {
      store.setGuideComplete(false)
      store.setGuideStep(GUIDE_STEPS.length - 1)
      return
    }
    if (store.currentGuideStep > 0) {
      store.setGuideStep(store.currentGuideStep - 1)
    }
  }, [])

  // Foco inicial en el diálogo (no en la ficha interna): la tarjeta persiste
  // entre pasos, así el auto-avance nunca deja el foco en <body>.
  useEffect(() => {
    if (!isActive) return
    const raf = requestAnimationFrame(() => cardRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [isActive])

  useEffect(() => {
    if (!isActive || !complete) return
    const raf = requestAnimationFrame(() => cardRef.current?.focus())
    return () => cancelAnimationFrame(raf)
  }, [isActive, complete])

  // Teclado propio del tour: el hook global se retira mientras está activo.
  useEffect(() => {
    if (!isActive) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.isComposing) return
      if (event.altKey || event.ctrlKey || event.metaKey) return

      const target = event.target instanceof HTMLElement ? event.target : null
      if (target?.closest('input, textarea, select, [contenteditable="true"]')) return

      if (event.key === 'Escape') {
        event.preventDefault()
        closeGuide()
        return
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault()
        goNext()
        return
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        goPrev()
        return
      }
      if (event.key !== 'Tab') return

      // Trampa de foco: el fondo queda inerte aunque sus botones sigan en el DOM.
      const card = cardRef.current
      if (!card) return
      const focusables = Array.from(
        card.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null)
      if (focusables.length === 0) return

      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      const insideList = active ? focusables.includes(active) : false

      if (!insideList) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isActive, closeGuide, goNext, goPrev])

  if (!isActive || !stepConfig || !stepText) return null

  const accentStyle = {
    '--accent': zone.accent,
    '--accent-text': zone.accentText,
  } as CSSProperties
  const isLastStep = stepIndex >= GUIDE_STEPS.length - 1
  const secondary = 'secondary' in stepText ? stepText.secondary : null
  const videoUrl = guideCopy.completion.videoUrl

  return (
    <>
      <motion.div
        className="guide-backdrop"
        aria-hidden="true"
        style={{ background: FOCUS_GRADIENT }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.45 }}
      />

      <div className={`guide-layer${complete ? ' is-complete' : ''}`}>
        <motion.section
          ref={cardRef}
          className="guide-card"
          style={accentStyle}
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-dialog-title"
          aria-describedby="guide-dialog-desc"
          tabIndex={-1}
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <span className="guide-card-accent" aria-hidden="true" />

          {complete ? (
            <CompletionScreen
              videoUrl={videoUrl}
              onExplore={closeGuide}
            />
          ) : (
            <>
              <header className="guide-head">
                <div className="guide-head-copy">
                  <p className="guide-kicker">{stepText.kicker}</p>
                  <div className="guide-dots" aria-hidden="true">
                    {GUIDE_STEPS.map((step, index) => (
                      <span
                        key={step.id}
                        className={`guide-dot${index === stepIndex ? ' is-active' : ''}${
                          index < stepIndex ? ' is-done' : ''
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <span className="guide-counter">
                  {guideCopy.stepLabel} {stepIndex + 1} {guideCopy.ofLabel}{' '}
                  {GUIDE_STEPS.length}
                </span>
              </header>

              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={stepConfig.id}
                  className="guide-body"
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h2 id="guide-dialog-title" className="guide-title">
                    {stepText.title}
                  </h2>

                  {stepIndex === 1 && <ShieldCheck />}

                  <p id="guide-dialog-desc" className="guide-desc">
                    {stepText.description}
                  </p>

                  <div className="guide-badges">
                    {stepText.badges.map((badge, index) => (
                      <span
                        key={badge}
                        className={`guide-chip${
                          stepIndex === 2
                            ? ` is-node guide-chip--node-${index + 1}`
                            : ''
                        }`}
                      >
                        {stepIndex === 2 && (
                          <span className="guide-chip-dot" aria-hidden="true" />
                        )}
                        {badge}
                      </span>
                    ))}
                  </div>

                  {secondary && (
                    <div className="guide-secondary">
                      <span className="guide-secondary-label">
                        {secondary.label}
                      </span>
                      <p className="guide-secondary-text">{secondary.text}</p>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="guide-actions">
                <button
                  type="button"
                  className="guide-btn is-ghost"
                  onClick={goPrev}
                  disabled={stepIndex === 0}
                >
                  {guideCopy.previous}
                </button>
                <button
                  type="button"
                  className="guide-btn is-primary"
                  onClick={goNext}
                >
                  {isLastStep ? guideCopy.finish : guideCopy.next}
                </button>
                <button
                  type="button"
                  className="guide-skip"
                  onClick={closeGuide}
                >
                  {guideCopy.skip}
                </button>
              </div>

              <div className="guide-foot">
                <span className="guide-hint">{guideCopy.hint}</span>
                <span className="guide-timer" aria-hidden="true">
                  <span
                    key={stepConfig.id}
                    className="guide-timer-fill"
                    style={{ animationDuration: `${stepConfig.duration}ms` }}
                  />
                </span>
              </div>
            </>
          )}
        </motion.section>
      </div>
    </>
  )
}

/**
 * Escudo con check del paso 2. Es un badge DOM (no geometría): el check late
 * con CSS y con `prefers-reduced-motion` queda quieto.
 */
function ShieldCheck() {
  const reducedMotion = useReducedMotion()

  return (
    <div className={`guide-shield${reducedMotion ? ' is-static' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 48 48" role="presentation">
        <path
          className="guide-shield-outline"
          d="M24 4 39 9v12c0 10-6.2 17.4-15 21C15.2 38.4 9 31 9 21V9l15-5Z"
        />
        <path
          className="guide-shield-check"
          d="m16.5 24 5.2 5.4L32.5 18"
        />
      </svg>
    </div>
  )
}

function CompletionScreen({
  videoUrl,
  onExplore,
}: {
  videoUrl: string
  onExplore: () => void
}) {
  const completion = guideCopy.completion

  return (
    <div className="guide-complete">
      <p className="guide-kicker">{completion.kicker}</p>
      <h2 id="guide-dialog-title" className="guide-title">
        {completion.title}
      </h2>
      <p id="guide-dialog-desc" className="guide-desc">
        {completion.description}
      </p>

      <div className="guide-actions is-stacked">
        {videoUrl ? (
          <a
            className="guide-btn is-primary"
            href={videoUrl}
            target="_blank"
            rel="noreferrer"
          >
            {completion.watch}
          </a>
        ) : (
          <button
            type="button"
            className="guide-btn is-primary"
            disabled
            title={completion.videoPending}
          >
            {completion.watch}
          </button>
        )}
        <button
          type="button"
          className="guide-btn is-ghost"
          onClick={onExplore}
        >
          {completion.explore}
        </button>
      </div>

      <div className="guide-foot">
        <span className="guide-hint">
          {videoUrl ? 'ESC to explore' : completion.videoPending}
        </span>
      </div>
    </div>
  )
}
