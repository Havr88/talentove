import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';
import { createMemoryRepositories } from './db/memory-repositories.js';
import { envSchema } from './config/env.js';

describe('TalentoVe Server - M0 Integration Tests', () => {
  const env = envSchema.parse({
    NODE_ENV: 'test',
    SESSION_SECRET: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    SESSION_COOKIE_NAME: 'tv_sid',
    SESSION_INACTIVE_LOGOUT_MINUTES: 10,
    SESSION_TTL_HOURS: 12,
  });

  it('GET /health retorna 200 y el estado inicial', async () => {
    const repos = createMemoryRepositories();
    const app = createApp(repos, env);

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.configured).toBe(false);
  });

  it('Redirige a /install si la instancia no está configurada', async () => {
    const repos = createMemoryRepositories();
    const app = createApp(repos, env);

    const res = await request(app).get('/');
    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/install');
  });

  it('POST /install valida campos obligatorios y RIF venezolano', async () => {
    const repos = createMemoryRepositories();
    const app = createApp(repos, env);

    // 1. Falta campo obligatorio
    const resVacio = await request(app).post('/install').send({
      companyName: '',
      nativeId: '',
    });
    expect(resVacio.status).toBe(400);
    expect(resVacio.text).toContain('obligatorios');

    // 2. Contraseña menor a 8 caracteres
    const resPassCorta = await request(app).post('/install').send({
      companyName: 'Empresa Demo',
      nativeId: 'J-12345678-9',
      adminName: 'Admin',
      adminEmail: 'admin@demo.ve',
      adminPassword: '123',
    });
    expect(resPassCorta.status).toBe(400);
    expect(resPassCorta.text).toContain('8 caracteres');

    // 3. RIF inválido según el catálogo de Venezuela
    const resRifMalo = await request(app).post('/install').send({
      companyName: 'Empresa Demo',
      nativeId: 'X-99999999',
      adminName: 'Admin',
      adminEmail: 'admin@demo.ve',
      adminPassword: 'PasswordSegura2026!',
    });
    expect(resRifMalo.status).toBe(400);
    expect(resRifMalo.text).toContain('RIF inválido');
  });

  it('Flujo completo: Instalación -> Sesión Automática -> Dashboard -> Logout -> Login', async () => {
    const repos = createMemoryRepositories();
    const app = createApp(repos, env);

    // 1. Ejecutar Wizard de Instalación con RIF válido (Banco de Venezuela de bancos.json)
    const installRes = await request(app)
      .post('/install')
      .send({
        companyName: 'Banco de Venezuela S.A.',
        nativeId: 'J-00002970-9',
        instanceName: 'Talento BDV',
        adminName: 'Super Administrador',
        adminEmail: 'super@bdv.ve',
        adminPassword: 'PasswordSegura2026!',
        primaryColor: '#002855',
        accentColor: '#d32f2f',
      });

    expect(installRes.status).toBe(302);
    expect(installRes.header.location).toBe('/');

    // Debe haber establecido la cookie de sesión tv_sid
    const cookies = installRes.header['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieList = (Array.isArray(cookies) ? cookies : [cookies as string]) as string[];
    const sidCookie = cookieList.find((c: string) => c.startsWith('tv_sid='));
    expect(sidCookie).toBeDefined();
    const cookieHeader = sidCookie!.split(';')[0]!;

    // 2. Acceder al dashboard con la cookie de sesión
    const dashRes = await request(app)
      .get('/')
      .set('Cookie', [cookieHeader]);

    expect(dashRes.status).toBe(200);
    expect(dashRes.text).toContain('Banco de Venezuela S.A.');
    expect(dashRes.text).toContain('Super Administrador');
    expect(dashRes.text).toContain('Talento BDV');

    // 3. Acceder a /install tras configurado redirige a /
    const reinviteRes = await request(app)
      .get('/install')
      .set('Cookie', [cookieHeader]);
    expect(reinviteRes.status).toBe(302);
    expect(reinviteRes.header.location).toBe('/');

    // Extraer token CSRF del dashboard
    const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(dashRes.text);
    const csrfToken = csrfMatch ? csrfMatch[1] : '';

    // 4. Cerrar sesión
    const logoutRes = await request(app)
      .post('/auth/logout')
      .set('Cookie', [cookieHeader])
      .send({ _csrf: csrfToken });

    expect(logoutRes.status).toBe(302);
    expect(logoutRes.header.location).toBe('/login');

    // 5. Iniciar sesión nuevamente con credenciales válidas
    const loginRes = await request(app)
      .post('/auth/login')
      .send({
        email: 'super@bdv.ve',
        password: 'PasswordSegura2026!',
      });

    expect(loginRes.status).toBe(302);
    expect(loginRes.header.location).toBe('/');
    expect(loginRes.header['set-cookie']).toBeDefined();

    // 6. Iniciar sesión con contraseña incorrecta retorna 401
    const badLogin = await request(app)
      .post('/auth/login')
      .send({
        email: 'super@bdv.ve',
        password: 'ClaveEquivocada',
      });

    expect(badLogin.status).toBe(401);
    expect(badLogin.text).toContain('Credenciales inválidas');
  });

  it('Sesión inactiva expira y redirige a /login', async () => {
    const repos = createMemoryRepositories();
    const app = createApp(repos, env);

    // Configurar empresa y usuario
    await repos.settings.saveSettings({
      companyName: 'Empresa Activa',
      nativeId: 'J000029709',
      instanceName: 'TalentoVe',
      primaryColor: '#0d47a1',
      accentColor: '#d32f2f',
      isConfigured: true,
    });

    const user = await repos.users.create({
      email: 'user@test.ve',
      fullName: 'Usuario Prueba',
      passwordHash: 'hash',
      role: 'worker',
      status: 'active',
    });

    // Sesión con última actividad hace 20 minutos (inactividad máxima es 10 minutos)
    const token = 'token-antiguo-123';
    const crypto = await import('./security/crypto.js');
    const tokenHash = crypto.hashSessionToken(token);
    const hace20Min = new Date(Date.now() - 20 * 60 * 1000).toISOString();
    const en1Hora = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await repos.sessions.create({
      userId: user.id,
      tokenHash,
      lastActiveAt: hace20Min,
      expiresAt: en1Hora,
    });

    const res = await request(app)
      .get('/')
      .set('Cookie', [`tv_sid=${token}`]);

    expect(res.status).toBe(302);
    expect(res.header.location).toBe('/login');
  });

  describe('M1a - Trabajadores y Carga Masiva', () => {
    async function setupAuthenticatedAdmin() {
      const repos = createMemoryRepositories();
      const app = createApp(repos, env);

      await repos.settings.saveSettings({
        companyName: 'Banco Central',
        nativeId: 'G200000010',
        instanceName: 'TalentoVe BCV',
        primaryColor: '#002b49',
        accentColor: '#cf102d',
        isConfigured: true,
      });

      const user = await repos.users.create({
        email: 'rrhh@bcv.ve',
        fullName: 'Analista de Nómina',
        passwordHash: 'hash',
        role: 'admin',
        status: 'active',
      });

      const token = 'admin-session-token';
      const crypto = await import('./security/crypto.js');
      const tokenHash = crypto.hashSessionToken(token);
      const en1Hora = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await repos.sessions.create({
        userId: user.id,
        tokenHash,
        lastActiveAt: new Date().toISOString(),
        expiresAt: en1Hora,
      });

      const cookie = `tv_sid=${token}`;
      return { app, repos, cookie };
    }

    it('GET /trabajadores renderiza la lista de trabajadores con seed de estados', async () => {
      const { app, cookie } = await setupAuthenticatedAdmin();

      const res = await request(app)
        .get('/trabajadores')
        .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Gestión de Trabajadores');
      expect(res.text).toContain('No hay trabajadores registrados');
    });

    it('POST /trabajadores crea un nuevo trabajador con contrato y cuenta bancaria', async () => {
      const { app, repos, cookie } = await setupAuthenticatedAdmin();

      const formRes = await request(app)
        .get('/trabajadores/nuevo')
        .set('Cookie', [cookie]);
      expect(formRes.status).toBe(200);
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(formRes.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      const res = await request(app)
        .post('/trabajadores')
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          cedulaTipo: 'V',
          cedulaNumero: '19876543',
          nombres: 'Simón',
          apellidos: 'Bolívar',
          sexo: 'M',
          estadoCivil: 'soltero',
          fechaNacimiento: '1990-07-24',
          fechaIngreso: '2024-01-15',
          correo: 'simon.bolivar@test.ve',
          telefono: '04121234567',
          direccion: 'Av. Urdaneta, Caracas',
          sector: 'publico',
          tipoContrato: 'indeterminado',
          cargo: 'Abogado Consultor',
          unidad: 'Consultoría Jurídica',
          salario: '12000.50',
          moneda: 'VES',
        });

      expect(res.status).toBe(302);
      expect(res.header.location).toBe('/trabajadores');

      const emp = await repos.employees.findByNativeId('V19876543');
      expect(emp).not.toBeNull();
      expect(emp?.nombres).toBe('Simón');
      expect(emp?.apellidos).toBe('Bolívar');

      const contract = await repos.contracts.findActiveByEmployeeId(emp!.id);
      expect(contract).not.toBeNull();
      expect(contract?.sector).toBe('publico');
      expect(contract?.salarioBase).toBe('12000.50');

      // Verificamos que ahora aparezca en el listado y en la búsqueda
      const listRes = await request(app)
        .get('/trabajadores?q=Simón')
        .set('Cookie', [cookie]);

      expect(listRes.status).toBe(200);
      expect(listRes.text).toContain('V19876543');
      expect(listRes.text).toContain('Simón Bolívar');
    });

    it('POST /trabajadores/importar ejecuta dryRun y carga masiva de CSV', async () => {
      const { app, repos, cookie } = await setupAuthenticatedAdmin();

      const formRes = await request(app)
        .get('/trabajadores/importar')
        .set('Cookie', [cookie]);
      expect(formRes.status).toBe(200);
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(formRes.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      const csvData = [
        'cedula,rif,nombres,apellidos,fechaNacimiento,sexo,estadoCivil,direccion,correo,cargo,unidad,tipoContrato,sector,fechaIngreso,salario,moneda',
        'V-22333444,,María,Rodríguez,1992-05-15,F,soltero,Caracas,maria@empresa.ve,Especialista TI,Tecnología,indeterminado,privado,2023-05-01,15000,VES',
      ].join('\n');

      // 1. Dry run (simulación)
      const dryRes = await request(app)
        .post('/trabajadores/importar')
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          csvData,
          mode: 'dryrun',
        });

      expect(dryRes.status).toBe(200);
      expect(dryRes.text).toContain('Previsualización exitosa');
      expect(dryRes.text).toContain('22333444');

      // No debe haberse insertado aún en dry run
      const beforeCommit = await repos.employees.findByNativeId('V22333444');
      expect(beforeCommit).toBeNull();

      // 2. Ejecución real
      const execRes = await request(app)
        .post('/trabajadores/importar')
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          csvData,
          mode: 'import',
        });

      expect(execRes.status).toBe(200);
      expect(execRes.text).toContain('Se importaron 1 trabajadores exitosamente');

      const afterCommit = await repos.employees.findByNativeId('V22333444');
      expect(afterCommit).not.toBeNull();
      expect(afterCommit?.nombres).toBe('María');
    });
  });

  async function setupM1bEnvironment() {
    const repos = createMemoryRepositories();
    const app = createApp(repos, env);

      await repos.settings.saveSettings({
        companyName: 'Banco Central de Venezuela',
        nativeId: 'G200000010',
        instanceName: 'TalentoVe BCV',
        primaryColor: '#002b49',
        accentColor: '#cf102d',
        isConfigured: true,
      });

      const user = await repos.users.create({
        email: 'rrhh@bcv.ve',
        fullName: 'Analista de Nómina',
        passwordHash: 'hash',
        role: 'admin',
        status: 'active',
      });

      const token = 'admin-session-m1b';
      const crypto = await import('./security/crypto.js');
      const tokenHash = crypto.hashSessionToken(token);
      const en1Hora = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await repos.sessions.create({
        userId: user.id,
        tokenHash,
        lastActiveAt: new Date().toISOString(),
        expiresAt: en1Hora,
      });

      const cookie = `tv_sid=${token}`;

      // Crear trabajador y contrato base
      const employee = await repos.employees.create({
        cedulaTipo: 'V',
        cedulaNumero: '18555666',
        nativeId: 'V18555666',
        nombres: 'Andrés',
        apellidos: 'Bello',
        fechaNacimiento: '1988-11-29',
        sexo: 'M',
        estadoCivil: 'casado',
        correo: 'andres.bello@bcv.ve',
        telefono: '04141112233',
        direccion: 'Altagracia, Caracas',
        status: 'activo',
      });

      const position = await repos.positions.create({
        name: 'Economista Senior',
        categoria: 'General',
        grupoIsco: 'Profesionales',
        aplicaSector: 'publico',
        activo: true,
      });

      const orgUnit = await repos.orgUnits.create({
        name: 'Gerencia de Investigaciones Económicas',
        typeId: 4,
      });

      const contract = await repos.contracts.create({
        employeeId: employee.id,
        positionId: position.id,
        orgUnitId: orgUnit.id,
        tipo: 'indeterminado',
        sector: 'publico',
        fechaIngreso: '2020-01-15',
        salarioBase: '18000.00',
        currency: 'VES',
        jornadaHoras: 8,
        activo: true,
      });

      return { app, repos, cookie, employee, contract, position, orgUnit };
    }

    describe('M1b - Expediente Digital, Ciclo de Vida y Solicitudes', () => {
      it('GET /trabajadores/:id muestra el expediente con ficha personal y laboral', async () => {
      const { app, cookie, employee } = await setupM1bEnvironment();

      const res = await request(app)
        .get(`/trabajadores/${employee.id}`)
        .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.text).toContain('Andrés Bello');
      expect(res.text).toContain('V-18555666');
      expect(res.text).toContain('Economista Senior');
      expect(res.text).toContain('18000.00');
    });

    it('POST /trabajadores/:id/editar actualiza los datos personales', async () => {
      const { app, repos, cookie, employee } = await setupM1bEnvironment();

      // Obtener token CSRF
      const viewRes = await request(app)
        .get(`/trabajadores/${employee.id}/editar`)
        .set('Cookie', [cookie]);
      expect(viewRes.status).toBe(200);
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(viewRes.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      const editRes = await request(app)
        .post(`/trabajadores/${employee.id}/editar`)
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          nombres: 'Andrés Eloy',
          apellidos: 'Bello López',
          fechaNacimiento: '1988-11-29',
          sexo: 'M',
          estadoCivil: 'casado',
          correo: 'andres.nuevo@bcv.ve',
          telefono: '04129998877',
          direccion: 'La Pastora, Caracas',
          status: 'activo',
        });

      expect(editRes.status).toBe(302);
      expect(editRes.header.location).toBe(`/trabajadores/${employee.id}`);

      const updated = await repos.employees.findById(employee.id);
      expect(updated?.nombres).toBe('Andrés Eloy');
      expect(updated?.apellidos).toBe('Bello López');
      expect(updated?.correo).toBe('andres.nuevo@bcv.ve');
    });

    it('POST /trabajadores/:id/cargas agrega y elimina una carga familiar', async () => {
      const { app, repos, cookie, employee } = await setupM1bEnvironment();

      const viewRes = await request(app)
        .get(`/trabajadores/${employee.id}`)
        .set('Cookie', [cookie]);
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(viewRes.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      // 1. Agregar carga familiar (hijo)
      const addRes = await request(app)
        .post(`/trabajadores/${employee.id}/cargas`)
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          nombres: 'Diego',
          apellidos: 'Bello',
          parentesco: 'hijo',
          fechaNacimiento: '2018-05-10',
          sexo: 'M',
          gradoInstruccion: 'primaria',
        });

      expect(addRes.status).toBe(302);

      const dependents = await repos.dependents.listByEmployeeId(employee.id);
      expect(dependents).toHaveLength(1);
      expect(dependents[0]?.nombres).toBe('Diego');
      expect(dependents[0]?.parentesco).toBe('hijo');

      // 2. Eliminar la carga familiar
      const delRes = await request(app)
        .post(`/trabajadores/${employee.id}/cargas/${dependents[0]!.id}/eliminar`)
        .set('Cookie', [cookie])
        .send({ _csrf: csrfToken });

      expect(delRes.status).toBe(302);
      const afterDel = await repos.dependents.listByEmployeeId(employee.id);
      expect(afterDel).toHaveLength(0);
    });

    it('POST /trabajadores/:id/movimientos registra un ascenso y actualiza el contrato', async () => {
      const { app, repos, cookie, employee, contract } = await setupM1bEnvironment();

      const viewRes = await request(app)
        .get(`/trabajadores/${employee.id}`)
        .set('Cookie', [cookie]);
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(viewRes.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      const movRes = await request(app)
        .post(`/trabajadores/${employee.id}/movimientos`)
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          tipoMovimiento: 'ascenso',
          fechaEfectiva: '2026-03-01',
          cargoNuevo: 'Gerente de Investigaciones',
          unidadNueva: 'Dirección General de Estudios',
          salarioNuevo: '25000.00',
          motivo: 'Excelente desempeño y evaluación de competencias',
        });

      expect(movRes.status).toBe(302);

      // Comprobar que se guardó en el historial de movimientos
      const movements = await repos.movements.listByEmployeeId(employee.id);
      expect(movements).toHaveLength(1);
      expect(movements[0]?.tipoMovimiento).toBe('ascenso');
      expect(movements[0]?.salarioNuevo).toBe('25000.00');

      // Comprobar que el contrato activo fue actualizado
      const updatedContract = await repos.contracts.findActiveByEmployeeId(employee.id);
      expect(updatedContract?.salarioBase).toBe('25000.00');
    });

    it('GET /trabajadores/:id/constancia/pdf genera y entrega el PDF de constancia laboral', async () => {
      const { app, repos, cookie, employee } = await setupM1bEnvironment();

      const res = await request(app)
        .get(`/trabajadores/${employee.id}/constancia/pdf`)
        .set('Cookie', [cookie]);

      expect(res.status).toBe(200);
      expect(res.header['content-type']).toBe('application/pdf');
      expect(res.header['content-disposition']).toContain(`constancia-${employee.nativeId}.pdf`);
      expect(res.body).toBeInstanceOf(Buffer);

      // Debe haber registrado una solicitud aprobada con código de verificación
      const requests = await repos.requests.listByEmployeeId(employee.id);
      expect(requests.length).toBeGreaterThan(0);
      const constanciaReq = requests.find((r) => r.tipo === 'constancia_trabajo');
      expect(constanciaReq).toBeDefined();
      expect(constanciaReq?.estatus).toBe('aprobada');
      expect(constanciaReq?.codigoVerificacion).toBeDefined();

      // Comprobar verificación pública con el código generado
      const verifyRes = await request(app).get(`/verificar/${constanciaReq!.codigoVerificacion}`);
      expect(verifyRes.status).toBe(200);
      expect(verifyRes.text).toContain('Documento Auténtico y Vigente');
      expect(verifyRes.text).toContain('Andrés');
    });

    it('Flujo de Solicitudes: radicación, bandeja y aprobación', async () => {
      const { app, repos, cookie, employee } = await setupM1bEnvironment();

      // 1. Obtener vista nueva solicitud
      const newReqView = await request(app)
        .get(`/solicitudes/nueva?employeeId=${employee.id}`)
        .set('Cookie', [cookie]);
      expect(newReqView.status).toBe(200);
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(newReqView.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      // 2. Radicar anticipo de prestaciones
      const postReq = await request(app)
        .post('/solicitudes')
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          employeeId: employee.id,
          tipo: 'adelanto_prestaciones',
          motivo: 'Mejoras y reparaciones de vivienda principal',
          montoSolicitado: '5000.00',
        });

      expect(postReq.status).toBe(302);
      expect(postReq.header.location).toBe('/solicitudes');

      const allReqs = await repos.requests.listByEmployeeId(employee.id);
      const anticipo = allReqs.find((r) => r.tipo === 'adelanto_prestaciones');
      expect(anticipo).toBeDefined();
      expect(anticipo?.estatus).toBe('pendiente');

      // 3. Ver bandeja de solicitudes
      const indexRes = await request(app)
        .get('/solicitudes')
        .set('Cookie', [cookie]);
      expect(indexRes.status).toBe(200);
      expect(indexRes.text).toContain('Bandeja de Solicitudes');
      expect(indexRes.text).toContain('Mejoras y reparaciones de vivienda');

      // 4. Aprobar la solicitud
      const approveRes = await request(app)
        .post(`/solicitudes/${anticipo!.id}/aprobar`)
        .set('Cookie', [cookie])
        .send({ _csrf: csrfToken });

      expect(approveRes.status).toBe(302);

      const approvedAnticipo = await repos.requests.findById(anticipo!.id);
      expect(approvedAnticipo?.estatus).toBe('aprobada');
    });

    it('GET /verificar/:codigo retorna error ante un código inexistente', async () => {
      const { app } = await setupM1bEnvironment();

      const res = await request(app).get('/verificar/CODIGO-INEXISTENTE-999');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Código de Verificación Inválido');
      expect(res.text).toContain('Documento no Encontrado');
    });
  });

  describe('Hito M2: Control y Gestión de Asistencia Semanal por Departamento (LOTTT)', () => {
    it('flujo integral: apertura de planilla semanal, captura de horarios, cálculo LOTTT, certificación RRHH y PDF', async () => {
      const { app, repos, cookie, employee } = await setupM1bEnvironment();

      // 1. Obtener vista de listado de asistencia
      const indexRes = await request(app)
        .get('/asistencia')
        .set('Cookie', [cookie]);
      expect(indexRes.status).toBe(200);
      expect(indexRes.text).toContain('Control y Registro de Asistencia Semanal');

      // 2. Obtener formulario de nueva planilla y capturar CSRF
      const newSheetView = await request(app)
        .get('/asistencia/nueva')
        .set('Cookie', [cookie]);
      expect(newSheetView.status).toBe(200);
      expect(newSheetView.text).toContain('Apertura de Planilla Semanal');
      const csrfMatch = /name="_csrf" value="([a-f0-9]+)"/.exec(newSheetView.text);
      const csrfToken = csrfMatch ? csrfMatch[1] : '';

      // Crear un departamento para la prueba
      const orgUnit = await repos.orgUnits.create({
        name: 'Departamento de Informática',
        code: 'INFO-01',
      });

      // Asignar el empleado a este departamento en su contrato
      const contract = await repos.contracts.findActiveByEmployeeId(employee.id);
      if (contract) {
        await repos.contracts.update(contract.id, { orgUnitId: orgUnit.id });
      }

      // 3. Crear planilla semanal para la semana del 2026-09-28 al 2026-10-04
      const createRes = await request(app)
        .post('/asistencia')
        .set('Cookie', [cookie])
        .send({
          _csrf: csrfToken,
          departmentId: orgUnit.id,
          startDate: '2026-09-28',
          endDate: '2026-10-04',
          coordinatorName: 'Lcdo. Roberto Gómez',
          notes: 'Turno Regular de Soporte Técnico',
        });

      expect(createRes.status).toBe(302);
      const sheetRedirectUrl = createRes.header.location;
      expect(sheetRedirectUrl).toContain('/asistencia/');
      const sheetId = sheetRedirectUrl.split('/').pop();

      // Verificar en repositorio
      const createdSheet = await repos.attendance.findSheetById(sheetId!);
      expect(createdSheet).toBeDefined();
      expect(createdSheet?.coordinatorName).toBe('Lcdo. Roberto Gómez');
      expect(createdSheet?.status).toBe('borrador');

      // Verificar que se crearon los registros para cada día de la semana
      const initialRecords = await repos.attendance.listRecordsBySheetId(sheetId!);
      expect(initialRecords.length).toBe(7); // 7 días (Lunes a Domingo)

      // 4. Visualizar cuadrícula de la planilla
      const sheetView = await request(app)
        .get(`/asistencia/${sheetId}`)
        .set('Cookie', [cookie]);
      expect(sheetView.status).toBe(200);
      expect(sheetView.text).toContain('Planilla Semanal:');
      expect(sheetView.text).toContain('Departamento de Informática');
      expect(sheetView.text).toContain(employee.nombres);
      expect(sheetView.text).toContain(employee.cedulaNumero);

      // 5. Cargar horarios con jornada extendida mixta/nocturna (LOTTT Art 117 y 118)
      // Modificamos el primer registro: entra a las 14:00 y sale a las 23:00 (9 horas de trabajo)
      const firstRecord = initialRecords[0]!;
      const savePayload: Record<string, string> = {
        _csrf: csrfToken,
        recordIds: firstRecord.id,
      };
      savePayload[`timeIn_${firstRecord.id}`] = '14:00';
      savePayload[`timeOut_${firstRecord.id}`] = '23:00';
      savePayload[`signature_${firstRecord.id}`] = '1';
      savePayload[`notes_${firstRecord.id}`] = 'Guardia especial';

      const saveRes = await request(app)
        .post(`/asistencia/${sheetId}/guardar`)
        .set('Cookie', [cookie])
        .send(savePayload);

      expect(saveRes.status).toBe(302);

      // Comprobar recálculo de horas en repositorio
      const updatedRecords = await repos.attendance.listRecordsBySheetId(sheetId!);
      const updatedFirst = updatedRecords.find((r) => r.id === firstRecord.id);
      expect(updatedFirst).toBeDefined();
      expect(updatedFirst?.workerSigned).toBe(true);
      expect(updatedFirst?.regularHours).toBe(8);
      // Salida 23:00 (1 hora extra total distribuida proporcionalmente) y 4 horas de bono nocturno (19:00 a 23:00)
      expect(Number((updatedFirst!.overtimeNightHours + updatedFirst!.overtimeDayHours).toFixed(2))).toBe(1);
      expect(updatedFirst?.nightShiftHours).toBe(4);

      // 6. Certificar y aprobar planilla por Analista de RRHH
      const verifyRes = await request(app)
        .post(`/asistencia/${sheetId}/verificar`)
        .set('Cookie', [cookie])
        .send({ _csrf: csrfToken });

      expect(verifyRes.status).toBe(302);

      const verifiedSheet = await repos.attendance.findSheetById(sheetId!);
      expect(verifiedSheet?.status).toBe('verificada');
      expect(verifiedSheet?.verifiedBy).toBeDefined();

      // 7. Descargar la Planilla Semanal Oficial en PDF
      const pdfRes = await request(app)
        .get(`/asistencia/${sheetId}/pdf`)
        .set('Cookie', [cookie]);

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.header['content-type']).toBe('application/pdf');
      expect(pdfRes.header['content-disposition']).toContain(`asistencia-sem-${verifiedSheet?.weekNumber}-${verifiedSheet?.year}.pdf`);
      expect(pdfRes.body).toBeInstanceOf(Buffer);
      expect(pdfRes.body.length).toBeGreaterThan(1000);
    });
  });
});


