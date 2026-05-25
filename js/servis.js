function showDurumMenu(sid, btnEl){
  // Remove any existing menu
  var existing=document.getElementById('durum-menu-'+sid);
  if(existing){existing.remove();return;}
  document.querySelectorAll('.durum-quick-menu').forEach(function(m){m.remove();});
  const DURUMLAR=['Yeni Gelen','S.F. Bekleniyor','Onay Bekleniyor','Onaylandı','Kargoya Verildi','Tamamlandı','Reddedildi'];
  const s=state.servisler.find(x=>x.id===sid);
  if(!s)return;
  const menu=document.createElement('div');
  menu.id='durum-menu-'+sid;
  menu.className='durum-quick-menu';
  menu.style.cssText='position:fixed;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;z-index:600;min-width:190px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;';
  menu.innerHTML=DURUMLAR.map(function(d){
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
  const map={'Yeni Gelen':'#2dd4bf','S.F. Bekleniyor':'#f59e0b','Onay Bekleniyor':'#a78bfa','Onaylandı':'#3d9bc4','Kargoya Verildi':'#f472b6','Tamamlandı':'#4ade80','Reddedildi':'#f87171'};
  return map[d]||'#888';
}

const ARSIV_DURUMLAR = ['Tamamlandı', 'Reddedildi'];
let servisTab = 'aktif';

function switchServisTab(tab) {
  servisTab = tab;
  document.getElementById('tab-aktif').classList.toggle('active', tab === 'aktif');
  document.getElementById('tab-arsiv').classList.toggle('active', tab === 'arsiv');
  var newBtn = document.getElementById('topbar-new-servis-btn');
  if(newBtn) newBtn.style.display = (tab === 'aktif' && state.currentUser && state.currentUser.rol !== 'izleyici') ? '' : 'none';
  clearFilters(false);
  renderTable();
}

function arsivdenGeriAl(sid) {
  var idx = state.servisler.findIndex(function(x){return x.id===sid;});
  if(idx < 0) return;
  state.servisler[idx].durum = 'Yeni Gelen';
  saveAll();
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
  document.getElementById('filter-count').textContent=data.length+' kayit';
  const canEdit = !!(state.currentUser && state.currentUser.rol !== 'izleyici' && !isArsiv);
  const tbody=document.getElementById('table-body');
  const emptyEl=document.getElementById('table-empty');
  const emptyMsg=document.getElementById('table-empty-msg');
  if(!data.length){
    tbody.innerHTML='';
    if(emptyMsg) emptyMsg.textContent = isArsiv ? 'Arsivde kayit yok' : 'Kayit bulunamadi';
    if(emptyEl) emptyEl.style.display='';
    return;
  }
  if(emptyEl) emptyEl.style.display='none';
  tbody.innerHTML=data.map(s=>{
    const hasTeklif=state.teklifler.some(t=>t.servisId===s.id);
    return`<tr${isArsiv?' style="opacity:0.8"':''}>
      <td><span class="kn-badge">${s.kayitNo}</span></td>
      <td style="font-weight:500;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s.kurumAdi||'—'}</td>
      <td class="td-mono">${s.seriNo||'—'}</td>
      <td class="td-mono" style="color:var(--text2)">${fmtDate(s.gelisTarihi)}</td>
      <td>${durumBadge(s.durum)}</td>
      <td><span class="badge ${s.garantiDurumu==='Evet'?'badge-garanti-evet':'badge-garanti-hayir'}">${s.garantiDurumu}</span></td>
      <td style="color:var(--text2);font-size:12px">${s.ilgiliKisi||'—'}</td>
      <td><div class="action-row" style="justify-content:flex-end">
        <button class="btn-icon" title="${canEdit?'Düzenle':'Görüntüle'}" onclick="goServisForm('${s.id}')">✎</button>
        ${canEdit?`<button class="btn-icon" title="Durum Değiştir" style="color:var(--accent)" onclick="showDurumMenu('${s.id}',this)">⇅</button>`:''}
        ${canEdit?`<button class="btn-icon" title="${hasTeklif?'Teklif Görüntüle':'Tekliflendir'}" style="color:var(--amber);border-color:rgba(245,158,11,.3)" onclick="tekliflendir('${s.id}')">${hasTeklif?'◎':'＋◎'}</button>`:''}
        ${isArsiv&&state.currentUser&&state.currentUser.rol!=='izleyici'?`<button class="btn-icon" title="Aktife Al" style="color:var(--teal);border-color:rgba(45,212,191,.3)" onclick="arsivdenGeriAl('${s.id}')">↩</button>`:''}
        ${state.currentUser&&state.currentUser.rol!=='izleyici'?`<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('servis','${s.id}')">⊗</button>`:''}
      </div></td>
    </tr>`;
  }).join('');
}
function sortTable(col){if(state.sortCol===col)state.sortDir=state.sortDir==='asc'?'desc':'asc';else{state.sortCol=col;state.sortDir='asc';}document.querySelectorAll('[id^=sort-]').forEach(el=>el.textContent='');const el=document.getElementById('sort-'+col);if(el)el.textContent=state.sortDir==='asc'?'▲':'▼';renderTable()}
function filterTable(){renderTable()}
function clearTeklifFilters(){
  ['tf-f-kurum','tf-f-teklif','tf-f-durum','tf-f-ts','tf-f-te'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  renderTeklifler();
}
function clearFilters(doRender){if(doRender===false){['f-kurum','f-seri'].forEach(function(id){document.getElementById(id).value='';});['f-durum','f-garanti'].forEach(function(id){document.getElementById(id).value='';});['f-ts','f-te'].forEach(function(id){document.getElementById(id).value='';});return;}['f-kurum','f-seri'].forEach(function(id){document.getElementById(id).value='';});['f-durum','f-garanti'].forEach(function(id){document.getElementById(id).value='';});['f-ts','f-te'].forEach(function(id){document.getElementById(id).value='';});renderTable();}
function tekliflendir(sid){const ex=state.teklifler.find(t=>t.servisId===sid);if(ex){openTeklifDetay(ex.id)}else{goTeklifForm(null,sid);showPage('teklif-form',true)}}

// ════ SAVE SERVIS ════
function saveServis(){
  const editId=document.getElementById('sf-edit-id').value;
  const editId2=document.getElementById('sf-edit-id').value;const payload={kurumAdi:document.getElementById('sf-kurumAdi').value.trim(),ilgiliKisi:document.getElementById('sf-ilgiliKisi').value.trim(),telefon:document.getElementById('sf-telefon').value.trim(),email:document.getElementById('sf-email').value.trim(),urunAdi:'',seriNo:document.getElementById('sf-seriNo').value.trim(),garantiDurumu:document.getElementById('sf-garantiDurumu').value,aksesuarlar:[...sfAksesuarlar],aksesyarDiger:document.getElementById('sf-aksesuar-diger').value.trim(),gelisTarihi:document.getElementById('sf-gelisTarihi').value,durum:document.getElementById('sf-durum').value||'Yeni Gelen',kargoTarihi:document.getElementById('sf-kargoTarihi').value,kargoFirmasi:document.getElementById('sf-kargoFirmasi').value,teslimAlan:document.getElementById('sf-teslimAlan').value,notlar:document.getElementById('sf-notlar').value};
  if(editId){const idx=state.servisler.findIndex(x=>x.id===editId);if(idx>=0){state.servisler[idx]={...state.servisler[idx],...payload};toast('Kayıt güncellendi.','success');}}
  else{state.servisler.push({id:'s'+Date.now(),kayitNo:nextKN(),...payload,olusturanKullanici:state.currentUser?.username,olusturmaTarihi:new Date().toISOString()});toast('Servis kaydedildi.','success');}
  saveAll();showPage(state.prevPage||'servisler');
}

// ════ TEKLIF ITEMS ════
function addTeklifItem(){teklifItems.push({aciklama:'',miktar:1,birim:'Adet',birimFiyat:0});renderTeklifItems()}
