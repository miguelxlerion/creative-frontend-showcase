import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PRODUCT_PHASE_COUNT, useExperienceStore } from '../store/useExperienceStore'
import { PRODUCT_THEME } from '../config/productLayout'
import { portfolioContent } from '../data/portfolioContent'
import {
  productScroll,
  resetProductScroll,
} from '../scene/zones/productScroll'
import { useReducedMotion } from '../hooks/useReducedMotion'
import PreOrderModal from './PreOrderModal'

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
  const preorderRequests = useExperienceStore((s) => s.preorderRequests)
  const visible = activeZone === 5
  const [preorderOpen, setPreorderOpen] = useState(false)

  // El tour guiado no puede pulsar el botón: pide la apertura por el store.
  // Se compara contra la última petición atendida para que el contador no
  // reabra el modal que el visitante acaba de cerrar.
  const handledPreorderRequest = useRef(preorderRequests)
  useEffect(() => {
    if (preorderRequests === handledPreorderRequest.current) return
    handledPreorderRequest.current = preorderRequests
    if (visible) setPreorderOpen(true)
  }, [preorderRequests, visible])

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
        className="product-scroll-container"
        style={
          {
            '--accent': PRODUCT_THEME.accent,
            '--accent-text': PRODUCT_THEME.accentText,
            '--product-text': PRODUCT_THEME.textPrimary,
          } as React.CSSProperties
        }
      >
        <ProgressBar />

        {/* 4 secciones de contenido: sólo la página activa es visible */}
        {scrollTexts.map((section, index) => (
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
      <motion.div
        animate={{ x: active ? 0 : 60, opacity: active ? 1 : 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <motion.p
          className="product-kicker"
          animate={{ opacity: active ? 1 : 0, y: active ? 0 : 20 }}
          transition={{ duration: 0.4, delay: active ? 0.1 : 0 }}
        >
          {section.title}
        </motion.p>
        <motion.h2
          className="product-title"
          animate={{ opacity: active ? 1 : 0, y: active ? 0 : 20 }}
          transition={{ duration: 0.5, delay: active ? 0.2 : 0 }}
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
  onOpen,
}: {
  phase: number
  open: boolean
  onOpen: () => void
}) {
  const isVisible = phase === PRODUCT_PHASE_COUNT - 1
  const magneticRef = useRef<HTMLButtonElement>(null)
  const magnetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    const btn = magneticRef.current
    if (!btn) return

    // Con movimiento reducido el botón no persigue al cursor.
    if (reducedMotion) {
      magnetRef.current = { x: 0, y: 0 }
      btn.style.transform = ''
      return
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      magnetRef.current.x = (e.clientX - cx) * 0.3
      magnetRef.current.y = (e.clientY - cy) * 0.3
      btn.style.transform = `translate(${magnetRef.current.x}px, ${magnetRef.current.y}px) scale(1.05)`
    }
    const onMouseLeave = () => {
      magnetRef.current.x = 0
      magnetRef.current.y = 0
      btn.style.transform = 'translate(0, 0) scale(1)'
    }
    btn.addEventListener('mousemove', onMouseMove)
    btn.addEventListener('mouseleave', onMouseLeave)
    return () => {
      btn.removeEventListener('mousemove', onMouseMove)
      btn.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [reducedMotion, isVisible])

  if (!isVisible) return null

  return (
    <motion.button
      ref={magneticRef}
      type="button"
      className="product-preorder-btn"
      aria-haspopup="dialog"
      aria-expanded={open}
      aria-controls="preorder-dialog"
      onClick={onOpen}
      style={{
        background: PRODUCT_THEME.accent,
        boxShadow: `0 0 40px ${PRODUCT_THEME.accent}, 0 0 80px ${PRODUCT_THEME.accent}80`,
      }}
      initial={{ opacity: 0, y: 30, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.9 }}
      transition={{ duration: 0.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
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
  )
}
