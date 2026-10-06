/**
 * tables.js — enhancer vanilla de tablas para TalentoVe
 * Añade a cualquier <table class="data-enhance">:
 *   - búsqueda de texto (toda la tabla)
 *   - orden por columna (click en th; omitir con clase .no-sort)
 *   - mostrar/ocultar columnas (menú "Columnas")
 *   - filtros por categoría en th[data-filter] (valores únicos de la columna)
 * Sin dependencias. Los valores de celdas filtrables van en data-value.
 */
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  }

  function initTable(table) {
    if (table.dataset.enhanced) return;
    table.dataset.enhanced = '1';

    var headCells = Array.prototype.slice.call(table.querySelectorAll('thead th'));
    var bodyRows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    if (headCells.length === 0) return;

    var state = { sortIdx: -1, sortDir: 1, query: '', hidden: {}, colFilters: {} };

    // ---- barra de controles ----
    var bar = document.createElement('div');
    bar.className = 'dt-bar';

    var search = document.createElement('input');
    search.type = 'search';
    search.className = 'dt-search';
    search.placeholder = 'Buscar en la tabla…';
    search.setAttribute('aria-label', 'Buscar en la tabla');

    var count = document.createElement('span');
    count.className = 'dt-count';
    count.setAttribute('role', 'status');
    count.setAttribute('aria-live', 'polite');

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
        apply();
      });
      bar.appendChild(sel);
    });

    // ---- menú mostrar/ocultar columnas ----
    var details = document.createElement('details');
    details.className = 'dt-cols';
    var summary = document.createElement('summary');
    summary.textContent = 'Columnas';
    var menu = document.createElement('div');
    menu.className = 'dt-cols-menu';
    headCells.forEach(function (th, i) {
      var label = document.createElement('label');
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.addEventListener('change', function () {
        if (cb.checked) delete state.hidden[i]; else state.hidden[i] = true;
        apply();
      });
      label.appendChild(cb);
      label.appendChild(document.createTextNode(th.textContent.trim() || 'Columna ' + (i + 1)));
      menu.appendChild(label);
    });
    details.appendChild(summary);
    details.appendChild(menu);
    bar.appendChild(details);
    bar.appendChild(count);

    table.parentNode.insertBefore(bar, table);

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
        apply();
      });
    });

    // ---- aplicar estado ----
    function apply() {
      var visible = 0;
      var filterKeys = Object.keys(state.colFilters).filter(function (k) { return state.colFilters[k]; });

      bodyRows.forEach(function (tr) {
        var cells = tr.children;
        var show = true;

        filterKeys.forEach(function (i) {
          if (!show) return;
          var cell = cells[i];
          var v = (cell && (cell.getAttribute('data-value') || cell.textContent.trim())) || '';
          if (v !== state.colFilters[i]) show = false;
        });

        if (show && state.query) {
          if (tr.textContent.toLowerCase().indexOf(state.query) === -1) show = false;
        }

        headCells.forEach(function (h, i) {
          var hide = !!state.hidden[i];
          if (h.style.display !== (hide ? 'none' : '')) h.style.display = hide ? 'none' : '';
          if (cells[i] && cells[i].style.display !== (hide ? 'none' : '')) cells[i].style.display = hide ? 'none' : '';
        });

        if (tr.style.display !== (show ? '' : 'none')) tr.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      // orden: solo filas visibles, reordenando el DOM (estable para el tamaño del piloto)
      if (state.sortIdx >= 0) {
        var tbody = table.querySelector('tbody');
        var rows = bodyRows.filter(function (tr) { return tr.style.display !== 'none'; });
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
        rows.forEach(function (tr) { tbody.appendChild(tr); });
      }

      count.textContent = visible + ' de ' + bodyRows.length + ' registros';
    }

    search.addEventListener('input', function () {
      state.query = search.value.trim().toLowerCase();
      apply();
    });

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
