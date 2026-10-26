import type { Vector3Tuple } from 'three'

/**
 * Layout compartido de la zona AI.
 *
 * Lo consumen la escena (posición de etapas y nodos) y la cámara (zoom por
 * herramienta). Si una posición viviera duplicada en los dos archivos, el
 * foco del zoom se desalinearía en cuanto se moviera un icono.
 */

/** Índice de la zona AI dentro de ZONES. */
export const AI_ZONE_INDEX = 2

/** Posiciones locales (sin `zone.position`) de las tres etapas. */
export const AI_EDITOR_POS: Vector3Tuple = [-2.95, 0.3, 0]
export const AI_BRAIN_POS: Vector3Tuple = [0, 0.3, 0]
// La salida va más baja que editor y cerebro: la etiqueta «CI/CD» quedaba
// justo detrás del HUD de métricas AI (arriba-derecha). El flujo y el zoom
// usan esta misma Y, así que bajar la torre no desalinea ni las partículas.
export const AI_OUTPUT_POS: Vector3Tuple = [2.95, -0.15, 0]

/**
 * Radio del núcleo. Se redujo desde 1.35: la esfera dominaba el encuadre y
 * tapaba la lectura de las herramientas que la rodean.
 */
export const AI_CORE_RADIUS = 0.8

/**
 * Nodos-herramienta alrededor del cerebro. La cámara usa los mismos puntos
 * para acercarse a cada icono sin depender de valores paralelos.
 *
 * Copilot NO tiene nodo propio: el editor de la izquierda ya lo representa y
 * su hitbox abre la misma ficha. Un robot flotante extra duplicaba la
 * herramienta y, al pulsarlo, la cámara volvía al editor.
 */
export const AI_TOOL_POSITIONS = {
  cursor: [1.5, 0.05, 0.35],
  rag: [-0.2, -1.18, 0.25],
} satisfies Record<'cursor' | 'rag', Vector3Tuple>

/**
 * Escala del pipeline completo por aspecto. El grupo raíz de la zona la
 * aplica a todos sus hijos, así que la cámara debe multiplicar por el mismo
 * factor sus anclas locales para que el zoom caiga sobre el icono correcto.
 */
export function aiPipelineScale(aspect: number): number {
  return aspect >= 1.25 ? 1 : aspect >= 0.9 ? 0.9 : 0.78
}
