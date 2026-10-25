import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'
import { globalPointer } from '../globalPointer'

/**
 * Zona 0 — "Cara Virtual" (identidad digital, cian #00f0ff)
 *
 * En vez de una cabeza o una esfera, aquí se dibuja una CARA holográfica:
 * máscara elíptica achatada en Z + dos ojos emisivos + cresta nasal triangular
 * + boca luminosa + cejas + contorno facial, todo envuelto en un escáner
 * (anillos horizontales que barren en vertical) y un retículo de análisis.
 *
 * La cara mira hacia +Z (hacia la cámara) y flota sutilmente sobre una base
 * con haz de proyección. Todo queda centrado en el origen local [0,0,0],
 * dentro de radio ~3.5 y por encima de la rejilla-suelo en y = -1.9.
 */

// --- Parámetros de animación -------------------------------------------------
// Se viven a nivel de módulo para no re-crearlos en cada render.

/** Velocidad de la flotación vertical de la cara. */
const FLOAT_SPEED = 0.6
/** Amplitud de la flotación (mantiene la cara bien por encima del suelo). */
const FLOAT_AMOUNT = 0.12
/** Cada cuántos segundos ocurre un guiño completo. */
const BLINK_PERIOD = 4.2
/** Duración de cada guiño, en segundos. */
const BLINK_DURATION = 0.25
/** Escala base de los ojos: [ancho, alto, profundidad] — aplastados = "lentes". */
const EYE_SCALE: [number, number, number] = [0.3, 0.17, 0.12]
/** Rango vertical que recorren los anillos del escáner. */
const SCAN_Y_MIN = -1.25
const SCAN_Y_MAX = 1.25
/** Desfases de los 3 anillos de escaneo para que no viajen todos juntos. */
const SCAN_RINGS = [
  { phase: 0, speed: 0.7 },
  { phase: (Math.PI * 2) / 3, speed: 0.7 },
  { phase: (Math.PI * 4) / 3, speed: 0.7 },
]
/** Número de partículas de identidad orbitando la cara. */
const PARTICLE_COUNT = 42

// --- Seguimiento del puntero -------------------------------------------------
// La cara no está quieta: gira hacia donde está el cursor. Estos valores
// limitan el rango para que nunca "rompa el cuello" ni pierda el encuadre.
/** Giro máximo en horizontal (rad). */
const LOOK_YAW = 0.42
/** Inclinación máxima en vertical (rad). */
const LOOK_PITCH = 0.26
/** Lambda del amortiguamiento: más alto = la cabeza es más "ágil". */
const LOOK_SMOOTH = 4.5
/** Recorrido de cada pupila dentro de su ojo. */
const PUPIL_RANGE_X = 0.07
const PUPIL_RANGE_Y = 0.05

// --- Habla -------------------------------------------------------------------
/** Duración de una frase completa, en segundos. */
const SPEECH_PHRASE = 6.4
/** Fracción de la frase en la que realmente está hablando (el resto, silencio). */
const SPEECH_DUTY = 0.66

export default function ArchitectureZone({ zone }: { zone: ZoneConfig }) {
  // Grupo animado: la cara entera flota y se balancea aquí dentro.
  // La traslación de la zona (zone.position) vive SOLO en el <group> raíz,
  // así el origen local de la cara permanece en [0,0,0] y no se duplica.
  const faceRef = useRef<THREE.Group>(null)
  const leftEyeRef = useRef<THREE.Group>(null)
  const rightEyeRef = useRef<THREE.Group>(null)
  const leftIrisRef = useRef<THREE.Mesh>(null)
  const rightIrisRef = useRef<THREE.Mesh>(null)
  const mouthRef = useRef<THREE.Group>(null)
  const jawRef = useRef<THREE.Group>(null)
  const mouthGlowRef = useRef<THREE.Mesh>(null)
  const reticleRef = useRef<THREE.Group>(null)
  const scanRefs = useRef<(THREE.Mesh | null)[]>([null, null, null])
  const particlesRef = useRef<THREE.Points>(null)

  // Estado del seguimiento y del habla, en un ref para no reasignarlo nunca.
  // `look` guarda la pose ya amortiguada; `speech` la apertura actual de boca.
  const motion = useRef({ yaw: 0, pitch: 0, speech: 0 })

  // Partículas de identidad: posiciones procedurales memorizadas, para que el
  // buffer no se recree en cada render (y para tener valores base estables).
  const { particlePositions, particleColors, particleBaseY, particlePhases, particleRadii } =
    useMemo(() => {
      const positions = new Float32Array(PARTICLE_COUNT * 3)
      const colors = new Float32Array(PARTICLE_COUNT * 3)
      const baseY = new Float32Array(PARTICLE_COUNT)
      const phases = new Float32Array(PARTICLE_COUNT)
      const radii = new Float32Array(PARTICLE_COUNT)

      const accent = new THREE.Color(zone.accent)
      const pale = new THREE.Color('#ffffff')

      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const angle = (i / PARTICLE_COUNT) * Math.PI * 2
        const radius = 1.9 + Math.random() * 0.8
        const height = -1.3 + Math.random() * 2.8

        positions[i * 3] = Math.cos(angle) * radius
        positions[i * 3 + 1] = height
        positions[i * 3 + 2] = Math.sin(angle) * radius

        // Mezcla entre el acento y blanco: da sensación de "datos" dispersos.
        const c = accent.clone().lerp(pale, Math.random() * 0.5)
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b

        baseY[i] = height
        phases[i] = Math.random() * Math.PI * 2
        radii[i] = radius
      }

      return {
        particlePositions: positions,
        particleColors: colors,
        particleBaseY: baseY,
        particlePhases: phases,
        particleRadii: radii,
      }
    }, [zone.accent])

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime
    const dt = Math.min(delta, 0.1) // tope: si el tab queda en background, no saltes
    const m = motion.current

    // 0) SEGUIMIENTO DEL PUNTERO. Usamos el puntero GLOBAL (escuchado en
    //    `window`) y no `state.pointer` de R3F: este último sólo se alimenta
    //    de eventos sobre el canvas, así que la cara se congelaba en cuanto
    //    el ratón pasaba por encima de las capas DOM (pestañas, HUD, dossier).
    const targetYaw = THREE.MathUtils.clamp(globalPointer.x, -1, 1) * LOOK_YAW
    const targetPitch = THREE.MathUtils.clamp(globalPointer.y, -1, 1) * LOOK_PITCH
    m.yaw = THREE.MathUtils.damp(m.yaw, targetYaw, LOOK_SMOOTH, dt)
    m.pitch = THREE.MathUtils.damp(m.pitch, targetPitch, LOOK_SMOOTH, dt)

    // 1) Flotación + balanceo + mirada. La mirada se SUMA al balanceo
    //    idle, así la cara se siente viva pero sigue al cursor.
    if (faceRef.current) {
      faceRef.current.position.y = Math.sin(t * FLOAT_SPEED) * FLOAT_AMOUNT
      faceRef.current.rotation.y = Math.sin(t * 0.35) * 0.08 + m.yaw
      faceRef.current.rotation.x = Math.sin(t * 0.27) * 0.03 - m.pitch
    }

    // 2) Parpadeo: base con seno (micro-movimiento continuo) + guiño rápido
    //    cada BLINK_PERIOD segundos que cierra casi por completo los ojos.
    const blinkPhase = t % BLINK_PERIOD
    const blink =
      blinkPhase < BLINK_DURATION ? Math.sin((blinkPhase / BLINK_DURATION) * Math.PI) : 0
    const lid = 1 - blink * 0.9 // 1 = ojo abierto, 0.1 = ojo casi cerrado
    const squint = 1 + Math.sin(t * 2.1) * 0.04
    const eyeY = lid * squint
    if (leftEyeRef.current) {
      leftEyeRef.current.scale.set(EYE_SCALE[0], EYE_SCALE[1] * eyeY, EYE_SCALE[2])
    }
    if (rightEyeRef.current) {
      rightEyeRef.current.scale.set(EYE_SCALE[0], EYE_SCALE[1] * eyeY, EYE_SCALE[2])
    }

    // 2b) PUPILAS: dentro de cada ojo hay un iris que se desplaza hacia el
    //     cursor. Es lo que hace que la mirada se lea como "te está siguiendo"
    //     y no solo como "la cabeza gira".
    const irisX = m.yaw * (PUPIL_RANGE_X / LOOK_YAW)
    const irisY = m.pitch * (PUPIL_RANGE_Y / LOOK_PITCH)
    if (leftIrisRef.current) {
      leftIrisRef.current.position.x = -0.42 + irisX
      leftIrisRef.current.position.y = 0.38 + irisY
    }
    if (rightIrisRef.current) {
      rightIrisRef.current.position.x = 0.42 + irisX
      rightIrisRef.current.position.y = 0.38 + irisY
    }

    // 3) HABLA. La señal se construye en 3 capas, como un habla real:
    //      · `syl`    — ritmo de sílabas (~8.5 Hz, rango real de articulación).
    //                    Se eleva a 0.45 para ENSANCHAR los picos: un seno
    //                    plano pasa muy poco tiempo cerca de 1 y la boca
    //                    quedaba siempre entreabierta, ilegible a esta escala.
    //      · `mod`    — énfasis lento, siempre positivo, para evitar el
    //                    metrónomo sin deprimir la amplitud media.
    //      · `envelope`— ráfagas de frase con pausas de silencio.
    //    `speechOpen` va de 0 (boca cerrada) a 1 (boca bien abierta).
    const syl = Math.pow(Math.abs(Math.sin(t * 8.5)), 0.32)
    const mod = 0.6 + 0.4 * Math.abs(Math.sin(t * 2.3))
    const phrasePhase = (t % SPEECH_PHRASE) / SPEECH_PHRASE
    const envelope = phrasePhase < SPEECH_DUTY ? 1 : 0
    const targetOpen = envelope * syl * mod
    // Amortiguado: sin él la mandíbula saltaría a cada frame y se leería roto.
    // Lambda alto = sigue las sílabas con nitidez pero sin vibración mecánica.
    m.speech = THREE.MathUtils.damp(m.speech, targetOpen, 22, dt)

    if (jawRef.current) {
      // La mandíbula baja bastante: a esta escala un movimiento tímido
      // ni se ve. El eje X añade el giro de articulación.
      jawRef.current.position.y = -0.02 - m.speech * 0.38
      jawRef.current.rotation.x = m.speech * 0.26
    }
    if (mouthGlowRef.current) {
      // El interior de la boca se abre: es lo que realmente vende la "voz".
      // Sin esto sólo se verían dos barras separándose, sin cavidad.
      mouthGlowRef.current.scale.y = 0.12 + m.speech * 1.35
      mouthGlowRef.current.scale.x = 1 - m.speech * 0.1
      const mat = mouthGlowRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = 0.3 + m.speech * 0.6
    }
    if (mouthRef.current) {
      // El labio superior respira un poco con la voz. Hacemos el cast porque
      // `children` se tipa como Object3D genérico, aunque sepamos que ahí
      // hay un mesh con material básico.
      const upper = mouthRef.current.children[0] as THREE.Mesh | undefined
      const mat = upper?.material as THREE.MeshBasicMaterial | undefined
      if (mat) mat.opacity = 0.7 + m.speech * 0.3
    }

    // 4) Retículo de escaneo girando lento (sensación de "análisis facial").
    if (reticleRef.current) {
      reticleRef.current.rotation.z = t * 0.35
    }

    // 5) Anillos del escáner: barren la cara de abajo hacia arriba con desfases.
    scanRefs.current.forEach((mesh, i) => {
      const cfg = SCAN_RINGS[i]
      if (!mesh || !cfg) return
      const wave = (Math.sin(t * cfg.speed + cfg.phase) + 1) / 2 // 0..1
      mesh.position.y = THREE.MathUtils.lerp(SCAN_Y_MIN, SCAN_Y_MAX, wave)
      // Se desvanecen en los extremos para que el barrido se lea limpio.
      const fade = 1 - Math.abs(wave - 0.5) * 2
      const mat = mesh.material as THREE.MeshBasicMaterial
      mat.opacity = 0.1 + fade * 0.55
    })

    // 6) Partículas de identidad orbitando la cara.
    if (particlesRef.current) {
      const posAttr = particlesRef.current.geometry.attributes.position
      if (posAttr instanceof THREE.BufferAttribute) {
        const arr = posAttr.array as Float32Array
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          const phase = particlePhases[i]
          const angle = t * 0.25 + phase + (i / PARTICLE_COUNT) * Math.PI * 2
          const radius = particleRadii[i] + Math.sin(t * 0.5 + phase) * 0.15

          arr[i * 3] = Math.cos(angle) * radius
          arr[i * 3 + 2] = Math.sin(angle) * radius
          arr[i * 3 + 1] = particleBaseY[i] + Math.sin(t * 0.9 + phase) * 0.22
        }
        posAttr.needsUpdate = true
      }
    }
  })

  return (
    // Raíz: única portadora de la traslación de la zona (origen local en [0,0,0]).
    <group position={zone.position}>
      {/* ===================== CARA HOLOGRÁFICA ===================== */}
      <group ref={faceRef}>
        {/* Plano facial: elipsoide MUY achatado en Z. Se lee como máscara/ cara
            de perfil frontal, no como una bola. */}
        <mesh scale={[1.05, 1.35, 0.25]}>
          <sphereGeometry args={[1, 28, 20]} />
          <meshStandardMaterial
            color="#02141c"
            metalness={0.5}
            roughness={0.4}
            emissive={zone.accent}
            emissiveIntensity={0.25}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Cascarón wireframe encima: refuerza el look de holograma construido
            con malla poligonal. */}
        <mesh scale={[1.08, 1.38, 0.27]}>
          <sphereGeometry args={[1, 16, 12]} />
          <meshBasicMaterial
            color={zone.accent}
            wireframe
            transparent
            opacity={0.22}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* Contorno facial: torus elíptico que enmarca la silueta de la cara. */}
        <mesh scale={[1.05, 1.35, 1]}>
          <torusGeometry args={[1.02, 0.028, 8, 64]} />
          <meshStandardMaterial
            color={zone.accent}
            metalness={0.8}
            roughness={0.2}
            emissive={zone.accent}
            emissiveIntensity={0.9}
          />
        </mesh>

        {/* ---- OJOS: dos lentes emisivos achatados y simétricos ---- */}
        <group ref={leftEyeRef} position={[-0.42, 0.38, 0.22]} scale={EYE_SCALE}>
          <mesh>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          {/* Halo aditivo alrededor del lente: el bloom lo convierte en neón. */}
          <mesh scale={1.45}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>
        <group ref={rightEyeRef} position={[0.42, 0.38, 0.22]} scale={EYE_SCALE}>
          <mesh>
            <sphereGeometry args={[1, 16, 12]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          <mesh scale={1.45}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.3}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* ---- IRIS/PUPILA: se desplaza dentro del ojo siguiendo al cursor.
            Va como hermano de los ojos (no hijo) para que el parpadeo, que
            escala el grupo del ojo, no arrugue la pupila. ---- */}
        <mesh ref={leftIrisRef} position={[-0.42, 0.38, 0.33]}>
          <circleGeometry args={[0.075, 20]} />
          <meshBasicMaterial color="#02141c" toneMapped={false} />
        </mesh>
        <mesh ref={rightIrisRef} position={[0.42, 0.38, 0.33]}>
          <circleGeometry args={[0.075, 20]} />
          <meshBasicMaterial color="#02141c" toneMapped={false} />
        </mesh>

        {/* Cejas: dos barras finas inclinadas. Detalle barato que hace que la
            silueta se lea como CARA al instante. */}
        <mesh position={[-0.44, 0.68, 0.24]} rotation={[0, 0, 0.12]}>
          <boxGeometry args={[0.36, 0.045, 0.04]} />
          <meshBasicMaterial color={zone.accent} transparent opacity={0.55} />
        </mesh>
        <mesh position={[0.44, 0.68, 0.24]} rotation={[0, 0, -0.12]}>
          <boxGeometry args={[0.36, 0.045, 0.04]} />
          <meshBasicMaterial color={zone.accent} transparent opacity={0.55} />
        </mesh>

        {/* NARIZ: cresta triangular fina apuntando hacia +Z (hacia la cámara).
            El cono con 3 segmentos radiales da sección triangular. */}
        <mesh position={[0, -0.02, 0.3]} rotation={[Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.085, 0.3, 3]} />
          <meshBasicMaterial color={zone.accent} transparent opacity={0.8} />
        </mesh>

        {/* ================= BOCA HABLADORA =================
            Compuesta en 3 piezas para que se abra de verdad:
              · labio superior fijo
              · interior luminoso que escala en Y (la abertura)
              · mandíbula (grupo) que baja y rota al hablar
            Todo anclado en el mismo origen local de la boca. */}
        <group ref={mouthRef} position={[0, -0.55, 0.24]}>
          {/* Labio superior: se mantiene quieto, es el ancla de la articulación */}
          <mesh position={[0, 0.035, 0.01]}>
            <boxGeometry args={[0.74, 0.055, 0.05]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.9} />
          </mesh>

          {/* Interior de la boca: escala en Y con la apertura. Es lo que hace
              que se lea como "habla" en vez de como una barra que tiembla. */}
          <mesh ref={mouthGlowRef} position={[0, -0.01, 0]} scale={[1, 0.15, 1]}>
            <planeGeometry args={[0.62, 0.2]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.4}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          {/* Mandíbula: baja y rota con las sílabas (animada en useFrame) */}
          <group ref={jawRef} position={[0, -0.02, 0]}>
            <mesh position={[0, -0.03, 0.01]}>
              <boxGeometry args={[0.7, 0.05, 0.05]} />
              <meshBasicMaterial color="#ffffff" toneMapped={false} transparent opacity={0.9} />
            </mesh>
          </group>

          {/* Halo de la boca: más ancho y tenue, para que el neón "se derrame". */}
          <mesh position={[0, -0.03, -0.02]}>
            <boxGeometry args={[0.9, 0.24, 0.03]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.22}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* ---- ESCÁNER: anillos finos horizontales que barren la cara en Y ---- */}
        {SCAN_RINGS.map((cfg, i) => (
          <mesh
            key={cfg.phase}
            ref={(el) => {
              scanRefs.current[i] = el
            }}
            rotation={[-Math.PI / 2, 0, 0]}
            // Escala local (x, y) → tras rotar -90° sobre X: x = ancho, z = fondo.
            // El anillo queda plano, abrazando el corte horizontal de la cara.
            scale={[1.15, 0.32, 1]}
          >
            <ringGeometry args={[1, 1.06, 64]} />
            <meshBasicMaterial
              color={zone.accent}
              transparent
              opacity={0.5}
              side={THREE.DoubleSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>

      {/* ========== RETÍCULO DE ESCANEO frontal (gira sobre su eje Z) ========== */}
      <group ref={reticleRef} position={[0, 0, 0.55]}>
        <mesh>
          <torusGeometry args={[1.5, 0.012, 6, 72]} />
          <meshBasicMaterial
            color={zone.accent}
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* Cuatro marcas radiales (E, O, N, S) como las de una mira de cámara. */}
        <mesh position={[1.5, 0, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.03]} />
          <meshBasicMaterial color={zone.accent} toneMapped={false} />
        </mesh>
        <mesh position={[-1.5, 0, 0]}>
          <boxGeometry args={[0.18, 0.03, 0.03]} />
          <meshBasicMaterial color={zone.accent} toneMapped={false} />
        </mesh>
        <mesh position={[0, 1.5, 0]}>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
          <meshBasicMaterial color={zone.accent} toneMapped={false} />
        </mesh>
        <mesh position={[0, -1.5, 0]}>
          <boxGeometry args={[0.03, 0.18, 0.03]} />
          <meshBasicMaterial color={zone.accent} toneMapped={false} />
        </mesh>
      </group>

      {/* ========== BASE holográfica (fija, no flota con la cara) ========== */}
      {/* Anillo que "ancla" la cara sobre la rejilla-suelo. */}
      <mesh position={[0, -1.62, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1, 0.03, 8, 48]} />
        <meshStandardMaterial
          color={zone.accent}
          metalness={0.8}
          roughness={0.2}
          emissive={zone.accent}
          emissiveIntensity={0.8}
        />
      </mesh>
      {/* Haz de proyección: cono abierto y muy tenue que sube de la base. */}
      <mesh position={[0, -0.35, 0]}>
        <cylinderGeometry args={[1, 0.12, 2.6, 24, 1, true]} />
        <meshBasicMaterial
          color={zone.accent}
          transparent
          opacity={0.05}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* ========== PARTÍCULAS DE IDENTIDAD orbitando ========== */}
      <points ref={particlesRef}>
        <bufferGeometry>
          {/* ⚠️ attach="attributes-position" / "attributes-color" — NUNCA
              attach="position", eso asigna a geometry.position y revienta el
              render loop. Los `args` hacen que el constructor calcule `count`,
              sin el cual three dibuja 0 puntos. */}
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
          <bufferAttribute attach="attributes-color" args={[particleColors, 3]} />
        </bufferGeometry>
        <pointsMaterial
          size={0.06}
          sizeAttenuation
          vertexColors
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </points>

      {/* Luz principal de la zona, coloreada con el acento del config. */}
      <pointLight color={zone.accent} intensity={12} distance={16} decay={2} position={[0, 0.2, 1.2]} />
    </group>
  )
}
