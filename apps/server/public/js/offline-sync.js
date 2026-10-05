/**
 * TalentoVe - Resiliencia y Sincronización Offline-First con Dexie.js (Hito M4)
 * Permite almacenar en IndexedDB asistencias, solicitudes y consultas de trabajadores,
 * sincronizando cambios locales pendientes al recuperar la conexión.
 */
(function() {
  if (typeof Dexie === 'undefined') {
    return;
  }

  const db = new Dexie('TalentoVeOfflineDB');
  db.version(2).stores({
    attendanceSyncQueue: '++id, sheetId, workerId, status, timestamp, synced',
    requestsSyncQueue: '++id, workerId, requestType, startDate, endDate, reason, timestamp, synced',
    cachedWorkers: 'id, cedula, fullName, departmentId, position',
    cachedReceipts: 'id, workerCedula, periodStart, periodEnd'
  });

  window.TalentoVeDB = db;

  function showToast(message, isSuccess = true) {
    const toast = document.getElementById('invio-toast');
    const toastMsg = document.getElementById('invio-toast-msg');
    if (toast && toastMsg) {
      toastMsg.textContent = message;
      toast.style.display = 'flex';
      setTimeout(() => {
        toast.style.display = 'none';
      }, 3500);
    }
  }

  // Descarga y cachea el catálogo básico para funcionamiento fuera de línea
  async function bootstrapOfflineCache() {
    if (!navigator.onLine) return;
    try {
      const res = await fetch('/api/sync/bootstrap');
      if (res.ok) {
        const data = await res.json();
        if (data.workers && data.workers.length > 0) {
          await db.cachedWorkers.clear();
          await db.cachedWorkers.bulkPut(data.workers);
        }
      }
    } catch {
      // Sin conexión o fallo silencioso
    }
  }

  // Procesa la cola de sincronización pendiente
  async function syncPendingRecords() {
    if (!navigator.onLine) return;
    try {
      const pendingAtt = await db.attendanceSyncQueue.where('synced').equals(0).toArray();
      const pendingReq = await db.requestsSyncQueue.where('synced').equals(0).toArray();

      if (pendingAtt.length === 0 && pendingReq.length === 0) return;

      showToast(`Sincronizando ${pendingAtt.length + pendingReq.length} registros pendientes...`, true);

      // Sincronizar asistencias
      for (const item of pendingAtt) {
        try {
          const res = await fetch(`/asistencia/planillas/${item.sheetId}/registrar`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workerId: item.workerId,
              status: item.status,
              notes: 'Sincronizado vía offline-sync (Dexie.js)'
            })
          });
          if (res.ok) {
            await db.attendanceSyncQueue.update(item.id, { synced: 1 });
          }
        } catch {}
      }

      // Sincronizar solicitudes
      for (const item of pendingReq) {
        try {
          const res = await fetch('/mi-portal/solicitar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              workerId: item.workerId,
              requestType: item.requestType,
              startDate: item.startDate,
              endDate: item.endDate,
              reason: item.reason + ' (Enviado offline vía Dexie.js)'
            })
          });
          if (res.ok) {
            await db.requestsSyncQueue.update(item.id, { synced: 1 });
          }
        } catch {}
      }

      showToast('Sincronización fuera de línea completada exitosamente ✓', true);
    } catch (err) {
      console.warn('[TalentoVe Offline] Error en sincronización:', err);
    }
  }

  window.addEventListener('online', () => {
    showToast('Conexión reestablecida. Sincronizando datos...', true);
    syncPendingRecords();
  });

  window.addEventListener('offline', () => {
    showToast('Modo sin conexión activado. Los cambios se guardarán localmente.', false);
  });

  window.TalentoVeOffline = {
    async queueAttendance(sheetId, workerId, status) {
      await db.attendanceSyncQueue.add({
        sheetId,
        workerId,
        status,
        timestamp: new Date().toISOString(),
        synced: 0
      });
      showToast('Asistencia guardada localmente en IndexedDB');
      if (navigator.onLine) syncPendingRecords();
    },
    async queueRequest(workerId, requestType, startDate, endDate, reason) {
      await db.requestsSyncQueue.add({
        workerId,
        requestType,
        startDate,
        endDate,
        reason,
        timestamp: new Date().toISOString(),
        synced: 0
      });
      showToast('Solicitud guardada localmente en IndexedDB');
      if (navigator.onLine) syncPendingRecords();
    }
  };

  // Inicializar cache y sincronización periódica
  setTimeout(bootstrapOfflineCache, 2000);
  setInterval(syncPendingRecords, 30000);
})();
