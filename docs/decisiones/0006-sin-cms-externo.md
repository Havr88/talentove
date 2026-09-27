# ADR-0006 — Sin CMS externo: contenido propio + Publii opcional

**Estado:** Aceptada (2026-09-26)

## Contexto

La lista original del sponsor incluía CMS (Magnolia, Pulse CMS, Publii, Zenario). El producto necesita contenido: comunicados internos, vacantes públicas, páginas institucionales.

## Decisión

- El contenido **interno** (comunicados, encuestas, banners, notificaciones) vive en módulos propios (`announcements`, `banners`, `surveys`) con el mismo shell y permisos — no en un CMS externo.
- El contenido **público** (micrositio de carreras, página institucional) es opcional en M4: módulo propio ligero **o** Publii (generador estático con escritorio, sin servidor PHP) si el cliente quiere editor visual. Magnolia/Pulse/Zenario quedan descartados (Java/PHP externos que rompen el monolito TS y la marca blanca).

## Consecuencias

- (+) Un solo sistema de permisos, theming y despliegue.
- (−) El editor de contenido propio será simple (rich text básico) — suficiente para comunicados y vacantes; los casos de "sitio web completo" se resuelven con Publii u otra herramienta aparte.
