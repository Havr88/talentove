# Contribuir a TalentoVe

Gracias por tu interés. TalentoVe es una plataforma de RRHH **auto-alojada** para Venezuela,
licenciada AGPL-3.0-only.

## Reglas del repositorio

1. **Lee [`AGENTS.md`](AGENTS.md)** — es la convención de código para humanos y asistentes de IA
   (español en UI/docs, identificadores en inglés, envelope JSON, repos, zod en bordes, TDD).
2. **Nada de datos personales reales** en código, fixtures, issues, capturas o PRs:
   fixtures sintéticos siempre. Las capturas de sistemas reales se redactan antes de subirlas.
3. **Toda fórmula de nómina/LOTTT/parafiscales** vive en `packages/domain` como función pura
   con parámetros inyectados y tests (`AGENTS.md` — regla de dominio). Tasas y topes **jamás**
   hardcodeados.
4. **Dinero:** `numeric` en BD, nunca float (`docs/modelo-datos.md` §Convenciones).

## Flujo de trabajo

```
main (protegida) ← PR ← rama feat/fix
```

- Ramas: `feat/<modulo>-<detalle>`, `fix/<modulo>-<detalle>`.
- Commits: `<type>: <descripcion>` — `feat`, `fix`, `refactor`, `docs`, `test`, `chore`,
  `perf`, `ci`.
- El CI debe estar en verde: **typecheck + 296 tests** (domain 239 + server 57).
- Requiere revisión de al menos un mantenedor. Cambios que toquen seguridad o fórmulas de
  nómina requieren además revisión del checklist de `docs/seguridad.md`.

## Desarrollo local

```bash
pnpm install
pnpm -r typecheck     # 0 errores
pnpm -r test          # 296 tests
cd apps/server && npx -y tsx src/demo.ts   # servidor demo (memoria) en :3000
```

PostgreSQL es la única dependencia de producción (ADR-0004); para probar el demo basta el
modo memoria anterior.

## Antes de abrir el PR

- [ ] Tests nuevos para la funcionalidad (TDD: RED → GREEN → REFACTOR).
- [ ] `pnpm -r typecheck` y `pnpm -r test` en verde.
- [ ] Sin secretos ni datos personales en el diff (`.gitignore` ya cubre `.env`, `uploads/`,
      dumps e importaciones).
- [ ] Si toca fórmulas legales: fuente (Gaceta/resolución) citada en el PR y en `rate_tables`.
- [ ] Si cambia el modelo de datos: actualizar `docs/modelo-datos.md` en el mismo PR.
