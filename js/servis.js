var servisPage=1;var _servisFilterHash='';
function setServisPage(n){servisPage=n;renderTable();}

async function loadServisler(){
  try{
    var res=await apiGet('servisler');
    state.servisler=res.servisler||[];
  }catch(e){
    toast(e.message||'Servis kayıtları yüklenemedi.','error');
    state.servisler=state.servisler||[];
  }
  renderTable();
}

// Servis kaydının durumunu (ve varsa diğer alanlarını) API üzerinden günceller.
// teklif.js ve tutanak.js içindeki durum eşleme mantığı da bu fonksiyonu kullanır.
async function updateServisDurum(servisId,changes){
  var idx=state.servisler.findIndex(function(x){return x.id===servisId;});
  if(idx<0)return null;
  var payload={...state.servisler[idx],...changes};
  try{
    var res=await apiPut('servisler',payload);
    state.servisler[idx]=res.servis;
    return res.servis;
  }catch(e){
    toast(e.message||'Servis kaydı güncellenemedi.','error');
    return null;
  }
}

// ════ SERİ NO LİSTESİ ════
function _seriNoRowHTML(val){
  return '<div class="seri-no-row" style="display:flex;gap:6px;margin-bottom:4px">'
    +'<input type="text" class="seri-no-input" placeholder="Seri numarası..." style="flex:1" value="'+(val||'').replace(/"/g,'&quot;')+'">'
    +'<button type="button" class="btn-icon" style="color:var(--text3);flex-shrink:0" onclick="removeSeriNoRow(this)" title="Kaldır">✕</button>'
    +'</div>';
}
function setSeriNolar(arr){
  var list=document.getElementById('seri-no-list');if(!list)return;
  var data=(arr&&arr.length)?arr:[''];
  list.innerHTML=data.map(function(v){return _seriNoRowHTML(v);}).join('');
}
function addSeriNoRow(){
  var list=document.getElementById('seri-no-list');if(!list)return;
  list.insertAdjacentHTML('beforeend',_seriNoRowHTML(''));
  var inputs=list.querySelectorAll('.seri-no-input');
  if(inputs.length)inputs[inputs.length-1].focus();
}
function removeSeriNoRow(btn){
  var list=document.getElementById('seri-no-list');if(!list)return;
  var rows=list.querySelectorAll('.seri-no-row');
  if(rows.length>1){btn.closest('.seri-no-row').remove();}
  else{var inp=btn.closest('.seri-no-row').querySelector('.seri-no-input');if(inp)inp.value='';}
}
function getSeriNolar(){
  return Array.from(document.querySelectorAll('#seri-no-list .seri-no-input'))
    .map(function(i){return i.value.trim();}).filter(Boolean);
}

function showDurumMenu(sid, btnEl){
  // Remove any existing menu
  var existing=document.getElementById('durum-menu-'+sid);
  if(existing){existing.remove();return;}
  document.querySelectorAll('.durum-quick-menu').forEach(function(m){m.remove();});
  const MANUEL_DURUMLAR=['İşlemsiz İade'];
  const s=state.servisler.find(x=>x.id===sid);
  if(!s)return;
  const menu=document.createElement('div');
  menu.id='durum-menu-'+sid;
  menu.className='durum-quick-menu';
  menu.style.cssText='position:fixed;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;z-index:600;min-width:190px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;';
  menu.innerHTML=MANUEL_DURUMLAR.map(function(d){
    var active=d===s.durum;
    return '<div onmousedown="event.stopPropagation();quickDurumChange(\''+sid+'\',\''+d+'\');document.getElementById(\'durum-menu-'+sid+'\')?.remove();" style="padding:9px 14px;font-size:13px;cursor:pointer;display:flex;align-items:center;gap:8px;'+(active?'background:var(--accent-soft);color:var(--accent);font-weight:600;':'color:var(--text2);')+'transition:background .1s;" onmouseover="this.style.background=\'var(--bg4)\'" onmouseout="this.style.background=\''+(active?'var(--accent-soft)':'')+'\'"><span style="width:7px;height:7px;border-radius:50%;background:'+durumColor(d)+';flex-shrink:0;display:inline-block"></span>'+d+(active?' ✓':'')+'</div>';
  }).join('');
  document.body.appendChild(menu);
  // Position near button
  const r=btnEl.getBoundingClientRect();
  const mh=menu.offsetHeight||240;
  const top=r.bottom+window.scrollY+2;
  const left=r.right-190;
  menu.style.top=(r.bottom+2)+'px';
  menu.style.left=Math.max(8,r.right-190)+'px';
  // Close on outside click
  setTimeout(function(){
    document.addEventListener('click',function _close(){
      menu.remove();
      document.removeEventListener('click',_close);
    });
  },10);
}

function durumColor(d){
  const map={'Cihaz Kabul':'#2dd4bf','Arıza Tespitinde':'#f59e0b','Yanıt Bekleniyor':'#a78bfa','Onarımda':'#3d9bc4','Reddedildi':'#f87171','Teslim Edildi':'#4ade80','İşlemsiz İade':'#f97316'};
  return map[d]||'#888';
}

async function quickDurumChange(sid,yeni){
  var MANUEL_DURUMLAR=['İşlemsiz İade'];
  if(!MANUEL_DURUMLAR.includes(yeni)){toast('Bu durum yalnızca Teklifler menüsünden değiştirilebilir.','info');return;}
  var updated=await updateServisDurum(sid,{durum:yeni});
  if(!updated)return;
  renderTable();renderDashboard();
  toast('Durum "'+yeni+'" olarak güncellendi.','success');
}

const ARSIV_DURUMLAR = ['Teslim Edildi', 'Reddedildi', 'İşlemsiz İade'];
let servisTab = 'aktif';

function switchServisTab(tab) {
  servisTab = tab;
  document.getElementById('tab-aktif').classList.toggle('active', tab === 'aktif');
  document.getElementById('tab-arsiv').classList.toggle('active', tab === 'arsiv');
  var newBtn = document.getElementById('topbar-new-servis-btn');
  if(newBtn) newBtn.style.display = (tab === 'aktif' && state.currentUser && state.currentUser.rol !== 'izleyici') ? '' : 'none';
  // Arşiv tabında teklif butonu da gizle
  var ntBtn = document.getElementById('topbar-new-teklif-btn');
  if(ntBtn) ntBtn.style.display = 'none';
  clearFilters(false);
  renderTable();
}

async function arsivdenGeriAl(sid) {
  var updated = await updateServisDurum(sid, {durum: 'Cihaz Kabul'});
  if(!updated) return;
  renderTable();
  toast('Kayit aktife alindi.', 'success');
}

function renderTable(){
  var aktifSayisi = state.servisler.filter(function(s){return ARSIV_DURUMLAR.indexOf(s.durum)<0;}).length;
  var arsivSayisi = state.servisler.filter(function(s){return ARSIV_DURUMLAR.indexOf(s.durum)>=0;}).length;
  var aktifEl = document.getElementById('tab-aktif-count');
  var arsivEl = document.getElementById('tab-arsiv-count');
  if(aktifEl) aktifEl.textContent = aktifSayisi;
  if(arsivEl) arsivEl.textContent = arsivSayisi;

  let data=[...state.servisler];
  const isArsiv = servisTab === 'arsiv';
  if(!isArsiv) data=data.filter(function(s){return ARSIV_DURUMLAR.indexOf(s.durum)<0;});
  else data=data.filter(function(s){return ARSIV_DURUMLAR.indexOf(s.durum)>=0;});

  const fK=(document.getElementById('f-kurum').value||'').toLowerCase();
  const fS=(document.getElementById('f-seri').value||'').toLowerCase();
  const fD=document.getElementById('f-durum').value;
  const fG=document.getElementById('f-garanti').value;
  const fTs=document.getElementById('f-ts').value;
  const fTe=document.getElementById('f-te').value;
  if(fK)data=data.filter(s=>s.kurumAdi.toLowerCase().includes(fK));
  if(fS)data=data.filter(s=>(s.seriNo||'').toString().includes(fS)||s.kayitNo.toLowerCase().includes(fS));
  if(fD)data=data.filter(s=>s.durum===fD);
  if(fG)data=data.filter(s=>s.garantiDurumu===fG);
  if(fTs)data=data.filter(s=>s.gelisTarihi>=fTs);
  if(fTe)data=data.filter(s=>s.gelisTarihi<=fTe);
  data.sort((a,b)=>{const va=a[state.sortCol]||'',vb=b[state.sortCol]||'',dir=state.sortDir==='asc'?1:-1;return va<vb?-dir:va>vb?dir:0});
  var newSH=JSON.stringify([fK,fS,fD,fG,fTs,fTe,servisTab]);if(newSH!==_servisFilterHash){servisPage=1;_servisFilterHash=newSH;}
  document.getElementById('filter-count').textContent=data.length+' kayit';
  const canEdit = !!(state.currentUser && state.currentUser.rol !== 'izleyici' && !isArsiv);
  const canWrite = !!(state.currentUser && state.currentUser.rol !== 'izleyici');
  const canBulk = isArsiv && canWrite;
  if(!isArsiv) bulkClear('servisArsiv');
  bulkSetVisible('servisArsiv', data.map(function(s){return s.id;}));
  var thCheck=document.getElementById('th-servis-check');
  if(thCheck){
    thCheck.style.display=canBulk?'':'none';
    var thCb=thCheck.querySelector('input');if(thCb)thCb.checked=canBulk&&bulkAllChecked('servisArsiv');
  }
  var bulkBarEl=document.getElementById('servis-bulk-bar');
  var bulkCountEl=document.getElementById('servis-bulk-count');
  var selCount=canBulk?bulkCount('servisArsiv'):0;
  if(bulkCountEl)bulkCountEl.textContent=selCount>0?selCount+' öğe seçildi':'';
  if(bulkBarEl)bulkBarEl.innerHTML=selCount>0
    ?'<button class="btn btn-danger btn-sm" onclick="confirmDeleteBulk(\'servis\',bulkSelectedIds(\'servisArsiv\'))"><i class="ti ti-trash"></i> Seçilenleri Sil</button>'
    :'';
  const tbody=document.getElementById('table-body');
  const emptyEl=document.getElementById('table-empty');
  const emptyMsg=document.getElementById('table-empty-msg');
  if(!data.length){
    tbody.innerHTML='';
    if(emptyMsg) emptyMsg.textContent = isArsiv ? 'Arsivde kayit yok' : 'Kayit bulunamadi';
    if(emptyEl) emptyEl.style.display='';
    renderPagination('servis-pagination',1,0,'setServisPage');
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  var pagedServis=data.slice((servisPage-1)*PAGE_SIZE,servisPage*PAGE_SIZE);
  renderPagination('servis-pagination',servisPage,data.length,'setServisPage');
  tbody.innerHTML=pagedServis.map(s=>{
    const hasTeklif=state.teklifler.some(t=>t.servisId===s.id);
    const isArizaTespitinde=s.durum==='Arıza Tespitinde';
    const isPreTeklif=s.durum==='Cihaz Kabul'||isArizaTespitinde;
    // Düzenle: arşiv değilse her zaman aktif
    const editBtn=canEdit&&!isArsiv
      ?`<button class="btn-icon" title="Düzenle" onclick="goServisForm('${s.id}')"><i class="ti ti-edit" style="color:var(--accent)"></i></button>`
      :`<button class="btn-icon" title="Kayıt Görüntüle" style="color:var(--accent)" onclick="goServisForm('${s.id}',true)"><i class="ti ti-info-circle"></i></button>`;
    // Durum değiştir: teklif sürecine girmemiş kayıtlarda (İşlemsiz İade seçeneği için)
    const durumBtn=canEdit&&!isArsiv&&isPreTeklif
      ?`<button class="btn-icon" title="Durum Değiştir" style="color:var(--accent)" onclick="showDurumMenu('${s.id}',this)"><i class="ti ti-progress"></i></button>`
      :'';
    // Teklif butonu: Arıza Tespitinde + teklif yok → Tekliflendir; teklif varsa → Teklife Git
    let teklifBtn='';
    if(!isArsiv){
      if(canEdit&&isArizaTespitinde&&!hasTeklif)teklifBtn=`<button class="btn-icon" title="Tekliflendir" style="color:var(--amber);border-color:rgba(245,158,11,.3)" onclick="tekliflendir('${s.id}')"><i class="ti ti-file-invoice"></i></button>`;
      else if(hasTeklif)teklifBtn=`<button class="btn-icon" title="Teklife Git" style="color:var(--amber);border-color:rgba(245,158,11,.3)" onclick="tekliflendir('${s.id}')"><i class="ti ti-file-invoice"></i></button>`;
    }
    return`<tr${isArsiv?' style="opacity:0.8"':''}>
      ${canBulk?`<td><input type="checkbox" ${bulkIsChecked('servisArsiv',s.id)?'checked':''} onchange="bulkToggleRow('servisArsiv','${s.id}','renderTable')"></td>`:''}
      <td><span class="kn-badge">${esc(s.kayitNo)}</span></td>
      <td style="font-weight:500;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(s.kurumAdi||'—')}</td>
      <td class="td-mono">${esc(s.seriNo||'—')}</td>
      <td class="td-mono" style="color:var(--text2)">${fmtDate(s.gelisTarihi)}</td>
      <td>${durumBadge(s.durum)}</td>
      <td><span class="badge ${s.garantiDurumu==='Evet'?'badge-garanti-evet':'badge-garanti-hayir'}">${esc(s.garantiDurumu)}</span></td>
      <td style="color:var(--text2);font-size:12px">${esc(s.ilgiliKisi||'—')}</td>
      <td><div class="action-row" style="justify-content:flex-end">
        ${editBtn}
        ${durumBtn}
        ${teklifBtn}
        ${isArsiv&&state.currentUser&&state.currentUser.rol!=='izleyici'?`<button class="btn-icon" title="Aktife Al" style="color:var(--teal);border-color:rgba(45,212,191,.3)" onclick="arsivdenGeriAl('${s.id}')"><i class="ti ti-arrow-back-up"></i></button>`:''}
        ${state.currentUser&&state.currentUser.rol!=='izleyici'?`<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('servis','${s.id}')"><i class="ti ti-trash"></i></button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}
function sortTable(col){if(state.sortCol===col)state.sortDir=state.sortDir==='asc'?'desc':'asc';else{state.sortCol=col;state.sortDir='asc';}document.querySelectorAll('[id^=sort-]').forEach(el=>el.textContent='');const el=document.getElementById('sort-'+col);if(el)el.innerHTML=state.sortDir==='asc'?'<i class="ti ti-arrow-narrow-up"></i>':'<i class="ti ti-arrow-narrow-down"></i>';renderTable()}
function filterTable(){renderTable()}
function clearTeklifFilters(){
  ['tf-f-kurum','tf-f-teklif','tf-f-seri','tf-f-durum','tf-f-ts','tf-f-te'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  syncCustomSelectLabels();
  renderTeklifler();
}
function clearFilters(doRender){if(doRender===false){['f-kurum','f-seri'].forEach(function(id){document.getElementById(id).value='';});['f-durum','f-garanti'].forEach(function(id){document.getElementById(id).value='';});['f-ts','f-te'].forEach(function(id){document.getElementById(id).value='';});syncCustomSelectLabels();return;}['f-kurum','f-seri'].forEach(function(id){document.getElementById(id).value='';});['f-durum','f-garanti'].forEach(function(id){document.getElementById(id).value='';});['f-ts','f-te'].forEach(function(id){document.getElementById(id).value='';});syncCustomSelectLabels();renderTable();}
function tekliflendir(sid){const ex=state.teklifler.find(t=>t.servisId===sid);if(ex){openTeklifDetay(ex.id)}else{goTeklifForm(null,sid);showPage('teklif-form',true)}}

// ════ SAVE SERVIS ════
async function saveServis(){
  const editId=document.getElementById('sf-edit-id').value;
  const kurumVal=document.getElementById('sf-kurumAdi').value.trim();
  const musteriId=(document.getElementById('sf-musteri-id')||{}).value||'';
  if(!kurumVal)return toast('Kurum / müşteri zorunludur.','error');
  if(!musteriId)return toast('Lütfen müşteri listesinden seçin veya "+ Yeni Müşteri Ekle" ile ekleyin.','error');
  const payload={musteriId,kurumAdi:toTitleCase(document.getElementById('sf-kurumAdi').value.trim()),ilgiliKisi:toTitleCase(document.getElementById('sf-ilgiliKisi').value.trim()),telefon:document.getElementById('sf-telefon').value.trim(),email:document.getElementById('sf-email').value.trim(),urunAdi:'',seriNo:getSeriNolar().join(', '),garantiDurumu:document.getElementById('sf-garantiDurumu').value,aksesuarlar:[...sfAksesuarlar],aksesuarDiger:document.getElementById('sf-aksesuar-diger').value.trim(),gelisTarihi:document.getElementById('sf-gelisTarihi').value,durum:editId?((state.servisler.find(function(x){return x.id===editId;})||{}).durum||'Cihaz Kabul'):'Cihaz Kabul',kargoTarihi:document.getElementById('sf-kargoTarihi').value,kargoFirmasi:toTitleCase(document.getElementById('sf-kargoFirmasi').value.trim()),teslimAlan:toTitleCase(document.getElementById('sf-teslimAlan').value.trim()),notlar:document.getElementById('sf-notlar').value};
  try{
    if(editId){
      const idx=state.servisler.findIndex(x=>x.id===editId);
      if(idx<0)return;
      const res=await apiPut('servisler',{...payload,id:editId});
      state.servisler[idx]=res.servis;
      toast('Kayıt güncellendi.','success');
    }else{
      const res=await apiPost('servisler',payload);
      state.servisler.push(res.servis);
      toast('Servis kaydedildi.','success');
    }
  }catch(e){
    return toast(e.message||'Servis kaydı kaydedilemedi.','error');
  }
  _formDirty=false;showPage(state.prevPage||'servisler');
}
