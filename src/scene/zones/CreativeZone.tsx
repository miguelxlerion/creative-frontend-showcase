import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'

/** Acento frío secundario (cian) para contraste con el acento rojo/magenta de la zona. */
const CYAN = '#00f0ff'

/**
 * Zone 3 — Creative 3D (acento rojo/magenta #ff0055)
 * "MODELADO 3D + DATOS" — modelado 3D en curso + visualización de datos
 * para páginas web e informes empresariales.
 *
 * - CENTRO: TorusKnot en wireframe sobre un pedestal, con una nube de puntos
 *   superpuesta en sus mismos vértices (lee como "malla en edición").
 * - ALREDEDOR: primitivas de datos flotantes → gráfico de BARRAS wireframe,
 *   gráfico de TORTA (segmentos de cilindro) y gráfico de LÍNEAS (lineSegments
 *   dentado) sobre un panel wireframe.
 * - REJILLA-SUELO pequeña bajo el modelo + chispas de datos orbitando.
 *
 * Todo centrado en el origen local (el padre aplica `position={zone.position}`),
 * dentro de radio ~3.5 y por encima de y=-1.9 (donde está la rejilla-suelo global).
 */
export default function CreativeZone({ zone }: { zone: ZoneConfig }) {
  // Grupos con animación
  const floatRef = useRef<THREE.Group>(null)            // flotación suave de todo el conjunto
  const modelRef = useRef<THREE.Group>(null)            // modelo sobre plato giratorio
  const barsRef = useRef<THREE.Mesh[]>([])              // barras del gráfico de barras
  const pieRef = useRef<THREE.Group>(null)              // gráfico de torta
  const lineMatRef = useRef<THREE.LineBasicMaterial>(null) // material del gráfico de líneas
  const dataPointsRef = useRef<THREE.Points>(null)      // vértices destacados de la línea
  const sparksRef = useRef<THREE.Points>(null)          // chispas de datos orbitando

  // Nivel base donde "apoyan" las barras (siempre por encima de la rejilla global)
  const BAR_BASE_Y = -0.9

  // ---------------------------------------------------------------
  // Geometría del modelo central: TorusKnot reutilizado por mesh + points
  // (los puntos se superponen exactamente en los vértices de la malla)
  // ---------------------------------------------------------------
  const modelGeo = useMemo(() => new THREE.TorusKnotGeometry(0.7, 0.24, 96, 12), [])

  // ---------------------------------------------------------------
  // Datos del gráfico de barras (alturas distintas + fase de animación)
  // ---------------------------------------------------------------
  const barData = useMemo(() => [
    { height: 0.6, speed: 1.1, phase: 0.0 },
    { height: 1.2, speed: 1.4, phase: 1.3 },
    { height: 0.9, speed: 0.9, phase: 2.6 },
    { height: 1.5, speed: 1.7, phase: 3.9 },
  ], [])

  // ---------------------------------------------------------------
  // Segmentos del gráfico de torta (arcos de cilindro: thetaStart + thetaLength)
  // ---------------------------------------------------------------
  const pieSegments = useMemo(() => {
    const raw = [
      { portion: 0.35, color: zone.accent },
      { portion: 0.25, color: CYAN },
      { portion: 0.22, color: '#ffffff' },
      { portion: 0.18, color: '#ff88aa' },
    ]
    let start = 0
    return raw.map((seg) => {
      const length = seg.portion * Math.PI * 2
      const item = { start, length, color: seg.color }
      start += length
      return item
    })
  }, [zone.accent])

  // ---------------------------------------------------------------
  // Trayecto dentado del gráfico de líneas (segmentos + vértices)
  // ---------------------------------------------------------------
  const { lineSegmentPositions, lineVertexPositions } = useMemo(() => {
    const pts: [number, number, number][] = [
      [-1.05, -0.35, 0],
      [-0.7, 0.05, 0],
      [-0.35, -0.2, 0],
      [0.0, 0.3, 0],
      [0.35, -0.05, 0],
      [0.7, 0.38, 0],
      [1.05, 0.12, 0],
    ]
    const segs: number[] = []
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]
      const b = pts[i + 1]
      if (!a || !b) continue
      segs.push(a[0], a[1], a[2], b[0], b[1], b[2])
    }
    const verts: number[] = []
    pts.forEach((p) => verts.push(p[0], p[1], p[2]))
    return {
      lineSegmentPositions: new Float32Array(segs),
      lineVertexPositions: new Float32Array(verts),
      lineVertexCount: pts.length,
    }
  }, [])

  // ---------------------------------------------------------------
  // Chispas de datos orbitando alrededor del conjunto
  // ---------------------------------------------------------------
  const SPARK_COUNT = 36
  const { sparkPositions, sparkColors, sparkPhases } = useMemo(() => {
    const positions = new Float32Array(SPARK_COUNT * 3)
    const colors = new Float32Array(SPARK_COUNT * 3)
    const phases = new Float32Array(SPARK_COUNT)
    const accent = new THREE.Color(zone.accent)
    const cyan = new THREE.Color(CYAN)

    for (let i = 0; i < SPARK_COUNT; i++) {
      const angle = (i / SPARK_COUNT) * Math.PI * 2
      const radius = 2.2 + Math.random() * 0.9       // nunca pasa de ~3.1 de radio
      const height = (Math.random() - 0.5) * 1.6

      positions[i * 3] = Math.cos(angle) * radius
      positions[i * 3 + 1] = height
      positions[i * 3 + 2] = Math.sin(angle) * radius

      // Mezcla cian ↔ acento para leer como "datos"
      const c = accent.clone().lerp(cyan, Math.random())
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b

      phases[i] = Math.random() * Math.PI * 2
    }
    return { sparkPositions: positions, sparkColors: colors, sparkPhases: phases }
  }, [zone.accent])

  // ---------------------------------------------------------------
  // Animación principal
  // ---------------------------------------------------------------
  useFrame((state, delta) => {
    const t = state.clock.elapsedTime

    // Flotación suave de todo el conjunto (efecto "suspendido")
    if (floatRef.current) {
      floatRef.current.position.y = Math.sin(t * 0.6) * 0.12
      floatRef.current.rotation.z = Math.sin(t * 0.4) * 0.02
    }

    // Modelo girando en su plato giratorio + balanceo en X
    if (modelRef.current) {
      modelRef.current.rotation.y += delta * 0.5
      modelRef.current.rotation.x = Math.sin(t * 0.5) * 0.15
    }

    // Barras creciendo / cambiando de altura (base siempre apoyada)
    barsRef.current.forEach((mesh, i) => {
      if (!mesh) return
      const bar = barData[i]
      if (!bar) return
      const wave = 0.5 + 0.5 * Math.sin(t * bar.speed + bar.phase)
      const h = bar.height * (0.55 + 0.45 * wave)
      mesh.scale.y = h
      mesh.position.y = BAR_BASE_Y + h / 2
    })

    // Torta girando despacio
    if (pieRef.current) {
      pieRef.current.rotation.y = t * 0.45
    }

    // Pulso del gráfico de líneas + bob de sus vértices
    if (lineMatRef.current) {
      lineMatRef.current.opacity = 0.55 + Math.sin(t * 2.2) * 0.25
    }
    if (dataPointsRef.current) {
      const s = 1 + Math.sin(t * 3) * 0.25
      dataPointsRef.current.scale.setScalar(s)
    }

    // Chispas de datos orbitando en espiral suave
    if (sparksRef.current) {
      const geo = sparksRef.current.geometry
      const posAttr = geo.attributes.position as THREE.BufferAttribute
      const arr = posAttr.array as Float32Array
      for (let i = 0; i < SPARK_COUNT; i++) {
        const phase = sparkPhases[i] ?? 0
        const radius = 2.2 + 0.5 * Math.sin(t * 0.4 + phase)
        const angle = t * 0.25 + phase
        arr[i * 3] = Math.cos(angle) * radius
        arr[i * 3 + 2] = Math.sin(angle) * radius
        arr[i * 3 + 1] = (arr[i * 3 + 1] ?? 0) * 0.95 + Math.sin(t * 1.2 + phase) * 0.02
      }
      posAttr.needsUpdate = true
    }
  })

  return (
    <group position={zone.position}>
      {/* Raíz animada: flotación suave de todo el conjunto */}
      <group ref={floatRef}>

        {/* =====================================================
            REJILLA-SUELO + PEDESTAL DEL MODELO
            ===================================================== */}
        <gridHelper
          args={[4.4, 12, zone.accent, '#441122']}
          position={[0, -1.05, 0]}
        />

        {/* Pedestal: disco con borde neón */}
        <mesh position={[0, -0.92, 0]}>
          <cylinderGeometry args={[0.9, 1.0, 0.14, 24]} />
          <meshStandardMaterial
            color="#150409"
            metalness={0.9}
            roughness={0.25}
            emissive={zone.accent}
            emissiveIntensity={0.15}
          />
        </mesh>
        <mesh position={[0, -0.85, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.92, 0.035, 8, 32]} />
          <meshBasicMaterial
            color={zone.accent}
            transparent
            opacity={0.8}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Columna corta que sostiene el modelo */}
        <mesh position={[0, -0.55, 0]}>
          <cylinderGeometry args={[0.18, 0.28, 0.5, 12]} />
          <meshStandardMaterial
            color="#0d0206"
            metalness={0.95}
            roughness={0.2}
            emissive={zone.accent}
            emissiveIntensity={0.1}
          />
        </mesh>

        {/* =====================================================
            CENTRO — MODELO 3D EN CURSO (TorusKnot wireframe + vértices)
            ===================================================== */}
        <group ref={modelRef} position={[0, 0.35, 0]}>
          {/* Malla wireframe: se lee como "modelado 3D en progreso" */}
          <mesh geometry={modelGeo}>
            <meshBasicMaterial
              color={zone.accent}
              wireframe
              transparent
              opacity={0.55}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* Superficie interna tenue para dar volumen */}
          <mesh geometry={modelGeo} scale={0.98}>
            <meshStandardMaterial
              color="#12030a"
              metalness={0.9}
              roughness={0.3}
              emissive={zone.accent}
              emissiveIntensity={0.12}
            />
          </mesh>

          {/* Nube de puntos SOBRE los vértices de la misma malla */}
          <points geometry={modelGeo}>
            <pointsMaterial
              color={CYAN}
              size={0.05}
              sizeAttenuation
              transparent
              opacity={0.9}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </group>

        {/* =====================================================
            GRÁFICO DE BARRAS WIREFRAME (izquierda)
            ===================================================== */}
        <group position={[-2.15, 0, 0.55]}>
          {/* Base del gráfico */}
          <mesh position={[0, BAR_BASE_Y - 0.03, 0]}>
            <boxGeometry args={[1.9, 0.06, 0.9]} />
            <meshStandardMaterial
              color="#150409"
              metalness={0.9}
              roughness={0.3}
              emissive={zone.accent}
              emissiveIntensity={0.1}
            />
          </mesh>

          {barData.map((bar, i) => {
            const x = -0.65 + i * 0.43
            const color = i % 2 === 0 ? zone.accent : CYAN
            return (
              <mesh
                key={i}
                ref={(el) => { if (el) barsRef.current[i] = el }}
                position={[x, BAR_BASE_Y, 0]}
                scale={[1, bar.height, 1]}
              >
                {/* Caja de unidad 1 de alto → el escalado en Y simula el crecimiento */}
                <boxGeometry args={[0.3, 1, 0.3]} />
                <meshStandardMaterial
                  color="#0d0206"
                  metalness={0.85}
                  roughness={0.25}
                  emissive={color}
                  emissiveIntensity={0.35}
                />
              </mesh>
            )
          })}

          {/* Wireframe envolvente (lee como "barras de datos" en un informe) */}
          {barData.map((bar, i) => {
            const x = -0.65 + i * 0.43
            const color = i % 2 === 0 ? zone.accent : CYAN
            return (
              <mesh
                key={`wf-${i}`}
                position={[x, BAR_BASE_Y + bar.height / 2, 0]}
              >
                <boxGeometry args={[0.32, bar.height, 0.32]} />
                <meshBasicMaterial
                  color={color}
                  wireframe
                  transparent
                  opacity={0.25}
                  blending={THREE.AdditiveBlending}
                />
              </mesh>
            )
          })}
        </group>

        {/* =====================================================
            GRÁFICO DE TORTA (derecha) — segmentos de cilindro
            ===================================================== */}
        <group position={[2.1, -0.25, 0.5]}>
          <group ref={pieRef}>
            {pieSegments.map((seg, i) => (
              <mesh key={i} rotation={[0, seg.start, 0]}>
                {/* Cilindro recortado por ángulo = porción de torta */}
                <cylinderGeometry args={[0.75, 0.75, 0.18, 24, 1, false, 0, seg.length]} />
                <meshStandardMaterial
                  color="#0d0206"
                  metalness={0.85}
                  roughness={0.25}
                  emissive={seg.color}
                  emissiveIntensity={0.5}
                />
              </mesh>
            ))}
          </group>

          {/* Anillo guía alrededor de la torta (acento frío) */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.95, 0.02, 8, 48]} />
            <meshBasicMaterial
              color={CYAN}
              transparent
              opacity={0.5}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
        </group>

        {/* =====================================================
            GRÁFICO DE LÍNEAS (arriba, al fondo) — panel wireframe
            ===================================================== */}
        <group position={[0, 1.45, -1.7]} rotation={[0, 0, 0]}>
          {/* Panel/lienzo del informe */}
          <mesh>
            <boxGeometry args={[2.6, 1.3, 0.04]} />
            <meshBasicMaterial
              color={zone.accent}
              wireframe
              transparent
              opacity={0.15}
              blending={THREE.AdditiveBlending}
            />
          </mesh>

          {/* Trayecto dentado (tendencia de datos) */}
          <lineSegments>
            <bufferGeometry>
              {/* OJO: attach SIEMPRE "attributes-position", nunca "position".
                  Y args=[array, itemSize] en vez de props: el constructor de
                  BufferAttribute calcula `count`, y sin él three dibuja 0 puntos. */}
              <bufferAttribute
                attach="attributes-position"
                args={[lineSegmentPositions, 3]}
              />
            </bufferGeometry>
            <lineBasicMaterial
              ref={lineMatRef}
              color={CYAN}
              transparent
              opacity={0.7}
              blending={THREE.AdditiveBlending}
            />
          </lineSegments>

          {/* Vértices destacados sobre el mismo trayecto */}
          <points ref={dataPointsRef}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                array={lineVertexPositions}
                itemSize={3}
              />
            </bufferGeometry>
            <pointsMaterial
              color={zone.accent}
              size={0.09}
              sizeAttenuation
              transparent
              opacity={0.95}
              blending={THREE.AdditiveBlending}
            />
          </points>
        </group>

        {/* =====================================================
            CHISPAS DE DATOS ORBITANDO
            ===================================================== */}
        <points ref={sparksRef}>
          <bufferGeometry>
            {/* attach="attributes-*" — NUNCA attach="position" (rompe el render loop).
                args=[array, itemSize] calcula `count`; con props sueltas count=0 y no se dibuja. */}
            <bufferAttribute attach="attributes-position" args={[sparkPositions, 3]} />
            <bufferAttribute attach="attributes-color" args={[sparkColors, 3]} />
          </bufferGeometry>
          <pointsMaterial
            size={0.05}
            sizeAttenuation
            vertexColors
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
          />
        </points>

        {/* =====================================================
            LUCES
            ===================================================== */}
        <pointLight color={zone.accent} intensity={10} distance={14} decay={2} />
        <pointLight position={[2.5, 3, 2.5]} color={CYAN} intensity={5} distance={12} decay={2} />
      </group>
    </group>
  )
}
