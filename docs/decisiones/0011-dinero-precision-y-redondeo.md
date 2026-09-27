# ADR-0011 — Dinero: sin float, string en el borde, un solo redondeo y en un solo punto

**Estado:** Aceptada (2026-09-27) · **Contexto:** `AGENTS.md` (Dinero y fechas), ADR-0009 (fórmulas),
`regionalizacion-venezuela.md` §2–§3, `modelo-datos.md` (nómina)

## Contexto

Nómina multiplica, divide, acumula interest over meses y redondea; y lo hace en **dos monedas**
(bolívares y dólares). Los errores de redondeo en este dominio no son feas: son pagar de menos a un
trabajador, y esa diferencia se acumula sobre nóminas enteras. Además hay tres cantidades distintas
que se parecen a dinero y no lo son: **tasas** (14,5 %, 15,6667 %), **cantidades** (7,5 horas) y
**montos** (1.234,56 Bs).

Y hay un borde técnico que la mayoría de proyectos de RRHH pasan por alto: PostgreSQL devuelve
`numeric` como texto, y `JSON.parse` de un número como `1234.56` ya llega con error de coma flotante
al servidor. El dinero que cruza HTTP en `number` está perdido antes de llegar al dominio.

## Decisión

### 1. Nunca `float`. El constructor de dinero rechaza `number`

En el dominio, el dinero se representa con `decimal.js` (`Decimal`): precisión arbitraria, JavaScript
puro, sin compilación nativa, y con modos de redondeo explícitos. El constructor de `Money` **acepta
solo `string`, `bigint` o `Decimal`; pasar un `number` de JavaScript lanza error**, porque en ese punto
el valor ya está manchado y es mejor que truene a que se propague el error. Un test guardián escanea el
código de `domain` y falla si aparece `parseFloat`, `parseInt`, `Number(` o `.toFixed(` en el camino
del dinero.

### 2. En el borde HTTP, el dinero viaja como texto

Los montos van y vienen como `string` (`"1234.56"`), nunca como `number` JSON. Es la forma que
mantiene la precisión en el viaje completo, y es la que el cliente recibe y envía sin haber pasado por
coma flotante. Las cantidades y tasas viajan igual, en texto.

### 3. Escala por tipo de dato, no una escala global

| Tipo | Postgres | Ejemplo |
|---|---|---|
| Monto | `numeric(20,2)` | salario, anticipo, saldo, interés acreditado |
| Tasa / porcentaje | `numeric(20,6)` | 14,5 → `14.5`; 15,666667 |
| Cantidad (horas, días, factores) | `numeric(20,6)` | 7,5 horas |

Una tasa se guarda **en la unidad en que se expresa** (`14.5`, no `0.145`, no `1450`). Convertir a
fracción es responsabilidad de la fórmula, no del almacenamiento, y es la operación que más se
revisa mal.

### 4. Un solo redondeo, en un solo punto, y con una regla nombrada

Existe **una** función de redondeo en el dominio, `roundHalfUp`, en modo *half away from zero*
(`0.005 → 0.01`, `−0.005 → −0.01`). Se aplica **al acreditar**, es decir, en el punto en que un monto
nace o se suma a un saldo; no "al final, cuando se imprime el recibo".

El modo *half away from zero* y no el redondeo bancario (*half to even*) porque es el que espera un
contador venezolano y el que hacen Excel y Postgres: un redondeo distinto al del contador genera
discutas de céntimos en cada quincena.

### 5. El saldo acumulado es el valor ya redondeado, y el cálculo sin redondear queda registrado

Los intereses de prestaciones y la antigüedad se acumulan sobre saldos **ya redondeados** a dos
decimales. Es la decisión auditable: el saldo que se muestra, el que se cobra y el que se depone son
el mismo número, y cualquier persona puede reproducirlo con una calculadora.

El valor sin redondear y cada paso del cálculo quedan en la traza de la fórmula (ADR-0009), de modo
que el redondeo es verificable aunque no forme parte del saldo. Redondear solo al final sería más
bonito y sería imposible de auditar.

### 6. Dualidad: cada monto lleva su moneda

ISO-4217 (`VES`, `USD`) en cada monto, y **prohibido** un campo `amount` sin moneda. Las tasas de
cambio no se hardcodean: cada una se registra con su fuente, fecha y método en `rate_tables`
(ADR-0009). Los conceptos salary en dólares son un **segundo conjunto de renglones**, no una
conversión implícita del total: lahdr.total no se recalcula en cada visualización.

### 7. El signo es explícito

`Adjustment.kind` determina el signo (devengado, pagado, retenido, reembolsado). No se depende de que
"un negativo significa descontar", y el cero es un `0` con moneda, no un `null` ni un `""`.

### 8. El formato es de presentación, y lo decide `Intl`

Para mostrar se usa `Intl.NumberFormat('es-VE', { style: 'currency', currency })`; el símbolo lo
pone `Intl`, no una constante en el código. `toFixed()` no se usa para formatear, porque ignora la
coma decimal.

## Alternativas descartadas

- **Enteros de céntimos**: exacto y rápido, pero incompatible con tasas de seis decimales y con la
  dualidad, y obliga a redondear cada multiplicación.
- **`number` de JavaScript**: error acumulado; `0.1 + 0.2 !== 0.3` en un cálculo de nómina es
  inaceptable.
- **Una librería de moneda de moneda única** (`dinero.js` y similares): el modelo es elegante para
  importes de una moneda con divisores fijos; aquí hay dos monedas, tasas y cantidades, y la
  biblioteca estorba más de lo que ayuda.
- **Redondeo bancario (*half to even*)**: matemáticamente más elegante, pero contradice la
  práctica contable local.
- **Redondear al final del recibo**: los renglones no cuadran con las tablas y el resultado depende
  del orden de las operaciones.

## Consecuencias

- `Money` es un value object **inmutable**, con moneda obligatoria: sumar dos monedas distintas lanza
  error en desarrollo.
- El API de dinero es un contrato: la UI formatea con `Intl` y no puede inventar el redondeo.
- `decimal.js` es la única dependencia aritmética del dominio. No contradice ADR-0004: esa decisión es
  sobre **servicios** externos (no Redis), no sobre paquetes.
- La cobertura de `packages/domain` es ≥95% e incluye una tabla de redondeo explícita con casos de
  borde y empates.
- El mismo texto de la decisión se refleja en `AGENTS.md` ("Dinero y fechas") para que las reglas
  ejecutables y el ADR no se separen.
