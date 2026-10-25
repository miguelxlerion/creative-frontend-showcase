/**
 * Presupuesto de render según el dispositivo.
 *
 * Un móvil con DPR 3, bloom a resolución completa, multisampling y sombras
 * de contacto recalculadas cada frame no sostiene 60 FPS. En punteros
 * gruesos (táctil) bajamos resolución y coste de post-proceso, pero NO la
 * geometría: las zonas se ven igual, sólo se renderizan más baratas.
 *
 * Se evalúa una sola vez (el tipo de puntero no cambia en caliente).
 */
const IS_COARSE_POINTER =
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export const IS_TOUCH_FIRST = IS_COARSE_POINTER

/** Tope de DPR: 1.6 en táctil (un móvil DPR 3 renderiza a ~1/3 de píxeles). */
export const DPR_RANGE: [number, number] = IS_TOUCH_FIRST ? [1, 1.6] : [1, 2]

/** MSAA del EffectComposer: caro y poco visible sobre bloom en pantallas densas. */
export const POST_MULTISAMPLING = IS_TOUCH_FIRST ? 0 : 2

/** El bloom se calcula a media resolución en táctil; el blur disimula el escalado. */
export const BLOOM_RESOLUTION = IS_TOUCH_FIRST ? 0.5 : 1

export const STAR_COUNT = IS_TOUCH_FIRST ? 900 : 1800

export const ENV_RESOLUTION = IS_TOUCH_FIRST ? 64 : 128

export const DUST_COUNT = IS_TOUCH_FIRST ? 420 : 900

export const CONTACT_SHADOW_RESOLUTION = IS_TOUCH_FIRST ? 256 : 512
