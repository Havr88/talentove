# ADR-0012 — Identificadores de personas: canónico como texto, catálogo versionado, nunca adivinar el dígito verificador

**Estado:** Aceptada (2026-09-27) · **Contexto:** `regionalizacion-venezuela.md` §9,
`modelo-datos.md` (empleados), `data/ve/`

## Contexto

En Venezuela el identificador de una persona es un solo número con un prefijo que dice qué es: `V`
para persona natural (cédula), `J`, `G` o `E` para persona jurídica (RIF). El sistema tiene que
guardarlo, buscarlo, importarlo en lote, mostrarlo, y usarlo para retenciones.

El problema conocido desde la revisión fundacional: **nadie ha verificado todavía contra la fuente
oficial los prefijos, las longitudes ni el algoritmo del dígito verificador.** La búsqueda web
falló (`StatusCode: non 2xx status code (403 POST https://mcp.exa.ai/mcp)`), así que lo que hay es
una hipótesis de trabajo con evidencia parcial: 25 RIF del registro interbancario público
(`data/ve/bancos.json`) confirman que `J` y `G` llevan 9 dígitos.

## Decisión

### 1. Un solo campo canónico, en texto, normalizado

`native_id` es `text` y guarda **prefijo + dígitos, sin separadores, con el prefijo en mayúsculas**:
`V12345678`, `J000029709`. El dígito verificador, si viene informado, va en `native_id_dv`, aparte.

Texto canónico y no columnas separadas (`prefijo`, `numero`) porque casi toda consulta necesita las dos
juntas, y dividirlas multiplica los casos nulos y las comparaciones mal hechas. **La cédula del
trabajador es su identidad de negocio, no su clave primaria.**

### 2. La clave primaria es `uuid v7`, y por qué

El identificador técnico es un UUID v7 generado en la aplicación, y `native_id` es un atributo
único no nulo. Esto no es purismo: la cédula no puede ser clave primaria porque

- **el formato va a cambiar** cuando se verifique la tabla oficial (y hay datos ya cargados);
- importar 2.000 empleados en lote genera colisión de claves si la PK es un autoincremento y la
  importación falla a mitad de camino;
- un correlativo secuencial filtra el tamaño de la plantilla y obliga a coordinar secuencias en
  una instalación por empresa.

El v7 (no v4) porque es **ordenable por tiempo**: los índices de PostgreSQL no se llenan de
aleatorios y `ORDER BY created_at` usa el índice.

### 3. La validación es un catálogo versionado, no una regex

Longitudes y prefijos se validan contra `data/ve/identificadores.json`, versionado con el repo, que
lleva `fuente`, `fecha_consulta`, `verificacion` y `confianza` por prefijo. El código **no** lleva
`/^[VJE]\d{6,9}$/` suelto: cuando la tabla oficial se verifique, se actualiza el dataset y la
validación cambia sin tocar código.

### 4. El dígito verificador no se calcula todavía

Mientras el algoritmo no esté verificado, la aplicación valida **prefijo, longitud y formato**, y
**no** el dígito verificador. La razón es cuál de los dos errores es peor: rechazar una cédula
válida impide a una persona trabajar y es un soporte imposible de argumentar; aceptar una cédula con
el dígito mal es un dato sucio que una revisión posterior detecta. Cuando haya tabla oficial, se
implementa el cálculo **como una regla más del catálogo**, con su versión, no como una constante en
el validador.

### 5. La API expone el nivel de confianza de la validación

La respuesta de validación incluye `verificado: false` mientras el catálogo no esté verificado, para
que la interfaz pueda avisar ("formato no verificado, pendiente de confirmación oficial") en vez de
presentar como válido algo que no lo está. Es preferible que el usuario vea la duda.

### 6. Normalización en el borde, una sola vez

Quitar guiones, puntos y espacios, y pasar el prefijo a mayúsculas, **al entrar** (formularios,
importaciones, API). En la base de datos siempre está normalizado, y la búsqueda se hace siempre
contra la forma canónica: buscar "V-12.345.678" tiene que encontrar "V12345678". Se indexa la
columna normalizada, no el texto crudo que escribió el usuario.

### 7. Unicidad por instalación

`native_id` es único dentro de una instalación. Es también el RIF de la empresa, que se valida con
el mismo catálogo y vive en la configuración de la instalación, no en la lista de empleados. La
uniqueness es insensible a mayúsculas porque la forma canónica ya lo es.

## Alternativas descartadas

- **Regex hardcodeada en el código**: se rompe el día que se verifique la tabla, y alguien la
  actualizará sin fuente.
- **Validar solo longitud**: acepta cualquier basura con la forma correcta, incluidos RIF de otra
  persona jurídica.
- **Cédula como clave primaria**: ata el esquema a un formato no verificado y complica importaciones
  y colisiones.
- **UUID v4 como PK**: funciona, pero ensucia los índices y pierde el orden temporal, que en listados
  de plantilla y en paginación se nota.
- **Nombres y apellidos como identidad**: no es un identificador, y en Venezuela los homónimos son
  la regla, no la excepción.

## Consecuencias

- `packages/domain` expone `normalizeNativeId` y `validateNativeId` como funciones puras, con el
  catálogo inyectado (nunca leído del sistema de archivos dentro de la función).
- El catálogo tiene un test de contrato: todos los RIF de `bancos.json` tienen que validar contra él.
  Eso convierte la evidencia parcial en una regresión vigilada.
- Las importaciones masivas de M3 tienen que normalizar antes de insertar, y el fallo de una fila no
  puede abortar el lote entero.
- Cerrar la verificación oficial cambia el dataset y, si se implementa el dígito verificador, un ADR
  nuevo; esta decisión no se reescribe.
