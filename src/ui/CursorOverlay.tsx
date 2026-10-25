import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { initGlobalPointer } from '../scene/globalPointer'

/**
 * Cursor personalizado que forma parte del ambiente, no un accesorio suelto.
 *
 * Diseño: un punto fino que sigue al ratón SIN retardo (es el "puntero" real)
 * y un anillo neón que lo persigue con inercia. El anillo va teñido con el
 * `accent` de la zona activa, así que al cambiar de pestaña el cursor cambia
 * de color junto con todo el HUD: se lee como si el cursor perteneciera a la
 * escena.
 *
 * Detalles de implementación importantes:
 * - Nada de estado React para la posición: se escribe en `style.transform`
 *   desde un rAF. Re-renderizar por cada píxel de movimiento sería un desastre.
 * - Solo se activa en punteros finos (`pointer: fine`). En táctil se oculta y
 *   devolvemos el cursor nativo, porque no tiene sentido arrastrar un anillo.
 * - Se oculta al salir del documento, para no dejar un fantasma clavado.
 */
export default function CursorOverlay() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)
  const activeZone = useExperienceStore((s) => s.activeZone)
  // Estado DOM de hover en un ref (no state): solo lo lee el listener y el
  // efecto de sincronización con `sceneHover`. Re-renderizar por esto sería
  // desperdicio.
  const domHoverRef = useRef(false)

  // Sincroniza el anillo cuando cambia el hover 3D (edificio), aunque el
  // ratón no se mueva: el evento de ratón podría no dispararse en ese frame.
  const sceneHover = useExperienceStore((s) => s.sceneHover)
  useEffect(() => {
    const ring = ringRef.current
    if (!ring) return
    const interactive = domHoverRef.current || sceneHover
    ring.dataset.hover = interactive ? 'on' : 'off'
  }, [sceneHover])

  useEffect(() => {
    // Sin puntero fino no hay cursor personalizado: tocamos y ya.
    if (!window.matchMedia('(pointer: fine)').matches) return

    // Este efecto es el dueño del ciclo de vida del puntero global: la escena
    // 3D (la cara de la zona 0) lee el mismo valor que el cursor DOM.
    const stopPointer = initGlobalPointer()

    const dot = dotRef.current
    const ring = ringRef.current
    if (!dot || !ring) return

    // Objetivo del ratón + posición interpolada del anillo.
    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const follow = { x: target.x, y: target.y }
    let hovering = false
    let visible = false
    let raf = 0

    const setVisibility = (on: boolean) => {
      if (visible === on) return
      visible = on
      dot.style.opacity = on ? '1' : '0'
      ring.style.opacity = on ? '1' : '0'
    }

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      setVisibility(true)

      // Estado "interactivo": el anillo se ensancha y deja de ser un aro
      // para convertirse en un marco. Detectamos contra el árbol real Y
      // contra el hover 3D (edificios del Digital Twin): los eventos del
      // canvas no traen clases, por eso el store expone `sceneHover`.
      const el = e.target as HTMLElement | null
      const domInteractive = !!el?.closest(
        'button, a, [role="button"], [role="menuitem"]',
      )
      domHoverRef.current = domInteractive
      const sceneInteractive = useExperienceStore.getState().sceneHover
      const interactive = domInteractive || sceneInteractive
      if (interactive !== hovering) {
        hovering = interactive
        ring.dataset.hover = interactive ? 'on' : 'off'
      }
    }

    const onLeave = () => setVisibility(false)

    // El bucle: el punto va clavado al ratón, el anillo lo arrastra con
    // amortiguación exponencial (independiente de framerate).
    const tick = () => {
      follow.x += (target.x - follow.x) * 0.16
      follow.y += (target.y - follow.y) * 0.16

      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`
      ring.style.transform = `translate3d(${follow.x}px, ${follow.y}px, 0)`

      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    raf = requestAnimationFrame(tick)

    // StrictMode monta dos veces: sin esta limpieza quedarían dos bucles rAF.
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseleave', onLeave)
      stopPointer()
    }
  }, [])

  return (
    <div
      className="cursor-layer"
      aria-hidden="true"
      // Hereda el acento de la zona activa: mismo color-mix que usa el resto
      // del HUD, así el cursor y las tarjetas comparten paleta exacta.
      style={{ '--accent': ZONES[activeZone].accent } as CSSProperties}
    >
      <div ref={ringRef} className="cursor-ring" data-hover="off" />
      <div ref={dotRef} className="cursor-dot" />
    </div>
  )
}
