# Reportando una vulnerabilidad de seguridad

TalentoVe gestiona **datos personales de trabajadores venezolanos** (cédulas, cuentas bancarias,
documentos de identidad, datos médicos y familiares). Cualquier vulnerabilidad puede exponer
información sensible: agradecemos reportes responsables.

## Cómo reportar

1. **No abras un issue público** con detalles de la vulnerabilidad.
2. Escríbenos por el canal privado de **GitHub Security Advisories**: pestaña *Security →
   Report a vulnerability* de este repositorio.
3. Si no es posible, contacta al mantenedor directamente con el asunto
   `[seguridad] talento-ve`.

Incluye: descripción, pasos de reproducción, impacto estimado y versión afectada.
Daos de baja: **90 días** para trabajar la corrección antes de divulgación coordinada.

## Superficie crítica (prioridad de revisión)

| Superficie | Documento |
|---|---|
| Expedientes y descarga de documentos | `docs/decisiones/0008-storage-driver.md` |
| Sesiones, CSRF y manejo de credenciales | `docs/decisiones/0007-sesiones-rbac.md` |
| Fórmulas de nómina (riesgo económico) | `docs/decisiones/0009-formulas-nomina.md` |
| Modelo de amenazas completo | `docs/seguridad.md` |

## Antes de reportar

Verifica contra el modelo de amenazas (`docs/seguridad.md`) — algunos riesgos son aceptados
explícitamente y documentados (p. ej., antivirus de uploads es un control opcional en
instalaciones pequeñas).

## Los reportes son confidenciales

No revelaremos los detalles del reporte hasta tener el parche, y acreditaremos al reportante
(así lo prefiera) en el release notes.
