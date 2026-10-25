import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'

/**
 * Zona 1 — Testing & QA (verde #00ff88)
 * "Tests de laboratorio": un banco de laboratorio con porta-tubos de 5 tubos
 * de ensayo, dos matraces Erlenmeyer, un vaso (beaker), burbujas animadas
 * subiendo dentro de los recipientes, una lupa de inspección sobre una
 * pista de cuadrícula y vapor de partículas.
 *
 * Todo vive centrado en el ORIGEN LOCAL [0,0,0]; el padre aplica zone.position.
 *
 * ⚠️ BUG CRÍTICO PRESERVADO: cualquier <bufferAttribute> DEBE usar
 * attach="attributes-position" / "attributes-color" / "attributes-size".
 * NUNCA attach="position", eso tumba el loop de render completo.
 */

// ── Constantes de layout (coordenadas locales de la zona) ──────────────────
/** Tapa del banco de laboratorio (el suelo-rejilla global está en y=-1.9). */
const BENCH_TOP = -0.88
/** X del porta-tubos dentro de la zona local. */
const RACK_X = -1.15
/** Posiciones X relativas de los 5 tubos de ensayo. */
const TUBE_X = [-0.42, -0.21, 0, 0.21, 0.42]
/** Altura del líquido verde neón dentro de cada tubo. */
const TUBE_LIQUID_H = [0.55, 0.38, 0.72, 0.45, 0.62]

/** Descriptor de una burbuja que sube en bucle dentro de un recipiente. */
interface BubbleSpec {
  x: number
  z: number
  /** Y donde nace (fondo del líquido). */
  bottom: number
  /** Y donde desaparece (superficie del líquido). */
  top: number
  size: number
  speed: number
  phase: number
}

/**
 * Matraz Erlenmeyer: cono ancho + cuello cilíndrico delgado + borde,
 * con líquido emisivo en el fondo. El líquido se registra fuera (onLiquidRef)
 * para poder pulsar su emissiveIntensity en el useFrame principal.
 */
function ErlenmeyerFlask({
  position,
  scale = 1,
  accent,
  onLiquidRef,
}: {
  position: [number, number, number]
  scale?: number
  accent: string
  onLiquidRef: (el: THREE.Mesh | null) => void
}) {
  return (
    <group position={position} scale={scale}>
      {/* Cuerpo cónico del matraz (vidrio abierto y doble cara) */}
      <mesh position={[0, 0.275, 0]}>
        <cylinderGeometry args={[0.13, 0.34, 0.55, 20, 1, true]} />
        <meshStandardMaterial
          color="#9fffd8"
          transparent
          opacity={0.16}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Cuello cilíndrico fino */}
      <mesh position={[0, 0.68, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.28, 16, 1, true]} />
        <meshStandardMaterial
          color="#9fffd8"
          transparent
          opacity={0.18}
          roughness={0.1}
          metalness={0.1}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Borde del cuello */}
      <mesh position={[0, 0.82, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.1, 0.018, 8, 20]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.7}
          metalness={0.6}
          roughness={0.25}
        />
      </mesh>

      {/* Líquido brillante en el fondo (cono invertido acorde al matraz) */}
      <mesh ref={onLiquidRef} position={[0, 0.13, 0]}>
        <cylinderGeometry args={[0.15, 0.3, 0.26, 20]} />
        <meshStandardMaterial
          color={accent}
          emissive={accent}
          emissiveIntensity={0.8}
          transparent
          opacity={0.92}
          roughness={0.25}
          metalness={0.1}
        />
      </mesh>
    </group>
  )
}

/**
 * Zona 1 — Testing & QA (Green #00ff88)
 * Laboratorio de pruebas: banco + porta-tubos + matraces + beaker + burbujas.
 */
export default function TestingZone({ zone }: { zone: ZoneConfig }) {
  // Grupo interior con toda la escena: la raíz conserva zone.position intacta
  const labRef = useRef<THREE.Group>(null)
  // Lupa de inspección que flota sobre la pista de cuadrícula
  const magnifierRef = useRef<THREE.Group>(null)
  // Nube de vapor (points) que asciende y se reinicia
  const vaporRef = useRef<THREE.Points>(null)
  // Refs de todos los líquidos emisivos (tubos, matraces y beaker)
  const liquidRefs = useRef<THREE.Mesh[]>([])
  // Refs de todas las burbujas (se animan por índice en useFrame)
  const bubbleRefs = useRef<THREE.Mesh[]>([])

  /** Registra un líquido en el slot `i` para poder pulsarlo después. */
  const regLiquid = (i: number) => (el: THREE.Mesh | null) => {
    if (el) liquidRefs.current[i] = el
  }

  // ── Datos de burbujas: una por recipiente, en bucle infinito ─────────────
  const BUBBLES = useMemo<BubbleSpec[]>(() => {
    const specs: BubbleSpec[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    // 2 burbujas por tubo de ensayo
    TUBE_X.forEach((tx, i) => {
      const liquidTop = BENCH_TOP + 0.17 + TUBE_LIQUID_H[i]
      for (let b = 0; b < 2; b++) {
        specs.push({
          x: RACK_X + tx + (b === 0 ? 0.014 : -0.014),
          z: b === 0 ? 0.012 : -0.012,
          bottom: BENCH_TOP + 0.26,
          top: liquidTop - 0.05,
          size: rand(0.016, 0.024),
          speed: rand(0.22, 0.42),
          phase: Math.random(),
        })
      }
    })

    // 4 burbujas en el matraz Erlenmeyer grande (x=0.5, z=-0.12)
    for (let b = 0; b < 4; b++) {
      specs.push({
        x: 0.5 + rand(-0.08, 0.08),
        z: -0.12 + rand(-0.08, 0.08),
        bottom: BENCH_TOP + 0.06,
        top: BENCH_TOP + 0.21,
        size: rand(0.022, 0.032),
        speed: rand(0.18, 0.34),
        phase: Math.random(),
      })
    }

    // 2 burbujas en el matraz pequeño (x=1.02, z=0.48, escala 0.78)
    for (let b = 0; b < 2; b++) {
      specs.push({
        x: 1.02 + rand(-0.05, 0.05),
        z: 0.48 + rand(-0.05, 0.05),
        bottom: BENCH_TOP + 0.05,
        top: BENCH_TOP + 0.16,
        size: rand(0.018, 0.024),
        speed: rand(0.2, 0.36),
        phase: Math.random(),
      })
    }

    // 2 burbujas en el vaso (beaker) (x=1.62, z=-0.3)
    for (let b = 0; b < 2; b++) {
      specs.push({
        x: 1.62 + rand(-0.1, 0.1),
        z: -0.3 + rand(-0.1, 0.1),
        bottom: BENCH_TOP + 0.06,
        top: BENCH_TOP + 0.19,
        size: rand(0.024, 0.034),
        speed: rand(0.16, 0.3),
        phase: Math.random(),
      })
    }

    return specs
  }, [])

  // ── Partículas de vapor que ascienden del banco ──────────────────────────
  const VAPOR_COUNT = 45
  const vaporPositions = useMemo(() => {
    const arr = new Float32Array(VAPOR_COUNT * 3)
    for (let i = 0; i < VAPOR_COUNT; i++) {
      const angle = Math.random() * Math.PI * 2
      const radius = Math.random() * 1.9
      arr[i * 3] = Math.cos(angle) * radius
      arr[i * 3 + 1] = BENCH_TOP + Math.random() * 2.0
      arr[i * 3 + 2] = Math.sin(angle) * radius * 0.6
    }
    return arr
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    // 1) Balanceo suave de toda la zona (rotación del grupo)
    if (labRef.current) {
      labRef.current.rotation.y = Math.sin(t * 0.25) * 0.28
      labRef.current.position.y = Math.sin(t * 0.6) * 0.04
    }

    // 2) Burbujas subiendo dentro de tubos/matraces/beaker, en bucle
    for (let i = 0; i < BUBBLES.length; i++) {
      const spec = BUBBLES[i]
      const mesh = bubbleRefs.current[i]
      if (!mesh) continue

      // Ciclo 0..1 que se repite: sube, se desvanece y vuelve a nacer abajo
      const cycle = ((t * spec.speed + spec.phase) % 1 + 1) % 1
      mesh.position.y = spec.bottom + cycle * (spec.top - spec.bottom)
      // Temblor lateral para que no suba en línea recta
      mesh.position.x = spec.x + Math.sin(t * 3 + spec.phase * 6) * 0.012
      mesh.position.z = spec.z + Math.cos(t * 2.6 + spec.phase * 6) * 0.012
      // Crece al nacer y encoge al llegar a la superficie
      mesh.scale.setScalar(0.6 + Math.sin(cycle * Math.PI) * 0.5)
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.2 + (1 - cycle) * 0.65
    }

    // 3) Pulso del emisivo de todo el líquido verde
    const pulse = 0.75 + Math.sin(t * 2.2) * 0.3
    for (let i = 0; i < liquidRefs.current.length; i++) {
      const mesh = liquidRefs.current[i]
      if (!mesh) continue
      const mat = mesh.material as THREE.MeshStandardMaterial
      mat.emissiveIntensity = pulse + Math.sin(t * 3 + i * 1.3) * 0.12
    }

    // 4) Lupa de inspección: flota, cabecea y gira sobre la cuadrícula
    if (magnifierRef.current) {
      magnifierRef.current.position.y = 0.38 + Math.sin(t * 0.9) * 0.06
      magnifierRef.current.rotation.z = Math.sin(t * 0.5) * 0.18
      magnifierRef.current.rotation.x = -0.45 + Math.sin(t * 0.7) * 0.08
    }

    // 5) Vapor subiendo y reiniciándose al llegar arriba
    if (vaporRef.current) {
      const geo = vaporRef.current.geometry
      const posAttr = geo.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array

      for (let i = 0; i < VAPOR_COUNT; i++) {
        arr[i * 3 + 1] += 0.0035
        // Oscilación horizontal muy leve
        arr[i * 3] += Math.sin(t * 0.8 + i) * 0.0008
        if (arr[i * 3 + 1] > BENCH_TOP + 2.0) {
          arr[i * 3 + 1] = BENCH_TOP + 0.05
        }
      }
      posAttr.needsUpdate = true
    }
  })

  return (
    <group position={zone.position}>
      <group ref={labRef}>
        {/* ── Aro de zona en el suelo (identidad visual de la zona) ───────── */}
        <mesh position={[0, -1.86, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.9, 0.05, 12, 48]} />
          <meshBasicMaterial
            color={zone.accent}
            transparent
            opacity={0.3}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* ── Banco de laboratorio ────────────────────────────────────────── */}
        {/* Tapabajo */}
        <mesh position={[0, BENCH_TOP, 0]}>
          <boxGeometry args={[4.0, 0.14, 1.7]} />
          <meshStandardMaterial color="#0a1410" metalness={0.6} roughness={0.4} />
        </mesh>

        {/* Canto neón delantero del banco */}
        <mesh position={[0, BENCH_TOP, 0.86]}>
          <boxGeometry args={[4.0, 0.04, 0.02]} />
          <meshStandardMaterial
            color={zone.accent}
            emissive={zone.accent}
            emissiveIntensity={1.1}
          />
        </mesh>

        {/* Patas del banco (terminan justo sobre la rejilla-suelo de y=-1.9) */}
        {[
          [-1.8, -0.7],
          [1.8, -0.7],
          [-1.8, 0.7],
          [1.8, 0.7],
        ].map(([lx, lz], i) => (
          <mesh key={`leg-${i}`} position={[lx, -1.42, lz]}>
            <boxGeometry args={[0.1, 0.94, 0.1]} />
            <meshStandardMaterial color="#06100b" metalness={0.8} roughness={0.3} />
          </mesh>
        ))}

        {/* ── Porta-tubos con 5 tubos de ensayo ───────────────────────────── */}
        <group position={[RACK_X, BENCH_TOP, 0]}>
          {/* Base-cajeta del porta-tubos */}
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[1.16, 0.1, 0.44]} />
            <meshStandardMaterial color="#0c1a13" metalness={0.7} roughness={0.35} />
          </mesh>

          {/* Soporte vertical: dos postes laterales */}
          {[-0.5, 0.5].map((px) => (
            <mesh key={`post-${px}`} position={[px, 0.68, 0]}>
              <boxGeometry args={[0.07, 1.16, 0.07]} />
              <meshStandardMaterial color="#0f211a" metalness={0.85} roughness={0.25} />
            </mesh>
          ))}

          {/* Barra superior perforada (donde se "sujeta" cada tubo) */}
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[1.16, 0.07, 0.44]} />
            <meshStandardMaterial color="#0f211a" metalness={0.85} roughness={0.25} />
          </mesh>

          {/* Anillos-marco de los huecos de la barra superior */}
          {TUBE_X.map((tx) => (
            <mesh key={`hole-${tx}`} position={[tx, 1.235, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.085, 0.014, 8, 20]} />
              <meshStandardMaterial
                color={zone.accent}
                emissive={zone.accent}
                emissiveIntensity={0.8}
              />
            </mesh>
          ))}

          {/* TUBOS DE ENSAYO: vidrio alto y delgado + fondo redondeado + líquido */}
          {TUBE_X.map((tx, i) => (
            <group key={`tube-${tx}`} position={[tx, 0, 0]}>
              {/* Cuerpo del tubo (vidrio) */}
              <mesh position={[0, 0.645, 0]}>
                <cylinderGeometry args={[0.065, 0.065, 1.05, 14, 1, true]} />
                <meshStandardMaterial
                  color="#9fffd8"
                  transparent
                  opacity={0.16}
                  roughness={0.1}
                  metalness={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/* Fondo redondeado del tubo */}
              <mesh position={[0, 0.12, 0]}>
                <sphereGeometry args={[0.065, 12, 10]} />
                <meshStandardMaterial
                  color="#9fffd8"
                  transparent
                  opacity={0.16}
                  roughness={0.1}
                  metalness={0.1}
                  side={THREE.DoubleSide}
                />
              </mesh>

              {/* Líquido verde brillante (altura distinta por tubo) */}
              <mesh ref={regLiquid(i)} position={[0, 0.17 + TUBE_LIQUID_H[i] / 2, 0]}>
                <cylinderGeometry args={[0.05, 0.055, TUBE_LIQUID_H[i], 14]} />
                <meshStandardMaterial
                  color={zone.accent}
                  emissive={zone.accent}
                  emissiveIntensity={0.8}
                  transparent
                  opacity={0.92}
                  roughness={0.25}
                  metalness={0.1}
                />
              </mesh>
            </group>
          ))}
        </group>

        {/* ── Matraz Erlenmeyer grande ────────────────────────────────────── */}
        <ErlenmeyerFlask
          position={[0.5, BENCH_TOP, -0.12]}
          accent={zone.accent}
          onLiquidRef={regLiquid(5)}
        />

        {/* ── Matraz Erlenmeyer pequeño ───────────────────────────────────── */}
        <ErlenmeyerFlask
          position={[1.02, BENCH_TOP, 0.48]}
          scale={0.78}
          accent={zone.accent}
          onLiquidRef={regLiquid(6)}
        />

        {/* ── Vaso de laboratorio (beaker): cilindro abierto con líquido ──── */}
        <group position={[1.62, BENCH_TOP, -0.3]}>
          {/* Pared abierta del vaso */}
          <mesh position={[0, 0.23, 0]}>
            <cylinderGeometry args={[0.26, 0.26, 0.46, 24, 1, true]} />
            <meshStandardMaterial
              color="#9fffd8"
              transparent
              opacity={0.16}
              roughness={0.1}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Fondo del vaso */}
          <mesh position={[0, 0.01, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.26, 24]} />
            <meshStandardMaterial
              color="#9fffd8"
              transparent
              opacity={0.18}
              roughness={0.1}
              metalness={0.1}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Borde superior */}
          <mesh position={[0, 0.46, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.26, 0.02, 8, 24]} />
            <meshStandardMaterial
              color={zone.accent}
              emissive={zone.accent}
              emissiveIntensity={0.6}
              metalness={0.6}
              roughness={0.25}
            />
          </mesh>

          {/* Marcas de graduación */}
          {[0.14, 0.24, 0.34].map((my) => (
            <mesh key={`mark-${my}`} position={[0, my, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.262, 0.005, 6, 24]} />
              <meshBasicMaterial
                color={zone.accent}
                transparent
                opacity={0.35}
                blending={THREE.AdditiveBlending}
              />
            </mesh>
          ))}

          {/* Líquido del vaso */}
          <mesh ref={regLiquid(7)} position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.24, 24]} />
            <meshStandardMaterial
              color={zone.accent}
              emissive={zone.accent}
              emissiveIntensity={0.8}
              transparent
              opacity={0.9}
              roughness={0.25}
              metalness={0.1}
            />
          </mesh>
        </group>

        {/* ── Pista de cuadrícula / coordenadas sobre el banco ────────────── */}
        <mesh
          position={[-0.15, BENCH_TOP + 0.006, 0.6]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[0.7, 0.7, 6, 6]} />
          <meshBasicMaterial
            color={zone.accent}
            wireframe
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* ── Lupa de inspección flotando sobre la cuadrícula ─────────────── */}
        <group ref={magnifierRef} position={[-0.15, 0.38, 0.6]} rotation={[-0.45, 0, 0]}>
          {/* Aro de la lupa */}
          <mesh>
            <torusGeometry args={[0.26, 0.03, 12, 32]} />
            <meshStandardMaterial
              color={zone.accent}
              emissive={zone.accent}
              emissiveIntensity={0.9}
              metalness={0.7}
              roughness={0.2}
            />
          </mesh>

          {/* Cristal translúcido */}
          <mesh>
            <circleGeometry args={[0.25, 32]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.07}
              blending={THREE.AdditiveBlending}
              side={THREE.DoubleSide}
            />
          </mesh>

          {/* Mango */}
          <mesh position={[0.21, -0.21, 0]} rotation={[0, 0, Math.PI / 4]}>
            <cylinderGeometry args={[0.03, 0.03, 0.28, 10]} />
            <meshStandardMaterial
              color="#0f211a"
              metalness={0.85}
              roughness={0.25}
            />
          </mesh>
        </group>

        {/* ── Burbujas animadas dentro de tubos, matraces y beaker ────────── */}
        {BUBBLES.map((b, i) => (
          <mesh
            key={`bubble-${i}`}
            ref={(el) => {
              if (el) bubbleRefs.current[i] = el
            }}
            position={[b.x, b.bottom, b.z]}
          >
            <sphereGeometry args={[b.size, 8, 8]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        ))}

        {/* ── Vapor: partículas que ascienden del banco ───────────────────── */}
        {/* ⚠️ attach="attributes-position" es OBLIGATORIO (nunca attach="position") */}
        <points ref={vaporRef}>
          <bufferGeometry>
            {/* ⚠️ attach="attributes-position" es OBLIGATORIO (nunca attach="position").
                args=[array, itemSize] calcula `count`; con props sueltas count=0 y no se dibuja. */}
            <bufferAttribute attach="attributes-position" args={[vaporPositions, 3]} />
          </bufferGeometry>
          <pointsMaterial
            color={zone.accent}
            size={0.05}
            sizeAttenuation
            transparent
            opacity={0.45}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>

        {/* Luz neón central que tiñe todo el laboratorio de verde */}
        <pointLight color={zone.accent} intensity={12} distance={14} decay={2} position={[0, 0.6, 0.8]} />
      </group>
    </group>
  )
}
