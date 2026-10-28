import { useEffect, useMemo, useRef } from 'react'
import { Billboard, Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vector3Tuple } from 'three'
import { useExperienceStore } from '../store/useExperienceStore'
import { ZONES } from '../config/zones'
import {
  AI_EDITOR_POS,
  AI_TOOL_POSITIONS,
  aiPipelineScale,
} from '../config/aiWorkflowLayout'
import { CITY_GROUND_Y, CITY_LAYOUT } from '../config/cityLayout'
import { CREATIVE_MODEL_BASE_Y } from '../config/creativeLayout'
import { GUIDE_CITY_BUILDING_ID, GUIDE_STEPS } from '../config/guideSteps'
import { useReducedMotion } from '../hooks/useReducedMotion'

/**
 * Anillos de foco del modo guiado.
 *
 * Son mallas aditivas (Bloom las convierte en neón) y no dependen del DOM:
 *  - halo billboard = aro que mira siempre a cámara,
 *  - anillo de suelo = aro horizontal que ancla el objeto a la rejilla,
 *  - jaula del edificio = caja wireframe del paso 5,
 *  - escudo del paso 2 = contorno + check que laten.
 *
 * Todo se deriva de la configuración de pasos y de los layouts compartidos:
 * el anillo del edificio y la cámara isométrica miran las mismas coordenadas.
 */
export default function GuideHighlights() {
  const isActive = useExperienceStore((s) => s.isGuideModeActive)
  const currentStep = useExperienceStore((s) => s.currentGuideStep)
  const complete = useExperienceStore((s) => s.guideComplete)
  const selectedBuilding = useExperienceStore((s) => s.selectedBuilding)
  const reducedMotion = useReducedMotion()
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))

  const step = GUIDE_STEPS[currentStep]
  if (!isActive || complete || !step) return null

  const accent = ZONES[step.zoneIndex]?.accent ?? '#00f0ff'

  if (step.highlight === 'architecture') {
    return (
      <group>
        <Halo position={[0, 0.06, 0]} radius={1.55} color={accent} reducedMotion={reducedMotion} />
        <Halo
          position={[0, 0.06, 0]}
          radius={1.92}
          color={accent}
          thickness={0.018}
          reducedMotion={reducedMotion}
        />
        <GroundRing
          position={[0, -1.86, 0]}
          radius={1.9}
          color={accent}
          reducedMotion={reducedMotion}
        />
      </group>
    )
  }

  if (step.highlight === 'testing') {
    return (
      <group position={ZONES[1].position}>
        <Halo position={[0, -0.2, 0]} radius={2.15} color={accent} reducedMotion={reducedMotion} />
        <GroundRing
          position={[0, -1.85, 0]}
          radius={2.35}
          color={accent}
          reducedMotion={reducedMotion}
        />
        {/* y=1.2: con y=1.55 el borde superior del escudo se salía del
            viewport en el plano del paso 2 (1052×785). */}
        <ShieldCheck3D
          position={[0, 1.2, 0.35]}
          color={accent}
          reducedMotion={reducedMotion}
        />
      </group>
    )
  }

  if (step.highlight === 'ai') {
    const scale = aiPipelineScale(aspect)
    return (
      <group position={ZONES[2].position} scale={scale}>
        <Halo
          position={[0, -0.1, 0]}
          radius={3.9}
          color={accent}
          thickness={0.035}
          reducedMotion={reducedMotion}
        />
        <GroundRing
          position={[0, -1.85, 0]}
          radius={3.6}
          color={accent}
          reducedMotion={reducedMotion}
        />
        <Halo
          position={AI_EDITOR_POS}
          radius={0.78}
          color={accent}
          thickness={0.028}
          reducedMotion={reducedMotion}
        />
        <Halo
          position={AI_TOOL_POSITIONS.cursor}
          radius={0.54}
          color={accent}
          thickness={0.025}
          reducedMotion={reducedMotion}
        />
        <Halo
          position={AI_TOOL_POSITIONS.rag}
          radius={0.6}
          color={accent}
          thickness={0.025}
          reducedMotion={reducedMotion}
        />

        {/* Etiquetas ancladas a los tres nodos. `zIndexRange` las deja por
            encima del backdrop (z-60) y por debajo de la ficha (z-86). */}
        <Html
          wrapperClass="guide-node-tag-wrap"
          position={[AI_EDITOR_POS[0], AI_EDITOR_POS[1] + 1.02, AI_EDITOR_POS[2]]}
          center
          zIndexRange={[84, 62]}
        >
          <span className="guide-node-tag">COPILOT</span>
        </Html>
        <Html
          wrapperClass="guide-node-tag-wrap"
          position={[
            AI_TOOL_POSITIONS.cursor[0],
            AI_TOOL_POSITIONS.cursor[1] + 0.72,
            AI_TOOL_POSITIONS.cursor[2],
          ]}
          center
          zIndexRange={[84, 62]}
        >
          <span className="guide-node-tag">CURSOR</span>
        </Html>
        <Html
          wrapperClass="guide-node-tag-wrap"
          position={[
            AI_TOOL_POSITIONS.rag[0],
            AI_TOOL_POSITIONS.rag[1] + 0.7,
            AI_TOOL_POSITIONS.rag[2],
          ]}
          center
          zIndexRange={[84, 62]}
        >
          <span className="guide-node-tag">RAG</span>
        </Html>
      </group>
    )
  }

  if (step.highlight === 'creative') {
    return (
      <group position={ZONES[3].position}>
        <Halo position={[0, 0.08, 0]} radius={2.78} color={accent} reducedMotion={reducedMotion} />
        <GroundRing
          position={[0, CREATIVE_MODEL_BASE_Y + 0.03, 0]}
          radius={2.45}
          color={accent}
          reducedMotion={reducedMotion}
        />
      </group>
    )
  }

  if (step.highlight === 'city') {
    const buildingId = selectedBuilding?.id ?? GUIDE_CITY_BUILDING_ID
    const building = CITY_LAYOUT[buildingId]
    if (!building) return null

    const size = Math.max(building.w, building.d)
    const haloRadius = Math.max(building.w, building.h * 0.46) * 1.55

    return (
      <group position={ZONES[4].position}>
        <GroundRing
          position={[building.x, CITY_GROUND_Y + 0.04, building.z]}
          radius={size * 1.45 + 0.22}
          color={accent}
          reducedMotion={reducedMotion}
        />
        <Halo
          position={[building.x, CITY_GROUND_Y + building.h * 0.55, building.z]}
          radius={haloRadius}
          color={accent}
          thickness={0.03}
          reducedMotion={reducedMotion}
        />
        {/* Jaula wireframe: aísla el edificio elegido del resto del skyline. */}
        <mesh position={[building.x, CITY_GROUND_Y + building.h * 0.54, building.z]}>
          <boxGeometry
            args={[building.w * 1.7, building.h * 1.08, building.d * 1.7]}
          />
          <meshBasicMaterial
            color={accent}
            wireframe
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
      </group>
    )
  }

  return (
    <group position={ZONES[5].position}>
      <Halo position={[0, 0.12, 0]} radius={2.05} color={accent} reducedMotion={reducedMotion} />
      <GroundRing
        position={[0, -0.98, 0]}
        radius={2.35}
        color={accent}
        reducedMotion={reducedMotion}
      />
    </group>
  )
}

/** Aro billboard con pulso y giro lentos (quieto con movimiento reducido). */
function Halo({
  position,
  radius,
  color,
  thickness = 0.04,
  reducedMotion,
}: {
  position: Vector3Tuple
  radius: number
  color: string
  thickness?: number
  reducedMotion: boolean
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    if (meshRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 2.4) * 0.045
      meshRef.current.scale.setScalar(pulse)
      if (!reducedMotion) meshRef.current.rotation.z += delta * 0.45
    }
    if (materialRef.current) {
      materialRef.current.opacity = reducedMotion
        ? 0.82
        : 0.66 + Math.sin(t * 2.4) * 0.22
    }
  })

  return (
    <Billboard position={position}>
      <mesh ref={meshRef}>
        <torusGeometry args={[radius, thickness, 10, 96]} />
        <meshBasicMaterial
          ref={materialRef}
          color={color}
          transparent
          opacity={0.8}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </mesh>
    </Billboard>
  )
}

/** Anillo horizontal apoyado en el suelo de la zona. */
function GroundRing({
  position,
  radius,
  color,
  reducedMotion,
}: {
  position: Vector3Tuple
  radius: number
  color: string
  reducedMotion: boolean
}) {
  const materialRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    if (!materialRef.current) return
    materialRef.current.opacity = reducedMotion
      ? 0.55
      : 0.4 + Math.sin(state.clock.elapsedTime * 1.8) * 0.16
  })

  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.026, 8, 96]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={0.5}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

/**
 * Escudo con check del paso 2 (Testing). La silueta es un `Shape` extruido a
 * cero: contorno neón + relleno tenue + dos barras blancas que forman el check.
 */
function ShieldCheck3D({
  position,
  color,
  reducedMotion,
}: {
  position: [number, number, number]
  color: string
  reducedMotion: boolean
}) {
  const groupRef = useRef<THREE.Group>(null)
  const checkRef = useRef<THREE.Group>(null)

  const shape = useMemo(() => {
    const shield = new THREE.Shape()
    shield.moveTo(0, 0.55)
    shield.bezierCurveTo(0.22, 0.44, 0.42, 0.38, 0.48, 0.32)
    shield.lineTo(0.43, -0.08)
    shield.quadraticCurveTo(0.36, -0.4, 0, -0.6)
    shield.quadraticCurveTo(-0.36, -0.4, -0.43, -0.08)
    shield.lineTo(-0.48, 0.32)
    shield.bezierCurveTo(-0.42, 0.38, -0.22, 0.44, 0, 0.55)
    return shield
  }, [])

  const fillGeometry = useMemo(() => new THREE.ShapeGeometry(shape, 32), [shape])
  const outlineGeometry = useMemo(() => {
    const points = shape
      .getPoints(64)
      .map((point) => new THREE.Vector3(point.x, point.y, 0.01))
    return new THREE.BufferGeometry().setFromPoints(points)
  }, [shape])

  useEffect(() => {
    return () => {
      fillGeometry.dispose()
      outlineGeometry.dispose()
    }
  }, [fillGeometry, outlineGeometry])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (groupRef.current) {
      const pulse = reducedMotion ? 1 : 1 + Math.sin(t * 3.2) * 0.055
      groupRef.current.scale.setScalar(0.92 * pulse)
    }
    if (checkRef.current) {
      const beat = reducedMotion ? 1 : 1 + Math.sin(t * 3.2 + 0.9) * 0.09
      checkRef.current.scale.setScalar(beat)
    }
  })

  return (
    <Billboard position={position}>
      <group ref={groupRef}>
        <mesh geometry={fillGeometry}>
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.16}
            side={THREE.DoubleSide}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </mesh>
        <lineLoop geometry={outlineGeometry}>
          <lineBasicMaterial
            color={color}
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </lineLoop>
        <group ref={checkRef} position={[0, 0, 0.02]}>
          <mesh position={[-0.11, -0.05, 0]} rotation={[0, 0, -Math.PI / 4]}>
            <boxGeometry args={[0.18, 0.055, 0.03]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          <mesh position={[0.035, 0.025, 0]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.32, 0.055, 0.03]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
        </group>
      </group>
    </Billboard>
  )
}
