import express from 'express';
import type { Express, Request, Response } from 'express';
import nunjucks from 'nunjucks';
import cookieParser from 'cookie-parser';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
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
import { generatePayrollReceiptPdf } from './services/payroll-receipt-pdf.js';
import { PayrollService } from './services/payroll-service.js';
import { CredentialService } from './services/credential-service.js';
import { BankingService } from './services/banking-service.js';
import { ParafiscalService } from './services/parafiscal-service.js';
import { SstService } from './services/sst-service.js';
import { OffboardingService } from './services/offboarding-service.js';
import { AssetService } from './services/asset-service.js';
import { IceHrmServices } from './services/icehrm-services.js';
import type { RequestType } from './db/types.js';
import type { VenezuelanBankCode, LiquidationReason } from '@talento-ve/domain';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export function createApp(repos: Repositories, env: Env): Express {
  const app = express();
  const payrollService = new PayrollService(repos);
  const credentialService = new CredentialService(repos);
  const bankingService = new BankingService(repos);
  const parafiscalService = new ParafiscalService(repos);
  const sstService = new SstService(repos);
  const offboardingService = new OffboardingService(repos);
  const assetService = new AssetService(repos);

  app.use(express.static(join(__dirname, '../public')));
  app.use(express.static(join(__dirname, 'public')));
  app.use(express.static(join(process.cwd(), 'apps/server/public')));

  // Configuración de Nunjucks
  const candidateViewPaths = [
    join(__dirname, 'views'),
    join(__dirname, '../../src/views'),
    join(process.cwd(), 'apps/server/src/views'),
  ];
  const viewsPath = candidateViewPaths.find((p) => existsSync(join(p, 'layouts/base.njk'))) || candidateViewPaths[0]!;
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
  app.use(express.json({ limit: '12mb' }));
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
  const candidates = [
    join(__dirname, '../../../data/ve/identificadores.json'),
    join(__dirname, '../../../../data/ve/identificadores.json'),
    join(process.cwd(), 'data/ve/identificadores.json'),
  ];
  const catalogPath = candidates.find((p) => existsSync(p)) || candidates[0]!;
  const idCatalog = parseIdCatalog(JSON.parse(readFileSync(catalogPath, 'utf8')));

  // Guard de instalación: redirigir a /install si la instancia no está configurada
  app.use(async (req: Request, res: Response, next) => {
    if (req.path.startsWith('/health') || req.path.startsWith('/install') || req.path.startsWith('/verificar') || req.path.startsWith('/public')) {
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
    const positions = (await repos.positions.list()).filter((p) => p.activo);
    const orgUnits = await repos.orgUnits.list();
    const bancos = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'data', 've', 'bancos.json'), 'utf-8'),
    ).instituciones as Array<{ codigo: string; nombre: string; sector: string }>;
    const condiciones = JSON.parse(
      readFileSync(join(__dirname, '..', '..', '..', 'data', 'piloto-idanz', 'condiciones-laborales.json'), 'utf-8'),
    ).condiciones as Array<{ etiqueta: string; tipo_personal: string }>;
    res.render('workers/new.njk', {
      pageTitle: 'Nuevo Trabajador — TalentoVe',
      territories,
      positions,
      orgUnits,
      bancos,
      condiciones,
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
      positionId,
      orgUnitId,
      sector,
      tipoContrato,
      fechaIngreso,
      fechaIngresoApn,
      fechaFin,
      condicionLaboral,
      gradoInstruccion,
      salario,
      moneda,
      bancoCodigo,
      bancoNombre,
      tipoCuenta,
      numeroCuenta,
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

    // 1. Obtener o crear Unidad (select del organigrama; texto libre como respaldo)
    const allUnits = await repos.orgUnits.list();
    let orgUnit = orgUnitId
      ? allUnits.find((u) => u.id === String(orgUnitId))
      : allUnits.find((u) => u.name.toLowerCase() === String(unidad ?? '').toLowerCase().trim());
    if (!orgUnit) {
      orgUnit = await repos.orgUnits.create({
        name: String(unidad ?? unidad === undefined ? 'Unidad sin asignar' : String(unidad).trim()),
        typeId: 4,
      });
    }

    // 2. Obtener o crear Cargo (select del nomenclador; texto libre como respaldo)
    let position = positionId
      ? (await repos.positions.list()).find((p) => p.id === Number(positionId))
      : await repos.positions.findByName(String(cargo ?? ''));
    if (!position) {
      position = await repos.positions.create({
        name: String(cargo ?? '').trim() || 'Cargo sin asignar',
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
      ...(gradoInstruccion && String(gradoInstruccion).trim() !== ''
        ? { gradoInstruccion: String(gradoInstruccion) as 'BACH' | 'TSU' | 'PROF' | 'ESPEC' | 'MGS' | 'DOCT' }
        : {}),
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
      ...(fechaIngresoApn && String(fechaIngresoApn).trim() !== ''
        ? { fechaIngresoApn: String(fechaIngresoApn) }
        : {}),
      ...(fechaFin && String(fechaFin).trim() !== '' ? { fechaFin: String(fechaFin) } : {}),
      ...(condicionLaboral && String(condicionLaboral).trim() !== ''
        ? { condicionLaboral: String(condicionLaboral) }
        : {}),
      salarioBase: String(salario).trim(),
      currency: (moneda as any) || 'VES',
      jornadaHoras: 8.0,
      activo: true,
    });

    // 5. Cuenta bancaria para pago de nómina (opcional)
    if (repos.bankAccounts && bancoCodigo && numeroCuenta && String(numeroCuenta).trim() !== '') {
      await repos.bankAccounts.create({
        employeeId: emp.id,
        bancoCodigo: String(bancoCodigo),
        bancoNombre: String(bancoNombre ?? bancoCodigo),
        tipo: (tipoCuenta as 'corriente' | 'ahorro' | 'pago_movil') || 'corriente',
        numero: String(numeroCuenta).trim(),
        esPrincipal: true,
      });
    }

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
    const bankAccounts = repos.bankAccounts ? await repos.bankAccounts.listByEmployeeId(employee.id) : [];
    const dependentDocs = inMemoryDocuments.filter((d) => d.workerId === employee.id && d.dependentId);
    const workerDocs = inMemoryDocuments
      .filter((d) => d.workerId === employee.id && !d.dependentId)
      .map((d) => ({ ...d, metadataParsed: d.metadata ? JSON.parse(d.metadata) : {} }));
    const requeridosPorGrado: Record<string, string> = {
      BACH: 'titulo_bachiller', TSU: 'titulo_tsu', PROF: 'titulo_universitario',
      ESPEC: 'titulo_especializacion', MGS: 'titulo_maestria', DOCT: 'titulo_doctorado',
    };
    const requeridos = ['cedula_identidad', 'certificado_medico', 'notificacion_riesgos'];
    const tituloSegunGrado = requeridosPorGrado[employee.gradoInstruccion ?? ''];
    if (tituloSegunGrado) requeridos.push(tituloSegunGrado);

    res.render('workers/show.njk', {
      pageTitle: `Expediente: ${employee.nombres} ${employee.apellidos} — TalentoVe`,
      employee,
      activeContract,
      position,
      orgUnit,
      territory,
      dependents,
      movements,
      bankAccounts,
      dependentDocs,
      workerDocs,
      docTypes: docTypesCatalog,
      requeridos,
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

  // Adjuntar documento probatorio del TRABAJADOR (títulos, cursos, cédula, médico...) con metadatos
  app.post('/api/trabajadores/:workerId/documentos', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const workerId = String(req.params.workerId ?? '');
    const { fileName, mimeType, dataBase64, tipoDoc, metadata } = req.body as {
      fileName?: string; mimeType?: string; dataBase64?: string; tipoDoc?: string; metadata?: Record<string, string>;
    };

    if (!fileName || !mimeType || !dataBase64 || !tipoDoc) {
      return res.status(400).json({ success: false, error: 'Datos incompletos.' });
    }
    if (!['image/jpeg', 'application/pdf'].includes(mimeType)) {
      return res.status(400).json({ success: false, error: 'Formato no permitido: solo JPG o PDF.' });
    }

    const buffer = Buffer.from(String(dataBase64), 'base64');
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Archivo vacío o mayor a 5 MB.' });
    }
    const esJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const esPdf = buffer.subarray(0, 4).toString('latin1') === '%PDF';
    if (!esJpg && !esPdf) {
      return res.status(400).json({ success: false, error: 'El contenido no es un JPG ni un PDF válido.' });
    }

    const employee = await repos.employees.findById(workerId);
    if (!employee) {
      return res.status(404).json({ success: false, error: 'Trabajador no encontrado.' });
    }

    const tipoDef = docTypesCatalog.find((t) => t.id === String(tipoDoc));
    if (!tipoDef) {
      return res.status(400).json({ success: false, error: 'Tipo de documento desconocido.' });
    }

    const uploadDir = resolve(env.STORAGE_LOCAL_PATH);
    await mkdir(uploadDir, { recursive: true });
    const ext = esPdf ? 'pdf' : 'jpg';
    const storagePath = join(uploadDir, `worker-${workerId}-${tipoDef.id}-${Date.now()}.${ext}`);
    await writeFile(storagePath, buffer);

    const doc: DigitalDocumentItem = {
      id: `doc-${randomUUID().slice(0, 8)}`,
      workerId,
      tipoDoc: tipoDef.id,
      name: `${tipoDef.id}_${workerId.slice(0, 8)}.${ext}`,
      fileName: String(fileName),
      mimeType,
      sizeBytes: buffer.length,
      storagePath,
      type: tipoDef.nombre,
      date: new Date().toISOString().slice(0, 10),
      size: `${(buffer.length / 1024).toFixed(0)} KB`,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    };
    inMemoryDocuments.push(doc);
    return res.json({ success: true, data: { id: doc.id, name: doc.fileName, size: doc.size } });
  });

  // Adjuntar documento de un dependiente (partida de nacimiento / acta de matrimonio / certificado CONAPDIS)
  app.post('/api/trabajadores/:workerId/cargas/:cargaId/documentos', requireAuth, csrfProtection, async (req: Request, res: Response) => {
    const workerId = String(req.params.workerId ?? '');
    const cargaId = String(req.params.cargaId ?? '');
    const { fileName, mimeType, dataBase64, tipoDoc } = req.body as {
      fileName?: string; mimeType?: string; dataBase64?: string; tipoDoc?: string;
    };

    if (!fileName || !mimeType || !dataBase64) {
      return res.status(400).json({ success: false, error: 'Datos incompletos.' });
    }
    if (!['image/jpeg', 'application/pdf'].includes(mimeType)) {
      return res.status(400).json({ success: false, error: 'Formato no permitido: solo JPG o PDF.' });
    }

    const buffer = Buffer.from(String(dataBase64), 'base64');
    if (buffer.length === 0 || buffer.length > 5 * 1024 * 1024) {
      return res.status(400).json({ success: false, error: 'Archivo vacío o mayor a 5 MB.' });
    }
    const esJpg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    const esPdf = buffer.subarray(0, 4).toString('latin1') === '%PDF';
    if (!esJpg && !esPdf) {
      return res.status(400).json({ success: false, error: 'El contenido no es un JPG ni un PDF válido.' });
    }

    const deps = await repos.dependents.listByEmployeeId(workerId);
    const dep = deps.find((d) => d.id === cargaId);
    if (!dep) {
      return res.status(404).json({ success: false, error: 'Dependiente no encontrado.' });
    }

    const uploadDir = resolve(env.STORAGE_LOCAL_PATH);
    await mkdir(uploadDir, { recursive: true });
    const ext = esPdf ? 'pdf' : 'jpg';
    const storagePath = join(uploadDir, `dep-${cargaId}-${Date.now()}.${ext}`);
    await writeFile(storagePath, buffer);

    const doc: DigitalDocumentItem = {
      id: `doc-${randomUUID().slice(0, 8)}`,
      workerId,
      dependentId: cargaId,
      tipoDoc: String(tipoDoc || 'Documento del dependiente'),
      name: `${String(tipoDoc || 'Documento').replace(/\s+/g, '_')}_${cargaId.slice(0, 8)}.${ext}`,
      fileName: String(fileName),
      mimeType,
      sizeBytes: buffer.length,
      storagePath,
      type: 'Documento de Carga Familiar',
      date: new Date().toISOString().slice(0, 10),
      size: `${(buffer.length / 1024).toFixed(0)} KB`,
    };
    inMemoryDocuments.push(doc);
    return res.json({ success: true, data: { id: doc.id, name: doc.fileName, size: doc.size } });
  });

  // Ver documento adjunto de dependiente
  app.get('/documentos/:docId/ver', requireAuth, (req: Request, res: Response) => {
    const doc = inMemoryDocuments.find((d) => d.id === String(req.params.docId));
    if (!doc || !doc.storagePath || !existsSync(doc.storagePath)) {
      return res.status(404).send('Documento no encontrado');
    }
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${doc.fileName || doc.name}"`);
    res.sendFile(resolve(doc.storagePath));
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

  // 12b. Verificación Pública de Credencial Laboral con QR (Sin Auth) - Hito M2c
  app.get('/verificar/carnet/:token', async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const result = await credentialService.verifyCredential(token);
    const workerData = result.employee ? {
      firstName: result.employee.nombres,
      lastName: result.employee.apellidos,
      cedula: `${result.employee.cedulaTipo}-${result.employee.cedulaNumero}`,
      position: 'Personal Activo',
      departmentId: 'Sede Principal',
      hireDate: result.employee.createdAt.slice(0, 10),
    } : undefined;

    res.render('credential/verify.njk', {
      valid: result.valid,
      reason: result.reason,
      credential: result.credential,
      worker: workerData,
    });
  });

  // 12c. Endpoint Público de Credencial Laboral con QR (Inspirado en Invio /public/)
  app.get('/public/credencial/:token', async (req: Request, res: Response) => {
    const token = String(req.params.token);
    const result = await credentialService.verifyCredential(token);
    const settings = await repos.settings.getSettings();

    if (!result.valid || !result.employee) {
      return res.status(404).render('credential/verify.njk', {
        valid: false,
        reason: result.reason || 'Credencial laboral no encontrada o revocada.',
      });
    }

    res.render('public/credential.njk', {
      institutionName: settings?.companyName || 'REPÚBLICA BOLIVARIANA DE VENEZUELA',
      worker: {
        nombres: result.employee.nombres,
        apellidos: result.employee.apellidos,
        cedulaTipo: result.employee.cedulaTipo,
        cedulaNumero: result.employee.cedulaNumero,
        cargo: 'Funcionario / Personal Activo',
        departamento: 'Sede Principal',
        fechaIngreso: result.employee.createdAt.slice(0, 10),
        status: 'ACTIVO',
      },
      verificationHash: token.length > 32 ? token.slice(0, 32) : token,
    });
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

  // =========================================================================
  // Hito M2c: Carnetización Digital CR-80
  // =========================================================================
  app.get('/trabajadores/:id/carnet', requireAuth, async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const employee = await repos.employees.findById(id);
    if (!employee) {
      return res.status(404).send('Trabajador no encontrado');
    }

    const protocol = req.protocol || 'http';
    const host = req.get('host') || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const credDetails = await credentialService.issueOrGetCredential({
      employeeId: employee.id,
      baseUrl,
    });

    const activeContract = await repos.contracts.findActiveByEmployeeId(employee.id);
    const position = activeContract?.positionId ? (await repos.positions.list()).find((p) => p.id === activeContract.positionId) : null;
    const orgUnit = activeContract?.orgUnitId ? await repos.orgUnits.findById(activeContract.orgUnitId) : null;

    res.render('workers/credential.njk', {
      pageTitle: `Carnet Digital — ${employee.nombres} ${employee.apellidos}`,
      worker: {
        id: employee.id,
        firstName: employee.nombres,
        lastName: employee.apellidos,
        cedula: `${employee.cedulaTipo}-${employee.cedulaNumero}`,
        position: position?.name || 'Empleado General',
        departmentId: orgUnit?.name || 'Dirección General',
        status: employee.status.toUpperCase(),
      },
      credential: credDetails.credential,
      qrDataUrl: credDetails.qrDataUrl,
      verificationUrl: credDetails.verificationUrl,
    });
  });

  // =========================================================================
  // Hito M2b: Nómina LOTTT & APN (Lotes, Recibos y Snapshots Inmutables)
  // =========================================================================
  app.get('/nomina', requireAuth, async (_req: Request, res: Response) => {
    const batches = await payrollService.listBatches();
    res.render('payroll/index.njk', {
      pageTitle: 'Nómina LOTTT & APN — TalentoVe',
      batches,
    });
  });

  app.get('/nomina/nueva', requireAuth, async (_req: Request, res: Response) => {
    res.render('payroll/new.njk', {
      pageTitle: 'Ejecutar Cálculo de Nómina — TalentoVe',
    });
  });

  app.post('/nomina/procesar', requireAuth, async (req: Request, res: Response) => {
    const { periodStart, periodEnd, periodType, minimumWageVES } = req.body;
    if (!periodStart || !periodEnd) {
      return res.status(400).send('Período de inicio y fin son obligatorios.');
    }

    const pType = periodType === 'MONTHLY' ? 'mensual' : 'primera_quincena';
    const result = await payrollService.processPayroll({
      periodStart: String(periodStart),
      periodEnd: String(periodEnd),
      periodType: pType,
      minimumWageVES: minimumWageVES ? String(minimumWageVES) : '130.00',
      processedBy: req.user?.fullName || 'Analista de Nómina',
    });

    res.redirect(`/nomina/${result.batch.id}`);
  });

  app.get('/nomina/:id', requireAuth, async (req: Request, res: Response) => {
    const batchId = String(req.params.id);
    const batch = await payrollService.getBatchById(batchId);
    if (!batch) {
      return res.status(404).send('Lote de nómina no encontrado.');
    }

    const receipts = await payrollService.listReceiptsByBatch(batchId);
    const employees = await repos.employees.list();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const formattedReceipts = receipts.map((r) => {
      const parsedSnapshot = JSON.parse(r.snapshot);
      const emp = empMap.get(r.employeeId);
      return {
        ...r,
        workerCedula: emp ? `${emp.cedulaTipo}-${emp.cedulaNumero}` : 'V-00000000',
        workerFullName: emp ? `${emp.nombres} ${emp.apellidos}` : 'Trabajador',
        workerId: r.employeeId,
        jobTitle: parsedSnapshot.snapshot?.positionName || 'Empleado',
        departmentName: parsedSnapshot.snapshot?.departmentName || 'Dirección General',
        snapshot: parsedSnapshot,
      };
    });

    res.render('payroll/show.njk', {
      pageTitle: `Nómina ${batch.startDate} al ${batch.endDate} — TalentoVe`,
      batch: {
        ...batch,
        periodStart: batch.startDate,
        periodEnd: batch.endDate,
        totalWorkers: receipts.length,
        totalGross: batch.totalEarnings.toFixed(2),
        totalDeductions: batch.totalDeductions.toFixed(2),
        totalNet: batch.totalNet.toFixed(2),
        createdBy: batch.processedBy || 'Analista de Nómina',
      },
      receipts: formattedReceipts,
    });
  });

  app.get('/nomina/recibos/:id', requireAuth, async (req: Request, res: Response) => {
    const receiptId = String(req.params.id);
    const receiptRecord = await payrollService.getReceiptById(receiptId);
    if (!receiptRecord) {
      return res.status(404).send('Recibo de pago no encontrado.');
    }

    const parsed = JSON.parse(receiptRecord.snapshot);
    const settings = await repos.settings.getSettings();
    const snap = parsed.snapshot || {};

    const asignaciones = [
      { concepto: 'Sueldo Base Quincenal', monto: Number(snap.sueldoBaseQuincenal || 0).toFixed(2) },
      { concepto: 'Prima de Antigüedad', monto: Number(snap.primaAntiguedad || 0).toFixed(2) },
      { concepto: 'Prima por Hijos / Carga Familiar', monto: Number(snap.primaHijos || 0).toFixed(2) },
    ].filter(a => Number(a.monto) > 0);

    const deducciones = [
      { concepto: 'Seguro Social Obligatorio (IVSS 4%)', monto: Number(snap.ivss || 0).toFixed(2) },
      { concepto: 'Fondo Ahorro Obligatorio Vivienda (FAOV 1%)', monto: Number(snap.faov || 0).toFixed(2) },
      { concepto: 'Seguro de Paro Forzoso (SPF 0.5%)', monto: Number(snap.spf || 0).toFixed(2) },
    ].filter(d => Number(d.monto) > 0);

    res.render('payroll/payslip-a4.njk', {
      institutionName: settings?.companyName || 'REPÚBLICA BOLIVARIANA DE VENEZUELA',
      institutionRif: settings?.nativeId || 'G-20000000-0',
      periodStart: parsed.period?.start || snap.periodoDesde || '01/10/2026',
      periodEnd: parsed.period?.end || snap.periodoHasta || '15/10/2026',
      worker: {
        nombres: snap.nombres || 'Trabajador',
        apellidos: snap.apellidos || '',
        cedulaTipo: (snap.cedula || 'V-0').split('-')[0] || 'V',
        cedulaNumero: (snap.cedula || 'V-0').split('-')[1] || snap.cedula || '0',
        cargo: snap.cargo || 'Analista',
        departamento: snap.departamento || 'Sede Principal',
        fechaIngreso: snap.fechaIngreso || '01/01/2024',
        cuentaBancaria: snap.cuentaBancaria || '0102-****-****-****',
      },
      asignaciones,
      deducciones,
      totalAsignaciones: Number(parsed.totalEarnings || snap.totalAsignaciones || 0).toFixed(2),
      totalDeducciones: Number(parsed.totalDeductions || snap.totalDeducciones || 0).toFixed(2),
      totalNeto: Number(parsed.netPay || snap.netoPagar || 0).toFixed(2),
    });
  });

  app.get('/nomina/recibos/:id/pdf', requireAuth, async (req: Request, res: Response) => {
    const receiptId = String(req.params.id);
    const receiptRecord = await payrollService.getReceiptById(receiptId);
    if (!receiptRecord) {
      return res.status(404).send('Recibo de pago no encontrado.');
    }

    const parsedSnapshot = JSON.parse(receiptRecord.snapshot);
    const settings = await repos.settings.getSettings();
    const pdfBuffer = await generatePayrollReceiptPdf({
      companyName: settings?.companyName || 'REPÚBLICA BOLIVARIANA DE VENEZUELA',
      nativeId: settings?.nativeId || 'G-20000000-0',
      instanceName: settings?.instanceName || 'TalentoVe',
      receipt: parsedSnapshot,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="recibo-${parsedSnapshot.snapshot?.cedula || 'recibo'}-${receiptRecord.id}.pdf"`
    );
    res.send(pdfBuffer);
  });

  // =========================================================================
  // Hito M3: Calendario Nacional y Feriados
  // =========================================================================
  app.get('/feriados', requireAuth, async (_req: Request, res: Response) => {
    const holidays = await repos.holidays.list();
    res.render('holidays/index.njk', {
      pageTitle: 'Calendario Nacional y Feriados — TalentoVe',
      holidays,
    });
  });

  app.post('/feriados', requireAuth, async (req: Request, res: Response) => {
    const { date, name, type } = req.body;
    if (date && name) {
      await repos.holidays.create({
        date: String(date),
        name: String(name),
        type: (type as any) || 'decreto',
        isWorkingDay: false,
        payRateMultiplier: 1.5,
      });
    }
    res.redirect('/feriados');
  });

  // =========================================================================
  // Hito M4: Portal de Autoservicio del Trabajador
  // =========================================================================
  // =========================================================================
  // Hito M4: Portal de Autoservicio del Trabajador
  // =========================================================================
  app.get('/mi-portal', requireAuth, async (req: Request, res: Response) => {
    const employees = await repos.employees.list();
    const activeEmployees = employees.filter((e) => e.status === 'activo');
    const workerIdQuery = typeof req.query.workerId === 'string' ? req.query.workerId : '';
    const selectedEmployee = workerIdQuery
      ? (activeEmployees.find((e) => e.id === workerIdQuery) || activeEmployees[0])
      : activeEmployees[0];

    if (!selectedEmployee) {
      return res.render('portal/index.njk', {
        pageTitle: 'Portal del Trabajador — TalentoVe',
        worker: { id: '0', nombres: 'Usuario', apellidos: '', cedulaTipo: 'V', cedulaNumero: '0' },
        vacationBalance: { daysAvailable: 15, yearsOfService: 1, entitlementDays: 15 },
        latestReceipt: { netPay: '0.00', periodName: 'Sin emitir' },
        pendingRequestsCount: 0,
        receipts: [],
        requests: [],
      });
    }

    // Calcular balance de vacaciones con IceHrmServices
    const yearsOfService = Math.max(1, new Date().getFullYear() - new Date(selectedEmployee.createdAt).getFullYear());
    const vacationBalance = IceHrmServices.getVacationBalance(selectedEmployee.id, yearsOfService, 0, 0);

    // Obtener recibos del trabajador
    const rawReceipts = await payrollService.listReceiptsByWorker(selectedEmployee.id);
    const receipts = rawReceipts.map((r) => {
      const snap = JSON.parse(r.snapshot);
      return {
        id: r.id,
        periodName: snap.period?.periodName || 'Nómina Quincenal',
        date: r.createdAt.slice(0, 10),
        netPay: r.netPay.toFixed(2),
        totalEarnings: r.totalEarnings.toFixed(2),
        totalDeductions: r.totalDeductions.toFixed(2),
      };
    });

    // Obtener solicitudes del trabajador
    const allRequests = await repos.requests.list();
    const workerRequests = allRequests.filter((r) => r.employeeId === selectedEmployee.id);
    const pendingRequestsCount = workerRequests.filter((r) => r.estatus === 'pendiente').length;

    res.render('portal/index.njk', {
      pageTitle: 'Portal de Autoservicio — TalentoVe',
      worker: selectedEmployee,
      vacationBalance,
      latestReceipt: receipts[0] || { netPay: '0.00', periodName: 'Sin emitir' },
      pendingRequestsCount,
      receipts,
      requests: workerRequests,
    });
  });

  app.get('/mi-portal/recibos', requireAuth, async (req: Request, res: Response) => {
    const employees = await repos.employees.list();
    const selectedEmployee = employees[0];
    if (!selectedEmployee) return res.redirect('/mi-portal');

    const rawReceipts = await payrollService.listReceiptsByWorker(selectedEmployee.id);
    const receipts = rawReceipts.map((r) => {
      const snap = JSON.parse(r.snapshot);
      return {
        id: r.id,
        periodName: snap.period?.periodName || 'Nómina Quincenal',
        date: r.createdAt.slice(0, 10),
        netPay: r.netPay.toFixed(2),
        totalEarnings: r.totalEarnings.toFixed(2),
        totalDeductions: r.totalDeductions.toFixed(2),
      };
    });

    res.render('portal/receipts.njk', {
      pageTitle: 'Historial de Recibos — TalentoVe',
      worker: selectedEmployee,
      receipts,
    });
  });

  app.get('/mi-portal/solicitudes', requireAuth, async (req: Request, res: Response) => {
    const employees = await repos.employees.list();
    const selectedEmployee = employees[0];
    if (!selectedEmployee) return res.redirect('/mi-portal');

    const allRequests = await repos.requests.list();
    const requests = allRequests.filter((r) => r.employeeId === selectedEmployee.id);

    res.render('portal/requests.njk', {
      pageTitle: 'Historial de Solicitudes — TalentoVe',
      worker: selectedEmployee,
      requests,
    });
  });

  app.post('/mi-portal/solicitar', requireAuth, async (req: Request, res: Response) => {
    const { workerId, requestType, startDate, endDate, reason, notes } = req.body;
    const employeeId = String(workerId || (await repos.employees.list())[0]?.id || '1');

    let tipo: RequestType = 'vacaciones';
    const reqTypeStr = String(requestType || '').toLowerCase();
    if (reqTypeStr.includes('prestaciones') || reqTypeStr.includes('anticipo') || reqTypeStr.includes('adelanto')) {
      tipo = 'adelanto_prestaciones';
    } else if (reqTypeStr.includes('permiso') || reqTypeStr.includes('medico') || reqTypeStr.includes('paternidad') || reqTypeStr.includes('duelo')) {
      tipo = 'permiso';
    } else if (reqTypeStr.includes('constancia')) {
      tipo = 'constancia_trabajo';
    }

    await repos.requests.create({
      employeeId,
      tipo,
      estatus: 'pendiente',
      fechaDesde: String(startDate || new Date().toISOString().slice(0, 10)),
      fechaHasta: String(endDate || new Date().toISOString().slice(0, 10)),
      motivo: String(reason || notes || 'Solicitud generada desde el portal de autoservicio'),
    });

    if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
      return res.json({ success: true, message: 'Solicitud registrada exitosamente' });
    }
    res.redirect('/mi-portal');
  });

  app.post('/mi-portal/vacaciones', requireAuth, async (req: Request, res: Response) => {
    const { workerId, startDate, endDate, notes, reason } = req.body;
    const employeeId = String(workerId || (await repos.employees.list())[0]?.id || '1');

    await repos.requests.create({
      employeeId,
      tipo: 'vacaciones',
      estatus: 'pendiente',
      fechaDesde: String(startDate || new Date().toISOString().slice(0, 10)),
      fechaHasta: String(endDate || new Date().toISOString().slice(0, 10)),
      motivo: String(notes || reason || 'Vacaciones anuales reglamentarias'),
    });

    res.redirect('/mi-portal');
  });

  // =========================================================================
  // Bandeja de Aprobaciones para RRHH y Supervisores
  // =========================================================================
  app.get('/aprobaciones', requireAuth, async (_req: Request, res: Response) => {
    const allRequests = await repos.requests.list();
    const employees = await repos.employees.list();
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const pendingRequests = allRequests
      .filter((r) => r.estatus === 'pendiente')
      .map((r) => {
        const emp = empMap.get(r.employeeId);
        return {
          id: r.id,
          workerName: emp ? `${emp.nombres} ${emp.apellidos}` : 'Trabajador',
          workerCedula: emp ? `${emp.cedulaTipo}-${emp.cedulaNumero}` : 'V-000000',
          workerDepartment: 'Sede Principal',
          tipo: r.tipo.toUpperCase(),
          fechaDesde: r.fechaDesde,
          fechaHasta: r.fechaHasta,
          motivo: r.motivo,
          montoSolicitado: r.montoSolicitado,
          diasSolicitados: r.diasSolicitados,
          createdAt: r.createdAt.slice(0, 10),
        };
      });

    const pendingCount = pendingRequests.length;
    const approvedCount = allRequests.filter((r) => r.estatus === 'aprobada').length;
    const rejectedCount = allRequests.filter((r) => r.estatus === 'rechazada').length;

    res.render('approvals/index.njk', {
      pageTitle: 'Bandeja de Aprobaciones — TalentoVe',
      pendingRequests,
      pendingCount,
      approvedCount,
      rejectedCount,
    });
  });

  app.post('/aprobaciones/:id/aprobar', requireAuth, async (req: Request, res: Response) => {
    const requestId = String(req.params.id);
    await repos.requests.updateStatus(requestId, 'aprobada');
    res.redirect('/aprobaciones');
  });

  app.post('/aprobaciones/:id/rechazar', requireAuth, async (req: Request, res: Response) => {
    const requestId = String(req.params.id);
    await repos.requests.updateStatus(requestId, 'rechazada');
    res.redirect('/aprobaciones');
  });

  // =========================================================================
  // API Sincronización Offline-First con Dexie.js
  // =========================================================================
  app.get('/api/sync/bootstrap', requireAuth, async (_req: Request, res: Response) => {
    const employees = await repos.employees.list();
    const workers = employees.map((e) => ({
      id: e.id,
      cedula: `${e.cedulaTipo}-${e.cedulaNumero}`,
      fullName: `${e.nombres} ${e.apellidos}`,
      departmentId: 'Sede Principal',
      position: 'Personal Activo',
    }));
    res.json({ success: true, workers, timestamp: new Date().toISOString() });
  });

  app.post('/api/sync/batch', requireAuth, async (req: Request, res: Response) => {
    const { operations } = req.body;
    res.json({ success: true, processed: Array.isArray(operations) ? operations.length : 0 });
  });

  // --- DISPERSIÓN BANCARIA ---
  app.get('/nomina/:id/bancos', requireAuth, async (req: Request, res: Response) => {
    const runId = String(req.params.id);
    const run = await repos.payroll.findBatchById(runId);
    if (!run) return res.status(404).render('errors/404.njk', { message: 'Lote de nómina no encontrado' });
    const bankFiles = await bankingService.getBankFilesForRun(runId);
    res.render('payroll/banking.njk', {
      pageTitle: 'Dispersión Bancaria — TalentoVe',
      batch: {
        id: run.id,
        periodStart: run.startDate,
        periodEnd: run.endDate,
        totalNet: run.totalNet.toFixed(2),
      },
      bankFiles,
      success: req.query.success,
    });
  });

  app.post('/nomina/:id/bancos/generar', requireAuth, async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const bankCode = req.body.bankCode as VenezuelanBankCode;
      await bankingService.generatePayrollBankFile(runId, bankCode);
      res.redirect(`/nomina/${runId}/bancos?success=Archivo+bancario+generado+exitosamente`);
    } catch (err: any) {
      res.status(400).render('errors/500.njk', { message: err?.message || 'Error al generar archivo bancario' });
    }
  });

  app.get('/nomina/bancos/descargar/:fileId', requireAuth, async (req: Request, res: Response) => {
    const fileId = String(req.params.fileId);
    const file = await bankingService.getBankFileById(fileId);
    if (!file) return res.status(404).send('Archivo no encontrado');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${file.fileName}"`);
    res.send(file.content);
  });

  // --- ARCHIVOS PARAFISCALES ---
  app.get('/nomina/:id/parafiscales', requireAuth, async (req: Request, res: Response) => {
    const runId = String(req.params.id);
    const run = await repos.payroll.findBatchById(runId);
    if (!run) return res.status(404).render('errors/404.njk', { message: 'Lote de nómina no encontrado' });
    const receipts = await repos.payroll.listReceiptsByBatchId(runId);
    res.render('payroll/parafiscal.njk', {
      pageTitle: 'Archivos Parafiscales — TalentoVe',
      batch: {
        id: run.id,
        periodStart: run.startDate,
        periodEnd: run.endDate,
        totalWorkers: receipts.length,
      },
    });
  });

  app.get('/nomina/:id/parafiscales/ivss', requireAuth, async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const result = await parafiscalService.generateIvssFile(runId);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.content);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error al generar archivo TIUNA');
    }
  });

  app.get('/nomina/:id/parafiscales/faov', requireAuth, async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const result = await parafiscalService.generateFaovFile(runId);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
      res.send(result.content);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error al generar archivo FAOV');
    }
  });

  app.get('/nomina/:id/parafiscales/inces', requireAuth, async (req: Request, res: Response) => {
    try {
      const runId = String(req.params.id);
      const report = await parafiscalService.generateIncesReport(runId);
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${report.fileName}"`);
      res.send(report.content);
    } catch (err: any) {
      res.status(500).send(err?.message || 'Error al generar informe INCES');
    }
  });

  // --- LOPCYMAT SST (NOTIFICACIÓN DE RIESGOS) ---
  app.get('/trabajadores/:id/riesgos-lopcymat', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const employee = await repos.employees.findById(empId);
    if (!employee) return res.status(404).render('errors/404.njk', { message: 'Trabajador no encontrado' });

    const notification = await sstService.getOrCreateNotificationForEmployee(employee.id);
    res.render('workers/sst-risks.njk', {
      pageTitle: 'Notificación de Riesgos LOPCYMAT — TalentoVe',
      employee,
      notification,
      success: req.query.success,
    });
  });

  app.post('/trabajadores/:id/riesgos-lopcymat/reconocer', requireAuth, async (req: Request, res: Response) => {
    const { notificationId } = req.body;
    await sstService.acknowledgeNotification(String(notificationId));
    res.redirect(`/trabajadores/${String(req.params.id)}/riesgos-lopcymat?success=Notificaci%C3%B3n+reconocida+y+firmada+exitosamente`);
  });

  app.get('/trabajadores/:id/riesgos-lopcymat/pdf', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const employee = await repos.employees.findById(empId);
    if (!employee) return res.status(404).send('Trabajador no encontrado');
    const notification = await sstService.getOrCreateNotificationForEmployee(employee.id);
    const pdfBuffer = await sstService.generatePdf(notification.id);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Notificacion_LOPCYMAT_${employee.cedulaNumero}.pdf"`);
    res.send(pdfBuffer);
  });

  // --- OFFBOARDING & LIQUIDACIÓN LOTTT ART. 142 ---
  app.get('/trabajadores/:id/liquidacion', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const employee = await repos.employees.findById(empId);
    if (!employee) return res.status(404).render('errors/404.njk', { message: 'Trabajador no encontrado' });
    const contract = await repos.contracts.findByEmployeeId(employee.id);

    const todayIso = new Date().toISOString().slice(0, 10);
    res.render('workers/liquidation.njk', {
      pageTitle: 'Liquidación LOTTT Art. 142 — TalentoVe',
      employee,
      contract: contract || { fechaIngreso: employee.createdAt.slice(0, 10), salarioBase: '130' },
      todayIso,
      params: {
        terminationDate: todayIso,
        reason: 'renuncia_voluntaria',
        unpaidSalaryDays: 0,
        pendingVacationDays: 0,
        otherDeductions: 0,
      },
      calculation: null,
    });
  });

  app.post('/trabajadores/:id/liquidacion/calcular', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const employee = await repos.employees.findById(empId);
    if (!employee) return res.status(404).render('errors/404.njk', { message: 'Trabajador no encontrado' });
    const contract = await repos.contracts.findByEmployeeId(employee.id);

    const params = {
      employeeId: employee.id,
      terminationDate: String(req.body.terminationDate),
      reason: req.body.reason as LiquidationReason,
      unpaidSalaryDays: Number(req.body.unpaidSalaryDays) || 0,
      pendingVacationDays: Number(req.body.pendingVacationDays) || 0,
      otherDeductions: Number(req.body.otherDeductions) || 0,
    };

    const { result } = await offboardingService.computeLiquidation(params);

    res.render('workers/liquidation.njk', {
      pageTitle: 'Liquidación LOTTT Art. 142 — TalentoVe',
      employee,
      contract: contract || { fechaIngreso: employee.createdAt.slice(0, 10), salarioBase: '130' },
      params,
      calculation: result,
    });
  });

  app.post('/trabajadores/:id/liquidacion/finiquito/pdf', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const params = {
      employeeId: empId,
      terminationDate: String(req.body.terminationDate),
      reason: req.body.reason as LiquidationReason,
      unpaidSalaryDays: Number(req.body.unpaidSalaryDays) || 0,
      pendingVacationDays: Number(req.body.pendingVacationDays) || 0,
      otherDeductions: Number(req.body.otherDeductions) || 0,
    };

    const pdfBuffer = await offboardingService.generateSettlementDocument(params);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Finiquito_LOTTT_${empId}.pdf"`);
    res.send(pdfBuffer);
  });

  app.post('/trabajadores/:id/liquidacion/forma14-100/pdf', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const params = {
      employeeId: empId,
      terminationDate: String(req.body.terminationDate),
      reason: req.body.reason as LiquidationReason,
    };

    const pdfBuffer = await offboardingService.generateForma14100Document(params);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Forma_14_100_IVSS_${empId}.pdf"`);
    res.send(pdfBuffer);
  });

  // --- CUSTODIA Y CONTROL DE ACTIVOS ---
  app.get('/trabajadores/:id/activos', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    const employee = await repos.employees.findById(empId);
    if (!employee) return res.status(404).render('errors/404.njk', { message: 'Trabajador no encontrado' });
    const assets = await assetService.listAssetsByEmployee(employee.id);

    res.render('workers/assets.njk', {
      pageTitle: 'Activos Asignados — TalentoVe',
      employee,
      assets,
      success: req.query.success,
    });
  });

  app.post('/trabajadores/:id/activos/asignar', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    await assetService.assignAsset({
      employeeId: empId,
      assetType: req.body.assetType || 'equipo_computo',
      description: String(req.body.description),
      serialNumber: req.body.serialNumber ? String(req.body.serialNumber) : undefined,
    });
    res.redirect(`/trabajadores/${empId}/activos?success=Activo+asignado+correctamente`);
  });

  app.post('/trabajadores/:id/activos/:assetId/devolver', requireAuth, async (req: Request, res: Response) => {
    const empId = String(req.params.id);
    await assetService.returnAsset({
      assetId: String(req.params.assetId),
    });
    res.redirect(`/trabajadores/${empId}/activos?success=Activo+marcado+como+devuelto`);
  });

  // =========================================================================
  // MÓDULOS Y FORMULARIOS ADAPTADOS DE QRH (ESTRUCTURA, EXPEDIENTES, PERFIL)
  // =========================================================================

  interface LocationItem {
    id: string;
    name: string;
    territoryId: number;
    territoryName?: string | undefined;
    municipio?: string | undefined;
    direccion?: string | undefined;
    createdAt: string;
  }

  // Ubicaciones físicas del piloto IDANZ (sedes deportivas del estado; Anzoátegui = VE-B, id 2)
  const inMemoryLocations: LocationItem[] = [
    {
      id: 'loc-001',
      name: 'Sede Administrativa IDANZ (Barcelona)',
      territoryId: 2,
      territoryName: 'Anzoátegui',
      municipio: 'Simón Bolívar',
      direccion: 'Av. 5 de Julio, Edif. Sede IDANZ, Piso 2, Barcelona',
      createdAt: '2026-01-01',
    },
    {
      id: 'loc-002',
      name: 'Estadio La Caraqueña',
      territoryId: 2,
      territoryName: 'Anzoátegui',
      municipio: 'Simón Bolívar',
      direccion: 'Av. Municipal, Sector El Paraíso, Barcelona',
      createdAt: '2026-02-15',
    },
    {
      id: 'loc-003',
      name: 'Estadio Venezuela',
      territoryId: 2,
      territoryName: 'Anzoátegui',
      municipio: 'Simón Bolívar',
      direccion: 'Av. Amante Marcano, Barcelona',
      createdAt: '2026-03-01',
    },
    {
      id: 'loc-004',
      name: 'Complejo Deportivo Cantaura',
      territoryId: 2,
      territoryName: 'Anzoátegui',
      municipio: 'Pedro María Freites',
      direccion: 'Sector La Cruz, Cantaura',
      createdAt: '2026-03-20',
    },
    {
      id: 'loc-005',
      name: 'Gimnasio de Disciplinas Puerto La Cruz',
      territoryId: 2,
      territoryName: 'Anzoátegui',
      municipio: 'Juan Antonio Sotillo',
      direccion: 'Av. Municipal, Puerto La Cruz',
      createdAt: '2026-04-10',
    },
  ];

  interface DigitalDocumentItem {
    id: string;
    workerId: string;
    dependentId?: string | undefined;
    tipoDoc?: string | undefined;
    name: string;
    fileName?: string | undefined;
    mimeType?: string | undefined;
    sizeBytes?: number | undefined;
    storagePath?: string | undefined;
    type: string;
    date: string;
    size: string;
    metadata?: string | undefined;
    downloadUrl?: string | undefined;
  }

  const inMemoryDocuments: DigitalDocumentItem[] = [];

  interface DocumentTypeDef {
    id: string;
    seccion: string;
    nombre: string;
    requerido: string;
    requiere_vencimiento: boolean;
    base_legal: string;
    campos: Array<{ key: string; label: string; tipo: string }>;
  }
  const docTypesCatalog = JSON.parse(
    readFileSync(join(__dirname, '..', '..', '..', 'data', 've', 'tipos-documento.json'), 'utf-8'),
  ).tipos as DocumentTypeDef[];

  // 1. Hub de Gestión de Personal
  app.get('/personal', requireAuth, async (_req: Request, res: Response) => {
    res.render('staff/index.njk', {
      pageTitle: 'Gestión de Personal — TalentoVe',
    });
  });

  // 2. Gestión de Ubicaciones Físicas
  app.get('/ubicaciones', requireAuth, async (req: Request, res: Response) => {
    const territories = await repos.territories.list();
    res.render('staff/locations.njk', {
      pageTitle: 'Gestión de Ubicaciones Físicas — TalentoVe',
      locations: inMemoryLocations,
      territories,
      success: req.query.success,
    });
  });

  app.post('/ubicaciones', requireAuth, async (req: Request, res: Response) => {
    const territoryId = Number(req.body.territoryId) || 1;
    const territory = await repos.territories.findById(territoryId);
    inMemoryLocations.push({
      id: `loc-${Date.now().toString().slice(-4)}`,
      name: String(req.body.name),
      territoryId,
      territoryName: territory?.nombre || 'Distrito Capital',
      municipio: req.body.municipio ? String(req.body.municipio) : undefined,
      direccion: req.body.direccion ? String(req.body.direccion) : undefined,
      createdAt: new Date().toISOString().slice(0, 10),
    });
    res.redirect('/ubicaciones?success=Ubicaci%C3%B3n+f%C3%ADsica+registrada+exitosamente');
  });

  // 3. Gestión de Departamentos
  app.get('/departamentos', requireAuth, async (req: Request, res: Response) => {
    const orgUnits = await repos.orgUnits.list();
    const departments = orgUnits.map((u) => {
      const loc = inMemoryLocations.find((l) => l.id === u.locationId);
      return {
        ...u,
        locationName: loc?.name,
      };
    });

    res.render('staff/departments.njk', {
      pageTitle: 'Gestión de Departamentos — TalentoVe',
      departments,
      locations: inMemoryLocations,
      success: req.query.success,
    });
  });

  app.post('/departamentos', requireAuth, async (req: Request, res: Response) => {
    await repos.orgUnits.create({
      name: String(req.body.name),
      locationId: req.body.locationId ? String(req.body.locationId) : undefined,
      typeId: Number(req.body.typeId) || 3,
    });
    res.redirect('/departamentos?success=Departamento+creado+exitosamente');
  });

  // 4. Gestión de Cargos
  app.get('/cargos', requireAuth, async (req: Request, res: Response) => {
    const positions = await repos.positions.list();
    res.render('staff/positions.njk', {
      pageTitle: 'Gestión de Cargos — TalentoVe',
      positions,
      success: req.query.success,
    });
  });

  app.post('/cargos', requireAuth, async (req: Request, res: Response) => {
    await repos.positions.create({
      name: String(req.body.name),
      categoria: String(req.body.categoria),
      grupoIsco: String(req.body.grupoIsco || '3341'),
      aplicaSector: (req.body.aplicaSector || 'ambos') as 'ambos' | 'publico' | 'privado',
      nivelTabuladorApn: req.body.nivelTabuladorApn ? String(req.body.nivelTabuladorApn) : undefined,
      activo: true,
    });
    res.redirect('/cargos?success=Cargo+creado+exitosamente');
  });

  // 5. Módulo de Búsqueda de Expedientes
  app.get('/expedientes', requireAuth, async (_req: Request, res: Response) => {
    res.redirect('/expedientes/buscar');
  });

  app.get('/expedientes/buscar', requireAuth, async (req: Request, res: Response) => {
    const allWorkers = await repos.employees.list();
    const workerId = req.query.workerId ? String(req.query.workerId) : (allWorkers[0]?.id || null);
    const selectedWorker = workerId ? await repos.employees.findById(workerId) : null;

    // Documentos base predeterminados si no hay ninguno
    if (selectedWorker && inMemoryDocuments.filter((d) => d.workerId === selectedWorker.id).length === 0) {
      inMemoryDocuments.push(
        {
          id: `doc-${randomUUID().slice(0, 8)}`,
          workerId: selectedWorker.id,
          name: `Cedula_${selectedWorker.cedulaNumero}.pdf`,
          type: 'Identificación',
          date: selectedWorker.createdAt.slice(0, 10),
          size: '1.2 MB',
          downloadUrl: `/trabajadores/${selectedWorker.id}/constancia/pdf`,
        },
        {
          id: `doc-${randomUUID().slice(0, 8)}`,
          workerId: selectedWorker.id,
          name: `Contrato_Laboral_${selectedWorker.cedulaNumero}.pdf`,
          type: 'Laboral',
          date: selectedWorker.createdAt.slice(0, 10),
          size: '2.4 MB',
          downloadUrl: `/trabajadores/${selectedWorker.id}/constancia/pdf`,
        },
      );
    }

    const documents = selectedWorker ? inMemoryDocuments.filter((d) => d.workerId === selectedWorker.id) : [];

    res.render('records/search.njk', {
      pageTitle: 'Búsqueda de Expedientes — TalentoVe',
      allWorkers,
      selectedWorker,
      documents,
    });
  });

  // 6. Carga de Documentos al Expediente
  app.get('/expedientes/cargar', requireAuth, async (req: Request, res: Response) => {
    const allWorkers = await repos.employees.list();
    res.render('records/upload.njk', {
      pageTitle: 'Carga de Documentos al Expediente — TalentoVe',
      allWorkers,
      selectedWorkerId: req.query.workerId ? String(req.query.workerId) : undefined,
      success: req.query.success,
    });
  });

  app.post('/expedientes/cargar', requireAuth, async (req: Request, res: Response) => {
    const workerId = String(req.body.workerId);
    const docType = String(req.body.documentType || 'Otro');
    inMemoryDocuments.push({
      id: `doc-${randomUUID().slice(0, 8)}`,
      workerId,
      name: `${docType.replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}.pdf`,
      type: docType,
      date: new Date().toISOString().slice(0, 10),
      size: '1.8 MB',
      metadata: req.body.metadata ? String(req.body.metadata) : undefined,
    });

    res.redirect(`/expedientes/buscar?workerId=${workerId}&success=Documento+cargado+al+expediente+exitosamente`);
  });

  // 7. Perfil de la Institución
  app.get('/institucion', requireAuth, async (_req: Request, res: Response) => {
    const employees = await repos.employees.list();
    const orgUnits = await repos.orgUnits.list();
    const positions = await repos.positions.list();

    const totalWorkers = employees.length;
    const empleadosCount = Math.round(totalWorkers * 0.5) || 5;
    const obrerosCount = Math.round(totalWorkers * 0.3) || 3;
    const especialistasCount = Math.max(1, totalWorkers - empleadosCount - obrerosCount);

    const tenure01 = Math.round(totalWorkers * 0.25) || 2;
    const tenure25 = Math.round(totalWorkers * 0.4) || 4;
    const tenure610 = Math.round(totalWorkers * 0.2) || 2;
    const tenure10plus = Math.max(1, totalWorkers - tenure01 - tenure25 - tenure610);

    res.render('institution/profile.njk', {
      pageTitle: 'Perfil de la Institución — TalentoVe',
      stats: {
        totalWorkers,
        totalLocations: inMemoryLocations.length,
        totalDepartments: orgUnits.length,
        totalPositions: positions.length,
        empleadosCount,
        obrerosCount,
        especialistasCount,
        tenure01,
        tenure25,
        tenure610,
        tenure10plus,
      },
      locations: inMemoryLocations,
    });
  });

  return app;
}

