# ADR-0010 — Zona horaria y fechas: `America/Caracas` por nombre IANA, nunca por offset

**Estado:** Aceptada (2026-09-27) · **Contexto:** `arquitectura.md` §9, `modulos-y-hitos.md` (M1b/M2a),
`AGENTS.md` (Dinero y fechas), `modelo-datos.md` (asistencia, nómina)

## Contexto

Cuatro cosas del producto dependen de la hora, y cada una se rompe de forma distinta:

1. **Turnos que cruzan medianoche** (22:00–06:00, planta continua). Si el turno pertenece por horas
   al día de inicio, la asistencia no se descuadra.
2. **Cortes de quincena** (1–15 y 16–fin de mes) y cierre en dos pasos. Si el corte se calcula con
   instantes en UTC, el borde de medianoche asigna horas al día equivocado.
3. **Calendario de la Garantía de Prestaciones (Art. 142 LOTTT)**: días de descanso acumulados y
   depósitos trimestrales. Es aritmética de **días de calendario**, no de segundos.
4. **Auditoría**: quién hizo qué y cuándo. Aquí sí interesa el instante absoluto.

Venezuela tiene historia de cambios de zona: `America/Caracas` fue UTC−04:30 hasta el 2016-05-01 y
UTC−04:00 desde entonces, sin horario de verano. Un offset fijo escrito en el código queda
obsoleto el día que la zona cambie otra vez, y no lo avisaría nadie.

## Decisión

### 1. Una sola zona, por nombre IANA, y el offset nunca se escribe

El nombre de zona viaja explícito a todas las conversiones. **Prohibido** escribir `-04:00`, `+0:00`
o `new Date('2026-01-01')` en la lógica. Si la zona cambia, basta con actualizar la base de datos
de zonas del sistema y el código sigue siendo correcto.

`TZ` se fija a `America/Caracas` en el entorno y se valida al arrancar (zod, fail-fast: abortar si
`Intl.DateTimeFormat` no la reconoce), pero **la corrección no depende de `TZ`**: el proceso no
puede cambiar la zona a mitad de ejecución, y si pudiera, ninguna fórmula debe enterarse.

### 2. Fecha de calendario ≠ instante

| Dato | Tipo | Ejemplos |
|---|---|---|
| Instante (ocurrió en el tiempo) | `timestamptz` (Postgres) / `Date` | `created_at`, `login_at`, marcación de entrada y salida, `audit_log.ts` |
| Día local de calendario | `date` / `YYYY-MM-DD` | fecha de ingreso, fecha de pago, `shift_date` del turno, día del período |

Regla dura: **una fecha local nunca se guarda como `timestamptz` a medianoche.** Midnight-instant es
la causa clásica del "día anterior" en el borde; en nómina es un día de salario mal pagado.

### 3. El turno que cruza medianoche pertenece al día de inicio

`shift_date` es la fecha local de **inicio**. Las horas se calculan con instantes (duración real) y se
imputan al turno; nunca se reparte un turno en dos días por su mitad.

### 4. Días de calendario, no `/86400`

Para prestaciones, vacaciones y antigüedad se restan **fechas**, no instantes. Se usa la diferencia
de calendario en la zona, que es correcta por construcción aunque la zona cambie de offset.

### 5. Períodos de nómina en fechas locales

La quincena se define con fechas: días 1–15 y 16–fin de mes, en hora local de Caracas, sobre el
período calendario del año. La comparación "el pago es de este período" es una comparación de
`date`, no de `timestamptz`.

### 6. La UI muestra fecha local, las máquinas viajan en ISO

La interfaz muestra `dd/mm/aaaa` y la hora local. Entre el navegador y el servidor se usa ISO-8601
con offset, y los datos entre servicios y base de datos, UTC. La conversión ocurre **solo en los
bordes**: nunca se guarda un instante "ya en hora de Caracas" para facilitar una consulta.

### 7. Los tests fijan la zona y cubren los bordes

La configuración de Vitest fija `TZ=America/Caracas`, y hay tests dedicados a los casos que
importan: 23:59:59.999 y 00:00:00.000 del mismo día, cambio de día, 31 de diciembre, 29 de febrero
de año bisiesto, quincena que cruza cambio de día, turno 22:00–06:00 y turno que cruza medianoche en
un cambio de offset.

## Alternativas descartadas

- **Guardar todo en UTC y convertir al mostrar**: es la opción por defecto de la industria y aquí es
  incorrecta, porque el objeto de negocio de varios módulos es el día local, no el instante. Obliga a
  convertir al consultar y reintroduce el bug de medianoche.
- **Offset fijo `-04:00`**: rápido hoy, equivocado el día del próximo cambio de zona, y no lo
  detecta ningún tipo.
- **`Date` de JavaScript para todo**: `Date` no tiene zona; sus getters usan la zona del proceso. Es
  la causa más común de un día desplazado.
- **Fechas como texto `dd/mm/aaaa`**: imposible comparar, ordenar ni restar sin parsear en cada uso.

## Consecuencias

- **Prohibido en el código**: `getFullYear()`, `getMonth()`, `getDate()`, `getHours()`,
  `toLocaleDateString()` y `toISOString().slice(0, 10)`. Toda conversión lleva zona explícita. Un test
  guardián del propio paquete `domain` falla si aparece uno de ellos.
- La corrección no depende de la configuración del proceso: un contenedor mal configurado no cambia
  un cálculo de nómina.
- Cada máquina que reporte logs lleva su zona y el nombre `America/Caracas` cuando aplica.
- `pg` devuelve `timestamptz` en `Date`; el repositorio debe leerlos como instantes y nunca
 asumir la zona del servidor de base de datos.
