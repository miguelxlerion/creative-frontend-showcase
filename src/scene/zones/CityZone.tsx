import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid, Instance, Instances } from '@react-three/drei'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'
import {
  CITY_BUILDING_COUNT,
  CITY_GROUND_Y,
  CITY_LAYOUT,
} from '../../config/cityLayout'
import { STATUS_COLORS, useExperienceStore } from '../../store/useExperienceStore'

/**
 * Zona 4 — "Eco-Smart City Digital Twin" (verde eco #00ff88)
 *
 * 560 edificios con UNA sola draw call: `Instances` de drei (THREE.InstancedMesh).
 *
 * ⚠️ POR QUÉ HAY HIJOS `<Instance>` VACÍOS:
 * drei fija `count = min(limit, range, instances.length)` dentro de su
 * `useFrame` (Instances.js:135-136). Sin hijos, `count = 0` → **la ciudad
 * entera es invisible y no hay ningún error en consola** (el mismo bug
 * silencioso del `count = 0` de los bufferAttribute). Además `raycast` del
 * InstancedMesh está deshabilitado (`raycast: () => null`) y se delega en el
 * `PositionMesh` de cada `<Instance>`, así que sin hijos no habría clics.
 *
 * ⚠️ POR QUÉ SOBRESCRIBO LOS BUFFERS EN useFrame:
 * el orden de suscripción R3F es hijos → padre, así que el `useFrame` de
 * drei corre ANTES que el mío. drei escribe las transforms POR DEFECTO de los
 * PositionMesh y yo las piso con las animadas. Como mi escritura va después,
 * los valores finales del frame son los míos, y el raycast de drei lee
 * exactamente esos mismos buffers → lo que se ve es lo que se pulsa.
 *
 * Rendimiento:
 *  - Los buffers se escriben directamente en `useFrame` con `needsUpdate`.
 *  - El store se lee con `getState()` (sin suscripción): el tick IoT de 2 s
 *    NO re-renderiza este componente ni las 560 instancias.
 *  - Material UNLIT: la ciudad apagada no recibe luz ni IBL, así que todo el
 *    brillo sale del `instanceColor`: máximo en el seleccionado, suave en el
 *    hover y apagado en el resto.
 */

/** Velocidad de interpolación de color/altura (suaviza los saltos IoT). */
const LERP_SPEED = 3.2
/** Amplitud de la "respiración" global de la ciudad. */
const BREATH_AMOUNT = 0.03
/** Frecuencia de la respiración. */
const BREATH_SPEED = 1.6
/** Factor de escala al pasar el ratón por encima. */
const HOVER_SCALE = 1.18
/** Factor de escala del edificio seleccionado. */
const SELECT_SCALE = 1.12
/**
 * Multiplicadores de brillo. El pulso oscila entre 0.64 y 1.0, así que
 * `HOVER_GLOW` nunca alcanza a `SELECT_GLOW`: el hover se lee como un
 * encendido suave y el seleccionado siempre domina.
 */
const SELECT_GLOW = 1.9
const HOVER_GLOW = 0.95
/** Brillo de los edificios que coinciden con el filtro de consumo. */
const FILTER_GLOW = 1.25
/**
 * Multiplicador del tono base de los edificios que NO coinciden con el
 * filtro. Al atenuarlos por debajo de BASE_GLOW, los del nivel elegido
 * destacan sin necesidad de ocultar la ciudad.
 */
const FILTER_DIM = 0.28
/** Índice de esta zona en `ZONES` (el hover sólo vive aquí). */
const CITY_ZONE_INDEX = 4
/**
 * Color base de un edificio apagado (lineal). Es deliberadamente tenue: debe
 * leerse como silueta contra la rejilla sin disparar el Bloom (umbral 0.65).
 */
const BASE_GLOW: readonly [number, number, number] = [0.055, 0.075, 0.1]

// Objetos temporales a nivel de módulo: se reutilizan cada frame para no
// crear basura en el GC (son seguros: JS es mono-hilo y sólo los usa
// este componente dentro de su useFrame).
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()

export default function CityZone({ zone }: { zone: ZoneConfig }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  // Refs a los PositionMesh de cada Instance (para raycasting correcto)
  const instanceRefs = useRef<(THREE.Mesh | null)[]>([])

  /**
   * Estado visual imperativo (fuera de React): `colors`/`heights` es el valor
   * ACTUAL interpolado hacia el objetivo del store. Si estuviera en estado
   * React, cada frame re-renderizaría las 560 instancias.
   */
  const visual = useRef({
    colors: new Float32Array(CITY_BUILDING_COUNT * 3),
    targetColors: new Float32Array(CITY_BUILDING_COUNT * 3),
    heights: new Float32Array(CITY_BUILDING_COUNT),
    targetHeights: new Float32Array(CITY_BUILDING_COUNT),
  })

  /**
   * Material UNLIT a propósito. Con `MeshStandardMaterial` el `Environment`
   * del Scene baña la ciudad en IBL y los edificios apagados se ven gris
   * claro, aunque su emissive sea negro: three r169 sobreescribe
   * `envMapIntensity` con `scene.environmentIntensity` cuando el material no
   * tiene `envMap` propio (WebGLRenderer.js:2106-2110), así que poner
   * `envMapIntensity: 0` NO desactiva el IBL. Con un material sin luces, el
   * color final es exactamente `instanceColor`: negro/tenue apagado y color
   * de estado sólo en hover.
   */
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: '#ffffff',
        vertexColors: true,
        toneMapped: false,
      }),
    [],
  )

  /**
   * Geometría compartida: una caja para las 560 instancias. Como el material
   * es unlit, se hornea un sombreado por cara en los vertex colors; sin él
   * las seis caras se ven planas y cada edificio parece un rectángulo.
   */
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const normals = geo.attributes.normal
    const shade = new Float32Array(normals.count * 3)
    // Luz falsa desde arriba-izquierda-frente (sólo para dar volumen).
    const lx = 0.35
    const ly = 0.86
    const lz = 0.37

    for (let i = 0; i < normals.count; i++) {
      const d = Math.max(0, normals.getX(i) * lx + normals.getY(i) * ly + normals.getZ(i) * lz)
      const v = 0.45 + 0.55 * d
      shade[i * 3] = v
      shade[i * 3 + 1] = v
      shade[i * 3 + 2] = v
    }
    geo.setAttribute('color', new THREE.BufferAttribute(shade, 3))
    return geo
  }, [])

  // Liberar recursos al desmontar (StrictMode monta dos veces → cuenta).
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Raycaster manual: alimenta el hover (brillo) y el clic (selección).
  const raycaster = useRef(new THREE.Raycaster())
  const mouse = useRef(new THREE.Vector2())
  const pointerInside = useRef(false)
  const clickRequested = useRef(false)

  // Puntero sobre el canvas. No se usan eventos de R3F porque las capas DOM
  // (HUD, paneles, pestañas) se comen `state.pointer` (gotcha 4.2).
  useEffect(() => {
    const canvas = document.querySelector('canvas')
    if (!canvas) return

    const updateMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    }

    const onMove = (e: MouseEvent) => {
      pointerInside.current = true
      updateMouse(e)
    }
    const onEnter = () => {
      pointerInside.current = true
    }
    const onLeave = () => {
      pointerInside.current = false
    }
    const onClick = (e: MouseEvent) => {
      pointerInside.current = true
      updateMouse(e)
      clickRequested.current = true
    }

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerenter', onEnter)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('click', onClick)

    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerenter', onEnter)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('click', onClick)
    }
  }, [])

  /** Edificio bajo el cursor (AABB contra las cajas base del layout). */
  const pickBuilding = (camera: THREE.Camera): number => {
    raycaster.current.setFromCamera(mouse.current, camera)
    const origin = raycaster.current.ray.origin
    const dir = raycaster.current.ray.direction
    const inv = (c: number) => (Math.abs(c) > 1e-6 ? 1 / c : Math.sign(c) * 1e6 || 1e6)
    const invX = inv(dir.x)
    const invY = inv(dir.y)
    const invZ = inv(dir.z)

    let closest = -1
    let closestDist = Infinity

    for (let i = 0; i < CITY_LAYOUT.length; i++) {
      const b = CITY_LAYOUT[i]
      const cx = zone.position[0] + b.x
      const cy = zone.position[1] + CITY_GROUND_Y + b.h / 2
      const cz = zone.position[2] + b.z
      const hx = b.w / 2
      const hy = b.h / 2
      const hz = b.d / 2

      const tminX = Math.min((cx - hx - origin.x) * invX, (cx + hx - origin.x) * invX)
      const tmaxX = Math.max((cx - hx - origin.x) * invX, (cx + hx - origin.x) * invX)
      const tminY = Math.min((cy - hy - origin.y) * invY, (cy + hy - origin.y) * invY)
      const tmaxY = Math.max((cy - hy - origin.y) * invY, (cy + hy - origin.y) * invY)
      const tminZ = Math.min((cz - hz - origin.z) * invZ, (cz + hz - origin.z) * invZ)
      const tmaxZ = Math.max((cz - hz - origin.z) * invZ, (cz + hz - origin.z) * invZ)

      const tmin = Math.max(tminX, tminY, tminZ)
      const tmax = Math.min(tmaxX, tmaxY, tmaxZ)

      if (tmax >= tmin && tmax >= 0) {
        const dist = tmin >= 0 ? tmin : tmax
        if (dist < closestDist) {
          closest = i
          closestDist = dist
        }
      }
    }

    return closest
  }

  /**
   * Bucle de animación: interpola color/altura hacia el objetivo IoT,
   * aplica respiración + hover/selección y vuelca TODO a los buffers de
   * drei (que ya existen y están vinculados al InstancedMesh).
   */
  useFrame((state, delta) => {
    const mesh = meshRef.current
    if (!mesh || !mesh.instanceColor || !mesh.instanceMatrix) return

    const dt = Math.min(delta, 0.1) // tope: pestaña en background no salta
    const t = state.clock.elapsedTime
    const v = visual.current

    // Lectura imperativa: sin suscripción → el tick IoT no re-renderiza aquí.
    const store = useExperienceStore.getState()
    const data = store.cityData
    const selected = store.selectedBuilding
    // Filtro de consumo: se lee del store sin suscripción. Al cambiar,
    // este bucle interpola colores; no hay re-render de las 560 instancias.
    const filter = store.energyFilter
    const filterActive = filter !== 'all'

    // Hover bajo el cursor. Se recalcula cada frame (no sólo al mover el
    // ratón) porque la cámara vuela: el rayo cambia aunque el cursor esté
    // quieto. Fuera de la zona, o con el puntero sobre el HUD, no hay hover.
    const hoverId =
      store.activeZone === CITY_ZONE_INDEX && store.phase === 'experience' && pointerInside.current
        ? pickBuilding(state.camera)
        : -1
    // Sincroniza el anillo del cursor sólo cuando cambia (evita setState por frame).
    if (store.sceneHover !== (hoverId >= 0)) store.setSceneHover(hoverId >= 0)

    const colorArr = mesh.instanceColor.array as Float32Array
    const matrixArr = mesh.instanceMatrix.array as Float32Array
    // Pulso lento del neón (sin él, el brillo se siente estático).
    const glowPulse = 0.82 + Math.sin(t * BREATH_SPEED * 1.6) * 0.18

    for (let i = 0; i < CITY_BUILDING_COUNT; i++) {
      const b = CITY_LAYOUT[i]
      const d = data[i]
      if (!b || !d) continue

      const isHover = hoverId === i
      const isSel = selected?.id === i
      const isFilterMatch = filterActive && d.status === filter

      // --- Objetivo de color -------------------------------------------
      // Jerarquía: seleccionado > coincidencia con el filtro > hover (sólo
      // sin filtro) > apagado. Con un filtro activo, pasar el ratón por un
      // edificio de OTRO nivel no lo ilumina: la vista debe seguir siendo
      // legible. Su escala sí reacciona y al pulsarlo se abre su panel.
      if (isSel || isFilterMatch || (isHover && !filterActive)) {
        const tc = STATUS_COLORS[d.status]
        v.targetColors[i * 3] = tc[0]
        v.targetColors[i * 3 + 1] = tc[1]
        v.targetColors[i * 3 + 2] = tc[2]
      } else {
        // Con filtro, el resto se apaga por debajo del tono base para que
        // el nivel elegido domine la escena sin ocultar la ciudad.
        const dim = filterActive ? FILTER_DIM : 1
        v.targetColors[i * 3] = BASE_GLOW[0] * dim
        v.targetColors[i * 3 + 1] = BASE_GLOW[1] * dim
        v.targetColors[i * 3 + 2] = BASE_GLOW[2] * dim
      }
      // Pico de energía → el edificio crece un poco (pico de datos).
      v.targetHeights[i] = b.h * (1 + (d.energy - 50) * 0.004)

      // --- Interpolación exponencial (suave, independiente de fps) -----
      const k = 1 - Math.exp(-LERP_SPEED * dt)
      v.colors[i * 3] += (v.targetColors[i * 3] - v.colors[i * 3]) * k
      v.colors[i * 3 + 1] += (v.targetColors[i * 3 + 1] - v.colors[i * 3 + 1]) * k
      v.colors[i * 3 + 2] += (v.targetColors[i * 3 + 2] - v.colors[i * 3 + 2]) * k
      v.heights[i] += (v.targetHeights[i] - v.heights[i]) * k

      // --- Efectos locales --------------------------------------------
      const breath = 1 + Math.sin(t * BREATH_SPEED + i * 0.13) * BREATH_AMOUNT
      const scaleMul = (isHover ? HOVER_SCALE : 1) * (isSel ? SELECT_SCALE : 1)
      // Hover sobre el propio seleccionado = brillo de selección. Los
      // edificios del filtro laten con la ciudad; el hover sobre uno de
      // ellos añade un pequeño extra para confirmar la interacción.
      const glow = isSel
        ? SELECT_GLOW * glowPulse
        : isFilterMatch
          ? FILTER_GLOW * glowPulse * (isHover ? 1.12 : 1)
          : isHover && !filterActive
            ? HOVER_GLOW * glowPulse
            : 1

      const h = v.heights[i] * breath * scaleMul

      // --- Volcado a los buffers de drei -------------------------------
      colorArr[i * 3] = Math.min(2, v.colors[i * 3] * glow)
      colorArr[i * 3 + 1] = Math.min(2, v.colors[i * 3 + 1] * glow)
      colorArr[i * 3 + 2] = Math.min(2, v.colors[i * 3 + 2] * glow)

      _p.set(b.x, CITY_GROUND_Y + h / 2, b.z)
      _q.identity()
      _s.set(b.w * scaleMul, h, b.d * scaleMul)
      _m.compose(_p, _q, _s)
      _m.toArray(matrixArr, i * 16)
    }

    mesh.instanceColor.needsUpdate = true
    mesh.instanceMatrix.needsUpdate = true

    // drei crea el InstancedMesh con count = 0 y el renderer cachea su
    // boundingSphere con radio -1. Al subir el count después, la esfera NO se
    // recalcula y `Frustum.intersectsSphere` descarta la ciudad entera: 0
    // errores en consola, 0 edificios en pantalla. Se recalcula en cuanto hay
    // matrices reales (una sola vez; la esfera envolvente ya es válida).
    if (mesh.count > 0 && (!mesh.boundingSphere || mesh.boundingSphere.radius <= 0)) {
      mesh.computeBoundingSphere()
    }

    // Actualizar también los PositionMesh de los Instance children
    // para que el raycasting funcione correctamente (drei delega el
    // raycast a los PositionMesh de los Instance children).
    for (let i = 0; i < CITY_BUILDING_COUNT; i++) {
      const instanceMesh = instanceRefs.current[i]
      if (instanceMesh) {
        const b = CITY_LAYOUT[i]
        const d = data[i]
        if (!b || !d) continue

        const isHover = hoverId === i
        const isSel = selected?.id === i
        const breath = 1 + Math.sin(t * BREATH_SPEED + i * 0.13) * BREATH_AMOUNT
        const scaleMul = (isHover ? HOVER_SCALE : 1) * (isSel ? SELECT_SCALE : 1)
        const h = v.heights[i] * breath * scaleMul

        _p.set(b.x, CITY_GROUND_Y + h / 2, b.z)
        _q.identity()
        _s.set(b.w * scaleMul, h, b.d * scaleMul)
        _m.compose(_p, _q, _s)
        instanceMesh.matrix.copy(_m)
        instanceMesh.matrixWorld.copy(_m)
        instanceMesh.matrixAutoUpdate = false
      }
    }

    // Clic = seleccionar el edificio que está brillando (mismo pick que el
    // hover, así lo que se pulsa es exactamente lo que se ve). Clic en vacío
    // deselecciona.
    if (clickRequested.current) {
      clickRequested.current = false
      const picked = hoverId >= 0 ? data[hoverId] : null
      store.setSelectedBuilding(picked ?? null)
    }
  })

  return (
    <group position={zone.position}>
      {/* Rejilla luminosa local: se desvanece con la niebla (Grid de drei). */}
      <Grid
        position={[0, CITY_GROUND_Y + 0.01, 0]}
        args={[30, 30]}
        cellSize={0.65}
        cellThickness={0.5}
        cellColor="#0a3324"
        sectionSize={3.9}
        sectionThickness={1}
        sectionColor={zone.accent}
        fadeDistance={34}
        fadeStrength={1.6}
        infiniteGrid={false}
      />

      {/* Plano invisible para raycasting: clic en suelo = deseleccionar.
          Ya no necesario: el raycasting manual maneja deselección al no
          impactar ningún edificio. */}

      {/*
        InstancedMesh de drei: UNA draw call para 560 edificios.
        - geometry/material como props (R3F los asigna tras el constructor).
        - Los hijos `<Instance>` vacíos son OBLIGATORIOS: fijan el `count`
          (drei lo calcula de instances.length) y habilitan el raycast.
          Sus transforms no se usan: mi useFrame pisa el buffer entero.
          Además, capturamos refs a los PositionMesh para actualizar sus
          transforms en useFrame y que el raycasting funcione correctamente.
          Cada Instance tiene un Mesh invisible (opacity: 0) como hijo
          para que el raycasting funcione: el PositionMesh delega el
          raycast a sus hijos Mesh. Sin hijos Mesh visibles, el Group
          no tiene geometría para intersectar.
      */}
      <Instances
        ref={meshRef}
        limit={CITY_BUILDING_COUNT}
        range={CITY_BUILDING_COUNT}
        geometry={geometry}
        material={material}
        castShadow
        receiveShadow
      >
        {CITY_LAYOUT.map((b, idx) => (
          <Instance
            key={b.id}
            ref={(el) => {
              // Instance forwardRef -> PositionMesh (extends Mesh)
              if (el) instanceRefs.current[idx] = el as THREE.Mesh
            }}
          >
            {/* Mesh invisible (opacity: 0) para raycasting: el PositionMesh
                delega el raycast a sus hijos Mesh. Con visible={false} no
                se raycast; con opacity: 0 pero visible={true} sí. */}
            <mesh>
              <boxGeometry args={[1, 1, 1]} />
              <meshBasicMaterial transparent opacity={0} />
            </mesh>
          </Instance>
        ))}
      </Instances>
    </group>
  )
}
