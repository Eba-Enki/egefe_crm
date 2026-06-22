var musterilerPage=1;var _musteriFilterHash='';
var _musteriSortCol='kurum';var _musteriSortDir='asc';
function setMusterilerPage(n){musterilerPage=n;renderMusteriler();}
function sortMusteri(col){
  if(_musteriSortCol===col)_musteriSortDir=_musteriSortDir==='asc'?'desc':'asc';
  else{_musteriSortCol=col;_musteriSortDir='asc';}
  document.querySelectorAll('[id^=msort-]').forEach(function(el){el.innerHTML='';});
  var el=document.getElementById('msort-'+col);
  if(el)el.innerHTML=_musteriSortDir==='asc'?'<i class="ti ti-arrow-narrow-up"></i>':'<i class="ti ti-arrow-narrow-down"></i>';
  renderMusteriler();
}
var urunlerPage=1;var _urunFilterHash='';
function setUrunlerPage(n){urunlerPage=n;renderUrunler();}

async function loadMusteriler(){
  try{
    var res=await apiGet('musteriler?portal='+currentPortal);
    state.musteriler=res.musteriler||[];
  }catch(e){
    toast(e.message||'Müşteriler yüklenemedi.','error');
    state.musteriler=state.musteriler||[];
  }
  renderMusteriler();
}
function renderMusteriler(){
  let data=[...state.musteriler];
  const q=(document.getElementById('fm-ara').value||'').toLowerCase();
  if(q)data=data.filter(m=>(m.kurum+m.kisi+m.tel).toLowerCase().includes(q));
  document.getElementById('musteri-count').textContent=data.length+' müşteri';
  var newMH=JSON.stringify([q,_musteriSortCol,_musteriSortDir]);if(newMH!==_musteriFilterHash){musterilerPage=1;_musteriFilterHash=newMH;}
  data.sort(function(a,b){var va=(a[_musteriSortCol]||'').toString().toLowerCase(),vb=(b[_musteriSortCol]||'').toString().toLowerCase(),dir=_musteriSortDir==='asc'?1:-1;return va<vb?-dir:va>vb?dir:0;});
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  bulkSetVisible('musteriList',data.map(function(m){return m.id;}));
  var thCheck=document.getElementById('th-musteri-check');
  if(thCheck){thCheck.style.display=canEdit?'':'none';var thCb=thCheck.querySelector('input');if(thCb)thCb.checked=canEdit&&bulkAllChecked('musteriList');}
  var bulkBarEl=document.getElementById('musteri-bulk-bar');
  var bulkCountEl=document.getElementById('musteri-bulk-count');
  var selCount=canEdit?bulkCount('musteriList'):0;
  if(bulkCountEl)bulkCountEl.textContent=selCount>0?selCount+' öğe seçildi':'';
  if(bulkBarEl)bulkBarEl.innerHTML=selCount>0?'<button class="btn btn-danger btn-sm" onclick="confirmDeleteBulk(\'musteri\',bulkSelectedIds(\'musteriList\'))"><i class="ti ti-trash"></i> Seçilenleri Sil</button>':'';
  const tbody=document.getElementById('musteri-table-body');
  if(!data.length){tbody.innerHTML='';document.getElementById('musteri-empty').style.display='';renderPagination('musteri-pagination',1,0,'setMusterilerPage');return}
  document.getElementById('musteri-empty').style.display='none';
  var pagedM=data.slice((musterilerPage-1)*PAGE_SIZE,musterilerPage*PAGE_SIZE);
  renderPagination('musteri-pagination',musterilerPage,data.length,'setMusterilerPage');
  tbody.innerHTML=pagedM.map(m=>{return`<tr>${canEdit?`<td onclick="event.stopPropagation()"><input type="checkbox" ${bulkIsChecked('musteriList',m.id)?'checked':''} onchange="bulkToggleRow('musteriList','${esc(m.id)}','renderMusteriler')"></td>`:''}<td><span class="kn-badge" style="color:var(--accent);font-size:10px">${esc(m.kayitNo||'—')}</span></td><td style="font-weight:500;max-width:220px;white-space:normal;word-break:break-word">${esc(m.kurum)}</td><td style="color:var(--text2)">${esc(m.kisi||'—')}</td><td class="td-mono">${esc(m.tel||'—')}</td><td style="color:var(--text2)">${esc(m.email||'—')}</td><td>${esc(m.sehir||'—')}</td><td><div class="action-row" style="justify-content:flex-end"><button class="btn-icon" onclick="goMusteriForm('${esc(m.id)}')"><i class="ti ti-edit" style="color:var(--accent)"></i></button><button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('musteri','${esc(m.id)}')"><i class="ti ti-trash"></i></button></div></td></tr>`;}).join('');
}
async function saveMusteri(){
  const kurum=toTitleCase(document.getElementById('mf-kurum').value.trim());if(!kurum)return toast('Kurum adı zorunlu.','error');
  const editId=document.getElementById('mf-edit-id').value;
  const payload={kurum,kisi:toTitleCase(document.getElementById('mf-kisi').value.trim()),tel:document.getElementById('mf-tel').value.trim(),email:document.getElementById('mf-email').value.trim(),sehir:toTitleCase(document.getElementById('mf-sehir').value.trim()),adres:toTitleCase(document.getElementById('mf-adres').value.trim()),not:document.getElementById('mf-not').value.trim()};
  var savedMId;
  try{
    if(editId){
      const res=await apiPut('musteriler',{...payload,id:editId});
      const idx=state.musteriler.findIndex(x=>x.id===editId);
      if(idx>=0)state.musteriler[idx]=res.musteri;
      savedMId=editId;
      toast('Güncellendi.','success');
    } else {
      const res=await apiPost('musteriler',{...payload,portal:currentPortal});
      state.musteriler.push(res.musteri);
      savedMId=res.musteri.id;
      toast('Müşteri eklendi.','success');
    }
  }catch(e){
    return toast(e.message||'Müşteri kaydedilemedi.','error');
  }
  var ret=state._musterAddReturn;
  if(ret){
    state._musterAddReturn=null;
    _formDirty=false;showPage(ret.returnPage,true);
    var inp=document.getElementById(ret.inputId);if(inp)inp.value=payload.kurum;
    lockMusteriField(ret.inputId,savedMId);
    if(ret.inputId==='tf-kurum'){
      var ki=document.getElementById('tf-ilgiliKisi');if(ki)ki.value=payload.kisi||'';
      var tel=document.getElementById('tf-telefon');if(tel)tel.value=payload.tel||'';
      var eml=document.getElementById('tf-email');if(eml)eml.value=payload.email||'';
    } else if(ret.inputId==='sf-kurumAdi'){
      var ki2=document.getElementById('sf-ilgiliKisi');if(ki2)ki2.value=payload.kisi||'';
      var tel2=document.getElementById('sf-telefon');if(tel2)tel2.value=payload.tel||'';
      var eml2=document.getElementById('sf-email');if(eml2)eml2.value=payload.email||'';
    }
  } else {_formDirty=false;showPage('musteriler');}
}

// ════ ÜRÜNLER ════
async function loadUrunler(){
  try{
    var res=await apiGet('urunler?portal='+encodeURIComponent(currentPortal));
    state.urunler=res.urunler||[];
  }catch(e){
    toast(e.message||'Ürünler yüklenemedi.','error');
    state.urunler=state.urunler||[];
  }
  renderUrunler();
}
function renderUrunler(){
  let data=[...state.urunler];
  const q=(document.getElementById('fu-ara').value||'').toLowerCase();
  if(q)data=data.filter(u=>(u.urunAdi+u.marka+u.model+u.kategori).toLowerCase().includes(q));
  document.getElementById('urun-count').textContent=`${data.length} ürün`;
  var newUH=JSON.stringify([q]);if(newUH!==_urunFilterHash){urunlerPage=1;_urunFilterHash=newUH;}
  const tbody=document.getElementById('urun-table-body');
  if(!data.length){tbody.innerHTML='';document.getElementById('urun-empty').style.display='';renderPagination('urun-pagination',1,0,'setUrunlerPage');return}
  document.getElementById('urun-empty').style.display='none';
  const isSatis=currentPortal==='satis';
  var pagedU=data.slice((urunlerPage-1)*PAGE_SIZE,urunlerPage*PAGE_SIZE);
  renderPagination('urun-pagination',urunlerPage,data.length,'setUrunlerPage');
  const _fmtFiyat=(v,pb)=>{if(!v)return'—';const sym={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'};return(sym[pb||'TRY']||'₺')+' '+new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v);};
  tbody.innerHTML=pagedU.map(u=>{return`<tr><td class="td-mono" style="color:var(--accent);font-size:11px">${esc(u.urunKodu||'—')}</td><td style="font-weight:500">${esc(u.urunAdi)}</td><td style="color:var(--text2)">${esc(u.marka||'—')}</td>${isSatis?`<td style="color:var(--text2);font-size:12px">${esc(u.kategori||'—')}</td>`:''}<td class="td-mono" style="color:var(--text2)">${esc(u.model||'—')}</td><td class="td-mono" style="color:var(--amber)">${_fmtFiyat(u.fiyat,u.paraBirimi)}</td><td><div class="action-row" style="justify-content:flex-end"><button class="btn-icon" onclick="goUrunForm('${esc(u.id)}')"><i class="ti ti-edit" style="color:var(--accent)"></i></button><button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('urun','${esc(u.id)}')"><i class="ti ti-trash"></i></button></div></td></tr>`;}).join('');
}
async function saveUrun(){
  const urunAdi=document.getElementById('uf-urunAdi').value.trim();if(!urunAdi)return toast('Ürün adı zorunlu.','error');
  const editId=document.getElementById('uf-edit-id').value;
  const fiyatEl=document.getElementById('uf-fiyat');const fiyat=fiyatEl?parseFloat(fiyatEl.value)||0:0;
  var urunKoduEl=document.getElementById('uf-urunKodu');var urunKodu=urunKoduEl?urunKoduEl.value.trim():'';
  const pbEl2=document.getElementById('uf-paraBirimi');const paraBirimi=pbEl2?pbEl2.value:'TRY';
  const katEl=document.getElementById('uf-kategori');
  const payload={portal:currentPortal,urunAdi:toTitleCase(urunAdi),urunKodu,marka:toTitleCase(document.getElementById('uf-marka').value.trim()),model:toTitleCase(document.getElementById('uf-model').value.trim()),kategori:katEl?katEl.value:'',fiyat,paraBirimi,aciklama:document.getElementById('uf-aciklama').value.trim()};
  try{
    if(editId){
      const idx=state.urunler.findIndex(x=>x.id===editId);
      if(idx<0)return;
      const res=await apiPut('urunler',{...payload,id:editId});
      state.urunler[idx]=res.urun;
      toast('Güncellendi.','success');
    }else{
      const res=await apiPost('urunler',payload);
      state.urunler.push(res.urun);
      toast('Ürün eklendi.','success');
    }
  }catch(e){
    return toast(e.message||'Ürün kaydedilemedi.','error');
  }
  _formDirty=false;showPage('urunler');
}


// ════ TUTANAKLAR ════
function renderTutanaklar(){
  var tbody=document.getElementById('tutanak-table-body');
  var emptyEl=document.getElementById('tutanak-empty');
  if(!tbody)return;
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  bulkSetVisible('tutanakList',savedTutanaklar.map(function(t){return t.no;}));
  var thCheck=document.getElementById('th-tutanak-check');
  if(thCheck){thCheck.style.display=canEdit?'':'none';var thCb=thCheck.querySelector('input');if(thCb)thCb.checked=canEdit&&bulkAllChecked('tutanakList');}
  var bulkBarEl=document.getElementById('tutanak-bulk-bar');
  var bulkCountEl=document.getElementById('tutanak-bulk-count');
  var selCount=canEdit?bulkCount('tutanakList'):0;
  if(bulkCountEl)bulkCountEl.textContent=selCount>0?selCount+' öğe seçildi':'';
  if(bulkBarEl)bulkBarEl.innerHTML=selCount>0?'<button class="btn btn-danger btn-sm" onclick="confirmDeleteBulk(\'tutanak\',bulkSelectedIds(\'tutanakList\'))"><i class="ti ti-trash"></i> Seçilenleri Sil</button>':'';
  if(!savedTutanaklar.length){tbody.innerHTML='';if(emptyEl)emptyEl.style.display='';return;}
  if(emptyEl)emptyEl.style.display='none';
  tbody.innerHTML=savedTutanaklar.map(function(t){
    return '<tr style="cursor:pointer" onclick="previewTutanak(\''+t.no+'\')">'
      +(canEdit?'<td onclick="event.stopPropagation()"><input type="checkbox" '+(bulkIsChecked('tutanakList',t.no)?'checked':'')+' onchange="bulkToggleRow(\'tutanakList\',\''+t.no+'\',\'renderTutanaklar\')"></td>':'')
      +'<td><span class="kn-badge" style="border:none;background:transparent;padding:0">'+t.no+'</span></td>'
      +'<td class="td-mono">'+fmtDate(t.tarih)+'</td>'
      +'</tr>';
  }).join('');
}
// ════ ÜRÜN KATEGORİLERİ ════
function renderUrunKategorileri(){
  const el=document.getElementById('urun-kategori-list');if(!el)return;
  const cats=state.settings.urunKategoriler||[];
  if(!cats.length){el.innerHTML='<div style="font-size:12px;color:var(--text3)">Henüz kategori yok.</div>';return;}
  el.innerHTML=cats.map((k,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg3);border:1px solid var(--border);border-radius:6px;margin-bottom:6px"><span style="font-size:13px;color:var(--text)">${k}</span><button class="btn-icon" style="color:var(--red);flex-shrink:0" onclick="deleteUrunKategori(${i})"><i class="ti ti-trash"></i></button></div>`).join('');
}
async function addUrunKategori(){
  const inp=document.getElementById('yeni-kategori-input');if(!inp)return;
  const val=inp.value.trim();if(!val)return toast('Kategori adı girin.','error');
  if(!state.settings.urunKategoriler)state.settings.urunKategoriler=[];
  if(state.settings.urunKategoriler.includes(val))return toast('Bu kategori zaten mevcut.','error');
  var prev=state.settings.urunKategoriler;
  state.settings.urunKategoriler=prev.concat(val);
  try{
    await apiPut(currentPortal+'/ayarlar',state.settings);
  }catch(e){
    state.settings.urunKategoriler=prev;
    return toast(e.message||'Kategori eklenemedi.','error');
  }
  inp.value='';renderUrunKategorileri();toast('Kategori eklendi.','success');
}
async function deleteUrunKategori(i){
  if(!state.settings.urunKategoriler)return;
  var prev=state.settings.urunKategoriler;
  state.settings.urunKategoriler=prev.filter((_,idx)=>idx!==i);
  try{
    await apiPut(currentPortal+'/ayarlar',state.settings);
  }catch(e){
    state.settings.urunKategoriler=prev;
    return toast(e.message||'Kategori silinemedi.','error');
  }
  renderUrunKategorileri();toast('Kategori silindi.','info');
}

// ════ AYARLAR ════
function switchSettingsPanel(name){
  document.querySelectorAll('.settings-nav-item').forEach(function(el){el.classList.toggle('active',el.dataset.panel===name);});
  document.querySelectorAll('.settings-panel').forEach(function(el){el.classList.toggle('active',el.id==='sp-'+name);});
}
function updateSettingsPreview(){
  var sp=document.getElementById('set-servis-prefix');var sd=document.getElementById('set-servis-digits');
  var tp=document.getElementById('set-teklif-prefix');var td=document.getElementById('set-teklif-digits');
  var ps=document.getElementById('preview-servis');var pt=document.getElementById('preview-teklif');
  var sipp=document.getElementById('set-siparis-prefix');var sipd=document.getElementById('set-siparis-digits');var prs=document.getElementById('preview-siparis');
  if(sp&&sd&&ps){var p=sp.value.trim().toUpperCase()||'KN';var d=Math.min(9,Math.max(3,parseInt(sd.value)||6));ps.textContent=p+String(1).padStart(d,'0');}
  if(tp&&td&&pt){var p2=tp.value.trim().toUpperCase()||'TKL';var d2=Math.min(9,Math.max(3,parseInt(td.value)||5));pt.textContent=p2+String(1).padStart(d2,'0');}
  if(sipp&&sipd&&prs){var p3=sipp.value.trim().toUpperCase()||'SIP';var d3=Math.min(9,Math.max(3,parseInt(sipd.value)||5));prs.textContent=p3+String(1).padStart(d3,'0');}
}
function renderParametreler(){
  var params=state.settings.parametreler||[];
  var el=document.getElementById('parametre-list');if(!el)return;
  if(!params.length){el.innerHTML='<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">Henüz parametre eklenmedi.</div>';return;}
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr><th style="width:40px">#</th><th>Parametre Adı</th><th>Kısaltma</th><th></th></tr></thead><tbody>';
  params.forEach(function(p,i){
    var kisaltma=p.kisaltma||p.ad||'';
    html+='<tr>'
      +'<td style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">'+(i+1)+'</td>'
      +'<td style="font-weight:500">'+esc(p.ad||kisaltma)+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--accent)">'+esc(kisaltma)+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" title="Sil" onclick="deleteParametre('+i+')"><i class="ti ti-trash"></i></button>':'')
      +'</div></td>'
      +'</tr>';
  });
  el.innerHTML=html+'</tbody></table></div>';
}
async function addParametre(){
  const adInp=document.getElementById('yeni-parametre-ad');
  const kisInp=document.getElementById('yeni-parametre-kisaltma');
  const ad=(adInp?adInp.value||'':'').trim();
  const kisaltma=(kisInp?kisInp.value||'':'').trim().toUpperCase();
  if(!kisaltma)return toast('Kısaltma zorunludur.','error');
  if(!state.settings.parametreler)state.settings.parametreler=[];
  const list=state.settings.parametreler;
  if(list.some(function(p){return (typeof p==='string'?p:(p.kisaltma||'')).toUpperCase()===kisaltma;}))return toast('Bu kısaltma zaten kullanılıyor.','error');
  if(ad&&list.some(function(p){return typeof p!=='string'&&p.ad&&p.ad===ad;}))return toast('Bu parametre adı zaten mevcut.','error');
  var prev=list.slice();
  var yeni=prev.concat({ad:ad,kisaltma:kisaltma});
  yeni.sort(function(a,b){var ka=typeof a==='string'?a:(a.kisaltma||'');var kb=typeof b==='string'?b:(b.kisaltma||'');return ka.localeCompare(kb,'tr');});
  state.settings.parametreler=yeni;
  try{
    await apiPut(currentPortal+'/ayarlar',state.settings);
  }catch(e){
    state.settings.parametreler=prev;
    return toast(e.message||'Parametre eklenemedi.','error');
  }
  saveAll();
  if(adInp)adInp.value='';
  if(kisInp)kisInp.value='';
  renderParametreler();
  toast('Parametre eklendi.','success');
}
async function deleteParametre(i){
  var prev=state.settings.parametreler;
  state.settings.parametreler=prev.filter((_,idx)=>idx!==i);
  try{
    await apiPut(currentPortal+'/ayarlar',state.settings);
  }catch(e){
    state.settings.parametreler=prev;
    return toast(e.message||'Parametre silinemedi.','error');
  }
  saveAll();
  renderParametreler();
  toast('Parametre silindi.','info');
}
async function loadSettings(){
  try {
    var res=await apiGet(currentPortal+'/ayarlar');
    state.settings=Object.assign({},state.settings,res.ayarlar||{});
    if(!state.settings.urunKategoriler)state.settings.urunKategoriler=[];
  } catch(e){}
  if(!state.settings.parametreler)state.settings.parametreler=[];
  state.settings.parametreler=state.settings.parametreler.map(function(p){return typeof p==='string'?{ad:'',kisaltma:p}:p;});
  ['firma','tel','faks','adres','email','web','vergiDairesi','vergiNo'].forEach(k=>{const id='set-'+(k==='vergiDairesi'?'vergi-dairesi':k==='vergiNo'?'vergi-no':k);const el=document.getElementById(id);if(el)el.value=state.settings[k]||''});
  var spEl=document.getElementById('set-servis-prefix');if(spEl)spEl.value=state.settings.servisPrefix||'KN';
  var sdEl=document.getElementById('set-servis-digits');if(sdEl)sdEl.value=state.settings.servisDigits||6;
  var tpEl=document.getElementById('set-teklif-prefix');if(tpEl)tpEl.value=state.settings.teklifPrefix||'TKL';
  var tdEl=document.getElementById('set-teklif-digits');if(tdEl)tdEl.value=state.settings.teklifDigits||5;
  var sipPEl=document.getElementById('set-siparis-prefix');if(sipPEl)sipPEl.value=state.settings.siparisPrefix||'SIP';
  var sipDEl=document.getElementById('set-siparis-digits');if(sipDEl)sipDEl.value=state.settings.siparisDigits||5;
  var servisDiv=document.getElementById('settings-servis-kayit');
  var siparisDiv=document.getElementById('settings-siparis-no');
  var isSatis=typeof currentPortal!=='undefined'&&currentPortal==='satis';
  if(servisDiv)servisDiv.style.display=isSatis?'none':'';
  if(siparisDiv)siparisDiv.style.display=isSatis?'':'none';
  updateSettingsPreview();
  renderUrunKategorileri();
  renderParametreler();
}
function renderFooter(){
  var s=state.settings||{};
  var tel=s.tel||'0(312) 482 54 53';
  var faks=s.faks||'0(312) 482 54 51';
  var email=s.email||'info@ege-fe.com';
  var parts=[];
  parts.push('Tel: '+tel);
  parts.push('Fax: '+faks);
  parts.push('E-mail: '+email);
  var el=document.getElementById('footer-contact-text');
  if(el)el.innerHTML=parts.join(' &nbsp;|&nbsp; ');
  syncFooterSpacing();
}
async function saveSettings(){
  var prev=Object.assign({},state.settings);
  ['firma','tel','faks','adres','email','web','vergiDairesi','vergiNo'].forEach(k=>{const id='set-'+(k==='vergiDairesi'?'vergi-dairesi':k==='vergiNo'?'vergi-no':k);const el=document.getElementById(id);if(el)state.settings[k]=el.value});
  var spEl=document.getElementById('set-servis-prefix');if(spEl&&spEl.value.trim())state.settings.servisPrefix=spEl.value.trim().toUpperCase();
  var sdEl=document.getElementById('set-servis-digits');if(sdEl&&sdEl.value)state.settings.servisDigits=Math.min(9,Math.max(3,parseInt(sdEl.value)||6));
  var tpEl=document.getElementById('set-teklif-prefix');if(tpEl&&tpEl.value.trim())state.settings.teklifPrefix=tpEl.value.trim().toUpperCase();
  var tdEl=document.getElementById('set-teklif-digits');if(tdEl&&tdEl.value)state.settings.teklifDigits=Math.min(9,Math.max(3,parseInt(tdEl.value)||5));
  var sipPEl=document.getElementById('set-siparis-prefix');if(sipPEl&&sipPEl.value.trim())state.settings.siparisPrefix=sipPEl.value.trim().toUpperCase();
  var sipDEl=document.getElementById('set-siparis-digits');if(sipDEl&&sipDEl.value)state.settings.siparisDigits=Math.min(9,Math.max(3,parseInt(sipDEl.value)||5));
  try{
    await apiPut(currentPortal+'/ayarlar',state.settings);
  }catch(e){
    state.settings=prev;
    return toast(e.message||'Ayarlar kaydedilemedi.','error');
  }
  saveAll();
  renderFooter();toast('Ayarlar kaydedildi.','success');
}

// ════ CONFIRM DELETE ════
function confirmDelete(type,id){
  const msgs={servis:'Bu servis kaydını silmek istiyor musunuz? İlişkili teklifler de silinecek.',teklif:'Bu teklifi silmek istiyor musunuz?',siparis:'Bu siparişi silmek istiyor musunuz?',fatura:'Bu faturayı silmek istiyor musunuz?',musteri:'Bu müşteriyi silmek istiyor musunuz?',urun:'Bu ürünü silmek istiyor musunuz?',kullanici:'Bu kullanıcıyı silmek istiyor musunuz?'};
  showConfirm(msgs[type]||'Emin misiniz?',async function(){
    if(type==='servis'){
      try{await apiDelete('servisler?id='+encodeURIComponent(id));}
      catch(e){return toast(e.message||'Servis kaydı silinemedi.','error');}
      state.servisler=state.servisler.filter(x=>x.id!==id);
      state.teklifler=state.teklifler.filter(t=>t.servisId!==id);
    }
    else if(type==='teklif'){
      try{await apiDelete('teklifler?id='+encodeURIComponent(id));}
      catch(e){return toast(e.message||'Teklif silinemedi.','error');}
      state.teklifler=state.teklifler.filter(x=>x.id!==id);
    }
    else if(type==='musteri'){
      try{await apiDelete('musteriler?id='+encodeURIComponent(id));}
      catch(e){return toast(e.message||'Müşteri silinemedi.','error');}
      state.musteriler=state.musteriler.filter(x=>x.id!==id);
    }
    else if(type==='urun'){
      try{await apiDelete('urunler?id='+encodeURIComponent(id));}
      catch(e){return toast(e.message||'Ürün silinemedi.','error');}
      state.urunler=state.urunler.filter(x=>x.id!==id);
    }
    else if(type==='siparis'){
      try{await apiDelete('siparisler?id='+encodeURIComponent(id));}
      catch(e){return toast(e.message||'Sipariş silinemedi.','error');}
      state.siparisler=(state.siparisler||[]).filter(function(x){return x.id!==id;});
    }
    else if(type==='fatura'){
      var fat=(state.faturalar||[]).find(function(x){return x.id===id;});
      try{await apiDelete('faturalar?id='+encodeURIComponent(id));}
      catch(e){return toast(e.message||'Fatura silinemedi.','error');}
      state.faturalar=(state.faturalar||[]).filter(function(x){return x.id!==id;});
      if(fat&&fat.siparisId){
        try{var sr=await apiGet('siparisler');state.siparisler=sr.siparisler||[];}catch(e){}
        renderSiparisler();
      }
    }
    if(type!=='musteri') saveAll();
    const refreshMap={servis:()=>{renderTable();renderDashboard()},teklif:renderTeklifler,siparis:renderSiparisler,fatura:renderFaturalar,musteri:renderMusteriler,urun:renderUrunler};
    if(refreshMap[type])refreshMap[type]();
    toast('Silindi.','info');
  });
}

function confirmDeleteBulk(type,ids){
  if(!ids||!ids.length)return;
  if(type==='tutanak'){
    showConfirm(ids.length+' tutanağı silmek istiyor musunuz?',async function(){
      var failed=0;
      for(var i=0;i<ids.length;i++){
        var no=ids[i];
        try{await apiDelete('tutanaklar?id='+encodeURIComponent(no));}
        catch(e){failed++;continue;}
        savedTutanaklar=savedTutanaklar.filter(function(t){return t.no!==no;});
      }
      bulkClear('tutanakList');
      renderTutanaklar();
      toast(failed?(ids.length-failed)+' silindi, '+failed+' başarısız.':ids.length+' tutanak silindi.',failed?'error':'info');
    },{okText:'Sil',okClass:'btn-danger'});
    return;
  }
  const endpoints={servis:'servisler',teklif:'teklifler',musteri:'musteriler',urun:'urunler',siparis:'siparisler',fatura:'faturalar'};
  const stateKeys={servis:'servisler',teklif:'teklifler',musteri:'musteriler',urun:'urunler',siparis:'siparisler',fatura:'faturalar'};
  const ep=endpoints[type]; if(!ep)return;
  showConfirm(ids.length+' kaydı silmek istiyor musunuz?',async function(){
    var failed=0;
    for(var i=0;i<ids.length;i++){
      var id=ids[i];
      try{await apiDelete(ep+'?id='+encodeURIComponent(id));}
      catch(e){failed++;continue;}
      state[stateKeys[type]]=state[stateKeys[type]].filter(function(x){return x.id!==id;});
      if(type==='servis')state.teklifler=state.teklifler.filter(function(t){return t.servisId!==id;});
    }
    if(type==='fatura'){
      try{var srb=await apiGet('siparisler');state.siparisler=srb.siparisler||[];}catch(e){}
      renderSiparisler();
    }
    if(type!=='musteri') saveAll();
    const refreshMap={servis:()=>{renderTable();renderDashboard()},teklif:renderTeklifler,siparis:renderSiparisler,fatura:renderFaturalar,musteri:renderMusteriler,urun:renderUrunler};
    if(refreshMap[type])refreshMap[type]();
    toast(failed?(ids.length-failed)+' silindi, '+failed+' başarısız.':ids.length+' kayıt silindi.',failed?'error':'info');
  },{okText:'Sil',okClass:'btn-danger'});
}


// ════ EXCEL IMPORT — MÜŞTERİLER ════
function downloadMusteriSablon(){
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet([['Kurum Adı*','İlgili Kişi','Telefon','E-posta','Şehir','Adres','Notlar']]);
  ws['!cols']=[{wch:30},{wch:20},{wch:15},{wch:25},{wch:15},{wch:35},{wch:30}];
  XLSX.utils.book_append_sheet(wb,ws,'Müşteriler');
  var wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='musteri-sablon.xlsx';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function importMusterilerExcel(e){
  var file=e.target.files[0];e.target.value='';if(!file)return;
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var reader=new FileReader();
  reader.onload=async function(ev){
    try{
      var wb=XLSX.read(ev.target.result,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      var eklenen=0,atlanan=0;
      for(const row of rows){
        var kurum=(row['Kurum Adı*']||row['Kurum Adı']||'').toString().trim();
        if(!kurum){atlanan++;continue;}
        var mevcutMu=state.musteriler.some(function(m){return m.kurum.toLowerCase()===kurum.toLowerCase();});
        if(mevcutMu){atlanan++;continue;}
        var payload={
          kurum:toTitleCase(kurum),
          kisi:toTitleCase((row['İlgili Kişi']||'').toString().trim()),
          tel:(row['Telefon']||'').toString().trim(),
          email:(row['E-posta']||'').toString().trim(),
          sehir:toTitleCase((row['Şehir']||'').toString().trim()),
          adres:toTitleCase((row['Adres']||'').toString().trim()),
          not:(row['Notlar']||'').toString().trim()
        };
        try{
          var res=await apiPost('musteriler',{...payload,portal:currentPortal});
          state.musteriler.push(res.musteri);
          eklenen++;
        }catch(err){atlanan++;}
      }
      renderMusteriler();
      if(eklenen&&atlanan)toast(eklenen+' müşteri eklendi, '+atlanan+' satır atlandı (zaten mevcut veya boş).','success');
      else if(eklenen)toast(eklenen+' müşteri eklendi.','success');
      else toast('Eklenecek yeni kayıt bulunamadı.','info');
    }catch(err){toast('Dosya okunamadı: '+err.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}

// ════ EXCEL IMPORT — ÜRÜNLER ════
function downloadUrunSablon(){
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet([['Ürün / İşlem Adı*','Ürün Kodu','Marka','Model','Liste Fiyatı','Para Birimi (TRY/USD/EUR/GBP)','Kategori','Açıklama']]);
  ws['!cols']=[{wch:30},{wch:15},{wch:15},{wch:20},{wch:12},{wch:28},{wch:20},{wch:35}];
  XLSX.utils.book_append_sheet(wb,ws,'Ürünler');
  var wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='urun-sablon.xlsx';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

function importUrunlerExcel(e){
  var file=e.target.files[0];e.target.value='';if(!file)return;
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var reader=new FileReader();
  reader.onload=async function(ev){
    try{
      var wb=XLSX.read(ev.target.result,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{defval:''});
      var eklenen=0,atlanan=0;
      for(const row of rows){
        var urunAdi=(row['Ürün / İşlem Adı*']||row['Ürün / İşlem Adı']||'').toString().trim();
        if(!urunAdi){atlanan++;continue;}
        var urunKodu=(row['Ürün Kodu']||'').toString().trim();
        var mevcutMu=state.urunler.some(function(u){
          if(urunKodu&&u.urunKodu)return u.urunKodu.toLowerCase()===urunKodu.toLowerCase();
          return u.urunAdi.toLowerCase()===urunAdi.toLowerCase();
        });
        if(mevcutMu){atlanan++;continue;}
        var fiyatRaw=(row['Liste Fiyatı']||'').toString().replace(',','.');
        var fiyat=parseFloat(fiyatRaw)||0;
        var pb=(row['Para Birimi (TRY/USD/EUR/GBP)']||'TRY').toString().trim().toUpperCase();
        if(!['TRY','USD','EUR','GBP'].includes(pb))pb='TRY';
        var payload={
          portal:currentPortal,
          urunAdi:toTitleCase(urunAdi),
          urunKodu:urunKodu,
          marka:toTitleCase((row['Marka']||'').toString().trim()),
          model:toTitleCase((row['Model']||'').toString().trim()),
          fiyat:fiyat,
          paraBirimi:pb,
          kategori:(row['Kategori']||'').toString().trim(),
          aciklama:(row['Açıklama']||'').toString().trim()
        };
        try{
          var res=await apiPost('urunler',payload);
          state.urunler.push(res.urun);
          eklenen++;
        }catch(err){atlanan++;}
      }
      renderUrunler();
      if(eklenen&&atlanan)toast(eklenen+' ürün eklendi, '+atlanan+' satır atlandı (zaten mevcut veya boş).','success');
      else if(eklenen)toast(eklenen+' ürün eklendi.','success');
      else toast('Eklenecek yeni kayıt bulunamadı.','info');
    }catch(err){toast('Dosya okunamadı: '+err.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}
