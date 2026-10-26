import { Suspense, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'
import { ZONES } from '../../config/zones'
import { useReducedMotion } from '../../hooks/useReducedMotion'
import { useExperienceStore } from '../../store/useExperienceStore'

/**
 * Zona 1 — Testing & QA (verde #00ff88)
 *
 * El laboratorio es un GLB de Blender (mesa + material de vidrio) en lugar de
 * geometría procedural. El archivo incluye un fondo de estudio enorme que no
 * pertenece a la pieza: se elimina por nombre al clonar la escena.
 *
 * El modelo sólo se monta cuando la zona está activa. Son ~259k triángulos y
 * 6,4 MB: cargarlo al arrancar la intro retrasaría el primer render de todas
 * las zonas sin necesidad. Al salir se desmonta (drei conserva el GLB en
 * caché), así que volver es instantáneo.
 */

const LAB_URL = '/models/lab.glb'
const TESTING_INDEX = ZONES.findIndex((zone) => zone.id === 'testing')
/** Suelo-rejilla global. La base de la mesa se apoya aquí. */
const FLOOR_Y = -1.9
/** Ancho final del laboratorio en unidades de escena (dentro del aro de zona). */
const LAB_WIDTH = 3.8
/** Nodo del fondo de estudio del Blender original; no forma parte del lab. */
const BACKDROP_NODE = 'Plane'

interface LiquidMaterial {
  material: THREE.MeshStandardMaterial
  phase: number
}

/**
 * Materiales del GLB adaptados al look de la zona:
 * - El vidrio del export es opaco; aquí se vuelve transparente.
 * - Los líquidos conservan su color autorado, pero emiten para que el bloom
 *   los encienda como el resto de neones del portfolio.
 * - Metal y plástico se ajustan para que el Environment los lea.
 */
function tuneMaterials(root: THREE.Object3D): LiquidMaterial[] {
  const liquids: LiquidMaterial[] = []
  const seen = new Set<THREE.Material>()

  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = false
    object.receiveShadow = false

    const materials = Array.isArray(object.material)
      ? object.material
      : [object.material]

    for (const material of materials) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue
      if (seen.has(material)) continue
      seen.add(material)

      switch (material.name) {
        case 'Glass':
          material.transparent = true
          material.opacity = 0.28
          material.depthWrite = false
          material.roughness = 0.05
          material.metalness = 0
          material.side = THREE.DoubleSide
          break
        case 'Stainless':
          material.metalness = 0.9
          material.roughness = 0.24
          break
        case 'Plastic':
        case 'Plastic2':
          material.metalness = 0.1
          material.roughness = 0.42
          break
        case 'Ceramic':
          material.color.set('#b8c4be')
          material.metalness = 0
          material.roughness = 0.18
          break
        case 'Wood':
          // El GLB sólo trae el AO como textura de color: sin tinte, la mesa
          // sale blanca y se come el encuadre. Oscurecerla deja el foco en
          // el material de vidrio.
          material.color.set('#16241f')
          material.metalness = 0.15
          material.roughness = 0.55
          break
        default:
          if (material.name.startsWith('Liquid')) {
            material.emissive.copy(material.color)
            material.emissiveIntensity = 0.4
            material.metalness = 0.05
            material.roughness = 0.28
            liquids.push({
              material,
              phase: liquids.length * 0.85,
            })
          }
      }

      material.needsUpdate = true
    }
  })

  return liquids
}

function LabModel() {
  const { scene } = useGLTF(LAB_URL, false)
  const reducedMotion = useReducedMotion()
  const liquids = useRef<LiquidMaterial[]>([])

  const model = useMemo(() => {
    // Clonar conserva geometrías/materiales compartidos y evita ensuciar el
    // objeto cacheado por drei si el componente se vuelve a montar.
    const clone = scene.clone(true)
    clone.getObjectByName(BACKDROP_NODE)?.removeFromParent()
    liquids.current = tuneMaterials(clone)

    // Centrar la huella y apoyar la base en el suelo. La escala sale del
    // ancho real del GLB, así el encuadre no depende de números de Blender.
    clone.updateMatrixWorld(true)
    const box = new THREE.Box3().setFromObject(clone)
    const size = box.getSize(new THREE.Vector3())
    const center = box.getCenter(new THREE.Vector3())
    const scale = LAB_WIDTH / Math.max(size.x, 0.001)

    clone.scale.setScalar(scale)
    clone.position.set(
      -center.x * scale,
      FLOOR_Y - box.min.y * scale,
      -center.z * scale,
    )
    clone.updateMatrixWorld(true)

    return clone
  }, [scene])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    for (const { material, phase } of liquids.current) {
      material.emissiveIntensity = reducedMotion
        ? 0.4
        : 0.38 + Math.sin(t * 1.6 + phase) * 0.14
    }
  })

  return <primitive object={model} />
}

export default function TestingZone({ zone }: { zone: ZoneConfig }) {
  const isActive = useExperienceStore((s) => s.activeZone === TESTING_INDEX)

  return (
    <group position={zone.position}>
      {/* Aro de identidad de la zona, como en el resto de secciones. */}
      <mesh position={[0, FLOOR_Y + 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[2.9, 0.05, 12, 48]} />
        <meshBasicMaterial
          color={zone.accent}
          transparent
          opacity={0.3}
          blending={THREE.AdditiveBlending}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Luz neón local: tiñe el laboratorio sin afectar a otras zonas. */}
      <pointLight
        color={zone.accent}
        intensity={6}
        distance={12}
        decay={2}
        position={[0, 1.2, 1.6]}
      />
      {/* Relleno frío para que el metal y el vidrio tengan reflejos legibles. */}
      <pointLight
        color="#d8fff0"
        intensity={2.5}
        distance={8}
        decay={2}
        position={[-1.6, 2.2, 1.8]}
      />

      {isActive && (
        <Suspense fallback={null}>
          <LabModel />
        </Suspense>
      )}
    </group>
  )
}
