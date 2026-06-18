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

  try {
    var resAy = await apiGet(currentPortal + '/ayarlar');
    var apiSettings = resAy.ayarlar || {};
    state.settings = Object.assign({}, state.settings, apiSettings);
    if (!state.settings.parametreler) state.settings.parametreler = [];
    if (!state.settings.urunKategoriler) state.settings.urunKategoriler = [];
  } catch (e) {}

  try {
    var res = await apiGet('musteriler?portal=' + currentPortal);
    state.musteriler = res.musteriler || [];
  } catch (e) {
    state.musteriler = state.musteriler || [];
  }

  if (currentPortal === 'servis') {
    try {
      var res2 = await apiGet('servisler');
      state.servisler = res2.servisler || [];
    } catch (e) {
      state.servisler = state.servisler || [];
    }
  }

  try {
    var res3 = await apiGet('urunler?portal=' + currentPortal);
    state.urunler = res3.urunler || [];
  } catch (e) {
    state.urunler = state.urunler || [];
  }

  try {
    var res4 = await apiGet('teklifler?portal=' + currentPortal);
    state.teklifler = res4.teklifler || [];
  } catch (e) {
    state.teklifler = state.teklifler || [];
  }

  if (currentPortal === 'satis') {
    try {
      var res5 = await apiGet('siparisler');
      state.siparisler = res5.siparisler || [];
    } catch (e) {
      state.siparisler = state.siparisler || [];
    }

    try {
      var res6 = await apiGet('faturalar');
      state.faturalar = res6.faturalar || [];
    } catch (e) {
      state.faturalar = state.faturalar || [];
    }
  }

  if (_currentPageId === 'dashboard') renderDashboard();
}
