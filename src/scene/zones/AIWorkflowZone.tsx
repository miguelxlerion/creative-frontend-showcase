import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'
import {
  AI_BRAIN_POS,
  AI_CORE_RADIUS,
  AI_EDITOR_POS,
  AI_OUTPUT_POS,
  AI_TOOL_POSITIONS,
  aiPipelineScale,
} from '../../config/aiWorkflowLayout'
import { useExperienceStore } from '../../store/useExperienceStore'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/* ──────────────────────────────────────────────────────────────────────────
 * ZONA 2 — AI Workflow: pipeline de desarrollo asistido por IA.
 *
 *   [EDITOR / VS CODE + COPILOT] ──▶ [CEREBRO NEURAL] ──▶ [CI/CD]
 *                                      CURSOR / RAG
 *
 * - Etapa 1: editor estilizado con líneas de código instanciadas y cursor
 *   parpadeante. Al hacer hover aparece el tooltip "VS CODE + COPILOT" y al
 *   pulsar se abre el panel de Copilot.
 * - Etapa 2: núcleo neuronal pequeño (núcleo sólido + cáscara geodésica +
 *   anillos giroscópicos). Los dos nodos son iconos de su herramienta y son
 *   clicables: Cursor (cubo-editor) y RAG (DB + lupa). Copilot no tiene nodo:
 *   el editor de la izquierda ya lo representa.
 * - Etapa 3: pipeline vertical con tres puertas BUILD / TEST / DEPLOY,
 *   commits subiendo y beacon de despliegue. Pulsar abre Automation.
 * - El flujo de partículas es UN solo <points> con buffer actualizado en
 *   useFrame; nunca una malla por partícula.
 *
 * Todo se centra en [0,0,0] local (el padre aplica zone.position), con la
 * base por encima de y = -1.9. La interacción escribe `activeSubSection`,
 * la misma fuente que usan el menú, el DetailPanel y el resumen sr-only.
 * ────────────────────────────────────────────────────────────────────────── */

const STAGE_COLORS = {
  input: '#00f0ff',
  ai: '#b026ff',
  output: '#00ff88',
} as const

const TOOL_IDS = ['copilot', 'cursor', 'rag', 'automation'] as const
type ToolId = (typeof TOOL_IDS)[number]
/** Ids de los nodos del cerebro (Automation vive en la salida CI/CD). */
type BrainToolId = Extract<ToolId, 'cursor' | 'rag'>
type HoverId = 'editor' | 'cursor' | 'rag' | 'output'

const EDITOR_POS = new THREE.Vector3(...AI_EDITOR_POS)
const BRAIN_POS = new THREE.Vector3(...AI_BRAIN_POS)
const OUTPUT_POS = new THREE.Vector3(...AI_OUTPUT_POS)
const CORE_RADIUS = AI_CORE_RADIUS

interface BrainNodeDef {
  id: BrainToolId
  label: string
  position: THREE.Vector3
  color: string
  labelOffsetY: number
}

const BRAIN_NODES: BrainNodeDef[] = [
  {
    id: 'cursor',
    label: 'CURSOR',
    position: new THREE.Vector3(...AI_TOOL_POSITIONS.cursor),
    color: '#9d5cff',
    labelOffsetY: 0.5,
  },
  {
    id: 'rag',
    label: 'RAG',
    position: new THREE.Vector3(...AI_TOOL_POSITIONS.rag),
    color: '#d15bff',
    labelOffsetY: -0.46,
  },
]

/**
 * Etapas de la salida. Anillos completos (no arcos) y una etiqueta por
 * puerta: la columna con ramas anteriores se leía como un árbol, no como
 * un pipeline.
 */
const OUTPUT_STAGES = [
  { id: 'build', label: 'BUILD', y: -0.42, radius: 0.34, speed: 0.55 },
  { id: 'test', label: 'TEST', y: 0.02, radius: 0.28, speed: -0.7 },
  { id: 'deploy', label: 'DEPLOY', y: 0.46, radius: 0.22, speed: 0.9 },
] as const

/** Filas del editor: anchos e indentación distintos para que parezca código. */
const CODE_ROWS = [
  { x: -0.32, y: 0.35, w: 0.78 },
  { x: -0.17, y: 0.24, w: 1.04 },
  { x: -0.17, y: 0.13, w: 0.9 },
  { x: -0.02, y: 0.02, w: 0.74 },
  { x: -0.17, y: -0.09, w: 1.1 },
  { x: -0.32, y: -0.2, w: 0.62 },
  { x: -0.17, y: -0.31, w: 0.98 },
  { x: -0.02, y: -0.42, w: 0.56 },
  { x: -0.32, y: -0.53, w: 0.42 },
]

const PARTICLE_COUNT = 110
const ORBIT_COUNT = 16
const COMMIT_COUNT = 9

const FLOW_INPUT = new THREE.Color(STAGE_COLORS.input)
const FLOW_AI = new THREE.Color(STAGE_COLORS.ai)
const FLOW_OUTPUT = new THREE.Color(STAGE_COLORS.output)

function isToolId(value: string | null): value is ToolId {
  return value !== null && (TOOL_IDS as readonly string[]).includes(value)
}

/** Gradiente cian → morado → verde según el avance del flujo. */
function sampleFlowColor(u: number, target: THREE.Color): THREE.Color {
  if (u < 0.5) {
    return target.copy(FLOW_INPUT).lerp(FLOW_AI, u / 0.5)
  }
  return target.copy(FLOW_AI).lerp(FLOW_OUTPUT, (u - 0.5) / 0.5)
}

/**
 * Textura de canvas para etiquetas y tooltip. Sin assets externos: el texto
 * se dibuja en un canvas 4:1 y se mapea a un sprite billboard.
 */
function makeLabelTexture(
  text: string,
  accent: string,
  options: { boxed?: boolean; fontSize?: number } = {},
): THREE.CanvasTexture {
  const { boxed = false, fontSize = 54 } = options
  const canvas = document.createElement('canvas')
  canvas.width = 512
  canvas.height = 128
  const ctx = canvas.getContext('2d')

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (boxed) {
      const x = 20
      const y = 16
      const w = 472
      const h = 96
      const r = 18
      ctx.beginPath()
      ctx.moveTo(x + r, y)
      ctx.lineTo(x + w - r, y)
      ctx.quadraticCurveTo(x + w, y, x + w, y + r)
      ctx.lineTo(x + w, y + h - r)
      ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
      ctx.lineTo(x + r, y + h)
      ctx.quadraticCurveTo(x, y + h, x, y + h - r)
      ctx.lineTo(x, y + r)
      ctx.quadraticCurveTo(x, y, x + r, y)
      ctx.closePath()
      ctx.fillStyle = 'rgba(5, 6, 14, 0.88)'
      ctx.fill()
      ctx.strokeStyle = accent
      ctx.lineWidth = 2
      ctx.stroke()
    }

    ctx.font = `700 ${fontSize}px "JetBrains Mono", ui-monospace, monospace`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Halo neón en el color de la etapa + texto claro para máxima legibilidad
    ctx.shadowColor = accent
    ctx.shadowBlur = 16
    ctx.fillStyle = boxed ? '#eaf8ff' : '#f5edff'
    ctx.fillText(text, canvas.width / 2, canvas.height / 2)
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.LinearFilter
  texture.magFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

/** Segmento brillante de una conexión. `lineSegments` + 2 vértices. */
function Connection({
  start,
  end,
  color,
  opacity = 0.5,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  color: string
  opacity?: number
}) {
  const positions = useMemo(
    () =>
      new Float32Array([
        start.x,
        start.y,
        start.z,
        end.x,
        end.y,
        end.z,
      ]),
    [start, end],
  )

  return (
    <lineSegments frustumCulled={false}>
      <bufferGeometry>
        {/* attach SIEMPRE "attributes-position" + args=[array, itemSize];
            con props sueltas el count queda en 0 y no se dibuja nada. */}
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </lineSegments>
  )
}

export default function AIWorkflowZone({ zone }: { zone: ZoneConfig }) {
  const rootRef = useRef<THREE.Group>(null)
  const editorGroupRef = useRef<THREE.Group>(null)
  const editorScreenMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const codeRef = useRef<THREE.InstancedMesh>(null)
  const cursorMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const coreGroupRef = useRef<THREE.Group>(null)
  const coreMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const shellMatRef = useRef<THREE.MeshBasicMaterial>(null)
  const orbitRef = useRef<THREE.InstancedMesh>(null)
  const nodeRefs = useRef<(THREE.Group | null)[]>([])
  const nodeMats = useRef<(THREE.MeshStandardMaterial | null)[]>([])
  const gyroRef = useRef<THREE.Group>(null)
  const ragScanRef = useRef<THREE.Group>(null)
  const cursorCaretMatRef = useRef<THREE.MeshBasicMaterial>(null)

  const outputGroupRef = useRef<THREE.Group>(null)
  const outputMatRef = useRef<THREE.MeshStandardMaterial>(null)
  const gateRefs = useRef<(THREE.Group | null)[]>([])
  const commitsRef = useRef<THREE.InstancedMesh>(null)

  const flowPointsRef = useRef<THREE.Points>(null)
  const flowTimeRef = useRef(0)
  const flowSettledRef = useRef(false)

  const [hover, setHover] = useState<HoverId | null>(null)
  const reducedMotion = useReducedMotion()

  // El pipeline mide ~7.5 unidades de ancho. En pantallas estrechas se
  // reduce para que las tres etapas entren en el encuadre aun con el
  // pullback de la cámara; la escala se aplica al grupo raíz.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height))
  const pipelineScale = aiPipelineScale(aspect)

  const activeZone = useExperienceStore((s) => s.activeZone)
  const activeSubSection = useExperienceStore((s) => s.activeSubSection)
  const setActiveSubSection = useExperienceStore((s) => s.setActiveSubSection)
  const setSceneHover = useExperienceStore((s) => s.setSceneHover)

  const activeTool: ToolId | null = isToolId(activeSubSection)
    ? activeSubSection
    : null

  // Al salir de la zona, cualquier hover local quedaría "pegado" al volver.
  useEffect(() => {
    setHover(null)
    setSceneHover(false)
  }, [activeZone, setSceneHover])

  useEffect(() => () => setSceneHover(false), [setSceneHover])

  // ── Etiquetas (se liberan al desmontar) ──
  const labels = useMemo(
    () => ({
      input: makeLabelTexture('INPUT', STAGE_COLORS.input),
      tooltip: makeLabelTexture('VS CODE + COPILOT', STAGE_COLORS.input, {
        boxed: true,
        fontSize: 36,
      }),
      core: makeLabelTexture('NEURAL CORE', STAGE_COLORS.ai, {
        boxed: true,
        fontSize: 38,
      }),
      cursor: makeLabelTexture('CURSOR', STAGE_COLORS.ai),
      rag: makeLabelTexture('RAG', STAGE_COLORS.ai),
      output: makeLabelTexture('CI/CD', STAGE_COLORS.output),
      build: makeLabelTexture('BUILD', STAGE_COLORS.output, { fontSize: 52 }),
      test: makeLabelTexture('TEST', STAGE_COLORS.output, { fontSize: 52 }),
      deploy: makeLabelTexture('DEPLOY', STAGE_COLORS.output, { fontSize: 52 }),
    }),
    [],
  )
  useEffect(() => {
    const all = Object.values(labels)
    return () => all.forEach((texture) => texture.dispose())
  }, [labels])

  // ── Bordes del marco del editor (geometría creada una vez) ──
  const editorEdges = useMemo(
    () => new THREE.EdgesGeometry(new THREE.BoxGeometry(1.78, 1.24, 0.09)),
    [],
  )
  useEffect(() => () => editorEdges.dispose(), [editorEdges])

  // Aristas del cubo de Cursor: un box con `wireframe` dibujaría también las
  // diagonales de las caras y parecería una malla rota.
  const cursorEdges = useMemo(() => {
    const box = new THREE.BoxGeometry(0.42, 0.42, 0.42)
    const edges = new THREE.EdgesGeometry(box)
    box.dispose()
    return edges
  }, [])
  useEffect(() => () => cursorEdges.dispose(), [cursorEdges])

  // ── Filas de código instanciadas ──
  useLayoutEffect(() => {
    const mesh = codeRef.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    CODE_ROWS.forEach((row, index) => {
      dummy.position.set(row.x, row.y, 0.075)
      dummy.scale.set(row.w, 0.028, 0.014)
      dummy.updateMatrix()
      mesh.setMatrixAt(index, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [])

  // ── Colores de los nodos orbitales y de los commits ──
  useLayoutEffect(() => {
    const orbit = orbitRef.current
    if (orbit) {
      const base = new THREE.Color(zone.accent)
      const tint = new THREE.Color()
      for (let i = 0; i < ORBIT_COUNT; i++) {
        tint.copy(base).multiplyScalar(0.55 + (i % 4) * 0.14)
        orbit.setColorAt(i, tint)
      }
      if (orbit.instanceColor) orbit.instanceColor.needsUpdate = true
    }

    const commits = commitsRef.current
    if (commits) {
      const green = new THREE.Color(STAGE_COLORS.output)
      const mint = new THREE.Color('#c8ffe6')
      const tint = new THREE.Color()
      for (let i = 0; i < COMMIT_COUNT; i++) {
        tint.copy(i % 3 === 0 ? mint : green).multiplyScalar(
          0.7 + (i % 3) * 0.12,
        )
        commits.setColorAt(i, tint)
      }
      if (commits.instanceColor) commits.instanceColor.needsUpdate = true
    }
  }, [zone.accent])

  /* ── Curva del flujo: editor → frente del cerebro → CI/CD ── */
  const flowCurve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-2.02, 0.36, 0.12),
          new THREE.Vector3(-1.3, 0.62, 0.55),
          new THREE.Vector3(0, 0.46, 1.18),
          new THREE.Vector3(1.3, 0.48, 0.55),
          // La salida está más baja: la curva desciende con ella en vez de
          // pasar por encima de la torre.
          new THREE.Vector3(2.3, -0.09, 0.12),
        ],
        false,
        'catmullrom',
        0.5,
      ),
    [],
  )

  const particles = useMemo(
    () =>
      Array.from({ length: PARTICLE_COUNT }, (_, index) => {
        const rand = (seed: number) => {
          const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453
          return value - Math.floor(value)
        }
        return {
          phase: rand(1),
          speed: 0.11 + rand(2) * 0.08,
          offset: new THREE.Vector3(
            (rand(3) - 0.5) * 0.2,
            (rand(4) - 0.5) * 0.16,
            (rand(5) - 0.5) * 0.16,
          ),
        }
      }),
    [],
  )

  const flowBuffers = useMemo(() => {
    const positions = new Float32Array(PARTICLE_COUNT * 3)
    const colors = new Float32Array(PARTICLE_COUNT * 3)
    const point = new THREE.Vector3()
    const color = new THREE.Color()

    particles.forEach((particle, index) => {
      flowCurve.getPoint(particle.phase, point)
      point.add(particle.offset)
      positions[index * 3] = point.x
      positions[index * 3 + 1] = point.y
      positions[index * 3 + 2] = point.z

      sampleFlowColor(particle.phase, color)
      colors[index * 3] = color.r
      colors[index * 3 + 1] = color.g
      colors[index * 3 + 2] = color.b
    })

    return { positions, colors }
  }, [particles, flowCurve])

  const nodeLinks = useMemo(
    () =>
      BRAIN_NODES.map((node) => {
        const direction = node.position.clone().normalize()
        return {
          id: node.id,
          color: node.color,
          start: direction.clone().multiplyScalar(CORE_RADIUS * 0.97),
          end: node.position.clone().addScaledVector(direction, -0.28),
        }
      }),
    [],
  )

  const mainConnections = useMemo(
    () => [
      {
        id: 'in',
        start: new THREE.Vector3(-2.02, 0.36, 0.12),
        end: new THREE.Vector3(-0.8, 0.36, 0.16),
        color: STAGE_COLORS.input,
        opacity: 0.65,
      },
      {
        id: 'out',
        start: new THREE.Vector3(0.8, 0.36, 0.16),
        end: new THREE.Vector3(2.3, -0.09, 0.12),
        color: STAGE_COLORS.output,
        opacity: 0.65,
      },
    ],
    [],
  )

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const flowPoint = useMemo(() => new THREE.Vector3(), [])
  const flowColor = useMemo(() => new THREE.Color(), [])

  const toggleTool = (id: ToolId) => {
    setActiveSubSection(activeSubSection === id ? null : id)
  }

  const handleOver = (id: HoverId) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHover(id)
    setSceneHover(true)
  }

  const handleOut = (id: HoverId) => (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation()
    setHover((current) => (current === id ? null : current))
    setSceneHover(false)
  }

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.1)
    const damp = THREE.MathUtils.damp
    const editorActive = activeTool === 'copilot'
    const outputActive = activeTool === 'automation'
    const hoverEditor = hover === 'editor'

    if (rootRef.current) {
      rootRef.current.position.y =
        zone.position[1] + (reducedMotion ? 0 : Math.sin(t * 0.5) * 0.05)
    }

    /* ── Etapa 1: editor ── */
    if (editorGroupRef.current) {
      const target = 1 + (editorActive || hoverEditor ? 0.035 : 0)
      const scale = reducedMotion
        ? target
        : damp(editorGroupRef.current.scale.x, target, 10, dt)
      editorGroupRef.current.scale.setScalar(scale)
    }
    if (editorScreenMatRef.current) {
      editorScreenMatRef.current.emissiveIntensity =
        0.2 +
        (hoverEditor ? 0.22 : 0) +
        (editorActive ? 0.28 : 0) +
        (reducedMotion ? 0 : Math.sin(t * 1.8) * 0.04)
    }
    if (cursorMatRef.current) {
      cursorMatRef.current.opacity = reducedMotion
        ? 0.75
        : Math.sin(t * 5.5) > 0
          ? 0.95
          : 0.16
    }

    /* ── Etapa 2: núcleo neuronal ── */
    if (coreGroupRef.current) {
      coreGroupRef.current.rotation.y = reducedMotion ? 0 : t * 0.12
      coreGroupRef.current.rotation.x = reducedMotion
        ? 0
        : Math.sin(t * 0.35) * 0.04
    }
    if (gyroRef.current) {
      gyroRef.current.rotation.y = reducedMotion ? 0.4 : t * 0.09
      gyroRef.current.rotation.z = reducedMotion
        ? 0
        : Math.sin(t * 0.22) * 0.12
    }
    if (coreMatRef.current) {
      coreMatRef.current.emissiveIntensity =
        0.42 +
        (reducedMotion ? 0 : Math.sin(t * 1.6) * 0.1) +
        (activeTool ? 0.1 : 0)
    }
    if (shellMatRef.current) {
      shellMatRef.current.opacity =
        0.3 + (reducedMotion ? 0 : Math.sin(t * 1.4 + 1) * 0.07)
    }

    if (orbitRef.current) {
      for (let i = 0; i < ORBIT_COUNT; i++) {
        const angle = reducedMotion
          ? (i / ORBIT_COUNT) * Math.PI * 2
          : t * 0.38 + i * 0.9
        const y = reducedMotion
          ? Math.sin(i * 1.7) * 0.52
          : Math.sin(t * 0.55 + i * 1.7) * 0.52
        const radius = 1.02 + (i % 4) * 0.035
        const pulse = reducedMotion
          ? 1
          : 0.82 + Math.abs(Math.sin(t * 1.6 + i * 0.9)) * 0.34
        dummy.position.set(
          Math.cos(angle) * radius,
          y,
          Math.sin(angle) * radius,
        )
        dummy.rotation.set(angle, angle * 0.7, 0)
        dummy.scale.setScalar((0.026 + (i % 5) * 0.006) * pulse)
        dummy.updateMatrix()
        orbitRef.current.setMatrixAt(i, dummy.matrix)
      }
      orbitRef.current.instanceMatrix.needsUpdate = true
    }

    BRAIN_NODES.forEach((node, index) => {
      const group = nodeRefs.current[index]
      const material = nodeMats.current[index]
      const isActive = activeTool === node.id
      const isHover = hover === node.id

      if (group) {
        const pulse = reducedMotion
          ? 1
          : 1 + Math.sin(t * 2.2 + index * 1.4) * 0.03
        const target =
          (isActive ? 1.12 : isHover ? 1.06 : 1) * pulse
        const scale = reducedMotion
          ? isActive
            ? 1.12
            : isHover
              ? 1.06
              : 1
          : damp(group.scale.x, target, 10, dt)
        group.scale.setScalar(scale)
      }

      if (material) {
        material.emissiveIntensity =
          0.42 +
          (isActive ? 0.55 : 0) +
          (isHover ? 0.3 : 0) +
          (reducedMotion ? 0 : Math.sin(t * 2.4 + index * 1.3) * 0.08)
      }
    })

    if (cursorCaretMatRef.current) {
      cursorCaretMatRef.current.opacity = reducedMotion
        ? 0.85
        : Math.sin(t * 4.6) > 0
          ? 0.95
          : 0.18
    }

    if (ragScanRef.current) {
      ragScanRef.current.position.y = reducedMotion
        ? 0.16
        : 0.14 + Math.sin(t * 1.5) * 0.06
      ragScanRef.current.rotation.z = reducedMotion ? 0.4 : t * 0.65
    }

    /* ── Etapa 3: CI/CD ── */
    if (outputGroupRef.current) {
      const target = 1 + (outputActive || hover === 'output' ? 0.035 : 0)
      const scale = reducedMotion
        ? target
        : damp(outputGroupRef.current.scale.x, target, 10, dt)
      outputGroupRef.current.scale.setScalar(scale)
    }
    if (outputMatRef.current) {
      outputMatRef.current.emissiveIntensity =
        0.65 +
        (outputActive || hover === 'output' ? 0.35 : 0) +
        (reducedMotion ? 0 : Math.sin(t * 1.7) * 0.1)
    }

    gateRefs.current.forEach((gate, index) => {
      if (!gate) return
      gate.rotation.y = reducedMotion
        ? index * 1.3
        : t * (OUTPUT_STAGES[index]?.speed ?? 0.5)
    })

    if (commitsRef.current) {
      for (let i = 0; i < COMMIT_COUNT; i++) {
        const phase = reducedMotion
          ? i / COMMIT_COUNT
          : (i / COMMIT_COUNT + t * 0.16) % 1
        const angle = i * 2.4 + (reducedMotion ? 0 : t * 0.5)
        const radius = 0.1 + (i % 3) * 0.04
        // Los commits aparecen y se desvanecen en los extremos; sin el
        // fade, el salto del bucle se lee como un parpadeo.
        const fade = reducedMotion ? 1 : 0.35 + Math.sin(phase * Math.PI) * 0.65
        dummy.position.set(
          Math.cos(angle) * radius,
          -0.6 + phase * 1.2,
          Math.sin(angle) * radius,
        )
        dummy.rotation.set(
          reducedMotion ? i : t * 0.8 + i,
          reducedMotion ? 0 : t * 0.6 + i,
          0,
        )
        dummy.scale.setScalar((0.045 + (i % 3) * 0.012) * fade)
        dummy.updateMatrix()
        commitsRef.current.setMatrixAt(i, dummy.matrix)
      }
      commitsRef.current.instanceMatrix.needsUpdate = true
    }

    /* ── Flujo de partículas (un único buffer) ── */
    const points = flowPointsRef.current
    if (points) {
      const positionAttr = points.geometry.getAttribute('position')
      const colorAttr = points.geometry.getAttribute('color')
      if (positionAttr && colorAttr) {
        const positions = positionAttr.array as Float32Array
        const colors = colorAttr.array as Float32Array

        const writeFlow = (animate: boolean) => {
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = particles[i]
            if (!particle) continue
            const progress = animate
              ? (particle.phase + flowTimeRef.current * particle.speed) % 1
              : particle.phase
            flowCurve.getPoint(progress, flowPoint)
            flowPoint.addScaledVector(
              particle.offset,
              animate ? Math.sin(progress * Math.PI) : 1,
            )

            positions[i * 3] = flowPoint.x
            positions[i * 3 + 1] = flowPoint.y
            positions[i * 3 + 2] = flowPoint.z

            sampleFlowColor(progress, flowColor)
            colors[i * 3] = flowColor.r
            colors[i * 3 + 1] = flowColor.g
            colors[i * 3 + 2] = flowColor.b
          }
          positionAttr.needsUpdate = true
          colorAttr.needsUpdate = true
        }

        if (reducedMotion) {
          // Con movimiento reducido el flujo queda repartido y quieto: se
          // escribe una sola vez para no recalcular la curva cada frame.
          if (!flowSettledRef.current) {
            writeFlow(false)
            flowSettledRef.current = true
          }
        } else {
          flowSettledRef.current = false
          const boost = hover !== null ? 1.7 : activeTool ? 1.3 : 1
          flowTimeRef.current += dt * boost
          writeFlow(true)
        }
      }
    }
  })

  return (
    <group position={zone.position} ref={rootRef} scale={pipelineScale}>
      {/* ══════════ ETAPA 1 — EDITOR ══════════ */}
      <group
        position={EDITOR_POS}
        rotation={[0, 0.22, 0]}
        ref={editorGroupRef}
      >
        {/* Marco */}
        <mesh>
          <boxGeometry args={[1.78, 1.24, 0.09]} />
          <meshStandardMaterial
            color="#070b12"
            metalness={0.75}
            roughness={0.3}
            emissive={STAGE_COLORS.input}
            emissiveIntensity={0.08}
          />
        </mesh>

        {/* Pantalla */}
        <mesh position={[0, 0, 0.05]}>
          <boxGeometry args={[1.66, 1.12, 0.03]} />
          <meshStandardMaterial
            ref={editorScreenMatRef}
            color="#03070d"
            metalness={0.45}
            roughness={0.35}
            emissive={STAGE_COLORS.input}
            emissiveIntensity={0.2}
          />
        </mesh>

        {/* Bordes neón */}
        <lineSegments geometry={editorEdges} position={[0, 0, 0.01]}>
          <lineBasicMaterial
            color={STAGE_COLORS.input}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </lineSegments>

        {/* Barra superior + tres luces de ventana */}
        <mesh position={[0, 0.49, 0.075]}>
          <boxGeometry args={[1.6, 0.045, 0.012]} />
          <meshBasicMaterial
            color={STAGE_COLORS.input}
            transparent
            opacity={0.28}
            toneMapped={false}
          />
        </mesh>
        {[
          { x: -0.73, color: STAGE_COLORS.input },
          { x: -0.65, color: STAGE_COLORS.ai },
          { x: -0.57, color: STAGE_COLORS.output },
        ].map((dot) => (
          <mesh key={dot.x} position={[dot.x, 0.49, 0.085]}>
            <sphereGeometry args={[0.022, 8, 8]} />
            <meshBasicMaterial
              color={dot.color}
              toneMapped={false}
              transparent
              opacity={0.9}
            />
          </mesh>
        ))}

        {/* Código instanciado */}
        <instancedMesh
          ref={codeRef}
          args={[undefined, undefined, CODE_ROWS.length]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color={STAGE_COLORS.input}
            transparent
            opacity={0.7}
            toneMapped={false}
          />
        </instancedMesh>

        {/* Cursor parpadeante */}
        <mesh position={[-0.02, -0.53, 0.085]}>
          <boxGeometry args={[0.035, 0.062, 0.012]} />
          <meshBasicMaterial
            ref={cursorMatRef}
            color="#eafcff"
            transparent
            opacity={0.95}
            toneMapped={false}
          />
        </mesh>

        <sprite position={[0, 1.04, 0.08]} scale={[1.1, 0.28, 1]}>
          <spriteMaterial
            map={labels.input}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* Tooltip de hover: refuerza qué herramienta representa el editor.
            Va DEBAJO del marco: en ventanas ≤1120 px la leyenda AI ocupa la
            franja superior izquierda y taparía el tooltip si se anclara arriba.
            Con una ficha abierta se oculta: el zoom acerca la cámara y el
            tooltip quedaría detrás de la tarjeta héroe (abajo izquierda). */}
        <sprite
          position={[0.08, -0.82, 0.12]}
          scale={[1.9, 0.48, 1]}
          visible={hover === 'editor' && activeSubSection === null}
        >
          <spriteMaterial
            map={labels.tooltip}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* Zona de clic (invisible pero raycastable) */}
        <mesh
          position={[0, 0.1, 0.1]}
          onPointerOver={handleOver('editor')}
          onPointerOut={handleOut('editor')}
          onClick={(event) => {
            event.stopPropagation()
            toggleTool('copilot')
          }}
        >
          <boxGeometry args={[2.1, 1.9, 0.8]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      </group>

      {/* ══════════ ETAPA 2 — NÚCLEO NEURONAL ══════════ */}
      <group position={BRAIN_POS}>
        <group ref={coreGroupRef}>
          {/* Núcleo interior pequeño y con emisión contenida. Un sólido
              grande y brillante vuelve a convertir el cerebro en una bola. */}
          <mesh>
            <icosahedronGeometry args={[CORE_RADIUS * 0.46, 1]} />
            <meshStandardMaterial
              ref={coreMatRef}
              color="#0b0314"
              flatShading
              metalness={0.78}
              roughness={0.25}
              emissive={STAGE_COLORS.ai}
              emissiveIntensity={0.42}
            />
          </mesh>

          {/* Cáscara geodésica: da la lectura de red neuronal. */}
          <mesh scale={1.012}>
            <icosahedronGeometry args={[CORE_RADIUS, 1]} />
            <meshBasicMaterial
              ref={shellMatRef}
              color={STAGE_COLORS.ai}
              wireframe
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>

          {/* Volumen apenas perceptible para que la cáscara no sea solo líneas. */}
          <mesh>
            <sphereGeometry args={[CORE_RADIUS * 0.985, 24, 18]} />
            <meshBasicMaterial
              color={STAGE_COLORS.ai}
              transparent
              opacity={0.04}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Nombre del núcleo: sin etiqueta, una esfera geodésica grande se
            lee como decoración y no como la etapa de procesamiento. Fuera de
            `coreGroupRef` para que no herede el giro. */}
        <sprite position={[-0.98, 0.96, 0.28]} scale={[1.12, 0.28, 1]}>
          <spriteMaterial
            map={labels.core}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        {/* Anillos giroscópicos: enmarcan el núcleo sin agrandarlo. */}
        <group ref={gyroRef}>
          <mesh rotation={[Math.PI / 2.35, 0.32, 0]}>
            <torusGeometry args={[1.01, 0.006, 6, 96]} />
            <meshBasicMaterial
              color={STAGE_COLORS.ai}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          <mesh rotation={[1.18, 0.85, 0.35]}>
            <torusGeometry args={[1.08, 0.005, 6, 96]} />
            <meshBasicMaterial
              color={STAGE_COLORS.ai}
              transparent
              opacity={0.18}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
        </group>

        {/* Nodos decorativos orbitando (una sola draw call) */}
        <instancedMesh
          ref={orbitRef}
          args={[undefined, undefined, ORBIT_COUNT]}
          frustumCulled={false}
        >
          <icosahedronGeometry args={[1, 0]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>

        {/* Conexiones núcleo → herramientas */}
        {nodeLinks.map((link) => (
          <Connection
            key={link.id}
            start={link.start}
            end={link.end}
            color={link.color}
            opacity={0.55}
          />
        ))}

        {/* Nodos clicables: cada icono representa su herramienta.
            Cursor = editor con caret dentro de un cubo; RAG = base de datos
            vectorial con lupa. */}
        {BRAIN_NODES.map((node, index) => (
          <group
            key={node.id}
            position={node.position}
            ref={(element) => {
              nodeRefs.current[index] = element
            }}
          >
            {node.id === 'cursor' && (
              <group rotation={[0.32, 0.62, 0.06]}>
                {/* Cuerpo oscuro: da volumen al cubo sin apagar las aristas. */}
                <mesh>
                  <boxGeometry args={[0.4, 0.4, 0.4]} />
                  <meshStandardMaterial
                    ref={(material) => {
                      nodeMats.current[index] = material
                    }}
                    color="#0d0418"
                    metalness={0.7}
                    roughness={0.28}
                    emissive={node.color}
                    emissiveIntensity={0.4}
                  />
                </mesh>
                <lineSegments geometry={cursorEdges}>
                  <lineBasicMaterial
                    color={node.color}
                    transparent
                    opacity={0.95}
                    blending={THREE.AdditiveBlending}
                    depthWrite={false}
                    toneMapped={false}
                  />
                </lineSegments>
                {/* Líneas de código */}
                {[
                  { y: 0.08, w: 0.2 },
                  { y: 0, w: 0.14 },
                  { y: -0.08, w: 0.18 },
                ].map((row) => (
                  <mesh key={row.y} position={[-0.04, row.y, 0.205]}>
                    <boxGeometry args={[row.w, 0.018, 0.015]} />
                    <meshBasicMaterial
                      color={node.color}
                      transparent
                      opacity={0.55}
                      toneMapped={false}
                    />
                  </mesh>
                ))}
                {/* Caret de texto parpadeante */}
                <mesh position={[0.13, 0, 0.205]}>
                  <boxGeometry args={[0.024, 0.19, 0.02]} />
                  <meshBasicMaterial
                    ref={cursorCaretMatRef}
                    color="#f2e3ff"
                    transparent
                    opacity={0.95}
                    toneMapped={false}
                  />
                </mesh>
              </group>
            )}

            {node.id === 'rag' && (
              <group>
                {/* Pila de base de datos vectorial */}
                {[-0.2, -0.08, 0.04].map((y, disc) => (
                  <group key={y} position={[0, y, 0]}>
                    <mesh>
                      <cylinderGeometry
                        args={[
                          0.26 - disc * 0.008,
                          0.26 - disc * 0.008,
                          0.075,
                          24,
                        ]}
                      />
                      <meshStandardMaterial
                        color="#140520"
                        metalness={0.7}
                        roughness={0.3}
                        emissive={node.color}
                        emissiveIntensity={0.4}
                      />
                    </mesh>
                    <mesh
                      position={[0, 0.038, 0]}
                      rotation={[Math.PI / 2, 0, 0]}
                    >
                      <torusGeometry
                        args={[0.26 - disc * 0.008, 0.009, 6, 32]}
                      />
                      <meshBasicMaterial
                        color={node.color}
                        transparent
                        opacity={0.85}
                        blending={THREE.AdditiveBlending}
                        depthWrite={false}
                        toneMapped={false}
                      />
                    </mesh>
                  </group>
                ))}

                {/* Anillo de recuperación sobre la pila */}
                <group
                  ref={ragScanRef}
                  position={[0, 0.16, 0]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <mesh>
                    <torusGeometry args={[0.21, 0.007, 6, 40]} />
                    <meshBasicMaterial
                      color={node.color}
                      transparent
                      opacity={0.7}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                      toneMapped={false}
                    />
                  </mesh>
                  <mesh position={[0.21, 0, 0]}>
                    <sphereGeometry args={[0.018, 8, 8]} />
                    <meshBasicMaterial color="#f0d4ff" toneMapped={false} />
                  </mesh>
                </group>

                {/* Lupa: búsqueda semántica sobre el vector DB */}
                <group
                  position={[0.27, 0.34, 0.1]}
                  rotation={[0.2, 0.3, -0.5]}
                >
                  <mesh>
                    <torusGeometry args={[0.1, 0.022, 8, 28]} />
                    <meshBasicMaterial
                      color={node.color}
                      transparent
                      opacity={0.95}
                      toneMapped={false}
                    />
                  </mesh>
                  <mesh>
                    <circleGeometry args={[0.09, 24]} />
                    <meshBasicMaterial
                      color={node.color}
                      transparent
                      opacity={0.14}
                      side={THREE.DoubleSide}
                      blending={THREE.AdditiveBlending}
                      depthWrite={false}
                      toneMapped={false}
                    />
                  </mesh>
                  <mesh position={[0, -0.155, 0]}>
                    <cylinderGeometry args={[0.016, 0.016, 0.14, 8]} />
                    <meshBasicMaterial color={node.color} toneMapped={false} />
                  </mesh>
                </group>
              </group>
            )}

            <sprite
              position={[0, node.labelOffsetY, 0.08]}
              scale={[1.02, 0.255, 1]}
            >
              <spriteMaterial
                map={labels[node.id]}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>

            <mesh
              onPointerOver={handleOver(node.id)}
              onPointerOut={handleOut(node.id)}
              onClick={(event) => {
                event.stopPropagation()
                toggleTool(node.id)
              }}
            >
              <sphereGeometry args={[0.5, 12, 12]} />
              <meshBasicMaterial transparent opacity={0} depthWrite={false} />
            </mesh>
          </group>
        ))}

        <pointLight
          color={STAGE_COLORS.ai}
          intensity={10}
          distance={9}
          decay={2}
        />
      </group>

      {/* ══════════ ETAPA 3 — CI/CD ══════════ */}
      <group position={OUTPUT_POS} ref={outputGroupRef}>
        {/* Base hexagonal */}
        <mesh position={[0, -0.72, 0]}>
          <cylinderGeometry args={[0.5, 0.56, 0.06, 6]} />
          <meshStandardMaterial
            color="#03140b"
            metalness={0.65}
            roughness={0.35}
            emissive={STAGE_COLORS.output}
            emissiveIntensity={0.22}
          />
        </mesh>

        {/* Espina fina: una columna gruesa se leía como el tronco de un árbol. */}
        <mesh position={[0, 0, 0]}>
          <cylinderGeometry args={[0.028, 0.028, 1.5, 10]} />
          <meshStandardMaterial
            ref={outputMatRef}
            color="#041b0e"
            metalness={0.8}
            roughness={0.2}
            emissive={STAGE_COLORS.output}
            emissiveIntensity={0.65}
          />
        </mesh>

        {/* Tres puertas de pipeline, cada una con su etapa visible. */}
        {OUTPUT_STAGES.map((stage, index) => (
          <group key={stage.id} position={[0, stage.y, 0]}>
            <mesh>
              <cylinderGeometry
                args={[
                  stage.radius * 0.55,
                  stage.radius * 0.62,
                  0.025,
                  6,
                ]}
              />
              <meshStandardMaterial
                color="#03140b"
                metalness={0.7}
                roughness={0.3}
                emissive={STAGE_COLORS.output}
                emissiveIntensity={0.35}
              />
            </mesh>

            <group
              ref={(element) => {
                gateRefs.current[index] = element
              }}
            >
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <torusGeometry args={[stage.radius, 0.014, 8, 64]} />
                <meshBasicMaterial
                  color={STAGE_COLORS.output}
                  transparent
                  opacity={0.85}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                  toneMapped={false}
                />
              </mesh>
              {/* El marcador hace visible el giro de un anillo simétrico. */}
              <mesh position={[stage.radius, 0, 0]}>
                <sphereGeometry args={[0.024, 8, 8]} />
                <meshBasicMaterial color="#d8ffe9" toneMapped={false} />
              </mesh>
            </group>

            <sprite position={[0.68, 0, 0.08]} scale={[0.58, 0.145, 1]}>
              <spriteMaterial
                map={labels[stage.id]}
                transparent
                depthWrite={false}
                toneMapped={false}
              />
            </sprite>
          </group>
        ))}

        {/* Commits subiendo por la espina y atravesando las puertas */}
        <instancedMesh
          ref={commitsRef}
          args={[undefined, undefined, COMMIT_COUNT]}
          frustumCulled={false}
        >
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.9}
            toneMapped={false}
          />
        </instancedMesh>

        {/* Beacon de despliegue */}
        <mesh position={[0, 0.68, 0]}>
          <coneGeometry args={[0.075, 0.18, 12]} />
          <meshBasicMaterial
            color={STAGE_COLORS.output}
            toneMapped={false}
            transparent
            opacity={0.95}
          />
        </mesh>
        <mesh position={[0, 0.82, 0]}>
          <sphereGeometry args={[0.065, 12, 12]} />
          <meshBasicMaterial color="#d8ffe9" toneMapped={false} />
        </mesh>

        <sprite position={[0, 1.12, 0.08]} scale={[1.0, 0.255, 1]}>
          <spriteMaterial
            map={labels.output}
            transparent
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>

        <mesh
          position={[0, 0.1, 0]}
          onPointerOver={handleOver('output')}
          onPointerOut={handleOut('output')}
          onClick={(event) => {
            event.stopPropagation()
            toggleTool('automation')
          }}
        >
          <boxGeometry args={[1.7, 2.1, 1.2]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>

        <pointLight
          color={STAGE_COLORS.output}
          intensity={7}
          distance={6}
          decay={2}
        />
      </group>

      {/* Conexiones principales editor → cerebro → CI/CD */}
      {mainConnections.map((connection) => (
        <Connection
          key={connection.id}
          start={connection.start}
          end={connection.end}
          color={connection.color}
          opacity={connection.opacity}
        />
      ))}

      {/* Flujo de datos: un único Points con vértices y colores dinámicos */}
      <points ref={flowPointsRef} frustumCulled={false}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[flowBuffers.positions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[flowBuffers.colors, 3]}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.065}
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
        />
      </points>

      <pointLight
        color={STAGE_COLORS.input}
        intensity={8}
        distance={6}
        decay={2}
        position={[-2.7, 0.7, 1.2]}
      />
    </group>
  )
}
