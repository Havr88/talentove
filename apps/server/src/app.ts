import express from 'express';
import type { Express, Request, Response } from 'express';
import nunjucks from 'nunjucks';
import cookieParser from 'cookie-parser';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { parseIdCatalog, validateNativeId } from '@talento-ve/domain';

import type { Env } from './config/env.js';
import type { Repositories } from './db/types.js';
import { createAuthMiddlewares } from './security/middleware.js';
import {
  generateSessionToken,
  hashPassword,
  hashSessionToken,
  verifyPassword,
} from './security/crypto.js';
import { generateWorkCertificatePdf } from './services/certificate-generator.js';
import { generateAttendanceSheetPdf } from './services/attendance-sheet-pdf.js';
import { computeDailyHours } from './services/attendance-calculator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createApp(repos: Repositories, env: Env): Express {
  const app = express();

  // Configuración de Nunjucks
  const viewsPath = join(__dirname, 'views');
  const nunjucksEnv = nunjucks.configure(viewsPath, {
    autoescape: true,
    express: app,
    noCache: env.NODE_ENV !== 'production',
  });

  // Filtros de Nunjucks
  nunjucksEnv.addFilter('formatDate', (str: string) => {
    try {
      return new Date(str).toLocaleDateString('es-VE');
    } catch {
      return str;
    }
  });

  app.use(express.urlencoded({ extended: true }));
  app.use(express.json());
  app.use(cookieParser());

  // Middlewares de seguridad y sesiones
  const { sessionMiddleware, requireAuth, csrfProtection } = createAuthMiddlewares(repos, env);
  app.use(sessionMiddleware);

  // Inyectar variables globales en las plantillas
  app.use(async (req: Request, res: Response, next) => {
    const settings = await repos.settings.getSettings();
    res.locals['instanceName'] = settings?.instanceName ?? env.INSTANCE_NAME;
    res.locals['primaryColor'] = settings?.primaryColor ?? '#0d47a1';
    res.locals['accentColor'] = settings?.accentColor ?? '#d32f2f';
    res.locals['currentUser'] = req.user;
    res.locals['csrfToken'] = req.csrfToken;
    next();
  });

  // Cargar catálogo de identificadores de personas
  const catalogPath = join(__dirname, '../../../data/ve/identificadores.json');
  const idCatalog = parseIdCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));

  // Guard de instalación: redirigir a /install si la instancia no está configurada
  app.use(async (req: Request, res: Response, next) => {
    if (req.path.startsWith('/health') || req.path.startsWith('/install')) {
      return next();
    }
    const settings = await repos.settings.getSettings();
    if (!settings || !settings.isConfigured) {
      return res.redirect('/install');
    }
    next();
  });

  // 1. Endpoint de Salud
  app.get('/health', async (_req: Request, res: Response) => {
    const settings = await repos.settings.getSettings();
    res.json({
      status: 'ok',
      instance: settings?.instanceName ?? env.INSTANCE_NAME,
      configured: settings?.isConfigured ?? false,
      timestamp: new Date().toISOString(),
      tz: env.TZ,
    });
  });

  // 2. Wizard de Primera Instalación
  app.get('/install', async (_req: Request, res: Response) => {
    const settings = await repos.settings.getSettings();
    if (settings && settings.isConfigured) {
      return res.redirect('/');
    }
    res.render('setup/install.njk', {
      pageTitle: 'Primera Instalación — TalentoVe',
      values: {},
    });
  });

  app.post('/install', async (req: Request, res: Response) => {
    const settings = await repos.settings.getSettings();
    if (settings && settings.isConfigured) {
      return res.redirect('/');
    }

    const {
      companyName,
      nativeId,
      instanceName,
      adminName,
      adminEmail,
      adminPassword,
      primaryColor,
      accentColor,
    } = req.body;

    const values = {
      companyName,
      nativeId,
      instanceName,
      adminName,
      adminEmail,
      primaryColor,
      accentColor,
    };

    if (!companyName || !nativeId || !adminName || !adminEmail || !adminPassword) {
      return res.status(400).render('setup/install.njk', {
        error: 'Todos los campos marcados con asterisco (*) son obligatorios.',
        values,
      });
    }

    if (adminPassword.length < 8) {
      return res.status(400).render('setup/install.njk', {
        error: 'La contraseña del administrador debe tener al menos 8 caracteres.',
        values,
      });
    }

    // Validación del RIF usando el dominio puro de Venezuela
    const idResult = validateNativeId(nativeId, idCatalog);
    if (!idResult.ok) {
      return res.status(400).render('setup/install.njk', {
        error: `RIF inválido: ${idResult.message}`,
        values,
      });
    }

    // Guardar configuración de la empresa
    await repos.settings.saveSettings({
      companyName: String(companyName).trim(),
      nativeId: idResult.value,
      instanceName: String(instanceName || 'TalentoVe').trim(),
      primaryColor: String(primaryColor || '#0d47a1').trim(),
      accentColor: String(accentColor || '#d32f2f').trim(),
      isConfigured: true,
    });

    // Crear el superadministrador
    const passwordHash = await hashPassword(adminPassword);
    const superAdmin = await repos.users.create({
      email: String(adminEmail).toLowerCase().trim(),
      fullName: String(adminName).trim(),
      passwordHash,
      role: 'superadmin',
      status: 'active',
    });

    // Iniciar sesión inmediatamente creando el token opaco
    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await repos.sessions.create({
      userId: superAdmin.id,
      tokenHash,
      expiresAt,
      lastActiveAt: now.toISOString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    });

    res.redirect('/');
  });

  // 3. Autenticación (Login / Logout)
  app.get('/login', (req: Request, res: Response) => {
    if (req.user) {
      return res.redirect('/');
    }
    res.render('auth/login.njk', {
      pageTitle: 'Iniciar Sesión — TalentoVe',
    });
  });

  app.post('/auth/login', async (req: Request, res: Response) => {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).render('auth/login.njk', {
        error: 'Debe ingresar correo y contraseña.',
        email,
      });
    }

    const user = await repos.users.findByEmail(String(email));
    if (!user || user.status !== 'active') {
      return res.status(401).render('auth/login.njk', {
        error: 'Credenciales inválidas.',
        email,
      });
    }

    const match = await verifyPassword(String(password), user.passwordHash);
    if (!match) {
      return res.status(401).render('auth/login.njk', {
        error: 'Credenciales inválidas.',
        email,
      });
    }

    const token = generateSessionToken();
    const tokenHash = hashSessionToken(token);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + env.SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();

    await repos.sessions.create({
      userId: user.id,
      tokenHash,
      expiresAt,
      lastActiveAt: now.toISOString(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(env.SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: env.NODE_ENV === 'production',
      maxAge: env.SESSION_TTL_HOURS * 60 * 60 * 1000,
    });

    res.redirect('/');
  });

  app.post('/auth/logout', csrfProtection, async (req: Request, res: Response) => {
    const token = req.cookies?.[env.SESSION_COOKIE_NAME];
    if (token && typeof token === 'string') {
      const tokenHash = hashSessionToken(token);
      await repos.sessions.deleteByTokenHash(tokenHash);
    }
    res.clearCookie(env.SESSION_COOKIE_NAME);
    res.redirect('/login');
  });

  // 4. Panel Principal (Dashboard)
  app.get('/', requireAuth, async (_req: Request, res: Response) => {
    const settings = (await repos.settings.getSettings())!;
    const workerCount = await repos.employees.count();
    res.render('dashboard/home.njk', {
      pageTitle: `Panel — ${settings.instanceName}`,
      settings,
      workerCount,
      bcvRate: 'Sincronizada',
    });
  });

  // 5. Gestión de Trabajadores (M1a)
  app.get('/trabajadores', requireAuth, async (req: Request, res: Response) => {
    const query = typeof req.query['q'] === 'string' ? req.query['q'].trim().toLowerCase() : '';
    let employees = await repos.employees.list();
    if (query) {
      employees = employees.filter(
        (e) =>
          e.nativeId.toLowerCase().includes(query) ||
          e.nombres.toLowerCase().includes(query) ||
          e.apellidos.toLowerCase().includes(query),
      );
    }
    res.render('workers/list.njk', {
      pageTitle: 'Trabajadores — TalentoVe',
      employees,
      query,
    });
  });

  app.get('/trabajadores/nuevo', requireAuth, async (_req: Request, res: Response) => {
    const territories = await repos.territories.list();
    res.render('workers/new.njk', {
      pageTitle: 'Nuevo Trabajador — TalentoVe',
      territories,
      values: {},
    });
  });

  app.post('/trabajadores', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const territories = await repos.territories.list();
    const values = req.body;
    const {
      cedulaTipo,
      cedulaNumero,
      rif,
      nombres,
      apellidos,
      fechaNacimiento,
      sexo,
      estadoCivil,
      correo,
      telefono,
      direccion,
      territoryId,
      cargo,
      unidad,
      sector,
      tipoContrato,
      fechaIngreso,
      salario,
      moneda,
    } = values;

    if (!cedulaTipo || !cedulaNumero || !nombres || !apellidos || !fechaNacimiento || !direccion || !cargo || !unidad || !salario) {
      return res.status(400).render('workers/new.njk', {
        error: 'Todos los campos con asterisco (*) son obligatorios.',
        territories,
        values,
      });
    }

    const nativeIdRaw = `${cedulaTipo}-${cedulaNumero}`;
    const idResult = validateNativeId(nativeIdRaw, idCatalog);
    if (!idResult.ok) {
      return res.status(400).render('workers/new.njk', {
        error: `Cédula de identidad inválida: ${idResult.message}`,
        territories,
        values,
      });
    }

    const existing = await repos.employees.findByNativeId(idResult.value);
    if (existing) {
      return res.status(400).render('workers/new.njk', {
        error: `El trabajador con cédula ${idResult.value} ya se encuentra registrado.`,
        territories,
        values,
      });
    }

    // 1. Obtener o crear Unidad
    let orgUnit = (await repos.orgUnits.list()).find(
      (u) => u.name.toLowerCase() === String(unidad).toLowerCase().trim(),
    );
    if (!orgUnit) {
      orgUnit = await repos.orgUnits.create({
        name: String(unidad).trim(),
        typeId: 4,
      });
    }

    // 2. Obtener o crear Cargo
    let position = await repos.positions.findByName(String(cargo));
    if (!position) {
      position = await repos.positions.create({
        name: String(cargo).trim(),
        categoria: 'General',
        grupoIsco: 'Otras',
        aplicaSector: sector === 'publico' ? 'publico' : 'privado',
        activo: true,
      });
    }

    // 3. Crear Trabajador
    const emp = await repos.employees.create({
      cedulaTipo: cedulaTipo as 'V' | 'E',
      cedulaNumero: String(cedulaNumero).trim(),
      nativeId: idResult.value,
      rif: rif && String(rif).trim() !== '' ? String(rif).trim() : undefined,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      fechaNacimiento,
      sexo: sexo as 'M' | 'F',
      estadoCivil: estadoCivil as any,
      correo: correo && String(correo).trim() !== '' ? String(correo).trim() : undefined,
      telefono: telefono && String(telefono).trim() !== '' ? String(telefono).trim() : undefined,
      direccion: String(direccion).trim(),
      territoryId: territoryId ? Number.parseInt(String(territoryId), 10) : undefined,
      status: 'activo',
    });

    // 4. Crear Contrato
    await repos.contracts.create({
      employeeId: emp.id,
      orgUnitId: orgUnit.id,
      positionId: position.id,
      tipo: (tipoContrato as any) || 'indeterminado',
      sector: (sector as any) || 'privado',
      fechaIngreso,
      salarioBase: String(salario).trim(),
      currency: (moneda as any) || 'VES',
      jornadaHoras: 8.0,
      activo: true,
    });

    res.redirect('/trabajadores');
  });

  // 6. Carga Masiva (Módulo J / M1a)
  app.get('/trabajadores/importar', requireAuth, (_req: Request, res: Response) => {
    res.render('workers/import.njk', {
      pageTitle: 'Carga Masiva — TalentoVe',
    });
  });

  app.post('/trabajadores/importar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const { csvData, mode } = req.body;
    const isDryRun = mode === 'dryrun';

    if (!csvData || typeof csvData !== 'string' || csvData.trim() === '') {
      return res.status(400).render('workers/import.njk', {
        errors: [{ rowNumber: 0, message: 'Debe ingresar datos en formato CSV.' }],
        csvData,
      });
    }

    const { BulkLoader } = await import('./importer/bulk-loader.js');
    const loader = new BulkLoader(repos, idCatalog);
    const rows = loader.parseCsv(csvData);
    const result = await loader.process(rows, isDryRun);

    if (!result.success) {
      return res.status(400).render('workers/import.njk', {
        errors: result.errors,
        csvData,
      });
    }

    if (isDryRun) {
      return res.render('workers/import.njk', {
        preview: result,
        csvData,
      });
    }

    res.render('workers/list.njk', {
      pageTitle: 'Trabajadores — TalentoVe',
      employees: await repos.employees.list(),
      success: `Se importaron ${result.imported.length} trabajadores exitosamente.`,
    });
  });

  // ==========================================
  // HITO M1b — EXPEDIENTE DIGITAL Y SOLICITUDES
  // ==========================================

  // 1. Ver Expediente Completo del Trabajador
  app.get('/trabajadores/:id', requireAuth, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const activeContract = await repos.contracts.findActiveByEmployeeId(employee.id);
    let position = null;
    let orgUnit = null;
    if (activeContract) {
      if (activeContract.positionId) {
        position = (await repos.positions.list()).find((p) => p.id === activeContract.positionId) ?? null;
      }
      if (activeContract.orgUnitId) {
        orgUnit = await repos.orgUnits.findById(activeContract.orgUnitId);
      }
    }

    const territory = employee.territoryId ? await repos.territories.findById(employee.territoryId) : null;
    const dependents = await repos.dependents.listByEmployeeId(employee.id);
    const movements = await repos.movements.listByEmployeeId(employee.id);

    res.render('workers/show.njk', {
      pageTitle: `Expediente: ${employee.nombres} ${employee.apellidos} — TalentoVe`,
      employee,
      activeContract,
      position,
      orgUnit,
      territory,
      dependents,
      movements,
    });
  });

  // 2. Formulario de Edición de Trabajador
  app.get('/trabajadores/:id/editar', requireAuth, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const territories = await repos.territories.list();
    res.render('workers/edit.njk', {
      pageTitle: `Editar: ${employee.nombres} ${employee.apellidos} — TalentoVe`,
      employee,
      territories,
    });
  });

  // 3. Procesar Edición de Trabajador
  app.post('/trabajadores/:id/editar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const {
      nombres,
      apellidos,
      fechaNacimiento,
      sexo,
      estadoCivil,
      correo,
      telefono,
      direccion,
      territoryId,
      status,
    } = req.body;

    if (!nombres || !apellidos || !fechaNacimiento || !sexo || !estadoCivil || !direccion || !status) {
      const territories = await repos.territories.list();
      return res.status(400).render('workers/edit.njk', {
        error: 'Todos los campos con asterisco (*) son obligatorios.',
        employee: { ...employee, ...req.body },
        territories,
      });
    }

    await repos.employees.update(employee.id, {
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      fechaNacimiento: String(fechaNacimiento),
      sexo: sexo as 'M' | 'F',
      estadoCivil: estadoCivil as any,
      correo: correo && String(correo).trim() !== '' ? String(correo).trim() : undefined,
      telefono: telefono && String(telefono).trim() !== '' ? String(telefono).trim() : undefined,
      direccion: String(direccion).trim(),
      territoryId: territoryId ? Number.parseInt(String(territoryId), 10) : undefined,
      status: status as any,
    });

    res.redirect(`/trabajadores/${employee.id}`);
  });

  // 4. Agregar Carga Familiar
  app.post('/trabajadores/:id/cargas', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const { nombres, apellidos, parentesco, cedula, fechaNacimiento, sexo, gradoInstruccion, discapacidad } = req.body;
    if (!nombres || !apellidos || !parentesco || !fechaNacimiento || !sexo) {
      return res.status(400).redirect(`/trabajadores/${employee.id}`);
    }

    await repos.dependents.create({
      employeeId: employee.id,
      nombres: String(nombres).trim(),
      apellidos: String(apellidos).trim(),
      parentesco: parentesco as any,
      cedula: cedula && String(cedula).trim() !== '' ? String(cedula).trim() : undefined,
      fechaNacimiento: String(fechaNacimiento),
      sexo: sexo as 'M' | 'F',
      gradoInstruccion: gradoInstruccion ? String(gradoInstruccion).trim() : 'ninguno',
      discapacidad: discapacidad === 'true' || discapacidad === true,
    });

    res.redirect(`/trabajadores/${employee.id}`);
  });

  // 5. Eliminar Carga Familiar
  app.post('/trabajadores/:id/cargas/:cargaId/eliminar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const cargaId = String(req.params.cargaId);
    await repos.dependents.delete(cargaId);
    res.redirect(`/trabajadores/${id}`);
  });

  // 6. Registrar Movimiento Contractual
  app.post('/trabajadores/:id/movimientos', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const activeContract = await repos.contracts.findActiveByEmployeeId(employee.id);
    if (!activeContract) {
      return res.status(400).send('El trabajador no posee un contrato activo para modificar');
    }

    const { tipoMovimiento, fechaEfectiva, cargoNuevo, unidadNueva, salarioNuevo, motivo } = req.body;
    if (!tipoMovimiento || !fechaEfectiva || !cargoNuevo || !unidadNueva || !salarioNuevo) {
      return res.status(400).redirect(`/trabajadores/${employee.id}`);
    }

    // Buscar o crear nueva Unidad
    let orgUnit = (await repos.orgUnits.list()).find(
      (u) => u.name.toLowerCase() === String(unidadNueva).toLowerCase().trim(),
    );
    if (!orgUnit) {
      orgUnit = await repos.orgUnits.create({ name: String(unidadNueva).trim(), typeId: 4 });
    }

    // Buscar o crear nuevo Cargo
    let position = await repos.positions.findByName(String(cargoNuevo));
    if (!position) {
      position = await repos.positions.create({
        name: String(cargoNuevo).trim(),
        categoria: 'General',
        grupoIsco: 'Otras',
        aplicaSector: activeContract.sector,
        activo: true,
      });
    }

    // Obtener datos del cargo y unidad anterior
    const currentPosition = activeContract.positionId ? (await repos.positions.list()).find((p) => p.id === activeContract.positionId) : null;
    const currentUnit = activeContract.orgUnitId ? await repos.orgUnits.findById(activeContract.orgUnitId) : null;

    // 1. Guardar Movimiento en el historial
    await repos.movements.create({
      contractId: activeContract.id,
      employeeId: employee.id,
      tipoMovimiento: tipoMovimiento as any,
      fechaEfectiva: String(fechaEfectiva),
      cargoAnterior: currentPosition?.name,
      cargoNuevo: String(cargoNuevo).trim(),
      unidadAnterior: currentUnit?.name,
      unidadNueva: String(unidadNueva).trim(),
      salarioAnterior: activeContract.salarioBase,
      salarioNuevo: String(salarioNuevo).trim(),
      motivo: motivo && String(motivo).trim() !== '' ? String(motivo).trim() : undefined,
      aprobadoPor: req.user?.id,
    });

    // 2. Actualizar el contrato activo
    await repos.contracts.update(activeContract.id, {
      positionId: position.id,
      orgUnitId: orgUnit.id,
      salarioBase: String(salarioNuevo).trim(),
    });

    res.redirect(`/trabajadores/${employee.id}`);
  });

  // 7. Generar y Descargar Constancia de Trabajo en PDF
  app.get('/trabajadores/:id/constancia/pdf', requireAuth, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const activeContract = await repos.contracts.findActiveByEmployeeId(employee.id);
    if (!activeContract) {
      return res.status(400).send('El trabajador no posee contrato laboral activo');
    }

    const settings = await repos.settings.getSettings();
    const position = activeContract.positionId ? (await repos.positions.list()).find((p) => p.id === activeContract.positionId) : null;
    const orgUnit = activeContract.orgUnitId ? await repos.orgUnits.findById(activeContract.orgUnitId) : null;

    // Generar código único de verificación
    const verificationCode = `CONST-${randomBytes(4).toString('hex').toUpperCase()}`;

    // Registrar solicitud aprobada
    await repos.requests.create({
      employeeId: employee.id,
      userId: req.user?.id,
      tipo: 'constancia_trabajo',
      estatus: 'aprobada',
      motivo: 'Generación directa de constancia de trabajo certificada',
      codigoVerificacion: verificationCode,
    });

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const pdfBuffer = await generateWorkCertificatePdf({
      companyName: settings?.companyName ?? 'Empresa Pública',
      nativeId: settings?.nativeId ?? 'G200000010',
      instanceName: settings?.instanceName ?? 'TalentoVe',
      employeeFullName: `${employee.nombres} ${employee.apellidos}`,
      cedula: `${employee.cedulaTipo}-${employee.cedulaNumero}`,
      cargo: position?.name ?? 'Empleado General',
      unidad: orgUnit?.name ?? 'Sede Central',
      fechaIngreso: activeContract.fechaIngreso,
      salarioBase: activeContract.salarioBase,
      currency: activeContract.currency,
      sector: activeContract.sector,
      verificationCode,
      baseUrl,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="constancia-${employee.nativeId}.pdf"`);
    res.send(pdfBuffer);
  });

  // 8. Bandeja de Solicitudes de Personal
  app.get('/solicitudes', requireAuth, async (_req: Request, res: Response) => {
    const rawRequests = await repos.requests.list();
    const employees = await repos.employees.list();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const requests = rawRequests.map((r) => {
      const emp = empMap.get(r.employeeId);
      return {
        ...r,
        employeeName: emp ? `${emp.nombres} ${emp.apellidos}` : 'Desconocido',
        employeeCedula: emp ? `${emp.cedulaTipo}-${emp.cedulaNumero}` : 'S/C',
      };
    });

    res.render('requests/index.njk', {
      pageTitle: 'Bandeja de Solicitudes — TalentoVe',
      requests,
    });
  });

  // 9. Formulario para Nueva Solicitud
  app.get('/solicitudes/nueva', requireAuth, async (req: Request, res: Response) => {
    const employees = await repos.employees.list();
    const selectedEmployeeId = typeof req.query.employeeId === 'string' ? req.query.employeeId : '';

    res.render('requests/new.njk', {
      pageTitle: 'Radicar Solicitud — TalentoVe',
      employees,
      selectedEmployeeId,
    });
  });

  // 10. Procesar Radicación de Solicitud
  app.post('/solicitudes', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const { employeeId, tipo, motivo, montoSolicitado, fechaDesde, fechaHasta } = req.body;
    if (!employeeId || !tipo || !motivo) {
      const employees = await repos.employees.list();
      return res.status(400).render('requests/new.njk', {
        error: 'Debe seleccionar un trabajador, tipo de solicitud y motivo.',
        employees,
        selectedEmployeeId: employeeId,
      });
    }

    const verificationCode = tipo === 'constancia_trabajo' ? `REQ-${randomBytes(4).toString('hex').toUpperCase()}` : undefined;

    // Si es constancia radicada por admin, queda aprobada automáticamente
    const isAdmin = req.user?.role === 'superadmin' || req.user?.role === 'admin';
    const estatus = tipo === 'constancia_trabajo' && isAdmin ? 'aprobada' : 'pendiente';

    let diasSolicitados: number | undefined;
    if (fechaDesde && fechaHasta) {
      const diffMs = new Date(fechaHasta).getTime() - new Date(fechaDesde).getTime();
      diasSolicitados = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
    }

    await repos.requests.create({
      employeeId,
      userId: req.user?.id,
      tipo: tipo as any,
      estatus,
      motivo: String(motivo).trim(),
      montoSolicitado: montoSolicitado && String(montoSolicitado).trim() !== '' ? String(montoSolicitado).trim() : undefined,
      fechaDesde: fechaDesde || undefined,
      fechaHasta: fechaHasta || undefined,
      diasSolicitados,
      codigoVerificacion: verificationCode,
    });

    res.redirect('/solicitudes');
  });

  // 11. Aprobar Solicitud
  app.post('/solicitudes/:id/aprobar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      return res.status(403).send('Permisos insuficientes');
    }
    const id = String(req.params.id);
    await repos.requests.updateStatus(id, 'aprobada', 'Aprobada por Gestión Humana');
    res.redirect('/solicitudes');
  });

  // 12. Rechazar Solicitud
  app.post('/solicitudes/:id/rechazar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    if (req.user?.role !== 'superadmin' && req.user?.role !== 'admin') {
      return res.status(403).send('Permisos insuficientes');
    }
    const id = String(req.params.id);
    await repos.requests.updateStatus(id, 'rechazada', 'Rechazada por Gestión Humana');
    res.redirect('/solicitudes');
  });

  // 13. Verificación Pública de Constancias por Código (Sin Auth)
  app.get('/verificar/:codigo', async (req: Request, res: Response) => {
    const codigo = String(req.params.codigo);
    const employeeRequest = await repos.requests.findByCodigoVerificacion(codigo);

    if (!employeeRequest || employeeRequest.estatus !== 'aprobada') {
      return res.render('requests/verify.njk', {
        valid: false,
        codigo,
      });
    }

    const employee = await repos.employees.findById(employeeRequest.employeeId);
    const contract = employee ? await repos.contracts.findActiveByEmployeeId(employee.id) : null;
    const company = await repos.settings.getSettings();

    let positionName = 'Cargo General';
    let unitName = 'Sede Central';
    if (contract) {
      if (contract.positionId) {
        const p = (await repos.positions.list()).find((item) => item.id === contract.positionId);
        if (p) positionName = p.name;
      }
      if (contract.orgUnitId) {
        const u = await repos.orgUnits.findById(contract.orgUnitId);
        if (u) unitName = u.name;
      }
    }

    res.render('requests/verify.njk', {
      valid: true,
      request: employeeRequest,
      employee,
      contract: {
        ...contract,
        positionName,
        unitName,
      },
      company: company ?? { companyName: 'Empresa', nativeId: 'G000000000' },
    });
  });

  // ==========================================
  // HITO M2: CONTROL Y GESTIÓN DE ASISTENCIA
  // ==========================================

  function getIsoWeek(dateStr: string): { weekNumber: number; year: number } {
    const target = new Date(dateStr);
    const dayNr = (target.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = target.valueOf();
    target.setMonth(0, 1);
    if (target.getDay() !== 4) {
      target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
    }
    const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
    return { weekNumber, year: target.getFullYear() };
  }

  function getDatesRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    const current = new Date(startDate);
    const end = new Date(endDate);
    let count = 0;
    while (current <= end && count < 14) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
      count++;
    }
    return dates;
  }

  // 1. Listado de planillas semanales
  app.get('/asistencia', requireAuth, async (req: Request, res: Response) => {
    const departmentId = req.query['departmentId'] ? String(req.query['departmentId']) : undefined;
    const status = req.query['status'] ? (String(req.query['status']) as any) : undefined;

    const [sheets, departments] = await Promise.all([
      repos.attendance.listSheets({ orgUnitId: departmentId, status }),
      repos.orgUnits.list(),
    ]);

    const deptMap = new Map(departments.map((d) => [d.id, d.name]));
    const sheetsWithDept = sheets.map((s) => ({
      ...s,
      departmentName: deptMap.get(s.orgUnitId) || 'General',
    }));

    res.render('attendance/index.njk', {
      sheets: sheetsWithDept,
      departments,
      query: req.query,
    });
  });

  // 2. Formulario de apertura de nueva planilla semanal
  app.get('/asistencia/nueva', requireAuth, async (_req: Request, res: Response) => {
    const departments = await repos.orgUnits.list();
    const today = new Date();
    const dayOfWeek = today.getDay();
    const distanceToMonday = (dayOfWeek + 6) % 7;
    const monday = new Date(today);
    monday.setDate(today.getDate() - distanceToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    res.render('attendance/new.njk', {
      departments,
      formData: {
        startDate: monday.toISOString().slice(0, 10),
        endDate: sunday.toISOString().slice(0, 10),
      },
    });
  });

  // 3. Crear nueva planilla semanal
  app.post('/asistencia', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    try {
      const { departmentId, startDate, endDate, coordinatorName, notes } = req.body;
      const deptIdStr = String(departmentId || '');
      const startStr = String(startDate);
      const endStr = String(endDate);

      const { weekNumber, year } = getIsoWeek(startStr);

      const sheet = await repos.attendance.createSheet({
        orgUnitId: deptIdStr,
        weekNumber,
        year,
        startDate: startStr,
        endDate: endStr,
        coordinatorName: String(coordinatorName || 'Coordinador de Área'),
        status: 'borrador',
        observations: notes ? String(notes) : undefined,
      });

      // Buscar empleados asignados al departamento o activos en general
      const allEmployees = await repos.employees.list();
      const activeEmployees = allEmployees.filter((e) => e.status === 'activo');
      const targetEmployees: typeof activeEmployees = [];

      for (const emp of activeEmployees) {
        const contract = await repos.contracts.findActiveByEmployeeId(emp.id);
        if (!deptIdStr || (contract && contract.orgUnitId === deptIdStr)) {
          targetEmployees.push(emp);
        }
      }

      const finalEmployees = targetEmployees.length > 0 ? targetEmployees : activeEmployees;
      const days = getDatesRange(startStr, endStr);

      const recordsToCreate = [];
      for (const emp of finalEmployees) {
        for (const day of days) {
          const dayDate = new Date(day);
          const dayOfWeek = dayDate.getDay();
          recordsToCreate.push({
            sheetId: sheet.id,
            employeeId: emp.id,
            date: day,
            dayOfWeek,
            timeIn: '08:00',
            timeOut: '17:00',
            status: 'asistio' as const,
            regularHours: 8,
            overtimeDayHours: 0,
            overtimeNightHours: 0,
            nightShiftHours: 0,
            workerSigned: false,
          });
        }
      }

      if (recordsToCreate.length > 0) {
        await repos.attendance.saveRecords(recordsToCreate);
      }

      res.redirect(`/asistencia/${sheet.id}`);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Error al aperturar la planilla';
      const departments = await repos.orgUnits.list();
      res.status(400).render('attendance/new.njk', {
        error: errorMsg,
        departments,
        formData: req.body,
      });
    }
  });

  // 4. Detalle y cuadrícula interactiva de planilla
  app.get('/asistencia/:sheetId', requireAuth, async (req: Request, res: Response) => {
    const sheetId = String(req.params['sheetId']);
    const sheet = await repos.attendance.findSheetById(sheetId);
    if (!sheet) {
      return res.status(404).render('errors/404.njk', { message: 'Planilla de asistencia no encontrada' });
    }

    const [records, employees, orgUnit] = await Promise.all([
      repos.attendance.listRecordsBySheetId(sheet.id),
      repos.employees.list(),
      repos.orgUnits.findById(sheet.orgUnitId),
    ]);

    const empMap = new Map(employees.map((e) => [e.id, e]));
    const enrichedRecords = records.map((r) => {
      const emp = empMap.get(r.employeeId);
      return {
        ...r,
        workerName: emp ? `${emp.nombres} ${emp.apellidos}` : 'Trabajador',
        workerIdDoc: emp ? `${emp.cedulaTipo}-${emp.cedulaNumero}` : 'V-00000000',
      };
    });

    const sheetWithDept = {
      ...sheet,
      departmentName: orgUnit ? orgUnit.name : 'General',
    };

    res.render('attendance/sheet.njk', {
      sheet: sheetWithDept,
      records: enrichedRecords,
      query: req.query,
    });
  });

  // 5. Guardar registros y recalcular horas según LOTTT
  app.post('/asistencia/:sheetId/guardar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const sheetId = String(req.params['sheetId']);
    const sheet = await repos.attendance.findSheetById(sheetId);
    if (!sheet) {
      return res.status(404).render('errors/404.njk', { message: 'Planilla de asistencia no encontrada' });
    }

    const existingRecords = await repos.attendance.listRecordsBySheetId(sheet.id);
    const recordsToSave = [];

    for (const r of existingRecords) {
      const timeIn = req.body[`timeIn_${r.id}`] !== undefined ? String(req.body[`timeIn_${r.id}`]) : r.timeIn;
      const timeOut = req.body[`timeOut_${r.id}`] !== undefined ? String(req.body[`timeOut_${r.id}`]) : r.timeOut;
      const signatureVal = req.body[`signature_${r.id}`];
      const workerSigned = Boolean(signatureVal && signatureVal !== '0');
      const notes = req.body[`notes_${r.id}`] !== undefined ? String(req.body[`notes_${r.id}`]) : r.observations;

      let regularHours = 0;
      let overtimeDayHours = 0;
      let overtimeNightHours = 0;
      let nightShiftHours = 0;

      if (timeIn && timeOut) {
        const calc = computeDailyHours(timeIn, timeOut);
        regularHours = calc.regularHours;
        overtimeDayHours = calc.overtimeDayHours;
        overtimeNightHours = calc.overtimeNightHours;
        nightShiftHours = calc.nightShiftHours;
      }

      recordsToSave.push({
        sheetId: r.sheetId,
        employeeId: r.employeeId,
        date: r.date,
        dayOfWeek: r.dayOfWeek,
        timeIn,
        timeOut,
        status: r.status,
        regularHours,
        overtimeDayHours,
        overtimeNightHours,
        nightShiftHours,
        workerSigned,
        observations: notes,
      });
    }

    if (recordsToSave.length > 0) {
      await repos.attendance.saveRecords(recordsToSave);
    }

    if (sheet.status === 'borrador') {
      await repos.attendance.updateSheet(sheet.id, { status: 'en_revision' });
    }

    res.redirect(`/asistencia/${sheet.id}?saved=true`);
  });

  // 6. Certificar y aprobar planilla por Analista de RRHH
  app.post('/asistencia/:sheetId/verificar', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const sheetId = String(req.params['sheetId']);
    const sheet = await repos.attendance.findSheetById(sheetId);
    if (!sheet) {
      return res.status(404).render('errors/404.njk', { message: 'Planilla de asistencia no encontrada' });
    }

    const currentUserName = req.user ? req.user.fullName : 'Analista de Talento Humano';

    await repos.attendance.updateSheet(sheet.id, {
      status: 'verificada',
      verifiedBy: currentUserName,
    });

    res.redirect(`/asistencia/${sheet.id}?verified=true`);
  });

  // 7. Descargar Planilla Semanal Oficial en PDF
  app.get('/asistencia/:sheetId/pdf', requireAuth, async (req: Request, res: Response) => {
    const sheetId = String(req.params['sheetId']);
    const sheet = await repos.attendance.findSheetById(sheetId);
    if (!sheet) {
      return res.status(404).render('errors/404.njk', { message: 'Planilla de asistencia no encontrada' });
    }

    const [records, employees, orgUnit, settings] = await Promise.all([
      repos.attendance.listRecordsBySheetId(sheet.id),
      repos.employees.list(),
      repos.orgUnits.findById(sheet.orgUnitId),
      repos.settings.getSettings(),
    ]);

    const empMap = new Map(employees.map((e) => [e.id, e]));

    // Agrupar registros por empleado para la grilla del PDF
    const empGroup = new Map<string, typeof records>();
    for (const r of records) {
      const list = empGroup.get(r.employeeId) || [];
      list.push(r);
      empGroup.set(r.employeeId, list);
    }

    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const rows = Array.from(empGroup.entries()).map(([empId, recs]) => {
      const emp = empMap.get(empId);
      return {
        cedula: emp ? `${emp.cedulaTipo}-${emp.cedulaNumero}` : 'V-00000000',
        fullName: emp ? `${emp.nombres} ${emp.apellidos}` : 'Trabajador',
        days: recs.map((rc) => ({
          dayName: dayNames[rc.dayOfWeek] || 'Día',
          timeIn: rc.timeIn,
          timeOut: rc.timeOut,
          status: rc.status,
          signed: rc.workerSigned,
        })),
        observations: recs.find((rc) => rc.observations)?.observations,
      };
    });

    const pdfBuffer = await generateAttendanceSheetPdf({
      companyName: settings?.companyName || 'REPÚBLICA BOLIVARIANA DE VENEZUELA',
      nativeId: settings?.nativeId || 'G-20000000-0',
      departmentName: orgUnit ? orgUnit.name : 'Dirección General',
      weekNumber: sheet.weekNumber,
      year: sheet.year,
      startDate: sheet.startDate,
      endDate: sheet.endDate,
      coordinatorName: sheet.coordinatorName,
      verifiedByName: sheet.verifiedBy,
      rows,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="asistencia-sem-${sheet.weekNumber}-${sheet.year}.pdf"`
    );
    res.send(pdfBuffer);
  });

  return app;
}

