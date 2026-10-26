import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { Html, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'
import {
  CREATIVE_FOCUS_YAW,
  CREATIVE_MODEL_BASE_Y,
  CREATIVE_MODEL_HEIGHT,
  CREATIVE_OBJECTS,
  CREATIVE_ZONE_INDEX,
  isCreativeObjectId,
} from '../../config/creativeLayout'
import type { CreativeObjectId } from '../../config/creativeLayout'
import { useExperienceStore } from '../../store/useExperienceStore'
import { getSubSectionContent } from '../../data/portfolioContent'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/** Acento frío secundario (cian) para contrastar con el rojo/magenta de la zona. */
const CYAN = '#00f0ff'

/** Separación del pin respecto al borde superior de la pieza. */
const PIN_LIFT = 0.42

const MODEL_URL = '/models/creative.glb'

/**
 * El GLB viene normalizado desde `models/Creative.glb`:
 * 4.4 × 2.77 × 4.4, centrado en XZ y con la base en y = 0.
 * Aquí sólo se apoya sobre el suelo local de la zona.
 */
const MODEL_BASE_Y = CREATIVE_MODEL_BASE_Y
const MODEL_HEIGHT = CREATIVE_MODEL_HEIGHT
const MODEL_CENTER_Y = MODEL_BASE_Y + MODEL_HEIGHT / 2

/** Giro de vitrina: una vuelta completa tarda ~70 s. */
const TURNTABLE_SPEED = 0.09
const FLOAT_AMPLITUDE = 0.035
const FLOAT_SPEED = 0.55
const TICK_COUNT = 40
const TICK_RADIUS = 3.16

/**
 * Zone 3 — Creative 3D (acento rojo/magenta #ff0055)
 * "MODELADO 3D + DATOS".
 *
 * El diorama industrial es el protagonista: un GLB de 1.808 piezas que se
 * optimizó a 45 InstancedMesh (EXT_mesh_gpu_instancing) y 600 KB. Se monta
 * en una vitrina holográfica: base de rejilla, dos aros neón y ticks de datos
 * orbitando, con luces de acento para integrarlo en la paleta de la escena.
 *
 * El GLB se carga en cuanto la zona se visita por primera vez y se queda
 * montado al salir: así el vuelo de salida no lo hace desaparecer de golpe
 * (el laboratorio de Testing sí puede desmontarse porque su vuelo arranca
 * desde otra posición; aquí el diorama ocupa todo el encuadre).
 */
export default function CreativeZone({ zone }: { zone: ZoneConfig }) {
  const activeZone = useExperienceStore((s) => s.activeZone)
  const [armed, setArmed] = useState(false)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (activeZone === CREATIVE_ZONE_INDEX) setArmed(true)
  }, [activeZone])

  // Ticks de datos sobre el aro: un único draw call.
  const tickPositions = useMemo(() => {
    const positions = new Float32Array(TICK_COUNT * 3)
    for (let i = 0; i < TICK_COUNT; i++) {
      const angle = (i / TICK_COUNT) * Math.PI * 2
      const radius = TICK_RADIUS + (i % 2 === 0 ? 0.05 : -0.05)
      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = 0
      positions[i * 3 + 2] = Math.sin(angle) * radius
    }
    return positions
  }, [])

  return (
    <group position={zone.position}>
      {/* Vitrina: rejilla y aros quedan fijos; el diorama flota por encima. */}
      <gridHelper args={[6.4, 16, zone.accent, '#441122']} position={[0, -1.4, 0]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.37, 0]}>
        <ringGeometry args={[2.72, 3.28, 96]} />
        <meshBasicMaterial
          color={zone.accent}
          transparent
          opacity={0.12}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.36, 0]}>
        <torusGeometry args={[3.16, 0.018, 8, 128]} />
        <meshBasicMaterial
          color={zone.accent}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.36, 0]}>
        <torusGeometry args={[2.76, 0.012, 8, 128]} />
        <meshBasicMaterial
          color={CYAN}
          transparent
          opacity={0.35}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      <DataTicks positions={tickPositions} accent={zone.accent} reducedMotion={reducedMotion} />

      <Suspense fallback={<LoadingCage accent={zone.accent} />}>
        {armed && (
          <Diorama
            accent={zone.accent}
            accentText={zone.accentText}
            reducedMotion={reducedMotion}
          />
        )}
      </Suspense>

      {/* Luces locales suaves: rim rojo delante y relleno cian detrás. Con
          intensidades altas la base verde se iba a amarillo y el ACES perdía
          el detalle de fachada; el Environment ya pone la luz base. */}
      <pointLight position={[-3.2, 2.6, 3.4]} color={zone.accent} intensity={3.5} distance={12} decay={2} />
      <pointLight position={[3.4, 1.4, -2.8]} color={CYAN} intensity={1.8} distance={10} decay={2} />
    </group>
  )
}

/**
 * El GLB ya está instanciado (45 InstancedMesh). Se renderiza directamente
 * desde la caché de drei; sólo se ajusta el envMap de sus materiales.
 *
 * Interacción: el GLB no trae nombres semánticos (1.808 nodos optimizados a
 * mallas instanciadas), así que el camión, los tanques y el edificio se
 * seleccionan con cajas proxy invisibles, alineadas con sus AABB reales en
 * coordenadas del modelo. La caja no oculta nada: sólo captura el puntero.
 */
function Diorama({
  accent,
  accentText,
  reducedMotion,
}: {
  accent: string
  accentText: string
  reducedMotion: boolean
}) {
  const { scene } = useGLTF(MODEL_URL, false)
  const environment = useThree((s) => s.scene.environment)
  const modelRef = useRef<THREE.Group>(null)
  const angleRef = useRef(0)

  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)
  const setOpenDropdown = useExperienceStore((s) => s.setOpenDropdown)
  const setSceneHover = useExperienceStore((s) => s.setSceneHover)

  const [hovered, setHovered] = useState<CreativeObjectId | null>(null)
  const focused = isCreativeObjectId(activeSubSection) ? activeSubSection : null

  // Las etiquetas de los pines salen de `portfolioContent`; no duplicamos copy.
  const pinLabels = useMemo(() => {
    const labels = new Map<CreativeObjectId, string>()
    for (const object of CREATIVE_OBJECTS) {
      labels.set(
        object.id,
        getSubSectionContent(CREATIVE_ZONE_INDEX, object.id)?.label ?? object.id,
      )
    }
    return labels
  }, [])

  // El Environment global da mucha irradiancia difusa: el verde de la base
  // se iba a amarillo y el ACES perdía el detalle de las fachadas.
  // ⚠️ Con envMap null, three r169 pisa envMapIntensity con
  // scene.environmentIntensity; hay que darle el cubemap como envMap propio
  // para que la intensidad se respete (mismo gotcha que en CityZone).
  useEffect(() => {
    if (!environment) return
    scene.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const material of materials) {
        if (material instanceof THREE.MeshStandardMaterial) {
          material.envMap = environment
          material.envMapIntensity = 0.55
          material.needsUpdate = true
        }
      }
    })
  }, [scene, environment])

  // Salir de la zona o cerrar la ficha no dispara pointerOut: el cursor
  // ambiental se quedaría encendido sobre una escena que ya no se ve.
  useEffect(() => {
    setHovered(null)
    setSceneHover(false)
  }, [activeZone, activeSubSection, setSceneHover])

  useEffect(() => () => setSceneHover(false), [setSceneHover])

  useFrame((state, delta) => {
    const model = modelRef.current
    if (!model) return

    const dt = Math.min(delta, 0.1)

    if (reducedMotion) {
      angleRef.current = CREATIVE_FOCUS_YAW
      model.rotation.y = CREATIVE_FOCUS_YAW
      model.position.y = MODEL_BASE_Y
      return
    }

    if (focused) {
      // Se normaliza el ángulo antes de frenar: `damp` hacia 0 desde, por
      // ejemplo, 6.1 rad daría casi una vuelta completa en sentido contrario.
      const wrapped = Math.atan2(Math.sin(angleRef.current), Math.cos(angleRef.current))
      angleRef.current =
        Math.abs(wrapped) < 0.002
          ? CREATIVE_FOCUS_YAW
          : THREE.MathUtils.damp(wrapped, CREATIVE_FOCUS_YAW, 4.5, dt)
    } else {
      angleRef.current += dt * TURNTABLE_SPEED
      if (Math.abs(angleRef.current) > Math.PI * 2) angleRef.current -= Math.PI * 2
    }

    model.rotation.y = angleRef.current
    model.position.y =
      MODEL_BASE_Y + Math.sin(state.clock.elapsedTime * FLOAT_SPEED) * FLOAT_AMPLITUDE
  })

  const handleOver = (id: CreativeObjectId) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHovered(id)
    setSceneHover(true)
  }

  const handleOut = (id: CreativeObjectId) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHovered((current) => (current === id ? null : current))
    setSceneHover(false)
  }

  const handleClick = (id: CreativeObjectId) => (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation()
    selectObject(id)
  }

  const selectObject = (id: CreativeObjectId) => {
    setActiveSubSection(activeSubSection === id ? null : id)
    // La ficha (z-65) no debe quedar debajo del menú de pestañas (z-80).
    setOpenDropdown(-1)
  }

  const hoverObject = (id: CreativeObjectId, over: boolean) => {
    setHovered((current) => (over ? id : current === id ? null : current))
    setSceneHover(over)
  }

  return (
    <group ref={modelRef} position={[0, MODEL_BASE_Y, 0]}>
      <primitive object={scene} />

      {CREATIVE_OBJECTS.map((object) => {
        const isFocused = focused === object.id
        const isHovered = hovered === object.id
        return (
          <group key={object.id} position={object.position}>
            <mesh
              onPointerOver={handleOver(object.id)}
              onPointerOut={handleOut(object.id)}
              onClick={handleClick(object.id)}
            >
              <boxGeometry args={object.size} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>

            {/* Caja de selección de editor 3D: sólo aparece al apuntar o al
                inspeccionar, reforzando qué pieza está activa. */}
            {(isHovered || isFocused) && (
              <mesh>
                <boxGeometry args={object.size} />
                <meshBasicMaterial
                  color={isFocused ? accent : CYAN}
                  wireframe
                  transparent
                  opacity={isFocused ? 0.55 : 0.3}
                  depthWrite={false}
                  toneMapped={false}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )}
          </group>
        )
      })}

      {/* Los proxies se solapan en pantalla (el edificio tapa el camión desde
          el plano general) y el raycast siempre elige el más cercano. Estos
          pines son DOM anclados al mundo 3D: siguen a su pieza al girar la
          tornamesa, pero el clic no compite con ninguna caja. */}
      {activeZone === CREATIVE_ZONE_INDEX &&
        CREATIVE_OBJECTS.map((object) => {
          const isFocused = focused === object.id
          return (
            <Html
              key={`pin-${object.id}`}
              position={[
                object.position[0],
                object.position[1] + object.size[1] / 2 + PIN_LIFT,
                object.position[2],
              ]}
              center
              zIndexRange={[60, 0]}
            >
              <button
                type="button"
                className={`creative-hotspot${isFocused ? ' is-active' : ''}`}
                style={{ '--pin-accent': accentText } as CSSProperties}
                aria-pressed={isFocused}
                aria-label={pinLabels.get(object.id)}
                onClick={(event) => {
                  event.stopPropagation()
                  selectObject(object.id)
                }}
                onPointerEnter={() => hoverObject(object.id, true)}
                onPointerLeave={() => hoverObject(object.id, false)}
                onFocus={() => hoverObject(object.id, true)}
                onBlur={() => hoverObject(object.id, false)}
              >
                <span className="creative-hotspot-dot" aria-hidden="true" />
                <span className="creative-hotspot-label">{pinLabels.get(object.id)}</span>
              </button>
            </Html>
          )
        })}
    </group>
  )
}

/** Fallback mientras llega el GLB: caja de selección de editor 3D. */
function LoadingCage({ accent }: { accent: string }) {
  return (
    <mesh position={[0, MODEL_CENTER_Y, 0]}>
      <boxGeometry args={[4.4, MODEL_HEIGHT, 4.4]} />
      <meshBasicMaterial
        color={accent}
        wireframe
        transparent
        opacity={0.18}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  )
}

function DataTicks({
  positions,
  accent,
  reducedMotion,
}: {
  positions: Float32Array
  accent: string
  reducedMotion: boolean
}) {
  const ticksRef = useRef<THREE.Points>(null)

  useFrame((state) => {
    if (!ticksRef.current || reducedMotion) return
    ticksRef.current.rotation.y = state.clock.elapsedTime * 0.22
  })

  return (
    <points ref={ticksRef} position={[0, -1.35, 0]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={accent}
        size={0.07}
        sizeAttenuation
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}
