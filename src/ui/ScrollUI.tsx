import { useEffect, useRef, useState } from 'react'
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
} from 'framer-motion'
import { PRODUCT_PHASE_COUNT, useExperienceStore } from '../store/useExperienceStore'
import { PRODUCT_THEME } from '../config/productLayout'
import { portfolioContent } from '../data/portfolioContent'
import {
  productScroll,
  resetProductScroll,
} from '../scene/zones/productScroll'
import { useReducedMotion } from '../hooks/useReducedMotion'
import PreOrderModal from './PreOrderModal'

/** Fuerza del imán: 0.3 del vector cursor-centro. Más alto se siente roto. */
const MAGNET_STRENGTH = 0.3
/** Spring compartido por x/y: rápido al seguir, sin rebote al soltar. */
const MAGNET_SPRING = { stiffness: 260, damping: 20, mass: 0.6 }

/**
 * HUD del Product Configurator (zona 6).
 *
 * El scroll ya NO se captura aquí: lo gobierna `<ScrollControls>` dentro del
 * Canvas (4 páginas, damping 0.2). Este componente sólo refleja el estado:
 *  - `productPhase` (store) = página activa, escrita por la escena al cruzar
 *    cada cuarto del recorrido. Cambia el texto y el botón de pre-order.
 *  - `productScroll.offset` = offset amortiguado continuo, leído con rAF para
 *    pintar la barra de progreso sin re-renders de React por frame.
 *
 * El contenedor es `pointer-events: none`: los eventos de rueda/touch deben
 * atravesarlo hasta la capa de ScrollControls que vive dentro del canvas.
 * Sólo el botón de pre-order recupera los eventos.
 */

export default function ScrollUI() {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const productPhase = useExperienceStore((s) => s.productPhase)
  const isGuideModeActive = useExperienceStore((s) => s.isGuideModeActive)
  const currentGuideStep = useExperienceStore((s) => s.currentGuideStep)
  const visible = activeZone === 5
  const [preorderOpen, setPreorderOpen] = useState(false)

  // El paso 6 lleva el scroll solo y señala el botón magnético. El texto de
  // las cuatro páginas se oculta para no competir con la tarjeta del tour.
  const guideActive = isGuideModeActive
  const guideHighlight = guideActive && currentGuideStep === 5

  const scrollTexts = portfolioContent.section06.scrollTexts

  // Si se cambia de zona con el diálogo abierto (no es posible con el ratón,
  // pero sí desde el store), se cierra para no reabrirlo al volver.
  useEffect(() => {
    if (!visible) setPreorderOpen(false)
  }, [visible])

  if (!visible) return null

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key="product-scroll-ui"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        className={`product-scroll-container${guideActive ? ' is-guide-active' : ''}`}
        style={
          {
            '--accent': PRODUCT_THEME.accent,
            '--accent-text': PRODUCT_THEME.accentText,
            '--product-text': PRODUCT_THEME.textPrimary,
          } as React.CSSProperties
        }
      >
        {!guideActive && <ProgressBar />}

        {/* 4 secciones de contenido: sólo la página activa es visible.
            Durante el tour se desmontan: la tarjeta del paso 6 ya cuenta el
            guion y el texto taparía el modelo despiezado. */}
        {!guideActive &&
          scrollTexts.map((section, index) => (
            <ScrollSection
              key={section.title}
              section={section}
              active={index === productPhase}
              showCue={index === 0}
            />
          ))}

        <PreOrderButton
          phase={productPhase}
          open={preorderOpen}
          guideHighlight={guideHighlight}
          onOpen={() => setPreorderOpen(true)}
        />

        {preorderOpen && (
          <PreOrderModal onClose={() => setPreorderOpen(false)} />
        )}
      </motion.div>
    </AnimatePresence>
  )
}

/**
 * Barra de progreso continua. Lee el offset que publica la escena con un
 * rAF propio: actualizar un motion value desde dentro del Canvas obligaría
 * a compartir estado de React entre ambos mundos.
 */
function ProgressBar() {
  const fillRef = useRef<HTMLDivElement>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    resetProductScroll()
  }, [])

  useEffect(() => {
    const fill = fillRef.current
    if (!fill) return

    // Movimiento reducido: la barra salta de página en página en vez de
    // recorrer el offset amortiguado. Sigue siendo feedback de posición,
    // pero sin un transform continuo ligado al scroll.
    if (reducedMotion) {
      const paint = (phase: number) => {
        fill.style.transform = `scaleY(${phase / (PRODUCT_PHASE_COUNT - 1)})`
      }
      paint(useExperienceStore.getState().productPhase)
      return useExperienceStore.subscribe((state) => paint(state.productPhase))
    }

    let raf = 0
    const tick = () => {
      fill.style.transform = `scaleY(${productScroll.offset})`
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [reducedMotion])

  return (
    <div className="product-progress-bar" aria-hidden="true">
      <div ref={fillRef} className="product-progress-fill" />
    </div>
  )
}

/** Sección individual de texto: sólo se muestra en su página. */
function ScrollSection({
  section,
  active,
  showCue,
}: {
  section: { title: string; text: string }
  active: boolean
  showCue: boolean
}) {
  return (
    <div className="product-section" aria-hidden={!active}>
      {/* Springs, no tweens: el texto acompaña al scroll amortiguado de
          ScrollControls y frena con inercia en vez de aterrizar en seco.
          `MotionConfig reducedMotion="user"` desactiva el desplazamiento. */}
      <motion.div
        animate={{ x: active ? 0 : 60, opacity: active ? 1 : 0 }}
        transition={{ type: 'spring', stiffness: 120, damping: 22, mass: 0.9 }}
      >
        <motion.p
          className="product-kicker"
          animate={{ opacity: active ? 1 : 0, y: active ? 0 : 20 }}
          transition={{
            type: 'spring',
            stiffness: 150,
            damping: 24,
            delay: active ? 0.08 : 0,
          }}
        >
          {section.title}
        </motion.p>
        <motion.h2
          className="product-title"
          animate={{ opacity: active ? 1 : 0, y: active ? 0 : 20 }}
          transition={{
            type: 'spring',
            stiffness: 120,
            damping: 22,
            delay: active ? 0.16 : 0,
          }}
        >
          {section.text}
        </motion.h2>
        {showCue && (
          <motion.div
            className="product-scroll-cue"
            animate={{ opacity: active ? 1 : 0 }}
            transition={{ duration: 0.4, delay: active ? 0.45 : 0 }}
          >
            <span className="product-scroll-cue-line" aria-hidden="true" />
            SCROLL TO CONFIGURE
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}

/** Botón magnético Pre-order (última página). */
function PreOrderButton({
  phase,
  open,
  guideHighlight,
  onOpen,
}: {
  phase: number
  open: boolean
  guideHighlight: boolean
  onOpen: () => void
}) {
  const isVisible = phase === PRODUCT_PHASE_COUNT - 1
  const reducedMotion = useReducedMotion()

  // El desplazamiento magnético vive en motion values, no en style.transform:
  // Framer compone x/y con el scale de whileHover, así las dos animaciones no
  // se pisan. Antes el mousemove escribía transform a mano y anulaba el hover.
  const magnetX = useMotionValue(0)
  const magnetY = useMotionValue(0)
  const springX = useSpring(magnetX, MAGNET_SPRING)
  const springY = useSpring(magnetY, MAGNET_SPRING)

  // Si la preferencia cambia en caliente, el botón vuelve a su centro.
  useEffect(() => {
    if (!reducedMotion) return
    magnetX.set(0)
    magnetY.set(0)
  }, [reducedMotion, magnetX, magnetY])

  if (!isVisible) return null

  const handleMagnet = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (reducedMotion) return
    const rect = event.currentTarget.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    // Coordenadas relativas al centro × 0.3: el botón persigue al cursor sin
    // escaparse de su zona de clic (el desplazamiento máximo es acotado).
    magnetX.set((event.clientX - centerX) * MAGNET_STRENGTH)
    magnetY.set((event.clientY - centerY) * MAGNET_STRENGTH)
  }

  const resetMagnet = () => {
    magnetX.set(0)
    magnetY.set(0)
  }

  return (
    <>
      {/* Justificación visible del micro-interaction, junto al botón que lo
          demuestra. `pointer-events: none` para no interceptar la rueda de
          ScrollControls. */}
      <motion.p
        className="product-preorder-note"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
      >
        {portfolioContent.recruiter.microInteraction}
      </motion.p>

      <motion.button
        type="button"
        className={`product-preorder-btn${guideHighlight ? ' is-guide-target' : ''}`}
        data-guide-target={guideHighlight ? 'preorder' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="preorder-dialog"
        onClick={onOpen}
        onMouseMove={handleMagnet}
        onMouseLeave={resetMagnet}
        onBlur={resetMagnet}
        style={{
          x: springX,
          y: springY,
          background: PRODUCT_THEME.accent,
          boxShadow: `0 0 40px ${PRODUCT_THEME.accent}, 0 0 80px ${PRODUCT_THEME.accent}80`,
        }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{
          opacity: { duration: 0.45, delay: 0.25 },
          scale: { type: 'spring', stiffness: 260, damping: 20 },
        }}
        whileHover={
          reducedMotion
            ? undefined
            : {
                scale: 1.05,
                boxShadow: `0 0 60px ${PRODUCT_THEME.accent}, 0 0 120px ${PRODUCT_THEME.accent}AA`,
              }
        }
        whileTap={reducedMotion ? undefined : { scale: 0.96 }}
      >
        PRE-ORDER NOW
      </motion.button>
    </>
  )
}
