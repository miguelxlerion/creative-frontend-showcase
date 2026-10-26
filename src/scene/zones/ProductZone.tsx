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
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { CONTACT_SHADOW_RESOLUTION, IS_TOUCH_FIRST } from '../deviceQuality'
import { productScroll } from './productScroll'

/**
 * Zona 5 — "Product Configurator" (naranja eléctrico #ff5500)
 *
 * Cuadricóptero procedural de 13 módulos con scroll real de drei.
 * `ScrollControls` crea 4 páginas dentro del Canvas y `useScroll()` entrega un
 * offset continuo 0..1 que se mapea así:
 *
 *  0.00 → 0.25  Hero: rotación (4 vueltas a lo largo de todo el recorrido)
 *  0.25 → 0.50  Explode: los módulos se separan del centro
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

/**
 * Módulos del despiece. Cada arma incluye motor, aro y rotor: así el
 * "exploded view" se lee como un dron modular y no como piezas sueltas.
 */
const PART_IDS = [
  'hull',
  'canopy',
  'battery',
  'sensor',
  'antenna',
  'gimbal',
  'lens',
  'armFL',
  'armFR',
  'armRL',
  'armRR',
  'skidLeft',
  'skidRight',
] as const
type PartId = (typeof PART_IDS)[number]

const ROTOR_IDS = ['armFL', 'armFR', 'armRL', 'armRR'] as const
type RotorId = (typeof ROTOR_IDS)[number]

/**
 * Desplazamiento de despiece por módulo, en espacio local. useFrame lo
 * multiplica por `explode * 2`, así que éste es el de MEDIA explosión.
 */
const EXPLODE_OFFSETS: Record<PartId, readonly [number, number, number]> = {
  hull: [0, 0.04, 0],
  canopy: [0, 0.52, 0.02],
  battery: [0, 0.34, -0.3],
  sensor: [0, 0.4, 0.28],
  antenna: [0, 0.42, -0.3],
  gimbal: [0, -0.24, 0.26],
  lens: [0, -0.08, 0.85],
  armFL: [-0.5, 0.16, 0.5],
  armFR: [0.5, 0.16, 0.5],
  armRL: [-0.5, 0.16, -0.5],
  armRR: [0.5, 0.16, -0.5],
  skidLeft: [-0.45, -0.3, 0],
  skidRight: [0.45, -0.3, 0],
}

/**
 * Los cuatro brazos parten del motor hacia el casco: su origen es la posición
 * del motor y el boom se dibuja en -X local. El giro en Y orienta +X hacia
 * fuera en cada cuadrante.
 */
const ARMS: ReadonlyArray<{
  id: RotorId
  position: [number, number, number]
  yaw: number
}> = [
  { id: 'armFL', position: [-0.93, 0.04, 0.93], yaw: -Math.PI * 0.75 },
  { id: 'armFR', position: [0.93, 0.04, 0.93], yaw: -Math.PI * 0.25 },
  { id: 'armRL', position: [-0.93, 0.04, -0.93], yaw: Math.PI * 0.75 },
  { id: 'armRR', position: [0.93, 0.04, -0.93], yaw: Math.PI * 0.25 },
]

const BLADE_ANGLES = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3]
const STRUT_ANGLES = [Math.PI / 6, (Math.PI * 5) / 6, (Math.PI * 3) / 2]
const CANOPY_RIBS = [-0.16, 0.18]

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
 * `homePositions` guarda la posición de reposo de cada módulo en un ref (se
 * captura al montar). El despiece se calcula SIEMPRE desde esa base, nunca
 * acumulando sobre la posición del frame anterior.
 */
function DroneRig({ scroll }: { scroll: ScrollControlsState | null }) {
  const groupRef = useRef<THREE.Group>(null)
  const parts = useRef<Partial<Record<PartId, THREE.Group>>>({})
  const rotors = useRef<Partial<Record<RotorId, THREE.Group>>>({})
  const homePositions = useRef<Partial<Record<PartId, THREE.Vector3>>>({})
  const pageRef = useRef(0)
  // Movimiento reducido: el scroll sigue gobernando textos y página activa,
  // pero el dron no rota, no se despieza ni cambia de material. Es una pose
  // estática de hero para toda la interacción.
  const reducedMotion = useReducedMotion()

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

  // Grafito para motores, panza, gimbal y patines: separa los volúmenes y
  // evita que todo el dron sea una masa plateada sin lectura.
  const darkMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#171a21',
        metalness: 0.72,
        roughness: 0.3,
      }),
    [],
  )

  // Cúpula oscura y reflectante: el contraste con la plata define la cabina.
  const glassMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: '#090c12',
        metalness: 0.9,
        roughness: 0.08,
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
        emissiveIntensity: 1.1,
        toneMapped: false,
      }),
    [],
  )

  // Tiras, puntas de pala y luces de navegación. No se repinta con el scroll:
  // son el acento fijo que mantiene la identidad naranja del configurador.
  const accentMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: PRODUCT_THEME.accent,
        emissive: PRODUCT_THEME.accent,
        emissiveIntensity: 1.4,
        metalness: 0.3,
        roughness: 0.35,
        toneMapped: false,
      }),
    [],
  )

  const shellColor = useMemo(() => new THREE.Color(PRODUCT_THEME.silver), [])

  // El encuadre de la cámara ya se aleja en vertical, pero el despiece es
  // ancho: en teléfonos el dron se escala para que las aspas no se salgan.
  const aspect = useThree((s) => s.viewport.aspect)
  // En vertical el dron se reduce para que el despiece completo (aros y
  // rotores incluidos) entre con margen; 0.92 recortaba las aspas extremas.
  const fitScale = aspect < 0.8 ? 0.82 : aspect < 1.05 ? 0.9 : 1

  useEffect(() => {
    return () => {
      shellMaterial.dispose()
      darkMaterial.dispose()
      glassMaterial.dispose()
      lensMaterial.dispose()
      accentMaterial.dispose()
    }
  }, [shellMaterial, darkMaterial, glassMaterial, lensMaterial, accentMaterial])

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

    // Tour guiado: el scroll lo posee ScrollControls, así que el DOM sólo
    // puede moverlo escribiendo `scrollTop`. Se calcula con la altura real
    // del contenedor para no depender de cómo drei componga sus páginas.
    if (scroll) {
      const guidedStep = useExperienceStore.getState().guidedProductStep
      const el = scroll.el
      if (guidedStep !== null && el.isConnected) {
        const max = el.scrollHeight - el.clientHeight
        const target = (guidedStep / (SCROLL_SECTIONS.length - 1)) * max
        if (max > 0 && Math.abs(el.scrollTop - target) > 1) {
          el.scrollTop = target
        }
      }
    }

    const offset = scroll ? scroll.offset : 0
    const elapsed = state.clock.elapsedTime
    // El offset visual se anula con movimiento reducido; el offset real sigue
    // alimentando el HUD y la página activa más abajo.
    const visualOffset = reducedMotion ? 0 : offset

    // Explode: sube en 0.25→0.5 y vuelve en 0.75→1. El multiplicador ×2
    // es el del brief (offset del vector * explode * 2).
    const explodeIn = clamp01((visualOffset - 0.25) * 4)
    const reassemble = clamp01((visualOffset - 0.75) * 4)
    const explode = explodeIn * (1 - reassemble)

    // 4 vueltas completas a lo largo del recorrido: una por página.
    group.rotation.y = visualOffset * Math.PI * 2 * 4
    group.position.y = reducedMotion ? 0 : Math.sin(elapsed * 1.2) * 0.04

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

    // Rotores: giro constante en sentidos alternos (como un cuadricóptero
    // real). Con movimiento reducido quedan quietos en cruz.
    for (const id of ROTOR_IDS) {
      const rotor = rotors.current[id]
      if (!rotor) continue
      if (reducedMotion) {
        rotor.rotation.y = 0
        continue
      }
      const direction = id === 'armFL' || id === 'armRR' ? 1 : -1
      rotor.rotation.y = elapsed * 7.5 * direction
    }

    // Plata → naranja entre 0.5 y 0.75; vuelve a plata al reensamblar.
    const paint = clamp01((visualOffset - 0.5) * 4) * (1 - reassemble)
    shellColor.lerpColors(SILVER, ORANGE, paint)
    shellMaterial.color.copy(shellColor)
    shellMaterial.emissiveIntensity = paint * 0.2

    // Latido tenue de la lente: mantiene vivo el modelo cuando está quieto.
    lensMaterial.emissiveIntensity = reducedMotion
      ? 1.1
      : 1.0 + Math.sin(elapsed * 2.4) * 0.25

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

  const registerRotor = (id: RotorId) => (node: THREE.Group | null) => {
    if (node) rotors.current[id] = node
    else delete rotors.current[id]
  }

  return (
    <group ref={groupRef} scale={fitScale}>
      {/* HULL — casco central, panza, placas laterales y aviónica interior */}
      <group ref={register('hull')} position={[0, 0, 0]}>
        <mesh
          rotation={[Math.PI / 2, 0, 0]}
          scale={[1.05, 0.92, 0.62]}
          material={shellMaterial}
          castShadow
          receiveShadow
        >
          <capsuleGeometry args={[0.26, 0.62, 8, 24]} />
        </mesh>

        <mesh position={[0, -0.13, 0.02]} material={darkMaterial} castShadow>
          <boxGeometry args={[0.4, 0.09, 0.72]} />
        </mesh>

        {/* Placas laterales y tiras de acento */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              position={[side * 0.28, 0.02, 0]}
              material={shellMaterial}
              castShadow
            >
              <boxGeometry args={[0.022, 0.14, 0.52]} />
            </mesh>
            <mesh position={[side * 0.295, 0.03, 0.02]} material={accentMaterial}>
              <boxGeometry args={[0.012, 0.018, 0.42]} />
            </mesh>
          </group>
        ))}

        {/* Morro y rejilla trasera */}
        <mesh position={[0, 0.01, 0.5]} material={darkMaterial} castShadow>
          <boxGeometry args={[0.3, 0.1, 0.09]} />
        </mesh>
        <mesh position={[0, 0.02, -0.49]} material={darkMaterial} castShadow>
          <boxGeometry args={[0.32, 0.11, 0.07]} />
        </mesh>
        {[-0.035, 0, 0.035].map((y) => (
          <mesh key={y} position={[0, y + 0.02, -0.53]} material={shellMaterial}>
            <boxGeometry args={[0.27, 0.008, 0.018]} />
          </mesh>
        ))}

        {/* Aviónica: queda oculta bajo la cúpula y se descubre al despiezar */}
        <mesh position={[0, 0.16, 0]} material={darkMaterial}>
          <boxGeometry args={[0.36, 0.022, 0.56]} />
        </mesh>
        {[
          [-0.1, 0.184, -0.12, 0.1],
          [0.02, 0.184, 0.04, 0.12],
          [0.12, 0.184, -0.08, 0.08],
        ].map(([x, y, z, size]) => (
          <mesh key={`${x}-${z}`} position={[x, y, z]} material={darkMaterial}>
            <boxGeometry args={[size, 0.018, size * 0.8]} />
          </mesh>
        ))}
        {[
          [-0.1, 0.196, -0.12],
          [0.02, 0.196, 0.1],
          [0.14, 0.196, 0.02],
        ].map(([x, y, z]) => (
          <mesh key={`led-${x}-${z}`} position={[x, y, z]} material={accentMaterial}>
            <boxGeometry args={[0.018, 0.008, 0.018]} />
          </mesh>
        ))}
      </group>

      {/* CANOPY — cúpula de cristal con costillas y espina */}
      <group ref={register('canopy')} position={[0, 0.15, 0.12]}>
        <mesh scale={[1, 0.62, 1.2]} material={glassMaterial} castShadow>
          <sphereGeometry args={[0.28, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          scale={[1, 1.2, 1]}
          material={shellMaterial}
        >
          <torusGeometry args={[0.275, 0.012, 8, 48]} />
        </mesh>
        <mesh position={[0, 0.17, 0]} material={shellMaterial} castShadow>
          <boxGeometry args={[0.03, 0.018, 0.58]} />
        </mesh>
        {CANOPY_RIBS.map((z) => (
          <mesh
            key={z}
            position={[0, 0.14, z]}
            rotation={[0.18, 0, 0]}
            material={shellMaterial}
          >
            <boxGeometry args={[0.42, 0.012, 0.026]} />
          </mesh>
        ))}
      </group>

      {/* BATTERY — pack trasero con abrazaderas y tira naranja */}
      <group ref={register('battery')} position={[0, 0.22, -0.36]}>
        <mesh position={[0, -0.06, 0]} material={darkMaterial} castShadow>
          <boxGeometry args={[0.4, 0.03, 0.3]} />
        </mesh>
        <mesh material={shellMaterial} castShadow receiveShadow>
          <boxGeometry args={[0.34, 0.11, 0.24]} />
        </mesh>
        <mesh position={[0, 0.058, 0.01]} material={accentMaterial}>
          <boxGeometry args={[0.3, 0.008, 0.06]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.165, 0, 0]}
            material={darkMaterial}
          >
            <boxGeometry args={[0.022, 0.12, 0.22]} />
          </mesh>
        ))}
      </group>

      {/* SENSOR — LiDAR y dos cámaras frontales en el morro */}
      <group ref={register('sensor')} position={[0, 0.14, 0.42]}>
        <mesh position={[0, 0.03, 0]} scale={[1, 0.7, 1]} material={darkMaterial}>
          <sphereGeometry args={[0.06, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} material={accentMaterial}>
          <torusGeometry args={[0.062, 0.008, 6, 24]} />
        </mesh>
        {[-1, 1].map((side) => (
          <group key={side} position={[side * 0.11, -0.03, 0.03]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={darkMaterial}>
              <cylinderGeometry args={[0.028, 0.028, 0.07, 16]} />
            </mesh>
            <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} material={lensMaterial}>
              <cylinderGeometry args={[0.017, 0.017, 0.008, 12]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* ANTENNA — mástil trasero con punta emisiva y aleta */}
      <group ref={register('antenna')} position={[0, 0.17, -0.5]}>
        <mesh material={darkMaterial}>
          <cylinderGeometry args={[0.025, 0.03, 0.05, 12]} />
        </mesh>
        <mesh position={[0, 0.16, -0.03]} rotation={[-0.28, 0, 0]} material={darkMaterial}>
          <cylinderGeometry args={[0.008, 0.008, 0.3, 8]} />
        </mesh>
        <mesh position={[0, 0.315, -0.075]} material={accentMaterial}>
          <sphereGeometry args={[0.02, 10, 8]} />
        </mesh>
        <mesh position={[0.1, 0.08, 0]} material={shellMaterial}>
          <boxGeometry args={[0.02, 0.14, 0.05]} />
        </mesh>
      </group>

      {/* GIMBAL — suspensión de la cámara bajo el morro */}
      <group ref={register('gimbal')} position={[0, -0.17, 0.3]}>
        <mesh material={darkMaterial} castShadow>
          <boxGeometry args={[0.16, 0.08, 0.16]} />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, -0.055, 0]} material={shellMaterial}>
          <torusGeometry args={[0.1, 0.01, 8, 32]} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh
            key={side}
            position={[side * 0.085, -0.1, 0]}
            material={darkMaterial}
            castShadow
          >
            <boxGeometry args={[0.018, 0.09, 0.07]} />
          </mesh>
        ))}
        <mesh position={[0, -0.17, 0]} material={darkMaterial} castShadow>
          <boxGeometry args={[0.16, 0.14, 0.14]} />
        </mesh>
        <mesh position={[0.085, -0.17, 0.04]} material={accentMaterial}>
          <boxGeometry args={[0.006, 0.03, 0.03]} />
        </mesh>
      </group>

      {/* LENS — barril y cristal frontal */}
      <group ref={register('lens')} position={[0, -0.34, 0.38]}>
        <mesh position={[0, 0, -0.02]} rotation={[Math.PI / 2, 0, 0]} material={darkMaterial} castShadow>
          <cylinderGeometry args={[0.075, 0.082, 0.1, 24]} />
        </mesh>
        <mesh position={[0, 0, 0.035]} material={shellMaterial}>
          <torusGeometry args={[0.077, 0.011, 8, 32]} />
        </mesh>
        <mesh position={[0, 0, 0.042]} rotation={[Math.PI / 2, 0, 0]} material={lensMaterial}>
          <cylinderGeometry args={[0.062, 0.062, 0.008, 24]} />
        </mesh>
        <mesh position={[0, 0, 0.049]} material={darkMaterial}>
          <torusGeometry args={[0.045, 0.005, 6, 24]} />
        </mesh>
      </group>

      {/* ARMS — cuatro módulos: boom, motor, aro, rotor y luz */}
      {ARMS.map((arm) => (
        <DroneArm
          key={arm.id}
          position={arm.position}
          yaw={arm.yaw}
          shell={shellMaterial}
          dark={darkMaterial}
          accent={accentMaterial}
          register={register(arm.id)}
          registerRotor={registerRotor(arm.id)}
        />
      ))}

      {/* SKIDS — patines de aterrizaje con soportes */}
      {(['skidLeft', 'skidRight'] as const).map((id) => {
        const side = id === 'skidLeft' ? -1 : 1
        return (
          <group key={id} ref={register(id)} position={[side * 0.34, -0.34, 0]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} material={darkMaterial} castShadow>
              <capsuleGeometry args={[0.026, 0.72, 4, 10]} />
            </mesh>
            {[-0.24, 0.24].map((z) => (
              <mesh key={z} position={[0, 0.13, z]} material={darkMaterial} castShadow>
                <boxGeometry args={[0.04, 0.22, 0.04]} />
              </mesh>
            ))}
            <mesh position={[0, 0, 0.38]} material={accentMaterial}>
              <sphereGeometry args={[0.03, 10, 8]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

interface DroneArmProps {
  position: [number, number, number]
  yaw: number
  shell: THREE.Material
  dark: THREE.Material
  accent: THREE.Material
  register: (node: THREE.Group | null) => void
  registerRotor: (node: THREE.Group | null) => void
}

function DroneArm({
  position,
  yaw,
  shell,
  dark,
  accent,
  register,
  registerRotor,
}: DroneArmProps) {
  return (
    <group ref={register} position={position} rotation={[0, yaw, 0]}>
      {/* Boom que entra en el casco */}
      <mesh position={[-0.44, 0, 0]} material={shell} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.055, 0.1]} />
      </mesh>
      <mesh position={[-0.44, 0.032, 0]} material={accent}>
        <boxGeometry args={[0.72, 0.008, 0.016]} />
      </mesh>

      {/* Nacela del motor */}
      <mesh position={[0, 0.035, 0]} material={dark} castShadow>
        <cylinderGeometry args={[0.1, 0.135, 0.1, 24]} />
      </mesh>
      <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]} material={accent}>
        <torusGeometry args={[0.115, 0.012, 8, 32]} />
      </mesh>

      {/* Aro de protección y sus tres soportes */}
      <mesh
        position={[0, 0.1, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        material={shell}
        castShadow
      >
        <torusGeometry args={[0.42, 0.016, 8, 64]} />
      </mesh>
      {STRUT_ANGLES.map((angle) => (
        <group key={angle} rotation={[0, angle, 0]}>
          <mesh position={[0.21, 0.1, 0]} material={shell}>
            <boxGeometry args={[0.4, 0.012, 0.022]} />
          </mesh>
        </group>
      ))}

      {/* Rotor de tres palas con punta naranja */}
      <group ref={registerRotor} position={[0, 0.135, 0]}>
        <mesh material={dark} castShadow>
          <cylinderGeometry args={[0.05, 0.06, 0.05, 16]} />
        </mesh>
        {BLADE_ANGLES.map((angle) => (
          <group key={angle} rotation={[0, angle, 0]}>
            <mesh position={[0.2, 0, 0]} material={dark} castShadow>
              <boxGeometry args={[0.36, 0.012, 0.062]} />
            </mesh>
            <mesh position={[0.375, 0, 0]} material={accent}>
              <boxGeometry args={[0.055, 0.014, 0.062]} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Luz de navegación sobre el aro */}
      <mesh position={[0.42, 0.1, 0]} material={accent}>
        <sphereGeometry args={[0.026, 12, 8]} />
      </mesh>
    </group>
  )
}
