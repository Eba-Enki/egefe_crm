(function () {
  // Bellek cache: portal_tur -> notlar dizisi
  var _cache = {};

  function cacheKey(portal, tur) { return portal + '_' + tur; }
  function getCached(portal, tur) { return _cache[cacheKey(portal, tur)] || null; }
  function setCached(portal, tur, notes) { _cache[cacheKey(portal, tur)] = notes; }
  function invalidate(portal, tur) { delete _cache[cacheKey(portal, tur)]; }

  function getNs() {
    return (typeof currentPortal !== 'undefined' && currentPortal === 'stok') ? 'stok' : 'db';
  }
  function getPortal() {
    return (typeof currentPortal !== 'undefined') ? currentPortal : 'servis';
  }
  function currentUserId() {
    return (typeof state !== 'undefined' && state.currentUser) ? String(state.currentUser.id) : null;
  }

  var _tabs = { db: 'kisisel', stok: 'kisisel' };

  function fmtTime(iso) {
    var d = new Date(iso), now = new Date(), diff = now - d;
    if (diff < 60000) return 'şimdi';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' dk önce';
    var today = now.toDateString(), yday = new Date(now);
    yday.setDate(yday.getDate() - 1);
    if (d.toDateString() === today) return 'bugün ' + d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === yday.toDateString()) return 'dün';
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
  }

  function safeEsc(str) {
    return typeof esc === 'function' ? esc(str) : String(str || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function buildNoteHtml(note, tab, ns, portal) {
    var isT  = tab === 'takim';
    var uid  = currentUserId();
    var isOwn = uid !== null && String(note.yazar_id) === uid;

    var repliesHtml = (note.cevaplar || []).map(function (r) {
      var isMyCevap = uid !== null && String(r.yazar_id) === uid;
      return '<div class="ni-reply"'
        + ' data-cevap-id="' + r.id + '"'
        + ' data-not-id="' + note.id + '"'
        + ' data-tab="' + tab + '"'
        + ' data-ns="' + ns + '"'
        + ' data-portal="' + portal + '">'
        + '<div class="ni-reply-meta">'
          + '<span class="ni-reply-author">' + safeEsc(r.yazar_ad) + '</span>'
          + '<span class="ni-reply-time">· ' + fmtTime(r.created_at) + '</span>'
          + (isMyCevap
              ? '<button class="ni-cevap-del" onclick="notlarDeleteCevap(this)" title="Sil">✕</button>'
              : '')
        + '</div>'
        + '<div class="ni-reply-text">' + safeEsc(r.metin) + '</div>'
        + '</div>';
    }).join('');

    return '<div class="ni" data-id="' + note.id + '" data-tab="' + tab + '" data-ns="' + ns + '" data-portal="' + portal + '">'
      + '<span class="ni-bul' + (isT ? ' t' : '') + '"></span>'
      + '<div class="ni-body">'
        + '<div class="ni-text">' + safeEsc(note.metin) + '</div>'
        + '<div class="ni-meta">'
          + (isT
              ? '<span class="ni-author t">' + safeEsc(note.yazar_ad) + '</span>'
                + '<span class="ni-time">· ' + fmtTime(note.created_at) + '</span>'
              : '<span class="ni-time">' + fmtTime(note.created_at) + '</span>')
          + (isT ? '<button class="ni-reply-btn" onclick="notlarToggleReply(this)">↩ cevapla</button>' : '')
        + '</div>'
        + (isT ? '<div class="ni-replies">' + repliesHtml + '</div>' : '')
        + (isT
            ? '<div class="ni-reply-form">'
                + '<textarea class="ni-reply-inp" rows="1" placeholder="Cevabınızı yazın..."></textarea>'
                + '<div class="ni-reply-btns">'
                  + '<button class="btn-cancel" onclick="notlarCancelReply(this)">İptal</button>'
                  + '<button class="btn-send" onclick="notlarSendReply(this)">Gönder</button>'
                + '</div>'
              + '</div>'
            : '')
      + '</div>'
      + (isOwn ? '<button class="ni-del" onclick="notlarDelete(this)" title="Sil">✕</button>' : '')
      + '</div>';
  }

  function renderList(ns, portal, tab, notes) {
    var el = document.getElementById('notlar-' + ns + '-' + tab);
    if (!el) return;
    if (!notes || !notes.length) {
      el.innerHTML = '<div style="padding:20px 14px;text-align:center;font-size:12px;color:var(--text3)">'
        + (tab === 'kisisel' ? 'Henüz kişisel not yok.' : 'Henüz takım notu yok.')
        + '</div>';
      return;
    }
    el.innerHTML = notes.map(function (n) { return buildNoteHtml(n, tab, ns, portal); }).join('');
  }

  function setLoading(ns, tab) {
    var el = document.getElementById('notlar-' + ns + '-' + tab);
    if (el) el.innerHTML = '<div style="padding:20px 14px;text-align:center;font-size:12px;color:var(--text3)">Yükleniyor...</div>';
  }

  function updateCounts(ns, portal) {
    var k = getCached(portal, 'kisisel') || [];
    var t = getCached(portal, 'takim')   || [];
    var ek = document.getElementById('notlar-' + ns + '-cnt-k');
    var et = document.getElementById('notlar-' + ns + '-cnt-t');
    if (ek) ek.textContent = k.length;
    if (et) et.textContent = t.length;
  }

  function updateTabVisibility(ns, tab) {
    var kl = document.getElementById('notlar-' + ns + '-kisisel');
    var tl = document.getElementById('notlar-' + ns + '-takim');
    if (kl) kl.style.display = tab === 'kisisel' ? '' : 'none';
    if (tl) tl.style.display = tab === 'takim'   ? '' : 'none';
    var iw  = document.getElementById('notlar-' + ns + '-iw');
    var inp = document.getElementById('notlar-' + ns + '-inp');
    if (iw)  iw.classList.toggle('t-active', tab === 'takim');
    if (inp) inp.placeholder = tab === 'takim' ? 'Takıma not bırak...' : 'Kişisel not ekle...';
  }

  async function fetchAndRender(ns, portal, tab) {
    setLoading(ns, tab);
    try {
      var res   = await apiGet('notlar?portal=' + portal + '&tur=' + tab);
      var notes = res.notlar || [];
      setCached(portal, tab, notes);
      renderList(ns, portal, tab, notes);
      updateCounts(ns, portal);
    } catch (e) {
      var el = document.getElementById('notlar-' + ns + '-' + tab);
      if (el) el.innerHTML = '<div style="padding:20px 14px;text-align:center;font-size:12px;color:var(--red)">Yüklenemedi.</div>';
    }
  }

  // ─── Public API ────────────────────────────────────────────────

  window.renderNotlar = async function () {
    var portal = getPortal();
    var ns     = getNs();
    var tab    = _tabs[ns] || 'kisisel';

    // Her iki sekmeyi paralel yükle; cache'i temizle (sayfa geçişinde taze veri)
    invalidate(portal, 'kisisel');
    invalidate(portal, 'takim');

    await Promise.all([
      fetchAndRender(ns, portal, 'kisisel'),
      fetchAndRender(ns, portal, 'takim'),
    ]);

    updateTabVisibility(ns, tab);
  };

  window.notlarSwitchTab = function (ns, tab) {
    _tabs[ns] = tab;
    var card = document.getElementById(ns === 'stok' ? 'stok-notlar-card' : 'db-notlar-card');
    if (card) card.querySelectorAll('.notlar-tab').forEach(function (el) {
      el.classList.toggle('active', el.dataset.tab === tab);
    });
    updateTabVisibility(ns, tab);
  };

  window.notlarAdd = async function (ns) {
    var inp = document.getElementById('notlar-' + ns + '-inp');
    if (!inp) return;
    var txt = inp.value.trim();
    if (!txt) return;
    var portal = getPortal();
    var tab    = _tabs[ns] || 'kisisel';

    inp.disabled = true;
    try {
      var res   = await apiPost('notlar', { portal: portal, tur: tab, metin: txt });
      var notes = getCached(portal, tab) || [];
      notes.unshift(res.not);
      setCached(portal, tab, notes);
      inp.value = '';
      inp.style.height = '';
      renderList(ns, portal, tab, notes);
      updateCounts(ns, portal);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Not eklenemedi.', 'error');
    } finally {
      inp.disabled = false;
    }
  };

  window.notlarDelete = async function (btn) {
    var ni     = btn.closest('.ni');
    var noteId = ni.dataset.id;
    var tab    = ni.dataset.tab;
    var ns     = ni.dataset.ns;
    var portal = ni.dataset.portal;

    try {
      await apiDelete('notlar?id=' + noteId);
      var notes = (getCached(portal, tab) || []).filter(function (n) {
        return String(n.id) !== String(noteId);
      });
      setCached(portal, tab, notes);
      renderList(ns, portal, tab, notes);
      updateCounts(ns, portal);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Not silinemedi.', 'error');
    }
  };

  window.notlarDeleteCevap = async function (btn) {
    var cevapEl = btn.closest('.ni-reply');
    var cevapId = cevapEl.dataset.cevapId;
    var notId   = cevapEl.dataset.notId;
    var tab     = cevapEl.dataset.tab;
    var ns      = cevapEl.dataset.ns;
    var portal  = cevapEl.dataset.portal;

    try {
      await apiDelete('notlar/cevaplar?id=' + cevapId);
      var notes = getCached(portal, tab) || [];
      var note  = notes.find(function (n) { return String(n.id) === String(notId); });
      if (note) {
        note.cevaplar = (note.cevaplar || []).filter(function (c) {
          return String(c.id) !== String(cevapId);
        });
      }
      renderList(ns, portal, tab, notes);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Cevap silinemedi.', 'error');
    }
  };

  window.notlarToggleReply = function (btn) {
    var form   = btn.closest('.ni-body').querySelector('.ni-reply-form');
    var isOpen = form.style.display === 'block';
    document.querySelectorAll('.ni-reply-form').forEach(function (f) { f.style.display = 'none'; });
    document.querySelectorAll('.ni-reply-btn').forEach(function (b) { b.classList.remove('on'); });
    if (!isOpen) {
      form.style.display = 'block';
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

  window.notlarSendReply = async function (btn) {
    var form   = btn.closest('.ni-reply-form');
    var inp    = form.querySelector('.ni-reply-inp');
    var txt    = inp.value.trim();
    if (!txt) return;
    var ni     = form.closest('.ni');
    var noteId = ni.dataset.id;
    var tab    = ni.dataset.tab;
    var ns     = ni.dataset.ns;
    var portal = ni.dataset.portal;

    btn.disabled = true;
    try {
      var res   = await apiPost('notlar/cevaplar', { not_id: parseInt(noteId, 10), metin: txt });
      var notes = getCached(portal, tab) || [];
      var note  = notes.find(function (n) { return String(n.id) === String(noteId); });
      if (note) {
        if (!note.cevaplar) note.cevaplar = [];
        note.cevaplar.push(res.cevap);
      }
      // renderList DOM'u yeniden oluşturur; form otomatik kapanır (display:none CSS)
      renderList(ns, portal, tab, notes);
    } catch (e) {
      if (typeof toast === 'function') toast(e.message || 'Cevap gönderilemedi.', 'error');
      btn.disabled = false;
    }
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
