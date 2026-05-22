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
