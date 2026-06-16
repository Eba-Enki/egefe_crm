// Uygulama başlangıcı — tüm modüller yüklendikten sonra çalışır
window.addEventListener('DOMContentLoaded', function() {
  loadTheme();
  applyLogoForTheme();

  // Portal seçim ekranını göster
  document.getElementById('portal-screen').style.display = 'flex';
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('sidebar').style.display = 'none';
  document.getElementById('main').style.display = 'none';
});

var _lastVisibilityFetch = 0;
var _VISIBILITY_STALE_MS = 30000; // 30 saniye

// Form sayfaları — sekme geri dönüşünde yenilenmez (veri kaybı riski)
var _FORM_PAGES = new Set([
  'servis-form','teklif-form','musteri-form','urun-form',
  'siparis-form','ham-giris','ham-cikis','bitmis-giris',
  'bitmis-cikis','kullanici-form'
]);

var _STOK_PAGES = new Set([
  'stok-dashboard','ham-stok','ham-girisler','ham-cikislar',
  'bitmis-stok','bitmis-girisler','bitmis-cikislar',
  'stok-ayarlar','stok-parametreler'
]);

document.addEventListener('visibilitychange', function() {
  if (document.hidden) return;
  if (!state.currentUser) return;
  if (typeof _formDirty !== 'undefined' && _formDirty) return;
  if (Date.now() - _lastVisibilityFetch < _VISIBILITY_STALE_MS) return;
  if (!_currentPageId || _FORM_PAGES.has(_currentPageId)) return;
  if (_STOK_PAGES.has(_currentPageId)) return;
  _lastVisibilityFetch = Date.now();
  showPage(_currentPageId);
});

function initApp() {
  document.getElementById('sidebar').style.display = '';
  document.getElementById('main').style.display = '';
  document.getElementById('portal-screen').style.display = 'none';
  document.getElementById('login-screen').style.display = 'none';
  renderFooter();
  _startAutoLogout();
  _lastVisibilityFetch = Date.now();
}

// Portal seçildiğinde/giriş yapıldığında, formlardaki müşteri/servis
// kombo kutuları ve dashboard istatistikleri için temel verileri önceden yükler.
async function loadCoreData() {
  if (currentPortal === 'stok') return;

  var portal = currentPortal;

  // Tüm portallerde ortak istekler
  var requests = [
    apiGet(portal + '/ayarlar').catch(function() { return {}; }),
    apiGet('musteriler').catch(function() { return {}; }),
    apiGet('urunler?portal=' + portal).catch(function() { return {}; }),
    apiGet('teklifler?portal=' + portal).catch(function() { return {}; })
  ];

  // Portale özgü ek istekler
  if (portal === 'servis') {
    requests.push(apiGet('servisler').catch(function() { return {}; }));
  }
  if (portal === 'satis') {
    requests.push(apiGet('siparisler').catch(function() { return {}; }));
    requests.push(apiGet('faturalar').catch(function() { return {}; }));
  }

  var sonuc = await Promise.all(requests);

  var apiSettings = (sonuc[0].ayarlar) || {};
  state.settings = Object.assign({}, state.settings, apiSettings);
  if (!state.settings.parametreler) state.settings.parametreler = [];
  if (!state.settings.urunKategoriler) state.settings.urunKategoriler = [];

  state.musteriler = sonuc[1].musteriler || [];
  state.urunler    = sonuc[2].urunler    || [];
  state.teklifler  = sonuc[3].teklifler  || [];

  if (portal === 'servis') {
    state.servisler = (sonuc[4] && sonuc[4].servisler) || [];
  }
  if (portal === 'satis') {
    state.siparisler = (sonuc[4] && sonuc[4].siparisler) || [];
    state.faturalar  = (sonuc[5] && sonuc[5].faturalar)  || [];
  }

  if (_currentPageId === 'dashboard') renderDashboard();
}
