import { useSyncExternalStore } from 'react'

/**
 * Preferencia de movimiento reducido del sistema (`prefers-reduced-motion`).
 *
 * Se implementa con `useSyncExternalStore` en vez de un `useEffect` + estado
 * local por dos motivos:
 *  - una sola suscripción a `matchMedia` compartida por todos los componentes
 *    que consultan la preferencia (canvas + HUD), sin un listener por hook;
 *  - el valor se mantiene vivo: si el usuario cambia la preferencia en el
 *    sistema operativo, React re-renderiza y las animaciones se congelan o
 *    reanudan sin recargar la página.
 */
const QUERY = '(prefers-reduced-motion: reduce)'

let mediaQuery: MediaQueryList | null = null

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined') return null
  mediaQuery ??= window.matchMedia(QUERY)
  return mediaQuery
}

function subscribe(onChange: () => void): () => void {
  const query = getMediaQuery()
  if (!query) return () => {}
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getSnapshot(): boolean {
  return getMediaQuery()?.matches ?? false
}

function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
