# Instalación — TalentoVe

> Estado: **borrador v0.2** (2026-09-27) — el catálogo de variables de entorno ya está definido; se completa y valida en M0 (`modulos-y-hitos.md`).

## Requisitos previos (planificados)

- Node.js ≥ 20 y pnpm
- PostgreSQL 16 (local o en contenedor)
- 2 GB RAM y 10 GB de disco (mínimo orientativo; los documentos subidos crecen con el uso)
- Navegadores: Chrome/Edge/Firefox recientes (móvil incluido — PWA instalable)

## Variables de entorno

Todas se validan con **fail-fast al arrancar** (zod): si falta una obligatoria o un valor
es inválido, la aplicación **no levanta** y lo dice en el log, en vez de fallar en producción.
El catálogo completo y comentado está en [`.env.example`](../.env.example).

| Grupo | Variables | Obligatorias |
|---|---|---|
| Aplicación | `NODE_ENV`, `PORT`, `BASE_URL`, `TZ` (fija `America/Caracas`), `INSTANCE_NAME` | Sí |
| Base de datos | `DATABASE_URL`, `DATABASE_POOL_MAX`, `DATABASE_POOL_IDLE_TIMEOUT_MS` | Sí |
| Sesiones y seguridad | `SESSION_SECRET` (secreto **maestro**; de él se derivan por HKDF los tokens CSRF, las claves TOTP y la clave de cifrado TOTP), `SESSION_COOKIE_NAME`, `SESSION_TTL_HOURS`, `SESSION_INACTIVE_WARNING_MINUTES` (8 por defecto), `SESSION_INACTIVE_LOGOUT_MINUTES` (10), `LOGIN_RATE_LIMIT_MAX`, `LOGIN_RATE_LIMIT_WINDOW_MINUTES` | Sí |
| Correo | `SMTP_HOST`*, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`*, `SMTP_PASS`*, `MAIL_FROM`, `MAIL_FROM_NAME` | Solo si se quiere correo |
| Documentos | `STORAGE_DRIVER` (`local`\|`s3`), `STORAGE_LOCAL_PATH`, `STORAGE_MAX_FILE_BYTES`, `STORAGE_ALLOWED_MIME`; `S3_*` si el driver es `s3` | Sí |
| Parámetros legales | `INITIAL_BCV_USD_RATE`* | Solo en el primer arranque |

\* Vacío o ausente permitido: la app arranca en modo degradado y la UI lo advierte
(correo sin configurar; tasa inicial pendiente de carga por UI).

**Generación del secreto maestro** (nunca reutilizar entre instalaciones):

```bash
openssl rand -hex 32   # → SESSION_SECRET
```

`SESSION_SECRET` es el **único** secreto que hay que generar: de él se derivan por HKDF,
con contextos separados, los tokens CSRF, las claves TOTP y la clave con que se cifra el secreto
TOTP en reposo (ADR-0007). Así no existe un segundo secreto que se pueda olvidar o dejar en su
valor de ejemplo, y las claves nunca coinciden por accidente.

El token de sesión **no se firma**: es opaco, de 256 bits, generado al azar, y en la base de
datos solo se guarda su hash SHA-256. La cookie no necesita firma porque la validez se decide
consultando la fila de la sesión; lo que sí se protege con `SESSION_SECRET` son CSRF, TOTP y el
cifrado de los secretos TOTP.

**La app rechaza los valores de ejemplo.** El esquema zod de arranque exige al menos 32 bytes
hex y rechaza explícitamente `CAMBIAR`, `changeme`, `secret` y `password`. Sin esa comprobación,
copiar `.env.example` a `.env` sin editar el secreto levantaría la aplicación con una clave
conocida y **todas las sesiones de todas las instalaciones que compartieran ese valor serían
firmadas con la misma clave** — un fallo de autenticación silencioso y difícil de detectar.

**Permisos del archivo** (el `.env` contiene todos los secretos de la instalación):

```bash
cp .env.example .env
chmod 600 .env                # solo el usuario de la app puede leerlo
```

**Límite importante:** en este archivo hay **solo secretos e infraestructura**. La
configuración de negocio —branding, terminología, módulos activados, catálogo de documentos,
parámetros legales con vigencia y fuente— vive en `settings`, `rate_tables` y `rule_sets`, y
se edita desde la UI del admin (ver `arquitectura.md` §6 y `marca-blanca.md`).

## Vía recomendada: Docker Compose (en preparación)

```bash
git clone <repo> talento-ve && cd talento-ve
cp .env.example .env
chmod 600 .env                 # secretos solo legibles por el usuario de la app
# editar: DATABASE_URL y SESSION_SECRET (openssl rand -hex 32)
docker compose -f docker/docker-compose.yml up -d
# abrir http://localhost:3000 → wizard de primera instalación
```

Servicios: `app` (Node) + `postgres:16` con volumen para datos; los documentos se guardan en volumen `uploads`.

## Instalación manual

```bash
createdb talento
createdb-user…                  # usuario y permisos mínimos (se detallará)
pnpm install && pnpm build && pnpm migrate up
pnpm start                      # o servicio systemd (unit incluido en M0)
```

## Primer arranque (wizard)

1. Crear cuenta superadmin
2. Datos de la empresa: razón social, RIF, sector público/privado
3. Branding: nombre, logo, color (vista previa incluida)
4. (Opcional) SMTP y terminología

## Copias de seguridad

- Base de datos: `pg_dump -Fc talento > talento-$(date +%F).dump` (script programado incluido en M0)
- Documentos: copiar el directorio de `uploads/`
- Restauración: `pg_restore` + reponer `uploads/`

## Actualización

- Etiquetas de release con changelog; `git fetch --tags && git checkout vX.Y.Z`
- `pnpm install && pnpm build && pnpm migrate up` — migraciones idempotentes y reversibles
- Leer notas de release: algunos parámetros legales (`rate_tables`) se actualizan con seeds versionados

## Respaldo de parámetros legales

Los valores de `rate_tables` (UT, BCV, topes, porcentajes) deben revisarse tras cada actualización y ante cambios normativos publicados en Gaceta Oficial. El admin verá un aviso cuando un parámetro esté por vencer.
