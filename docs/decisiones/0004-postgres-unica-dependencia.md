# ADR-0004 — PostgreSQL como única dependencia: colas con pg-boss, sin Redis

**Estado:** Aceptada (2026-09-26)

## Contexto

Instalaciones self-hosted en empresas venezolanas, a menudo con infraestructura limitada. Cada dependencia de servicio (Redis, S3, etc.) aumenta la fricción de instalación y el costo de soporte.

## Decisión

- **PostgreSQL 16** es la única dependencia de servicio obligatoria.
- Colas/trabajos diferidos (corrida de nómina, recordatorios, vencimientos, correos): **pg-boss** sobre la misma BD.
- Almacenamiento de documentos: disco local por defecto; driver S3/MinIO **opcional**.
- PDF: **pdfmake** (Node puro) — sin Chromium ni binarios externos.

## Consecuencias

- (+) `docker-compose` de 2 servicios; instalación manual trivial; backups centralizados en PG + carpeta.
- (+) Transacciones y colas comparten BD: menos puntos de falla.
- (−) pg-boss es menos potente que Redis+queue para cargas extremas — fuera de escala para RRHH de empresa.
- (−) Documentos en disco exigen la copia de esa carpeta en el plan de backup (documentado).
