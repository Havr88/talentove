# Registro de decisiones (ADRs)

Decisiones de arquitectura de TalentoVe. Cada ADR es inmutable una vez aceptada: un cambio de
decisión se registra **añadiendo un ADR nuevo** que sustituya al anterior, nunca reescribiendo
el viejo (el histórico es lo que permite entender por qué el código es como es).

Convención: estado `Aceptada`, `Abierta` (⏳) o `Sustituida por ADR-XXXX`.

| ADR | Título | Estado | Cierra |
|---|---|---|---|
| [0001](0001-stack-nucleo.md) | Stack del núcleo: Node/TypeScript + Express + HTMX + Lit + Materialize | Aceptada | — |
| [0002](0002-entrega-selfhosted.md) | Modelo de entrega: instalación independiente por empresa (self-hosted) | Aceptada | — |
| [0003](0003-ui-referencia-patria.md) | UI de referencia: patrones del portal Patria, implementación modernizada | Aceptada | — |
| [0004](0004-postgres-unica-dependencia.md) | PostgreSQL como única dependencia: colas con pg-boss, sin Redis | Aceptada | — |
| [0005](0005-licencia.md) | Licencia del proyecto: **AGPL-3.0-only** (análisis de 6 opciones) | ✅ Aceptada | — |
| [0006](0006-sin-cms-externo.md) | Sin CMS externo: contenido propio + Publii opcional | Aceptada | — |
| [0007](0007-sesiones-rbac.md) | Sesiones en PostgreSQL, RBAC por permisos y segundo factor de identidad | Aceptada | Decisión abierta #3 |
| [0008](0008-storage-driver.md) | Almacenamiento de documentos: driver con clave opaca, disco local por defecto | Aceptada | Decisión abierta #4 |
| [0009](0009-formulas-nomina.md) | Contrato de fórmulas de nómina: `formula_key` + `params`, nunca código en la BD | Aceptada | Decisión abierta #1 |

## Abiertas

Ninguna decisión de arquitectura pendiente. La verificación de los valores legales (Gaceta
Oficial, SENIAT) y la del RIF son tareas de investigación con checklist propio en
`regionalizacion-venezuela.md` §9, no ADRs.

## Nota sobre la licencia

**AGPL-3.0-only** (ADR-0005). Consecuencia práctica para quien contribuye: re-implementar los
diseños de los activos AGPL del entorno local en vez de copiar su código. Los datos y datasets
públicos no están afectados.

## Orden de lectura recomendado

Para entrar al proyecto: `plan-general.md` → este índice → `arquitectura.md` →
`modelo-datos.md` → `regionalizacion-venezuela.md` → `modulos-y-hitos.md`.
