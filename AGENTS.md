# AGENTS.md — Contexto del proyecto `webgl-threejs-cv`

> Archivo de contexto para **agentes de IA en sesiones futuras**. Léelo antes de tocar nada.
> Idioma del dueño del proyecto: **español**. Comentarios de código y respuestas: en español.

---

## 1. ¿Qué es esto?

Portafolio/CV **interactivo en 3D** del desarrollador **Miguel E. Rodriguez — Lead Front-End Engineer**
(basado en Bogotá, Colombia). Es una experiencia WebGL navegable: la cámara vuela entre "zonas"
temáticas del currículum, cada una con su propia geometría 3D y su panel de datos.

**Stack:**

| Capa | Tecnología |
|------|-----------|
| Build | Vite 5 (`npm run dev`, `npm run build`, `npm run preview`) |
| Framework | React 18 + TypeScript 5 (estricto) |
| 3D | Three.js 0.169 + **@react-three/fiber** (R3F) + @react-three/drei + @react-three/postprocessing |
| Estado | **zustand** 5 |
| Estilos | Tailwind 3 + CSS propio con variables neón (`color-mix(in srgb, var(--accent) ...)`) |
| Fuentes | JetBrains Mono (mono) + Space Grotesk (display), vía Google Fonts en `index.html` |

**Dirección visual:** cine sci-fi neón. Fondo casi negro `#05050a`, acentos neón por zona,
efectos de post-procesado: **Bloom** (el alma del look neón), **ChromaticAberration**, **Vignette**,
más overlays DOM de grano y viñeta.

---

## 2. Estructura de archivos

```
index.html                  Título, meta, carga de fuentes
vite.config.ts              Config Vite + plugin React
tsconfig.json               TS estricto
tailwind.config.js          Tailwind
postcss.config.js           PostCSS (tailwind + autoprefixer)

src/
  main.tsx                  Punto de entrada, React.StrictMode
  App.tsx                   <Canvas> + Scene + overlays DOM + header fijo
  styles.css                TODO el CSS propio (HUD, paneles, dropdowns, keyframes)
  store/
    useExperienceStore.ts   Estado global zustand
  config/
    zones.ts                ★ Registro único de las 6 zonas (config + textos + datos)
    cityLayout.ts           ★ Layout procedural de la zona Digital Twin (560 edificios)
    productLayout.ts        ★ Layout procedural de la zona Product Configurator (8 partes dron)
  scene/
    Scene.tsx               Iluminación, Environment, Stars, DustField, suelo, zonas, post-proceso
    CameraController.tsx    Cámara cinemática con tweens (sin OrbitControls)
    DustField.tsx           Polvo local con parallax (da sensación de viaje)
    globalPointer.ts        ★ Puntero normalizado -1..1 compartido DOM ↔ 3D
    zones/
      ArchitectureZone.tsx  Zona 0 — Cara virtual holográfica (cian) — sigue el cursor y habla
      TestingZone.tsx       Zona 1 — Tests de laboratorio (verde)
      AIWorkflowZone.tsx    Zona 2 — Pipeline de IAs (morado)
      CreativeZone.tsx      Zona 3 — Modelado 3D + dataviz (rojo)
      CityZone.tsx          Zona 4 — InstancedMesh 560 edificios + IoT + hover/clic
      ProductZone.tsx       Zona 5 — Dron procedural 6 piezas + ScrollControls (4 páginas)
      productScroll.ts      ★ Puente imperativo offset del canvas → HUD DOM del configurador
  ui/
    NavigationUI.tsx        Pestañas de carpeta ARRIBA-DERECHA + dropdowns de sub-temas
    HUDOverlay.tsx          Tarjeta héroe abajo-izquierda + trigger y modal "ZONE DOSSIER"
    DetailPanel.tsx         Panel de detalle de sub-tema (entra desde la derecha)
    CursorOverlay.tsx       ★ Cursor ambiental (punto + anillo) teñido con el acento activo
    CityHUD.tsx             HUD superior-izq zona 5 (título, System Status, FPS)
    BuildingPanel.tsx       Panel contextual edificio (Framer Motion, SVG chart)
    ScrollUI.tsx            Configurator: barra de progreso continua (rAF) + una sección por página + PRE-ORDER
```

**Capas DOM (de menor a mayor `z-index`), definidas en `styles.css`:**
tarjeta héroe z-40 → trigger dossier z-55 → `DetailPanel` z-60 → pestañas + dropdown z-70/80 →
modal dossier z-90 → **capa del cursor z-200**. El wrapper `.folder-tabs` es z-70: sin eso, el
`z-index` interno del dropdown no servía porque el wrapper viejo (z-20) creaba su propio
stacking context. La capa del cursor va la última y con `pointer-events: none`: sólo observa.

---

## 3. Arquitectura de datos

### `src/config/zones.ts` — la fuente de verdad

Cada zona es una entrada de `ZoneConfig`. **La lista `ZONES` es el registro único**: la leen
tanto las geometrías 3D como la UI. **Añadir una 5ª zona = una entrada aquí + un componente en `Scene.tsx`.**

Campos por zona:

- `id`, `label` — identidad
- `position` — origen en espacio mundo (las zonas van repartidas por X: `0, 16, 32, 48`; Z se aleja en `0, -4, -8, -12`)
- `cameraPosition`, `lookAt` — dónde se posa la cámara y a qué mira al llegar
- `accent` — color neón usado en materiales emissive **y** en el HUD (via `--accent`)
- `stat` — el número/valor grande del HUD
- `hudLabel`, `subtitle`, `hudOffset`, `progress?` — copia del HUD
- `subButtons[]` — sub-temas; cada uno con `content{ title, text, metrics[] }`

Las 6 zonas actuales:

| # | id | label | accent | stat |
|---|----|-------|--------|------|
| 0 | `architecture` | Architecture | `#00f0ff` | MIGUEL E. RODRIGUEZ |
| 1 | `testing` | Testing | `#00ff88` | 85%+ |
| 2 | `ai` | AI Workflow | `#b026ff` | AI-ASSISTED |
| 3 | `creative` | Creative 3D | `#ff0055` | 60 FPS |
| 4 | `city` | Digital Twin | `#00ff88` | 500+ BUILDINGS |
| 5 | `product` | Configurator | `#ff5500` | SCROLL-DRIVEN |

### `src/store/useExperienceStore.ts`

```ts
activeZone: number        // índice de zona activa — única fuente de verdad del vuelo de cámara
isFlying: boolean         // el vuelo está en curso (lo gobierna CameraController)
activeSubSection: string | null  // sub-tema abierto dentro de la zona
openDropdown: number      // qué dropdown está abierto (-1 = ninguno)
phase: 'intro' | 'experience' | 'credits'
guided: boolean
productPhase: number      // Configurator: página visible 0..3, DERIVADA del offset de ScrollControls
setZone / setFlying / setActiveSubSection / setOpenDropdown / setProductPhase
```

`setZone` limpia `activeSubSection`, `openDropdown`, `selectedBuilding`, `sceneHover` y
`productPhase` (vuelve a 0). **No existe un campo duplicado tipo `activeSubButton`**: todos los
consumidores (NavigationUI, HUDOverlay, DetailPanel, GuidedTour, CinemaControls) leen
`activeSubSection`. **El offset continuo vive en `productScroll` (módulo imperativo), no en el
store**: el Canvas lo escribe en `useFrame` y el HUD DOM lo lee con `requestAnimationFrame`.
`productPhase` es solo la página discreta derivada (ver pasada 7).

### Cámara (`CameraController.tsx`)

**No hay OrbitControls a propósito** — es una experiencia dirigida. `CameraController` está montado
en `Scene.tsx` y es la **única autoridad de cámara en todas las zonas**.

La clave de vuelo es `phase|activeZone|activeSubSection|selectedBuilding.id`. Cuando cambia, captura
la pose REAL actual (`camera.position` + dirección de mirada) y hace un tween `easeInOutCubic`:

| Régimen | Duración |
|---------|----------|
| Zona (plano general) | 1.8 s |
| Sub-tema (arco orbital al 0.62× de distancia) | 1.5 s |
| Edificio Digital Twin (órbita isométrica) | 1.4 s |
| Intro (push-in) | 6.2 s |
| Créditos (retirada) | 7 s |

El **parallax de ratón** sale de `globalPointer` (no de `state.pointer`, ver 4.2), se suma a la pose
base en cada frame (nunca se acumula) y se atenúa al 35% durante el vuelo.

**Zona 5 (Configurator):** el vuelo de entrada aterriza directamente en un plano cercano
(`cameraPosition [80, 2, -11.5]`, `lookAt [80, 0.5, -20]`): el dron ya ocupa el encuadre al llegar.
No hay dolly intra-zona; el scroll sólo cambia la fase de la animación del producto.
`ProductZone` NO toca la cámara: si vuelve a hacerlo roba el control en todas las zonas (todas
están montadas siempre; síntoma: la cámara se queda clavada en el dron). Gracias a eso el
parallax de ratón sigue vivo dentro del Configurator.

---

## 4. ⚠️ Gotchas críticos (no vuelvas a romper esto)

### 4.1 `bufferAttribute` — DOS bugs que ya tumbaron el proyecto

**Bug A — el `attach`.** R3F resuelve `attach` como `parent[key]`:

```tsx
// ❌ INCORRECTO — asigna a geometry.position (no a attributes.position)
//    y el useFrame revienta el render loop cada frame.
<bufferAttribute attach="position" array={pos} itemSize={3} />

// ✅ CORRECTO
<bufferAttribute attach="attributes-position" args={[pos, 3]} />
```

Si `attach="position"`: `geometry.attributes.position` queda `undefined` → el `useFrame`
lanza `TypeError: Cannot read properties of undefined (reading 'array')` cada frame →
revienta todo el render loop de R3F. La UI DOM sigue visible, así que parece que
"solo falla la 3D". Aplica también a `attributes-color` y `attributes-size`,
y afecta a `points` y `lineSegments`.

**Bug B — el `count` (más silencioso, sigue en producción sin quejarse).**
`array` y `itemSize` **no se pasan como props**: se pasan como **argumentos de constructor** vía
`args`. Si van como props, R3F hace `new BufferAttribute()` sin argumentos, y
`three/src/core/BufferAttribute.js:26` calcula `this.count = array !== undefined ? array.length / itemSize : 0`
→ **`count = 0`**. Después `WebGLRenderer.js:792-796` usa ese valor para el rango de dibujado:

```js
drawEnd = Math.min( drawEnd, position.count );
const drawCount = drawEnd - drawStart;   // 0 → no se pinta NADA
```

Resultado: **sin error, sin warning, sin puntos ni líneas.** Es un fallo invisible,
fácil de confundir con "la geometría está mal colocada".

```tsx
// ❌ count = 0 → invisible, sin ningún error en consola
<bufferAttribute attach="attributes-position" array={pos} itemSize={3} />

// ✅ count calculado por el constructor
<bufferAttribute attach="attributes-position" args={[pos, 3]} />
```

**Regla de revisión:** todo `<bufferAttribute>` del proyecto debe tener `attach="attributes-*"`
**y** `args={[array, itemSize]}`. Ninguna excepción.

### 4.2 `state.pointer` de R3F no ve el DOM

R3F alimenta `state.pointer` con los eventos del elemento **canvas**. Cualquier capa DOM
superpuesta (pestañas, tarjetas HUD, dossier) se come el evento, así que lo que "sigue al
puntero" **se congela en cuanto el ratón pasa por encima de la interfaz**. Es un fallo
silencioso: la geometría se ve bien, simplemente deja de reaccionar.

**Solución:** `src/scene/globalPointer.ts` escucha `mousemove` en `window` una sola vez
(iniciado por `CursorOverlay`) y expone `globalPointer.{x,y}` normalizado en -1..1 con Y
invertido. La zona 0 lee ese objeto en su `useFrame`. Si añades otra cosa que siga al cursor,
lee `globalPointer`, no `state.pointer`.

### 4.3 `z-index` de capas DOM

Las tarjetas HUD, el dropdown y el panel de detalle son **DOM fijo superpuesto al canvas**.
Si un elemento nuevo queda tapado, casi siempre es un conflicto de `z-index` en `styles.css`.

### 4.4 StrictMode dobla montajes

`React.StrictMode` está activo: los `useEffect` corren dos veces. No guardes estado asumido
único sin limpiar.

### 4.5 Geometría procedural, sin assets de red

Todo es primitivas Three.js + buffers procedurales. **No hay HDR ni texturas que se descarguen**
(el `Environment` usa una escena procedural de meshes, no un preset remoto). Mantenlo así:
cero dependencias de red en runtime.

### 4.6 Suelo y escala

Hay una **rejilla-suelo en `y = -1.9`** que cruza las 4 zonas. Toda geometría de zona debe
quedar **centrada en el origen local** (el padre aplica `position`), dentro de **radio ~3.5**,
y **por encima de `y = -1.9`**.

---

## 5. Estado actual

### Verificado en navegador (0 errores, 0 warnings de consola; `npm run build` OK)

Los 8 puntos que el dueño pidió sobre el lienzo están **hechos y comprobados visualmente**:

1. ✅ **Zona 0 → cara virtual holográfica**: plano facial achatado + cascarón wireframe, ojos
   emisivos con parpadeo, cejas, nariz triangular, boca, contorno elíptico, 3 escáneres que
   barren en Y, retículo girando y partículas orbitando.
2. ✅ **Zona 1 → tests de laboratorio**: banco con 5 tubos de ensayo de líquido a distintas
   alturas, 2 matraces Erlenmeyer, vaso graduado, 18 burbujas subiendo, lupa flotante y vapor.
3. ✅ **Zona 2 → pipeline de IAs**: `INPUT → [COPILOT · CURSOR · RAG] → CI/CD`, nodos
   distinguibles, 6 conexiones, flechas dirigidas y 12 paquetes de datos viajando en bucle.
4. ✅ **Zona 3 → modelado 3D + datos**: `TorusKnot` wireframe con nube de puntos en los
   vértices sobre pedestal giratorio, más gráfico de barras, torta segmentada y de líneas.
5. ✅ **Navegación** → pestañas de carpeta arriba-derecha, dropdown bajo la pestaña, teclado
   (←/→/Home/End) y ARIA completo.
6. ✅ **Tarjeta héroe** reubicada abajo-a-la-izquierda (antes centrada verticalmente).
7. ✅ **Dossier** → modal **centrado exacto** en el viewport con todos los datos de la zona
   (`role="dialog"`, backdrop, foco atrapado, cierra con ×, clic fuera y Escape).
8. ✅ **Este archivo**, actualizado.

### Añadido: cursor ambiental + cara que sigue al puntero

Pedido del dueño: el cursor debe ser "parte del ambiente" tomando el color de la sección
activa, y la cara de la zona 0 debe seguirlo y mover la boca como si hablara.

**Cursor (`ui/CursorOverlay.tsx` + bloque `.cursor-*` en `styles.css`).**
Punto fino clavado al ratón + anillo neón que lo persigue con inercia (lerp en `rAF`, nunca
en CSS ni con estado React: re-renderizar por píxel es insostenible). El color lo hereda de
`--accent`, que se repinta con el `accent` de la zona activa, así que al cambiar de pestaña
el cursor cambia de piel junto con todo el HUD. Sobre elementos interactivos el anillo se
convierte en marco redondeado (`data-hover`). Sólo se activa con `pointer: fine`; en táctil
se oculta y se respeta el cursor del sistema, y con `prefers-reduced-motion` se pinta sólo
el punto.

**Cara (`zones/ArchitectureZone.tsx`).**
- *Seguimiento:* giro en yaw/pitch amortiguado hacia `globalPointer` (ver gotcha 4.2), más
  dos pupilas oscuras que se desplazan dentro del ojo. La mirada se SUMA al balanceo idle,
  así no se pierde la sensación de vida.
- *Habla:* boca de 3 piezas — labio superior fijo, cavidad luminosa que escala en Y y
  mandíbula que baja y rota. La señal es `syl × mod × envelope`: ritmo de sílabas a ~8.5 Hz
  elevado a **0.32** para ensanchar los picos, énfasis lento siempre positivo, y ráfagas de
  frase con silencios (`SPEECH_PHRASE` / `SPEECH_DUTY`). Luego un `damp` lambda 22.
  ⚠️ **Si bajan la potencia de `syl` o la amplitud de la mandíbula, la boca deja de leerse
  como habla** y se convierte en dos barras que tiemblan. Se verificó empíricamente: con el
  producto de dos senos planos la apertura se quedaba en ~0.4 y era invisible.
  Constantes tunables arriba del archivo: `LOOK_YAW`, `LOOK_PITCH`, `LOOK_SMOOTH`,
  `PUPIL_RANGE_*`, `SPEECH_PHRASE`, `SPEECH_DUTY`.

### Añadido (pasada 2): estructura cinematográfica completa

Nuevos componentes y flujo de tres actos:

| Componente | Rol |
|------------|-----|
| `ui/CinematicIntro.tsx` | Pantalla de apertura con barras de cine, beats escalonados (kicker → nombre → rol → stack), botón **INICIAR RECORRIDO** y **SALTAR INTRO**. La cámara empuja desde lejos (pose `INTRO_END`) mientras se monta el título. |
| `ui/CreditsRoll.tsx` | Créditos finales tipo película: rodillo vertical (`animation: creditsRoll 24s`), secciones *UNA EXPERIENCIA DE*, *ZONAS DEL RECORRIDO* (auto-generado desde `ZONES`), *TÉCNICAMENTE*, y cierre con botones **VER DE NUEVO** / **VOLVER AL RECORRIDO**. Cámara se retira a `CREDITS_END`. |
| `ui/GuidedTour.tsx` | **MODO GUION** — timeline auto-construido desde `ZONES`: por zona, plano general (3.5 s) + cada sub-tema (6 s) + outro zona (1.8 s). Empuja `setZone`/`setActiveSubSection` en el store; CameraController y DetailPanel reaccionan solos. HUD inferior con contador de toma y botón **DETENER (ESC)**. |
| `ui/CinemaControls.tsx` | Dos botones fijos arriba-centro: **MODO GUION** (alterna `guided` en el store) y **TERMINAR · CRÉDITOS** (lanza fase `credits`). Heredan `--accent` de la zona activa. |
| `CameraController.tsx` (refactor) | La clave de vuelo incluye `phase|activeZone|activeSubSection|selectedBuilding`. Regímenes: zona (1.8 s), sub-tema — arco orbital alrededor del modelo a 0.62× distancia con `SUB_YAW_OFFSETS`/`SUB_Y_OFFSET` (1.5 s), edificio (1.4 s), intro (6.2 s), créditos (7 s). Parallax atenuado durante el vuelo. |

**Nuevos campos en store (`useExperienceStore.ts`):**
- `phase: 'intro' | 'experience' | 'credits'` — acto actual.
- `guided: boolean` — modo guión activo.
- `setPhase`, `setGuided` — setters.

**CSS nuevo (final de `styles.css`):**
- `.cine-layer` / `.cine-letterbox` — capa z-300 por encima del cursor.
- `.intro-layer` / `.intro-beat` / `.intro-cta` / `.intro-progress` — secuencia de apertura.
- `.credits-layer` / `.credits-roll` / `.credits-viewport` / `@keyframes creditsRoll` — rodillo final.
- `.cine-controls` / `.cine-btn` / `.cine-btn.is-live` — botones de control.
- `.tour-hud` — HUD del modo guión (REC + contador).
- `@media (prefers-reduced-motion: reduce)` desactiva animaciones de intro/créditos y muestra el rodillo estático con scroll.

### Añadido (pasada 3): zona 5 — Eco-Smart City Digital Twin

Nueva zona 4 (`city`, label **Digital Twin**, acento `#00ff88`) integrada
en el flujo existente: pestaña **05 DIGITAL TWIN**, posición `[64,0,-16]`,
sin sub-temas (la interacción es clic directo en edificios 3D).

| Componente | Rol |
|------------|-----|
| `config/cityLayout.ts` | Layout procedural compartido (560 edificios, rejilla 24×0.65, ~12% huecos). Generado **una sola vez** a nivel de módulo; lo leen CityZone, CameraController y HUD. |
| `scene/zones/CityZone.tsx` | InstancedMesh único (drei `<Instances>`) — **una draw call** para 560 edificios. Geometría `BoxGeometry(1,1,1)` con **vertex colors** que hornean un sombreado por cara, y material **unlit** `MeshBasicMaterial`. El color por edificio vive en `instanceColor`, con tres niveles: tono base apagado, brillo suave en hover y brillo máximo persistente en el seleccionado. Buffers `instanceMatrix`/`instanceColor` escritos **imperativamente** en `useFrame` (`needsUpdate=true`); **cero re-renders React** por frame ni por tick IoT. |
| `store/useExperienceStore.ts` | `selectedBuilding`, `cityData[]`, `tickCityData()` (cada 2 s actualiza 10-20 edificios aleatorios), `sceneHover` (para CursorOverlay). `setZone` limpia selección. La zona lee con `getState()` en `useFrame` → sin suscripción. |
| `scene/CameraController.tsx` | Vuelo a edificio: clave incluye `selectedBuilding`. Órbita diagonal isométrica a distancia fija (`BUILDING_TRANSITION = 1.4 s`). `CITY_ZONE_INDEX = 4`. |
| `ui/CityHUD.tsx` | HUD superior-izquierdo (solo zona 4): título, **System Status** derivado de IoT (OPTIMAL/ELEVATED/WARNING/CRITICAL), FPS real (rAF, re-render solo al cambiar entero), "560 NODES / LIVE IoT". Framer Motion entrada/salida. |
| `ui/BuildingPanel.tsx` | Panel lateral derecho (Framer Motion `x:100%→0%`): ID, badge status, barra energía animada, temperatura, **mini-chart SVG** (24 pts), botón **RESET VIEW** (vuelve a vista isométrica). |
| `ui/CursorOverlay.tsx` | Lee `sceneHover` del store + `domHoverRef` local → anillo se convierte en marco sobre edificios. |
| `styles.css` | `.city-hud`, `.building-panel`, `.bp-*`, `.city-stats` (drei Stats reposicionado top-right bajo pestañas). |

**Gotchas críticos de la zona 5 (no volver a romperlos):**

1. **`<Instances>` exige hijos `<Instance>` vacíos.** drei fija `count = min(limit, range, instances.length)` en su `useFrame` (Instances.js:135-136). Sin hijos, `count=0` → **ciudad invisible, 0 errores en consola** (mismo bug silencioso que el `bufferAttribute count=0`). Además `raycast: () => null` delega el raycast al `PositionMesh` de cada `<Instance>`: sin hijos, **no habría clics**.

2. **El `useFrame` de drei corre ANTES que el del padre** (orden hijos → padre en R3F). drei escribe las transforms de los `PositionMesh` por defecto; el `useFrame` de CityZone **los pisa** con las animadas. Como mi escritura va después, los valores finales del frame son los míos, y el raycast de drei lee exactamente esos mismos buffers → **lo que se ve es lo que se pulsa**.

3. **Jerarquía de brillo: seleccionado > hover > apagado.** `instanceColor` se escribe cada frame y sólo dos casos abandonan `BASE_GLOW`: el **seleccionado** (clic) conserva su color de estado con `SELECT_GLOW = 1.9` mientras siga seleccionado, y el **hover** se enciende con `HOVER_GLOW = 0.95`. El pulso (`glowPulse`, 0.64–1.0) multiplica a ambos, así que el hover nunca alcanza al seleccionado. Hover sobre el propio seleccionado usa la rama de selección. Al deseleccionar (clic en vacío) o cambiar de zona, el lerp devuelve todo a `BASE_GLOW`. El color de estado se lee de `data[i]` en vivo (no del snapshot de `selectedBuilding`), para que el tick IoT también actualice el edificio seleccionado.

4. **`envMapIntensity: 0` NO apaga el IBL del `<Environment>`.** Con `MeshStandardMaterial` y `envMap === null`, three r169 **sobreescribe** el uniform con `scene.environmentIntensity` (WebGLRenderer.js:2106-2110). Por eso la ciudad se veía gris claro aunque su emissive fuera negro y todas las luces estuvieran a 0. La solución es un material **unlit** (el actual), que ignora luces e IBL por completo. Si en el futuro se vuelve a un material PBR, hay que darle un `envMap` propio (aunque sea negro) o aceptar el IBL de la escena.

5. **Simulación IoT calibrada:** `roll < 0.7 normal / < 0.94 high-energy / alert`. Umbrales de `systemStatus` (OPTIMAL/ELEVATED/WARNING/CRITICAL) ajustados contra el equilibrio de 560 edificios (~34 alert, ~134 high-energy) para que la ciudad lea **OPTIMAL la mayor parte del tiempo** y sólo baile a ELEVATED/WARNING con picos reales.

6. **HUD no pisa el trigger dossier:** `.city-hud` usa `top:148px` (el trigger está en `top:96px`). En móvil el hint se oculta (`@media max-width: 560px`).

7. **Bounding sphere calculada con `count = 0`.** drei construye el `<instancedMesh>` con `args={[null, null, 0]}`; el renderer cachea su `boundingSphere` con 0 instancias (radio **-1**) y NO la recalcula cuando drei sube `count` después. `Frustum.intersectsSphere` devuelve `false` siempre → **la ciudad entera es invisible en todas las zonas, sin un solo error en consola**. CityZone la recalcula en su `useFrame` cuando `count > 0` y el radio es inválido. Es el mismo patrón silencioso que 4.1-B y el gotcha 1: cualquier derivado (buffer, bounds) calculado antes de que existan los datos queda envenenado.

### Bugs corregidos en esta pasada

- **Doble traslación (antes listada como "deuda menor" — NO era menor).**
  `Scene.tsx` envolvía cada zona en `<group position={zone.position}>` y cada componente volvía
  a aplicar `zone.position` en su `<group>` raíz. Como la zona 0 está en `[0,0,0]`, su doble
  traslación era identidad y **solo ella se veía**: las zonas 1-3 quedaban al doble de su
  coordenada, fuera del encuadre de su cámara, y aparecían **completamente vacías**.
  Se eliminó el wrapper en `Scene.tsx`; **la traslación vive únicamente en cada componente de
  zona**. Si añades una zona nueva, aplica `zone.position` en su `<group>` raíz y no la
  envuelvas de nuevo.
- **`count = 0`** en los `<bufferAttribute>` de las zonas 1, 2 y 3 (ver 4.1, bug B).
- **Panel de detalle se salía por abajo**: `.detail-panel-overlay` usaba `transform: translateY(-50%)` para centrar verticalmente, pero su `animation: panelSlideIn` con `fill-mode: both` dejaba `translateX(0)` al terminar, pisando el `translateY(-50%)` y haciendo que el panel cayera. Solución: quitar la animación del overlay y dejarla solo en `.detail-panel` (hijo sin transform propio).
- **Intro no animaba en entorno de test**: los `setTimeout` se *throttlean* en pestañas en segundo plano (navegador headless). En navegador real con foco funciona; la secuencia usa `prefers-reduced-motion` como fallback.

### Añadido (pasada 4): zona 6 — Futuristic 3D Product Configurator

Nueva zona 5 (`product`, label **Configurator**, acento `#ff5500`) integrada
en el flujo existente: pestaña **06 CONFIGURATOR**, posición `[80,0,-20]`,
sin sub-temas (la interacción es un scroll real de 4 páginas dentro del Canvas).

| Componente | Rol |
|------------|-----|
| `config/productLayout.ts` | `PRODUCT_THEME` (bg, accent `#ff5500`, silver `#c0c0c0`) y `SCROLL_SECTIONS` (4 textos + rangos). |
| `scene/zones/ProductZone.tsx` | `ScrollControls pages={4} damping={0.2}` (montado SOLO con la zona activa) + dron procedural de 6 piezas (`body`, `leftArm`, `rightArm`, `lens`, `ring1`, `ring2`). `useScroll()` entrega `offset` 0..1; `useFrame` aplica rotación, explode, lerp de color plata→naranja y reensamblado. La cámara NO se toca aquí. |
| `scene/zones/productScroll.ts` | Puente `productScroll.offset` escrito por el Canvas y leído por `ScrollUI` con rAF (sin re-renders por frame). `resetProductScroll()` al montar el HUD. |
| `store/useExperienceStore.ts` | `productPhase` (0..3) derivada del offset; `setProductPhase()`. `setZone` resetea la fase a 0. |
| `ui/ScrollUI.tsx` | UI HTML (Framer Motion): barra de progreso lateral, una sección visible por página, cue "SCROLL TO CONFIGURE" solo en la página 0, PRE-ORDER NOW magnético. Sin listeners de wheel/touch: el scroll lo gobierna ScrollControls. |

**Animación por offset (0..1):**

| Rango | Fase | Qué hace |
|-------|------|----------|
| 0.00–0.25 | Hero | `group.rotation.y = offset * π * 2 * 4` (4 vueltas en todo el recorrido) + flotación idle |
| 0.25–0.50 | Explode | `explode = clamp01((offset - 0.25) * 4)`; cada pieza = posición capturada + `EXPLODE_OFFSETS[id] * explode * 2` |
| 0.50–0.75 | Material | lerp `THREE.Color` plata `#c0c0c0` → naranja `#ff5500` con `lerpColors(SILVER, ORANGE, paint)`; emissive sube a 0.2 |
| 0.75–1.00 | Reassemble | vuelve a la posición de reposo y a plata (fase inferida: el brief venía cortado) |

**Gotchas críticos de la zona 6 (no volver a romperlos):**

1. **`ScrollControls` se monta solo con la zona activa.** Su capa DOM ocupa todo el canvas y hace `events.connect(el)`. Si estuviera siempre montado, la ciudad y las demás zonas dejarían de recibir clics; al salir debe desmontarse. Fuera de la zona se renderiza `<DroneRig scroll={null} />` para que el modelo no parpadee durante el vuelo de salida.
2. **`.product-scroll-container` debe seguir con `pointer-events: none`.** Si recupera los eventos, se come la rueda y el táctil antes de que lleguen a la capa de ScrollControls. Solo el botón PRE-ORDER restaura `pointer-events: auto`.
3. **El offset va de Canvas a DOM por `productScroll`, no por zustand.** Suscribir el HUD al offset provocaría un re-render de React por frame. `ScrollUI` pinta `scaleY` en un `requestAnimationFrame`.
4. **La página se calcula con bias:** `Math.floor(offset * 4 + 0.002)`. Con damping, el offset se posa en 0.49999 y `floor` se quedaría en la página 1 mientras el material ya cambió. El bias hace el cambio en el borde exacto.
5. **El explode se calcula desde `homePositions` capturadas en `useLayoutEffect`.** Nunca acumular sobre la posición del frame anterior: al volver atrás, las piezas se quedarían desplazadas.
6. **Material único y memoizado para el chasis.** `MeshStandardMaterial` con `metalness: 0.5`, `roughness: 0.4` (aluminio cepillado). Con metalness 0.9 + HDRI de estudio la plata reventaba a blanco y el naranja se lavaba.
7. **Sin `<Environment>` propio en la zona.** Montar un `preset` aquí descarga otro HDR remoto y pisa el cubemap global; fue justo lo que sobreexpuso el dron. La escena ya tiene su env global.
8. **ProductZone NO toca la cámara.** `CameraController` es la única autoridad; el vuelo de entrada ya deja el plano cercano (`[80,2,-11.5]`). El parallax sigue vivo.
9. **El dron se escala por aspecto** (`fitScale`: 0.8 / 0.9 / 1) para que el despiece ancho no se salga en teléfonos.
10. **`ContactShadows` con `frames={1}` en táctil** para no recalcular la sombra cada frame del despiece.
11. **Texto en posición fija acotada.** Sólo hay una sección visible por página, así que usa una única posición con `clamp` para no invadir el trigger del dossier (abajo ~132 px) ni la tarjeta HUD (alto ~186 px). No volver a las posiciones escalonadas 15%/35%/55%/75%: se solapaban entre fases.

**Actualización (pasada 7) — scroll real con `ScrollControls`.**
Se sustituyó el stepping manual (wheel/touch con umbral y cooldown en `window`) por `ScrollControls`
de drei con 4 páginas y `damping={0.2}`. Ahora el scroll es nativo y continuo en escritorio y
móvil; el brief original pedía exactamente este montaje. La pose de entrada sigue siendo cercana
(`[80,2,-11.5]`, lookAt `[80,0.5,-20]`), así que el dron ocupa el encuadre al llegar y
`CameraController` conserva la cámara. El usuario sigue viendo una sola sección de texto por
página porque `productPhase` se deriva del offset.

### Añadido (pasada 5): DetailPanel reutilizable + contenido centralizado + sub-botones en zonas 1-5

Nuevo sistema de paneles de detalle y datos centralizados que afecta a todas las zonas:

| Componente nuevo | Rol |
|------------------|-----|
| `data/portfolioContent.ts` | **Fuente única de verdad** para todo el texto del portfolio. Estructura tipada: `section01`–`section04` (subButtons), `section05` (buildingDetail), `section06` (scrollTexts). Exporta tipos `SubButton`, `ScrollText`. |
| `ui/DetailPanel.tsx` | Panel reutilizable (glassmorphism, Framer Motion slide-in right, z-65). Lee `activeZone` + `activeSubSection` del store, busca en `portfolioContent.ts`, renderiza título/descripción/métricas. Se cierra con X o al cambiar de zona. |
| `store/useExperienceStore.ts` | Nuevo campo `activeSubSection` + `setActiveSubSection()`. `setZone` limpia `activeSubSection` y `productPhase`. |

**Zonas 1-4 (Architecture, Testing, AI Workflow, Creative 3D):**
- Cada zona tiene 3 sub-botones en el dropdown de la NavigationUI (arriba-derecha).
- Click en sub-botón → `setActiveSubSection(id)` → DetailPanel se abre a la derecha con contenido de `portfolioContent.ts`.
- Sub-botón activo se destaca (`aria-selected`, estilo destacado).
- Click en X del panel o cambio de zona → panel se cierra.

**Zona 5 (Digital Twin):**
- Mantiene `BuildingPanel` específico (click en edificio 3D → fly-to cámara + panel con datos IoT en vivo).
- `selectedBuilding` ahora es objeto `CityBuildingData` completo (no solo ID).
- Botón **RESET VIEW** cierra panel y vuelve a vista isométrica.

**Zona 6 (Configurator):**
- Por scroll real de 4 páginas (`ScrollControls`) → offset 0..1; `productPhase` 0..3 se deriva de ese offset.
- 4 secciones de texto desde `portfolioContent.section06.scrollTexts`, una visible por página.
- Bloque de texto en posición fija con `clamp` vertical (entre dossier y tarjeta HUD).
- Botón **PRE-ORDER NOW** magnético (right: 60, bottom: 96), visible en la última página.
- Entrada en plano cercano; sin dolly: `CameraController` conserva la cámara.

**Gotchas nuevos (pasada 5):**
1. **Store field rename:** `activeSubButton` → `activeSubSection` (más semántico). NavigationUI y DetailPanel actualizados.
2. **Centralización de contenido:** Todo texto en `portfolioContent.ts` — **no duplicar strings** en componentes.
3. **DetailPanel reutilizable:** Un solo componente para zonas 1-4 + BuildingPanel para zona 5. No crear paneles ad-hoc.
4. **selectedBuilding tipado:** Ahora es `CityBuildingData | null` (objeto completo). CityZone busca en `cityData[id]` y pasa el objeto.
5. **NavigationUI sync:** Usa `activeSubSection` para `aria-selected` y highlight visual.
6. **Limpieza al cambiar zona:** `setZone` resetea `activeSubSection`, `selectedBuilding`, `productPhase`, `sceneHover`.

---

## 6. Convenciones de código

- **TypeScript estricto.** Verificar con `npx tsc --noEmit` antes de dar por terminado un cambio.
- **Comentarios en español**, explicando el *por qué*, no el *qué*.
- **Sin `any`** salvo justificación explícita.
- Los materiales emissive se animan en `useFrame` tocando `emissiveIntensity`.
- La UI DOM reutiliza el patrón `style={{ ['--accent']: zone.accent }}` para heredar el acento.
- Respuestas al dueño: **en español**, directas, sin jerga innecesaria.

---

## 7. Cómo ejecutar

```bash
npm install      # ya instalado
npm run dev      # Vite en http://localhost:5173 (o el siguiente puerto libre)
npm run build    # tsc + vite build
npm run preview  # sirve dist/
```

Si el puerto está ocupado, Vite sube al siguiente; para forzar uno:
`npm run dev -- --port 5174`.
