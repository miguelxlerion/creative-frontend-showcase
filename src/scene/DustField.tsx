import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useReducedMotion } from '../hooks/useReducedMotion'

/** Radial-gradient sprite so points read as soft orbs, not hard squares. */
function makeGlowTexture(): THREE.CanvasTexture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.6, 'rgba(255,255,255,0.14)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

/**
 * A field of soft, drifting motes distributed through the camera's volume.
 *
 * Unlike drei's <Stars> (a distant, mostly-static backdrop), this lives in the
 * near/mid field so it produces real parallax as the camera flies between
 * zones — the depth cue that sells the sense of travelling through space.
 */
export default function DustField({
  count = 900,
  spread = [52, 16, 30],
  color = '#7fd8ff',
}: {
  count?: number
  spread?: [number, number, number]
  color?: string
}) {
  const groupRef = useRef<THREE.Group>(null)
  const texture = useMemo(() => makeGlowTexture(), [])
  const reducedMotion = useReducedMotion()

  // Deterministic-ish scatter across a box; each particle drifts on its own
  // phase so the field never moves as a rigid block.
  const { positions, phases, speeds } = useMemo(() => {
    const positions = new Float32Array(count * 3)
    const phases = new Float32Array(count)
    const speeds = new Float32Array(count)
    for (let i = 0; i < count; i++) {
      positions[i * 3 + 0] = (Math.random() - 0.5) * spread[0]
      positions[i * 3 + 1] = (Math.random() - 0.5) * spread[1]
      positions[i * 3 + 2] = (Math.random() - 0.5) * spread[2]
      phases[i] = Math.random() * Math.PI * 2
      speeds[i] = 0.15 + Math.random() * 0.5
    }
    return { positions, phases, speeds }
  }, [count, spread])

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions.slice(), 3))
    return g
  }, [positions])

  useEffect(() => () => geo.dispose(), [geo])

  const baseY = useMemo(() => Float32Array.from(positions.filter((_, i) => i % 3 === 1)), [positions])

  useFrame((state) => {
    // Movimiento reducido: el polvo queda quieto y sin rotación de conjunto;
    // conserva la profundidad como fondo estático.
    if (reducedMotion) {
      if (groupRef.current) groupRef.current.rotation.y = 0
      return
    }
    const t = state.clock.elapsedTime
    const arr = geo.attributes.position.array as Float32Array
    for (let i = 0; i < count; i++) {
      const y = i * 3 + 1
      arr[y] = baseY[i] + Math.sin(t * speeds[i] + phases[i]) * 0.9
    }
    geo.attributes.position.needsUpdate = true
    if (groupRef.current) groupRef.current.rotation.y = t * 0.008
  })

  return (
    <group ref={groupRef}>
      <points geometry={geo}>
        <pointsMaterial
          map={texture}
          color={color}
          size={0.16}
          sizeAttenuation
          transparent
          opacity={0.55}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  )
}