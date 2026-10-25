import { EffectComposer } from '@react-three/postprocessing'
import { Bloom, ChromaticAberration, Vignette } from '@react-three/postprocessing'
import { useThree } from '@react-three/fiber'
import { Environment, Stars, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import { ZONES } from '../config/zones'
import ArchitectureZone from './zones/ArchitectureZone'
import TestingZone from './zones/TestingZone'
import AIWorkflowZone from './zones/AIWorkflowZone'
import CreativeZone from './zones/CreativeZone'
import CityZone from './zones/CityZone'
import ProductZone from './zones/ProductZone'
import CameraController from './CameraController'
import DustField from './DustField'
import {
  BLOOM_RESOLUTION,
  CONTACT_SHADOW_RESOLUTION,
  DUST_COUNT,
  ENV_RESOLUTION,
  POST_MULTISAMPLING,
  STAR_COUNT,
} from './deviceQuality'

/**
 * Post-processing stack: el alma del look neón.
 * - Bloom: sin él no hay neón real (el emissive se queda en "color brillante").
 * - ChromaticAberration: separa RGB en bordes de alto contraste → sensación
 *   analógica / VHS / lente imperfecta.
 * - Vignette: oscurece esquinas y enfoca la atención al centro.
 *
 * Encadenamiento en @react-three/postprocessing:
 *   <EffectComposer> → sus hijos son passes de efectos.
 * Cada efecto (Bloom, ChromaticAberration, Vignette) es un componente React
 * que @react-three/postprocessing proporciona.
 *
 * Props correctas (según los tipos definidos en los ficheros .d.ts de la librería):
 * - Bloom: intensity, mipmapBlur, luminanceThreshold, luminanceSmoothing,
 *   kernelSize, resolutionScale (no: distinguishable)
 * - ChromaticAberration: offset, radialModulation (required), modulationOffset
 * - Vignette: eskil, offset, darkness (no: radialModulation/modulationOffset)
 */
function PostProcessing() {
  return (
    <EffectComposer multisampling={POST_MULTISAMPLING}>
      <Bloom intensity={1.1} mipmapBlur={true} luminanceThreshold={0.65} luminanceSmoothing={0.03} kernelSize={3} resolutionScale={BLOOM_RESOLUTION} />
      <ChromaticAberration offset={new THREE.Vector2(0.0008, 0.0008)} radialModulation={true} modulationOffset={0.0} />
      <Vignette eskil={false} offset={0.35} darkness={0.55} />
    </EffectComposer>
  )
}

/**
 * Suelo/rejilla global: cruza las 4 zonas principales y da escala.
 * Está en y = -1.9 para que todas las geometrías de zona queden por encima.
 */
function GroundGrid() {
  return (
    <gridHelper
      args={[80, 80, '#00f0ff', '#0a1a2e']}
      position={[40, -1.9, -6]}
    />
  )
}

/**
 * Luz de relleno global: ambient light + dirección suave.
 */
function AmbientFill() {
  return (
    <>
      <ambientLight color="#ffffff" intensity={0.12} />
      <ambientLight color="#111122" intensity={0.1} />
      <directionalLight color="#ffffff" intensity={0.1} />
    </>
  )
}

/**
 * Zona individual: wrapper que aplica la traslación y renderiza el
 * componente correcto según el índice.
 */
function Zone({ index }: { index: number }) {
  const zone = ZONES[index]
  switch (zone.id) {
    case 'architecture':
      return <ArchitectureZone zone={zone} />
    case 'testing':
      return <TestingZone zone={zone} />
    case 'ai':
      return <AIWorkflowZone zone={zone} />
    case 'creative':
      return <CreativeZone zone={zone} />
    case 'city':
      return <CityZone zone={zone} />
    case 'product':
      return <ProductZone zone={zone} />
    default:
      return null
  }
}

/**
 * Scene principal: todas las zonas, iluminación global, estrellas, polvo,
 * suelo y post-procesado.
 *
 * ⚠️ IMPORTANTE: cada zona ya aplica SU PROPIA traslación `zone.position`
 * en su `<group>` raíz. NO envolver cada Zone en otro `<group position={zone.position}>`:
 * eso duplicaría la traslación y las zonas 1-3 quedarían el doble de lejos,
 * fuera del encuadre de su cámara (solo la zona 0, en [0,0,0], se vería).
 */
export default function Scene() {
  // Forzar color de fondo (el canvas a veces ignora el clearColor del CSS)
  const { gl } = useThree()
  if (gl) gl.setClearColor('#05050a', 1)

  return (
    <>
      {/* Iluminación global de relleno */}
      <AmbientFill />

      {/* Environment procedural: añade reflexiones sin HDR externo.
          `preset="city"` da cubemap sintético; background=false deja
          nuestro clearColor #05050a visible. */}
      <Environment preset="city" background={false} resolution={ENV_RESOLUTION} />

      {/* Campo de estrellas lejano (parallax sutil, da profundidad). */}
      <Stars radius={120} depth={80} count={STAR_COUNT} factor={4} />

      {/* Campo de polvo local con parallax (sensación de viaje). */}
      <DustField count={DUST_COUNT} />

      {/* Cámara dirigida: vuela entre zonas, sub-temas, edificios y actos. */}
      <CameraController />

      {/* Suelo/rejilla global */}
      <GroundGrid />

      {/* Sombra de contacto suave bajo toda la escena. `frames={1}`: la escena
          es estática a esta escala (la ciudad sólo cambia colores), así que
          recalcular el mapa cada frame era gasto puro. */}
      <ContactShadows
        position={[40, -1.9, -6]}
        opacity={0.25}
        scale={80}
        blur={3}
        far={20}
        frames={1}
        resolution={CONTACT_SHADOW_RESOLUTION}
      />

      {/* Zonas 0-5: cada una en su slot mundial */}
      {ZONES.map((_, i) => <Zone key={i} index={i} />)}

      {/* Post-procesado: Bloom + ChromaticAberration + Vignette */}
      <PostProcessing />
    </>
  )
}