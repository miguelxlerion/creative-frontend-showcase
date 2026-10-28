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
  main.tsx                  Punto de entrada, React.StrictMode + MotionConfig (reducedMotion="user")
  App.tsx                   <Canvas> + Scene + overlays DOM + header fijo
  styles.css                TODO el CSS propio (HUD, paneles, dropdowns, keyframes)
  store/
    useExperienceStore.ts   Estado global zustand
  config/
    zones.ts                ★ Registro único de las 6 zonas (config + textos + datos)
    guideSteps.ts           ★ Guion del modo guiado: cámara, duración y foco 3D por paso
    cityLayout.ts           ★ Layout procedural de la zona Digital Twin (skyline, giros y tonos)
    productLayout.ts        ★ Layout procedural de la zona Product Configurator (8 partes dron)
  scene/
    Scene.tsx               Iluminación, Environment, Stars, DustField, suelo, zonas, post-proceso
    CameraController.tsx    Cámara cinemática con tweens (sin OrbitControls)
    DustField.tsx           Polvo local con parallax (da sensación de viaje)
    globalPointer.ts        ★ Puntero normalizado -1..1 compartido DOM ↔ 3D
    zones/
      ArchitectureZone.tsx  Zona 0 — Cara virtual holográfica (cian) — sigue el cursor y habla
      TestingZone.tsx       Zona 1 — Laboratorio GLB (mesa + vidrio) + aro neón (verde)
      AIWorkflowZone.tsx    Zona 2 — Pipeline editor → cerebro IA → CI/CD + partículas (morado)
      CreativeZone.tsx      Zona 3 — Diorama GLB optimizado en vitrina neón (rojo)
      CityZone.tsx          Zona 4 — GLB low-poly instanciado (~520) + IoT + hover/clic
      ProductZone.tsx       Zona 5 — Cuadricóptero procedural (13 módulos) + ScrollControls (4 páginas)
      productScroll.ts      ★ Puente imperativo offset del canvas → HUD DOM del configurador
    GuideHighlights.tsx   ★ Halos, anillos de suelo, escudo y jaula 3D del modo guiado
  ui/
    NavigationUI.tsx        Pestañas de carpeta ARRIBA-DERECHA + dropdowns de sub-temas
    HUDOverlay.tsx          Tarjeta héroe abajo-izquierda + trigger y modal "ZONE DOSSIER"
    DetailPanel.tsx         Panel de detalle de sub-tema (entra desde la derecha; bloques ricos en zona AI)
    AccessibilitySummary.tsx ★ Puente Canvas → lector de pantalla (región aria-live sr-only)
    CursorOverlay.tsx       ★ Cursor ambiental (punto + anillo) teñido con el acento activo
    CityHUD.tsx             HUD superior-izq zona 5 (título, System Status, FPS)
    BuildingPanel.tsx       Panel contextual edificio (Framer Motion, SVG chart)
    ScrollUI.tsx            Configurator: barra de progreso continua (rAF) + una sección por página + PRE-ORDER
    PreOrderModal.tsx       Flujo demo de reserva (configurar → piloto → confirmación) en portal, z-95
    AIAssistantChat.tsx     Zona 2: chat RAG mockeado (thinking → typewriter → fuentes) + minimize/launcher
    AIWorkflowLegend.tsx    Zona 2: leyenda interactiva de las 4 herramientas (botones reales, aria-pressed)
    AIWorkflowStats.tsx     Zona 2: telemetría mockeada con count-up (aria-hidden, decorativa)
    AIToolIcon.tsx          Iconos SVG inline de Copilot / Cursor / RAG / Automation
    KeyboardGuide.tsx       ★ Primer acto: guía de atajos WCAG AA antes de la intro (animación CSS)
    GuideMode.tsx           ★ Tour automático de 6 pasos: backdrop, ficha glass, teclado y cierre
  hooks/
    useReducedMotion.ts     ★ Preferencia `prefers-reduced-motion` viva (useSyncExternalStore)
    useGlobalKeyboardNav.ts ★ ←/→ zonas, ↑/↓ sub-temas, Enter/Space, Escape jerárquico (menú → panel)
```

**Capas DOM (de menor a mayor `z-index`), definidas en `styles.css`:**
tarjeta héroe z-40 → **stats IA z-44** → **leyenda IA z-46** → **chat IA z-52** → trigger dossier z-55 →
**backdrop del tour z-60** → `DetailPanel` / `BuildingPanel` z-65 → pestañas + dropdown z-70/80 →
controles de cine z-75 → **ficha del tour z-86** (etiquetas 3D de nodos 62–84) → modal dossier z-90 → **pre-order z-95** → **capa del cursor z-200** →
**intro/créditos/guía de teclado `.cine-layer` z-300** → **skip link z-400**. El wrapper `.folder-tabs` es z-70: sin eso, el
`z-index` interno del dropdown no servía porque el wrapper viejo (z-20) creaba su propio
stacking context. La capa del cursor va la última de la UI normal y con `pointer-events: none`: sólo observa.

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
| 2 | `ai` | AI Workflow | `#b026ff` | AI-ASSISTED WORKFLOW |
| 3 | `creative` | Creative 3D | `#ff0055` | 60 FPS |
| 4 | `city` | Digital Twin | `#00ff88` | 500+ BUILDINGS |
| 5 | `product` | Configurator | `#ff5500` | SCROLL-DRIVEN |

### `src/store/useExperienceStore.ts`

```ts
activeZone: number        // índice de zona activa — única fuente de verdad del vuelo de cámara
isFlying: boolean         // el vuelo está en curso (lo gobierna CameraController)
activeSubSection: string | null  // sub-tema abierto dentro de la zona
openDropdown: number      // qué dropdown está abierto (-1 = ninguno)
phase: 'keys' | 'intro' | 'experience' | 'credits'
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

### 4.5 Geometría procedural y assets locales

Casi todo son primitivas Three.js + buffers procedurales. Hay **tres modelos binarios**:
`public/models/building.glb` (~92 KB, low-poly, 1.995 vértices / 958 triángulos, 1 material
y ninguna textura), el edificio de oficinas que se instancia ~520 veces en el Digital Twin;
`public/models/lab.glb` (el laboratorio de Testing, ver más abajo); y
`public/models/creative.glb` (el diorama industrial de Creative 3D, 586 KB, 45 InstancedMesh,
ver pasada 12). Los tres se cargan con `useGLTF(url, false)` para que drei no configure un
decoder remoto.

Ese GLB viene de **3ds Max con Z arriba** y la base en `z=0`. Trae un nodo raíz con una matriz
que aplica una conversión de ejes (+90° en X, que deja el modelo boca abajo) más la traslación
del pivote. **`CityZone` ignora esa matriz a propósito**: usa los vértices crudos, asume Z-up y
los endereza con `rotationX(-π/2)`; después centra la huella y apoya la base en `y=0`. Si
aplicas la matriz del nodo *y* la rotación, se cancelan y el edificio queda tumbado (bug real).
Si lo reemplazas por otro modelo, revisa que los vértices crudos estén en Z-up con la base en
`z=0`; la matriz del nodo no se usa.

**Normales.** `CityZone` conserva las normales **autoradas** del GLB: `applyMatrix4` ya las
transforma con la matriz de normales, así que se respeta la intención del modelo y **no** se
llama a `computeVertexNormals()`. El export de 3ds Max deja errores de winding en dos escalas
distintas, y se corrigen en dos pasadas tras `toNonIndexed()`:

1. **Cascarones enteros** — las tres ventanas de la planta baja (componente de 83 triángulos)
   tenían volumen firmado negativo. `repairInvertedShells()` detecta por volumen los componentes
   invertidos, invierte su winding y alinea las normales.
2. **Caras sueltas** — el muro trasero (4 triángulos grandes) y varios detalles de la fachada
   derecha pertenecían al componente principal, cuyo volumen neto era positivo, así que el test
   de volumen no los detectaba: con `FrontSide` se descartaban y el edificio se veía hueco por
   detrás. `repairInwardFacingWalls()` lanza un rayo desde el lado exterior del bounding box
   hacia cada cara candidata (normal · lado < -0.15); si la cara es la primera superficie que ve
   el rayo, invierte su winding y niega las normales que queden al lado contrario. Las caras
   interiores legítimas no se tocan porque el muro exterior las oculta.

Verificado en runtime: 958 triángulos, 3 componentes con volumen positivo, 0 discrepancias
winding-normal y **0 caras visibles hacia dentro** (169 primeras superficies comprobadas).

Los modelos fuente sin optimizar viven en `models/` y están **ignorados por git**. El
`public/models/building.glb` versionado es el que consume la web; no hace falta ningún
paso de `gltf-transform` mientras el modelo sea low-poly.

**Laboratorio de Testing (`public/models/lab.glb`).** Export de Blender de 6,4 MB / 259k
triángulos / 69 mallas / 14 materiales / 2 texturas 1K. Se carga con `useGLTF(LAB_URL, false)`
**sólo cuando `activeZone === 1`** (lazy + `<Suspense>`); al salir se desmonta y drei conserva
el asset en caché, así que volver es instantáneo. El GLB incluye un fondo de estudio (`Plane`,
241×79×167) que no pertenece a la pieza y se elimina al clonar la escena. La mesa se normaliza
por ancho (`LAB_WIDTH = 3.8`), se centra en X/Z y se apoya sobre la rejilla (`y = -1.9`). El
vidrio del export es opaco: se vuelve transparente (`depthWrite=false`, `DoubleSide`); los
líquidos conservan su color autorado pero emiten y pulsan; la madera se tiñe oscura porque el
GLB sólo trae el AO como textura de color (sin tinte, la mesa sale blanca y se come el
encuadre). El encuadre de la zona no cambió: `[16.2, 0.9, 5.4]` → `[16, 0, -4]`.
Verificado en navegador: 60 FPS y 0 errores con el modelo montado.

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
2. ✅ **Zona 1 → laboratorio**: GLB `public/models/lab.glb` (mesa + material de vidrio y
   líquidos) en lugar de la geometría procedural, integrado con el aro neón de la zona.
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
- `phase: 'keys' | 'intro' | 'experience' | 'credits'` — acto actual.
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
| `config/cityLayout.ts` | Layout procedural compartido (rejilla 24×0.65 con 9% de huecos + huellas holgadas; `CITY_LAYOUT.length` ≈ 515–545, con 560 como tope de buffers). Generado **una sola vez** a nivel de módulo; lo leen CityZone, CameraController y HUD. Cada edificio guarda `h/w/d`, `rot` (cuarto de vuelta + jitter) y `tone` (variación de material). |
| `scene/zones/CityZone.tsx` | InstancedMesh único (drei `<Instances>`) — **una draw call** para toda la ciudad. Geometría: el GLB low-poly se clona, se endereza a Y-arriba, se centra y se normaliza a caja unitaria (x/z ∈ [-0.5, 0.5], base en y=0); luego `toNonIndexed()`, **normales autoradas** (sin `computeVertexNormals`), reparación de cascarones invertidos por volumen firmado **y de caras sueltas visibles hacia dentro** (`repairInwardFacingWalls`), y **vertex colors** con un sombreado falso por cara. Material **unlit** `MeshBasicMaterial`. El color por edificio vive en `instanceColor`, con cuatro niveles: tono base apagado, brillo de filtro, brillo suave en hover y brillo máximo persistente en el seleccionado. Buffers `instanceMatrix`/`instanceColor` escritos **imperativamente** en `useFrame` (`needsUpdate=true`); **cero re-renders React** por frame ni por tick IoT. |
| `store/useExperienceStore.ts` | `selectedBuilding`, `cityData[]`, `tickCityData()` (cada 2 s actualiza 10-20 edificios aleatorios), `sceneHover` (para CursorOverlay), `energyFilter` + `setEnergyFilter` (filtro de consumo). `setZone` limpia selección y filtro. La zona lee con `getState()` en `useFrame` → sin suscripción. |
| `scene/CameraController.tsx` | Vuelo a edificio: clave incluye `selectedBuilding`. Órbita diagonal isométrica a `dist = 2.6 + h * 1.6` desde el centro a media altura (`BUILDING_TRANSITION = 1.4 s`). `CITY_ZONE_INDEX = 4`. |
| `ui/CityHUD.tsx` | HUD superior-izquierdo (solo zona 4): título, **System Status** derivado de IoT (OPTIMAL/ELEVATED/WARNING/CRITICAL), FPS real (rAF, re-render solo al cambiar entero), recuento real de nodos, **chips de filtro de consumo** (ALL / NORMAL / HIGH / ALERT con contadores) y "LIVE IoT". Framer Motion entrada/salida. |
| `ui/BuildingPanel.tsx` | Panel lateral derecho (Framer Motion `x:100%→0%`): ID, badge status, barra energía animada, temperatura, **mini-chart SVG** (24 pts), botón **RESET VIEW** (vuelve a la vista general de la ciudad). |
| `ui/CursorOverlay.tsx` | Lee `sceneHover` del store + `domHoverRef` local → anillo se convierte en marco sobre edificios. |
| `styles.css` | `.city-hud`, `.building-panel`, `.bp-*`, `.city-stats` (drei Stats reposicionado top-right bajo pestañas). |

**Gotchas críticos de la zona Digital Twin (no volver a romperlos):**

1. **`<Instances>` exige hijos `<Instance>` vacíos.** drei fija `count = min(limit, range, instances.length)` en su `useFrame` (Instances.js:135-136). Sin hijos, `count=0` → **ciudad invisible, 0 errores en consola** (mismo bug silencioso que el `bufferAttribute count=0`). Los hijos no llevan geometría: el hover y el clic se resuelven con un **AABB manual** contra `CITY_LAYOUT` y la cámara real, no con el raycast de drei.

2. **El `useFrame` de drei corre ANTES que el del padre** (orden hijos → padre en R3F). drei escribe las transforms de los `PositionMesh` por defecto; el `useFrame` de CityZone **las pisa** con las animadas. Como la escritura va después, los valores finales del frame son los del layout; el pick usa ese mismo layout, así que **lo que se ve es lo que se pulsa**.

3. **Jerarquía de brillo: seleccionado > coincidencia de filtro > hover > apagado.** `instanceColor` se escribe cada frame. El **seleccionado** (clic) conserva su color de estado con `SELECT_GLOW = 1.9`; las coincidencias del **filtro** usan `FILTER_GLOW = 1.25` (×1.12 si además hay hover); el **hover sin filtro** se enciende con `HOVER_GLOW = 0.95`; y el resto vuelve a `BASE_GLOW`, multiplicado por `FILTER_DIM = 0.28` cuando hay un filtro activo. Con filtro, el hover de un edificio de OTRO nivel no lo ilumina (sólo escala) para no romper la lectura de la vista. El pulso (`glowPulse`, 0.64–1.0) multiplica a los tres estados. El color de estado se lee de `data[i]` en vivo (no del snapshot de `selectedBuilding`), para que el tick IoT también actualice el edificio seleccionado.

4. **`envMapIntensity: 0` NO apaga el IBL del `<Environment>`.** Con `MeshStandardMaterial` y `envMap === null`, three r169 **sobreescribe** el uniform con `scene.environmentIntensity` (WebGLRenderer.js:2106-2110). Por eso la ciudad se veía gris claro aunque su emissive fuera negro y todas las luces estuvieran a 0. La solución es un material **unlit** (el actual), que ignora luces e IBL por completo. Si en el futuro se vuelve a un material PBR, hay que darle un `envMap` propio (aunque sea negro) o aceptar el IBL de la escena.

5. **Simulación IoT calibrada:** `rollStatus()` reparte 70% normal / 24% high-energy / 6% alert, y `readingsFor()` deriva energía/temperatura. Los datos iniciales usan **la misma distribución** (antes nacían todos normal, así que HIGH/ALERT tardaban minutos en poblarse y el filtro salía vacío). Umbrales de `systemStatus` ajustados contra el equilibrio real (~30 alert, ~130 high-energy sobre los ~515 edificios): la ciudad lee **OPTIMAL la mayor parte del tiempo** y sólo baila a ELEVATED/WARNING con picos reales.
6. **HUD no pisa el trigger dossier:** `.city-hud` usa `top:148px` (el trigger está en `top:96px`). En móvil el hint se oculta (`@media max-width: 560px`).
7. **Bounding sphere calculada con `count = 0`.** drei construye el `<instancedMesh>` con `args={[null, null, 0]}`; el renderer cachea su `boundingSphere` con 0 instancias (radio **-1**) y NO la recalcula cuando drei sube `count` después. `Frustum.intersectsSphere` devuelve `false` siempre → **la ciudad entera es invisible en todas las zonas, sin un solo error en consola**. CityZone la recalcula en su `useFrame` cuando `count > 0` y el radio es inválido. Es el mismo patrón silencioso que 4.1-B y el gotcha 1: cualquier derivado (buffer, bounds) calculado antes de que existan los datos queda envenenado.
8. **Filtro de consumo (`energyFilter`):** vive en el store y CityZone lo lee con `getState()` en `useFrame`; **no** debe moverlo a un selector de React ni a un estado local de CityHUD, porque cada cambio re-renderizaría la escena. `setEnergyFilter` limpia `selectedBuilding` para que un edificio fuera del nivel no quede como punto brillante suelto. Los chips son `<button>` reales con `aria-pressed` (el HUD ya no es `aria-hidden`), y en ≤380 px pasan a 2×2.
9. **El GLB low-poly se instancia; no vuelvas a meter un material/textura del modelo.** `public/models/building.glb` pesa ~92 KB, tiene 1.995 vértices / 958 triángulos, 1 material y ninguna textura. CityZone ignora su material y **la matriz del nodo raíz**: usa los vértices crudos (3ds Max, Z-up), los endereza (`rotationX(-π/2)`), centra la huella, apoya la base en `y=0`, normaliza a caja unitaria, pasa a no-indexada, **conserva las normales autoradas** (no llama a `computeVertexNormals`) y repara dos tipos de winding invertido antes de hornear el sombreado en `vertexColors`: componentes enteros con volumen firmado negativo (las ventanas de la planta baja) y caras sueltas del componente principal que miran hacia dentro y son visibles desde fuera (el muro trasero y detalles de la fachada derecha, invisibles con `FrontSide`). Cualquier textura del GLB se descarta a propósito; el color final es `vertexColor × instanceColor` del material unlit. Se libera la geometría al desmontar. El original de `models/` está ignorado por git; solo se versiona el GLB web. El modelo tiene el techo abierto y una losa base que lo cierra visualmente desde arriba; no se ve el fondo a través de él.
10. **El giro vive en `rot` (radianes), no en cuartos de vuelta enteros.** Es un cuarto de vuelta más un jitter de ±0.17 rad para romper la retícula; por eso el AABB de picking calcula la huella rotada con `|cos|·w + |sin|·d`. Si vuelves a asumir un giro de 90° exacto, el hover se desalinea de lo que se ve.
11. **Encuadre del Digital Twin:** el plano general es diagonal (`[70.5, 9.5, 2]` mirando a `[64, -0.4, -16]`) para que se vean fachada y lateral. El vuelo a un edificio usa `dist = 2.6 + h * 1.6` desde el centro a media altura: con la fórmula anterior (2.2 + 1.3h) los edificios vecinos llenaban el encuadre.

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
| `scene/zones/ProductZone.tsx` | `ScrollControls pages={4} damping={0.2}` (montado SOLO con la zona activa) + cuadricóptero procedural de 13 módulos (`hull`, `canopy`, `battery`, `sensor`, `antenna`, `gimbal`, `lens`, cuatro `arm*` y dos `skid*`). `useScroll()` entrega `offset` 0..1; `useFrame` aplica rotación, explode, giro de rotores, lerp de color plata→naranja y reensamblado. La cámara NO se toca aquí. Ver pasada 13. |
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
9. **El dron se escala por aspecto** (`fitScale`: 0.82 / 0.9 / 1) para que el despiece ancho no se salga en teléfonos. Con 0.92 el rotor extremo se recortaba en vertical (pasada 13).
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

### Añadido (pasada 8): AI Assistant mockeado en la zona AI Workflow

Chat decorativo que imita un asistente RAG **sin red ni modelo**: las respuestas se escriben a
mano en `portfolioContent.section03.assistant` (greeting, 3 prompts con `answer` y `sources`).

| Componente | Rol |
|------------|-----|
| `data/portfolioContent.ts` | `section03.assistant`: datos del chat junto al resto del texto de la zona. **No duplicar strings en el componente.** |
| `ui/AIAssistantChat.tsx` | Panel inferior-derecho (z-52). Al pulsar una sugerencia: puntos de "retrieving" 650 ms → typewriter (3 chars / 16 ms) → chips `RETRIEVED CONTEXT`. Botón minimizar ↔ launcher, `aria-live` con el texto completo, y `prefers-reduced-motion` muestra la respuesta de golpe. |
| `App.tsx` | Montado tras `<ScrollUI />`; el propio componente decide visibilidad. |

**Reglas de visibilidad:** sólo con `activeZone === 2`, `phase === 'experience'`, `!guided` y
`activeSubSection === null`. Al entrar en la zona se resetea el historial y se abre el panel;
al abrir un sub-tema (DetailPanel z-65) el chat se oculta para no quedar debajo.

**Gotchas:**
1. **El foco se transfiere al terminar la animación, no en el `useEffect`.** Con
   `AnimatePresence mode="wait"` el launcher/panel aún no existen cuando cambia `open`; el foco
   se mueve en `onAnimationComplete`. Si se hace antes, cae en `<body>`.
2. **El chat se autooculta pero no se desmonta** (vive en `App.tsx`). Los timers se limpian al
   entrar de nuevo en la zona y al desmontar; no añadir efectos que asuman que está oculto.
3. **`prefers-reduced-motion` ahora es vivo** con `useReducedMotion` (matchMedia compartido):
   el typewriter se desactiva al cambiarla, sin recargar.
4. **En móvil (≤640 px) el panel/launcher suben a `bottom: 78px`** para dejar libre el pill de
   cine; el panel es full-width y no debe superar `48dvh`.

### Añadido (pasada 9): accesibilidad WCAG AA

Capa de accesibilidad **sin tocar el diseño, los modelos ni la navegación existente**:
solo atributos ARIA, foco, teclado, contraste de texto y movimiento reducido.

| Componente / archivo | Rol |
|----------------------|-----|
| `hooks/useReducedMotion.ts` | Preferencia viva con `useSyncExternalStore` sobre un único `MediaQueryList` a nivel de módulo. Todos los consumidores (3D, cámara, DOM, chat) comparten la misma suscripción. |
| `hooks/useGlobalKeyboardNav.ts` | Atajos globales en `window`: ←/→ cambian de zona (todas, incluidas las que no tienen sub-temas) con wrap; ↑/↓ recorren los sub-temas de las zonas 0–3 con wrap; Enter/Space abre el primero si el foco no está en un control; Escape cierra el DetailPanel **después** de que el menú haya consumido el suyo. |
| `ui/AccessibilitySummary.tsx` | Región `role="status"` `aria-live="polite"` + `.sr-only` fuera del Canvas. Publica zona, dato héroe, sub-opciones, contenido completo del DetailPanel y métricas. Usa `getSubSectionContent()` (misma fuente que el panel). |
| `main.tsx` | `<MotionConfig reducedMotion="user">` envuelve `<App/>`: Framer Motion omite transformaciones/escalas/layout con la preferencia activa; los fundidos de opacidad se conservan. |
| `App.tsx` | `.skip-link` como primer elemento enfocable (salta a `<main id="main-content" tabIndex={-1}>`); `<Canvas aria-hidden="true" tabIndex={-1}>`; `<AccessibilitySummary/>` dentro de `main`. |
| `config/zones.ts` | Nuevo campo `accentText` junto a `accent`: color de **texto** con ≥4.5:1, mientras `accent` sigue rigiendo materiales 3D, bordes y glows. |
| `styles.css` | `--accent-text` en todas las declaraciones `color` con acento; alphas de texto subidos a ≥0.55; anillo global `:focus-visible` de 3 px amarillo (`#ffe600`) con `!important`; skip link amarillo con anillo blanco. |

**Modelo de teclado y foco**

- **Tab no se secuestra:** el skip link y las 6 pestañas se alcanzan primero, pero el resto de
  controles siguen siendo tabulables (restringir Tab a la nav haría inalcanzables los paneles y
  violaría WCAG). El Canvas no entra en el orden de tabulación.
- **Menú de sub-temas:** `role="menu"` + `role="menuitemradio"` + `aria-checked`, roving tabindex
  (un solo ítem con `tabIndex=0`), ↑/↓/Home/End, Escape cierra y devuelve el foco a la pestaña.
  Enter y Space se resuelven explícitamente en `keydown` con `preventDefault()` para no duplicar
  la activación nativa.
- **Escape jerárquico:** si hay un menú abierto, lo cierra NavigationUI; si no, el hook global
  cierra el DetailPanel y **reabre el menú enfocando el sub-botón elegido**. Los diálogos con
  teclado propio (dossier, chat, panel de edificio, campos) quedan excluidos.
- **Cierre con ×:** tanto DetailPanel como BuildingPanel devuelven el foco a la pestaña de la
  zona antes de desmontarse, para no dejarlo en `<body>`.
- **Ciclo de flechas:** al pulsar ↑/↓ se actualiza `activeSubSection` inmediatamente (el panel se
  abre) y el resumen `aria-live` anuncia el nuevo contenido.
- **Cambio de sección con ←/→:** el hook global cicla `activeZone` con wrap desde cualquier punto
  de la página, también en Digital Twin y Configurator (no dependen de tener sub-temas). Sobre la
  tira de pestañas lo gestiona NavigationUI: mueve el foco y activa la zona en el mismo gesto.
  Menús, diálogos y campos conservan sus teclas; no añadir otro listener global que las capture.

**Contraste**

- `--accent-text` se inyecta en cada contenedor que ya inyectaba `--accent` (tabs, HUD, dossier,
  DetailPanel, CityHUD, BuildingPanel, cine, tour, créditos, chat, ScrollUI, cursor).
  Valores: cian `#00ffff`, verde `#66ffb3`, morado `#c76bff`, rosa `#ff6b9d`, naranja `#ff8a3d`.
  El morado original `#b026ff` daba ≈4.33:1 y por eso no se usa para texto.
- Los textos atenuados (`rgba(238,246,255,0.25–0.5)`) subieron a 0.55 para superar 4.5:1 sobre
  `#05050a`; los elementos decorativos `aria-hidden` (separadores, caret) no se tocaron.
- El skip link es amarillo con texto `#05050a`; su anillo de foco es blanco para no fundirse con
  el fondo amarillo.

**Movimiento reducido (cobertura)**

- **3D:** `CameraController` aterriza sin tween (y fija `isFlying=false`); parallax de ratón a 0;
  `ArchitectureZone` (cara/mirada/boca/escáneres), `TestingZone` (pulso de los líquidos),
  `AIWorkflowZone` (nodos/paquetes/anillo), `CreativeZone` (giro de vitrina/flotación/ticks), `CityZone`
  (respiración/pulso/lerp de color), `ProductZone` (rotación/explode/pintura/bob) y `DustField`
  quedan en pose estática. `Stars` baja su velocidad a 0.
- **DOM:** `MotionConfig` + `@media (prefers-reduced-motion: reduce)` global (animaciones y
  transiciones a 0.01 ms); el anillo del cursor se oculta; ScrollUI salta de página en página en
  la barra de progreso y no instala el efecto magnético del PRE-ORDER.

**Gotchas a11y (no romper)**

1. **Texto de acento = `--accent-text`, nunca `--accent`.** El acento original está calibrado
   para materiales emisivos; usarlo como color de texto deja el morado por debajo de AA.
2. **El anillo de foco global necesita `!important`.** Varias reglas `:focus-visible` existentes
   hacen `outline: none` y confían en sombras internas; sin `!important` el foco desaparece en
   esas superficies. `.app-main:focus-visible` es la única excepción (el destino del skip link es
   un contenedor y el anillo quedaría recortado).
3. **`AccessibilitySummary` solo se suscribe a `phase`, `activeZone` y `activeSubSection`.**
   Si se suscribe a `cityData` o al tick IoT, el lector de pantalla recibiría una actualización
   cada 2 s y resultaría inutilizable.
4. **El hook global no debe robar teclas a los controles.** Los selectores `UI_OWNS_KEYS_SELECTOR`
   / `DIALOG_SELECTOR` excluyen el menú, el dossier, el chat, el panel de edificio y los campos.
   Añadir una UI con teclado propio exige ampliar esas listas.
5. **Enter/Space en `menuitemradio` se manejan a mano.** No quitar el `preventDefault()`: sin él,
   el navegador dispararía además el click nativo y el sub-tema se abriría y cerraría en el mismo
   keydown.
6. **Al desmontar un panel hay que devolver el foco.** Cerrar con × desde teclado deja el foco en
   `<body>` si no se reubica antes del desmontaje (DetailPanel/BuildingPanel ya lo hacen).
7. **La preferencia de movimiento es viva.** No volver a leerla con `useMemo(..., [])`: el hook
   compartido notifica cambios de `matchMedia` y los tres mundos (3D, cámara, DOM) reaccionan.
8. **Verificado en headless (Chrome + CDP con `Emulation.setEmulatedMedia`):** con `reduce`, el
   DetailPanel aparece con `transform: none`, las animaciones CSS duran `1e-05s`, el anillo del
   cursor queda `display:none` y la transición del skip link es instantánea; sin la preferencia,
   el panel arranca en `matrix(…, 343.75, …)`. Sin errores de consola en ninguno de los dos modos.

### Añadido (pasada 10): laboratorio GLB en la zona Testing

Se sustituyó la geometría procedural de `TestingZone` (tubos, matraces, burbujas, lupa y vapor)
por `public/models/lab.glb`, el export de Blender de la mesa de laboratorio.

| Aspecto | Detalle |
|---------|---------|
| Carga | `useGLTF('/models/lab.glb', false)` dentro de `<Suspense>`; sólo se monta con `activeZone === 1`. Fuera de la zona se desmonta y drei mantiene el asset en caché. |
| Fondo | El GLB trae un `Plane` de 241×79×167 que se elimina con `removeFromParent()` al clonar. No es una pared del laboratorio. |
| Escala | `Box3` real del clon (sin fondo) → ancho `3.8`; centrado en X/Z y base en `y=-1.9`. La cámara de la zona no cambió. |
| Materiales | Vidrio transparente (el export es opaco); metal/plástico/cerámica ajustados; madera teñida oscura; líquidos con emissive pulsante que se detiene con movimiento reducido. |
| Vida | Aro neón y point lights locales. Sin rotación de la mesa: un mueble girando rompe la lectura. |

**Gotchas:**
1. **No montar `useGLTF` sin gate.** `TestingZone` vive siempre en `Scene`; cargar el GLB al
   arrancar retrasa la intro y todas las zonas. El gate por `activeZone` + `Suspense` es intencional.
2. **No aplicar transformaciones al objeto cacheado.** Se clona la escena y se normaliza el clon;
   el GLB de drei queda intacto para futuros montajes.
3. **El nodo `Plane` no es la mesa.** `Plane.001` es el tablero cerámico y debe conservarse; sólo
   se elimina el nodo exacto `Plane` (fondo del estudio de Blender).
4. **Los materiales se comparten entre mallas.** El recorrido deduplica con un `Set`; sin él los
   líquidos se registrarían varias veces y el pulso se pisaría.
5. **No hace falta tocar la cámara para "acercar" el lab.** El encuadre existente funciona; si se
   agranda el modelo, el aro de radio 2.9 debe seguir conteniendo la huella.

### Añadido (pasada 11): rediseño de la zona AI Workflow

La zona 2 dejó de ser un diagrama abstracto y ahora representa el flujo real de trabajo:
**editor (entrada) → cerebro neuronal (procesamiento IA) → CI/CD (salida)**, con partículas que
recorren el pipeline y cuatro herramientas seleccionables.

| Pieza | Detalle |
|-------|---------|
| `scene/zones/AIWorkflowZone.tsx` | Editor tipográfico con cursor parpadeante y tooltip al hover; cerebro `IcosahedronGeometry` (radio 0.8, detalle 1) con núcleo sólido + cáscara geodésica + anillos giroscópicos, 16 nodos orbitando instanciados y **2 nodos etiquetados clicables** (Cursor derecha, RAG abajo; el nodo Copilot se quitó en la pasada 15 porque no tenía acción); CI/CD con base hexagonal, tres puertas completas BUILD/TEST/DEPLOY, 9 commits instanciados y beacon de despliegue. Un único `<points>` (110 partículas) recorre una `CatmullRomCurve3` con color cian → morado → verde. |
| `data/portfolioContent.ts` | Los 4 `section03.subButtons` llevan `icon`, `usage` (2 cifras), `flow` (sólo RAG) y `beforeAfter` (sólo Automation). `section03.stats` declara la telemetría. **Todo el copy vive aquí**; los componentes no duplican strings. |
| `ui/AIWorkflowLegend.tsx` | Leyenda con 4 `<button>` reales derivados de `subButtons`, `aria-pressed`, icono y color por herramienta. Alterna `activeSubSection` (mismo estado que el dropdown, los clics 3D y el panel). |
| `ui/AIWorkflowStats.tsx` | Panel superior-derecho con las 4 métricas; count-up de 1.3 s con easeOutCubic y salto directo al valor final con movimiento reducido. `aria-hidden` porque es telemetría decorativa. |
| `ui/AIToolIcon.tsx` | SVG inline (sin dependencias) para Copilot, Cursor, RAG y Automation. |
| `ui/DetailPanel.tsx` | En zona AI muestra kicker “AI TOOL · DETAIL VIEW”, icono junto al título, bloque `usage` de dos cifras, pipeline RAG (`flow`) y tarjetas antes/después (`beforeAfter`). Conserva el foco y el cierre existentes. |
| `ui/AccessibilitySummary.tsx` | El resumen sr-only incluye `usage`, `flow` y `beforeAfter`, leídos con `getSubSectionContent()` (misma fuente que el panel). |
| `scene/CameraController.tsx` | `AI_SUB_VIEWS` define un plano cercano por herramienta (lookAt + offset en coordenadas locales del layout); con viewport >640 px se suma `AI_PANEL_LOOK_SHIFT` para dejar la etapa en el área libre a la izquierda del panel y en móvil se usa `AI_MOBILE_LOOK_DROP`. |
| `styles.css` | `.ai-legend` (z-46), `.ai-stats` (z-44), bloques `.dp-usage` / `.dp-flow` / `.dp-ba`, responsive y reduced-motion. |

**Cómo interactúa**

- Editor, nodos Cursor/RAG y CI/CD tienen hitboxes invisibles con `onPointerOver` /
  `onClick`; el editor representa a **Copilot**. Hover = escala + brillo + tooltip; clic = abre o
  cierra el `DetailPanel` de esa herramienta.
- La leyenda, el dropdown de navegación, los clics 3D y el panel leen y escriben **el mismo**
  `activeSubSection`; no hay estado paralelo.
- El chat RAG se oculta mientras hay un sub-tema abierto (ya era así antes del rediseño).
- Con la zona inactiva, hover y `sceneHover` se limpian para que el cursor ambiental no quede
  “pegado” al volver.

**Gotchas (no volver a romperlos)**

1. **El tooltip del editor va DEBAJO del marco, no encima.** En ventanas ≤1120 px la leyenda AI
   ocupa la franja superior izquierda (y≈148–191 a 1052×785) y tapaba el sprite si se anclaba en
   `y=1.46`. Está en `y=-0.82` a propósito; si se sube, el tooltip vuelve a quedar detrás del
   cristal de la leyenda.
2. **La leyenda cierra el dropdown antes de abrir un panel.** `setOpenDropdown(-1)` evita que el
   menú (z-80) tape el `DetailPanel` (z-65) en la misma esquina.
3. **Los planos de cámara AI están alineados con el orden de `section03.subButtons`**
   (Copilot, Cursor, RAG, Automation). Reordenar las herramientas exige reordenar
   `AI_SUB_VIEWS`, o el foco caerá en otra etapa.
4. **El desplazamiento `AI_PANEL_LOOK_SHIFT` sólo aplica con ancho >640 px.** En móvil el panel es
   una hoja inferior; compensar en X dejaría la etapa descentrada sin ganar nada.
5. **El pipeline se escala por aspecto** (`pipelineScale`: 1 / 0.9 / 0.78) para que las tres
   etapas entren en el encuadre. La cámara además aplica `aspectFit`; en vertical el conjunto se
   ve pequeño pero completo. No subir la escala sin revisar el recorte de editor/CI/CD.
6. **El cerebro no debe tocar el suelo.** El nodo RAG vive en `y=-1.18` y su etiqueta en
   `y=-1.64` (coordenadas locales, con el cerebro en `y=0.3`); el suelo está en `y=-1.9`.
   Bajarlo más hunde el nodo en la rejilla.
7. **Las estadísticas son decorativas y no deben anunciarse.** Mantener `aria-hidden`; con
   `prefers-reduced-motion` el count-up salta a `progress=1` para no animar cifras.
8. **Los sprites de etiqueta usan `makeLabelTexture()` y se liberan al desmontar.** No añadir
   texturas remotas ni fuentes externas; el texto se dibuja en canvas con la fuente del proyecto.
9. **Verificado en navegador (1052×785):** tooltip “VS CODE + COPILOT”, clic en editor → GITHUB
   COPILOT, nodos Copilot/Cursor/RAG → su panel, CI/CD → AUTOMATION PIPELINE, leyenda con
   `aria-pressed` sincronizado, count-up 77→147 / 1.2k→2.3k, cámara centrada en el área libre.
   En un iframe de 386×776 (media queries reales): leyenda arriba, stats ocultas, chat
   minimizado sobre el pill de cine y panel como hoja inferior con scroll.

### Añadido (pasada 12): zoom cinematográfico y semántica de la zona AI

El dueño pidió que la cámara se acerque al pulsar cada componente y que se entienda qué
representan el núcleo, Copilot, Cursor, RAG y CI/CD.

| Pieza | Detalle |
|-------|---------|
| `config/aiWorkflowLayout.ts` | **Layout compartido** entre escena y cámara: posiciones locales de editor, cerebro y salida, radio del núcleo, posiciones de los tres nodos y `aiPipelineScale(aspect)`. La cámara importa estos valores en vez de duplicarlos. |
| Núcleo neuronal | Radio **0.8** (antes 1.35) con núcleo sólido interior, cáscara geodésica wireframe, volumen tenue, anillos giroscópicos, 16 nodos orbitando y etiqueta flotante **NEURAL CORE**. La esfera ya no domina el encuadre. |
| Copilot | Cabeza de robot (caja, ojos emisivos, antena, orejas) sobre el núcleo; el editor de la izquierda sigue representando a Copilot. |
| Cursor | Cubo-editor oscuro con aristas neón, filas de código instanciadas y caret parpadeante. |
| RAG | Pila de base de datos vectorial de tres discos, anillo de escaneo y lupa. |
| CI/CD | Torre con base hexagonal, espina vertical, tres puertas completas (`BUILD`, `TEST`, `DEPLOY`) con etiqueta propia, commits instanciados subiendo, cono + esfera de despliegue y etiqueta `CI/CD`. |
| Zoom | `AI_SUB_VIEWS` en `CameraController`: cada herramienta tiene `lookAt` + `offset` en coordenadas locales, multiplicados por `aiPipelineScale`; vuelo de 1.8 s. En escritorio `AI_PANEL_LOOK_SHIFT = 0.5` centra el sujeto en el área libre; en móvil `AI_MOBILE_LOOK_DROP = 0.5`. **Pasada 15:** los offsets se acortaron (2.15–3.7) para que el zoom sea claramente más cercano. |
| Interacción | Cuatro hitboxes invisibles (editor, Cursor, RAG, CI/CD) escriben `activeSubSection`. Leyenda, dropdown y clics 3D abren el mismo panel y el mismo plano de cámara. |

**Cómo se comprobó** (Chrome headless con GPU real, 1052×785): clic 3D sobre la torre →
AUTOMATION PIPELINE; los cuatro botones de la leyenda abren su panel y su plano; el clic del
editor y de los tres nodos ya se había comprobado; a 386×776 el panel pasa a hoja inferior y
sigue abriendo; **0 errores ni warnings de consola**; `npx tsc --noEmit` y `npm run build` OK.

**Gotchas (no volver a romperlos)**

1. **`AI_OUTPUT_POS.y = -0.15` está calibrado contra el HUD de métricas.** Con `y=0.3` la
   etiqueta «CI/CD» quedaba detrás del panel `TODAY · AI METRICS` (arriba-derecha). La curva
   del flujo y la conexión de salida terminan en `y=-0.09`: si vuelves a mover la torre,
   mueve también esos puntos o el flujo entrará por encima de las puertas.
2. **El plano de Automation mira a `y=0.2`**, por encima del centro de la torre: así el
   conjunto baja en pantalla y «CI/CD» no queda detrás del chip AUTOMATION de la leyenda.
   Con `y=-0.1` la etiqueta se perdía en el plano cercano.
3. **La hitbox de CI/CD es hija del grupo de salida.** Al bajar la torre, el área de clic se
   movió con ella; se verificó con un clic sintético en `(900, 370)` a 1052×785. Si cambias
   `AI_OUTPUT_POS`, recalcula el punto de clic o pruébalo en navegador.
4. **`AI_SUB_VIEWS` debe seguir el orden de `section03.subButtons`** (Copilot, Cursor, RAG,
   Automation). Reordenar herramientas sin reordenar los planos enfoca otra etapa.
5. **`aiPipelineScale` se aplica dos veces:** al grupo raíz de la escena y a las anclas de la
   cámara. Si solo se aplica a uno, en tablet/móvil el zoom cae al lado del icono.
6. **La etiqueta NEURAL CORE vive fuera de `coreGroupRef`.** Dentro heredaría el giro del
   núcleo y el texto dejaría de leerse. Lo mismo aplica a cualquier etiqueta nueva.
7. **El tooltip del editor se oculta cuando hay una ficha abierta**
   (`visible={hover === 'editor' && activeSubSection === null}`): con el zoom, el tooltip
   quedaba detrás de la tarjeta héroe y duplicaba el nombre que ya muestra el panel.
8. **No bajar más la torre para esquivar el chat.** En la vista general el chat (capa DOM)
   tapa la base del pipeline; al abrir una ficha se oculta y la torre se ve completa. Bajarla
   más devolvería la etiqueta «CI/CD» al conflicto con las métricas.
9. **En móvil el panel es una hoja inferior** que cubre la mayor parte del pipeline; es el
   comportamiento esperado del panel, no un fallo. No compensar en X en ese ancho.
10. **Las etiquetas siguen saliendo de `makeLabelTexture()` y se liberan al desmontar.** No
    añadir fuentes ni texturas remotas: el texto se dibuja en canvas con la fuente del proyecto.

### Añadido (pasada 12): diorama GLB optimizado en Creative 3D

La zona 3 dejó de ser geometría procedural (TorusKnot, barras, torta, líneas y chispas) y ahora
muestra el diorama industrial de `models/Creative.glb` en una vitrina neón. El GLB fuente tiene
1.808 nodos de malla, 43 geometrías compartidas, 113.334 triángulos renderizados y ninguna
textura. Se optimizó a **45 `InstancedMesh` con `EXT_mesh_gpu_instancing`**, colores por
instancia (`_COLOR_0`), 16.008 vértices únicos y **586 KB**, conservando los 113.334 triángulos.

| Aspecto | Detalle |
|---------|---------|
| Fuente | `models/Creative.glb` (ignorado por git), 420 × 264 × 420 unidades, base en y=0. |
| Optimización | Carga en Node con `GLTFLoader.parse`; agrupa por `geometry.uuid` + clave de transparencia/opacidad; clona cada geometría una sola vez, la deja indexada, descarta todo atributo salvo `position`/`normal` y crea un `InstancedMesh` por grupo con matriz `normalización × matrixWorld` y color del material fuente. Exporta con `GLTFExporter` (`binary: true`). |
| Normalización | Escala a **4,4 de ancho**, centrada en XZ y con la base en y=0. La matriz de normalización se hornea en las matrices de instancia. |
| Materiales | Dos `MeshStandardMaterial`: opaco blanco (`roughness: 1`, `metalness: 0`) y vidrio por nivel de opacidad (`transparent`, `depthWrite: false`). El color del material original vive en `instanceColor`. |
| Asset web | `public/models/creative.glb` (586 KB, versionado). El fuente de `models/` no se toca. |
| `CreativeZone.tsx` | Vitrina: rejilla, halo, dos aros y 40 ticks orbitando (un `<points>`); el diorama gira como tornamesa (`0.09 rad/s`) y flota ±0.035. Carga diferida al visitar la zona por primera vez y **se queda montado** al salir para que el vuelo de salida no lo haga desaparecer. |
| Encuadre | `zones.ts`: cámara `[52.8, 3.35, -4.65]` mirando a `[48, -0.05, -12]` (tres cuartos elevado). `CameraController` añade `CREATIVE_SUB_VIEWS` a ~9 unidades: frontal elevado, tres cuartos derecho y picado. En escritorio el look-at se corre `0.9` a la izquierda del panel; en móvil baja `1.95` para que el edificio quede sobre la hoja inferior. |
| Movimiento reducido | Giro y flotación a cero, ticks estáticos; la cámara aterriza sin tween. |

**Cómo se comprobó** (Chrome headless con GPU real): 1052×785 → **59,9 FPS / 150 frames en
2,5 s**, los tres sub-temas abren su panel con el diorama completo, ida y vuelta a Digital Twin
sin pop-in; 386×776 → los tres sub-temas dejan el edificio visible sobre la hoja inferior;
**0 errores ni warnings de consola**; `npx tsc --noEmit` y `npm run build` OK.

**Gotchas (no volver a romperlos)**

1. **No fusionar las 1.808 piezas en una sola malla.** El primer intento produjo 12,2 MB y
   ~340k vértices al perder la reutilización de geometría. Instanciar por geometría deja 45
   draw calls y 586 KB. El GLB fuente comparte 43 geometrías entre 1.808 nodos.
2. **Nunca mutar las geometrías compartidas.** Aplicar `applyMatrix4` in-place nodo a nodo
   transformó la misma geometría 1.808 veces y produjo bounding spheres NaN. El optimizador
   clona una geometría por grupo y hornea la transformación en la matriz de instancia.
3. **`envMapIntensity` necesita un `envMap` propio.** Con `MeshStandardMaterial` y
   `envMap === null`, three r169 pisa la intensidad con `scene.environmentIntensity`. En
   `Diorama` se asigna `material.envMap = scene.environment` y `envMapIntensity = 0.55`; sin
   eso el verde de la base se iba a amarillo y el ACES lavaba las fachadas. Es el mismo gotcha
   que en `CityZone`, pero aquí el material sí es PBR.
4. **El GLB ya viene normalizado.** `MODEL_BASE_Y = -1.32`, `MODEL_HEIGHT = 2.77` y la caja del
   fallback (`4.4 × 2.77 × 4.4`) dependen de la exportación actual. Si reemplazas el modelo,
   vuelve a normalizarlo a 4,4 de ancho con la base en y=0 o actualiza esas constantes.
5. **El diorama se renderiza desde la caché de drei; no se clona.** El `<group ref>` sólo aplica
   rotación y flotación. No muevas la raíz de `scene` ni escribas transforms en el objeto
   cacheado: afectaría a cualquier otro montaje y al volver a la zona.
6. **Los planos de sub-tema son propios, no el arco genérico 0.62×.** A 4,6 unidades el diorama
   se partía por la mitad. Las tres vistas rondan las 9 unidades y mantienen la cámara en X ≥ la
   del sujeto para no dejar ver los edificios del Digital Twin al fondo. El desplazamiento de
   panel es `0.9` en escritorio; en móvil `1.95` (con 1.1 el edificio quedaba detrás de la hoja).
7. **El GLB no tiene UVs ni texturas a propósito.** El color por pieza sale de
   `instanceColor`; no añadas materiales con mapas sin reexportar UVs.
8. **La zona se arma en la primera visita y no se desmonta.** Si se desmontara al salir, el
   diorama desaparecería durante el vuelo de salida; su geometría es pequeña y drei ya cachea el
   asset. Para liberar memoria habría que hacerlo con una estrategia explícita, no con un gate
   por `activeZone`.

### Añadido (pasada 13): rediseño del dron del Configurator

El modelo anterior (casco blanco + dos aros gigantes + dos brazos) se leía como un platillo
volante y no como un producto. Se rehízo como un **cuadricóptero modular de 13 grupos**: casco,
cúpula, batería, LiDAR/sensores, antena, gimbal, lente, cuatro brazos (boom + motor + aro de
protección + rotor de tres palas) y dos patines de aterrizaje. Sigue siendo procedural: no hay
GLB ni texturas nuevas.

| Pieza | Detalle |
|-------|---------|
| Casco (`hull`) | Cápsula achatada plateada, panza y morro de grafito, placas laterales con tiras naranja, rejilla trasera y **aviónica interior** (placa + chips + LEDs) que queda oculta bajo la cúpula y se descubre al despiezar. |
| Cúpula (`canopy`) | Semiesfera de cristal oscuro con aro, espina y dos costillas plateadas. |
| Batería (`battery`) | Pack plateado con tira naranja, abrazaderas de grafito y placa de montaje. |
| Sensores (`sensor`) | Domo LiDAR con aro naranja y dos cámaras frontales con lente emisiva. |
| Antena (`antenna`) | Mástil trasero inclinado con punta naranja y aleta. |
| Gimbal + lente | Suspensión de horquilla, carcasa de cámara y barril con cristal naranja propio (`lens`), separado del gimbal para que el despiece lo expulse hacia delante. |
| Brazos (`armFL/FR/RL/RR`) | Boom de 0.9, nacela, anillo naranja, **aro de protección de radio 0.42 con tres soportes**, rotor de tres palas con punta naranja y luz de navegación. |
| Patines (`skidLeft/Right`) | Raíl tipo cápsula, dos soportes y tope naranja. |

**Animación:** se conservan las cuatro fases del scroll. Se añade el giro continuo de los cuatro
rotores (7.5 rad/s, sentidos alternos) y `fitScale` pasa a 0.82 / 0.9 / 1 para que el despiece
quepa en vertical. El cambio plata→naranja sigue afectando al material compartido del chasis;
las piezas de grafito y el acento naranja no se repintan.

**Cómo se comprobó** (Chrome headless con GPU real, 1052×785 y 386×776): hero, despiece completo
(offset 0.5), material (0.62), reensamblado (1.0) y movimiento reducido; **59,9 FPS / 150 frames**
en el despiece abierto; **0 errores ni warnings de consola**; `npx tsc --noEmit` y
`npm run build` OK.

**Gotchas (no volver a romperlos)**

1. **Los 13 `PART_IDS` deben existir en el JSX y en `EXPLODE_OFFSETS`.** El tipo
   `Record<PartId, …>` obliga a declarar el offset, pero un grupo sin `register(id)` no se
   animaría. Si añades una pieza, regístrala y dale offset.
2. **Los rotores son hijos de los brazos.** Los grupos de brazo sólo rotan en Y, así que el giro
   local de los rotores sigue siendo horizontal. No inclines los brazos en X/Z o las aspas
   cabecearán.
3. **El giro del rotor usa `elapsed * 7.5`, no acumulación por frame.** Es estable al cambiar de
   zona y con el scroll; con movimiento reducido se fuerza a 0. No mezclar ambas estrategias.
4. **La lente es un módulo aparte del gimbal.** Si la metes dentro del gimbal, elimina su entrada
   de `EXPLODE_OFFSETS` y su `register`; si no, se moverá dos veces.
5. **Un material por familia, compartido entre mallas.** `shell` (plata→naranja), `dark`
   (grafito), `glass` (cúpula), `lens` (pulso) y `accent` (tiras, puntas, luces). Clonar el
   material por malla rompe la transición de color en bloque.
6. **En vertical, `fitScale` 0.82/0.9/1.** Con 0.92 el rotor extremo se recortaba en el despiece
   completo a 386 px. Si cambias los offsets de los brazos, vuelve a comprobar los bordes.
7. **El anillo de protección no debe crecer sin revisar el encuadre.** Radio 0.42 deja el dron en
   ~2.8 unidades de ancho; el plano de cámara del Configurator no se tocó. Un aro mayor vuelve a
   invadir el texto de `ScrollUI`.
8. **Para probar el scroll en headless**, el contenedor de drei se añade como hijo del wrapper
   del `<canvas>` (no de `<main>`); hay que buscar el hijo con `overflow-y: auto` y escribir su
   `scrollTop`. Buscar solo por `scrollHeight` encuentra el contenedor equivocado.

### Añadido (pasada 14): pre-order funcional del Configurator

El botón **PRE-ORDER NOW** de la zona 6 ya no es decorativo: abre un flujo de
reserva completo, local y sin backend (`ui/PreOrderModal.tsx`).

| Paso | Qué hace |
|------|----------|
| 01 Configure | Tres ediciones (`EXPLORER`, `PRO`, `ENTERPRISE`), tres acabados con recargo, cantidad 1–5 y resumen de precio en vivo (subtotal + envío + total). |
| 02 Pilot | Nombre, email, empresa opcional y región de entrega. Validación en cliente con `aria-invalid`, `role="alert"` y foco al primer campo inválido. |
| 03 Confirmed | Procesado simulado (1,5 s; 450 ms con movimiento reducido) y confirmación con referencia `AER-26-XXXX`, ETA y resumen. |

**Contenido:** todo el copy, ediciones, acabados, regiones, etiquetas y errores viven en
`portfolioContent.section06.preorder`. El componente no duplica cadenas y sólo calcula precio y
estado. La referencia se genera con `Math.random()` en el cliente: **no se envía nada**.

**Interacción y accesibilidad**

- El botón declara `aria-haspopup="dialog"`, `aria-expanded` y `aria-controls="preorder-dialog"`.
- El modal se monta en un **portal de `document.body`** y usa `role="dialog"`, `aria-modal`,
  `aria-labelledby`, foco inicial en cerrar, `Escape` para cerrar, trampa de Tab y devolución del
  foco al botón que lo abrió (sólo si sigue conectado).
- Al cambiar de paso, el foco va al encabezado del paso (`tabIndex={-1}`); si se vuelve a
  configurar, va a la primera edición. Así el foco nunca cae en `<body>` dentro del diálogo.
- Las tarjetas de edición y los acabados son `<button>` con `aria-pressed`; la cantidad usa
  `output` con `aria-live`. La zona no cambia con ←/→ mientras el diálogo tiene el foco: el hook
  global excluye `.preorder-backdrop` / `.preorder-modal` en `UI_OWNS_KEYS_SELECTOR` y
  `DIALOG_SELECTOR`.
- `prefers-reduced-motion` conserva el paso de procesado pero acorta el retardo; el spinner queda
  estático y Framer Motion omite la entrada.

**Gotchas (no volver a romperlos)**

1. **El modal va en portal, no dentro de `.product-scroll-container`.** Ese contenedor tiene
   `pointer-events: none` y sus animaciones crean un contexto propio; además, la rueda debe seguir
   llegando a `ScrollControls` sólo cuando el diálogo está cerrado. El portal a `body` con
   `z-index: 95` lo deja sobre el dossier (90) y bajo el cursor (200).
2. **No secuestrar la rueda del configurador al cerrar.** El backdrop y el modal son eventos DOM
   independientes de la capa de ScrollControls; no añadir listeners globales de `wheel`/`touch`
   para “bloquear” el scroll. Con el overlay abierto los eventos ya no llegan a su div.
3. **El anillo de foco programático del encabezado se anula a propósito.**
   `.preorder-body-title:focus-visible { outline: none !important; }`: el `tabIndex={-1}` existe
   sólo para que el lector de pantalla anuncie el paso, no para indicar un control.
4. **La trampa de Tab también cubre el caso “foco fuera del diálogo”.** Si un botón se desmonta
   (por ejemplo al pasar de confirmación a configuración), el foco puede quedar en `<body>`; tanto
   `Shift+Tab` como `Tab` lo recuperan dentro del modal.
5. **La confirmación va en dos columnas en escritorio** (`minmax(0,1fr) 300px`). Con una sola
   columna los botones quedaban bajo el pliegue a 1052×785. En ≤820 px vuelve a una columna.
6. **El total se recalcula, no se acumula.** `(precioEdición + recargoAcabado) * cantidad + envío`
   a partir del estado actual; no guardar subtotales derivados en el store.
7. **El proceso no debe prometer backend.** Los textos `demoNote` y la confirmación dicen
   explícitamente que no hay cobro ni envío de datos. Si algún día se conecta un servicio real,
   hay que cambiar el copy y añadir manejo de errores de red (hoy no existe a propósito).
8. **Verificado en headless (1052×785 y 386×776):** configuración de Enterprise + Ember + 3
   unidades ($12.210), envío a LATAM ($12.400), errores vacío/inválido, confirmación con
   referencia y ETA, `Escape` con foco devuelto al botón, clic en backdrop, `Tab` atrapado,
   reinicio con CONFIGURE ANOTHER y apertura en móvil; `npx tsc --noEmit` y `npm run build` OK.

### Añadido (pasada 15): zoom AI, interacción del diorama y guion completo

Cinco correcciones pedidas por el dueño sobre la experiencia existente.

**1. Cámara AI más cercana y nodo Copilot fuera**

- `AI_SUB_VIEWS` acorta los offsets a **2.15–3.7** (el plano general no cambia). Cada herramienta
  llena el encuadre al seleccionarla; `AI_PANEL_LOOK_SHIFT` baja a **0.5** para centrarla en el
  área libre a la izquierda de la ficha (en móvil sigue `AI_MOBILE_LOOK_DROP = 0.5`).
- Se eliminó el nodo flotante **Copilot** del cerebro (no tenía acción): su hitbox, su nodo
  orbitando, su etiqueta y su ancla en `aiWorkflowLayout.ts`. Copilot sigue existiendo como
  concepto y se abre desde el editor o desde la leyenda, así que `section03.subButtons` y
  `AI_SUB_VIEWS` conservan las cuatro entradas y su orden.

**2. Creative 3D: camión, tanques y edificio clicables**

- Los tres objetos tienen caja proxy invisible + jaula wireframe al hover/foco, pero los proxies
  se solapan en pantalla y el raycast siempre elige el más cercano: desde el plano general **el
  camión era inalcanzable** (una rejilla de clics de 20 px sólo acertaba edificio y tanques).
- Solución: tres **pines DOM anclados al mundo 3D** con drei `<Html>` sobre
  `CREATIVE_OBJECTS`. Giran con la tornamesa porque viven dentro del grupo del diorama, pero el
  clic no compite con el raycast. `zIndexRange={[60, 0]}` los deja **bajo** el `DetailPanel`
  (z-65) y las pestañas (z-70/80). La etiqueta sale de
  `getSubSectionContent(CREATIVE_ZONE_INDEX, id).label`, sin duplicar copy.
- Clic = `setActiveSubSection` (toggle) + `setOpenDropdown(-1)`; hover/focus enciende la misma
  jaula 3D y `sceneHover` del cursor. En ≤640 px los pines se colapsan a un **punto de 26 px**
  (las etiquetas de camión y tanques se solapaban con ~39 px de separación) y la etiqueta se
  despliega sólo en `:hover`, `:focus-visible` o `.is-active`; el `aria-label` conserva el nombre
  accesible aunque el texto esté oculto.

**3. Digital Twin en modo guion: un plano por nivel de consumo**

`GuidedTour` inyecta cuatro tomas de `CITY_FILTER_MS = 4200` tras el plano general de la ciudad:
**ALL → NORMAL → HIGH → ALERT**, cada una con `setEnergyFilter(filter)` y sin sub-tema abierto.
Los chips de `CityHUD` se actualizan solos porque leen el mismo estado. `setZone` reinicia el
filtro, así que la toma fija **primero** la zona y **después** el filtro.

**4. Configurator en modo guion: scroll automático y pre-order**

- Nuevo `guidedProductStep` en el store. `ProductZone.useFrame` escribe
  `scroll.el.scrollTop = step / (SCROLL_SECTIONS.length - 1) · (scrollHeight - clientHeight)`
  cuando el paso no es `null` y el elemento está conectado. El scroll DOM sigue siendo la
  autoridad del offset: `productScroll` y `productPhase` no cambian y **la cámara no se toca**.
- Tomas: establecimiento (3,5 s), pasos 1–3 a `PRODUCT_STEP_MS = 4500` y cierre de 2,6 s con
  `requestPreorder()`. `ScrollUI` escucha el contador `preorderRequests` y abre
  `PreOrderModal`; el guion termina con `setGuided(false)` y **deja el modal abierto**, sin
  teletransportar a la zona 0.
- El guion completo son **32 tomas** (~141 s). Las zonas 0–3 mantienen plano general + sub-temas +
  outro; ciudad y configurador no llevan outro porque su última toma ya es la conclusión.

**Gotchas (no volver a romperlos)**

1. **Los pines de Creative son DOM y no deben subir de z-60.** Si se ponen por encima de la
   ficha (z-65) o de las pestañas (z-70), flotan sobre los paneles abiertos. Tampoco añadir
   `distanceFactor`: el pin debe conservar tamaño de clic constante.
2. **No quitar los proxies 3D al añadir los pines.** Los pines resuelven la selección cuando el
   objeto está tapado; los proxies siguen dando clic directo y la jaula de hover sobre la pieza.
3. **En móvil el pin colapsado necesita `aria-label`.** La etiqueta usa `display: none` y deja de
   aportar nombre accesible al `<button>`; el `aria-label` es lo único que anuncia el lector.
4. **`guidedProductStep` es estado imperativo, no offset.** No escribir `productScroll.offset`
   directamente: ScrollControls reescribe el offset desde su DOM y el HUD se desincroniza. El
   paso se limpia al salir y al entrar de nuevo en la zona (`setZone` resetea `productPhase`;
   el guion vuelve a fijar el paso en cada toma).
5. **El pre-order del guion se abre por contador, no por estado booleano.** `requestPreorder()`
   incrementa `preorderRequests`; un booleano se quedaría en `true` y no volvería a abrir el
   modal en una segunda pasada del guion.
6. **Los filtros de ciudad van después de `setZone`.** `setZone` limpia `energyFilter` a `'all'`;
   invertir el orden haría que la toma NORMAL se viera como ALL.
7. **El zoom AI no debe invadir el HUD.** Los offsets cortos se calibraron con
   `AI_PANEL_LOOK_SHIFT = 0.5`; subir el zoom sin revisar deja la etiqueta de la etapa debajo de
   la leyenda o de las métricas.
8. **`AI_SUB_VIEWS` sigue el orden de `section03.subButtons`** (Copilot, Cursor, RAG,
   Automation) aunque el nodo 3D de Copilot ya no exista: el editor sigue abriendo ese plano.

**Cómo se comprobó** (Chrome headless con GPU real): 1052×785 → pines de camión, tanques y
edificio abren VEHICLE ASSET / STORAGE FARM / HERO BUILDING; el guion recorre los cuatro filtros
con los chips sincronizados y el configurador con offsets 0 → 0.333 → 0.666 → 1, PRE-ORDER
visible en la página 3 y modal `RESERVE YOUR AERIS` abierto al terminar. 386×776 → los pines
colapsados no se solapan, el panel se abre correctamente en los tres y el pre-order funciona.
Movimiento reducido: cámara sin tween, pines sin pulso, guion sin typewriter. **0 errores de
consola**; `npx tsc --noEmit` y `npm run build` OK.

### Añadido (pasada 16): guía de teclado WCAG AA antes de la intro

El sitio abre con un **acto propio, `phase === 'keys'`**, que presenta todos los atajos reales
antes de la intro cinemática. Sólo después arrancan los timers del título y el empuje de cámara.

| Pieza | Detalle |
|-------|---------|
| `store/useExperienceStore.ts` | `ExperiencePhase = 'keys' \| 'intro' \| 'experience' \| 'credits'`; el estado inicial pasa de `'intro'` a `'keys'`. |
| `App.tsx` | `{phase === 'keys' && <KeyboardGuide />}` antes de `<CinematicIntro />`. |
| `data/portfolioContent.ts` | `keyboardGuide`: kicker, título, descripción, `shortcuts` (teclas + uso), nota, CTA y hint. **Todo el copy vive aquí**; el componente sólo pinta. |
| `ui/KeyboardGuide.tsx` | Panel `role="dialog"` con letterbox, 8 filas de `<kbd>` + acción, barrido, CTA **START INTRO** y **SKIP TO PORTFOLIO**. `Escape` salta a la intro; `Enter`/`Space` continúa si el foco no está en un control. |
| `scene/CameraController.tsx` | `KEYS_POSE` mantiene la cámara en un plano lejano (0.8 s) durante la guía; al pasar a `'intro'` se lanza el push-in de 6.2 s. |
| `ui/AccessibilitySummary.tsx` | La región `aria-live` anuncia la guía y que Enter continúa a la intro. |
| `styles.css` | Bloque `.keys-*`, keyframes `keysPanelIn / keysRowIn / keysActionsIn / keysTap / keysScan / keysPulse`; reduced-motion los desactiva y oculta el barrido. |

**Mapa de teclas que el sitio escucha de verdad** (también es el copy de la guía):

| Tecla | Uso |
|-------|-----|
| ← / → | Sección anterior / siguiente |
| ↑ / ↓ | Sub-tema o ítem de menú anterior / siguiente |
| ↓ (en la pestaña activa) | Abre su menú de sub-temas |
| Home / End | Primera / última sección o ítem del menú |
| Tab / Shift + Tab | Mover el foco entre controles |
| Enter / Space | Activar control · abrir sub-tema |
| Escape | Cerrar menú · panel de detalle · diálogo |
| Escape | Saltar intro · detener guion · salir de créditos |

**Gotchas (no volver a romperlos)**

1. **La guía es fase, no un overlay local.** Si se montara sobre `phase === 'intro'`, los
   `setTimeout` del título y el push-in de 6.2 s ya estarían corriendo detrás. `CinematicIntro`
   sólo se monta con `'intro'`, así que sus timers empiezan cuando el usuario pulsa START.
2. **El autofoco del CTA espera 560 ms y sólo actúa si el foco sigue en `<body>`.** Sin ese
   guard, quien tabula al skip link en el primer instante perdía el foco de vuelta al botón.
3. **Enter/Space sólo se interceptan cuando el foco no está en un control.** Si está en el CTA
   o en SKIP, manda la activación nativa; interceptarla abriría la intro dos veces.
4. **El foco al cambiar de acto se mueve en doble `requestAnimationFrame`.** El acto de destino
   se monta en el commit que sigue a `setPhase`; un solo frame aún ve el DOM anterior y el foco
   caería en `<body>`.
5. **`skipToPortfolio` fija `setZone(0)` antes de `setPhase('experience')`** y enfoca la pestaña
   de Architecture: el usuario de teclado entra directo en la tira de navegación.
6. **En móvil el panel debe caber sin scroll.** A ≤640 px se reducen padding de capa (14 px),
   titular a una línea (`clamp(22px, 7.1vw, 30px)`), filas (kbd 20 px), gaps y tipografía.
   Con los valores de escritorio el panel medía 752 px y desbordaba un viewport de 776 px.
7. **Centrado con `margin: auto`, no con `justify-content: center`.** `.keys-layer` es flex en
   columna y el panel usa `margin: auto`: si el texto se amplía y no cabe, los márgenes
   automáticos se anulan y el scroll empieza arriba sin recortar el encabezado.
8. **La animación es sólo CSS.** No añadir un bucle de rAF: el Canvas WebGL ya está
   renderizando detrás y la guía no necesita estado por frame.

**Cómo se comprobó** (Chrome headless con GPU real): 1052×785 → panel 900×557 centrado, foco en
START INTRO, animaciones `keysPanelIn/keysRowIn/keysTap/keysScan`; Enter → intro con foco en
`.cine-skip`; Escape en la intro → experiencia; Escape en la guía → intro; SKIP → experiencia con
foco en la pestaña Architecture; primer Tab → skip link y **no** lo roba el autofoco; movimiento
reducido → sin animaciones y sin barrido. 386×776 → panel 558 px, bottom 667, `scrollHeight`
igual al viewport (sin scroll). **0 errores de consola**; `npx tsc --noEmit` y `npm run build` OK.

### Añadido (pasada 17): Guided Mode — tour de seis pasos alineado con el video

El botón **GUIDED MODE** de `CinemaControls` (`data-guide-start`) lanza un recorrido
automático de seis pasos que reproduce el video de presentación. Sustituye el antiguo
guion de 32 tomas: ahora cada zona tiene **un** plano, una ficha y una duración.

| Pieza | Rol |
|-------|-----|
| `config/guideSteps.ts` | `GUIDE_STEPS`: por paso, `id`, `zoneIndex`, `duration`, `highlight`, `camera` y `productScroll`. `GUIDE_CITY_BUILDING_ID` elige la torre protagonista (mayor `h - distancia*0.18`). |
| `store/useExperienceStore.ts` | `isGuideModeActive`, `currentGuideStep`, `guideComplete` + setters. `setGuideModeActive(true)` resetea paso, cierre, menús, sub-tema, edificio, scroll guiado, filtro y hover; **no cambia `activeZone`**. `setGuideStep` acota 0..5. |
| `ui/GuideMode.tsx` | Capa DOM: backdrop con foco radial, ficha glass, dots + «STEP X OF 6», chips, auto-avance, teclado, trampa de foco y pantalla final. |
| `scene/GuideHighlights.tsx` | Halos billboard, anillos de suelo, escudo del paso 2, etiquetas COPILOT/CURSOR/RAG y jaula del edificio. Material aditivo + Bloom. |
| `scene/CameraController.tsx` | Rama `isGuideModeActive`: pose por paso y **persecución amortiguada** (`GUIDE_CAMERA_LERP = 0.05` por frame corregido por delta), no un tween con duración. |
| `ui/ScrollUI.tsx` | Durante el tour oculta barra y secciones; mantiene montado **PRE-ORDER** y le añade `is-guide-target`. |
| `App.tsx` | Con el tour activo oculta nav, HUD héroe, CityHUD, chat, leyenda y stats IA; conserva paneles, ScrollUI y `GuideMode`. |
| `ui/AccessibilitySummary.tsx` | Anuncia cada paso (título, descripción, chips, secundario) y la pantalla final por `aria-live`. |
| `data/portfolioContent.ts` | `guideMode`: textos de los 6 pasos, etiquetas de control, cierre y `completion.videoUrl`. |

**Los seis pasos**

| # | Zona | Duración | Cámara | Foco 3D |
|---|------|----------|--------|---------|
| 1 | Architecture | 5 s | `[0,0.7,7.2]` → `[0,0.1,0]` | Halos 1.55 / 1.92 + anillo de suelo 1.9 |
| 2 | Testing | 5 s | `[16.2,1.2,1.8]` → `[16,-0.2,-4]` | Halo 2.15 + suelo 2.35 + escudo con check en `[0,1.2,0.35]` |
| 3 | AI Workflow | 6 s | `[32,1.2,3.6]` → `[32,-0.15,-8]` | Halo exterior 3.9 + suelo 3.6 + halos y etiquetas de Copilot/Cursor/RAG |
| 4 | Creative 3D | 5 s | `[52.4,3.1,-5.2]` → `[48,-0.1,-12]` | Halo 2.78 + suelo 2.45 |
| 5 | Digital Twin | 6 s | `null`: órbita isométrica del edificio | Aro de suelo, halo y jaula wireframe sobre la torre elegida |
| 6 | Configurator | 7 s | `[80,2,-11.5]` → `[80,0.5,-20]` | Halo 2.05 + suelo 2.35; scroll al despiece y, al 48%, a la última página |

**Comportamiento**

- El auto-avance es un `setTimeout` por paso; el efecto depende de `currentGuideStep`, así que
  Next/Previous lo reinician. La barra inferior (`animationDuration`) refleja la duración real.
- En el último paso el botón dice **FINISH** y abre la pantalla final *sin cerrar el tour*:
  **WATCH VIDEO** (deshabilitado mientras no haya URL) y **EXPLORE FREELY** (cierra y devuelve
  la escena a la zona actual). `Escape` también cierra desde cualquier paso.
- El backdrop es un radial-gradient que oscurece los bordes y deja el centro del sujeto:
  z-60, por debajo de paneles (65), nav (70/80) y ficha (86).
- Teclado: `←`/`→` navegan, `Escape` cierra, `Tab` queda atrapado en la ficha. El hook global
  `useGlobalKeyboardNav` se retira mientras `isGuideModeActive` (no compiten por las flechas).
- Al cerrar, el foco vuelve a `[data-guide-start]` en **doble `requestAnimationFrame`**: el
  botón de cine se remonta al desactivar el tour.
- Movimiento reducido: la cámara **salta** a cada pose (`alpha = 1`), halos/escudo quietos, barra
  de tiempo estática y Framer Motion sin transformaciones.

**Gotchas (no volver a romperlos)**

1. **`setZone` primero; edificio y scroll después.** `setGuideModeActive`/`setZone` limpian
   `selectedBuilding`, `guidedProductStep` y el filtro. El efecto del paso fija la zona, luego el
   edificio del paso 5 y luego las páginas del paso 6; invertir el orden deja el panel o el scroll
   vacíos.
2. **El paso 5 necesita el objeto completo de `cityData`, no el id.** `BuildingPanel` y la órbita
   leen `selectedBuilding`; si sólo se escribe un id, el panel no abre y la cámara cae al plano
   general.
3. **La cámara del tour es de `CameraController`.** `GuideMode` y `ProductZone` no deben tocarla.
   Al salir se hace `f.key = ''` para relanzar el tween normal desde la pose real; sin eso la
   cámara se queda clavada en el último paso.
4. **`GUIDE_CAMERA_LERP` es un lerp por frame, no un tween.** `alpha = 1 - (1 - 0.05)^(dt*60)`.
   Si se cambia a un tween con duración, pulsar Next a mitad de vuelo reinicia el encuadre y se
   pierde la sensación de persecución.
5. **Las etiquetas 3D usan `zIndexRange={[84, 62]}`.** Deben quedar sobre el backdrop (60) y
   debajo de la ficha (86). Subirlas las hace flotar sobre el diálogo.
6. **El resaltado del PRE-ORDER usa `box-shadow`, no `transform`.** El botón ya tiene el efecto
   magnético de Framer Motion; una animación de `transform` competiría con ella.
7. **`ScrollUI` no se desmonta durante el tour.** Se ocultan barra y secciones, pero el botón
   PRE-ORDER sigue en el DOM para que el foco del paso 6 exista. El offset lo sigue gobernando
   `ScrollControls`; el tour sólo escribe `guidedProductStep` (scrollTop del DOM), nunca
   `productScroll.offset`.
8. **El encuadre AI se abrió a ~11,6 unidades.** Con el plano anterior CI/CD y el halo exterior
   se cortaban en los bordes. Si se acorta, comprobar editor + torre + halo completos.
9. **El escudo del paso 2 vive en `y=1.2`.** Con `1.55` el borde superior se salía del viewport a
   1052×785. No subirlo sin volver a comprobar el encuadre del laboratorio.
10. **`completion.videoUrl` está vacío a propósito.** No inventar enlaces: mientras esté vacío,
    WATCH VIDEO se muestra deshabilitado con `videoPending`. Al pegar la URL de Loom/Drive se
    convierte en `<a target="_blank" rel="noreferrer">`.
11. **El resumen accesible sólo se suscribe a los campos del tour.** No añadir `cityData` ni el
    tick IoT: el lector de pantalla recibiría una actualización cada 2 s.
12. **La ficha es el diálogo, no los botones internos.** `tabIndex={-1}` en `.guide-card` permite
    enfocar el diálogo al entrar y en cada paso; la trampa de Tab recorre sólo sus controles.

**Cómo se comprobó** (Chrome headless con GPU real): 1052×785 → seis pasos con su ficha, chips,
dots y contador; auto-avance 1→2 a los 5 s; `→`/`←` y `Escape`; panel del edificio en el paso 5;
despiece y PRE-ORDER resaltado en el paso 6; pantalla final con WATCH VIDEO deshabilitado y
EXPLORE devolviendo foco y chrome. 390×844 → ficha superior (12 px), dron y PRE-ORDER visibles sin
solape. Movimiento reducido → cámara sin lerp y animaciones quietas. **0 errores de consola**;
`npx tsc --noEmit` y `npm run build` OK.

### Añadido (pasada 18): checklist del reclutador

Se integró la checklist de Fernando de forma quirúrgica, sin reescribir componentes ni alterar
la navegación. **Todo el copy nuevo vive en `portfolioContent.ts`**:

- `section03.pipelineBrief` — kicker, herramientas, tres etapas y la nota de velocidad.
- `recruiter.contribution` — frase de autoría de las secciones 01, 02, 04 y 05.
- `recruiter.microInteraction` — justificación del botón magnético.
- `recruiter.techBadge` — etiqueta e ítems del badge global.
- `CONTRIBUTION_ZONE_INDICES = [0, 1, 3]` — zonas con `DetailPanel`; la 05 se resuelve en
  `BuildingPanel` y por eso no está en el array.

| Pieza | Rol |
|-------|-----|
| `ui/AIWorkflowBrief.tsx` | Overlay superior-izquierdo sólo en zona AI: **DAILY WORKFLOW · GitHub Copilot + Cursor IDE**, flujo `INPUT CODE → AI PROCESSING (COPILOT · CURSOR · RAG) → OUTPUT CI/CD` y la nota de 40-60% faster. Es texto real (no `aria-hidden`). |
| `scene/zones/AIWorkflowZone.tsx` | Etiquetas 3D `INPUT · CODE`, `AI PROCESSING` y `OUTPUT · CI/CD`; el tooltip del editor sigue diciendo `VS CODE + COPILOT`. |
| `ui/DetailPanel.tsx` | `.dp-contribution` al final del panel en las zonas 0, 1 y 3. |
| `ui/BuildingPanel.tsx` | El mismo bloque al final del panel de edificio (sección 05). |
| `ui/TechBadge.tsx` | Badge **TECH STACK & STANDARDS** con ⚡ 60 FPS · ♿ WCAG AA · 🎨 Figma to Production. Toggle real en Zustand (`techBadgeOpen`), chevron y pulso del rayo. |
| `store/useExperienceStore.ts` | `techBadgeOpen` / `setTechBadgeOpen`. El valor inicial es `true` en escritorio y `false` si `matchMedia('(max-width: 640px)')` coincide. |
| `ui/ScrollUI.tsx` | Nota junto al PRE-ORDER y botón magnético refactorizado con `useMotionValue` + `useSpring` (`MAGNET_STRENGTH = 0.3`; spring 260/20/0.6), componiendo `x`/`y` con el `scale` de `whileHover`. |
| `ui/AccessibilitySummary.tsx` | Anuncia el pipeline AI en las sub-opciones y la contribución al abrir el detalle. |
| `styles.css` | Bloque `RECRUITER CHECKLIST (pasada 18)`: `.dp-contribution`, `.ai-brief`, `.tech-badge`, `.product-preorder-note` y sus breakpoints. |

**Posiciones**

| Elemento | Escritorio | ≤1120 | ≤640 |
|----------|-----------|-------|------|
| `.ai-brief` | top 148 / left 24 | top 202 / left 16 | top 330, ancho completo |
| `.tech-badge` | top 104 / right 24; zona 2 top 252, zona 4 top 168 | top 96 / right 16 | plegado; zona 2 top 190, zona 4 abajo-izquierda 84 |
| `.product-preorder-note` | right 60 / bottom 160 | right 24 / bottom 148 (≤900) | top 240 / left 16, alineado a la izquierda |

**Gotchas (no volver a romperlos)**

1. **El estado inicial del badge depende del viewport, pero vive en el store, no en un efecto
   de montaje.** `TechBadge` se desmonta durante el tour y al volver se remontaría: un
   `useEffect` que lo plegara en móvil lo cerraría también después de que el usuario lo abriera.
2. **`.tech-badge` es z-45 y debe quedarse por debajo de paneles (65), pestañas (70/80) y ficha
   del tour (86).** Subirlo lo hace flotar sobre el contenido abierto.
3. **`.ai-brief` y `.product-preorder-note` llevan `pointer-events: none`.** El primero no debe
   robar clics al pipeline 3D; el segundo, la rueda de `ScrollControls`.
4. **La contribución se pinta desde `CONTRIBUTION_ZONE_INDICES`.** Si se añade una zona con
   sub-temas, hay que decidir explícitamente si entra en el array; `BuildingPanel` es el único
   panel de la sección 05 y mantiene su propio bloque.
5. **El magnetismo se escribe sólo en motion values (`x`/`y`).** No volver a asignar
   `style.transform` a mano: pisaría el `scale` de hover y el botón dejaría de crecer.
6. **En móvil el badge arranca plegado** para que el pipeline AI y la ficha del chat no queden
   enterrados bajo tres filas. Al desplegarlo puede solaparse con `.ai-brief`; es el compromiso
   aceptado para mantener el panel informativo en pantalla.
7. **La cámara no cambió en esta pasada.** Los vuelos normales siguen siendo tweens con
   `easeInOutCubic` dentro de `useFrame`; el modo guiado conserva `GUIDE_CAMERA_LERP = 0.05`.
   El requisito de "lerp 0.05–0.08" se cumple en el tour, que es donde la cámara persigue un
   objetivo móvil. Las secciones de `ScrollUI` usan springs (`stiffness` 120–150, `damping` 22–24).

**Cómo se comprobó** (Chrome, 1052×801 y un iframe real de 386×780): zona AI con el brief, la
leyenda, las stats y el chat sin solapes; contribución visible en el panel de Architecture y en
el edificio #389 del Digital Twin; badge abierto/plegado y persistente al cambiar de zona; en
móvil arranca plegado, el brief sigue legible sobre el chat, el badge de la ciudad queda sobre
el pill de cine sin tocarlo y el Configurator muestra la nota y el PRE-ORDER a ancho completo.
El botón magnético midió `translateX(21.52px) translateY(-5.2px)` al acercar el cursor a su
esquina, conservando el `scale` de hover. **0 errores de consola nuevos**; `npx tsc --noEmit` y
`npm run build` OK.

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

### Despliegue en Cloudflare (Workers Static Assets)

`wrangler.jsonc` declara `dist/` como assets estáticos y
`not_found_handling: "single-page-application"`. Es deliberado: sin ese archivo,
Wrangler intenta autoconfigurar el proyecto como framework Vite y **exige
Vite >= 6**; el proyecto usa Vite 5 y no necesita SSR ni Worker con código.
El build de Cloudflare debe ser `npm run build` y el deploy `npx wrangler deploy`.
Comprobar el config sin subir nada: `npx wrangler deploy --dry-run`.

