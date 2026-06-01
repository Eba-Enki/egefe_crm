var PAGE_SIZE=25;
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
const PAGE_TITLES={dashboard:'Dashboard',servisler:'Servis Kayıtları','servis-form':'Servis Formu',teklifler:'Teklifler',tutanaklar:'Teslim Tutanakları','teklif-form':'Teklif Hazırla',musteriler:'Müşteriler','musteri-form':'Müşteri',urunler:'Ürünler','urun-form':'Ürün',siparisler:'Siparişler',faturalar:'Faturalar','siparis-form':'Sipariş Oluştur',kullanici:'Kullanıcı Yönetimi','kullanici-form':'Kullanıcı',ayarlar:'Ayarlar',tutanaklar:'Tutanaklar'};
function showPage(id,skipRender){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const pg=document.getElementById('page-'+id);if(pg)pg.classList.add('active');
  document.querySelectorAll('.sb-item[data-page]').forEach(i=>i.classList.toggle('active',i.dataset.page===id));
  document.getElementById('topbar-title').textContent=PAGE_TITLES[id]||id;
  const canWrite=state.currentUser?.rol!=='izleyici';
  const isAdmin=state.currentUser?.rol==='admin';
  const pageTopbarBtns={
    servisler:'topbar-new-servis-btn',
    teklifler:'topbar-new-teklif-btn',
    musteriler:'topbar-new-musteri-btn',
    urunler:'topbar-new-urun-btn',
    tutanaklar:'topbar-new-tutanak-btn',
    kullanici:'topbar-new-kullanici-btn'
  };
  Object.entries(pageTopbarBtns).forEach(function([page,btnId]){
    const btn=document.getElementById(btnId);
    if(!btn)return;
    const show=(id===page)&&(page==='kullanici'?isAdmin:canWrite);
    btn.style.display=show?'':'none';
  });
  document.querySelectorAll('.topbar-tab-group').forEach(function(g){g.style.display='none';});
  var _tg={teklifler:'topbar-tabs-teklifler',siparisler:'topbar-tabs-siparisler',faturalar:'topbar-tabs-faturalar'}[id];
  if(_tg){var _tgEl=document.getElementById(_tg);if(_tgEl)_tgEl.style.display='flex';}
  const renders={dashboard:renderDashboard,servisler:renderTable,teklifler:renderTeklifler,musteriler:renderMusteriler,urunler:renderUrunler,kullanici:renderUserTable,ayarlar:loadSettings,tutanaklar:renderTutanaklar,siparisler:renderSiparisler,faturalar:renderFaturalar,'siparis-form':function(){}};
  if(!skipRender&&renders[id])renders[id]();
}

// Form page navigators
function goServisForm(editId){
  if(state.currentUser?.rol==='izleyici'){toast('Yetki yok.','error');return}
  state.prevPage=document.querySelector('.page.active')?.id?.replace('page-','')||'servisler';
  document.getElementById('sf-edit-id').value=editId||'';
  if(editId){
    const s=state.servisler.find(x=>x.id===editId);
    if(!s)return;
    document.getElementById('sf-title').textContent='Servis Düzenle';
    document.getElementById('sf-sub').textContent=s.kayitNo+' · '+s.kurumAdi;
    document.getElementById('sf-kurumAdi').value=s.kurumAdi||'';
    document.getElementById('sf-ilgiliKisi').value=s.ilgiliKisi||'';
    document.getElementById('sf-telefon').value=s.telefon||'';
    document.getElementById('sf-email').value=s.email||'';
    setSeriNolar(s.seriNo?s.seriNo.split(',').map(function(x){return x.trim();}).filter(Boolean):['']);
    document.getElementById('sf-garantiDurumu').value=s.garantiDurumu||'Hayır';
    document.getElementById('sf-aksesuar-diger').value=s.aksesyarDiger||'';
    document.getElementById('sf-gelisTarihi').value=s.gelisTarihi||'';
    document.getElementById('sf-durum').value=s.durum||'Yeni Gelen';
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
    var sfDurumEl=document.getElementById('sf-durum');if(sfDurumEl)sfDurumEl.value='Yeni Gelen';
    sfAksesuarlar=[];
    unlockMusteriField('sf-kurumAdi');
  }
  renderSfChips();
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
    var _fvd=document.getElementById('tf-vade');if(_fvd)_fvd.value=t.vade||'';
    var _ftsl=document.getElementById('tf-teslimat');if(_ftsl)_ftsl.value=t.teslimat||'';
    onOdemeSekliChange();
    teklifItems=t.satirlar?JSON.parse(JSON.stringify(t.satirlar)):[{aciklama:'',miktar:1,birim:'Adet',birimFiyat:0}];
    var foundTM=state.musteriler.find(function(x){return x.kurum===(t.kurum||'');});
    if(foundTM)lockMusteriField('tf-kurum',foundTM.id);
    else unlockMusteriField('tf-kurum');
  } else {
    document.getElementById('tf-teklifNo').value=nextTN();
    document.getElementById('tf-teklifTarihi').value=today();
    document.getElementById('tf-gecerlilik').value='';
    document.getElementById('tf-notlar').value='';
    ['tf-kayitNo','tf-seriNo','tf-kurum','tf-ilgiliKisi','tf-telefon','tf-email','tf-odemeKosulu','tf-vade','tf-teslimat'].forEach(function(fid){var e=document.getElementById(fid);if(e)e.value='';});onOdemeSekliChange();
    var _fpb0=document.getElementById('tf-paraBirimi');if(_fpb0)_fpb0.value='TRY';
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
  if(katEl){katEl.innerHTML='<option value="">— Seçin —</option>'+(state.urunKategoriler||[]).map(k=>`<option value="${k}">${k}</option>`).join('');katEl.value=u?.kategori||'';}
  showPage('urun-form',true);
}
function goKullaniciForm(editId){
  const u=editId?state.users.find(x=>x.id===editId):null;
  document.getElementById('kf-edit-id').value=editId||'';
  document.getElementById('kf-title').textContent=u?'Kullanıcı Düzenle':'Yeni Kullanıcı';
  document.getElementById('kf-ad').value=u?.ad||'';document.getElementById('kf-username').value=u?.username||'';
  document.getElementById('kf-sifre').value='';document.getElementById('kf-email').value=u?.email||'';
  document.getElementById('kf-rol').value=u?.rol||'teknisyen';
  var teknEl=document.getElementById('kf-rol-tekn');
  if(teknEl)teknEl.textContent=currentPortal==='satis'?'Satış Uzmanı — Ekle/Düzenle':'Teknisyen — Ekle/Düzenle';
  showPage('kullanici-form',true);
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
function getUrunAds(){return state.urunler.map(u=>({label:u.urunAdi+(u.marka?' ('+u.marka+')':''),sub:u.model||''}))}

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
  if(backBtn)backBtn.textContent='← Geri';
}

function cancelMusteriAdd(){
  var ret=state._musterAddReturn;
  state._musterAddReturn=null;
  if(ret)showPage(ret.returnPage,true);
  else showPage('musteriler');
}

function comboFilterServis(){
  var q=document.getElementById('tf-servis-ara').value.toLowerCase();
  var items=state.servisler.filter(function(s){return (s.kayitNo+s.kurumAdi+s.seriNo).toLowerCase().includes(q||'');}).slice(0,10);
  var drop=document.getElementById('cb-tf-servis');
  if(!items.length){drop.classList.remove('open');return;}
  drop.innerHTML=items.map(function(s){
    return '<div class="combo-item" onmousedown="event.preventDefault();selectServisForTeklif(\''+s.id+'\')">'+s.kayitNo+' — '+s.kurumAdi+'<div class="sub">Seri: '+(s.seriNo||'—')+' | '+s.durum+'</div></div>';
  }).join('');
  drop.classList.add('open');
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
function comboSelect(inputId,dropId,val){var inp=document.getElementById(inputId);if(inp)inp.value=val;comboClose(dropId);}
function comboClose(id){const el=document.getElementById(id);if(el)el.classList.remove('open');}

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
  const items=state.urunler.filter(u=>(u.urunAdi+' '+(u.marka||'')).toLowerCase().includes(q||'')).slice(0,50);
  const drop=_getTiDrop();
  if(!items.length){drop.style.display='none';return;}
  drop.innerHTML=items.map((u,i)=>`<div class="combo-item" data-combo-idx="${i}"
    data-urun="${u.urunAdi.replace(/"/g,'&quot;')}" data-fiyat="${u.fiyat||0}" data-model="${u.model||''}"
    onmousedown="event.preventDefault();selectTiUrun(${idx},${i})">${u.urunAdi}${u.marka?' <span style="color:var(--text3);font-size:11px">('+u.marka+')</span>':''}${u.model&&parseInt(u.model)?` <span style="color:var(--accent);font-size:11px;margin-left:6px">${u.model}P</span>`:''}${u.fiyat?` <span style="color:var(--amber);font-size:11px;margin-left:8px">${fmtTL(u.fiyat)}</span>`:''}</div>`).join('');
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
    const isChecked=p in mevMap;
    const val=isChecked?(mevMap[p]||''):'';
    return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:7px;background:var(--bg3);border:1px solid var(--border)"><input type="checkbox" id="ps-cb-${i}" value="${p.replace(/"/g,'&quot;')}" ${isChecked?'checked':''} onchange="updateParamSecCounter()"><label for="ps-cb-${i}" style="font-size:13px;color:var(--text);flex:1;cursor:pointer">${p}</label><input type="text" id="ps-val-${i}" value="${val.replace(/"/g,'&quot;')}" placeholder="değer" style="width:110px;font-size:12px;padding:3px 8px;border-radius:4px;border:1px solid var(--border2);background:var(--bg4);color:var(--text)" ${isChecked?'':'disabled'}></div>`;
  }).join('');
  updateParamSecCounter();
  openModal('modal-parametre-sec');
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
  var svgSrc='data:image/svg+xml;base64,'+LOGO_SVG_B64;
  document.querySelectorAll('#login-logo-img,#sb-logo-img,#portal-logo-img').forEach(function(el){
    el.src=svgSrc;
    el.style.filter=isDark?'brightness(0) invert(1)':'none';
  });
}
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('ege_theme',t);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.id==='btn-theme-'+t));
  const btn=document.getElementById('topbar-theme-btn');
  if(btn)btn.textContent=t==='dark'?'🌙':'☀';
  applyLogoForTheme(t);
  applyLogoForTheme(t);
}
function loadTheme(){
  const t=localStorage.getItem('ege_theme')||'dark';
  document.documentElement.setAttribute('data-theme',t);
  document.querySelectorAll('.theme-btn').forEach(b=>b.classList.toggle('active',b.id==='btn-theme-'+t));
  setTimeout(()=>{const btn=document.getElementById('topbar-theme-btn');if(btn)btn.textContent=t==='dark'?'🌙':'☀';},0);
}
function toggleTheme(){
  const cur=document.documentElement.getAttribute('data-theme')||'dark';
  setTheme(cur==='dark'?'light':'dark');
}
loadTheme();

// ════ TUTANAKLAR ════
