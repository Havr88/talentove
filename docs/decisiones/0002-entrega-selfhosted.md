# ADR-0002 — Modelo de entrega: instalación independiente por empresa (self-hosted)

**Estado:** Aceptada (2026-09-26, decisión del sponsor)

## Contexto

El sponsor definió: cada empresa interesada descarga el proyecto de GitHub e instala la suya "según sus necesidades". No hay SaaS multi-tenant.

## Decisión

- Una instalación = una empresa. Sin multi-tenancy, sin RLS por tenant, sin facturación integrada.
- Distribución: repo público en GitHub; Docker Compose (app+postgres) recomendado; instalación manual soportada.
- La marca blanca es configuración de la instalación (ADR en `marca-blanca.md`), no aislamiento de datos.
- Una instalación puede contener varias **entidades legales** (`companies`) del mismo grupo (holding), con el flag sector público/privado por entidad.

## Consecuencias

- (+) Arquitectura y despliegue radicalmente más simples; soberanía de datos total del cliente.
- (+) Precio/soporte se pueden vender por instalación o servicio de implantación, sin infraestructura central.
- (−) Actualizaciones son responsabilidad del instalador (mitigar: migraciones robustas + tags + guía de actualización).
- (−) Cada mejora llega a clientes solo al actualizar (sin despliegue central); monitorear telemetría es opt-in o inexistente.
