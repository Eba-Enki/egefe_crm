(function () {
  var STORAGE_KEY = 'crm_col_widths_v1';

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

  function getTableKey(table) {
    // Stabıl key: tbody id > parent card/page id > fallback
    var tbody = table.querySelector('tbody[id]');
    if (tbody) return tbody.id;
    var parent = table.closest('[id]');
    if (parent) return parent.id + '_tbl';
    return null;
  }

  function lockLayout(table) {
    if (table.dataset.layoutLocked) return;
    var totalW = 0;
    table.querySelectorAll('thead th').forEach(function (th) {
      if (th.querySelector('input[type=checkbox]')) return;
      var w = th.offsetWidth;
      th.style.width = w + 'px';
      totalW += w;
    });
    table.style.tableLayout = 'fixed';
    table.style.minWidth = totalW + 'px';
    table.dataset.layoutLocked = '1';
  }

  function applyStored(table, tableKey) {
    var stored = loadAll()[tableKey];
    if (!stored) return;
    var totalW = 0;
    table.querySelectorAll('thead th').forEach(function (th, i) {
      if (th.querySelector('input[type=checkbox]')) return;
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

  function makeResizable(table) {
    // Form giriş tablosu — atla
    if (table.classList.contains('teklif-items')) return;
    // Zaten işlendi
    if (table.dataset.resizable) return;
    table.dataset.resizable = '1';

    var tableKey = getTableKey(table);
    if (!tableKey) return;

    // Kayıtlı genişlikleri uygula
    applyStored(table, tableKey);

    var ths = table.querySelectorAll('thead th');

    ths.forEach(function (th, index) {
      // Checkbox sütunu veya son sütun (İşlemler) — handle ekleme
      if (th.querySelector('input[type=checkbox]')) return;
      if (index === ths.length - 1) return;

      th.style.position = 'relative';

      var handle = document.createElement('span');
      handle.className = 'col-resize-handle';

      handle.addEventListener('mousedown', function (e) {
        e.preventDefault();
        e.stopPropagation(); // sort click ile çakışmasın

        lockLayout(table);

        var startX    = e.clientX;
        var startW    = th.offsetWidth;

        handle.classList.add('dragging');
        document.body.classList.add('col-resizing');

        function onMove(e) {
          var newW = Math.max(60, startW + (e.clientX - startX));
          th.style.width    = newW + 'px';
          th.style.minWidth = newW + 'px';
        }

        function onUp() {
          handle.classList.remove('dragging');
          document.body.classList.remove('col-resizing');
          saveWidth(tableKey, index, th.offsetWidth);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup',   onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup',   onUp);
      });

      th.appendChild(handle);
    });
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
