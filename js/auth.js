// ─── GLOBAL KULLANICI YAPISI ──────────────────────────────────────────────────

var PORTAL_SAYFALAR = {
  servis: [
    {id:'dashboard',      label:'Dashboard'},
    {id:'servisler',      label:'Servisler'},
    {id:'teklifler',      label:'Teklifler'},
    {id:'tutanaklar',     label:'Tutanaklar'},
    {id:'musteriler',     label:'Müşteriler'},
    {id:'urunler',        label:'Ürünler'},
    {id:'ayarlar',        label:'Ayarlar'}
  ],
  satis: [
    {id:'dashboard',      label:'Dashboard'},
    {id:'teklifler',      label:'Teklifler'},
    {id:'siparisler',     label:'Siparişler'},
    {id:'faturalar',      label:'Faturalar'},
    {id:'musteriler',     label:'Müşteriler'},
    {id:'urunler',        label:'Ürünler'},
    {id:'ayarlar',        label:'Ayarlar'}
  ],
  stok: [
    {id:'stok-dashboard', label:'Dashboard'},
    {id:'ham-stok',       label:'Sheet & Strip Stok Listesi'},
    {id:'ham-girisler',   label:'Sheet & Strip Girişler'},
    {id:'ham-cikislar',   label:'Sheet & Strip Çıkışlar'},
    {id:'stok-parametreler', label:'Parametre Listesi'},
    {id:'bitmis-stok',    label:'Hazır Ürün Stok Listesi'},
    {id:'bitmis-girisler',label:'Hazır Ürün Girişler'},
    {id:'bitmis-cikislar',label:'Hazır Ürün Çıkışlar'},
    {id:'stok-ayarlar',   label:'Ayarlar'}
  ]
};

function _allSayfalar(portal){
  return (PORTAL_SAYFALAR[portal]||[]).map(function(p){return p.id;});
}

function _userCanAccessPortal(user, portal){
  if(user.rol==='yönetici'||user.rol==='admin') return true;
  return !!(user.izinler&&user.izinler[portal]&&user.izinler[portal].erisim);
}

// ─── PORTAL SEÇİM ────────────────────────────────────────────────────────────

async function selectPortal(pkey){
  currentPortal=pkey;
  document.documentElement.setAttribute('data-portal',pkey);

  if(pkey==='stok'){
    _stokDataLoaded=false;
    state.settings={};
    state.hamStokGirisler=[];
    state.hamStokLotlar=[];
    state.hamStokCikislar=[];
    state.bitmisStokGirisler=[];
    state.bitmisStokLotlar=[];
    state.bitmisCikislar=[];
    state.stokSettings=null;
    savedTutanaklar=[];
  } else {
    state.servisler=[];
    state.teklifler=[];
    state.musteriler=[];
    state.urunler=[];
    state.siparisler=[];
    state.faturalar=[];
    state.settings={firma:'',tel:'',faks:'',adres:'',email:'',web:'',parametreler:[]};

    savedTutanaklar=[];
  }

  document.getElementById('portal-screen').style.display='none';

  var found=null;
  try{
    var res=await apiGet('auth/me.php');
    found=res.user;
  }catch(e){}

  if(found&&_userCanAccessPortal(found,pkey)){
    state.currentUser=found;
    applyUser(found);
    applyPortal();
    _applyPageRestrictions(found);
    initApp();
    loadCoreData();
    return;
  }

  var nameEl=document.getElementById('login-portal-name');
  if(nameEl)nameEl.textContent=pkey==='servis'?'Teknik Servis Portalı':pkey==='satis'?'Satış Pazarlama Portalı':'Stok Yönetim Portalı';
  document.getElementById('login-screen').style.display='flex';
}

async function selectSistemYonetimi(){
  currentPortal='sistem';
  document.documentElement.setAttribute('data-portal','sistem');

  document.getElementById('portal-screen').style.display='none';

  var found=null;
  try{
    var res=await apiGet('auth/me.php');
    found=res.user;
  }catch(e){}

  if(found&&found.rol==='yönetici'){
    state.currentUser=found;
    showSistemScreen(found);
    return;
  }

  var nameEl=document.getElementById('login-portal-name');
  if(nameEl)nameEl.textContent='Sistem Yönetimi';
  document.getElementById('login-screen').style.display='flex';
}

// ─── LOGIN / LOGOUT ──────────────────────────────────────────────────────────

function backToPortal(){
  document.documentElement.removeAttribute('data-portal');
  document.getElementById('login-screen').style.display='none';
  document.getElementById('portal-screen').style.display='flex';
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  var errEl=document.getElementById('login-error');
  if(errEl){errEl.style.display='none';errEl.textContent='Kullanıcı adı veya şifre hatalı.';}
  currentPortal='';
}

function applyPortal(){
  var isServis=currentPortal==='servis';
  var isSatis=currentPortal==='satis';
  var isStok=currentPortal==='stok';
  document.querySelectorAll('.servis-only').forEach(function(el){el.style.display=isServis?'':'none';});
  document.querySelectorAll('.satis-only').forEach(function(el){el.style.display=isSatis?'':'none';});
  document.querySelectorAll('.stok-only').forEach(function(el){el.style.display=isStok?'':'none';});
  document.querySelectorAll('.crm-only').forEach(function(el){el.style.display=isStok?'none':'';});
  var badge=document.getElementById('portal-badge');
  if(badge){
    badge.textContent=isServis?'Teknik Servis':isSatis?'Satış & Pazarlama':'Stok Yönetim';
    badge.className='portal-badge '+(isServis?'portal-badge-servis':isSatis?'portal-badge-satis':'portal-badge-stok');
  }
  document.querySelectorAll('.tf-servis-field').forEach(function(el){el.style.display=isServis?'':'none';});
  document.querySelectorAll('.tf-satis-field').forEach(function(el){el.style.display=isSatis?'':'none';});
  var defaultPage=isStok?'stok-dashboard':'dashboard';
  showPage(defaultPage);
  renderPortalSwitcher();
}

function renderPortalSwitcher(){
  var wrap=document.getElementById('portal-switcher-wrap');
  if(!wrap||!state.currentUser)return;
  var authorized=['servis','satis','stok'].filter(function(p){return _userCanAccessPortal(state.currentUser,p);});
  if(authorized.length<2){wrap.style.display='none';return;}
  wrap.style.display='';
  var label=document.getElementById('portal-switch-label');
  var labels={servis:'Teknik Servis',satis:'Satış Pazarlama',stok:'Stok Yönetim'};
  if(label)label.textContent=labels[currentPortal]||currentPortal;
}

function togglePortalSwitcher(e){
  e.stopPropagation();
  var panel=document.getElementById('portal-switch-panel');
  var btn=document.getElementById('portal-switch-btn');
  if(!panel||!btn)return;
  if(panel.style.display==='none'||!panel.style.display){
    var authorized=['servis','satis','stok'].filter(function(p){return _userCanAccessPortal(state.currentUser,p);});
    var labels={servis:'Teknik Servis Portalı',satis:'Satış Pazarlama Portalı',stok:'Stok Yönetim Portalı'};
    panel.innerHTML='<div style="padding:4px">'+authorized.map(function(p){
      var isActive=p===currentPortal;
      return '<div '+(isActive?'':'onclick="switchToPortal(\''+p+'\')"')+' style="display:flex;align-items:center;padding:9px 12px;border-radius:4px;cursor:'+(isActive?'default':'pointer')+';background:'+(isActive?'var(--bg3)':'transparent')+'" '+(isActive?'':' onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'transparent\'"')+'>'
        +'<span style="font-size:12px;font-weight:'+(isActive?'600':'400')+';color:'+(isActive?'var(--text)':'var(--text2)')+'">'+labels[p]+'</span>'
      +'</div>';
    }).join('')+'</div>';
    var rect=btn.getBoundingClientRect();
    panel.style.top=(rect.bottom+4)+'px';
    panel.style.left=rect.left+'px';
    panel.style.width=rect.width+'px';
    panel.style.display='';
  } else {
    panel.style.display='none';
  }
}

document.addEventListener('click',function(){
  var panel=document.getElementById('portal-switch-panel');
  if(panel&&panel.style.display!=='none')panel.style.display='none';
});

function switchToPortal(pkey){
  var panel=document.getElementById('portal-switch-panel');
  if(panel)panel.style.display='none';
  if(!state.currentUser||!_userCanAccessPortal(state.currentUser,pkey)||pkey===currentPortal)return;
  currentPortal=pkey;
  document.documentElement.setAttribute('data-portal',pkey);
  if(pkey==='stok'){
    _stokDataLoaded=false;
    state.settings={};
    state.hamStokGirisler=[];
    state.hamStokLotlar=[];
    state.hamStokCikislar=[];
    state.bitmisStokGirisler=[];
    state.bitmisStokLotlar=[];
    state.bitmisCikislar=[];
    state.stokSettings=null;
    savedTutanaklar=[];
  } else {
    state.servisler=[];
    state.teklifler=[];
    state.musteriler=[];
    state.urunler=[];
    state.siparisler=[];
    state.faturalar=[];
    state.settings={firma:'',tel:'',faks:'',adres:'',email:'',web:'',parametreler:[]};

    savedTutanaklar=[];
  }
  applyUser(state.currentUser);
  applyPortal();
  _applyPageRestrictions(state.currentUser);
  initApp();
  loadCoreData();
}

function applyUser(u){
  var avatarEl=document.getElementById('sb-avatar');
  var unameEl=document.getElementById('sb-username');
  var roleEl=document.getElementById('sb-role-text');
  if(avatarEl)avatarEl.textContent=u.ad[0].toUpperCase();
  if(unameEl)unameEl.textContent=u.ad;
  var rolLabel={yönetici:'Yönetici','kullanıcı':'Kullanıcı',izleyici:'İzleyici',admin:'Yönetici',teknisyen:'Kullanıcı'}[u.rol]||u.rol;
  if(roleEl)roleEl.textContent=rolLabel;
  var isAdmin=u.rol==='yönetici'||u.rol==='admin';
  document.querySelectorAll('.admin-only').forEach(function(el){el.style.display=isAdmin?'':'none';});
  document.querySelectorAll('.can-write').forEach(function(el){el.style.display=u.rol==='izleyici'?'none':'';});
}

// ─── PROFİLİM (kendi bilgilerim / şifre değiştir) ─────────────────────────────

function openProfileModal(){
  var u=state.currentUser;
  if(!u)return;
  var rolLabel={yönetici:'Yönetici','kullanıcı':'Kullanıcı',izleyici:'İzleyici',admin:'Yönetici',teknisyen:'Kullanıcı'}[u.rol]||u.rol;
  document.getElementById('pf-ad').textContent=u.ad;
  document.getElementById('pf-username').textContent=u.username;
  document.getElementById('pf-rol').textContent=rolLabel;
  var songirisEl=document.getElementById('pf-songiris');
  if(songirisEl){
    songirisEl.textContent=u.sonGiris?new Date(u.sonGiris.replace(' ','T')).toLocaleString('tr-TR'):'—';
  }
  document.getElementById('pf-current-pass').value='';
  document.getElementById('pf-new-pass').value='';
  document.getElementById('pf-new-pass2').value='';
  var errEl=document.getElementById('pf-pass-error');
  errEl.style.display='none';
  errEl.textContent='';
  openModal('modal-profile');
}

async function saveOwnPassword(){
  var current=document.getElementById('pf-current-pass').value;
  var n1=document.getElementById('pf-new-pass').value;
  var n2=document.getElementById('pf-new-pass2').value;
  var errEl=document.getElementById('pf-pass-error');
  var showErr=function(msg){errEl.textContent=msg;errEl.style.display='block';};
  errEl.style.display='none';

  if(!current||!n1||!n2) return showErr('Tüm şifre alanları zorunludur.');
  if(n1.length<4) return showErr('Yeni şifre en az 4 karakter olmalıdır.');
  if(n1!==n2) return showErr('Yeni şifreler birbiriyle eşleşmiyor.');
  if(n1===current) return showErr('Yeni şifre, mevcut şifreyle aynı olamaz.');

  try{
    await apiPut('auth/profile.php',{currentPassword:current,newPassword:n1});
  }catch(e){
    return showErr(e.message||'Şifre güncellenemedi.');
  }
  closeModal('modal-profile');
  toast('Şifreniz güncellendi.','success');
}

function _applyPageRestrictions(u){
  if(!u) return;
  var isAdmin=u.rol==='yönetici'||u.rol==='admin';
  if(isAdmin) return;
  if(!u.izinler||!currentPortal||!u.izinler[currentPortal]) return;
  var allowedPages=u.izinler[currentPortal].sayfalar||[];
  document.querySelectorAll('.sb-item[data-page]').forEach(function(el){
    if(el.style.display!=='none'&&!allowedPages.includes(el.dataset.page)){
      el.style.display='none';
    }
  });
}

async function doLogin(){
  var loginBtn=document.querySelector('#login-screen .btn-primary');
  if(loginBtn&&loginBtn.disabled)return;
  if(loginBtn){loginBtn.disabled=true;loginBtn.textContent='Giriş yapılıyor…';}
  try{await _doLoginAsync();}finally{
    if(loginBtn){loginBtn.disabled=false;loginBtn.innerHTML='Giriş Yap <i class="ti ti-arrow-narrow-right"></i>';}
  }
}
async function _doLoginAsync(){
  var u=document.getElementById('login-user').value.trim();
  var p=document.getElementById('login-pass').value;
  var errEl=document.getElementById('login-error');

  var user;
  try{
    var res=await apiPost('auth/login.php',{username:u,password:p});
    user=res.user;
  }catch(e){
    errEl.textContent=e.status===401?'Kullanıcı adı veya şifre hatalı.':(e.message||'Giriş başarısız.');
    errEl.style.display='block';
    return;
  }

  if(currentPortal==='sistem'){
    if(user.rol!=='yönetici'){
      errEl.textContent='Sistem Yönetimi için yönetici yetkisi gerekli.';
      errEl.style.display='block';
      return;
    }
  } else if(!_userCanAccessPortal(user,currentPortal)){
    errEl.textContent='Bu portala erişim yetkiniz bulunmuyor.';
    errEl.style.display='block';
    return;
  }
  errEl.style.display='none';
  state.currentUser=user;
  document.getElementById('login-screen').style.display='none';
  if(currentPortal==='sistem'){
    showSistemScreen(user);
  } else {
    applyUser(user);
    applyPortal();
    _applyPageRestrictions(user);
    initApp();
    loadCoreData();
  }
}

async function _performLogout(){
  try{await apiPost('auth/logout.php');}catch(e){}
  var wasSistem=currentPortal==='sistem';
  document.documentElement.removeAttribute('data-portal');
  if(typeof _autoLogoutTimer!=='undefined'&&_autoLogoutTimer){clearInterval(_autoLogoutTimer);_autoLogoutTimer=null;}
  var sw=document.getElementById('portal-switcher-wrap');if(sw)sw.style.display='none';
  state.currentUser=null;
  currentPortal='';
  if(wasSistem){
    var ss=document.getElementById('sistem-screen');
    if(ss)ss.style.display='none';
  }
  document.getElementById('login-screen').style.display='none';
  document.getElementById('portal-screen').style.display='flex';
}
function doLogout(){
  showConfirm('Çıkış yapılsın mı?',function(){
    _performLogout();
  },{title:'Çıkış',okText:'Evet',okClass:'btn-primary'});
}

document.getElementById('login-pass').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
document.getElementById('login-user').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('login-pass').focus();});

// ════ NAV ════
