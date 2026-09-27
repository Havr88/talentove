# ADR-0009 — Contrato de fórmulas de nómina: `formula_key` + `params`, nunca código en la BD

**Estado:** Aceptada (2026-09-27) — cierra la decisión abierta #1 de `modulos-y-hitos.md` · **Contexto:** `AGENTS.md` (regla de dominio), `modelo-datos.md` (nómina), `regionalizacion-venezuela.md` §2–§3

## Contexto

`payroll_concepts` es un catálogo configurable por instalación: el admin define conceptos de
nómina (asignaciones y deducciones) sin tocar código. La pregunta es **cómo se referencia el
cálculo de un concepto**, y es la decisión de diseño más costosa de revertir del módulo de
nómina, porque las corridas ya calculadas quedan atadas a la fórmula con que se produjeron.

El riesgo concreto: la solución "cómoda" —guardar una expresión en la base y evaluarla— convierte
la base de datos en un intérprete de código. Un `superadmin` de una instalación (o un
`admin_rrhh` con acceso a la UI de conceptos) podría ejecutar código arbitrario con los
permisos del proceso, y borrar datos de nómina. Es a la vez un agujero de seguridad y un
problema de trazabilidad: no se podría saber con qué fórmula se calculó un pago.

Restricciones ya decididas: la lógica de negocio no escribe SQL; toda fórmula legal vive en
`packages/domain` como **función pura con parámetros inyectados**; y el resultado de un cálculo
debe poder reproducirse y auditarse.

## Decisión

### 1. Un concepto referencia una fórmula por clave, no por expresión

`payroll_concepts` añade:

| Columna | Contenido |
|---|---|
| `formula_key` | Identificador estable y **cerrado en el código** (p. ej. `lottt.vacaciones`, `ivss.sso_trabajador`, `fixed.amount`) |
| `params` | `jsonb` con los parámetros del concepto, **validado con zod** |
| `params_version` | Versión del esquema de `params`, para migrar conceptos existentes |
| `formula_version` | Versión de la fórmula, **resuelta en la ejecución** (ver punto 4) |

El mapeo `formula_key` → función de `packages/domain` es un **registro en código** (`Record<
FormulaKey, Formula>`), exhaustivo y verificado por el compilador. Un `formula_key`
desconocido es un **error duro** al guardar el concepto y también al calcular; nunca un
resultado silencioso en cero.

### 2. La BD no puede inyectar código

Queda **excluido por decisión**: expresiones SQL, `eval`/interpretación de JavaScript,
funciones almacenadas de PostgreSQL, plantillas evaluables y `plpgsql` generado. La base
guarda datos; el algoritmo vive en `packages/domain` y se prueba con Vitest.

La forma más limpia de que la restricción sea física, no una convención: en las migraciones,
`REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC` para las funciones de negocio que se creen, y
ninguna función plpgsql que reciba fórmulas como texto.

### 3. Forma de una fórmula

```ts
type Formula = (input: FormulaInput, params: unknown, rules: RuleSet) => FormulaResult

interface FormulaResult {
  amount: Money                  // string/BigInt, nunca float (AGENTS.md)
  breakdown: Array<{ code: string; label: string; amount: Money }>
  appliedRuleIds: string[]       // reglas de rate_tables/rule_sets que intervienen
}
```

El `breakdown` es lo que permite que el recibo y el archivo de cotización **expliquen** el
número, en vez de mostrar un total sin trazabilidad. `appliedRuleIds` deja constancia de qué
valores vigentes se usaron.

### 4. Versionado y reproducibilidad

- `payroll_items` graba, por renglón, la **`formula_key` + `formula_version` + copia de los
  `params` + `appliedRuleIds` + `fx_rate`** efectivamente usados.
- Una corrida **cerrada no se recalcula jamás**: las correcciones son corridas nuevas que
  referencian a la anterior (coherente con `seguridad.md` §5 y el `soft-delete` de nómina).
- Así, un recibo de hace dos años es reproducible con el mismo código y los mismos parámetros
  registrados, aunque la tabla de tasas o la fórmula hayan cambiado.

### 5. Los parámetros se validan dos veces

`params` se valida con zod (a) al **guardar el concepto**, para que un error se detecte al
configurar y no al pagar, y (b) al **calcular**, porque un concepto creado con una versión
anterior de `params` puede no validar contra el esquema actual. En el segundo caso el cálculo
se detiene con error explícito, nunca con un valor por defecto.

### 6. Los valores legales siguen entrando por parámetro

Ninguna fórmula contiene tasas, topes ni múltiplos. Todo llega en `rules` (desde
`rate_tables`/`rule_sets`, con vigencia y fuente) o en los datos del empleado. Ejemplo
estructural, **no valores** (los valores están en `regionalizacion-venezuela.md` §2 y deben
verificarse en Gaceta Oficial):

| `formula_key` | Qué recibe de `params` | Qué recibe de `rules` |
|---|---|---|
| `lottt.vacaciones` | días-base,-years, tope de días | — |
| `lottt.prestaciones_garantia` | base de cálculo, periodicidad | días equivalentes, periodicidad de depósito |
| `ivss.sso_trabajador` | base imponible | tasa, tope de la base |
| `inces.nomina` | base imponible | tasa por sector |
| `fixed.amount` | monto, moneda | — |

### 7. Fórmulas de M2 (catálogo inicial)

`fixed.amount` · `fixed.percentage` · `lottt.vacaciones` · `lottt.bono_vacacional` ·
`lottt.utilidades` · `lottt.prestaciones_garantia` · `lottt.prestaciones_complemento` ·
`lottt.prestaciones_intereses` · `lottt.recargo_hora_extra` (diurna/nocturna/feriado/descanso) ·
`ivss.sso_trabajador` · `ivss.sso_patrono` · `ivss.rpe_trabajador` · `ivss.rpe_patrono` ·
`faov.banavih_trabajador` · `faov.banavih_patrono` · `inces.nomina` · `inces.utilidades` ·
`publico.npc_patrono` · `liquidation.total` (agregador de la liquidación de beneficios).

Cada una es una **función pura** en `packages/domain` con cobertura ≥95% (`AGENTS.md`).

## Alternativas descartadas

- **Expresión en la BD (SQL o JS):** implicaría código ejecutable desde una tabla; superficie de
  inyección de código y resultados no reproducibles. Descartado.
- **Una función de Python por concepto:** segundo lenguaje en el monolito, contradice ADR-0001
  y el requisito de instalación ligera.
- **Hardcodear las fórmulas sin catálogo:** el admin no podría crear el concepto
  "bono de noche" que le exige su convenio, que es justamente el caso que hace valuable el
  catálogo.

## Consecuencias

- (+) Un concepto mal configurado falla al guardarlo, no al pagar.
- (+) Cada renglón de nómina explica cómo se obtuvo y con qué versión.
- (+) Los cambios de fórmula no obligan a migrar nóminas históricas.
- (−) Añadir una fórmula nueva es un cambio de código (con test), no una operación de
  configuración. Es el precio consciente de no ejecutar código desde la base.
- (−) `params` con versión obliga a un camino de migración al evolucionar un esquema.
