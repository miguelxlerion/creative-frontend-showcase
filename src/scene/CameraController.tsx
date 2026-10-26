import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import { CITY_GROUND_Y, CITY_LAYOUT } from '../config/cityLayout'
import {
  AI_EDITOR_POS,
  AI_OUTPUT_POS,
  AI_TOOL_POSITIONS,
  AI_ZONE_INDEX,
  aiPipelineScale,
} from '../config/aiWorkflowLayout'
import {
  CREATIVE_MODEL_BASE_Y,
  CREATIVE_ZONE_INDEX,
  getCreativeObject,
} from '../config/creativeLayout'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { globalPointer } from './globalPointer'

/**
 * Cámara cinemática del recorrido.
 *
 * No hay OrbitControls a propósito: el usuario no orbita libremente, la cámara
 * vuela entre "planos" dirigidos. Cada cambio de estado (fase, zona, sub-tema o
 * edificio) dispara un tween easeInOutCubic desde la pose REAL actual hasta la
 * nueva pose, así que nunca hay un salto de encuadre.
 *
 * Regímenes:
 *  - intro:    empuje lento desde la lejanía hasta el plano de la zona 0.
 *  - zona:     plano general de la zona.
 *  - sub-tema: arco orbital más cercano alrededor del modelo.
 *  - edificio: órbita isométrica sobre el edificio seleccionado del Digital Twin.
 *  - créditos: retirada amplia mientras ruedan los títulos.
 *
 * El Product Configurator entra directo a un plano cercano: su pose de reposo
 * ya encuadra el dron y el scroll sólo anima las fases del producto, así que
 * la cámara (con su parallax) sigue siendo competencia exclusiva de este control.
 */

const ZONE_FLIGHT = 1.8
const SUB_FLIGHT = 1.5
const BUILDING_FLIGHT = 1.4
const INTRO_FLIGHT = 6.2
const CREDITS_FLIGHT = 7

const CITY_ZONE_INDEX = 4
/** El sub-plano se acerca al 62% de la distancia del plano general. */
const SUB_DISTANCE_FACTOR = 0.62
/** Giros en Y por índice de sub-tema (radianes). */
const SUB_YAW_OFFSETS = [0.55, -0.5, 0]
const SUB_Y_OFFSET = 0.35
/**
 * Encuadres de acercamiento por herramienta AI, en coordenadas locales.
 * `lookAt` es el punto que queda en pantalla y `offset` la posición de la
 * cámara respecto a él. Rondan 2.2-3.7 unidades del objetivo: el usuario
 * pidió que el zoom se sintiera dentro del "laboratorio", no como un plano
 * general algo más cercano.
 */
const AI_SUB_VIEWS: ReadonlyArray<{
  lookAt: readonly [number, number, number]
  offset: readonly [number, number, number]
}> = [
  // Copilot / editor: tres cuartos desde la derecha para leer la pantalla.
  // La mirada sube un poco para que la etiqueta INPUT no se recorte.
  {
    lookAt: [AI_EDITOR_POS[0], 0.35, AI_EDITOR_POS[2] + 0.1],
    offset: [0.85, 0.5, 3.0],
  },
  // Cursor: el cubo-editor es el objetivo más pequeño y pide el plano más cercano.
  {
    lookAt: [AI_TOOL_POSITIONS.cursor[0], 0.06, AI_TOOL_POSITIONS.cursor[2]],
    offset: [0.7, 0.42, 2.15],
  },
  // RAG: la pila y la lupa se leen mejor de frente.
  {
    lookAt: [AI_TOOL_POSITIONS.rag[0], -0.98, AI_TOOL_POSITIONS.rag[2]],
    offset: [0.7, 0.45, 2.25],
  },
  // CI/CD: la torre completa con sus tres puertas y sus etiquetas. La salida
  // vive 0.45 unidades más abajo que editor/cerebro para no chocar con el HUD
  // de métricas. La mirada sube por encima de la torre: así el conjunto baja
  // en pantalla y la etiqueta «CI/CD» no queda detrás de la leyenda AI, que
  // ocupa la franja superior izquierda.
  {
    lookAt: [AI_OUTPUT_POS[0], 0.2, AI_OUTPUT_POS[2]],
    offset: [0.85, 0.48, 3.7],
  },
]
/** Duración algo más larga que el resto de sub-temas: el salto es mayor. */
const AI_SUB_FLIGHT = 1.8
/**
 * El panel lateral tapa la derecha: la herramienta se centra en el área libre.
 * Los planos son más cercanos que antes, así que el desplazamiento en mundo
 * también baja: 0.72 dejaba el editor pegado al borde izquierdo.
 */
const AI_PANEL_LOOK_SHIFT = 0.5
/** En móvil el panel es una hoja inferior: se sube el sujeto bajando la mirada. */
const AI_MOBILE_LOOK_DROP = 0.5

/**
 * El diorama de Creative 3D mide 4,4 × 2,77: el arco genérico al 0.62×
 * (4,6 unidades) lo partía por la mitad. Estos planos lo rodean a ~9 unidades,
 * que es casi el plano general: el sub-tema se lee en el ángulo, no en el zoom.
 */
const CREATIVE_SUB_VIEWS: ReadonlyArray<{
  lookAt: readonly [number, number, number]
  offset: readonly [number, number, number]
}> = [
  // Frontal elevado: fábrica y patio, con la retícula de fondo.
  { lookAt: [0, -0.05, 0], offset: [1.2, 2.6, 8.4] },
  // Tres cuartos derecho: azul del depósito contra el naranja de la nave.
  { lookAt: [0, -0.05, 0], offset: [5.8, 2.8, 6.4] },
  // Elevado: planta completa, chimeneas y burbujas.
  { lookAt: [0, 0, 0], offset: [3.2, 6.4, 6.2] },
]
/** El panel lateral tapa la derecha: el diorama se corre al área libre. */
const CREATIVE_PANEL_LOOK_SHIFT = 0.9
/**
 * En móvil la hoja inferior tapa ~58% de la pantalla: el diorama sube lo justo
 * para que el edificio y las chimeneas queden sobre el panel.
 */
const CREATIVE_MOBILE_LOOK_DROP = 1.95

/** Parallax de ratón: sólo se suma a la pose base, nunca se acumula. */
const PARALLAX_X = 0.4
const PARALLAX_Y = 0.28
const PARALLAX_LOOK = 0.05
const PARALLAX_IN_FLIGHT = 0.35

const UP = new THREE.Vector3(0, 1, 0)
const _lookDir = new THREE.Vector3()

/**
 * Encuadre por aspecto.
 *
 * El FOV es vertical: en un móvil vertical el campo horizontal se estrecha
 * hasta ~20° y el sujeto se sale por los lados. En vez de tocar el FOV
 * (deformaría la perspectiva), alejamos la cámara a lo largo del vector
 * mirada→cámara. La raíz 0.65 evita que un tablet vertical se vaya
 * excesivamente lejos; el tope 2.05 mantiene el sujeto legible.
 */
const ASPECT_FIT_BASE = 1.3
const ASPECT_FIT_MAX = 2.05

function aspectFit(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect >= ASPECT_FIT_BASE) return 1
  return Math.min(ASPECT_FIT_MAX, Math.pow(ASPECT_FIT_BASE / aspect, 0.65))
}

/** Aleja la cámara del punto mirado sin cambiar el ángulo de la toma. */
function pullBack(pose: Pose, factor: number): Pose {
  if (factor <= 1) return pose
  return {
    position: pose.lookAt
      .clone()
      .add(pose.position.clone().sub(pose.lookAt).multiplyScalar(factor)),
    lookAt: pose.lookAt.clone(),
  }
}

const INTRO_POSE = {
  position: new THREE.Vector3(0, 0.9, 9.5),
  lookAt: new THREE.Vector3(0, 0.3, 0),
}

const CREDITS_POSE = {
  position: new THREE.Vector3(0, 7.5, 30),
  lookAt: new THREE.Vector3(0, 0, 0),
}

interface Pose {
  position: THREE.Vector3
  lookAt: THREE.Vector3
}

interface Flight {
  key: string
  active: boolean
  elapsed: number
  duration: number
  from: Pose
  to: Pose
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export default function CameraController() {
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const selectedBuilding = useExperienceStore((s) => s.selectedBuilding)
  const phase = useExperienceStore((s) => s.phase)
  const reducedMotion = useReducedMotion()

  // Pose "en reposo" (sin parallax). Es la base sobre la que se suma el ratón.
  const base = useRef<Pose>({
    position: new THREE.Vector3(0, 2.6, 30),
    lookAt: new THREE.Vector3(0, 0.3, 0),
  })

  const flight = useRef<Flight>({
    key: '',
    active: false,
    elapsed: 0,
    duration: ZONE_FLIGHT,
    from: { position: new THREE.Vector3(), lookAt: new THREE.Vector3() },
    to: { position: new THREE.Vector3(), lookAt: new THREE.Vector3() },
  })

  /** Calcula la pose de destino y su duración para el estado actual. */
  const resolveTarget = (): { pose: Pose; duration: number } => {
    const aspect = size.width / Math.max(1, size.height)
    const fit = aspectFit(aspect)

    if (phase === 'intro') {
      // En vertical el título manda; el empuje se aleja sólo un poco para
      // que la cara siga leyéndose detrás del texto.
      return {
        pose: pullBack(
          {
            position: INTRO_POSE.position.clone(),
            lookAt: INTRO_POSE.lookAt.clone(),
          },
          1 + (fit - 1) * 0.45,
        ),
        duration: INTRO_FLIGHT,
      }
    }

    if (phase === 'credits') {
      return {
        pose: {
          position: CREDITS_POSE.position.clone(),
          lookAt: CREDITS_POSE.lookAt.clone(),
        },
        duration: CREDITS_FLIGHT,
      }
    }

    const zone = ZONES[activeZone]

    // Digital Twin: órbita isométrica sobre el edificio pulsado.
    if (activeZone === CITY_ZONE_INDEX && selectedBuilding) {
      const building = CITY_LAYOUT[selectedBuilding.id]
      if (building) {
        const center = new THREE.Vector3(
          zone.position[0] + building.x,
          zone.position[1] + CITY_GROUND_Y + building.h * 0.5,
          zone.position[2] + building.z,
        )
        // El edificio tiene voladizos y una losa base ancha: con la fórmula
        // anterior la fachada llenaba la pantalla y no se leía la planta.
        // Más aire para que el modelo completo entre en el encuadre.
        const dist = 2.6 + building.h * 1.6

        return {
          pose: pullBack(
            {
              position: new THREE.Vector3(
                center.x + dist * 0.62,
                center.y + dist * 0.55,
                center.z + dist * 0.62,
              ),
              lookAt: center,
            },
            // Los edificios son pequeños: se compensa menos que una zona.
            1 + (fit - 1) * 0.75,
          ),
          duration: BUILDING_FLIGHT,
        }
      }
    }

    // Sub-tema: arco orbital cercano alrededor del modelo de la zona.
    if (activeSubSection) {
      // Creative: los hotspots del diorama (camión, tanques, edificio) tienen
      // su propio plano cercano. Comparten `activeSubSection` con el panel,
      // así que el clic mueve cámara y ficha a la vez.
      if (activeZone === CREATIVE_ZONE_INDEX) {
        const object = getCreativeObject(activeSubSection)
        if (object) {
          const lookAt = new THREE.Vector3(...zone.position).add(
            new THREE.Vector3(
              object.position[0],
              CREATIVE_MODEL_BASE_Y + object.position[1],
              object.position[2],
            ),
          )
          const offset = new THREE.Vector3(...object.cameraOffset)

          if (size.width > 640) lookAt.x += object.panelShiftX
          else lookAt.y -= object.mobileLookDrop

          return {
            pose: pullBack(
              { position: lookAt.clone().add(offset), lookAt },
              1 + (fit - 1) * 0.9,
            ),
            duration: SUB_FLIGHT,
          }
        }
      }

      const subIndex = zone.subButtons.findIndex((sub) => sub.id === activeSubSection)

      if (subIndex >= 0) {
        // En AI cada herramienta tiene su propio plano cercano: el editor,
        // los nodos del cerebro y la salida están separados ~3 unidades.
        if (activeZone === AI_ZONE_INDEX) {
          const view = AI_SUB_VIEWS[subIndex % AI_SUB_VIEWS.length]
          if (view) {
            // El pipeline se escala por aspecto, así que la pose debe usar
            // las mismas coordenadas que los iconos. Sin esto, el zoom cae
            // al lado del objetivo en móvil/tablet.
            const scale = aiPipelineScale(
              size.width / Math.max(1, size.height),
            )
            const lookAt = new THREE.Vector3(...zone.lookAt).add(
              new THREE.Vector3(...view.lookAt).multiplyScalar(scale),
            )
            const offset = new THREE.Vector3(...view.offset).multiplyScalar(
              scale,
            )

            // En escritorio el panel ocupa la derecha; en móvil es una hoja
            // inferior y se compensa en vertical, no en X.
            if (size.width > 640) lookAt.x += AI_PANEL_LOOK_SHIFT
            else lookAt.y -= AI_MOBILE_LOOK_DROP

            return {
              pose: pullBack(
                { position: lookAt.clone().add(offset), lookAt },
                1 + (fit - 1) * 0.85,
              ),
              duration: AI_SUB_FLIGHT,
            }
          }
        }

        // Creative: el diorama es ancho y bajo; los planos genéricos lo
        // recortaban. Se rodea a distancia de plano general.
        if (activeZone === CREATIVE_ZONE_INDEX) {
          const view = CREATIVE_SUB_VIEWS[subIndex % CREATIVE_SUB_VIEWS.length]
          if (view) {
            const lookAt = new THREE.Vector3(...zone.lookAt).add(
              new THREE.Vector3(...view.lookAt),
            )
            const offset = new THREE.Vector3(...view.offset)

            if (size.width > 640) lookAt.x += CREATIVE_PANEL_LOOK_SHIFT
            else lookAt.y -= CREATIVE_MOBILE_LOOK_DROP

            return {
              pose: pullBack(
                { position: lookAt.clone().add(offset), lookAt },
                1 + (fit - 1) * 0.9,
              ),
              duration: SUB_FLIGHT,
            }
          }
        }

        const baseLookAt = new THREE.Vector3(...zone.lookAt)
        const lookAt = baseLookAt.clone()
        const offset = new THREE.Vector3(...zone.cameraPosition)
          .sub(baseLookAt)
          .multiplyScalar(SUB_DISTANCE_FACTOR)
        offset.applyAxisAngle(
          UP,
          SUB_YAW_OFFSETS[subIndex % SUB_YAW_OFFSETS.length] ?? 0,
        )
        offset.y += SUB_Y_OFFSET

        return {
          pose: pullBack(
            { position: lookAt.clone().add(offset), lookAt },
            1 + (fit - 1) * 0.9,
          ),
          duration: SUB_FLIGHT,
        }
      }
    }

    // Plano general de la zona. El Configurator es un objeto pequeño y su
    // gracia es la cercanía: se compensa el aspecto a medias para no
    // convertirlo en una maqueta lejana en vertical.
    const zoneFit = zone.id === 'product' ? 1 + (fit - 1) * 0.55 : fit

    return {
      pose: pullBack(
        {
          position: new THREE.Vector3(...zone.cameraPosition),
          lookAt: new THREE.Vector3(...zone.lookAt),
        },
        zoneFit,
      ),
      duration: ZONE_FLIGHT,
    }
  }

  useFrame((_state, delta) => {
    const dt = Math.min(delta, 0.1)
    // El aspecto entra en la clave: al girar el móvil/tablet se relanza el
    // vuelo hacia la pose reencuadrada. El bucket evita tweenear el resize
    // de un píxel.
    const aspectBucket = Math.round((size.width / Math.max(1, size.height)) * 20) / 20
    const key = `${phase}|${activeZone}|${activeSubSection ?? ''}|${selectedBuilding?.id ?? ''}|${aspectBucket}`
    const f = flight.current

    // Movimiento reducido: sin tween. La cámara aterriza de inmediato en la
    // pose dirigida, incluso si la preferencia se activa a mitad de un vuelo.
    if (reducedMotion) {
      if (key !== f.key || f.active) {
        const target = resolveTarget()
        f.key = key
        f.active = false
        f.to.position.copy(target.pose.position)
        f.to.lookAt.copy(target.pose.lookAt)
        base.current.position.copy(target.pose.position)
        base.current.lookAt.copy(target.pose.lookAt)
        useExperienceStore.getState().setFlying(false)
      }
    } else if (key !== f.key) {
      // Cambio de plano: capturar la pose real y lanzar el tween.
      const target = resolveTarget()

      camera.getWorldDirection(_lookDir)
      const fromLookAt = camera.position.clone().addScaledVector(_lookDir, 12)

      f.from.position.copy(camera.position)
      f.from.lookAt.copy(fromLookAt)
      f.to.position.copy(target.pose.position)
      f.to.lookAt.copy(target.pose.lookAt)
      f.duration = target.duration
      f.elapsed = 0
      f.active = true
      f.key = key

      base.current.position.copy(camera.position)
      base.current.lookAt.copy(fromLookAt)

      useExperienceStore.getState().setFlying(true)
    }

    // Avance del vuelo: al terminar, la pose aterrizada queda como base y
    // sólo se le suma el parallax de ratón (también en el Configurator).
    if (f.active) {
      f.elapsed += dt
      const t = Math.min(1, f.elapsed / f.duration)
      const eased = easeInOutCubic(t)

      base.current.position.lerpVectors(f.from.position, f.to.position, eased)
      base.current.lookAt.lerpVectors(f.from.lookAt, f.to.lookAt, eased)

      if (t >= 1) {
        f.active = false
        useExperienceStore.getState().setFlying(false)
      }
    }

    // Parallax de ratón: se suma a la pose base (nunca se acumula). Durante el
    // vuelo se atenúa para no romper el encuadre dirigido. Con movimiento
    // reducido se anula: también es animación provocada por la interacción.
    const parallaxScale = reducedMotion ? 0 : f.active ? PARALLAX_IN_FLIGHT : 1

    camera.position.copy(base.current.position)
    camera.position.x += globalPointer.x * PARALLAX_X * parallaxScale
    camera.position.y += globalPointer.y * PARALLAX_Y * parallaxScale

    camera.lookAt(
      base.current.lookAt.x + globalPointer.x * PARALLAX_LOOK * parallaxScale,
      base.current.lookAt.y + globalPointer.y * PARALLAX_LOOK * parallaxScale,
      base.current.lookAt.z,
    )
  })

  return null
}
