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

var DEFAULT_GLOBAL_USERS = [
  {
    id:'gu1', ad:'Admin', username:'admin', sifre:'admin', rol:'yönetici', email:'', sonGiris:null,
    izinler:{
      servis:{erisim:true, sayfalar:_allSayfalar('servis')},
      satis: {erisim:true, sayfalar:_allSayfalar('satis')},
      stok:  {erisim:true, sayfalar:_allSayfalar('stok')}
    }
  }
];

function loadGlobalUsers(){
  return DB.load('ege_global_users', DEFAULT_GLOBAL_USERS);
}
function saveGlobalUsers(){
  DB.save('ege_global_users', state.users);
}

function _userCanAccessPortal(user, portal){
  if(user.rol==='yönetici'||user.rol==='admin') return true;
  return !!(user.izinler&&user.izinler[portal]&&user.izinler[portal].erisim);
}

function _normalizeUser(u){
  // Ensure izinler structure exists for legacy users
  if(!u.izinler) u.izinler={
    servis:{erisim:true, sayfalar:_allSayfalar('servis')},
    satis: {erisim:true, sayfalar:_allSayfalar('satis')},
    stok:  {erisim:true, sayfalar:_allSayfalar('stok')}
  };
  ['servis','satis','stok'].forEach(function(p){
    if(!u.izinler[p]) u.izinler[p]={erisim:false,sayfalar:[]};
    if(!u.izinler[p].sayfalar) u.izinler[p].sayfalar=[];
  });
  // Normalize old roles
  if(u.rol==='admin') u.rol='yönetici';
  if(u.rol==='teknisyen') u.rol='kullanıcı';
  return u;
}

// ─── PORTAL SEÇİM ────────────────────────────────────────────────────────────

function selectPortal(pkey){
  currentPortal=pkey;
  document.documentElement.setAttribute('data-portal',pkey);
  state.users=loadGlobalUsers().map(_normalizeUser);

  if(pkey==='stok'){
    state.settings={};
    state.hamStokGirisler=DB.pload('hamStokGirisler',[]);
    state.hamStokLotlar=DB.pload('hamStokLotlar',[]);
    state.hamStokCikislar=DB.pload('hamStokCikislar',[]);
    state.bitmisStokGirisler=DB.pload('bitmisStokGirisler',[]);
    state.bitmisStokLotlar=DB.pload('bitmisStokLotlar',[]);
    state.bitmisCikislar=DB.pload('bitmisCikislar',[]);
    state.stokSettings=DB.pload('stokSettings',null);
    savedTutanaklar=[];
  } else {
    state.servisler=pkey==='servis'?DB.pload('servisler',genSample()):[];
    state.teklifler=DB.pload('teklifler',[]);
    state.musteriler=DB.pload('musteriler',[]);
    state.urunler=DB.pload('urunler',[]);
    state.siparisler=DB.pload('siparisler',[]);
    state.faturalar=DB.pload('faturalar',[]);
    state.settings=DB.pload('settings',{firma:'Egefe Teknik Servis',tel:'',faks:'',adres:'',email:'',web:'',parametreler:[]});
    if(!state.settings.parametreler)state.settings.parametreler=[];
    savedTutanaklar=[];
  }

  var saved=sessionStorage.getItem('ege_ses_'+pkey);
  if(saved){
    try{
      var sd=JSON.parse(saved);
      var found=state.users.find(function(x){return x.id===sd.id&&x.username===sd.username;});
      if(found&&_userCanAccessPortal(found,pkey)){
        state.currentUser=found;
        document.getElementById('portal-screen').style.display='none';
        applyUser(found);
        applyPortal();
        _applyPageRestrictions(found);
        initApp();
        return;
      }
    }catch(e){}
  }

  document.getElementById('portal-screen').style.display='none';
  var nameEl=document.getElementById('login-portal-name');
  if(nameEl)nameEl.textContent=pkey==='servis'?'Teknik Servis Portalı':pkey==='satis'?'Satış Pazarlama Portalı':'Stok Yönetim Portalı';
  document.getElementById('login-screen').style.display='flex';
}

function selectSistemYonetimi(){
  currentPortal='sistem';
  document.documentElement.setAttribute('data-portal','sistem');
  state.users=loadGlobalUsers().map(_normalizeUser);

  var saved=sessionStorage.getItem('ege_ses_sistem');
  if(saved){
    try{
      var sd=JSON.parse(saved);
      var found=state.users.find(function(x){return x.id===sd.id&&x.username===sd.username;});
      if(found&&(found.rol==='yönetici'||found.rol==='admin')){
        state.currentUser=found;
        document.getElementById('portal-screen').style.display='none';
        showSistemScreen(found);
        return;
      }
    }catch(e){}
  }

  document.getElementById('portal-screen').style.display='none';
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
  var sbpn=document.getElementById('sb-portal-name');
  if(sbpn)sbpn.textContent=isServis?'Teknik Servis Portalı':isSatis?'Satış Pazarlama Portalı':'Stok Yönetim Portalı';
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
  if(label)label.textContent=(labels[currentPortal]||currentPortal)+' ▾';
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
      return '<div '+(isActive?'':'onclick="switchToPortal(\''+p+'\')"')+' style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:4px;cursor:'+(isActive?'default':'pointer')+';background:'+(isActive?'var(--bg3)':'transparent')+'" '+(isActive?'':' onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'transparent\'"')+'>'
        +'<span style="width:14px;text-align:center;color:var(--accent);font-size:11px">'+(isActive?'✓':'')+'</span>'
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
    state.settings={};
    state.hamStokGirisler=DB.pload('hamStokGirisler',[]);
    state.hamStokLotlar=DB.pload('hamStokLotlar',[]);
    state.hamStokCikislar=DB.pload('hamStokCikislar',[]);
    state.bitmisStokGirisler=DB.pload('bitmisStokGirisler',[]);
    state.bitmisStokLotlar=DB.pload('bitmisStokLotlar',[]);
    state.bitmisCikislar=DB.pload('bitmisCikislar',[]);
    state.stokSettings=DB.pload('stokSettings',null);
    savedTutanaklar=[];
  } else {
    state.servisler=pkey==='servis'?DB.pload('servisler',genSample()):[];
    state.teklifler=DB.pload('teklifler',[]);
    state.musteriler=DB.pload('musteriler',[]);
    state.urunler=DB.pload('urunler',[]);
    state.siparisler=DB.pload('siparisler',[]);
    state.faturalar=DB.pload('faturalar',[]);
    state.settings=DB.pload('settings',{firma:'Egefe Teknik Servis',tel:'',faks:'',adres:'',email:'',web:'',parametreler:[]});
    if(!state.settings.parametreler)state.settings.parametreler=[];
    savedTutanaklar=[];
  }
  sessionStorage.setItem('ege_ses_'+pkey,JSON.stringify({id:state.currentUser.id,username:state.currentUser.username}));
  applyUser(state.currentUser);
  applyPortal();
  _applyPageRestrictions(state.currentUser);
  initApp();
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

function switchPortal(){
  showConfirm('Portala geri dönmek istiyor musunuz? Mevcut oturum kapatılacak.',function(){
    document.documentElement.removeAttribute('data-portal');
    sessionStorage.removeItem('ege_ses_'+currentPortal);
    state.currentUser=null;
    currentPortal='';
    document.getElementById('portal-screen').style.display='flex';
    var pg=document.getElementById('page-dashboard');
    if(pg)pg.classList.add('active');
  },{title:'Portal Değiştir',okText:'Evet',okClass:'btn-primary'});
}

function doLogin(){
  var u=document.getElementById('login-user').value.trim();
  var p=document.getElementById('login-pass').value;
  var errEl=document.getElementById('login-error');
  var user=state.users.find(function(x){return x.username===u&&x.sifre===p;});
  if(!user){
    errEl.textContent='Kullanıcı adı veya şifre hatalı.';
    errEl.style.display='block';
    return;
  }
  if(currentPortal==='sistem'){
    if(user.rol!=='yönetici'&&user.rol!=='admin'){
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
  errEl.textContent='Kullanıcı adı veya şifre hatalı.';
  user.sonGiris=new Date().toISOString();
  state.currentUser=user;
  saveGlobalUsers();
  sessionStorage.setItem('ege_ses_'+currentPortal,JSON.stringify({id:user.id,username:user.username}));
  document.getElementById('login-screen').style.display='none';
  if(currentPortal==='sistem'){
    showSistemScreen(user);
  } else {
    applyUser(user);
    applyPortal();
    _applyPageRestrictions(user);
    initApp();
  }
}

function doLogout(){
  showConfirm('Çıkış yapılsın mı?',function(){
    var wasSistem=currentPortal==='sistem';
    document.documentElement.removeAttribute('data-portal');
    ['servis','satis','stok','sistem'].forEach(function(p){sessionStorage.removeItem('ege_ses_'+p);});
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
  },{title:'Çıkış',okText:'Evet',okClass:'btn-primary'});
}

document.getElementById('login-pass').addEventListener('keydown',function(e){if(e.key==='Enter')doLogin();});
document.getElementById('login-user').addEventListener('keydown',function(e){if(e.key==='Enter')document.getElementById('login-pass').focus();});

// ════ NAV ════
