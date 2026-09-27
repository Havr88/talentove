# Análisis del portal Patria — sistema de diseño de referencia

> Estado: **v0.3** (2026-09-27). Páginas analizadas hasta ahora: Inicio/Noticias, Perfil/Verificación, Directorio/Familia, Directorio/Instituciones, Monedero/Consolidado, Monedero/Estadísticas. Fuente: código fuente del portal autenticado (`https://persona.patria.org.ve/`) aportado por el sponsor.

> ⚠️ **Privacidad:** las capturas de código contienen datos personales reales (cédulas, nombres, parentescos). Redactar antes de compartir nuevas capturas y **nunca** incluir estos datos en el repo, fixtures ni documentación.

## 1. Por qué Patria como referencia

- El sponsor basa el producto en la UX de Patria: familiaridad inmediata para millones de venezolanos → curva de aprendizaje casi nula del portal del trabajador.
- El stack frontend de Patria es exactamente la lista tecnológica original del proyecto (Materialize, jQuery, DataTables…), validando la elección técnica.
- Estrategia: **copiar patrones e interacciones, modernizar la implementación** (HTMX en lugar de jQuery-fragments hechos a mano, Lit para widgets, Materialize 1.x en lugar de 0.97, accesibilidad real).

## 2. Stack detectado en Patria

Todo vendido (self-hosted, sin CDN):

| Componente | Versión/variante | Notas |
|---|---|---|
| Materialize CSS | build propia `dist-patria` (era 0.97, API `data-activates`) | Nosotros: Materialize 1.x + CSS variables para theming |
| jQuery + DataTables | + skin `materialize-datatables` | Defaults globales en español (ver §4.3) |
| jquery.mask / jquery.maskMoney | — | Máscaras de cédula, teléfono, montos |
| jquery-paged-scroll | — | Scroll infinito vía fragmentos HTML → lo reemplaza HTMX |
| Iconografía | Material Icons + fuente propia `ico-*` | Nosotros: Material Symbols + set propio del tenant |
| PWA | manifest + iconos + theme-color + app en Google Play | Portal instalable en el teléfono |
| Sesión | JS propio: aviso 8 min, logout 10 min, heartbeat `/core/reload` | Copiar (configurable) |

## 3. Shell común (el "chrome" de todas las páginas)

Estructura de página que replicaremos como layout base:

```
┌ navbar fija: [hamburguesa móvil] [menú superior] [camp. notificaciones] [dropdown usuario: cédula] ┐
│ menú superior (escritorio): módulos principales activos                                              │
├──────────────┬───────────────────────────────────────────────────┬─────────────────────────────────┤
│ menú lateral │  <article> contenido: card-panels                 │ rail derecho (opcional):        │
│ (acordeón,   │    .card-title (h5 + acciones)                    │  - tarjetas de notificación     │
│  por módulo, │    filas/tables/forms                             │    (naranja=acción, verde=info) │
│  activo      │                                                   │  - banners/avisos (slots)       │
│  resaltado)  │                                                   │  - encuestas rápidas            │
├──────────────┴───────────────────────────────────────────────────┴─────────────────────────────────┤
│ pie centrado: identidad de la entidad + año  (→ zona de marca blanca)                               │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
móvil: side-nav desplegable con el mismo menú (en nuestro caso: un solo fuente de menú, dos render)
```

Detalles del shell a conservar:

1. **Identidad por cédula en el dropdown de usuario** (sin nombre visible): decisión de privacidad elegante. En RRHH: `V-12345678` + menú "Cambiar contraseña / Salir".
2. **Modales de confirmación genéricos** (3 en cada página: delete, delete-second, checkbox) accionados por atributos `data-toggle="modal-delete"`, `data-message`, `data-message-second`, `data-href`. Nosotros: un solo componente de confirmación HTMX (1 o 2 pasos) con POST + CSRF.
3. **CSS por página** (`/theme/css/<módulo>/<página>.css`) sobre `main.css` + `fonts.css` compartidos. Assets con fingerprint `?v=hash` (lo hará el build).
4. **Toasts y bottom-sheets propios** (`custom-toast.js`, `modal-bottom-sheet.js`): feedback flotante y acciones en hoja inferior en móvil.
5. **Estado activo** resaltado en ambos menús (superior y lateral).

## 4. Mecanismos a adoptar (inventario)

### 4.1 Gestión de sesión inactiva
Modal de aviso a los 8 minutos ("No se ha detectado actividad… se cerrará en 2 minutos"), logout automático a los 10, heartbeat al reanudar. En RRHH (datos sensibles): configurable por instalación (default 8/10), y el heartbeat invalida también del lado del servidor.

### 4.2 Confirmación destructiva en dos pasos
Patrón de Familia: primer mensaje ("¿Borrar este familiar?") + segundo ("Será eliminado de tu núcleo familiar. ¿Seguro?"). Adoptar como componente reutilizable para: eliminar documentos, cerrar nómina, anular recibos, desactivar empleados.

### 4.3 DataTables con defaults globales en español
Config de Patria (replicar en un wrapper propio):
```js
// defaults globales: español, spinner Materialize como processing,
// sortCellsTop, sin paginación por defecto (tablas server-rendered)
dom: '<"top">t<"bottom"ilrp<"clear">>', sortCellsTop: true, sort: false, info: false, paging: false
```
Y para tablas grandes (nómina, estadísticas), el patrón server-side de Patria (`Monedero/Estadísticas`):
```js
processing: true, responsive: true, serverSide: true, searching: false,
pageLength: 10, paging: true, paginationType: "simple", deferLoading: N,
ajax: { url: '/…/datos', type: 'POST' },
drawCallback: ocultar paginación cuando pages <= 1
```
Columnas responsivas por prioridad: `data-priority` en los `<th>` + clases `hide-on-small-only` (patrón de Familia).

### 4.4 Máscaras de entrada
`jquery.mask`: cédula `V-XXXXXXXX` / `E-XXXXXXXX`, teléfonos `0412-1234567`, RIF `J-XXXXXXXX-X`. `jquery.maskMoney`: montos Bs/USD con coma decimal y punto de miles (`Bs 155.000,00`). preferible: re-empaquetar como inputs Lit reutilizables.

### 4.5 Resumen multi-moneda (patrón "Consolidado" del Monedero)
Tabla de filas: [icono cuadrado de color] [nombre del concepto] [saldo alineado a la derecha, clase `negative` en rojo] [chevron → detalle/movimientos]. **Adaptación RRHH:** una fila por concepto/moneda — salario base Bs, saldo de vacaciones (días), prestaciones Bs (+equiv. USD), anticipos (negativo). El chevron lleva al detalle con movimientos.

### 4.6 Scroll infinito por fragmentos (Noticias)
`/noticias/page?page=1&limit=5` devuelve fragmentos HTML; el cliente los agrega. Modernización directa con HTMX: `hx-get` + `hx-trigger="revealed"` en el centinela final. Uso: novedades/comunicados del panel del trabajador.

### 4.7 Rail de notificaciones y encuestas
Tarjetas codificadas por color con título, texto y botones de acción directa (ej.: "Teléfono certificado → Certificar"; "¿Recibiste la caja CLAP de agosto? → Sí / No"). En RRHH: pendientes del trabajador ("Sube tu cédula", "Firma tu contrato", "Confirma tus datos bancarios") y encuestas internas de RRHH en un clic (POST, no GET).

### 4.8 Banner de comunicación con redirector
Banners del rail con enlace externo pasando por `enlace.patria.org.ve/?url=...`. En RRHH: slots de avisos internos configurables (marca blanca); redirector opcional para links externos.

### 4.9 Anticipos con límite paramétrico (Monedero/Estadísticas)
Tarjeta "Adelanto de Fondos": "El máximo adelanto será igual al 30% del beneficio promedio recibido en los últimos tres meses. Fondos en adelanto: Bs 45.780,00" (saldo negativo). **Adaptación RRHH (M2a):** módulo de anticipos de salario con límite configurable (ej. % del promedio de nómina de los últimos N meses), saldo negativo visible en el consolidado.

### 4.10 Incorporación por token (Directorio/Instituciones)
Dropdown "Agregar" con dos vías: **"Agregar por Hash"** (enlace/código opaco que la otra parte usa para cargarse a sí misma) y **"Agregar por Identificación"** (búsqueda directa). **Adaptación RRHH (M1a):** RRHH genera un token de incorporación; el candidato/nuevo empleado abre el enlace y llena su propio expediente sin que nadie vea ni escriba su cédula; la vía "por identificación" queda para el admin.

### 4.11 Tablas de workflow con estados (Familia)
Patria maneja `pending_table`, `waiting_table`, `rejected_table` además de la tabla activa. Adoptar: solicitudes de vacaciones/permisos y documentos en revisión con las mismas 3-4 vistas por estado.

### 4.12 Checklist de protección / completitud (Perfil/Verificación)
Card "Protegido": lista de capacidades desbloqueadas + checklist ("Teléfono móvil registrado como principal" con ícono de check). **Adaptación RRHH:** "Tu expediente está 80% completo" + capacidades que se desbloquean (no puedes solicitar vacaciones sin contrato firmado y cuenta bancaria registrada).

### 4.13 PWA instalable
manifest + set completo de iconos + theme-color: el portal se instala como app en el teléfono del trabajador. Generar iconos del tenant desde el logo (marca blanca).

### 4.14 Estados vacíos y filas activas
Tablas vacías con texto explícito ("Ningún dato disponible en esta tabla") y filas resaltadas (`row_table_eq_active`). Pequeño, pero define la percepción de calidad.

## 5. Matriz módulo Patria → módulo RRHH

| Patria | Módulo RRHH | Hito |

> Los hitos siguen la separación M1a (expediente y estructura organizacional) /
> M1b (portal y motor de solicitudes) acordada en `modulos-y-hitos.md`.
|---|---|---|
| Inicio/Noticias (scroll infinito) | Panel del trabajador: comunicados y novedades de RRHH | M1b |
| Perfil → Verificación ("Protegido") | Completitud del expediente + capacidades desbloqueadas | M1a |
| Perfil (personal, teléfonos, correos, laboral) | Expediente del trabajador por secciones | M1a |
| Directorio → Familia | Cargas familiares y beneficiarios (CRUD + estados) | M1a |
| Directorio → Instituciones (por hash/identificación) | Incorporación self-service por token | M1a |
| Encuestas (Sí/No en un clic) | Encuestas internas de RRHH | M3 |
| Monedero → Consolidado multi-moneda | Resumen de beneficios (vacaciones, prestaciones Bs/USD) | M2a |
| Monedero → Estadísticas (tabla mensual) | Histórico de nómina/bonos mensual | M2a |
| Monedero → Adelanto de Fondos | Anticipos con límite paramétrico | M2a |
| Protección Social → Logros/Premios | Reconocimientos internos con PDF de membrete | M4 |
| Carnet de la Patria / veQR | Carnet digital del trabajador con QR (marcación) | M1a/M3 |
| Grupos y Programas | Comités y afiliaciones (comité SST LOPCYMAT, sindicato) | M3 |
| Bloqueos y Denuncias | Canal ético de denuncias | M4 |
| Seguridad → Últimos accesos | Historial de accesos del empleado | M1b |
| Banners del rail | Comunicación interna con slots marca blanca | M1b |
| Redes (perfil social) | — | No aplica |

## 6. Qué NO copiar (y modernización)

1. **Materialize 0.97** (API `data-activates`, sideNav): usar Materialize 1.x manteniendo el look clásico.
2. **Cambios de estado por GET** (encuesta CLAP responde con enlaces GET, sin CSRF): todo cambio de estado será POST con token CSRF; HTMX lo hace natural.
3. **`<script>` inline por página**: módulos ES por página, empaquetados con fingerprint.
4. **jQuery-fragments hechos a mano** (`appendNews`, `$.get` + append): HTMX 2 hace lo mismo declarativo y sin JS propio.
5. **Accesibilidad débil** (íconos sin `aria-label`, mayúsculas escritas en el texto, contraste dudoso): aplicar WCAG AA y las Web Interface Guidelines.
6. **Toda la página se re-renderiza** (URL completa por navegación): mantener eso (SSR clásico) pero con fragments HTMX para las partes interactivas.

## 7. Páginas pendientes de analizar (solicitud al sponsor)

- `/perfil/laboral/` — cómo estructuran la información laboral (especificación de facto del modelo de datos)
- `/perfil/carnet/` — carnet digital (base del carnet del trabajador)
- `/encuestas/` — encuestas completas
- `/perfil/seguridad/` — últimos accesos
- `/perfil/configuracion/` y `/perfil/configuracion/acceso/cambiar` — cambio de contraseña
- Página de login (si puede capturarse) — flujo de entrada
