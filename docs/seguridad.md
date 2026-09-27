# Seguridad — TalentoVe

> Estado: **v0.1** (2026-09-27). Documento de diseño; la revisión por release se hace con la
> skill `security-review` (ver `AGENTS.md`). Complementa `arquitectura.md` §9 y §10.

Este sistema concentra **datos personales sensibles** (cédula, RIF, salario, fecha de
nacimiento, cargas familiares, documentos médicos, datos de accidentes de trabajo y datos
bancarios) en una instalación que suele ser auto-alojada en un servidor sin equipo de
seguridad dedicado. Eso fija el estándar: el adversario modelo es alguien con acceso a la red
de la oficina, no un atacante sofisticado.

## 1. Superficie y clasificación de datos

| Superficie | Datos expuestos | Controls obligatorios |
|---|---|---|
| Autenticación y sesión | Credenciales, cookies, TOTP | argon2id · cookie `httpOnly`+`SameSite=Lax`+`Secure` · CSRF · rate limiting · 2FA opcional |
| API JSON | Todo el dominio | Envelope de error sin filtrar internos · validación zod · autorización por feature · rate limiting en endpoints públicos |
| Vistas SSR | Datos del expediente y de nómina | Mismo HTML para todos los datos: escaping de Nunjucks activo (`autoescape`) · **nunca concatenar datos de usuario en HTML o atributos** |
| Archivos subidos | Documentos del expediente, adjuntos, actas | Lista blanca de MIME · tamaño máximo · nombre en disco generado (hash), **nunca el nombre original** · servir fuera del directorio de estáticos · **cifrado en reposo**: volumen `uploads/` cifrado (LUKS) o, si el volumen no lo está, cifrado por aplicación con clave derivada de `SESSION_SECRET` |
| Exportaciones | Reportes de nómina, catálogos | Permisos específicos · registro en `audit_log` · marca de confidencialidad en PDF |
| Correo saliente | Notificaciones con datos personales | Plantillas sin datos sensibles en el asunto · sin adjuntos automáticos sin revisar · remitente de la instalación |
| Instalación | `.env`, `uploads/`, dump de BD | Permisos de archivo restrictivos · secretos solo en env · nunca en BD ni en el repo |

**Clasificación de los datos de trabajadores: confidencial + sensible** (afecta a derechos
laborales y de salud). Consecuencia: acceso por rol siempre, exportación registrada en
`audit_log`, y cifrado en tránsito obligatorio aunque la instalación sea interna.

## 2. Autenticación

- **Contraseñas con argon2id** (`m`/`t` según capacidad de la máquina); nunca MD5, SHA1 ni
  bcrypt con parámetros débiles. El rehash a parámetros más fuertes ocurre en el siguiente
  login exitoso.
- **Política de contraseña**: longitud mínima 12, sin reglas de composición arbitraria; verificación
  contra listas de contraseñas filtradas; intervalo mínimo entre cambios.
- **2FA TOTP** opcional por usuario y **obligatorio** para `superadmin` cuando el rol existe
  fuera de la red local. **El secreto TOTP se cifra en reposo** (AES-256-GCM) con una clave
  derivada por HKDF de `SESSION_SECRET`; nunca en claro (ADR-0007).
- **Un solo secreto maestro**: `SESSION_SECRET` es el único secreto que se configura; de él se
  derivan por HKDF, con contextos separados, el firmador de cookies y el de los tokens CSRF.
  El esquema zod de arranque **rechaza los valores de ejemplo** (`CAMBIAR`, `changeme`,
  `secret`, `password`) y exige ≥32 bytes hex: un placeholder que pasara la validación
  firmaría las sesiones de toda instalación que compartiera ese valor con una clave conocida,
  y el fallo sería silencioso.
- **Sesiones**: store en PostgreSQL, token opaco de 256 bits en la cookie **guardado solo como
  hash** — una filtración de la tabla no permite secuestrar sesiones (ADR-0007); rotación del identificador
  en cada elevación de privilegios (login, TOTP); revocación server-side inmediata
  (logout, cambio de password, suspensión del usuario). `audit_log` registra los accesos,
  incluidos los fallidos.
- **Sesión inactiva**: aviso y cierre automático (8/10 min por defecto, configurable — patrón
  Patria, `analisis-patria.md` §4.1). El cierre se valida **en el servidor**, no solo en el
  cliente: un heartbeat del navegador no puede ser el único mecanismo de seguridad.
- **Limitación de intentos** en login y en el envío de correos de recuperación, con
  bloqueo temporal y registro. Enumeración de usuarios: el mensaje de login es idéntico para
  cédula inexistente y contraseña incorrecta.

## 3. Autorización

- **RBAC** con los roles de instalación (`arquitectura.md` §5, ADR-0007). Cada endpoint declara el rol
  requerido; la ausencia de declaración es **denegada por defecto** (fail closed).
- **La autorización se comprueba en el repositorio/servicio, no solo en la ruta**: un endpoint
  que devuelva datos de un empleado debe comprobar que el usuario tiene relación con él
  (jefe directo, mismo equipo, RRHH) o denegar.
- **IDOR**: los identificadores son UUID, pero **la obscurity no es control de acceso** —
  toda ruta que reciba un id valida pertenencia/permiso antes de leer.
- **Rol `auditor`**: solo lectura y explícitamente sin acceso a datos de salud ni a documentos
  del expediente.
- **Escalada de privilegios**: un empleado no puede editar su propio rol, sus permisos ni su
  tipo de contrato, ni aprobar su propia solicitud. La autoidentificación por cédula (patrón Patria)
  no otorga acceso al back-office: el primer factor resuelve la identidad, el segundo
  autentica.

## 4. Integridad de datos

- **SQL siempre parametrizado** (`pg` con placeholders), sin concatenación de cadenas
  — incluidas las listas de columnas y cláusulas `ORDER BY` de DataTables server-side, que son
  la vía clásica de inyección en este tipo de proyecto: se validan contra listas blancas.
- **CSRF en todo POST/PUT/DELETE** y en las encuestas de un clic (que son POST por diseño —
  `analisis-patria.md` §6.2). Ningún cambio de estado por GET.
- **XSS**: Nunjucks con autoescape activo; el HTML de fragmentos HTMX también se escapa en el
  servidor. Los literales de scripts en vistas se siguen la regla de CSP (ver §6).
- **Validación zod en todo borde** (body, query, params, archivos, `process.env`), con
  allowlists de campos: un cliente no puede escribir una columna que no envía el formulario
  (evita mass assignment en `employees`, `settings` y `payroll_concepts`).

## 5. Nómina, documentos legales y auditoría

- **Inmutabilidad de lo calculado**: una corrida de nómina cerrada no se recalcula ni se
  borra; las correcciones son corridas nuevas que referencian a la anterior. Borrado físico
  prohibido en nómina (soft-delete en el resto).
- **`audit_log` append-only**: quién, qué, cuándo, antes/después, IP y user-agent para
  acciones sensibles (nómina, expediente, configuración, exportaciones, cambios de rol).
  Sin permisos de `UPDATE`/`DELETE` para el rol de la aplicación; los scripts de retención
  borran por rango, no por update.
- **Los libros legales y las constancias** conservan el `hash` del contenido generado
  (`legal_register_issues.hash`): sirven como evidencia de qué se emitió y cuándo.
- **Separación de funciones**: quien calcula la nómina no debería poder modificarla; revisar
  con el sponsor si el piloto tiene personal suficiente para aplicar estos dos roles.

## 6. Configuración de servidor y cabeceras

- **helmet** con una **CSP explícita y sin `unsafe-inline` para scripts** (los bundles llevan
  fingerprint y los módulos ES de página, no scripts embebidos). Los estilos de Materialize
  requieren `style-src` con hashes o `'unsafe-inline'` **acotado a CSS**, no a scripts.
- **HSTS** solo si la instalación se sirve por HTTPS; la app no fuerza HTTPS por sí misma
  (depende de si hay proxy inverso), pero documenta el requisito y genera cookies `Secure`
  cuando `BASE_URL` es `https`.
- **Cabeceras**: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`
  que deniega cámara y micrófono salvo en las pantallas de firma y marcación.
- **CORS**: no se necesita (monolito SSR); si algún día se expone la API pública (M4), la
  política de CORS es explícita y por lista blanca, nunca `*`.
- **Rate limiting** en login, recuperación de password, envío de correo y endpoints públicos
  (portada de vacantes). Los jobs de pg-boss no dependen del rate limiter HTTP.

## 7. Datos personales: privacidad y minimización

- **Minimización**: el sistema guarda lo que un expediente laboral exige y nada más. Cada
  tipo de documento del catálogo `document_types` declara su base legal; lo que no tiene base
  legal no se pide.
- **Derecho de acceso, rectificación y supresión**: el flujo de `request_types` lo cubre
  (el trabajador solicita y el admin aprueba, con registro en `audit_log`).
- **Acceso del trabajador a sus propios datos**: solo a los suyos y a los de sus cargas/beneficiarios.
- **No registrar datos sensibles en logs**: el logger es estructurado y aplica una lista
  negra de campos (cédula completa, `password`, `totp_secret`, números de cuenta). Las cédulas
  se enmascaran en cualquier salida (`V-12.****.678`).
- **Retención**: los documentos de egreso y los rechazos se conservan por obligación legal;
  el resto sigue la política de retención que defina el sponsor, siempre por parámetro.
- **Supresión de datos**: instalado y con copia de seguridad, el instalador puede purgar
 selectivamente los datos de una persona (con registro en `audit_log`) cuando la ley lo exige.

## 8. Cadena de suministro y despliegue

- **Dependencias**: `pnpm audit` en CI bloquea vulnerabilidades altas; `pnpm-lock.yaml` se
  commitea; actualizaciones por PR con los parches de seguridad aplicados a mano.
- **Escaneo de secretos en CI**: `gitleaks detect` (o `trufflehog filesystem .`) como job
  bloqueante, con una allowlist explícita para los placeholders `CAMBIAR` de `.env.example`.
  Automatiza lo que `AGENTS.md` exige por disciplina, para que no dependa de la memoria de
  quien hace el commit.
- **Antes de publicar en GitHub**: revisar `activos-reutilizables.md`, que hoy expone rutas
  internas del entorno del mantenedor (`/home/havr/...`) y no debe llegar al repo público
  tal como está (ADR-0005 sigue bloqueando la publicación).
- **Imágenes Docker**: tags fijados por digest, usuario no-root en el contenedor, sin
  herramientas de build en la imagen final.
- **Secretos**: solo `.env` (ver `instalacion.md`); el wizard de instalación genera los
  secretos que necesite. Nunca en la BD, nunca en el repo, nunca en un dump compartido.
- **Permisos de archivos**: `.env` con `600`; `uploads/` sin acceso de ejecución; el proceso
  de la app no es root.
- **CI**: los secretos viven en GitHub Secrets; los jobs de integración levantan su propia
  PostgreSQL efímera con datos sintéticos.
- **Backups**: los dumps contienen todos los datos personales → se cifran o se guardan con
  permisos restrictivos, y el documento de backup dice explícitamente que no se compartan.

## 9. Lista de verificación pre-release

Se ejecuta con la skill `security-review` y su resultado queda en el PR:

- [ ] Sin secretos ni datos personales en el repo, fixtures, capturas y datasets
- [ ] `gitleaks detect` en verde (con allowlist de los placeholders de `.env.example`)
- [ ] `.env` con permisos `600`; `.env.example` sin valores reales
- [ ] Ningún secreto en runtime conserva el valor de ejemplo de `.env.example` (`CAMBIAR`)
- [ ] Contraseñas argon2id; 2FA TOTP cifrado en reposo
- [ ] CSRF en todos los POST; ningún cambio de estado por GET
- [ ] helmet + CSP sin `unsafe-inline` de scripts
- [ ] Rate limiting en login y endpoints públicos
- [ ] Autorización verificada en cada endpoint nuevo (fail closed)
- [ ] Allowlist de campos en todo endpoint que escriba (no mass assignment)
- [ ] SQL parametrizado; `ORDER BY` y columnas de DataTables con lista blanca
- [ ] Uploads: MIME en lista blanca, tamaño máximo, nombre en disco generado
- [ ] Logger con lista negra de campos sensibles; sin `console.log`
- [ ] `audit_log` sin permisos de actualización desde el rol de la aplicación
- [ ] `pnpm audit` sin vulnerabilidades altas
- [ ] Migraciones reversibles e idempotentes; backup probado antes de migrar
- [ ] `uploads/` cifrado en reposo, o cifrado por aplicación habilitado
- [ ] Antes de publicar: `activos-reutilizables.md` sin rutas internas del entorno
