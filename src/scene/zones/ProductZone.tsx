import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  ContactShadows,
  ScrollControls,
  useScroll,
} from '@react-three/drei'
import type { ScrollControlsState } from '@react-three/drei'
import * as THREE from 'three'
import { ZONES } from '../../config/zones'
import type { ZoneConfig } from '../../config/zones'
import { PRODUCT_THEME, SCROLL_SECTIONS } from '../../config/productLayout'
import { useExperienceStore } from '../../store/useExperienceStore'
import { CONTACT_SHADOW_RESOLUTION, IS_TOUCH_FIRST } from '../deviceQuality'
import { productScroll } from './productScroll'

/**
 * Zona 5 — "Product Configurator" (naranja eléctrico #ff5500)
 *
 * Dron procedural de 6 piezas con scroll real de drei. `ScrollControls`
 * crea 4 páginas dentro del Canvas y `useScroll()` entrega un offset
 * continuo 0..1 que se mapea así:
 *
 *  0.00 → 0.25  Hero: rotación (4 vueltas a lo largo de todo el recorrido)
 *  0.25 → 0.50  Explode: las piezas se separan del centro
 *  0.50 → 0.75  Material: plata #c0c0c0 → naranja #ff5500
 *  0.75 → 1.00  Reassemble: vuelven a su sitio y recuperan la plata
 *
 * El ScrollControls se monta SOLO cuando la zona está activa. Si estuviera
 * siempre montado, su capa de scroll cubriría el canvas de las demás zonas
 * y R3F conectaría los eventos a esa capa (la ciudad dejaría de responder).
 *
 * La cámara NO se toca: CameraController sigue siendo la única autoridad y
 * el parallax de ratón sigue vivo.
 *
 * Rendimiento:
 *  - La animación vive entera en useFrame: cero re-renders de React.
 *  - El offset se publica en `productScroll` para que el HUD DOM pinte la
 *    barra con rAF, sin sincronizar estado de React por frame.
 *  - Sólo se escribe el store (página activa) al cruzar un cuarto del scroll.
 */

const PRODUCT_ZONE_INDEX = ZONES.findIndex((zone) => zone.id === 'product')

const PART_IDS = ['body', 'leftArm', 'rightArm', 'lens', 'ring1', 'ring2'] as const
type PartId = (typeof PART_IDS)[number]

/**
 * Vector de despiece por pieza, en espacio local. useFrame lo multiplica por
 * `explode * 2`, así que éste es el desplazamiento de MEDIA explosión.
 */
const EXPLODE_OFFSETS: Record<PartId, readonly [number, number, number]> = {
  body: [0, 0.3, 0],
  leftArm: [-0.32, 0.12, 0],
  rightArm: [0.32, 0.12, 0],
  lens: [0, -0.06, 0.55],
  ring1: [0, 0.45, 0],
  ring2: [0, -0.45, 0],
}

const SILVER = new THREE.Color(PRODUCT_THEME.silver)
const ORANGE = new THREE.Color(PRODUCT_THEME.accent)

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

export default function ProductZone({ zone }: { zone: ZoneConfig }) {
  // Montar ScrollControls en las 6 zonas sería romper la interacción de
  // todas las demás: su capa DOM tapa el canvas y secuestra los eventos.
  const isActive = useExperienceStore((s) => s.activeZone === PRODUCT_ZONE_INDEX)

  return (
    <group position={zone.position}>
      {/* Sin Environment propio: el global de Scene.tsx ya ilumina la escena.
          Montar otro `preset` aquí descargaba un HDR remoto extra y, peor,
          pisaba el cubemap global con luces de estudio que reventaban la
          plata a blanco puro. */}

      {/* Sombra de contacto suave. En táctil se congela (`frames=1`): el
          ahorro por frame pesa más que la sombra siguiendo el despiece. */}
      <ContactShadows
        position={[0, -0.9, 0]}
        opacity={0.35}
        scale={8}
        blur={2}
        far={10}
        frames={IS_TOUCH_FIRST ? 1 : undefined}
        resolution={CONTACT_SHADOW_RESOLUTION}
      />

      {/* Luz principal clave (key light) naranja sutil */}
      <directionalLight
        color={PRODUCT_THEME.accent}
        intensity={0.85}
        position={[5, 10, 7]}
        castShadow
      />
      <directionalLight color="#ffffff" intensity={0.5} position={[-5, 8, -5]} />
      <ambientLight color="#ffffff" intensity={0.25} />

      {isActive ? (
        <ScrollControls
          pages={SCROLL_SECTIONS.length}
          damping={0.2}
          style={{ scrollbarWidth: 'none', overscrollBehavior: 'contain' }}
        >
          <ScrollDrone />
        </ScrollControls>
      ) : (
        // Fuera de la zona el dron sigue montado con la pose de reposo: la
        // cámara tarda 1.8 s en irse y no queremos que el modelo parpadee.
        <DroneRig scroll={null} />
      )}
    </group>
  )
}

/** Puente mínimo: useScroll sólo puede llamarse dentro de ScrollControls. */
function ScrollDrone() {
  const scroll = useScroll()
  return <DroneRig scroll={scroll} />
}

/**
 * Dron procedural + animación por scroll.
 *
 * `homePositions` guarda la posición de reposo de cada pieza en un ref (se
 * captura al montar). El despiece se calcula SIEMPRE desde esa base, nunca
 * acumulando sobre la posición del frame anterior.
 */
function DroneRig({ scroll }: { scroll: ScrollControlsState | null }) {
  const groupRef = useRef<THREE.Group>(null)
  const parts = useRef<Partial<Record<PartId, THREE.Group>>>({})
  const homePositions = useRef<Partial<Record<PartId, THREE.Vector3>>>({})
  const pageRef = useRef(0)

  // Un único material para el chasis: así el cambio plata→naranja es
  // consistente y se paga una sola actualización por frame.
  const shellMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PRODUCT_THEME.silver,
        // Aluminio cepillado, no espejo: con metalness alto el estudio
        // reventaba la plata a blanco puro y se perdía la silueta.
        metalness: 0.5,
        roughness: 0.4,
        emissive: PRODUCT_THEME.accent,
        emissiveIntensity: 0,
      }),
    [],
  )

  const lensMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#080808',
        metalness: 0.9,
        roughness: 0.1,
        emissive: PRODUCT_THEME.accent,
        emissiveIntensity: 0.6,
        toneMapped: false,
      }),
    [],
  )

  const shellColor = useMemo(
    () => new THREE.Color(PRODUCT_THEME.silver),
    [],
  )

  // El encuadre de la cámara ya se aleja en vertical, pero el despiece es
  // ancho: en teléfonos el dron se escala para que las aspas no se salgan.
  const aspect = useThree((s) => s.viewport.aspect)
  const fitScale = aspect < 0.8 ? 0.8 : aspect < 1.05 ? 0.9 : 1

  useEffect(() => {
    return () => {
      shellMaterial.dispose()
      lensMaterial.dispose()
    }
  }, [shellMaterial, lensMaterial])

  // Captura la pose de reposo real de cada grupo (no la configuración de
  // JSX): es la referencia contra la que se calcula el explode.
  useLayoutEffect(() => {
    for (const id of PART_IDS) {
      const node = parts.current[id]
      if (node) homePositions.current[id] = node.position.clone()
    }
  }, [])

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    const offset = scroll ? scroll.offset : 0
    const elapsed = state.clock.elapsedTime

    // Explode: sube en 0.25→0.5 y vuelve en 0.75→1. El multiplicador ×2
    // es el del brief (offset del vector * explode * 2).
    const explodeIn = clamp01((offset - 0.25) * 4)
    const reassemble = clamp01((offset - 0.75) * 4)
    const explode = explodeIn * (1 - reassemble)

    // 4 vueltas completas a lo largo del recorrido: una por página.
    group.rotation.y = offset * Math.PI * 2 * 4
    group.position.y = Math.sin(elapsed * 1.2) * 0.04

    for (const id of PART_IDS) {
      const node = parts.current[id]
      const home = homePositions.current[id]
      if (!node || !home) continue
      const spread = EXPLODE_OFFSETS[id]
      node.position.set(
        home.x + spread[0] * explode * 2,
        home.y + spread[1] * explode * 2,
        home.z + spread[2] * explode * 2,
      )
    }

    // Plata → naranja entre 0.5 y 0.75; vuelve a plata al reensamblar.
    const paint = clamp01((offset - 0.5) * 4) * (1 - reassemble)
    shellColor.lerpColors(SILVER, ORANGE, paint)
    shellMaterial.color.copy(shellColor)
    shellMaterial.emissiveIntensity = paint * 0.2

    // Latido tenue de la lente: mantiene vivo el modelo cuando está quieto.
    lensMaterial.emissiveIntensity = 0.55 + Math.sin(elapsed * 2.4) * 0.15

    if (!scroll) return

    // Puente para el HUD: offset continuo + página activa discreta.
    // El sesgo evita que el damping se quede en 0.49999 justo en un borde
    // y el texto no cambie nunca (la página se calcula con floor).
    productScroll.offset = offset
    const pageCount = SCROLL_SECTIONS.length
    const page = Math.min(pageCount - 1, Math.floor(offset * pageCount + 0.002))
    if (page !== pageRef.current) {
      pageRef.current = page
      useExperienceStore.getState().setProductPhase(page)
    }
  })

  const register = (id: PartId) => (node: THREE.Group | null) => {
    if (node) parts.current[id] = node
    else delete parts.current[id]
  }

  return (
    <group ref={groupRef} scale={fitScale}>
      {/* BODY — chasis principal */}
      <group ref={register('body')} position={[0, 0, 0]}>
        <mesh material={shellMaterial} castShadow receiveShadow>
          <cylinderGeometry args={[0.78, 0.92, 0.46, 48]} />
        </mesh>
        <mesh
          position={[0, 0.23, 0]}
          scale={[1, 0.26, 1]}
          material={shellMaterial}
          castShadow
        >
          <sphereGeometry args={[0.68, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
      </group>

      {/* LEFT ARM — brazo con pod emisivo en la punta */}
      <group ref={register('leftArm')} position={[-0.95, 0, 0]}>
        <mesh material={shellMaterial} castShadow receiveShadow>
          <boxGeometry args={[1.05, 0.11, 0.26]} />
        </mesh>
        <mesh position={[-0.42, 0.015, 0]} material={lensMaterial} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.09, 24]} />
        </mesh>
      </group>

      {/* RIGHT ARM */}
      <group ref={register('rightArm')} position={[0.95, 0, 0]}>
        <mesh material={shellMaterial} castShadow receiveShadow>
          <boxGeometry args={[1.05, 0.11, 0.26]} />
        </mesh>
        <mesh position={[0.42, 0.015, 0]} material={lensMaterial} castShadow>
          <cylinderGeometry args={[0.15, 0.18, 0.09, 24]} />
        </mesh>
      </group>

      {/* RING 1 / RING 2 — aros que abrazan el chasis por arriba y abajo */}
      <group ref={register('ring1')} position={[0, 0.32, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={shellMaterial} castShadow>
          <torusGeometry args={[1.32, 0.03, 10, 96]} />
        </mesh>
      </group>
      <group ref={register('ring2')} position={[0, -0.3, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} material={shellMaterial} castShadow>
          <torusGeometry args={[1.55, 0.022, 10, 120]} />
        </mesh>
      </group>

      {/* LENS — lente frontal con bisel metálico */}
      <group ref={register('lens')} position={[0, -0.02, 0.78]}>
        <mesh scale={[1, 1, 0.7]} material={lensMaterial} castShadow>
          <sphereGeometry args={[0.28, 32, 24]} />
        </mesh>
        <mesh position={[0, 0, 0.14]} material={shellMaterial} castShadow>
          <torusGeometry args={[0.27, 0.03, 8, 48]} />
        </mesh>
      </group>
    </group>
  )
}
