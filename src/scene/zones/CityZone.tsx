import { Suspense, useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Grid, Instance, Instances, useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import type { ZoneConfig } from '../../config/zones'
import {
  CITY_BUILDING_COUNT,
  CITY_GROUND_Y,
  CITY_LAYOUT,
} from '../../config/cityLayout'
import { STATUS_COLORS, useExperienceStore } from '../../store/useExperienceStore'
import { useReducedMotion } from '../../hooks/useReducedMotion'

/**
 * Zona 4 — "Eco-Smart City Digital Twin" (verde eco #00ff88)
 *
 * ~500 edificios low-poly (`/models/building.glb`) con UNA sola draw call:
 * `Instances` de drei (THREE.InstancedMesh). La geometría del GLB se
 * normaliza a una caja unitaria y cada instancia se estira a su parcela.
 *
 * ⚠️ POR QUÉ HAY HIJOS `<Instance>` VACÍOS:
 * drei fija `count = min(limit, range, instances.length)` dentro de su
 * `useFrame` (Instances.js:135-136). Sin hijos, `count = 0` → **la ciudad
 * entera es invisible y no hay ningún error en consola** (el mismo bug
 * silencioso del `count = 0` de los bufferAttribute). Los hijos no llevan
 * geometría: el pick se resuelve con el AABB manual contra `CITY_LAYOUT`.
 *
 * ⚠️ POR QUÉ SOBRESCRIBO LOS BUFFERS EN useFrame:
 * el orden de suscripción R3F es hijos → padre, así que el `useFrame` de
 * drei corre ANTES que el mío. drei escribe las transforms POR DEFECTO de los
 * PositionMesh y yo las piso con las animadas. Como mi escritura va después,
 * los valores finales del frame son los míos; el hover y el clic usan ese
 * mismo layout y la cámara real, no los transforms de drei, así que lo que
 * se ve es lo que se pulsa.
 *
 * Rendimiento:
 *  - Los buffers se escriben directamente en `useFrame` con `needsUpdate`.
 *  - El store se lee con `getState()` (sin suscripción): el tick IoT de 2 s
 *    NO re-renderiza este componente ni las ~500 instancias.
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
const BASE_GLOW: readonly [number, number, number] = [0.04, 0.055, 0.075]

// Objetos temporales a nivel de módulo: se reutilizan cada frame para no
// crear basura en el GC (son seguros: JS es mono-hilo y sólo los usa
// este componente dentro de su useFrame).
const _m = new THREE.Matrix4()
const _p = new THREE.Vector3()
const _q = new THREE.Quaternion()
const _s = new THREE.Vector3()
const _up = new THREE.Vector3(0, 1, 0)

/** Modelo low-poly compartido por los ~500 edificios instanciados. */
const BUILDING_MODEL_URL = '/models/building.glb'

/** Volumen mínimo (unidades normalizadas) para considerar un cascarón invertido. */
const SHELL_VOLUME_EPS = 1e-6
/** Área mínima para reparar un componente (evita tocar triángulos sueltos). */
const SHELL_AREA_EPS = 1e-5

/**
 * Repara componentes con el winding y las normales hacia dentro.
 *
 * El GLB de 3ds Max trae las tres ventanas de la planta baja como un
 * componente independiente con volumen firmado negativo: desde la fachada
 * se ven como caras traseras (invisibles con FrontSide) y, al hornear el
 * sombreado, quedan mal iluminadas. Se detectan por volumen firmado y se
 * invierten; las normales autoradas del resto del modelo se conservan.
 */
function repairInvertedShells(geometry: THREE.BufferGeometry) {
  const positionAttr = geometry.getAttribute('position')
  const normalAttr = geometry.getAttribute('normal')
  if (
    !(positionAttr instanceof THREE.BufferAttribute) ||
    !(normalAttr instanceof THREE.BufferAttribute)
  ) {
    return
  }

  const vertexCount = positionAttr.count
  const triangleCount = vertexCount / 3
  const welded = new Map<string, number>()
  const vertexIds = new Int32Array(vertexCount)

  for (let i = 0; i < vertexCount; i++) {
    const key = `${positionAttr.getX(i).toFixed(4)},${positionAttr.getY(i).toFixed(4)},${positionAttr.getZ(i).toFixed(4)}`
    let id = welded.get(key)
    if (id === undefined) {
      id = welded.size
      welded.set(key, id)
    }
    vertexIds[i] = id
  }

  const parent = new Int32Array(welded.size)
  for (let i = 0; i < parent.length; i++) parent[i] = i

  const find = (index: number): number => {
    let root = index
    while (parent[root] !== root) root = parent[root]
    while (parent[index] !== index) {
      const next = parent[index]
      parent[index] = root
      index = next
    }
    return root
  }
  const union = (a: number, b: number) => {
    const rootA = find(a)
    const rootB = find(b)
    if (rootA !== rootB) parent[rootB] = rootA
  }

  for (let t = 0; t < triangleCount; t++) {
    const i0 = t * 3
    union(vertexIds[i0], vertexIds[i0 + 1])
    union(vertexIds[i0 + 1], vertexIds[i0 + 2])
  }

  const volumes = new Map<number, number>()
  const areas = new Map<number, number>()
  const triangleRoots = new Int32Array(triangleCount)

  for (let t = 0; t < triangleCount; t++) {
    const i0 = t * 3
    const i1 = i0 + 1
    const i2 = i0 + 2
    const root = find(vertexIds[i0])
    triangleRoots[t] = root

    const ax = positionAttr.getX(i0)
    const ay = positionAttr.getY(i0)
    const az = positionAttr.getZ(i0)
    const bx = positionAttr.getX(i1)
    const by = positionAttr.getY(i1)
    const bz = positionAttr.getZ(i1)
    const cx = positionAttr.getX(i2)
    const cy = positionAttr.getY(i2)
    const cz = positionAttr.getZ(i2)

    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cx - ax
    const vy = cy - ay
    const vz = cz - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx

    areas.set(root, (areas.get(root) ?? 0) + Math.hypot(nx, ny, nz) * 0.5)
    volumes.set(
      root,
      (volumes.get(root) ?? 0) +
        (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6,
    )
  }

  const inverted = new Set<number>()
  for (const [root, volume] of volumes) {
    if (volume < -SHELL_VOLUME_EPS && (areas.get(root) ?? 0) > SHELL_AREA_EPS) {
      inverted.add(root)
    }
  }
  if (inverted.size === 0) return

  const positions = positionAttr.array as Float32Array
  const normals = normalAttr.array as Float32Array

  for (let t = 0; t < triangleCount; t++) {
    if (!inverted.has(triangleRoots[t])) continue

    const i0 = t * 3
    const i1 = i0 + 1
    const i2 = i0 + 2

    // Invertir el winding: intercambiar los vértices 1 y 2 (posición y normal).
    for (let axis = 0; axis < 3; axis++) {
      const p1 = i1 * 3 + axis
      const p2 = i2 * 3 + axis
      const tmpPos = positions[p1]
      positions[p1] = positions[p2]
      positions[p2] = tmpPos

      const tmpNormal = normals[p1]
      normals[p1] = normals[p2]
      normals[p2] = tmpNormal
    }

    // Si la normal autorada quedó al lado contrario del nuevo winding, se
    // niega; así el sombreado también queda del lado exterior.
    const ax = positions[i0 * 3]
    const ay = positions[i0 * 3 + 1]
    const az = positions[i0 * 3 + 2]
    const bx = positions[i1 * 3]
    const by = positions[i1 * 3 + 1]
    const bz = positions[i1 * 3 + 2]
    const cx = positions[i2 * 3]
    const cy = positions[i2 * 3 + 1]
    const cz = positions[i2 * 3 + 2]

    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cx - ax
    const vy = cy - ay
    const vz = cz - az

    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const avgX = normals[i0 * 3] + normals[i1 * 3] + normals[i2 * 3]
    const avgY = normals[i0 * 3 + 1] + normals[i1 * 3 + 1] + normals[i2 * 3 + 1]
    const avgZ = normals[i0 * 3 + 2] + normals[i1 * 3 + 2] + normals[i2 * 3 + 2]

    if (nx * avgX + ny * avgY + nz * avgZ < 0) {
      for (let v = i0; v <= i2; v++) {
        normals[v * 3] *= -1
        normals[v * 3 + 1] *= -1
        normals[v * 3 + 2] *= -1
      }
    }
  }

  positionAttr.needsUpdate = true
  normalAttr.needsUpdate = true
}

/** Distancia del origen del rayo: la geometría ya está normalizada (~1 ud). */
const RAY_ORIGIN_DISTANCE = 50

/**
 * Corrige caras sueltas visibles desde fuera cuyo winding apunta al interior.
 *
 * El volumen firmado por componente no basta: el muro trasero y varios
 * detalles de la fachada derecha forman parte del componente principal (cuyo
 * volumen neto es positivo), así que quedan con la normal hacia dentro. Con
 * `FrontSide` esas caras se descartan y el edificio se ve hueco desde atrás.
 *
 * Para no tocar las caras interiores legítimas, cada cara sospechosa se
 * comprueba con un rayo lanzado desde el lado exterior de su bounding box.
 * Sólo se invierte si es la primera superficie que se ve desde fuera y su
 * normal apunta hacia dentro. Así los tabiques y losas interiores quedan
 * intactos porque el muro exterior los oculta.
 */
function repairInwardFacingWalls(geometry: THREE.BufferGeometry) {
  const positionAttr = geometry.getAttribute('position')
  const normalAttr = geometry.getAttribute('normal')
  if (
    !(positionAttr instanceof THREE.BufferAttribute) ||
    !(normalAttr instanceof THREE.BufferAttribute)
  ) {
    return
  }

  geometry.computeBoundingBox()
  const bounds = geometry.boundingBox
  if (!bounds) return

  const positions = positionAttr.array as Float32Array
  const normals = normalAttr.array as Float32Array
  const triangleCount = positionAttr.count / 3

  /** Primer impacto del rayo contra la malla (triángulo y distancia t). */
  const raycast = (
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
  ): { triangle: number; distance: number } => {
    let nearest = -1
    let nearestT = Infinity

    for (let t = 0; t < triangleCount; t++) {
      const i0 = t * 9
      const i1 = i0 + 3
      const i2 = i0 + 6

      const ax = positions[i0]
      const ay = positions[i0 + 1]
      const az = positions[i0 + 2]
      const e1x = positions[i1] - ax
      const e1y = positions[i1 + 1] - ay
      const e1z = positions[i1 + 2] - az
      const e2x = positions[i2] - ax
      const e2y = positions[i2 + 1] - ay
      const e2z = positions[i2 + 2] - az

      const px = dy * e2z - dz * e2y
      const py = dz * e2x - dx * e2z
      const pz = dx * e2y - dy * e2x
      const det = e1x * px + e1y * py + e1z * pz
      if (Math.abs(det) < 1e-12) continue

      const inv = 1 / det
      const tx = ox - ax
      const ty = oy - ay
      const tz = oz - az
      const u = (tx * px + ty * py + tz * pz) * inv
      if (u < 0 || u > 1) continue

      const qx = ty * e1z - tz * e1y
      const qy = tz * e1x - tx * e1z
      const qz = tx * e1y - ty * e1x
      const v = (dx * qx + dy * qy + dz * qz) * inv
      if (v < 0 || u + v > 1) continue

      const hitT = (e2x * qx + e2y * qy + e2z * qz) * inv
      if (hitT > 1e-6 && hitT < nearestT) {
        nearestT = hitT
        nearest = t
      }
    }

    return { triangle: nearest, distance: nearestT }
  }

  const bboxMin = bounds.min
  const bboxMax = bounds.max
  const sideDistances = [0, 0, 0, 0, 0, 0]
  const sideDirection = [0, 0, 0]
  let flipped = 0

  for (let t = 0; t < triangleCount; t++) {
    const p = t * 9
    const ax = positions[p]
    const ay = positions[p + 1]
    const az = positions[p + 2]
    const bx = positions[p + 3]
    const by = positions[p + 4]
    const bz = positions[p + 5]
    const cx = positions[p + 6]
    const cy = positions[p + 7]
    const cz = positions[p + 8]

    const ux = bx - ax
    const uy = by - ay
    const uz = bz - az
    const vx = cx - ax
    const vy = cy - ay
    const vz = cz - az
    const nx = uy * vz - uz * vy
    const ny = uz * vx - ux * vz
    const nz = ux * vy - uy * vx
    const normalLength = Math.hypot(nx, ny, nz)
    if (normalLength < 1e-9) continue

    const centerX = (ax + bx + cx) / 3
    const centerY = (ay + by + cy) / 3
    const centerZ = (az + bz + cz) / 3

    // Lado del bounding box más cercano: de ahí viene la luz que "ve" la cara.
    sideDistances[0] = centerX - bboxMin.x
    sideDistances[1] = bboxMax.x - centerX
    sideDistances[2] = centerY - bboxMin.y
    sideDistances[3] = bboxMax.y - centerY
    sideDistances[4] = centerZ - bboxMin.z
    sideDistances[5] = bboxMax.z - centerZ

    let side = 0
    for (let i = 1; i < 6; i++) {
      if (sideDistances[i] < sideDistances[side]) side = i
    }

    const axis = side >> 1
    const sign = side % 2 === 0 ? -1 : 1
    sideDirection[0] = 0
    sideDirection[1] = 0
    sideDirection[2] = 0
    sideDirection[axis] = sign

    const dot =
      (nx * sideDirection[0] + ny * sideDirection[1] + nz * sideDirection[2]) /
      normalLength
    // Sólo las caras claramente vueltas hacia dentro son candidatas.
    if (dot > -0.15) continue

    const originX = centerX + sideDirection[0] * RAY_ORIGIN_DISTANCE
    const originY = centerY + sideDirection[1] * RAY_ORIGIN_DISTANCE
    const originZ = centerZ + sideDirection[2] * RAY_ORIGIN_DISTANCE
    const hit = raycast(
      originX,
      originY,
      originZ,
      -sideDirection[0],
      -sideDirection[1],
      -sideDirection[2],
    )
    if (hit.triangle !== t) continue

    // Invertir el winding: intercambiar los vértices 1 y 2.
    const i0 = p
    const i1 = p + 3
    const i2 = p + 6
    for (let k = 0; k < 3; k++) {
      const a = i1 + k
      const b = i2 + k
      const tmpPosition = positions[a]
      positions[a] = positions[b]
      positions[b] = tmpPosition
      const tmpNormal = normals[a]
      normals[a] = normals[b]
      normals[b] = tmpNormal
    }

    // Nueva normal geométrica: las normales autoradas que queden al lado
    // contrario se niegan para que el sombreado siga apuntando fuera.
    const nax = positions[i0]
    const nay = positions[i0 + 1]
    const naz = positions[i0 + 2]
    const nbx = positions[i1]
    const nby = positions[i1 + 1]
    const nbz = positions[i1 + 2]
    const ncx = positions[i2]
    const ncy = positions[i2 + 1]
    const ncz = positions[i2 + 2]
    const nux = nbx - nax
    const nuy = nby - nay
    const nuz = nbz - naz
    const nvx = ncx - nax
    const nvy = ncy - nay
    const nvz = ncz - naz
    const gx = nuy * nvz - nuz * nvy
    const gy = nuz * nvx - nux * nvz
    const gz = nux * nvy - nuy * nvx

    for (let k = 0; k < 3; k++) {
      const v = i0 + k * 3
      if (normals[v] * gx + normals[v + 1] * gy + normals[v + 2] * gz < 0) {
        normals[v] *= -1
        normals[v + 1] *= -1
        normals[v + 2] *= -1
      }
    }
    flipped++
  }

  if (flipped > 0) {
    positionAttr.needsUpdate = true
    normalAttr.needsUpdate = true
  }
}

export default function CityZone({ zone }: { zone: ZoneConfig }) {
  return (
    <Suspense fallback={null}>
      <CityBuildings zone={zone} />
    </Suspense>
  )
}

function CityBuildings({ zone }: { zone: ZoneConfig }) {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  // Con movimiento reducido se apagan el pulso neón, la respiración por
  // edificio y las interpolaciones: los cambios de estado se aplican de
  // golpe (feedback inmediato, sin animación continua).
  const reducedMotion = useReducedMotion()

  // `useDraco = false`: el GLB no usa compresión y así evitamos el decoder
  // remoto que drei configuraría por defecto.
  const { scene: buildingModel } = useGLTF(BUILDING_MODEL_URL, false)

  /**
   * Estado visual imperativo (fuera de React): `colors`/`heights` es el valor
   * ACTUAL interpolado hacia el objetivo del store. Si estuviera en estado
   * React, cada frame re-renderizaría las ~500 instancias.
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
   * Geometría compartida: el GLB low-poly del edificio, normalizado a una
   * caja unitaria (x/z ∈ [-0.5, 0.5], base en y=0, altura 1) para que cada
   * instancia se escale con su huella y altura del layout.
   *
   * ⚠️ Se usa la geometría CRUDA, ignorando la matriz del nodo raíz. El
   * exportador de 3ds Max añade ahí una conversión Z-up→Y-up invertida
   * (+90° en X) más la traslación del pivote; si se aplica y luego se
   * endereza, las dos rotaciones se cancelan y el edificio queda tumbado
   * (fue exactamente el bug reportado). Los vértices crudos ya vienen con
   * Z arriba y la base en z=0, así que se rota -90° en X y se recentra.
   *
   * Se pasa a no-indexado para hornear el sombreado por cara en los vertex
   * colors (con el material unlit, sin ese sombreado todas las caras se ven
   * iguales). Se conservan las normales AUTORADAS del GLB: `applyMatrix4` ya
   * las transforma con la matriz de normales, así que respetan la intención
   * del modelo. No se llama a `computeVertexNormals()`.
   */
  const geometry = useMemo(() => {
    const meshes: THREE.Mesh[] = []
    buildingModel.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh)
    })
    const source = meshes[0]
    if (!source) {
      throw new Error(`[CityZone] ${BUILDING_MODEL_URL} no contiene ninguna malla`)
    }

    const geo = source.geometry.clone()
    // 3ds Max exporta con Z arriba y la base en z=0: se endereza a Y arriba.
    geo.applyMatrix4(new THREE.Matrix4().makeRotationX(-Math.PI / 2))
    geo.computeBoundingBox()
    const bounds = geo.boundingBox!
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())

    // Normaliza en una pasada: primero centra la huella y apoya la base,
    // después divide por el tamaño para obtener la caja unitaria.
    geo.applyMatrix4(
      new THREE.Matrix4()
        .makeScale(1 / size.x, 1 / size.y, 1 / size.z)
        .multiply(
          new THREE.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z),
        ),
    )

    const flat = geo.toNonIndexed()
    geo.dispose()
    // Dos pasadas: primero los componentes enteros girados (volumen
    // firmado negativo) y después las caras sueltas de los muros exteriores
    // que miran hacia dentro. Sin la segunda, el muro trasero del modelo se
    // descarta con FrontSide y los edificios se ven huecos por detrás.
    repairInvertedShells(flat)
    repairInwardFacingWalls(flat)

    const normals = flat.attributes.normal
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
    flat.setAttribute('color', new THREE.BufferAttribute(shade, 3))
    return flat
  }, [buildingModel])

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
      // Huella girada: el AABB conservador cubre el rectángulo rotado.
      const cos = Math.abs(Math.cos(b.rot))
      const sin = Math.abs(Math.sin(b.rot))
      const hx = (cos * b.w + sin * b.d) / 2
      const hy = b.h / 2
      const hz = (sin * b.w + cos * b.d) / 2

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
    // este bucle interpola colores; no hay re-render de las ~500 instancias.
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
    const glowPulse = reducedMotion ? 1 : 0.82 + Math.sin(t * BREATH_SPEED * 1.6) * 0.18

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
        // `b.tone` varía ligeramente el material de cada edificio: sin esa
        // variación la repetición hace que parezcan copias idénticas.
        const dim = (filterActive ? FILTER_DIM : 1) * b.tone
        v.targetColors[i * 3] = BASE_GLOW[0] * dim
        v.targetColors[i * 3 + 1] = BASE_GLOW[1] * dim
        v.targetColors[i * 3 + 2] = BASE_GLOW[2] * dim
      }
      // Pico de energía → el edificio crece un poco (pico de datos).
      v.targetHeights[i] = b.h * (1 + (d.energy - 50) * 0.004)

      // --- Interpolación exponencial (suave, independiente de fps) -----
      // Con movimiento reducido no hay transición: se salta al objetivo.
      const k = reducedMotion ? 1 : 1 - Math.exp(-LERP_SPEED * dt)
      v.colors[i * 3] += (v.targetColors[i * 3] - v.colors[i * 3]) * k
      v.colors[i * 3 + 1] += (v.targetColors[i * 3 + 1] - v.colors[i * 3 + 1]) * k
      v.colors[i * 3 + 2] += (v.targetColors[i * 3 + 2] - v.colors[i * 3 + 2]) * k
      v.heights[i] += (v.targetHeights[i] - v.heights[i]) * k

      // --- Efectos locales --------------------------------------------
      const breath = reducedMotion ? 1 : 1 + Math.sin(t * BREATH_SPEED + i * 0.13) * BREATH_AMOUNT
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

      _p.set(b.x, CITY_GROUND_Y, b.z)
      _q.setFromAxisAngle(_up, b.rot)
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

      {/* Edificios instanciados: ver el bloque de <Instances> de abajo. */}

      {/*
        InstancedMesh de drei: UNA draw call para todos los edificios.
        - geometry/material como props (R3F los asigna tras el constructor).
        - Los hijos `<Instance>` vacíos son OBLIGATORIOS: fijan el `count`
          (drei lo calcula de instances.length). Sus transforms no se usan:
          mi useFrame pisa el buffer entero.
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
        {CITY_LAYOUT.map((b) => (
          <Instance key={b.id} />
        ))}
      </Instances>
    </group>
  )
}
