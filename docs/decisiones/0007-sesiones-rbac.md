# ADR-0007 — Sesiones en PostgreSQL, RBAC por permisos y segundo factor de identidad

**Estado:** Aceptada (2026-09-27) — cierra la decisión abierta #3 de `modulos-y-hitos.md` · **Contexto:** `arquitectura.md` §5, `seguridad.md` §2–§3

## Contexto

La instalación es self-hosted y concentra datos sensibles (salarios, cédulas, documentos
médicos). El patrón de Patria —el trabajador se identifica escribiendo su cédula— es cómodo
pero **no es autenticación**: la cédula es un dato público, no un secreto. Confundir ambos
conceptos haría que el back-office quedara accesible a quien conozca el número de unworker.
Además hay tres restricciones ya decididas: sesiones en PostgreSQL (ADR-0004, sin Redis),
un solo secreto maestro en `.env` y aplicación de roles por instalación (marca blanca).

## Decisión

### 1. Token de sesión opaco, almacenado como hash

- La cookie lleva un **token aleatorio de 256 bits** generado con `crypto.randomBytes` (opaco,
  sin datos ni firma legible).
- En `sessions` se guarda **solo el hash SHA-256** del token, nunca el token en claro: una
  filtración de la tabla `sessions` no permite secuestrar sesiones.
- Búsqueda siempre por hash, en una única consulta indexada.
- **El token no se firma.** Como es aleatorio y se valida contra el servidor, la firma añadiría
  estado y una clave más que proteger sin ganancia de seguridad. La derivación por HKDF de
  `SESSION_SECRET` (punto 2) cubre lo que sí la requiere.

### 2. Un solo secreto maestro, con contextos derivados

`SESSION_SECRET` es el único secreto configurable. De él se derivan por **HKDF-SHA256**, con
`info` distinto y no reutilizable para ningún otro propósito:

| Contexto HKDF | Uso |
|---|---|
| `talento-ve:v1:toptp-encryption` | Cifrado en reposo (AES-256-GCM) de los secretos TOTP |
| `talento-ve:v1:csrf` | Semilla del token CSRF de cada sesión |
| `talento-ve:v1:backup-token` | Token de exfiltración de backups, si se implementa |

Consecuencia buscada: eliminar la clase de error "se configuró el secreto de sesión y se
olvidó el de CSRF, o quedaron iguales". El esquema zod de arranque **rechaza** los valores de
ejemplo (`CAMBIAR`, `changeme`, `secret`, `password`) y exige ≥32 bytes hex.

### 3. Ciclo de vida de la sesión

- **Cookie:** `httpOnly` · `SameSite=Lax` · `Secure` cuando `BASE_URL` es `https` · `Path=/`.
- **Caducidad por inactividad:** 8 min de aviso, 10 min de cierre (patrón Patria,
  `analisis-patria.md` §4.1), **validada en el servidor**: el `last_seen_at` se actualiza en
  cada petición y el cierre depende de ese valor, no de un temporizador de JavaScript. El
  heartbeat del cliente solo mejora la experiencia, nunca es el control.
- **Caducidad absoluta:** `SESSION_TTL_HOURS` (12 por defecto), que no se renueva aunque el
  usuario esté activo.
- **Rotación del token** en cada elevación de privilegios: login y confirmación TOTP. Tras la
  rotación se invalida el token anterior.
- **Revocación inmediata** desde el servidor en: logout, cambio de contraseña, suspensión del
  usuario, y cambio de rol que le quite permisos.
- Registro en `audit_log` de apertura y cierre de sesión, **incluidos los intentos fallidos**
  (su valor como señal para detectar ataques de fuerza bruta).

### 4. RBAC: códigos en código, asignaciones en datos

- Los **códigos de rol y de permiso viven en el código** como un tipo cerrado (TypeScript),
  no como filas editables. Motivo: el chequeo de autorización debe ser **exhaustivo y
  verificable por el compilador**; un permiso creado por SQL sin código que lo pueda
  conceder sería una vía de escalada silenciosa.
- Los **roles** (`superadmin`, `admin_rrhh`, `aprobador`, `empleado`, `auditor`) y sus
  permisos por defecto se siembran; la **asignación** de roles a usuarios sí es dato
  (`user_roles`), editable por el `superadmin` y auditada.
- Un endpoint **declara el permiso requerido**; la ausencia de declaración deniega
  (fail closed). La comprobación se hace en el servicio/repositorio, no solo en la ruta: un
  endpoint que devuelva datos de un empleado valida la relación (jefe directo, mismo equipo,
  RRHH) antes de leer.
- El rol `auditor` es de **solo lectura y explícitamente sin acceso a datos de salud** ni a
  documentos del expediente.

### 5. Identidad ≠ autenticación

El paso de cédula resuelve **quién es el trabajador**, no que sea él quien está al frente. La
separación en el modelo:

1. **Identidad** (cédula) → busca el expediente. Rate-limited, sin revelar existencia.
2. **Autenticación** (contraseña ± TOTP) → establece la sesión.

El back-office **nunca** se entra solo con cédula. Y un trabajador no puede aprobar su propia
solicitud ni editar su propio rol, permisos o contrato: la regla de separación se comprueba en
el dominio, no en la interfaz.

### 6. CSRF: token de sesión, no cookie doble

Token CSRF derivado por HKDF del secreto de sesión, entregado en la plantilla (atributo
`hx-headers` de HTMX) y comparado en **tiempo constante**. Todo cambio de estado es
POST/PUT/DELETE con token; ningún GET modifica estado (`analisis-patria.md` §6.2). El
patrón *double submit cookie* se descarta porque requiere duplicar estado en el cliente.

## Alternativas descartadas

- **JWT sin estado:** no se pueden revocar sin lista de bloqueo, y el logout dejaría de ser
  inmediato. En una instalación con datos de nómina, la revocación inmediata no es negociable.
- **Redis para sesiones:** contradice ADR-0004 y añade una dependencia al backup.
- **Roles y permisos como filas editables por UI:** permite que un permiso exista sin código que
  lo conceda. Se reserva para roles personalizados en un hito posterior, si el piloto lo pide.
- **Cédula como factor de autenticación:** no es un secreto. Ver punto 5.

## Consecuencias

- (+) Sesiones revocables de inmediato y sin dependencia externa; una filtración de la BD no
  entrega sesiones activas.
- (+) Un solo secreto que configurar, con derivaciones separadas por contexto.
- (+) La autorización es verificable en compilación y auditable.
- (−) Una consulta a la BD por petición para validar la sesión. Se mitiga con el índice por
  hash y, si el perfil lo muestra necesario, un caché de sesión de vida corta con
  invalidación explícita al revocar.
- (−) Los roles personalizados del cliente requerirán un hito propio.
