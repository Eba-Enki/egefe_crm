(function () {
  // Her portal için ayrı depolama: crm_notlar_v1_servis / _satis / _stok
  function storageKey(portal) {
    return 'crm_notlar_v1_' + portal;
  }
  function loadNotes(portal) {
    try { return JSON.parse(localStorage.getItem(storageKey(portal)) || '{"kisisel":[],"takim":[]}'); }
    catch (e) { return { kisisel: [], takim: [] }; }
  }
  function saveNotes(portal, notes) {
    localStorage.setItem(storageKey(portal), JSON.stringify(notes));
  }

  // 'db' → servis veya satis portalleri, 'stok' → stok portali
  function getNs() {
    return (typeof currentPortal !== 'undefined' && currentPortal === 'stok') ? 'stok' : 'db';
  }
  function getPortal() {
    return (typeof currentPortal !== 'undefined') ? currentPortal : 'servis';
  }
  function currentUserAd() {
    return (typeof state !== 'undefined' && state.currentUser && state.currentUser.ad)
      ? state.currentUser.ad : 'Kullanıcı';
  }

  // Aktif sekme her namespace için ayrı tutulur
  var _tabs = { db: 'kisisel', stok: 'kisisel' };

  function fmtTime(iso) {
    var d = new Date(iso), now = new Date(), diff = now - d;
    if (diff < 60000) return 'şimdi';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' dk önce';
    var today = now.toDateString(), yday = new Date(now); yday.setDate(yday.getDate() - 1);
    if (d.toDateString() === today) return 'bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === yday.toDateString()) return 'dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  function safeEsc(str) {
    return typeof esc === 'function' ? esc(str) : String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildNoteHtml(note, tab, ns, portal) {
    var isT = tab === 'takim';
    var repliesHtml = (note.replies || []).map(function (r) {
      return '<div class="ni-reply">'
        + '<div class="ni-reply-meta"><span class="ni-reply-author">' + safeEsc(r.author) + '</span>'
        + '<span class="ni-reply-time">· ' + fmtTime(r.time) + '</span></div>'
        + '<div class="ni-reply-text">' + safeEsc(r.text) + '</div>'
        + '</div>';
    }).join('');

    return '<div class="ni" data-id="' + note.id + '" data-tab="' + tab + '" data-ns="' + ns + '" data-portal="' + portal + '">'
      + '<span class="ni-bul' + (isT ? ' t' : '') + '"></span>'
      + '<div class="ni-body">'
        + '<div class="ni-text">' + safeEsc(note.text) + '</div>'
        + '<div class="ni-meta">'
          + (isT ? '<span class="ni-author t">' + safeEsc(note.author) + '</span><span class="ni-time">· ' + fmtTime(note.time) + '</span>' : '<span class="ni-time">' + fmtTime(note.time) + '</span>')
          + (isT ? '<button class="ni-reply-btn" onclick="notlarToggleReply(this)">↩ cevapla</button>' : '')
        + '</div>'
        + (isT ? '<div class="ni-replies">' + repliesHtml + '</div>' : '')
        + (isT ? '<div class="ni-reply-form" style="display:none">'
            + '<textarea class="ni-reply-inp" rows="1" placeholder="Cevabınızı yazın..."></textarea>'
            + '<div class="ni-reply-btns">'
              + '<button class="btn-cancel" onclick="notlarCancelReply(this)">İptal</button>'
              + '<button class="btn-send" onclick="notlarSendReply(this)">Gönder</button>'
            + '</div></div>' : '')
      + '</div>'
      + (note.isOwn !== false ? '<button class="ni-del" onclick="notlarDelete(this)" title="Sil">✕</button>' : '')
      + '</div>';
  }

  function renderList(ns, portal, tab) {
    var el = document.getElementById('notlar-' + ns + '-' + tab);
    if (!el) return;
    var notes = (loadNotes(portal)[tab] || []).slice().reverse();
    if (!notes.length) {
      el.innerHTML = '<div style="padding:20px 14px;text-align:center;font-size:12px;color:var(--text3)">'
        + (tab === 'kisisel' ? 'Henüz kişisel not yok.' : 'Henüz takım notu yok.') + '</div>';
      return;
    }
    el.innerHTML = notes.map(function (n) { return buildNoteHtml(n, tab, ns, portal); }).join('');
  }

  function updateCounts(ns, portal) {
    var notes = loadNotes(portal);
    var ek = document.getElementById('notlar-' + ns + '-cnt-k');
    var et = document.getElementById('notlar-' + ns + '-cnt-t');
    if (ek) ek.textContent = (notes.kisisel || []).length;
    if (et) et.textContent = (notes.takim || []).length;
  }

  // ─── Public API ────────────────────────────────────────────────

  window.renderNotlar = function () {
    var portal = getPortal();
    var ns     = getNs();
    var tab    = _tabs[ns] || 'kisisel';
    renderList(ns, portal, 'kisisel');
    renderList(ns, portal, 'takim');
    updateCounts(ns, portal);
    // Sekme görünürlüğü
    var kl = document.getElementById('notlar-' + ns + '-kisisel');
    var tl = document.getElementById('notlar-' + ns + '-takim');
    if (kl) kl.style.display = tab === 'kisisel' ? '' : 'none';
    if (tl) tl.style.display = tab === 'takim'   ? '' : 'none';
    // Input wrap rengi
    var iw = document.getElementById('notlar-' + ns + '-iw');
    if (iw) iw.classList.toggle('t-active', tab === 'takim');
    var inp = document.getElementById('notlar-' + ns + '-inp');
    if (inp) inp.placeholder = tab === 'takim' ? 'Takıma not bırak...' : 'Kişisel not ekle...';
  };

  window.notlarSwitchTab = function (ns, tab) {
    _tabs[ns] = tab;
    // Sekme butonları
    var card = document.getElementById(ns === 'stok' ? 'stok-notlar-card' : 'db-notlar-card');
    if (card) card.querySelectorAll('.notlar-tab').forEach(function (el) {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    // Liste görünürlüğü
    var kl = document.getElementById('notlar-' + ns + '-kisisel');
    var tl = document.getElementById('notlar-' + ns + '-takim');
    if (kl) kl.style.display = tab === 'kisisel' ? '' : 'none';
    if (tl) tl.style.display = tab === 'takim'   ? '' : 'none';
    // Input
    var iw  = document.getElementById('notlar-' + ns + '-iw');
    var inp = document.getElementById('notlar-' + ns + '-inp');
    if (iw)  iw.classList.toggle('t-active', tab === 'takim');
    if (inp) inp.placeholder = tab === 'takim' ? 'Takıma not bırak...' : 'Kişisel not ekle...';
  };

  window.notlarAdd = function (ns) {
    var inp = document.getElementById('notlar-' + ns + '-inp');
    if (!inp) return;
    var txt = inp.value.trim();
    if (!txt) return;
    var portal = getPortal();
    var tab    = _tabs[ns] || 'kisisel';
    var notes  = loadNotes(portal);
    notes[tab].push({
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text:    txt,
      time:    new Date().toISOString(),
      isOwn:   true,
      author:  currentUserAd(),
      replies: []
    });
    saveNotes(portal, notes);
    inp.value = '';
    inp.style.height = '';
    renderList(ns, portal, tab);
    updateCounts(ns, portal);
  };

  window.notlarDelete = function (btn) {
    var ni     = btn.closest('.ni');
    var noteId = ni.dataset.id;
    var tab    = ni.dataset.tab;
    var ns     = ni.dataset.ns;
    var portal = ni.dataset.portal;
    var notes  = loadNotes(portal);
    notes[tab] = notes[tab].filter(function (n) { return n.id !== noteId; });
    saveNotes(portal, notes);
    renderList(ns, portal, tab);
    updateCounts(ns, portal);
  };

  window.notlarToggleReply = function (btn) {
    var form   = btn.closest('.ni-body').querySelector('.ni-reply-form');
    var isOpen = form.style.display === '';
    // Tüm açık formları kapat
    document.querySelectorAll('.ni-reply-form').forEach(function (f) { f.style.display = 'none'; });
    document.querySelectorAll('.ni-reply-btn').forEach(function (b) { b.classList.remove('on'); });
    if (!isOpen) {
      form.style.display = '';
      btn.classList.add('on');
      form.querySelector('.ni-reply-inp').focus();
    }
  };

  window.notlarCancelReply = function (btn) {
    var form = btn.closest('.ni-reply-form');
    form.querySelector('.ni-reply-inp').value = '';
    form.style.display = 'none';
    var rb = form.closest('.ni-body').querySelector('.ni-reply-btn');
    if (rb) rb.classList.remove('on');
  };

  window.notlarSendReply = function (btn) {
    var form   = btn.closest('.ni-reply-form');
    var inp    = form.querySelector('.ni-reply-inp');
    var txt    = inp.value.trim();
    if (!txt) return;
    var ni     = form.closest('.ni');
    var noteId = ni.dataset.id;
    var tab    = ni.dataset.tab;
    var ns     = ni.dataset.ns;
    var portal = ni.dataset.portal;
    var notes  = loadNotes(portal);
    var note   = notes[tab].find(function (n) { return n.id === noteId; });
    if (!note) return;
    if (!note.replies) note.replies = [];
    note.replies.push({
      author: currentUserAd(),
      time:   new Date().toISOString(),
      text:   txt
    });
    saveNotes(portal, notes);
    renderList(ns, portal, tab);
    updateCounts(ns, portal);
  };

  // Textarea otomatik yükseklik
  document.addEventListener('input', function (e) {
    if (e.target.classList.contains('notlar-input') || e.target.classList.contains('ni-reply-inp')) {
      e.target.style.height = '';
      e.target.style.height = Math.min(e.target.scrollHeight, 80) + 'px';
    }
  });
  // Enter → Ekle (Shift+Enter = yeni satır)
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && e.target.classList.contains('notlar-input')) {
      e.preventDefault();
      var ns = e.target.id.replace('notlar-', '').replace('-inp', '');
      notlarAdd(ns);
    }
  });
}());
