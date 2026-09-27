# ADR-0003 — UI de referencia: patrones del portal Patria, implementación modernizada

**Estado:** Aceptada (2026-09-26, decisión del sponsor)

## Contexto

El sponsor eligió basar la UX en `persona.patria.org.ve` y aportó el código fuente de páginas autenticadas. Análisis completo: `analisis-patria.md`.

## Decisión

1. El **shell** (navbar + acordeón lateral + rail de notificaciones/banners + card-panels + footer + PWA) replica el patrón Patria con la estructura del §3 de `analisis-patria.md`.
2. Los **mecanismos** del inventario §4 (sesión inactiva, confirmación 2 pasos, DataTables español/server-side, máscaras, resumen multi-moneda, scroll infinito, tokens de incorporación, checklist de completitud, anticipos) se adoptan como parte del sistema de diseño del proyecto.
3. La **implementación** es modernizada: HTMX 2 en lugar de jQuery-fragments manuales, Materialize 1.x en lugar de 0.97, módulos ES, accesibilidad WCAG AA, cambios de estado por POST+CSRF (nunca GET).

## Consecuencias

- Argumento de producto fuerte: cero curva de aprendizaje para usuarios que ya usan Patria.
- El análisis de Patria es documento vivo: cada nueva página que aporte el sponsor se integra a `analisis-patria.md` antes de diseñar las vistas del módulo correspondiente.
- No copiar código de Patria (solo patrones); verificaremos que nada del HTML/CSS/JS propio derive de su código.
