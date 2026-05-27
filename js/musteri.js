var musterilerPage=1;var _musteriFilterHash='';
function setMusterilerPage(n){musterilerPage=n;renderMusteriler();}
var urunlerPage=1;var _urunFilterHash='';
function setUrunlerPage(n){urunlerPage=n;renderUrunler();}

function renderMusteriler(){
  let data=[...state.musteriler];
  const q=(document.getElementById('fm-ara').value||'').toLowerCase();
  if(q)data=data.filter(m=>(m.kurum+m.kisi+m.tel).toLowerCase().includes(q));
  document.getElementById('musteri-count').textContent=data.length+' müşteri';
  var newMH=JSON.stringify([q]);if(newMH!==_musteriFilterHash){musterilerPage=1;_musteriFilterHash=newMH;}
  const tbody=document.getElementById('musteri-table-body');
  if(!data.length){tbody.innerHTML='';document.getElementById('musteri-empty').style.display='';renderPagination('musteri-pagination',1,0,'setMusterilerPage');return}
  document.getElementById('musteri-empty').style.display='none';
  var pagedM=data.slice((musterilerPage-1)*PAGE_SIZE,musterilerPage*PAGE_SIZE);
  renderPagination('musteri-pagination',musterilerPage,data.length,'setMusterilerPage');
  tbody.innerHTML=pagedM.map(m=>{return`<tr><td><span class="kn-badge" style="color:var(--accent);font-size:10px">${m.kayitNo||'—'}</span></td><td style="font-weight:500">${m.kurum}</td><td style="color:var(--text2)">${m.kisi||'—'}</td><td class="td-mono">${m.tel||'—'}</td><td style="color:var(--text2)">${m.email||'—'}</td><td>${m.sehir||'—'}</td><td><div class="action-row" style="justify-content:flex-end"><button class="btn-icon" onclick="goMusteriForm('${m.id}')">✎</button><button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('musteri','${m.id}')">⊗</button></div></td></tr>`;}).join('');
}
function saveMusteri(){
  const kurum=toTitleCase(document.getElementById('mf-kurum').value.trim());if(!kurum)return toast('Kurum adı zorunlu.','error');
  const editId=document.getElementById('mf-edit-id').value;
  const payload={kurum,kisi:toTitleCase(document.getElementById('mf-kisi').value.trim()),tel:document.getElementById('mf-tel').value.trim(),email:document.getElementById('mf-email').value.trim(),sehir:toTitleCase(document.getElementById('mf-sehir').value.trim()),adres:toTitleCase(document.getElementById('mf-adres').value.trim()),not:document.getElementById('mf-not').value.trim()};
  var savedMId;
  if(editId){const idx=state.musteriler.findIndex(x=>x.id===editId);if(idx>=0){state.musteriler[idx]={...state.musteriler[idx],...payload};savedMId=editId;toast('Güncellendi.','success');}}
  else{savedMId='m'+Date.now();var mKN='MK'+String(state.musteriler.length+1).padStart(5,'0');state.musteriler.push({id:savedMId,kayitNo:mKN,...payload});toast('Müşteri eklendi.','success');}
  saveAll();
  var ret=state._musterAddReturn;
  if(ret){
    state._musterAddReturn=null;
    showPage(ret.returnPage,true);
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
  } else {showPage('musteriler');}
}

// ════ ÜRÜNLER ════
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
  tbody.innerHTML=pagedU.map(u=>{return`<tr><td class="td-mono" style="color:var(--accent);font-size:11px">${u.urunKodu||'—'}</td><td style="font-weight:500">${u.urunAdi}</td><td style="color:var(--text2)">${u.marka||'—'}</td>${isSatis?`<td style="color:var(--text2);font-size:12px">${u.kategori||'—'}</td>`:''}<td class="td-mono" style="color:var(--text2)">${u.model||'—'}</td><td class="td-mono" style="color:var(--amber)">${_fmtFiyat(u.fiyat,u.paraBirimi)}</td><td><div class="action-row" style="justify-content:flex-end"><button class="btn-icon" onclick="goUrunForm('${u.id}')">✎</button><button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('urun','${u.id}')">⊗</button></div></td></tr>`;}).join('');
}
function saveUrun(){
  const urunAdi=document.getElementById('uf-urunAdi').value.trim();if(!urunAdi)return toast('Ürün adı zorunlu.','error');
  const editId=document.getElementById('uf-edit-id').value;
  const fiyatEl=document.getElementById('uf-fiyat');const fiyat=fiyatEl?parseFloat(fiyatEl.value)||0:0;
  var urunKoduEl=document.getElementById('uf-urunKodu');var urunKodu=urunKoduEl?urunKoduEl.value.trim():'';
  const pbEl2=document.getElementById('uf-paraBirimi');const paraBirimi=pbEl2?pbEl2.value:'TRY';
  const katEl=document.getElementById('uf-kategori');
  const payload={urunAdi,urunKodu,marka:document.getElementById('uf-marka').value.trim(),model:document.getElementById('uf-model').value.trim(),kategori:katEl?katEl.value:'',fiyat,paraBirimi,aciklama:document.getElementById('uf-aciklama').value.trim()};
  if(editId){const idx=state.urunler.findIndex(x=>x.id===editId);if(idx>=0){state.urunler[idx]={...state.urunler[idx],...payload};toast('Güncellendi.','success');}}
  else{state.urunler.push({id:'p'+Date.now(),...payload});toast('Ürün eklendi.','success');}
  saveAll();showPage('urunler');
}

// ════ RAPORLAR ════
function renderRaporlar(){
  const s=state.servisler,tl=state.teklifler;
  const teslim=s.filter(x=>x.durum==='Tamamlandı');
  const ortSure=teslim.length?Math.round(teslim.reduce((a,b)=>{const d1=new Date(b.gelisTarihi),d2=new Date(b.kargoTarihi||b.olusturmaTarihi);return a+(isNaN(d1)||isNaN(d2)?0:(d2-d1)/864e5)},0)/teslim.length):0;
  document.getElementById('rapor-stats').innerHTML=`<div class="stat-card"><div class="stat-label">Tamamlanan</div><div class="stat-value" style="color:var(--green)">${teslim.length}</div></div><div class="stat-card"><div class="stat-label">Ort. Süre</div><div class="stat-value" style="color:var(--teal)">${ortSure}<span style="font-size:13px"> gün</span></div></div><div class="stat-card"><div class="stat-label">Reddedilen</div><div class="stat-value" style="color:var(--red)">${s.filter(x=>x.durum==='Reddedildi').length}</div></div><div class="stat-card"><div class="stat-label">Onaylı Teklif</div><div class="stat-value" style="color:var(--amber)">${tl.filter(t=>t.durum==='Onaylandı').length}</div></div>`;
  const sg=[{l:'0–7 gün',mi:0,ma:7,c:0},{l:'8–14',mi:8,ma:14,c:0},{l:'15–30',mi:15,ma:30,c:0},{l:'30+',mi:31,ma:9999,c:0}];
  teslim.forEach(x=>{const g=Math.round((new Date(x.kargoTarihi||x.olusturmaTarihi)-new Date(x.gelisTarihi))/864e5);const gr=sg.find(g2=>g>=g2.mi&&g<=g2.ma);if(gr)gr.c++});
  const mxSg=Math.max(...sg.map(g=>g.c),1);
  document.getElementById('sure-rapor').innerHTML=sg.map(g=>`<div style="margin-bottom:11px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text2)">${g.l}</span><span class="text-mono" style="color:var(--text3)">${g.c}</span></div><div class="progress-bar"><div class="progress-fill" style="width:${g.c/mxSg*100}%;background:var(--teal)"></div></div></div>`).join('');
  const ev=s.filter(x=>x.garantiDurumu==='Evet').length,hay=s.filter(x=>x.garantiDurumu==='Hayır').length,tot=ev+hay||1;
  document.getElementById('garanti-rapor').innerHTML=`<div style="text-align:center;margin-bottom:16px"><div style="font-size:32px;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${Math.round(ev/tot*100)}%</div><div style="font-size:11px;color:var(--text3)">Garantili Oran</div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><div style="background:var(--teal-soft);border:1px solid rgba(45,212,191,.2);border-radius:8px;padding:11px;text-align:center"><div style="font-size:20px;font-weight:700;font-family:'DM Mono',monospace;color:var(--teal)">${ev}</div><div style="font-size:11px;color:var(--text3)">Garantili</div></div><div style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:11px;text-align:center"><div style="font-size:20px;font-weight:700;font-family:'DM Mono',monospace;color:var(--text2)">${hay}</div><div style="font-size:11px;color:var(--text3)">Garantisiz</div></div></div>`;
  const mxD=Math.max(...DURUM_LIST.map(d=>s.filter(x=>x.durum===d).length),1);
  document.getElementById('durum-bar-rapor').innerHTML=DURUM_LIST.map((d,i)=>{const cnt=s.filter(x=>x.durum===d).length;return`<div style="display:flex;align-items:center;gap:11px;margin-bottom:9px"><div style="width:125px;font-size:12px;color:var(--text2);text-align:right;flex-shrink:0">${d}</div><div style="flex:1;height:16px;background:var(--bg3);border-radius:3px;overflow:hidden"><div style="height:100%;width:${cnt/mxD*100}%;background:${DURUM_COLORS[i]};border-radius:3px;opacity:.85"></div></div><div style="width:24px;font-size:12px;font-family:'DM Mono',monospace;color:var(--text3)">${cnt}</div></div>`}).join('');
  const ciro=tl.filter(t=>t.durum==='Onaylandı').reduce((a,t)=>a+calcTeklifToplam(t),0);
  const bek=tl.filter(t=>t.durum==='Onay Bekleniyor').reduce((a,t)=>a+calcTeklifToplam(t),0);
  document.getElementById('teklif-rapor').innerHTML=`<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:13px"><div style="background:var(--accent-soft);border:1px solid rgba(61,155,196,.2);border-radius:8px;padding:13px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:5px">Toplam Teklif</div><div style="font-size:17px;font-weight:700;font-family:'DM Mono',monospace;color:var(--accent)">${tl.length} adet</div></div><div style="background:var(--green-soft);border:1px solid rgba(74,222,128,.2);border-radius:8px;padding:13px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:5px">Onaylı Ciro</div><div style="font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:var(--green)">${fmtTL(ciro)}</div></div><div style="background:var(--amber-soft);border:1px solid rgba(245,158,11,.2);border-radius:8px;padding:13px"><div style="font-size:10px;color:var(--text3);text-transform:uppercase;margin-bottom:5px">Bekleyen Tutar</div><div style="font-size:14px;font-weight:700;font-family:'DM Mono',monospace;color:var(--amber)">${fmtTL(bek)}</div></div></div>`;
}

// ════ TUTANAKLAR ════
function renderTutanaklar(){
  loadSavedTutanaklar();
  var tbody=document.getElementById('tutanak-table-body');
  var emptyEl=document.getElementById('tutanak-empty');
  if(!tbody)return;
  if(!savedTutanaklar.length){tbody.innerHTML='';if(emptyEl)emptyEl.style.display='';return;}
  if(emptyEl)emptyEl.style.display='none';
  tbody.innerHTML=savedTutanaklar.map(function(t){
    return '<tr>'
      +'<td><span class="kn-badge">'+t.no+'</span></td>'
      +'<td class="td-mono">'+fmtDate(t.tarih)+'</td>'
      +'<td style="text-align:right"><div class="action-row" style="justify-content:flex-end">'
      +'<button class="btn-icon" title="Yazdır" onclick="previewTutanak(\''+t.no+'\')">🖨</button>'
      +'<button class="btn-icon" style="color:var(--red)" title="Sil" onclick="deleteTutanak(\''+t.no+'\')">⊗</button>'
      +'</div></td>'
      +'</tr>';
  }).join('');
}
function getAksesuarStr(s){
  const chips=Array.isArray(s.aksesuarlar)&&s.aksesuarlar.length?[...s.aksesuarlar]:[];
  if(s.aksesyarDiger)chips.push(s.aksesyarDiger);
  return chips.join(', ');
}


// ════ KULLANICI ════
function renderUserTable(){
  var lbl=document.getElementById('kul-portal-label');
  if(lbl)lbl.textContent=(currentPortal==='servis'?'Teknik Servis Portalı':'Satış Pazarlama Portalı')+' kullanıcıları';
  document.getElementById('user-table-body').innerHTML=state.users.map(u=>`<tr><td style="font-weight:500">${u.ad}</td><td class="td-mono">${u.username}</td><td><span class="badge badge-${u.rol}">${{admin:'Admin',teknisyen:'Teknisyen',izleyici:'İzleyici'}[u.rol]||u.rol}</span></td><td style="color:var(--text2)">${u.email||'—'}</td><td class="td-mono" style="color:var(--text3)">${u.sonGiris?new Date(u.sonGiris).toLocaleDateString('tr-TR'):'—'}</td><td><div class="action-row" style="justify-content:flex-end"><button class="btn-icon" onclick="goKullaniciForm('${u.id}')">✎</button>${u.id!==state.currentUser?.id?`<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('kullanici','${u.id}')">⊗</button>`:''}</div></td></tr>`).join('');
}
function saveUser(){
  const ad=document.getElementById('kf-ad').value.trim(),username=document.getElementById('kf-username').value.trim(),sifre=document.getElementById('kf-sifre').value,email=document.getElementById('kf-email').value.trim(),rol=document.getElementById('kf-rol').value;
  const editId=document.getElementById('kf-edit-id').value;
  if(!ad||!username)return toast('Ad ve kullanıcı adı zorunlu.','error');
  if(!editId&&!sifre)return toast('Şifre zorunlu.','error');
  if(sifre&&sifre.length<4)return toast('Şifre en az 4 karakter.','error');
  if(state.users.find(u=>u.username===username&&u.id!==editId))return toast('Bu kullanıcı adı mevcut.','error');
  if(editId){const idx=state.users.findIndex(x=>x.id===editId);if(idx>=0)state.users[idx]={...state.users[idx],ad,username,email,rol,...(sifre?{sifre}:{})};toast('Güncellendi.','success');}
  else{state.users.push({id:'u'+Date.now(),ad,username,sifre,email,rol,sonGiris:null});toast('Kullanıcı oluşturuldu.','success');}
  saveAll();showPage('kullanici');
}

// ════ ÜRÜN KATEGORİLERİ ════
function renderUrunKategorileri(){
  const el=document.getElementById('urun-kategori-list');if(!el)return;
  const cats=state.urunKategoriler||[];
  if(!cats.length){el.innerHTML='<div style="font-size:12px;color:var(--text3)">Henüz kategori yok.</div>';return;}
  el.innerHTML=cats.map((k,i)=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border)"><span style="font-size:13px">${k}</span><button class="btn-icon" style="color:var(--red)" onclick="deleteUrunKategori(${i})">⊗</button></div>`).join('');
}
function addUrunKategori(){
  const inp=document.getElementById('yeni-kategori-input');if(!inp)return;
  const val=inp.value.trim();if(!val)return toast('Kategori adı girin.','error');
  if((state.urunKategoriler||[]).includes(val))return toast('Bu kategori zaten mevcut.','error');
  state.urunKategoriler=(state.urunKategoriler||[]).concat(val);
  saveAll();inp.value='';renderUrunKategorileri();toast('Kategori eklendi.','success');
}
function deleteUrunKategori(i){
  state.urunKategoriler=(state.urunKategoriler||[]).filter((_,idx)=>idx!==i);
  saveAll();renderUrunKategorileri();toast('Kategori silindi.','info');
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
  if(sp&&sd&&ps){var p=sp.value.trim().toUpperCase()||'KN';var d=Math.min(9,Math.max(3,parseInt(sd.value)||6));ps.textContent=p+String(1).padStart(d,'0');}
  if(tp&&td&&pt){var p2=tp.value.trim().toUpperCase()||'TKL';var d2=Math.min(9,Math.max(3,parseInt(td.value)||5));pt.textContent=p2+String(1).padStart(d2,'0');}
}
function loadSettings(){
  ['firma','tel','faks','adres','email','web','vergiDairesi','vergiNo'].forEach(k=>{const id='set-'+(k==='vergiDairesi'?'vergi-dairesi':k==='vergiNo'?'vergi-no':k);const el=document.getElementById(id);if(el)el.value=state.settings[k]||''});
  var spEl=document.getElementById('set-servis-prefix');if(spEl)spEl.value=state.settings.servisPrefix||'KN';
  var sdEl=document.getElementById('set-servis-digits');if(sdEl)sdEl.value=state.settings.servisDigits||6;
  var tpEl=document.getElementById('set-teklif-prefix');if(tpEl)tpEl.value=state.settings.teklifPrefix||'TKL';
  var tdEl=document.getElementById('set-teklif-digits');if(tdEl)tdEl.value=state.settings.teklifDigits||5;
  updateSettingsPreview();
  renderUrunKategorileri();
}
function saveSettings(){
  ['firma','tel','faks','adres','email','web','vergiDairesi','vergiNo'].forEach(k=>{const id='set-'+(k==='vergiDairesi'?'vergi-dairesi':k==='vergiNo'?'vergi-no':k);const el=document.getElementById(id);if(el)state.settings[k]=el.value});
  var spEl=document.getElementById('set-servis-prefix');if(spEl&&spEl.value.trim())state.settings.servisPrefix=spEl.value.trim().toUpperCase();
  var sdEl=document.getElementById('set-servis-digits');if(sdEl&&sdEl.value)state.settings.servisDigits=Math.min(9,Math.max(3,parseInt(sdEl.value)||6));
  var tpEl=document.getElementById('set-teklif-prefix');if(tpEl&&tpEl.value.trim())state.settings.teklifPrefix=tpEl.value.trim().toUpperCase();
  var tdEl=document.getElementById('set-teklif-digits');if(tdEl&&tdEl.value)state.settings.teklifDigits=Math.min(9,Math.max(3,parseInt(tdEl.value)||5));
  saveAll();toast('Ayarlar kaydedildi.','success');
}

// ════ CONFIRM DELETE ════
function confirmDelete(type,id){
  const msgs={servis:'Bu servis kaydını silmek istiyor musunuz? İlişkili teklifler de silinecek.',teklif:'Bu teklifi silmek istiyor musunuz?',siparis:'Bu siparişi silmek istiyor musunuz?',fatura:'Bu faturayı silmek istiyor musunuz?',musteri:'Bu müşteriyi silmek istiyor musunuz?',urun:'Bu ürünü silmek istiyor musunuz?',kullanici:'Bu kullanıcıyı silmek istiyor musunuz?'};
  document.getElementById('confirm-msg').textContent=msgs[type]||'Emin misiniz?';
  document.getElementById('confirm-ok-btn').onclick=()=>{
    if(type==='servis'){state.servisler=state.servisler.filter(x=>x.id!==id);state.teklifler=state.teklifler.filter(t=>t.servisId!==id)}
    else if(type==='teklif')state.teklifler=state.teklifler.filter(x=>x.id!==id);
    else if(type==='musteri')state.musteriler=state.musteriler.filter(x=>x.id!==id);
    else if(type==='urun')state.urunler=state.urunler.filter(x=>x.id!==id);
    else if(type==='siparis'){state.siparisler=(state.siparisler||[]).filter(function(x){return x.id!==id;});}
    else if(type==='fatura'){state.faturalar=(state.faturalar||[]).filter(function(x){return x.id!==id;});}
    else if(type==='kullanici')state.users=state.users.filter(x=>x.id!==id);
    saveAll();closeModal('modal-confirm');
    const refreshMap={servis:()=>{renderTable();renderDashboard()},teklif:renderTeklifler,siparis:renderSiparisler,fatura:renderFaturalar,musteri:renderMusteriler,urun:renderUrunler,kullanici:renderUserTable};
    if(refreshMap[type])refreshMap[type]();
    toast('Silindi.','info');
  };
  openModal('modal-confirm');
}


// ════ EXCEL EXPORT ════
