/**
 * Puente imperativo entre el ScrollControls de la zona 6 (dentro del Canvas)
 * y el HUD DOM (fuera del Canvas).
 *
 * `ScrollUI` no puede usar `useScroll()` porque no está dentro del Canvas.
 * La escena publica aquí el offset amortiguado una vez por frame y la UI lo
 * lee con rAF para pintar la barra de progreso sin re-renders de React.
 */
export const productScroll = {
  /** Offset amortiguado 0..1 que publica drei. */
  offset: 0,
}

/** Se llama al entrar de nuevo a la zona para no pintar un frame con el offset viejo. */
export function resetProductScroll(): void {
  productScroll.offset = 0
}
