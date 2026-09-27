# Marca blanca — mecanismo de personalización

> Estado: v0.1 (2026-09-26). Cada instalación es de una empresa: la personalización es por instalación (settings), no por tenant.

## 1. Qué se personaliza

| Ámbito | Configuración (`settings`) |
|---|---|
| Identidad | Nombre visible del producto, logotipo (SVG/PNG), favicon e iconos PWA (generados desde el logo), pie legal ("© 2026 <Empresa>") |
| Color | Paleta: primario, secundario, acento, navegación (claro/oscuro) |
| Tipografía | Familia tipográfica del sistema o custom upload |
| Lenguaje | Terminología editable: "Trabajador" / "Colaborador" / "Personal" (aplica a toda la UI vía i18n) |
| Dominio | Dominio/subdominio propio y URLs de correo remitente |
| Correo | SMTP propio de la instalación + plantillas con branding |
| Funcionalidad | Módulos activados/desactivados (ATS, encuestas, tienda…) |
| Sector | Bandera público/privado por entidad legal (`companies.sector`) |

## 2. Cómo se implementa (theming)

1. **CSS variables** de Materialize sobreescritas en una hoja generada: `:root { --brand-primary: …; --brand-secondary: …; }` + tokens propios (`--nav-bg`, `--footer-text`).
2. La hoja se **compila/sirve por instalación** (`/theme/css` dinámico con fingerprint) leyendo `settings.branding`.
3. Plantilla base Nunjucks inyecta: nombre del producto, logo, terminología, favicon, manifest PWA (iconos derivados del logo).
4. **Vista previa en vivo** en el admin: se aplica el tema a un iframe/preview antes de guardar.
5. El logo default del proyecto se reemplaza por el del tenant en navbar, login, correos y PDFs (recibos/constancias con membrete).

## 3. Wizard de primera instalación (M0)

Flujo del primer arranque (cuando no existe `superadmin`):

1. Crear cuenta de superadmin
2. Datos de la empresa: razón social, RIF, sector (público/privado)
3. Branding rápido: nombre, logo, color primario (con vista previa)
4. Opcionales: SMTP, terminología
5. Finalizar → panel admin con checklist de puesta en marcha

Guard: si la instalación queda sin completar, la app solo sirve el wizard (sin exponer módulos).

## 4. Restricciones

- El nombre interno del software y los créditos del proyecto open-source no se ocultan (según la licencia definitiva, ADR-0005).
- La marca blanca no incluye modificación del código: eso queda cubierto por la licencia (fork/instalación personalizada).
