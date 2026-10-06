/**
 * tables.js v2 — enhancer vanilla de tablas para TalentoVe
 * Añade a cualquier <table class="data-enhance">:
 *   - búsqueda de texto (toda la tabla)
 *   - orden por columna (click en th; omitir con clase .no-sort)
 *   - mostrar/ocultar columnas (menú "Columnas") — persistido en localStorage
 *   - filtros por categoría en th[data-filter] (valores únicos de la columna)
 *   - paginación client-side (10/25/50/Todos)
 *   - exportación CSV de la vista filtrada, impresión y densidad conmutable
 * Sin dependencias. Los valores de celdas filtrables/ordenables van en data-value.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function prefKey(tableKey) {
    return 'tv:tabla:' + location.pathname + ':' + tableKey;
  }

  function initTable(table, tableIndex) {
    if (table.dataset.enhanced) return;
    table.dataset.enhanced = '1';

    var headCells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var bodyRows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    if (headCells.length === 0) return;

    var tableKey = (table.dataset.dtKey || ('t' + tableIndex));
    var prefs = {};
    try { prefs = JSON.parse(localStorage.getItem(prefKey(tableKey)) || '{}'); } catch (e) { prefs = {}; }

    var state = {
      sortIdx: -1, sortDir: 1, query: '',
      hidden: prefs.hidden || {},
      colFilters: {},
      page: 1,
      pageSize: prefs.pageSize || 10,
      compact: !!prefs.compact,
    };
    if (state.hidden.__all__) {
      // compat: restaurar mapa de ocultas
      delete state.hidden.__all__;
    }

    function persist() {
      try {
        localStorage.setItem(prefKey(tableKey), JSON.stringify({ hidden: state.hidden, pageSize: state.pageSize, compact: state.compact }));
      } catch (e) { /* almacenamiento no disponible: modo silencioso */ }
    }

    // ---- barra de controles ----
    var bar = document.createElement('div');
    bar.className = 'dt-bar';

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'dt-search';
    search.placeholder = 'Buscar en la tabla…';
    search.setAttribute('aria-label', 'Buscar en la tabla');
    bar.appendChild(search);

    // ---- filtros por categoría (th[data-filter]) ----
    headCells.forEach(function (th, i) {
      if (!th.hasAttribute('data-filter')) return;
      var values = [];
      bodyRows.forEach(function (tr) {
        var cell = tr.children[i];
        if (!cell) return;
        var v = cell.getAttribute('data-value') || cell.textContent.trim();
        if (v && values.indexOf(v) === -1) values.push(v);
      });
      values.sort(function (a, b) { return a.localeCompare(b, 'es'); });
      var sel = document.createElement('select');
      sel.className = 'dt-colfilter';
      sel.setAttribute('aria-label', 'Filtrar por ' + th.textContent.trim());
      sel.innerHTML = '<option value="">' + esc('Todos: ' + th.textContent.trim()) + '</option>' +
        values.map(function (v) { return '<option value="' + esc(v) + '">' + esc(v) + '</option>'; }).join('');
      sel.addEventListener('change', function () {
        state.colFilters[i] = sel.value;
        state.page = 1;
        apply();
      });
      bar.appendChild(sel);
    });

    // ---- exportar CSV / imprimir / densidad / columnas / tamaño de página ----
    var actions = document.createElement('div');
    actions.className = 'dt-actions';

    function mkBtn(text, title, fn, cls) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = cls || 'dt-btn';
      b.innerHTML = text;
      b.title = title;
      b.setAttribute('aria-label', title);
      b.addEventListener('click', fn);
      return b;
    }

    actions.appendChild(mkBtn('⤓ CSV', 'Exportar CSV de la vista filtrada', function () { exportCsv(); }));

    var selSize = document.createElement('select');
    selSize.className = 'dt-size';
    selSize.setAttribute('aria-label', 'Filas por página');
    [10, 25, 50, -1].forEach(function (n) {
      var o = document.createElement('option');
      o.value = String(n);
      o.textContent = n === -1 ? 'Todos' : String(n);
      if (state.pageSize === n) o.selected = true;
      selSize.appendChild(o);
    });
    selSize.addEventListener('change', function () {
      state.pageSize = Number(selSize.value);
      state.page = 1;
      persist(); apply();
    });
    actions.appendChild(selSize);

    var details = document.createElement('details');
    details.className = 'dt-cols';
    var summary = document.createElement('summary');
    summary.textContent = 'Columnas';
    var menu = document.createElement('div');
    menu.className = 'dt-cols-menu';
    var colChecks = [];
    headCells.forEach(function (th, i) {
      var label = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !state.hidden[i];
      cb.addEventListener('change', function () {
        if (cb.checked) delete state.hidden[i]; else state.hidden[i] = true;
        persist(); apply();
      });
      colChecks.push({ cb: cb, i: i });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(th.textContent.trim() || 'Columna ' + (i + 1)));
      menu.appendChild(label);
    });
    details.appendChild(summary);
    details.appendChild(menu);
    actions.appendChild(details);

    actions.appendChild(mkBtn('.dense-toggle', 'Alternar densidad de filas', function () {
      state.compact = !state.compact;
      persist(); apply();
    }, 'dt-btn'));
    actions.lastChild.textContent = '≡ Densidad';

    actions.appendChild(mkBtn('⎙ Imprimir', 'Imprimir la vista actual', function () { window.print(); }, 'dt-btn'));

    bar.appendChild(actions);

    var count = document.createElement('span');
    count.className = 'dt-count';
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');
    bar.appendChild(count);

    table.parentNode.insertBefore(bar, table);

    // ---- paginador ----
    var pager = document.createElement('div');
    pager.className = 'dt-pager';
    pager.setAttribute('role', 'navigation');
    pager.setAttribute('aria-label', 'Paginación de la tabla');
    var prev = mkBtn('‹', 'Página anterior', function () { if (state.page > 1) { state.page--; apply(); } });
    var pageInfo = document.createElement('span');
    pageInfo.className = 'dt-pageinfo';
    var next = mkBtn('›', 'Página siguiente', function () { state.page++; apply(); });
    pager.appendChild(prev); pager.appendChild(pageInfo); pager.appendChild(next);
    table.parentNode.insertBefore(pager, table.nextSibling);

    // ---- orden por columna ----
    headCells.forEach(function (th, i) {
      if (th.classList.contains('no-sort')) return;
      th.classList.add('dt-sortable');
      th.setAttribute('title', 'Ordenar por esta columna');
      th.addEventListener('click', function () {
        if (state.sortIdx === i) state.sortDir = -state.sortDir;
        else { state.sortIdx = i; state.sortDir = 1; }
        headCells.forEach(function (h) { h.removeAttribute('aria-sort'); });
        th.setAttribute('aria-sort', state.sortDir === 1 ? 'ascending' : 'descending');
        state.page = 1;
        apply();
      });
    });

    // ---- aplicar estado ----
    function rowsFiltradas() {
      var filterKeys = Object.keys(state.colFilters).filter(function (k) { return state.colFilters[k]; });
      var rows = bodyRows.filter(function (tr) {
        var show = true;
        filterKeys.forEach(function (i) {
          if (!show) return;
          var cell = tr.children[i];
          var v = (cell && (cell.getAttribute('data-value') || cell.textContent.trim())) || '';
          if (v !== state.colFilters[i]) show = false;
        });
        if (show && state.query && tr.textContent.toLowerCase().indexOf(state.query) === -1) show = false;
        return show;
      });
      if (state.sortIdx >= 0) {
        rows.sort(function (a, b) {
          var ca = a.children[state.sortIdx];
          var cb = b.children[state.sortIdx];
          var va = ((ca && (ca.getAttribute('data-value') || ca.textContent)) || '').trim();
          var vb = ((cb && (cb.getAttribute('data-value') || cb.textContent)) || '').trim();
          var na = parseFloat(va.replace(/[^\d.-]/g, ''));
          var nb = parseFloat(vb.replace(/[^\d.-]/g, ''));
          if (!isNaN(na) && !isNaN(nb) && va !== '' && vb !== '' && /^[\s\d.,-]+$/.test(va) && /^[\s\d.,-]+$/.test(vb)) {
            return (na - nb) * state.sortDir;
          }
          return va.localeCompare(vb, 'es', { sensitivity: 'base' }) * state.sortDir;
        });
      }
      return rows;
    }

    function apply() {
      var rows = rowsFiltradas();
      var total = rows.length;

      if (state.compact) table.classList.add('dt-compact'); else table.classList.remove('dt-compact');

      // ocultar columnas
      headCells.forEach(function (h, i) {
        var hide = !!state.hidden[i];
        if (h.style.display !== (hide ? 'none' : '')) h.style.display = hide ? 'none' : '';
      });
      bodyRows.forEach(function (tr) {
        var cells = tr.children;
        headCells.forEach(function (h, i) {
          var hide = !!state.hidden[i];
          if (cells[i] && cells[i].style.display !== (hide ? 'none' : '')) cells[i].style.display = hide ? 'none' : '';
        });
      });

      // paginación
      var pages = state.pageSize === -1 ? 1 : Math.max(1, Math.ceil(total / state.pageSize));
      if (state.page > pages) state.page = pages;
      var desde = state.pageSize === -1 ? 0 : (state.page - 1) * state.pageSize;
      var hasta = state.pageSize === -1 ? total : Math.min(total, desde + state.pageSize);

      bodyRows.forEach(function (tr) { tr.style.display = 'none'; });
      rows.forEach(function (tr, i) {
        var enPagina = state.pageSize === -1 || (i >= desde && i < hasta);
        if (enPagina) tr.style.display = '';
        // estilo de fila alterna estable tras reordenar
        tr.classList.toggle('dt-odd', i % 2 === 1);
      });

      pageInfo.textContent = state.pageSize === -1
        ? total + ' registros'
        : 'Página ' + state.page + ' de ' + pages + ' (' + total + ' registros)';
      prev.style.opacity = state.page > 1 ? '1' : '0.4';
      next.style.opacity = state.page < pages ? '1' : '0.4';

      count.textContent = total + ' de ' + bodyRows.length + ' registros';
    }

    // ---- export CSV de la vista filtrada (columnas visibles, en el orden actual) ----
    function exportCsv() {
      var rows = rowsFiltradas();
      var cols = headCells
        .map(function (th, i) { return { i: i, nombre: th.textContent.trim() }; })
        .filter(function (c) { return !state.hidden[c.i]; });
      var lineas = [cols.map(function (c) { return '"' + c.nombre.replace(/"/g, '""') + '"'; }).join(';')];
      rows.forEach(function (tr) {
        lineas.push(cols.map(function (c) {
          var cell = tr.children[c.i];
          var v = (cell && (cell.getAttribute('data-value') || cell.textContent)) || '';
          return '"' + v.trim().replace(/"/g, '""') + '"';
        }).join(';'));
      });
      var blob = new Blob(['\ufeff' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (document.title.replace(/[^\wÁÉÍÓÚÑáéíóúñ -]/g, '').trim() || 'tabla') + '.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000);
    }

    search.addEventListener('input', function () {
      state.query = search.value.trim().toLowerCase();
      state.page = 1;
      apply();
    });

    if (state.compact) table.classList.add('dt-compact');
    apply();
  }

  function initAll() {
    document.querySelectorAll('table.data-enhance').forEach(initTable);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAll);
  } else {
    initAll();
  }
})();
