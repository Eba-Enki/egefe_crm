// ─── SİSTEM YÖNETİMİ ─────────────────────────────────────────────────────────

var _sistemEditId = null;

async function showSistemScreen(user){
  var ss = document.getElementById('sistem-screen');
  if(!ss) return;
  var nameEl = document.getElementById('sistem-user-name');
  if(nameEl) nameEl.textContent = user.ad;
  var autoInput = document.getElementById('autologout-input');
  if(autoInput) autoInput.value = localStorage.getItem('ege_autologout_min')||'30';
  ss.style.display = 'flex';
  applyLogoForTheme();
  await _loadSistemKullanicilar();
}

async function _loadSistemKullanicilar(){
  try{
    var res = await apiGet('kullanicilar');
    state.users = res.kullanicilar || [];
  }catch(e){
    toast(e.message||'Kullanıcılar yüklenemedi.','error');
    state.users = state.users || [];
  }
  renderSistemKullanicilar();
}

function saveAutoLogoutSetting(){
  var el = document.getElementById('autologout-input');
  var val = parseInt((el||{}).value)||30;
  if(val<5) val=5;
  if(val>480) val=480;
  if(el) el.value=val;
  localStorage.setItem('ege_autologout_min', String(val));
  if(typeof _startAutoLogout==='function') _startAutoLogout();
  toast('Otomatik çıkış süresi kaydedildi.','success');
}

function renderSistemKullanicilar(){
  var wrap = document.getElementById('sistem-users-wrap');
  if(!wrap) return;
  var users = state.users || [];
  var html = '<div class="sistem-list">';
  users.forEach(function(u){
    var isSelf = state.currentUser && u.id === state.currentUser.id;
    var rolLabel = {yönetici:'Yönetici','kullanıcı':'Kullanıcı',izleyici:'İzleyici'}[u.rol]||u.rol;
    var rolClass = u.rol==='yönetici'?'badge-green':u.rol==='izleyici'?'badge-gray':'badge-blue';
    var portalBadges = ['servis','satis','stok'].filter(function(p){
      return u.rol==='yönetici'||(u.izinler&&u.izinler[p]&&u.izinler[p].erisim);
    }).map(function(p){
      var lbl = p==='servis'?'Servis':p==='satis'?'Satış':'Stok';
      return '<span class="sistem-portal-chip">'+lbl+'</span>';
    }).join('');
    html += '<div class="sistem-user-row">'
      + '<div class="sistem-user-info">'
        + '<div class="sistem-user-avatar">'+u.ad[0].toUpperCase()+'</div>'
        + '<div>'
          + '<div class="sistem-user-name">'+_sEsc(u.ad)+'<span class="sistem-user-username">@'+_sEsc(u.username)+'</span></div>'
          + '<div class="sistem-user-meta">'
            + '<span class="badge '+rolClass+'">'+rolLabel+'</span>'
            + (portalBadges?'<span style="margin-left:8px">'+portalBadges+'</span>':'')
          + '</div>'
        + '</div>'
      + '</div>'
      + '<div class="action-row">'
        + '<button class="btn-icon" onclick="goSistemUserForm(\''+u.id+'\')"><img src="icons/edit_icon.png" alt="Düzenle" style="width:14px;height:14px;display:block"></button>'
        + (!isSelf?'<button class="btn-icon" style="color:var(--red)" onclick="silSistemUser(\''+u.id+'\')"><img src="icons/delete.png" alt="Sil" style="width:14px;height:14px;display:block"></button>':'')
      + '</div>'
    + '</div>';
  });
  html += '</div>';
  wrap.innerHTML = html;
}

function goSistemUserForm(editId){
  _sistemEditId = editId || null;
  var u = editId ? (state.users||[]).find(function(x){return x.id===editId;}) : null;

  var titleEl = document.getElementById('sistem-form-title');
  if(titleEl) titleEl.textContent = u ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı';

  var el = function(id){return document.getElementById(id);};
  if(el('sf-ad'))       el('sf-ad').value      = u ? u.ad : '';
  if(el('sf-username')) el('sf-username').value = u ? u.username : '';
  if(el('sf-sifre'))    el('sf-sifre').value    = '';
  if(el('sys-email'))    el('sys-email').value     = u ? (u.email||'') : '';
  if(el('sf-rol'))      el('sf-rol').value       = u ? u.rol : 'kullanıcı';

  _renderIzinMatrix(u);

  var list = document.getElementById('sistem-users-panel');
  var form = document.getElementById('sistem-form-panel');
  if(list) list.style.display = 'none';
  if(form) form.style.display = 'flex';
}

function _renderIzinMatrix(u){
  var wrap = document.getElementById('sf-izin-matrix');
  if(!wrap) return;
  var izinler = u && u.izinler ? u.izinler : null;
  var portalMeta = [
    {key:'servis', label:'Teknik Servis Portalı',    icon:'🔧'},
    {key:'satis',  label:'Satış Pazarlama Portalı', icon:'📊'},
    {key:'stok',   label:'Stok Yönetim Portalı',    icon:'📦'}
  ];
  var html = '';
  portalMeta.forEach(function(pm){
    var p = pm.key;
    var erisim = izinler ? !!(izinler[p]&&izinler[p].erisim) : true;
    var sayfalar = izinler&&izinler[p] ? (izinler[p].sayfalar||[]) : _allSayfalar(p);
    html += '<div class="sf-portal-block" id="sf-block-'+p+'">'
      + '<label class="sf-portal-header">'
        + '<input type="checkbox" id="sf-erisim-'+p+'" '+(erisim?'checked':'')+' onchange="sfTogglePortal(\''+p+'\')">'
        + '<span class="sf-portal-label">'+pm.icon+' '+pm.label+'</span>'
      + '</label>'
      + '<div class="sf-sayfalar" id="sf-sayfalar-'+p+'" style="'+(erisim?'':'display:none')+'">';
    (PORTAL_SAYFALAR[p]||[]).forEach(function(s){
      var checked = sayfalar.includes(s.id);
      html += '<label class="sf-sayfa-check">'
        + '<input type="checkbox" name="sf-sayfa-'+p+'" value="'+s.id+'" '+(checked?'checked':'')+'>'
        + '<span>'+s.label+'</span>'
      + '</label>';
    });
    html += '</div></div>';
  });
  wrap.innerHTML = html;
}

function sfTogglePortal(p){
  var cb = document.getElementById('sf-erisim-'+p);
  var sayfalarDiv = document.getElementById('sf-sayfalar-'+p);
  if(sayfalarDiv) sayfalarDiv.style.display = cb&&cb.checked ? '' : 'none';
}

function sfRolChange(){
  var rol = (document.getElementById('sf-rol')||{}).value;
  var matrixWrap = document.getElementById('sf-izin-matrix');
  if(matrixWrap) matrixWrap.style.display = rol==='yönetici' ? 'none' : '';
  var hint = document.getElementById('sf-izin-hint');
  if(hint) hint.style.display = rol==='yönetici' ? '' : 'none';
}

async function saveSistemUser(){
  var el = function(id){return document.getElementById(id);};
  var ad       = (el('sf-ad')||{}).value.trim();
  var username = (el('sf-username')||{}).value.trim();
  var sifre    = (el('sf-sifre')||{}).value;
  var email    = (el('sys-email')||{}).value.trim();
  var rol      = (el('sf-rol')||{}).value;

  if(!ad||!username) return toast('Ad ve kullanıcı adı zorunlu.','error');
  if(!_sistemEditId&&!sifre) return toast('Yeni kullanıcı için şifre zorunlu.','error');
  if(sifre&&sifre.length<4) return toast('Şifre en az 4 karakter olmalı.','error');

  var izinler = {servis:{erisim:false,sayfalar:[]},satis:{erisim:false,sayfalar:[]},stok:{erisim:false,sayfalar:[]}};
  if(rol!=='yönetici'){
    ['servis','satis','stok'].forEach(function(p){
      var erisimCb = document.getElementById('sf-erisim-'+p);
      var erisim   = erisimCb&&erisimCb.checked;
      var sayfalar = [];
      if(erisim){
        document.querySelectorAll('input[name="sf-sayfa-'+p+'"]:checked').forEach(function(cb){
          sayfalar.push(cb.value);
        });
      }
      izinler[p] = {erisim:erisim, sayfalar:sayfalar};
    });
  } else {
    izinler = {
      servis:{erisim:true, sayfalar:_allSayfalar('servis')},
      satis: {erisim:true, sayfalar:_allSayfalar('satis')},
      stok:  {erisim:true, sayfalar:_allSayfalar('stok')}
    };
  }

  var payload = {ad:ad, username:username, email:email, rol:rol, izinler:izinler};
  if(sifre) payload.password = sifre;

  try{
    if(_sistemEditId){
      payload.id = _sistemEditId;
      await apiPut('kullanicilar', payload);
      toast('Kullanıcı güncellendi.','success');
    } else {
      await apiPost('kullanicilar', payload);
      toast('Kullanıcı oluşturuldu.','success');
    }
  }catch(e){
    return toast(e.message||'Kullanıcı kaydedilemedi.','error');
  }

  await _loadSistemKullanicilar();
  cancelSistemForm();
}

function cancelSistemForm(){
  var list = document.getElementById('sistem-users-panel');
  var form = document.getElementById('sistem-form-panel');
  if(list) list.style.display = '';
  if(form) form.style.display = 'none';
  renderSistemKullanicilar();
}

function silSistemUser(id){
  if(state.currentUser&&state.currentUser.id===id) return toast('Kendi hesabınızı silemezsiniz.','error');
  showConfirm('Bu kullanıcıyı silmek istiyor musunuz?',async function(){
    try{
      await apiDelete('kullanicilar?id='+encodeURIComponent(id));
    }catch(e){
      return toast(e.message||'Kullanıcı silinemedi.','error');
    }
    await _loadSistemKullanicilar();
    toast('Kullanıcı silindi.','info');
  });
}

function _sEsc(s){
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
