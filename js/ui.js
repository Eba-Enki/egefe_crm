// ════ GENEL TOPLU SEÇİM (arşiv listeleri) ════
var _bulkSel={};
var _bulkVisible={};
function _bulkSet(key){if(!_bulkSel[key])_bulkSel[key]=new Set();return _bulkSel[key];}
function bulkSetVisible(key,ids){_bulkVisible[key]=ids;}
function bulkClear(key){_bulkSet(key).clear();}
function bulkCount(key){var ids=_bulkVisible[key]||[];var s=_bulkSet(key);return ids.filter(function(id){return s.has(id);}).length;}
function bulkAllChecked(key){var ids=_bulkVisible[key]||[];return ids.length>0&&bulkCount(key)===ids.length;}
function bulkIsChecked(key,id){return _bulkSet(key).has(id);}
function bulkSelectedIds(key){var ids=_bulkVisible[key]||[];var s=_bulkSet(key);return ids.filter(function(id){return s.has(id);});}
function bulkToggleRow(key,id,renderFnName){
  var s=_bulkSet(key);
  if(s.has(id))s.delete(id);else s.add(id);
  window[renderFnName]();
}
function bulkToggleAll(key,checked,renderFnName){
  var ids=_bulkVisible[key]||[];
  var s=_bulkSet(key);
  ids.forEach(function(id){if(checked)s.add(id);else s.delete(id);});
  window[renderFnName]();
}

function syncFooterSpacing(){
  var footer=document.getElementById('app-footer');
  var content=document.querySelector('.content');
  if(!footer||!content)return;
  content.style.paddingBottom=(footer.offsetHeight+16)+'px';
}
window.addEventListener('resize',syncFooterSpacing);

function toggleFilterExtra(btn){
  var bar=btn.closest('.filter-bar');
  var extra=bar&&bar.querySelector('.filter-extra');
  if(!extra)return;
  var open=extra.classList.toggle('open');
  btn.classList.toggle('active',open);
  document.querySelectorAll('.custom-select-panel.open').forEach(function(p){p.classList.remove('open');});
}

function toggleCustomSelect(e,selectId){
  e.stopPropagation();
  var sel=document.getElementById(selectId);
  if(!sel)return;
  var wrap=sel.closest('.custom-select');
  var panel=document.getElementById('cs-panel-'+selectId);
  var wasOpen=panel&&panel.classList.contains('open');
  document.querySelectorAll('.custom-select-panel.open').forEach(function(p){p.classList.remove('open');});
  if(wasOpen)return;
  if(!panel){
    panel=document.createElement('div');
    panel.className='custom-select-panel';
    panel.id='cs-panel-'+selectId;
    document.body.appendChild(panel);
  }
  panel.innerHTML=Array.prototype.filter.call(sel.options,function(opt){
    return opt.style.display!=='none';
  }).map(function(opt){
    var isActive=opt.value===sel.value;
    return '<div onclick="selectCustomOption(event,\''+selectId+'\',\''+String(opt.value).replace(/'/g,"\\'")+'\')" style="display:flex;align-items:center;padding:9px 12px;border-radius:4px;cursor:pointer;background:'+(isActive?'var(--bg3)':'transparent')+'" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\''+(isActive?'var(--bg3)':'transparent')+'\'">'
      +'<span style="font-size:12px;font-weight:'+(isActive?'600':'400')+';color:'+(isActive?'var(--text)':'var(--text2)')+'">'+opt.textContent+'</span>'
    +'</div>';
  }).join('');
  var rect=wrap.getBoundingClientRect();
  panel.style.top=(rect.bottom+4)+'px';
  panel.style.left=rect.left+'px';
  panel.style.width=Math.max(rect.width,160)+'px';
  panel.classList.add('open');
}
function selectCustomOption(e,selectId,value){
  e.stopPropagation();
  var sel=document.getElementById(selectId);
  if(!sel)return;
  sel.value=value;
  sel.dispatchEvent(new Event('change',{bubbles:true}));
  var panel=document.getElementById('cs-panel-'+selectId);
  if(panel)panel.classList.remove('open');
  updateCustomSelectLabel(selectId);
}
function updateCustomSelectLabel(selectId){
  var sel=document.getElementById(selectId);
  if(!sel)return;
  var wrap=sel.closest('.custom-select');
  var label=wrap&&wrap.querySelector('.custom-select-label');
  if(label)label.textContent=sel.options[sel.selectedIndex]?sel.options[sel.selectedIndex].textContent:'';
}
function syncCustomSelectLabels(){
  document.querySelectorAll('.custom-select select').forEach(function(sel){updateCustomSelectLabel(sel.id);});
}
document.addEventListener('click',function(){
  document.querySelectorAll('.custom-select-panel.open').forEach(function(p){p.classList.remove('open');});
});
var PAGE_SIZE=25;
var _autoLogoutTimer=null;
var _lastActivity=Date.now();
function _resetActivity(){_lastActivity=Date.now();}
function _startAutoLogout(){
  if(_autoLogoutTimer)clearInterval(_autoLogoutTimer);
  _lastActivity=Date.now();
  _autoLogoutTimer=setInterval(function(){
    if(!state.currentUser)return;
    var mins=parseInt(localStorage.getItem('ege_autologout_min')||'30')||30;
    if(Date.now()-_lastActivity>mins*60000){
      clearInterval(_autoLogoutTimer);_autoLogoutTimer=null;
      toast('Uzun süreli hareketsizlik nedeniyle oturumunuz sonlandırıldı.','error');
      _performLogout();
    }
  },30000);
}
['mousemove','keydown','click','touchstart'].forEach(function(evt){document.addEventListener(evt,_resetActivity,{passive:true});});
var _formDirty=false;
var _currentPageId='';
var GUARDED_FORM_PAGES=new Set(['servis-form','teklif-form','musteri-form','urun-form','ham-giris','ham-cikis','bitmis-giris','bitmis-cikis']);
document.addEventListener('input',function(){if(GUARDED_FORM_PAGES.has(_currentPageId))_formDirty=true;});
document.addEventListener('change',function(){if(GUARDED_FORM_PAGES.has(_currentPageId))_formDirty=true;});
function renderPagination(containerId,currentPage,totalItems,fnName){
  var el=document.getElementById(containerId);if(!el)return;
  var totalPages=Math.ceil(totalItems/PAGE_SIZE);
  if(totalPages<=1){el.innerHTML='';return;}
  var pages=[];
  if(totalPages<=7){for(var i=1;i<=totalPages;i++)pages.push(i);}
  else{
    var pSet=new Set([1,totalPages]);
    for(var d=-2;d<=2;d++){var pg=currentPage+d;if(pg>=1&&pg<=totalPages)pSet.add(pg);}
    var sorted=Array.from(pSet).sort(function(a,b){return a-b;});
    for(var i=0;i<sorted.length;i++){pages.push(sorted[i]);if(i<sorted.length-1&&sorted[i+1]-sorted[i]>1)pages.push('…');}
  }
  var h='<div class="pagination">';
  h+='<button class="pg-btn"'+(currentPage===1?' disabled':'')+' onclick="'+fnName+'('+(currentPage-1)+')">‹</button>';
  pages.forEach(function(p){
    if(p==='…')h+='<span class="pg-ellipsis">…</span>';
    else h+='<button class="pg-btn'+(p===currentPage?' pg-active':'')+'" onclick="'+fnName+'('+p+')">'+p+'</button>';
  });
  h+='<button class="pg-btn"'+(currentPage===totalPages?' disabled':'')+' onclick="'+fnName+'('+(currentPage+1)+')">›</button>';
  h+='</div>';
  el.innerHTML=h;
}
const PAGE_TITLES={dashboard:'Dashboard',servisler:'Servis Kayıtları','servis-form':'Servis Formu',teklifler:'Teklifler',tutanaklar:'Teslim Tutanakları','teklif-form':'Teklif Hazırla',musteriler:'Müşteriler','musteri-form':'Müşteri',urunler:'Ürünler','urun-form':'Ürün',siparisler:'Siparişler',faturalar:'Faturalar','siparis-form':'Sipariş Oluştur',ayarlar:'Ayarlar',
'stok-dashboard':'<strong>STOK - DASHBOARD</strong>',
'ham-stok':'<strong>SHEET & STRİP STOK DURUMU</strong>',
'ham-girisler':'<strong>SHEET & STRİP STOK GİRİŞ LİSTESİ</strong>',
'ham-giris':'Stok Girişi',
'ham-cikislar':'<strong>SHEET & STRİP STOK ÇIKIŞ LİSTESİ</strong>',
'ham-cikis':'Stok Çıkışı',
'stok-parametreler':'<strong>STOK - PARAMETRELER</strong>',
'bitmis-stok':'<strong> HAZIR ÜRÜN STOK DURUMU</strong>',
'bitmis-girisler':'<strong>HAZIR ÜRÜN STOK GİRİŞ LİSTESİ</strong>',
'bitmis-giris':'Hazır Ürün Girişi',
'bitmis-cikislar':'<strong>HAZIR ÜRÜN STOK ÇIKIŞ LİSTESİ</strong>',
'bitmis-cikis':'Hazır Ürün Çıkışı',
'stok-ayarlar':'<strong>STOK - AYARLAR</strong>'};
function showConfirm(msg, onOk, opts){
  opts=opts||{};
  document.getElementById('confirm-title').textContent=opts.title||'Onay';
  document.getElementById('confirm-msg').textContent=msg;
  var okBtn=document.getElementById('confirm-ok-btn');
  var cancelBtn=document.getElementById('confirm-cancel-btn');
  okBtn.textContent=opts.okText||'Evet';
  okBtn.className='btn '+(opts.okClass||'btn-danger');
  cancelBtn.textContent=opts.cancelText||'Hayır';
  cancelBtn.onclick=function(){closeModal('modal-confirm');};
  okBtn.onclick=function(){closeModal('modal-confirm');if(onOk)onOk();};
  openModal('modal-confirm');
}
function _canAccessPage(user,pageId){
  if(!user)return true;
  var isAdmin=user.rol==='yönetici'||user.rol==='admin';
  if(isAdmin)return true;
  var FORM_PAGES=new Set(['servis-form','teklif-form','musteri-form','urun-form','siparis-form','ham-giris','ham-cikis','bitmis-giris','bitmis-cikis','kullanici-form']);
  if(FORM_PAGES.has(pageId))return true;
  if(!currentPortal||currentPortal==='sistem')return true;
  var iz=user.izinler&&user.izinler[currentPortal];
  if(!iz||!iz.erisim)return false;
  return (iz.sayfalar||[]).includes(pageId);
}

function showPage(id,skipRender){
  if(state.currentUser&&!_canAccessPage(state.currentUser,id)){
    id=currentPortal==='stok'?'stok-dashboard':'dashboard';
  }
  if(_formDirty&&GUARDED_FORM_PAGES.has(_currentPageId)&&id!==_currentPageId){
    showConfirm('Kaydedilmemiş değişiklikler var. Sayfadan çıkmak istediğinize emin misiniz?',function(){
      _formDirty=false;showPage(id,skipRender);
    },{title:'Kaydedilmemiş Değişiklikler',okText:'Evet',okClass:'btn-primary',cancelText:'Hayır'});
    return;
  }
  _formDirty=false;
  _currentPageId=id;
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+id);if(pg)pg.classList.add('active');
  document.querySelectorAll('.sb-item[data-page]').forEach(i=>i.classList.toggle('active',i.dataset.page===id));
  document.getElementById('topbar-title').innerHTML=PAGE_TITLES[id]||id;
  const canWrite=state.currentUser?.rol!=='izleyici';
  const isAdmin=state.currentUser?.rol==='yönetici'||state.currentUser?.rol==='admin';
  const pageTopbarBtns={
    servisler:'topbar-new-servis-btn',
    teklifler:'topbar-new-teklif-btn',
    musteriler:'topbar-new-musteri-btn',
    urunler:'topbar-new-urun-btn',
    tutanaklar:'topbar-new-tutanak-btn'
  };
  Object.entries(pageTopbarBtns).forEach(function([page,btnId]){
    const btn=document.getElementById(btnId);
    if(!btn)return;
    btn.style.display=(id===page&&canWrite)?'':'none';
  });
  const exportBtn=document.getElementById('topbar-export-btn');
  if(exportBtn)exportBtn.style.display=(id==='ayarlar')?'':'none';
  document.querySelectorAll('.topbar-tab-group').forEach(function(g){g.style.display='none';});
  var _tg={servisler:'topbar-tabs-servisler',teklifler:'topbar-tabs-teklifler',siparisler:'topbar-tabs-siparisler',faturalar:'topbar-tabs-faturalar','ham-stok':'topbar-tabs-hamstok','bitmis-stok':'topbar-tabs-bitmis-stok'}[id];
  if(_tg){var _tgEl=document.getElementById(_tg);if(_tgEl)_tgEl.style.display='flex';}
  // Stok topbar butonları
  var stokBtnMap={
    'ham-stok':     {excel:true},
    'ham-girisler': {excel:true,giris:true},
    'ham-cikislar': {excel:true,hamCikis:true},
    'bitmis-stok':  {excel:true},
    'bitmis-girisler':{excel:true,bmGiris:true},
    'bitmis-cikislar':{excel:true,bmCikis:true},
    'stok-parametreler':{param:true}
  };
  if(currentPortal==='stok'){
    var sbm=stokBtnMap[id]||{};
    var _se=document.getElementById('topbar-stok-excel');    if(_se)_se.style.display=sbm.excel?'':'none';
    var _shg=document.getElementById('topbar-stok-ham-giris');if(_shg)_shg.style.display=(sbm.giris&&canWrite)?'':'none';
    var _shc=document.getElementById('topbar-stok-ham-cikis');if(_shc)_shc.style.display=(sbm.hamCikis&&canWrite)?'':'none';
    var _sbg=document.getElementById('topbar-stok-bitmis-giris');if(_sbg)_sbg.style.display=(sbm.bmGiris&&canWrite)?'':'none';
    var _sbc=document.getElementById('topbar-stok-bitmis-cikis');if(_sbc)_sbc.style.display=(sbm.bmCikis&&canWrite)?'':'none';
    var _spm=document.getElementById('topbar-stok-param');   if(_spm)_spm.style.display=(sbm.param&&(isAdmin||canWrite))?'':'none';
  } else {
    ['topbar-stok-excel','topbar-stok-ham-giris','topbar-stok-ham-cikis','topbar-stok-bitmis-giris','topbar-stok-bitmis-cikis','topbar-stok-param'].forEach(function(bid){var b=document.getElementById(bid);if(b)b.style.display='none';});
  }
  const renders={dashboard:renderDashboard,servisler:loadServisler,teklifler:loadTeklifler,musteriler:loadMusteriler,urunler:loadUrunler,ayarlar:loadSettings,tutanaklar:loadTutanaklar,siparisler:loadSiparisler,faturalar:loadFaturalar,'siparis-form':function(){},'stok-dashboard':loadStokDashboard,'ham-stok':loadHamStok,'ham-girisler':loadHamGirisler,'ham-giris':loadHamGirisFormPage,'ham-cikislar':loadHamCikislar,'ham-cikis':loadHamCikisFormPage,'bitmis-stok':loadBitmisStok,'bitmis-girisler':loadBitmisGirisler,'bitmis-giris':loadBitmisGirisFormPage,'bitmis-cikislar':loadBitmisCikislar,'bitmis-cikis':loadBitmisCikisFormPage,'stok-ayarlar':loadStokAyarlar,'stok-parametreler':loadStokParametreler};
  if(!skipRender&&renders[id])renders[id]();
}

function goPortalDashboard(){
  if(currentPortal==='stok') showPage('stok-dashboard');
  else showPage('dashboard');
}

function stokSayfaExcel(){
  var aktifSayfa=document.querySelector('.page.active');
  var id=aktifSayfa?aktifSayfa.id.replace('page-',''):'';
  var fnMap={
    'ham-stok':stokExportHamStokExcel,
    'ham-girisler':stokExportHamGirislerExcel,
    'ham-cikislar':stokExportHamCikislarExcel,
    'bitmis-stok':stokExportBitmisStokExcel,
    'bitmis-girisler':stokExportBitmisGirislerExcel,
    'bitmis-cikislar':stokExportBitmisCikislarExcel
  };
  if(fnMap[id]) fnMap[id]();
  else toast('Bu sayfa için Excel export yok.','info');
}

// Form page navigators
function goServisForm(editId,viewOnly){
  if(!viewOnly&&state.currentUser?.rol==='izleyici'){toast('Yetki yok.','error');return}
  // Önceki view-only durumunu sıfırla
  document.querySelectorAll('#page-servis-form input:not([type=hidden]),#page-servis-form select,#page-servis-form textarea').forEach(function(el){el.disabled=false;});
  var _sfSave=document.getElementById('sf-save-btn');if(_sfSave)_sfSave.style.display='';
  var _sfCancel=document.querySelector('#page-servis-form .form-actions .btn-ghost');if(_sfCancel)_sfCancel.textContent='İptal';
  document.querySelectorAll('#page-servis-form .seri-no-row .btn-icon,#page-servis-form button[onclick*="addSeriNoRow"]').forEach(function(el){el.style.display='';});
  state.prevPage=document.querySelector('.page.active')?.id?.replace('page-','')||'servisler';
  document.getElementById('sf-edit-id').value=editId||'';
  if(editId){
    const s=state.servisler.find(x=>x.id===editId);
    if(!s)return;
    document.getElementById('sf-title').textContent=viewOnly?'Kayıt Görüntüle':'Servis Düzenle';
    document.getElementById('sf-sub').textContent=s.kayitNo+' · '+s.kurumAdi;
    document.getElementById('sf-kurumAdi').value=s.kurumAdi||'';
    document.getElementById('sf-ilgiliKisi').value=s.ilgiliKisi||'';
    document.getElementById('sf-telefon').value=s.telefon||'';
    document.getElementById('sf-email').value=s.email||'';
    setSeriNolar(s.seriNo?s.seriNo.split(',').map(function(x){return x.trim();}).filter(Boolean):['']);
    document.getElementById('sf-garantiDurumu').value=s.garantiDurumu||'Hayır';
    document.getElementById('sf-aksesuar-diger').value=s.aksesuarDiger||'';
    document.getElementById('sf-gelisTarihi').value=s.gelisTarihi||'';
    var sfDurumElEdit=document.getElementById('sf-durum');if(sfDurumElEdit)sfDurumElEdit.value=s.durum||'Cihaz Kabul';
    document.getElementById('sf-kargoTarihi').value=s.kargoTarihi||'';
    document.getElementById('sf-kargoFirmasi').value=s.kargoFirmasi||'';
    document.getElementById('sf-teslimAlan').value=s.teslimAlan||'';
    document.getElementById('sf-notlar').value=s.notlar||'';
    sfAksesuarlar=Array.isArray(s.aksesuarlar)?[...s.aksesuarlar]:[];
    var foundSM=state.musteriler.find(function(x){return x.kurum===(s.kurumAdi||'');});
    if(foundSM)lockMusteriField('sf-kurumAdi',foundSM.id);
    else unlockMusteriField('sf-kurumAdi');
  } else {
    document.getElementById('sf-title').textContent='Yeni Servis Kaydı';
    document.getElementById('sf-sub').textContent='Yeni bir cihaz servisi oluşturun';
    ['sf-kurumAdi','sf-ilgiliKisi','sf-telefon','sf-email','sf-aksesuar-diger','sf-gelisTarihi','sf-kargoTarihi','sf-kargoFirmasi','sf-teslimAlan','sf-notlar'].forEach(function(i){var el=document.getElementById(i);if(el)el.value=''});
    setSeriNolar(['']);
    document.getElementById('sf-garantiDurumu').value='Hayır';
    document.getElementById('sf-gelisTarihi').value=today();
    var sfDurumEl=document.getElementById('sf-durum');if(sfDurumEl)sfDurumEl.value='Cihaz Kabul';
    sfAksesuarlar=[];
    unlockMusteriField('sf-kurumAdi');
  }
  renderSfChips();
  if(viewOnly){
    // Tüm form alanlarını salt okunur yap
    document.querySelectorAll('#page-servis-form input:not([type=hidden]),#page-servis-form select,#page-servis-form textarea').forEach(function(el){el.disabled=true;});
    if(_sfSave)_sfSave.style.display='none';
    if(_sfCancel)_sfCancel.textContent='Kapat';
    document.querySelectorAll('#page-servis-form .seri-no-row .btn-icon,#page-servis-form button[onclick*="addSeriNoRow"]').forEach(function(el){el.style.display='none';});
  }
  showPage('servis-form',true);
}
function goTeklifForm(editId,servisId){
  if(state.currentUser?.rol==='izleyici'){toast('Yetki yok.','error');return}
  document.getElementById('tf-edit-id').value=editId||'';
  document.getElementById('tf-title').textContent=editId?'Teklif Düzenle':'Yeni Teklif Hazırla';
  if(editId){
    const t=state.teklifler.find(x=>x.id===editId);if(!t)return;
    document.getElementById('tf-teklifNo').value=t.teklifNo;
    document.getElementById('tf-teklifTarihi').value=t.teklifTarihi||'';
    document.getElementById('tf-gecerlilik').value=t.gecerlilikTarihi||'';
    document.getElementById('tf-notlar').value=t.notlar||'';
    var _sa2=document.getElementById('tf-servis-ara');if(_sa2)_sa2.dataset.servisid=t.servisId||'';
    var _fkn=document.getElementById('tf-kayitNo');if(_fkn)_fkn.value=t.kayitNo||'';
    var _ftel=document.getElementById('tf-telefon');if(_ftel)_ftel.value=t.telefon||'';
    var _feml=document.getElementById('tf-email');if(_feml)_feml.value=t.email||'';
    var _fsn=document.getElementById('tf-seriNo');if(_fsn)_fsn.value=t.seriNo||'';
    var _fku=document.getElementById('tf-kurum');if(_fku)_fku.value=t.kurum||'';
    var _fil=document.getElementById('tf-ilgiliKisi');if(_fil)_fil.value=t.ilgiliKisi||'';
    var _fpb=document.getElementById('tf-paraBirimi');if(_fpb)_fpb.value=t.paraBirimi||'TRY';
    var _fok=document.getElementById('tf-odemeKosulu');if(_fok)_fok.value=t.odemeKosulu||'';
    var _fvd=document.getElementById('tf-vade');if(_fvd)_fvd.value=(t.vade||'').replace(/\s*Gün$/i,'');
    onOdemeSekliChange();
    var _kdvLbl=document.getElementById('tf-kdv-label');if(_kdvLbl)_kdvLbl.style.display=currentPortal==='satis'?'flex':'none';
    var _kdvCb=document.getElementById('tf-kdv-cb');var _kdvSel=document.getElementById('tf-kdv-oran');
    if(_kdvCb)_kdvCb.checked=!!(t.kdvOran&&t.kdvOran>0);
    if(_kdvSel){_kdvSel.value=(t.kdvOran>0)?String(t.kdvOran):'10';_kdvSel.style.display=(t.kdvOran>0)?'':'none';}
    teklifItems=t.satirlar?JSON.parse(JSON.stringify(t.satirlar)):[{aciklama:'',miktar:1,birim:'Adet',birimFiyat:0}];
    var foundTM=state.musteriler.find(function(x){return (t.musteriId&&x.id===t.musteriId)||x.kurum===(t.kurum||'');});
    if(foundTM)lockMusteriField('tf-kurum',foundTM.id);
    else if(t.kurum){var _hidTF=document.getElementById('tf-musteri-id');if(_hidTF)_hidTF.value='__edit_existing__';}
    else unlockMusteriField('tf-kurum');
  } else {
    document.getElementById('tf-teklifNo').value=nextTN();
    document.getElementById('tf-teklifTarihi').value=today();
    document.getElementById('tf-gecerlilik').value='';
    document.getElementById('tf-notlar').value='';
    ['tf-kayitNo','tf-seriNo','tf-kurum','tf-ilgiliKisi','tf-telefon','tf-email','tf-odemeKosulu','tf-vade'].forEach(function(fid){var e=document.getElementById(fid);if(e)e.value='';});onOdemeSekliChange();
    var _fpb0=document.getElementById('tf-paraBirimi');if(_fpb0)_fpb0.value='TRY';
    var _kdvLbl0=document.getElementById('tf-kdv-label');if(_kdvLbl0)_kdvLbl0.style.display=currentPortal==='satis'?'flex':'none';
    var _kdvCb0=document.getElementById('tf-kdv-cb');if(_kdvCb0)_kdvCb0.checked=false;
    var _kdvSel0=document.getElementById('tf-kdv-oran');if(_kdvSel0){_kdvSel0.value='10';_kdvSel0.style.display='none';}
    var _sa0=document.getElementById('tf-servis-ara');if(_sa0)_sa0.dataset.servisid='';
    unlockMusteriField('tf-kurum');
    if(servisId){
      const s=state.servisler.find(x=>x.id===servisId);
      if(s){
        var _sa1=document.getElementById('tf-servis-ara');if(_sa1)_sa1.dataset.servisid=s.id;
        var _fkn2=document.getElementById('tf-kayitNo');if(_fkn2)_fkn2.value=s.kayitNo;
        var _fsn2=document.getElementById('tf-seriNo');if(_fsn2)_fsn2.value=s.seriNo||'';
        var _fku2=document.getElementById('tf-kurum');if(_fku2)_fku2.value=s.kurumAdi||'';
        var _fil2=document.getElementById('tf-ilgiliKisi');if(_fil2)_fil2.value=s.ilgiliKisi||'';
        var foundTM2=state.musteriler.find(function(x){return x.kurum===(s.kurumAdi||'');});
        if(foundTM2)lockMusteriField('tf-kurum',foundTM2.id);
      }
    }
    teklifItems=[{aciklama:'',miktar:1,birim:'Adet',birimFiyat:0}];
  }
  renderTeklifItems();showPage('teklif-form',true);
}
function goMusteriForm(editId){
  const m=editId?state.musteriler.find(x=>x.id===editId):null;
  document.getElementById('mf-edit-id').value=editId||'';
  document.getElementById('mf-title').textContent=m?'Müşteri Düzenle':'Yeni Müşteri';
  ['mf-kurum','mf-kisi','mf-tel','mf-email','mf-sehir','mf-adres','mf-not'].forEach(id=>{const f=id.replace('mf-','');document.getElementById(id).value=m?.[f]||''});
  showPage('musteri-form',true);
}
function goUrunForm(editId){
  const u=editId?state.urunler.find(x=>x.id===editId):null;
  document.getElementById('uf-edit-id').value=editId||'';
  document.getElementById('uf-title').textContent=u?'Ürün Düzenle':'Yeni Ürün';
  ['uf-urunAdi','uf-urunKodu','uf-marka','uf-model','uf-aciklama'].forEach(function(id){var f=id.replace('uf-','');var el=document.getElementById(id);if(el)el.value=u?u[f]||'':'';});
  const fEl=document.getElementById('uf-fiyat');if(fEl)fEl.value=u?.fiyat||'';
  const pbEl=document.getElementById('uf-paraBirimi');if(pbEl)pbEl.value=u?.paraBirimi||'TRY';
  var urunAdiEl=document.getElementById('uf-urunAdi');
  if(urunAdiEl)urunAdiEl.placeholder=currentPortal==='satis'?'Alkolmetre, Kamera, Yazıcı...':'Kalibrasyon, Tamir, Yazılım Güncelleme...';
  const katEl=document.getElementById('uf-kategori');
  if(katEl){katEl.innerHTML='<option value="">— Seçin —</option>'+((state.settings&&state.settings.urunKategoriler)||[]).map(k=>`<option value="${k}">${k}</option>`).join('');katEl.value=u?.kategori||'';}
  showPage('urun-form',true);
}
// ════ TITLE CASE (Türkçe destekli) ════
function toTitleCase(str){
  if(!str)return str;
  return str.split(/\s+/).map(function(w){
    if(!w)return w;
    var fc=w.charAt(0);
    fc=fc==='i'?'İ':fc==='ı'?'I':fc.toLocaleUpperCase('tr-TR');
    return fc+w.slice(1).toLocaleLowerCase('tr-TR');
  }).join(' ');
}

// ════ COMBOS ════
var _MUSTERI_COMBO_CFG={
  'sf-kurumAdi':{clear:'sf-kurum-clear-btn',hidden:'sf-musteri-id'},
  'tf-kurum':{clear:'tf-kurum-clear-btn',hidden:'tf-musteri-id'}
};

function lockMusteriField(inputId,musteriId){
  var inp=document.getElementById(inputId);
  if(inp){inp.readOnly=true;inp.classList.add('musteri-locked');}
  var cfg=_MUSTERI_COMBO_CFG[inputId];
  if(cfg){
    var btn=document.getElementById(cfg.clear);if(btn)btn.style.display='';
    var hid=document.getElementById(cfg.hidden);if(hid)hid.value=musteriId||'';
  }
}

function unlockMusteriField(inputId){
  var inp=document.getElementById(inputId);
  if(inp){inp.readOnly=false;inp.classList.remove('musteri-locked');}
  var cfg=_MUSTERI_COMBO_CFG[inputId];
  if(cfg){
    var btn=document.getElementById(cfg.clear);if(btn)btn.style.display='none';
    var hid=document.getElementById(cfg.hidden);if(hid)hid.value='';
  }
}

function musteriBlurValidate(inputId){
  var cfg=_MUSTERI_COMBO_CFG[inputId];
  if(!cfg)return;
  var inp=document.getElementById(inputId);
  var hid=document.getElementById(cfg.hidden);
  if(inp&&inp.value.trim()&&hid&&!hid.value){
    inp.value='';
    toast('Lütfen listeden kayıtlı bir müşteri seçin.','error');
  }
}

function clearMusteriSelection(inputId){
  unlockMusteriField(inputId);
  var inp=document.getElementById(inputId);
  if(inp){inp.value='';setTimeout(function(){inp.focus();},50);}
  if(inputId==='tf-kurum'){
    ['tf-ilgiliKisi','tf-telefon','tf-email'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  } else if(inputId==='sf-kurumAdi'){
    ['sf-ilgiliKisi','sf-telefon','sf-email'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  }
}

function getMusteriAds(){return state.musteriler.map(m=>({label:m.kurum,sub:m.kisi||''}))}

function comboFilter(inputId,dropId,srcFn){
  var inp=document.getElementById(inputId);
  if(inp&&inp.readOnly)return;
  var q=inp?inp.value.toLowerCase():'';
  var items=srcFn().filter(function(i){return i.label.toLowerCase().includes(q||'');}).slice(0,10);
  var drop=document.getElementById(dropId);
  var isMusteri=srcFn===getMusteriAds;
  if(!items.length&&!isMusteri){drop.classList.remove('open');return;}
  drop._comboItems=items;
  var html=items.map(function(item,idx){
    var safe=item.label.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var sub=item.sub?'<div class="sub">'+item.sub+'</div>':'';
    return '<div class="combo-item" onmousedown="event.preventDefault();comboPickItem(\''+inputId+'\',\''+dropId+'\','+idx+')">'+safe+sub+'</div>';
  }).join('');
  if(isMusteri){
    html+='<div class="combo-item" style="color:var(--accent);border-top:1px solid var(--border);margin-top:2px;font-size:12px;font-weight:500" onmousedown="event.preventDefault();comboAddMusteri(\''+inputId+'\')">+ Yeni Müşteri Ekle</div>';
  }
  drop.innerHTML=html;
  if(_cbHL&&_cbHL.id===dropId)_cbHL.idx=-1;
  drop.classList.add('open');
}

function comboPickItem(inputId,dropId,idx){
  var drop=document.getElementById(dropId);
  if(!drop||!drop._comboItems)return;
  var item=drop._comboItems[idx];
  if(!item)return;
  var inp=document.getElementById(inputId);
  if(inp)inp.value=item.label;
  comboClose(dropId);
  if(inputId==='tf-kurum'||inputId==='sf-kurumAdi'){
    var m=state.musteriler.find(function(x){return x.kurum===item.label;});
    if(m){
      lockMusteriField(inputId,m.id);
      if(inputId==='tf-kurum'){
        var ki=document.getElementById('tf-ilgiliKisi');if(ki)ki.value=m.kisi||'';
        var tel=document.getElementById('tf-telefon');if(tel)tel.value=m.tel||'';
        var eml=document.getElementById('tf-email');if(eml)eml.value=m.email||'';
      } else {
        var ki2=document.getElementById('sf-ilgiliKisi');if(ki2)ki2.value=m.kisi||'';
        var tel2=document.getElementById('sf-telefon');if(tel2)tel2.value=m.tel||'';
        var eml2=document.getElementById('sf-email');if(eml2)eml2.value=m.email||'';
      }
    }
  }
}

function comboAddMusteri(inputId){
  var q=(document.getElementById(inputId)||{}).value||'';
  var returnPage=inputId==='tf-kurum'?'teklif-form':'servis-form';
  state._musterAddReturn={inputId:inputId,returnPage:returnPage};
  goMusteriForm(null);
  if(q){var kEl=document.getElementById('mf-kurum');if(kEl)kEl.value=q;}
  var backBtn=document.querySelector('#page-musteri-form .btn-back');
  if(backBtn)backBtn.innerHTML='<i class="ti ti-arrow-narrow-left"></i> Geri';
}

function cancelMusteriAdd(){
  var ret=state._musterAddReturn;
  state._musterAddReturn=null;
  if(ret)showPage(ret.returnPage,true);
  else showPage('musteriler');
}

function selectServisForTeklif(id){
  const s=state.servisler.find(x=>x.id===id);if(!s)return;
  document.getElementById('tf-servis-ara').value=s.kayitNo+' — '+s.kurumAdi;
  document.getElementById('tf-servis-ara').dataset.servisId=s.id;
  document.getElementById('tf-kayitNo').value=s.kayitNo;
  document.getElementById('tf-seriNo').value=s.seriNo||'';
  document.getElementById('tf-kurum').value=s.kurumAdi||'';
  document.getElementById('tf-ilgiliKisi').value=s.ilgiliKisi||'';
  comboClose('cb-tf-servis');
  var foundM=state.musteriler.find(function(x){return x.kurum===(s.kurumAdi||'');});
  if(foundM)lockMusteriField('tf-kurum',foundM.id);
}
function comboClose(id){const el=document.getElementById(id);if(el)el.classList.remove('open');if(_cbHL&&_cbHL.id===id){_cbHL.id=null;_cbHL.idx=-1;}}

// Combo keyboard navigation state
var _cbHL={id:null,idx:-1};
function comboKeydown(event,inputId,dropId,srcFn){
  var drop=document.getElementById(dropId);
  var isOpen=drop&&drop.classList.contains('open');
  if(event.key==='ArrowDown'){event.preventDefault();if(!isOpen){comboFilter(inputId,dropId,srcFn||getMusteriAds);}else _comboHL(dropId,1);}
  else if(event.key==='ArrowUp'){event.preventDefault();_comboHL(dropId,-1);}
  else if(event.key==='Enter'&&isOpen&&_cbHL.idx>=0){event.preventDefault();comboPickItem(inputId,dropId,_cbHL.idx);_cbHL.id=null;_cbHL.idx=-1;}
  else if(event.key==='Escape'){comboClose(dropId);}
}
function _comboHL(dropId,dir){
  var drop=document.getElementById(dropId);if(!drop||!drop.classList.contains('open'))return;
  var items=drop.querySelectorAll('.combo-item');if(!items.length)return;
  if(_cbHL.id!==dropId){_cbHL.id=dropId;_cbHL.idx=-1;}
  var max=(drop._comboItems?drop._comboItems.length:items.length)-1;
  items.forEach(i=>i.classList.remove('highlighted'));
  _cbHL.idx=Math.max(0,Math.min(max,_cbHL.idx+dir));
  items[_cbHL.idx].classList.add('highlighted');
  items[_cbHL.idx].scrollIntoView({block:'nearest'});
}

// Teklif item row combo — keyboard + click + price autofill
let tiComboIndex=-1;
let tiComboHighlight=-1;

function _getTiDrop(){
  let d=document.getElementById('ti-combo-global');
  if(!d){
    d=document.createElement('div');
    d.id='ti-combo-global';
    d.style.cssText='display:none;position:fixed;z-index:9999;background:var(--bg3);border:1px solid var(--border2);border-radius:4px;max-height:320px;overflow-y:auto;box-shadow:0 6px 20px rgba(0,0,0,.4)';
    document.body.appendChild(d);
  }
  return d;
}
function openTiCombo(idx){
  tiComboIndex=idx;
  tiComboHighlight=-1;
  const input=document.getElementById('ti-aciklama-'+idx);
  if(!input)return;
  const q=(input.value||'').toLowerCase();
  const filtered=state.urunler.filter(u=>(u.urunAdi+' '+(u.kategori||'')).toLowerCase().includes(q||'')).slice(0,80);
  const drop=_getTiDrop();
  if(!filtered.length){drop.style.display='none';return;}
  const sorted=[...filtered].sort((a,b)=>(a.kategori||'').localeCompare(b.kategori||'','tr'));
  let html='';let lastKat=undefined;let ci=0;
  sorted.forEach(u=>{
    const kat=u.kategori||'';
    if(kat!==lastKat){
      if(kat)html+=`<div style="padding:6px 12px 4px;font-size:10px;font-weight:700;color:var(--accent);letter-spacing:.08em;text-transform:uppercase;background:var(--accent-soft);border-top:1px solid var(--accent-glow);border-bottom:1px solid var(--accent-glow);cursor:default;user-select:none">${esc(kat)}</div>`;
      lastKat=kat;
    }
    html+=`<div class="combo-item" data-combo-idx="${ci}" data-urun="${esc(u.urunAdi)}" data-fiyat="${u.fiyat||0}" data-model="${esc(u.model||'')}" onmousedown="event.preventDefault();selectTiUrun(${idx},${ci})">${esc(u.urunAdi)}${u.kategori?` <span style="color:var(--text3);font-size:11px">(${esc(u.kategori)})</span>`:''}${u.model&&parseInt(u.model)?` <span style="color:var(--accent);font-size:11px;margin-left:6px">${esc(u.model)}P</span>`:''}${u.fiyat?` <span style="color:var(--amber);font-size:11px;margin-left:8px">${fmtTL(u.fiyat)}</span>`:''}</div>`;
    ci++;
  });
  drop.innerHTML=html;
  const rect=input.getBoundingClientRect();
  drop.style.top=(rect.bottom+2)+'px';
  drop.style.left=rect.left+'px';
  drop.style.width=rect.width+'px';
  drop.style.display='block';
}

function tiComboHighlightItem(idx, dir){
  const drop=_getTiDrop();
  if(!drop||drop.style.display==='none')return;
  const items=drop.querySelectorAll('.combo-item');
  if(!items.length)return;
  items.forEach(i=>i.classList.remove('highlighted'));
  tiComboHighlight=Math.max(0,Math.min(items.length-1,tiComboHighlight+dir));
  items[tiComboHighlight].classList.add('highlighted');
  items[tiComboHighlight].scrollIntoView({block:'nearest'});
}

function selectTiUrun(idx, itemIdx){
  const drop=_getTiDrop();
  const item=drop.querySelector('[data-combo-idx="'+itemIdx+'"]');
  if(!item)return;
  const val=item.dataset.urun;
  const fiyat=parseFloat(item.dataset.fiyat)||0;
  const paramCount=parseInt(item.dataset.model)||0;
  teklifItems[idx].aciklama=val;
  teklifItems[idx]._baseAciklama=val;
  teklifItems[idx].seciliParametreler=[];
  if(fiyat>0)teklifItems[idx].birimFiyat=fiyat;
  drop.style.display='none';
  tiComboHighlight=-1;
  const inp=document.getElementById('ti-aciklama-'+idx);
  if(inp)inp.value=val;
  const fiyatInp=document.getElementById('ti-fiyat-'+idx);
  if(fiyatInp&&fiyat>0)fiyatInp.value=fiyat;
  updateTeklifTotals();
  if(paramCount>0&&(state.settings.parametreler||[]).length>0)openParamSecModal(idx,paramCount);
}

var _paramSecIdx=-1,_paramSecMax=0;
function openParamSecModal(idx,count){
  _paramSecIdx=idx;_paramSecMax=count;
  const mevcut=teklifItems[idx].seciliParametreler||[];
  const mevMap={};
  mevcut.forEach(p=>{const ad=typeof p==='string'?p:p.ad;const deger=typeof p==='string'?'':(p.deger||'');mevMap[ad]=deger;});
  const parametreler=state.settings.parametreler||[];
  const titleEl=document.getElementById('parametre-sec-title');
  if(titleEl)titleEl.textContent=count+' parametre seçin';
  const list=document.getElementById('parametre-sec-list');
  if(!list)return;
  list.style.gridTemplateColumns='1fr';
  list.innerHTML=parametreler.map((p,i)=>{
    const parsed=parseParam(p);
    const kisaltma=parsed.kisaltma;
    const adLabel=parsed.ad?parsed.ad+' ('+kisaltma+')':kisaltma;
    const isChecked=kisaltma in mevMap;
    const val=isChecked?(mevMap[kisaltma]||''):'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;background:var(--bg3);border:1px solid var(--border)"><input type="checkbox" id="ps-cb-${i}" value="${kisaltma.replace(/"/g,'&quot;')}" ${isChecked?'checked':''} onchange="updateParamSecCounter()"><label for="ps-cb-${i}" style="font-size:13px;color:var(--text);flex:1;cursor:pointer">${adLabel}</label><input type="text" id="ps-val-${i}" value="${val.replace(/"/g,'&quot;')}" placeholder="değer" style="width:110px;font-size:12px;padding:3px 8px;border-radius:4px;border:1px solid var(--border2);background:var(--bg4);color:var(--text)" ${isChecked?'':'disabled'}></div>`;
  }).join('');
  updateParamSecCounter();
  openModal('modal-parametre-sec');
}
function _renderParamChips(){
  const chipsEl=document.getElementById('parametre-sec-chips');
  if(!chipsEl)return;
  const checked=[...document.querySelectorAll('#parametre-sec-list input[type=checkbox]:checked')];
  if(checked.length===0){chipsEl.style.display='none';chipsEl.innerHTML='';return;}
  chipsEl.style.display='flex';
  chipsEl.innerHTML=checked.map(cb=>{
    const i=cb.id.replace('ps-cb-','');
    const vi=document.getElementById('ps-val-'+i);
    const deger=vi?vi.value.trim():'';
    const label=cb.value+(deger?' : '+deger:'');
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px 3px 12px;border-radius:20px;background:var(--accent-soft);color:var(--accent);font-size:12px;font-weight:600;border:1px solid var(--accent)">${label}<button type="button" onclick="(function(){var cb=document.getElementById('ps-cb-${i}');if(cb){cb.checked=false;var vi=document.getElementById('ps-val-${i}');if(vi){vi.value='';vi.disabled=true;}updateParamSecCounter();}})()" style="background:none;border:none;cursor:pointer;color:var(--accent);font-size:13px;line-height:1;padding:0 0 0 2px">×</button></span>`;
  }).join('');
}
function updateParamSecCounter(){
  const all=document.querySelectorAll('#parametre-sec-list input[type=checkbox]');
  const checked=[...all].filter(c=>c.checked);
  const n=checked.length;
  const counterEl=document.getElementById('parametre-sec-counter');
  if(counterEl)counterEl.textContent=n+' / '+_paramSecMax+' seçildi';
  all.forEach((cb,i)=>{
    if(!cb.checked)cb.disabled=(n>=_paramSecMax);
    const vi=document.getElementById('ps-val-'+i);
    if(vi)vi.disabled=!cb.checked;
  });
  _renderParamChips();
}
function confirmParamSec(){
  const checkboxes=[...document.querySelectorAll('#parametre-sec-list input[type=checkbox]:checked')];
  if(checkboxes.length!==_paramSecMax)return toast('Lütfen tam olarak '+_paramSecMax+' parametre seçin.','error');
  const selected=checkboxes.map(cb=>{
    const i=cb.id.replace('ps-cb-','');
    const vi=document.getElementById('ps-val-'+i);
    const deger=vi?vi.value.trim():'';
    return deger?{ad:cb.value,deger:deger}:{ad:cb.value};
  });
  const base=teklifItems[_paramSecIdx]._baseAciklama||teklifItems[_paramSecIdx].aciklama.replace(/\s*\([^)]*\)/g,'').trim();
  teklifItems[_paramSecIdx].aciklama=base;
  teklifItems[_paramSecIdx]._baseAciklama=base;
  teklifItems[_paramSecIdx].seciliParametreler=selected;
  const inp=document.getElementById('ti-aciklama-'+_paramSecIdx);
  if(inp)inp.value=base;
  closeModal('modal-parametre-sec');
  renderTeklifItems();
}

function tiKeydown(event, idx){
  const drop=_getTiDrop();
  const isOpen=drop.style.display!=='none';
  if(event.key==='ArrowDown'){event.preventDefault();if(!isOpen)openTiCombo(idx);else tiComboHighlightItem(idx,1);}
  else if(event.key==='ArrowUp'){event.preventDefault();tiComboHighlightItem(idx,-1);}
  else if(event.key==='Enter'||event.key==='Tab'){
    if(isOpen&&tiComboHighlight>=0){event.preventDefault();selectTiUrun(idx,tiComboHighlight);}
    else if(isOpen&&event.key==='Enter'){
      event.preventDefault();selectTiUrun(idx,0);
    }
  }
  else if(event.key==='Escape'){drop.style.display='none';tiComboHighlight=-1;}
}

document.addEventListener('click',e=>{
  if(!e.target.closest('[id^="ti-aciklama-"]')&&!e.target.closest('#ti-combo-global'))
    _getTiDrop().style.display='none';
});
document.addEventListener('scroll',function(){
  const drop=document.getElementById('ti-combo-global');
  if(!drop||drop.style.display==='none')return;
  if(tiComboIndex<0){drop.style.display='none';return;}
  const input=document.getElementById('ti-aciklama-'+tiComboIndex);
  if(!input){drop.style.display='none';return;}
  const rect=input.getBoundingClientRect();
  if(rect.bottom<0||rect.top>window.innerHeight){drop.style.display='none';return;}
  drop.style.top=(rect.bottom+2)+'px';
  drop.style.left=rect.left+'px';
},true);

// ════ AKSESUAR CHIPS (servis formu) ════
function renderSfChips(){
  document.getElementById('sf-aksesuar-chips').innerHTML=AKSESUAR_LIST.map(a=>`<span class="chip ${sfAksesuarlar.includes(a)?'selected':''}" onclick="toggleSfChip('${a}')">${a}</span>`).join('');
}
function toggleSfChip(a){const i=sfAksesuarlar.indexOf(a);if(i>=0)sfAksesuarlar.splice(i,1);else sfAksesuarlar.push(a);renderSfChips()}

// ════ DASHBOARD ════
function openModal(id){document.getElementById(id).classList.add('open')}
function closeModal(id){document.getElementById(id).classList.remove('open')}
document.querySelectorAll('.modal-overlay').forEach(el=>el.addEventListener('click',e=>{if(e.target===el)el.classList.remove('open')}));
document.addEventListener('keydown',e=>{if(e.key==='Escape')document.querySelectorAll('.modal-overlay.open').forEach(el=>el.classList.remove('open'))});

// ════ TOAST ════
function toast(msg,type='info'){
  const el=document.createElement('div');el.className=`toast toast-${type}`;
  el.innerHTML=`<span style="color:${type==='success'?'var(--green)':type==='error'?'var(--red)':'var(--accent)'}">${type==='success'?'✓':type==='error'?'✕':'ℹ'}</span>${msg}`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(()=>{el.style.cssText='opacity:0;transform:translateX(100%);transition:all .3s';setTimeout(()=>el.remove(),300)},3200);
}

// ════ THEME ════

function applyLogoForTheme(t){
  var isDark=(t||localStorage.getItem('ege_theme')||'dark')==='dark';
  var src=isDark?'brand_assets/logo_if_bg_color.svg':'brand_assets/logo_if_bg_white.svg';
  document.querySelectorAll('#login-logo-img,#portal-logo-img').forEach(function(el){
    el.src=src;
    el.style.filter='none';
    el.style.mixBlendMode='normal';
  });
  _updateSbLogoSrc();
}
function _updateSbLogoSrc(){
  var img=document.getElementById('sb-logo-img');
  if(!img)return;
  var collapsed=document.documentElement.classList.contains('sidebar-collapsed');
  if(collapsed){
    img.src='brand_assets/logo_favicon_more_thicker.svg';
    img.style.width='16px';
    img.style.height='16px';
  } else {
    var isDark=(localStorage.getItem('ege_theme')||'dark')==='dark';
    img.src=isDark?'brand_assets/logo_if_bg_color.svg':'brand_assets/logo_if_bg_white.svg';
    img.style.width='100%';
    img.style.height='auto';
  }
  img.style.filter='none';
  img.style.mixBlendMode='normal';
}
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('ege_theme',t);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.id==='btn-theme-'+t));
  applyLogoForTheme(t);
}
function loadTheme(){
  const t=localStorage.getItem('ege_theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.id==='btn-theme-'+t));
}
loadTheme();

// ════ SIDEBAR COLLAPSE ════
function _updateSidebarCollapseUI(collapsed){
  var btn=document.getElementById('sb-collapse-btn');
  if(!btn)return;
  btn.innerHTML=collapsed?'<i class="ti ti-layout-sidebar-left-expand"></i>':'<i class="ti ti-layout-sidebar-left-collapse"></i>';
  btn.setAttribute('data-tooltip',collapsed?'Kenar Çubuğunu Genişlet':'Kenar Çubuğunu Daralt');
}
function toggleSidebarCollapse(){
  var collapsed=document.documentElement.classList.toggle('sidebar-collapsed');
  localStorage.setItem('ege_sidebar_collapsed',collapsed?'1':'0');
  _updateSidebarCollapseUI(collapsed);
  _updateSbLogoSrc();
}
function loadSidebarCollapse(){
  var collapsed=localStorage.getItem('ege_sidebar_collapsed')==='1';
  document.documentElement.classList.toggle('sidebar-collapsed',collapsed);
  _updateSidebarCollapseUI(collapsed);
  _updateSbLogoSrc();
}
loadSidebarCollapse();
function _attachSbTooltip(el,gateCollapsed){
  if(!el)return;
  el.addEventListener('mouseenter',function(){
    if(gateCollapsed&&!document.documentElement.classList.contains('sidebar-collapsed'))return;
    var text=el.getAttribute('data-tooltip');
    if(!text)return;
    var tip=document.getElementById('sb-tooltip');
    var r=el.getBoundingClientRect();
    tip.textContent=text;
    tip.style.left=r.right+10+'px';
    tip.style.top=(r.top+r.height/2)+'px';
    tip.style.transform='translateY(-50%)';
    tip.classList.add('show');
  });
  el.addEventListener('mouseleave',function(){
    document.getElementById('sb-tooltip').classList.remove('show');
  });
}
document.querySelectorAll('.sb-item').forEach(function(el){
  var label=el.querySelector('span:not(.icon):not(.badge)');
  if(label)el.setAttribute('data-tooltip',label.textContent.trim());
  _attachSbTooltip(el,true);
});
_attachSbTooltip(document.getElementById('sb-logo-img'),false);
_attachSbTooltip(document.getElementById('sb-collapse-btn'),false);
_attachSbTooltip(document.querySelector('.sb-user'),false);
_attachSbTooltip(document.querySelector('.sb-logout-btn'),false);

// ════ TUTANAKLAR ════
