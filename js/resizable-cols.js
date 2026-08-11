(function () {
  var STORAGE_KEY = 'crm_col_widths_v1';
  var MIN_W = 60;

  function loadAll() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch (e) { return {}; }
  }

  function saveWidth(tableKey, colIndex, width) {
    var all = loadAll();
    if (!all[tableKey]) all[tableKey] = {};
    all[tableKey][colIndex] = width;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function saveWidths(tableKey, updates) {
    var all = loadAll();
    if (!all[tableKey]) all[tableKey] = {};
    Object.keys(updates).forEach(function (idx) { all[tableKey][idx] = updates[idx]; });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  // Eski (legacy) anahtar üretimi — data-resize-key taşımayan tablolar için.
  function legacyTableKey(table) {
    var tbody = table.querySelector('tbody[id]');
    if (tbody) return tbody.id;
    var parent = table.closest('[id]');
    if (parent) return parent.id + '_tbl';
    return null;
  }

  function isCheckboxTh(th) {
    return !!th.querySelector('input[type=checkbox]');
  }

  // ── LEGACY MOD (mevcut davranış): tutamağı sürükleyince sadece o sütun
  // büyür/küçülür, tablo genişler; ilk sürüklemede kilitlenir. Stok dışındaki
  // modüllerin tabloları için değişmeden korunuyor.
  function lockLayoutLegacy(table) {
    if (table.dataset.layoutLocked) return;
    var totalW = 0;
    table.querySelectorAll('thead th').forEach(function (th) {
      if (isCheckboxTh(th)) return;
      var w = th.offsetWidth;
      th.style.width = w + 'px';
      totalW += w;
    });
    table.style.tableLayout = 'fixed';
    table.style.minWidth = totalW + 'px';
    table.dataset.layoutLocked = '1';
  }

  function applyStoredLegacy(table, tableKey) {
    var stored = loadAll()[tableKey];
    if (!stored) return;
    var totalW = 0;
    table.querySelectorAll('thead th').forEach(function (th, i) {
      if (isCheckboxTh(th)) return;
      if (stored[i]) {
        var w = Number(stored[i]);
        th.style.width = w + 'px';
        th.style.minWidth = w + 'px';
        totalW += w;
      }
    });
    table.style.tableLayout = 'fixed';
    if (totalW > 0) table.style.minWidth = totalW + 'px';
    table.dataset.layoutLocked = '1';
  }

  function makeResizableLegacy(table, tableKey) {
    applyStoredLegacy(table, tableKey);
    var ths = table.querySelectorAll('thead th');

    ths.forEach(function (th, index) {
      if (isCheckboxTh(th)) return;
      if (index === ths.length - 1) return;

      th.style.position = 'relative';
      var handle = document.createElement('span');
      handle.className = 'col-resize-handle';

      handle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();

        lockLayoutLegacy(table);

        var startX = e.clientX;
        var startW = th.offsetWidth;

        handle.classList.add('dragging');
        document.body.classList.add('col-resizing');

        function onMove(e) {
          var newW = Math.max(MIN_W, startW + (e.clientX - startX));
          th.style.width = newW + 'px';
          th.style.minWidth = newW + 'px';
        }

        function onUp() {
          handle.classList.remove('dragging');
          document.body.classList.remove('col-resizing');
          saveWidth(tableKey, index, th.offsetWidth);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      th.appendChild(handle);
    });
  }

  // ── SABİT (FIXED) MOD: yalnızca data-resize-key taşıyan tablolarda.
  // İlk render'da doğal genişlikler "varsayılan" olarak yakalanıp tablo hemen
  // kilitlenir (sabit genişlik). Tutamak sürüklenince SADECE tutamağın sol ve
  // sağındaki iki sütun genişlik değiştirir, toplam tablo genişliği sabit
  // kalır, diğer sütunlar yerinden oynamaz. Çift tık = o iki sütunu varsayılan
  // genişliğine geri döndürür.
  function lockFixed(table, tableKey, ths) {
    if (table.dataset.layoutLocked) return;
    var stored = loadAll()[tableKey] || {};
    var totalW = 0;
    ths.forEach(function (th, i) {
      if (isCheckboxTh(th)) return;
      var w = stored[i] ? Number(stored[i]) : Number(th.dataset.defaultW || th.offsetWidth);
      th.style.width = w + 'px';
      th.style.minWidth = w + 'px';
      totalW += w;
    });
    table.style.tableLayout = 'fixed';
    if (totalW > 0) table.style.width = totalW + 'px';
    table.dataset.layoutLocked = '1';
  }

  function makeResizableFixed(table, tableKey) {
    var ths = table.querySelectorAll('thead th');

    // Doğal (ilk render) genişlikleri kilitlemeden önce yakala.
    ths.forEach(function (th) {
      if (!th.dataset.defaultW) th.dataset.defaultW = th.offsetWidth;
    });

    lockFixed(table, tableKey, ths);

    ths.forEach(function (th, index) {
      if (isCheckboxTh(th)) return;
      if (index === ths.length - 1) return;
      var rightTh = ths[index + 1];
      if (!rightTh || isCheckboxTh(rightTh)) return;

      th.style.position = 'relative';
      var handle = document.createElement('span');
      handle.className = 'col-resize-handle';
      handle.title = 'Sürükle: boyutlandır · Çift tık: sıfırla';

      handle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation();

        var startX = e.clientX;
        var startWLeft = th.offsetWidth;
        var startWRight = rightTh.offsetWidth;
        var pairTotal = startWLeft + startWRight;

        handle.classList.add('dragging');
        document.body.classList.add('col-resizing');

        function onMove(e) {
          var dx = e.clientX - startX;
          var upperBound = Math.max(pairTotal - MIN_W, MIN_W);
          var newLeft = Math.min(Math.max(startWLeft + dx, MIN_W), upperBound);
          var newRight = pairTotal - newLeft;
          th.style.width = newLeft + 'px'; th.style.minWidth = newLeft + 'px';
          rightTh.style.width = newRight + 'px'; rightTh.style.minWidth = newRight + 'px';
        }

        function onUp() {
          handle.classList.remove('dragging');
          document.body.classList.remove('col-resizing');
          var updates = {};
          updates[index] = th.offsetWidth;
          updates[index + 1] = rightTh.offsetWidth;
          saveWidths(tableKey, updates);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      handle.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var defLeft = Number(th.dataset.defaultW);
        var defRight = Number(rightTh.dataset.defaultW);
        if (!defLeft || !defRight) return;
        th.style.width = defLeft + 'px'; th.style.minWidth = defLeft + 'px';
        rightTh.style.width = defRight + 'px'; rightTh.style.minWidth = defRight + 'px';
        var updates = {};
        updates[index] = defLeft;
        updates[index + 1] = defRight;
        saveWidths(tableKey, updates);
      });

      th.appendChild(handle);
    });
  }

  function makeResizable(table) {
    // Form giriş tablosu — atla
    if (table.classList.contains('teklif-items')) return;
    // Zaten işlendi
    if (table.dataset.resizable) return;
    table.dataset.resizable = '1';

    var explicitKey = table.dataset.resizeKey;
    if (explicitKey) {
      makeResizableFixed(table, explicitKey);
      return;
    }

    var tableKey = legacyTableKey(table);
    if (!tableKey) return;
    makeResizableLegacy(table, tableKey);
  }

  function initAll() {
    document.querySelectorAll('.table-wrap table, .card table').forEach(makeResizable);
  }

  // Dinamik eklenen tablolar için (stok sayfaları vb.)
  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      m.addedNodes.forEach(function (node) {
        if (node.nodeType !== 1) return;
        if (node.tagName === 'TABLE') {
          makeResizable(node);
        } else if (node.querySelectorAll) {
          node.querySelectorAll('table').forEach(makeResizable);
        }
      });
    });
  });

  document.addEventListener('DOMContentLoaded', function () {
    initAll();
    observer.observe(document.body, { childList: true, subtree: true });
  });

  // Dışarıdan çağrılabilir (render sonrası manuel tetikleme için)
  window.initResizableCols = initAll;
}());
