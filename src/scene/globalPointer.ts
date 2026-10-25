/**
 * Puntero global compartido entre el DOM y la escena 3D.
 *
 * Por qué existe: R3F expone `state.pointer`, pero lo alimenta con los
 * eventos del elemento **canvas**. Cualquier capa DOM por encima (pestañas,
 * tarjetas HUD, dossier) se come el evento, así que la cara de la zona 0
 * "se congelaba" en cuanto el ratón pasaba sobre la interfaz. Al escuchar en
 * `window` una sola vez, el puntero sigue estando vivo esté donde esté el
 * ratón, y el cursor DOM y la cara leen exactamente el mismo valor.
 *
 * Valores normalizados en -1..1 respecto al centro del viewport, y con el
 * eje Y invertido para que "arriba" sea positivo igual que en la cámara.
 */
export const globalPointer = { x: 0, y: 0 }

let listening = false

/**
 * Registra el listener de `window`. Idempotente: llamarlo desde cualquier
 * efecto sin miedo a duplicar listeners (StrictMode monta dos veces).
 */
export function initGlobalPointer(): () => void {
  if (typeof window === 'undefined') return () => {}

  const onMove = (e: MouseEvent) => {
    // -1..1 centrado en el viewport. Se topea por si el ratón se sale.
    globalPointer.x = Math.max(-1, Math.min(1, (e.clientX / window.innerWidth) * 2 - 1))
    globalPointer.y = Math.max(-1, Math.min(1, 1 - (e.clientY / window.innerHeight) * 2))
  }

  window.addEventListener('mousemove', onMove, { passive: true })
  listening = true

  // Limpieza real: como el módulo es singleton y el listener es uno solo,
  // devolvemos una función que sólo quita el listener que nosotros añadimos.
  return () => {
    window.removeEventListener('mousemove', onMove)
    listening = false
  }
}

/** ¿Hay listener activo? Lo usa sólo para depuración. */
export function isPointerListening(): boolean {
  return listening
}
