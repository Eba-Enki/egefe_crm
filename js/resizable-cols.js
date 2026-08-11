(function () {
  var STORAGE_KEY = 'crm_col_widths_v1';
  // Sabit mod, genişlikleri piksel yerine YÜZDE olarak saklar — eski
  // px tabanlı kayıtlarla karışmaması için ayrı bir anahtar kullanılır.
  var FIXED_STORAGE_KEY = 'crm_col_widths_fixed_pct_v1';
  var MIN_W = 60;

  function loadAllFrom(key) {
    try { return JSON.parse(localStorage.getItem(key) || '{}'); }
    catch (e) { return {}; }
  }

  function loadAll() { return loadAllFrom(STORAGE_KEY); }
  function loadAllFixed() { return loadAllFrom(FIXED_STORAGE_KEY); }

  function saveWidth(tableKey, colIndex, width) {
    var all = loadAll();
    if (!all[tableKey]) all[tableKey] = {};
    all[tableKey][colIndex] = width;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }

  function saveWidthsFixed(tableKey, updates) {
    var all = loadAllFixed();
    if (!all[tableKey]) all[tableKey] = {};
    Object.keys(updates).forEach(function (idx) { all[tableKey][idx] = updates[idx]; });
    localStorage.setItem(FIXED_STORAGE_KEY, JSON.stringify(all));
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
  //
  // ÖNEMLİ: Tablonun kendi toplam genişliği HİÇBİR ZAMAN piksele sabitlenmez
  // — CSS'teki width:100% kuralı geçerliliğini korur, tablo her zaman
  // .table-wrap konteynerini tam doldurur. Bunun yerine sadece sütunlar
  // ARASI ORAN (%) kilitlenir. Bu sayede:
  //   - Kenar çubuğu açılıp kapansa, pencere yeniden boyutlansa da tablo
  //     asla container'dan dar kalıp sağda boşluk bırakmaz.
  //   - Akordeon açıldığında içine gömülen geniş detay tablosu, dış tabloyu
  //     asla container dışına taşıramaz (table-layout:fixed + sabit genişlik
  //     sayesinde sığmayan içerik hücre içinde kırpılır, tablo büyümez).
  // Tutamak sürüklenince SADECE sol ve sağındaki iki sütunun oranı değişir,
  // toplam (%) sabit kalır. Çift tık = o iki sütunu varsayılan oranına
  // geri döndürür.
  function lockFixed(table, tableKey, ths) {
    if (table.dataset.layoutLocked) return;
    var stored = loadAllFixed()[tableKey] || {};
    ths.forEach(function (th, i) {
      if (isCheckboxTh(th)) return;
      var pct = stored[i] ? Number(stored[i]) : Number(th.dataset.defaultPct);
      if (!pct) return;
      th.style.width = pct + '%';
      th.style.minWidth = pct + '%';
    });
    table.style.tableLayout = 'fixed';
    table.dataset.layoutLocked = '1';
  }

  function makeResizableFixed(table, tableKey) {
    var ths = table.querySelectorAll('thead th');
    var tableW = table.offsetWidth;

    // Doğal (ilk render) genişlik ORANLARINI kilitlemeden önce yakala.
    if (tableW > 0) {
      ths.forEach(function (th) {
        if (!th.dataset.defaultPct) {
          th.dataset.defaultPct = (th.offsetWidth / tableW * 100).toFixed(2);
        }
      });
    }

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

        var curTableW = table.offsetWidth || tableW;
        var startX = e.clientX;
        var startLeftPct = th.offsetWidth / curTableW * 100;
        var startRightPct = rightTh.offsetWidth / curTableW * 100;
        var pairTotalPct = startLeftPct + startRightPct;
        var minPct = Math.min(MIN_W / curTableW * 100, pairTotalPct / 2);
        var newLeftPct = startLeftPct, newRightPct = startRightPct;

        handle.classList.add('dragging');
        document.body.classList.add('col-resizing');

        function onMove(e) {
          var dxPct = (e.clientX - startX) / curTableW * 100;
          newLeftPct = Math.min(Math.max(startLeftPct + dxPct, minPct), pairTotalPct - minPct);
          newRightPct = pairTotalPct - newLeftPct;
          th.style.width = newLeftPct.toFixed(2) + '%'; th.style.minWidth = newLeftPct.toFixed(2) + '%';
          rightTh.style.width = newRightPct.toFixed(2) + '%'; rightTh.style.minWidth = newRightPct.toFixed(2) + '%';
        }

        function onUp() {
          handle.classList.remove('dragging');
          document.body.classList.remove('col-resizing');
          var updates = {};
          updates[index] = newLeftPct.toFixed(2);
          updates[index + 1] = newRightPct.toFixed(2);
          saveWidthsFixed(tableKey, updates);
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
        }

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      });

      handle.addEventListener('dblclick', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var defLeft = Number(th.dataset.defaultPct);
        var defRight = Number(rightTh.dataset.defaultPct);
        if (!defLeft || !defRight) return;
        th.style.width = defLeft + '%'; th.style.minWidth = defLeft + '%';
        rightTh.style.width = defRight + '%'; rightTh.style.minWidth = defRight + '%';
        var updates = {};
        updates[index] = defLeft;
        updates[index + 1] = defRight;
        saveWidthsFixed(tableKey, updates);
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
