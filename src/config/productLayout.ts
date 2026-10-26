/**
 * Configuración compartida del Product Configurator (zona 6):
 * tema visual, secciones de scroll y textos del HUD.
 *
 * La geometría y las posiciones de las piezas viven en ProductZone:
 * se capturan en refs al montar para poder despiezarlas sin duplicar
 * datos entre React y el render loop.
 */

/** Colores del tema. */
export const PRODUCT_THEME = {
  bg: '#0a0a0a',
  accent: '#ff5500',
  accentText: '#ff8a3d',
  accentGlow: '#ff5500',
  textPrimary: '#ffffff',
  textSecondary: '#b0b0b0',
  silver: '#c0c0c0',
  darkSilver: '#3a3a3a',
} as const

/** Configuración de las 4 páginas de scroll. El texto visible vive en
 *  `portfolioContent.section06.scrollTexts` (fuente única de copy). */
export const SCROLL_SECTIONS = [
  { id: 0, name: 'Hero', range: [0, 0.25] },
  { id: 1, name: 'Explode', range: [0.25, 0.5] },
  { id: 2, name: 'Material', range: [0.5, 0.75] },
  { id: 3, name: 'Reassemble', range: [0.75, 1] },
] as const