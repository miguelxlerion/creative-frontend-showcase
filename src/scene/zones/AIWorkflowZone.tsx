import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'

/* ──────────────────────────────────────────────────────────────────────────
 * ZONA 2 — AI Workflow (morado #b026ff)
 * "PIPELINE DE IAs": un flujo dirigido de izquierda → derecha.
 *
 *   [INPUT] ──▶ [COPILOT] ──▶
 *              [CURSOR ] ──▶ [OUTPUT: CI/CD + ENTREGA]
 *              [  RAG  ] ──▶
 *
 * - Nodo INPUT a la izquierda (la tarea / el prompt).
 * - 3 nodos HERRAMIENTA en arco al medio (Copilot, Cursor, RAG),
 *   cada uno con geometría y tamaño distintos para distinguirlos.
 * - Nodo OUTPUT a la derecha (CI/CD, la entrega automatizada).
 * - Conexiones con lineSegments + bufferAttribute attach="attributes-*"
 *   (NUNCA attach="position": eso tumba el loop de render).
 * - Paquetes de datos: esferas brillantes que viajan por las conexiones.
 * - Conos-flecha en los puntos medios como pistas de dirección de flujo.
 * Todo centrado en [0,0,0] (el padre aplica zone.position), dentro de
 * radio ~3.5 y por encima de y=-1.9 (rejilla-suelo).
 * ────────────────────────────────────────────────────────────────────────── */

/** Crea una textura de canvas con texto (etiquetas de los nodos). Sin assets externos. */
function makeLabelTexture(text: string, accent: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.clearRect(0, 0, 256, 64)
    ctx.font = 'bold 34px sans-serif, monospace'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    // Halo neón en el color de la zona + texto claro para máxima legibilidad
    ctx.shadowColor = accent
    ctx.shadowBlur = 14
    ctx.fillStyle = '#f5edff'
    ctx.fillText(text, 128, 32)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

export default function AIWorkflowZone({ zone }: { zone: ZoneConfig }) {
  const rootRef = useRef<THREE.Group>(null)
  const inputRef = useRef<THREE.Mesh>(null)
  const outputRef = useRef<THREE.Mesh>(null)
  const nodeRefs = useRef<(THREE.Mesh | null)[]>([]) // 3 nodos herramienta
  const packageRefs = useRef<(THREE.Mesh | null)[]>([]) // paquetes de datos
  const ringRef = useRef<THREE.Mesh>(null) // anillo del nodo RAG

  /* ── Geometría del pipeline (coords locales, centradas en el origen) ── */
  const INPUT_POS = new THREE.Vector3(-2.6, 0, 0)
  const OUTPUT_POS = new THREE.Vector3(2.6, 0.05, 0)
  // Los 3 tools en arco hacia el INPUT (el arco "abrazando" al flujo)
  const TOOL_POS = [
    new THREE.Vector3(-0.15, 1.05, -0.15), // COPILOT (arriba)
    new THREE.Vector3(0.35, 0.05, 0.25), // CURSOR (centro, más adelante)
    new THREE.Vector3(-0.15, -1.0, -0.15), // RAG (abajo)
  ]

  /* ── Conexiones de la tubería: input→cada tool y cada tool→output ── */
  const { linePositions, arrows, connections } = useMemo(() => {
    const segments: [THREE.Vector3, THREE.Vector3][] = []
    for (const tool of TOOL_POS) {
      segments.push([INPUT_POS, tool]) // rama de entrada
      segments.push([tool, OUTPUT_POS]) // rama de salida
    }

    // Buffer de posiciones para lineSegments (1 vértice por extremo de segmento)
    const pos = new Float32Array(segments.length * 6)
    segments.forEach(([a, b], i) => {
      pos[i * 6 + 0] = a.x
      pos[i * 6 + 1] = a.y
      pos[i * 6 + 2] = a.z
      pos[i * 6 + 3] = b.x
      pos[i * 6 + 4] = b.y
      pos[i * 6 + 5] = b.z
    })

    // Conos-flecha en el punto medio de cada segmento, apuntando a lo largo del flujo
    const up = new THREE.Vector3(0, 1, 0)
    const arrows = segments.map(([a, b]) => {
      const mid = a.clone().add(b).multiplyScalar(0.5)
      const dir = b.clone().sub(a).normalize()
      const quat = new THREE.Quaternion().setFromUnitVectors(up, dir)
      return { pos: mid, quat }
    })

    return { linePositions: pos, arrows, connections: segments }
  }, [])

  // Las 6 conexiones como pares origen/destino para animar los paquetes
  const CONNECTIONS = connections

  /* ── Etiquetas de texto generadas con canvas (sin drei, sin red) ── */
  const labels = useMemo(
    () => ({
      input: makeLabelTexture('INPUT', zone.accent),
      copilot: makeLabelTexture('COPILOT', zone.accent),
      cursor: makeLabelTexture('CURSOR', zone.accent),
      rag: makeLabelTexture('RAG', zone.accent),
      output: makeLabelTexture('CI/CD', zone.accent),
    }),
    [zone.accent]
  )
  // Liberar las texturas al desmontar
  useEffect(() => {
    const all = Object.values(labels)
    return () => all.forEach((t) => t.dispose())
  }, [labels])

  const PACKAGES_PER_CONN = 2 // paquetes simultáneos por conexión
  const PACKAGE_COUNT = CONNECTIONS.length * PACKAGES_PER_CONN

  /* ── Animación del pipeline ── */
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // Rotación suave del grupo (va y viene para no perder la lectura izq→der)
    if (rootRef.current) {
      rootRef.current.rotation.y = Math.sin(t * 0.18) * 0.2
      rootRef.current.position.y = zone.position[1] + Math.sin(t * 0.5) * 0.1
    }

    // Emisivo pulsando con fases escalonadas en los 5 nodos
    const pulse = (mesh: THREE.Mesh | null, phase: number, base = 0.55) => {
      if (!mesh) return
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = base + Math.sin(t * 2.2 + phase) * 0.35
      const s = 1 + Math.sin(t * 2.2 + phase) * 0.05
      mesh.scale.setScalar(s)
    }
    pulse(inputRef.current, 0)
    pulse(outputRef.current, 3 * 1.3)
    nodeRefs.current.forEach((m, i) => pulse(m, (i + 1) * 1.3))

    // Anillo del nodo RAG girando
    if (ringRef.current) {
      ringRef.current.rotation.z += delta * 0.7
      ringRef.current.rotation.x = Math.PI / 3 + Math.sin(t * 0.8) * 0.15
    }

    // PAQUETES DE DATOS: viajan por las conexiones en bucle (lerp origen→destino)
    const tmp = new THREE.Vector3()
    for (let i = 0; i < PACKAGE_COUNT; i++) {
      const mesh = packageRefs.current[i]
      if (!mesh) continue
      const conn = CONNECTIONS[i % CONNECTIONS.length]
      const slot = Math.floor(i / CONNECTIONS.length) // 0 o 1 (fase desfasada)
      const progress = (t * 0.35 + slot * 0.5 + (i % CONNECTIONS.length) * 0.11) % 1
      // Interpolación lineal con un arco sutil hacia arriba (aspecto de "salto" de datos)
      tmp.lerpVectors(conn[0], conn[1], progress)
      tmp.y += Math.sin(progress * Math.PI) * 0.12
      mesh.position.copy(tmp)
      // Brillar más intenso a mitad de camino
      const glow = 0.85 + Math.sin(progress * Math.PI) * 0.35
      mesh.scale.setScalar(glow)
    }
  })

  return (
    <group position={zone.position} ref={rootRef}>
      {/* ── Tubería: conexiones del pipeline (input → tools → output) ── */}
      <lineSegments>
        <bufferGeometry>
          {/* BUG CONOCIDO: attach SIEMPRE "attributes-position", nunca "position".
              args=[array, itemSize] calcula `count`; con props sueltas count=0 y no se dibuja. */}
          <bufferAttribute attach="attributes-position" args={[linePositions, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={zone.accent}
          transparent
          opacity={0.5}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </lineSegments>

      {/* ── Flechas de dirección en los puntos medios de cada conexión ── */}
      {arrows.map((a, i) => (
        <mesh key={`arrow-${i}`} position={a.pos} quaternion={a.quat}>
          <coneGeometry args={[0.09, 0.26, 8]} />
          <meshBasicMaterial
            color={zone.accent}
            transparent
            opacity={0.95}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* ── Nodo INPUT (izquierda): octaedro = el origen del flujo ── */}
      <group position={INPUT_POS}>
        <mesh ref={inputRef}>
          <octahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial
            color="#12041f"
            flatShading
            metalness={0.8}
            roughness={0.25}
            emissive={zone.accent}
            emissiveIntensity={0.7}
          />
        </mesh>
        <sprite position={[0, 0.72, 0]} scale={[0.8, 0.2, 1]}>
          <spriteMaterial map={labels.input} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* ── Nodo OUTPUT (derecha): icosaedro = CI/CD, la entrega ── */}
      <group position={OUTPUT_POS}>
        <mesh ref={outputRef}>
          <icosahedronGeometry args={[0.48, 0]} />
          <meshStandardMaterial
            color="#12041f"
            flatShading
            metalness={0.8}
            roughness={0.25}
            emissive={zone.accent}
            emissiveIntensity={0.7}
          />
        </mesh>
        {/* Halo exterior del output */}
        <mesh scale={1.35}>
          <icosahedronGeometry args={[0.48, 0]} />
          <meshBasicMaterial
            color={zone.accent}
            wireframe
            transparent
            opacity={0.2}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <sprite position={[0, 0.85, 0]} scale={[0.8, 0.2, 1]}>
          <spriteMaterial map={labels.output} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* ── Nodo herramienta 1: COPILOT — icosaedro liso, radio 0.4 ── */}
      <group position={TOOL_POS[0]}>
        <mesh
          ref={(el) => {
            nodeRefs.current[0] = el
          }}
        >
          <icosahedronGeometry args={[0.4, 1]} />
          <meshStandardMaterial
            color="#0d0318"
            metalness={0.85}
            roughness={0.2}
            emissive={zone.accent}
            emissiveIntensity={0.7}
          />
        </mesh>
        <sprite position={[0, 0.62, 0]} scale={[0.9, 0.22, 1]}>
          <spriteMaterial map={labels.copilot} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* ── Nodo herramienta 2: CURSOR — caja girada 45°, el más pequeño ── */}
      <group position={TOOL_POS[1]}>
        <mesh
          rotation={[0.6, 0.8, 0]}
          ref={(el) => {
            nodeRefs.current[1] = el
          }}
        >
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial
            color="#0d0318"
            flatShading
            metalness={0.85}
            roughness={0.2}
            emissive={zone.accent}
            emissiveIntensity={0.7}
          />
        </mesh>
        <sprite position={[0.1, 0.55, 0]} scale={[0.85, 0.21, 1]}>
          <spriteMaterial map={labels.cursor} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* ── Nodo herramienta 3: RAG — dodecaedro grande + anillo orbital ── */}
      <group position={TOOL_POS[2]}>
        <mesh
          ref={(el) => {
            nodeRefs.current[2] = el
          }}
        >
          <dodecahedronGeometry args={[0.46, 0]} />
          <meshStandardMaterial
            color="#0d0318"
            flatShading
            metalness={0.85}
            roughness={0.2}
            emissive={zone.accent}
            emissiveIntensity={0.7}
          />
        </mesh>
        {/* Anillo que orbita alrededor del nodo RAG (lo distingue al instante) */}
        <mesh ref={ringRef}>
          <torusGeometry args={[0.66, 0.035, 8, 40]} />
          <meshBasicMaterial
            color={zone.accent}
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        <sprite position={[0, 0.78, 0]} scale={[0.7, 0.18, 1]}>
          <spriteMaterial map={labels.rag} transparent depthWrite={false} />
        </sprite>
      </group>

      {/* ── Paquetes de datos animados: esferas brillantes recorriendo la tubería ── */}
      {Array.from({ length: PACKAGE_COUNT }).map((_, i) => (
        <mesh
          key={`pkg-${i}`}
          ref={(el) => {
            packageRefs.current[i] = el
          }}
        >
          <sphereGeometry args={[0.08, 12, 12]} />
          <meshBasicMaterial color="#ffffff" toneMapped={false} />
        </mesh>
      ))}

      {/* Luz neón central de la zona */}
      <pointLight color={zone.accent} intensity={14} distance={14} decay={2} />
    </group>
  )
}
