# ADR-0005 — Licencia: PENDIENTE (propuesta AGPL-3)

**Estado:** ⏳ Abierta — decidir **antes de publicar** el repo en GitHub (2026-09-26)

## Contexto

Distribución vía GitHub con instalación por empresa. El sponsor aún no decide licencia. Consistente con su otro proyecto (AGPL-3).

## Opciones

| Licencia | A favor | En contra |
|---|---|---|
| **AGPL-3** (propuesta) | Cualquier fork ofrecido como servicio debe liberar su código: protege el proyecto de clones SaaS cerrados; coherente con el resto del trabajo del sponsor | Algunas empresas evitan AGPL por política interna |
| MIT / Apache-2.0 | Adopción máxima; sin fricción corporativa | Permite forks cerrados y SaaS propietarios sobre el código |

## Decisión provisional

Mientras se decide: el repo no se publica y `package.json` declara `SEE-LICENSE-IN-DOCS`. Se recomienda AGPL-3 si el modelo de negocio es servicio/implantación; MIT/Apache si el objetivo es adopción masiva y monetizar por soporte premium.

## Consecuencias

- Ningún commit se publica a GitHub hasta cerrar esta decisión.
- El texto de la licencia elegida se añade como `LICENSE` en la raíz.
