var tekliflerPage=1;var _teklifFilterHash='';
function setTekliflerPage(n){tekliflerPage=n;renderTeklifler();}

// ════ TEKLIFLER — API ════
async function loadTeklifler(){
  try{
    var res=await apiGet('teklifler?portal='+encodeURIComponent(currentPortal));
    state.teklifler=res.teklifler||[];
  }catch(e){
    toast(e.message||'Teklifler yüklenemedi.','error');
    state.teklifler=state.teklifler||[];
  }
  renderTeklifler();
}
async function updateTeklifDurum(teklifId,changes){
  var idx=state.teklifler.findIndex(function(x){return x.id===teklifId;});
  if(idx<0)return null;
  try{
    var res=await apiPut('teklifler',Object.assign({},state.teklifler[idx],changes,{id:teklifId}));
    state.teklifler[idx]=res.teklif;
    return res.teklif;
  }catch(e){
    toast(e.message||'Teklif güncellenemedi.','error');
    return null;
  }
}
function getRedBilgi(t){
  if(!t.redNedeni)return null;
  try{return JSON.parse(t.redNedeni);}catch(e){return{neden:t.redNedeni};}
}

function getCurSymbol(){const pb=(document.getElementById('tf-paraBirimi')||{}).value||'TRY';return{TRY:'₺',USD:'$',EUR:'€',GBP:'£'}[pb]||'₺';}
function fmtCur(v){const pb=(document.getElementById('tf-paraBirimi')||{}).value||'TRY';return new Intl.NumberFormat('tr-TR',{style:'currency',currency:pb,minimumFractionDigits:2}).format(v||0);}
function updateTeklifCurrency(){const sym=getCurSymbol();const h=document.getElementById('ti-cur-sym');if(h)h.textContent=sym;renderTeklifItems();}
function addTeklifItem(){teklifItems.push({aciklama:'',miktar:1,birim:'Adet',birimFiyat:0});renderTeklifItems()}
function removeTeklifItem(i){if(teklifItems.length>1)teklifItems.splice(i,1);renderTeklifItems()}
function renderTeklifItems(){
  document.getElementById('ti-body').innerHTML=teklifItems.map((item,i)=>{
    const params=item.seciliParametreler||[];
    const paramsHtml=params.length?`<div style="font-size:11px;color:rgb(143,164,176);margin-top:3px;padding-left:2px;line-height:1.4">(${params.map(p=>esc(typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad))).join(', ')})</div>`:'';
    return `<tr>
    <td class="ti-aciklama">
      <input type="text" id="ti-aciklama-${i}" value="${(item.aciklama||'').replace(/"/g,'&quot;')}" placeholder="Yazın veya listeden seçin..." autocomplete="off"
        oninput="teklifItems[${i}].aciklama=this.value;openTiCombo(${i})" onfocus="openTiCombo(${i})" onkeydown="tiKeydown(event,${i})">
      ${paramsHtml}
    </td>
    <td class="ti-miktar" style="vertical-align:top"><input type="number" value="${item.miktar}" min="1" step="1" oninput="teklifItems[${i}].miktar=parseFloat(this.value)||0;updateTeklifTotals()"></td>
    <td class="ti-birim" style="vertical-align:top"><select onchange="teklifItems[${i}].birim=this.value"><option ${item.birim==='Adet'?'selected':''}>Adet</option><option ${item.birim==='Saat'?'selected':''}>Saat</option><option ${item.birim==='Gün'?'selected':''}>Gün</option><option ${item.birim==='Parça'?'selected':''}>Parça</option></select></td>
    <td class="ti-fiyat" style="vertical-align:top"><input type="number" id="ti-fiyat-${i}" value="${item.birimFiyat}" min="0" step="0.01" oninput="teklifItems[${i}].birimFiyat=parseFloat(this.value)||0;updateTeklifTotals()"></td>
    <td class="ti-total" style="vertical-align:top" id="ti-total-${i}">${fmtCur(item.miktar*(item.birimFiyat||0))}</td>
    <td class="ti-del" style="vertical-align:top"><button class="btn-icon" style="color:var(--red)" onclick="removeTeklifItem(${i})"><i class="ti ti-trash"></i></button></td>
  </tr>`;}).join('');
  updateTeklifTotals();
}
function updateTeklifTotals(){
  let araToplam=0;
  teklifItems.forEach(function(item,i){
    const a=item.miktar*(item.birimFiyat||0);
    araToplam+=a;
    const el=document.getElementById('ti-total-'+i);
    if(el)el.textContent=fmtCur(a);
  });
  var kdvCb=document.getElementById('tf-kdv-cb');
  var kdvSel=document.getElementById('tf-kdv-oran');
  var kdvOran=(kdvCb&&kdvCb.checked&&kdvSel)?parseInt(kdvSel.value)||0:0;
  var kdvTutar=Math.round(araToplam*kdvOran)/100;
  var genel=araToplam+kdvTutar;

  var araEl=document.getElementById('tt-ara');if(araEl)araEl.textContent=fmtCur(araToplam);
  var araLabelEl=document.getElementById('tt-ara-label');if(araLabelEl)araLabelEl.textContent=kdvOran>0?'Ara Toplam':'Toplam';
  var araRow=document.getElementById('tt-ara-row');
  if(araRow){if(kdvOran>0)araRow.classList.remove('grand');else araRow.classList.add('grand');}

  var kdvRow=document.getElementById('tt-kdv-row');if(kdvRow)kdvRow.style.display=kdvOran>0?'':'none';
  var kdvLbl=document.getElementById('tt-kdv-label');if(kdvLbl)kdvLbl.textContent='KDV (%'+kdvOran+')';
  var kdvVal=document.getElementById('tt-kdv');if(kdvVal)kdvVal.textContent=fmtCur(kdvTutar);

  var genelRow=document.getElementById('tt-genel-row');if(genelRow)genelRow.style.display=kdvOran>0?'':'none';
  var genEl=document.getElementById('tt-genel');if(genEl)genEl.textContent=fmtCur(genel);
}
function onKdvChange(){
  var cb=document.getElementById('tf-kdv-cb');
  var sel=document.getElementById('tf-kdv-oran');
  if(sel)sel.style.display=(cb&&cb.checked)?'':'none';
  updateTeklifTotals();
}

// ════ ÖDEME ŞEKLİ ════
function onOdemeSekliChange(){
  var sel=document.getElementById('tf-odemeKosulu');
  var vd=document.getElementById('tf-vade');
  if(!sel||!vd)return;
  var isPesin=sel.value==='Peşin';
  vd.disabled=isPesin;
  if(isPesin)vd.value='';
}

// ════ SAVE TEKLIF ════
function buildTeklifPayload(){
  var _musteriIdRaw=(document.getElementById('tf-musteri-id')||{}).value||'';
  var _musteriId=(_musteriIdRaw==='__edit_existing__')?'':_musteriIdRaw;
  return{teklifNo:document.getElementById('tf-teklifNo').value,musteriId:_musteriId,servisId:(function(){var _ps=document.getElementById('tf-servis-ara');return _ps?(_ps.dataset.servisid||''):'';})(),kayitNo:document.getElementById('tf-kayitNo').value,seriNo:document.getElementById('tf-seriNo').value,kurum:toTitleCase(document.getElementById('tf-kurum').value),ilgiliKisi:toTitleCase(document.getElementById('tf-ilgiliKisi').value),teklifTarihi:document.getElementById('tf-teklifTarihi').value,gecerlilikTarihi:document.getElementById('tf-gecerlilik').value,notlar:document.getElementById('tf-notlar').value,telefon:(document.getElementById('tf-telefon')||{}).value||'',email:(document.getElementById('tf-email')||{}).value||'',paraBirimi:(document.getElementById('tf-paraBirimi')||{}).value||'TRY',odemeKosulu:(document.getElementById('tf-odemeKosulu')||{}).value||'',vade:(function(){var _v=(document.getElementById('tf-vade')||{}).value||'';return _v?_v+' Gün':'';})(),kdvOran:(function(){var _cb=document.getElementById('tf-kdv-cb');var _sel=document.getElementById('tf-kdv-oran');return(_cb&&_cb.checked&&_sel)?parseInt(_sel.value)||0:0;})(),satirlar:JSON.parse(JSON.stringify(teklifItems))};
}
async function saveTeklif(andPrint=false){
  const editId=document.getElementById('tf-edit-id').value;
  const kurumVal=(document.getElementById('tf-kurum')||{}).value||'';
  const musteriId=(document.getElementById('tf-musteri-id')||{}).value||'';
  if(!kurumVal)return toast('Kurum / müşteri zorunludur.','error');
  if(!musteriId&&!editId)return toast('Lütfen müşteri listesinden seçin veya "+ Yeni Müşteri Ekle" ile ekleyin.','error');
  const payload=buildTeklifPayload();
  let savedId;
  try{
    if(editId){
      const idx=state.teklifler.findIndex(x=>x.id===editId);
      if(idx<0)return;
      const res=await apiPut('teklifler',{...state.teklifler[idx],...payload,id:editId});
      state.teklifler[idx]=res.teklif;
      savedId=editId;
      toast('Teklif güncellendi.','success');
    } else {
      const res=await apiPost('teklifler',{...payload,portal:currentPortal});
      state.teklifler.push(res.teklif);
      savedId=res.teklif.id;
      toast('Teklif oluşturuldu.','success');
    }
  }catch(e){
    return toast(e.message||'Teklif kaydedilemedi.','error');
  }
  if(payload.servisId){
    const si=state.servisler.findIndex(x=>x.id===payload.servisId);
    if(si>=0&&state.servisler[si].durum==='Arıza Tespitinde')updateServisDurum(payload.servisId,{durum:'Yanıt Bekleniyor'});
  }
  _formDirty=false;showPage('teklifler');
  if(andPrint&&savedId)setTimeout(()=>printTeklifById(savedId),300);
}
function saveTeklifAndPrint(){saveTeklif(true)}

// ════ TEKLIF LIST ════
const TSD={'Taslak':'badge-sf','İletildi':'badge-onay-bekl','Kabul Edildi':'badge-onaylandi','Siparişe Dönüştü':'badge-teslim','Reddedildi':'badge-reddedildi','Kapandı':'badge-teslim'};
function getTeklifArsivDurumlari(){return currentPortal==='satis'?['Siparişe Dönüştü','Reddedildi']:['Reddedildi','Kapandı'];}
let teklifTab='aktif';
function switchTeklifTab(tab){
  teklifTab=tab;
  document.getElementById('tab-teklif-aktif').classList.toggle('active',tab==='aktif');
  document.getElementById('tab-teklif-arsiv').classList.toggle('active',tab==='arsiv');
  var fDEl=document.getElementById('tf-f-durum');if(fDEl)fDEl.value='';
  renderTeklifler();
}
function renderTeklifler(){
  const tl=state.teklifler;
  const arsivDurumlar=getTeklifArsivDurumlari();
  const aktif=tl.filter(t=>!arsivDurumlar.includes(t.durum));
  const arsiv=tl.filter(t=>arsivDurumlar.includes(t.durum));
  var aktifCntEl=document.getElementById('tab-teklif-aktif-count');
  var arsivCntEl=document.getElementById('tab-teklif-arsiv-count');
  if(aktifCntEl)aktifCntEl.textContent=aktif.length;
  if(arsivCntEl)arsivCntEl.textContent=arsiv.length;
  const isArsiv=teklifTab==='arsiv';
  const tabTl=isArsiv?arsiv:aktif;
  const isSatisPortal=currentPortal==='satis';
  const taslaklar=isSatisPortal?aktif.filter(t=>t.durum==='Taslak'):aktif.filter(t=>t.durum==='Taslak');
  const iletilenler=aktif.filter(t=>t.durum==='İletildi');
  const re=arsiv.filter(t=>t.durum==='Reddedildi');
  var tsEl=document.getElementById('teklif-stats');
  if(tsEl)tsEl.innerHTML=`
    <div class="stat-card"><div class="stat-label">Toplam Teklif</div><div class="stat-value" style="color:var(--accent)">${aktif.length}</div></div>
    <div class="stat-card"><div class="stat-label">Taslak</div><div class="stat-value" style="color:var(--amber)">${taslaklar.length}</div></div>
    <div class="stat-card"><div class="stat-label">İletildi</div><div class="stat-value" style="color:var(--green)">${iletilenler.length}</div></div>
    <div class="stat-card"><div class="stat-label">Reddedilen</div><div class="stat-value" style="color:var(--red)">${re.length}</div></div>
  `;
  const tbody=document.getElementById('teklif-table-body');
  if(!tabTl.length){tbody.innerHTML='';document.getElementById('teklif-empty').style.display='';return}
  document.getElementById('teklif-empty').style.display='none';
  const canEdit=state.currentUser?.rol!=='izleyici';
  var fK2=(document.getElementById('tf-f-kurum')||{}).value||'';
  var fTN=(document.getElementById('tf-f-teklif')||{}).value||'';
  var fSeri=(document.getElementById('tf-f-seri')||{}).value||'';
  var fD2=(document.getElementById('tf-f-durum')||{}).value||'';
  var fTS2=(document.getElementById('tf-f-ts')||{}).value||'';
  var fTE2=(document.getElementById('tf-f-te')||{}).value||'';
  var filtTl2=tabTl.filter(function(t){
    return(!fK2||(t.kurum||'').toLowerCase().includes(fK2.toLowerCase()))
      &&(!fTN||(t.teklifNo||'').toLowerCase().includes(fTN.toLowerCase()))
      &&(!fSeri||(t.seriNo||'').toLowerCase().includes(fSeri.toLowerCase()))
      &&(!fD2||t.durum===fD2)&&(!fTS2||t.teklifTarihi>=fTS2)&&(!fTE2||t.teklifTarihi<=fTE2);
  });
  var fcEl=document.getElementById('teklif-filter-count');
  if(fcEl)fcEl.textContent=filtTl2.length!==tabTl.length?filtTl2.length+'/'+tabTl.length+' teklif':tabTl.length+' teklif';
  var newTH=JSON.stringify([fK2,fTN,fSeri,fD2,fTS2,fTE2,teklifTab]);if(newTH!==_teklifFilterHash){tekliflerPage=1;_teklifFilterHash=newTH;}
  var showTemsilci=currentPortal==='satis';
  var thS=document.getElementById('th-sorumlu');
  if(thS)thS.style.display=showTemsilci?'':'none';
  var sfSeriEl=document.getElementById('tf-f-seri');
  if(sfSeriEl)sfSeriEl.style.display=currentPortal==='servis'?'':'none';
  var canBulk=isArsiv&&canEdit;
  if(!isArsiv) bulkClear('teklifArsiv');
  bulkSetVisible('teklifArsiv',filtTl2.map(function(t){return t.id;}));
  var thCheck=document.getElementById('th-teklif-check');
  if(thCheck){
    thCheck.style.display=canBulk?'':'none';
    var thCb=thCheck.querySelector('input');if(thCb)thCb.checked=canBulk&&bulkAllChecked('teklifArsiv');
  }
  var bulkBarEl=document.getElementById('teklif-bulk-bar');
  var bulkCountEl=document.getElementById('teklif-bulk-count');
  var selCount=canBulk?bulkCount('teklifArsiv'):0;
  if(bulkCountEl)bulkCountEl.textContent=selCount>0?selCount+' öğe seçildi':'';
  if(bulkBarEl)bulkBarEl.innerHTML=selCount>0
    ?'<button class="btn btn-danger btn-sm" onclick="confirmDeleteBulk(\'teklif\',bulkSelectedIds(\'teklifArsiv\'))"><i class="ti ti-trash"></i> Seçilenleri Sil</button>'
    :'';
  var sortedTl=[...filtTl2].sort((a,b)=>new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi));
  var pagedTl=sortedTl.slice((tekliflerPage-1)*PAGE_SIZE,tekliflerPage*PAGE_SIZE);
  renderPagination('teklif-pagination',tekliflerPage,filtTl2.length,'setTekliflerPage');
  tbody.innerHTML=pagedTl.map(t=>`<tr style="cursor:pointer" onclick="openTeklifDetay('${t.id}')">
    ${canBulk?`<td onclick="event.stopPropagation()"><input type="checkbox" ${bulkIsChecked('teklifArsiv',t.id)?'checked':''} onchange="bulkToggleRow('teklifArsiv','${t.id}','renderTeklifler')"></td>`:''}
    <td style="text-align:center"><span class="kn-badge" style="border:none;background:transparent;padding:0">${esc(t.teklifNo)}</span></td>
    <td class="td-mono" style="color:var(--text2);text-align:center">${fmtDate(t.teklifTarihi)}</td>
    <td style="font-weight:500;max-width:220px;white-space:normal;word-break:break-word">${esc(t.kurum||'—')}</td>
    <td style="font-family:'DM Mono',monospace;color:var(--amber);font-size:12px;text-align:right">${fmtTL(calcTeklifToplam(t))}</td>
    <td style="text-align:center"><span class="badge ${TSD[t.durum]||'badge-sf'}">${esc(t.durum)}</span>${getRedBilgi(t)?'<span title="'+esc(getRedBilgi(t).neden)+'" style="margin-left:6px;font-size:10px;color:var(--text3);cursor:help">📋</span>':''}</td>
    ${showTemsilci?`<td style="font-size:12px;color:var(--text3);text-align:center">${esc(t.sorumlu||'—')}</td>`:''}
    <td style="text-align:right"><div class="action-row" onclick="event.stopPropagation()">
      ${canEdit&&currentPortal==='satis'&&t.durum==='Taslak'?`<button class="btn-icon" title="Müşteriye İlet" style="color:var(--teal)" onclick="teklifGonder('${t.id}')"><i class="ti ti-send"></i></button>`:''}
      ${canEdit&&(currentPortal!=='satis'||t.durum==='İletildi')?`<button class="btn-icon" title="Durum Değiştir" style="color:var(--accent)" onclick="showTeklifDurumMenu('${t.id}',this)"><i class="ti ti-loader"></i></button>`:''}
      ${canEdit&&currentPortal==='satis'&&t.durum==='İletildi'?`<button class="btn-icon" title="Sipariş Oluştur" style="color:var(--purple)" onclick="goSiparisForm('${t.id}')"><i class="ti ti-cube-send"></i></button>`:''}
    </div></td>
  </tr>`).join('');
}
function teklifGonder(id){
  showConfirm('Teklif müşteriye iletildi olarak işaretlensin mi?',async function(){
    const updated=await updateTeklifDurum(id,{durum:'İletildi'});
    if(!updated)return;
    renderTeklifler();renderDashboard();toast('Teklif "İletildi" olarak işaretlendi.','success');
  },{title:'Teklif İlet',okText:'İletildi Olarak İşaretle',okClass:'btn-primary'});
}
function changeTeklifDurum(id,yeni){
  showConfirm('Teklif "'+yeni+'" olarak güncellensin mi?',async function(){
    const t=state.teklifler.find(x=>x.id===id);if(!t)return;
    const sid=t.servisId;
    const updated=await updateTeklifDurum(id,{durum:yeni});
    if(!updated)return;
    if(sid){
      var TEKLIF_SERVIS_MAP={'Kabul Edildi':'Onarımda','Reddedildi':'Reddedildi','Kapandı':'Teslim Edildi'};
      var servisDurum=TEKLIF_SERVIS_MAP[yeni];
      if(servisDurum)updateServisDurum(sid,{durum:servisDurum});
    }
    renderTeklifler();renderDashboard();toast('Teklif "'+yeni+'" olarak güncellendi.','success');

  },{title:'Durum Güncelle',okText:'Evet',okClass:'btn-primary'});
}

function openTeklifDetay(id){
  const t=state.teklifler.find(x=>x.id===id);if(!t)return;
  state.activeTeklifId=id;
  const toplam=calcTeklifToplam(t);
  let ara=0;
  const sarHtml=(t.satirlar||[]).map(s=>{const a=s.miktar*s.birimFiyat;ara+=a;const sp=s.seciliParametreler||[];const baseAciklama=(sp.length?(s._baseAciklama||(s.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim()):s.aciklama)||'—';const pHtml=sp.length?`<div class="pd-sub-text">(${sp.map(p=>esc(typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad))).join(', ')})</div>`:'';return`<tr><td>${esc(baseAciklama)}${pHtml}</td><td class="r" style="color:var(--text2)">${s.miktar} ${esc(s.birim)}</td><td class="r">${fmtTL(s.birimFiyat)}</td><td class="r">${fmtTL(a)}</td></tr>`;}).join('');
  const canEdit=state.currentUser?.rol!=='izleyici';
  document.getElementById('td-teklifno').textContent=t.teklifNo;
  document.getElementById('td-durum').innerHTML=`<span class="badge ${TSD[t.durum]||'badge-sf'}">${esc(t.durum)}</span>`;
  var _kw=document.getElementById('td-kayitno-wrap');
  if(_kw)_kw.style.display=currentPortal==='servis'?'':'none';
  document.getElementById('td-kayitno').textContent=t.kayitNo||'—';
  var _eb=document.getElementById('td-edit-btn');if(_eb)_eb.style.display=canEdit?'':'none';
  var _db=document.getElementById('td-delete-btn');if(_db)_db.style.display=canEdit?'':'none';
  document.getElementById('td-body').innerHTML=`
    ${canEdit&&currentPortal==='servis'&&t.durum==='İletildi'?`<div style="display:flex;gap:8px;margin-bottom:14px"><button class="btn btn-green btn-sm" onclick="changeTeklifDurum('${t.id}','Kabul Edildi');closeModal('modal-teklif-detay')">✓ Kabul Et</button><button class="btn btn-danger btn-sm" onclick="changeTeklifDurum('${t.id}','Reddedildi');closeModal('modal-teklif-detay')">✕ Reddet</button></div>`:''}
    <div class="pd-contact" style="grid-template-columns:2fr 1fr 1.5fr">
      <div class="pd-contact-cell"><div class="info-item-label">Kurum</div><div class="info-item-val" style="font-weight:600">${esc(t.kurum||'—')}</div></div>
      <div class="pd-contact-cell"><div class="info-item-label">Telefon</div><div class="info-item-val">${esc(t.telefon||'—')}</div></div>
      <div class="pd-contact-cell"><div class="info-item-label">E-Posta</div><div class="info-item-val">${esc(t.email||'—')}</div></div>
    </div>
    <div class="pd-section">
      <div class="pd-section-title">Teklif Bilgileri</div>
      <div class="pd-info-grid">
        ${currentPortal==='servis'?`<div class="pd-info-box"><div class="info-item-label">Seri No</div><div class="info-item-val">${esc(t.seriNo||'—')}</div></div>`:''}
        <div class="pd-info-box"><div class="info-item-label">Teklif Tarihi</div><div class="info-item-val">${fmtDate(t.teklifTarihi)||'—'}</div></div>
        <div class="pd-info-box"><div class="info-item-label">Geçerlilik</div><div class="info-item-val">${fmtDate(t.gecerlilikTarihi)||'—'}</div></div>
        ${t.odemeKosulu?`<div class="pd-info-box"><div class="info-item-label">Ödeme Şekli</div><div class="info-item-val">${esc(t.odemeKosulu)}</div></div>`:''}
        ${t.vade?`<div class="pd-info-box"><div class="info-item-label">Vade</div><div class="info-item-val">${esc(t.vade)}</div></div>`:''}
      </div>
    </div>
    <div class="pd-section">
      <div class="pd-section-title">Kalemler</div>
      <div class="pd-table-wrap">
        <table class="pd-table">
          <thead><tr><th>Açıklama</th><th class="r">Miktar</th><th class="r">Birim F.</th><th class="r">Toplam</th></tr></thead>
          <tbody>${sarHtml}</tbody>
        </table>
      </div>
      <div class="pd-totals">
        <div class="pd-totals-box">
          <div class="pd-total-row final"><span class="pd-tl">Genel Toplam</span><span class="pd-tv">${fmtTL(toplam)}</span></div>
        </div>
      </div>
    </div>
    ${t.notlar?`<div class="pd-section"><div class="pd-section-title">Notlar</div><div class="pd-notes">${esc(t.notlar)}</div></div>`:''}
  `;

  // Show red/iptal info if exists
  var rb=getRedBilgi(t);
  if(rb){
    var rbEl=document.createElement('div');
    rbEl.style.cssText='margin-top:12px;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:12px;border-left:3px solid var(--red)';
    rbEl.innerHTML='<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--red);margin-bottom:8px">RED BİLGİSİ</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">'
      +'<div><span style="color:var(--text3)">Neden: </span><b>'+esc(rb.neden||'—')+'</b></div>'
      +'<div><span style="color:var(--text3)">Rakip: </span><b>'+esc(rb.rakip||'—')+'</b></div>'
      +'<div><span style="color:var(--text3)">Rakip Fiyatı: </span><b>'+esc(rb.rakipFiyat||'—')+'</b></div>'
      +'<div><span style="color:var(--text3)">Tarih: </span><b>'+fmtDate(rb.tarih)+'</b></div>'
      +(rb.notlar?'<div style="grid-column:1/-1"><span style="color:var(--text3)">Not: </span><b>'+esc(rb.notlar)+'</b></div>':'')
      +'</div>';
    document.getElementById('td-body').appendChild(rbEl);
  }
  openModal('modal-teklif-detay');
}
function editCurrentTeklif(){closeModal('modal-teklif-detay');if(state.activeTeklifId)goTeklifForm(state.activeTeklifId)}
function printCurrentTeklif(){if(state.activeTeklifId)printTeklifById(state.activeTeklifId)}
function deleteCurrentTeklif(){if(!state.activeTeklifId)return;closeModal('modal-teklif-detay');confirmDelete('teklif',state.activeTeklifId);}

// ════ PDF ════
function printTeklifById(id){
  const t=state.teklifler.find(x=>x.id===id);if(!t)return;
  const logoImg=new Image();
  logoImg.onload=function(){
    const cv=document.createElement('canvas');cv.width=534;cv.height=252;
    cv.getContext('2d').drawImage(logoImg,0,0,534,252);
    const logoPng=cv.toDataURL('image/png');
    var brandImg=new Image();
    brandImg.onload=function(){
      var cv2=document.createElement('canvas');cv2.width=674;cv2.height=212;
      cv2.getContext('2d').drawImage(brandImg,0,0,674,212);
      _generateTeklifPDF(t,logoPng,cv2.toDataURL('image/png'));
    };
    brandImg.onerror=function(){_generateTeklifPDF(t,logoPng,null);};
    brandImg.src='brand_assets/crom_test_logo.svg';
  };
  logoImg.onerror=function(){_generateTeklifPDF(t,null,null);};
  logoImg.src='brand_assets/logo_if_bg_white.svg';
}
async function _generateTeklifPDF(t,logoPngDataUrl,brandLogoPngDataUrl){
  // Embed Arial fonts for full Turkish character support
  const toB64 = buf => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };
  const [regularBuf, boldBuf] = await Promise.all([
    fetch('fonts/Arial.ttf').then(r => r.arrayBuffer()),
    fetch('fonts/Arial_Bold.ttf').then(r => r.arrayBuffer())
  ]);

  // titleCase: capitalize first letter of each word, no ASCII downgrade needed
  const titleCase = (str) => {
    if (!str) return '';
    return String(str).replace(/\S+/g, w => w.charAt(0).toUpperCase() + w.slice(1));
  };

  const fmtN = (v) => new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);

  const C = {
    primary:    [29, 125, 149],
    textDark:   [26, 46, 59],
    textMid:    [46, 64, 80],
    textLight:  [143, 164, 176],
    textLabel:  [74, 96, 112],
    border:     [194, 208, 216],
    tableBg:    [228, 245, 249],
    boxBg:      [247, 249, 250],
    white:      [255, 255, 255]
  };

  const mm = (v) => v * 2.83465;
  const pageW = mm(210), pageH = mm(297);

  let araToplam = 0;
  const satirlar = (t.satirlar || []).map((s, idx) => {
    const tutar = s.miktar * s.birimFiyat;
    araToplam += tutar;
    return {
      no: idx + 1,
      aciklama: ((s.seciliParametreler||[]).length ? (s._baseAciklama||(s.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim()) : s.aciklama) || '—',
      miktar: s.miktar || 0,
      birim: s.birim || 'Adet',
      birimFiyat: s.birimFiyat || 0,
      tutar: tutar,
      seciliParametreler: s.seciliParametreler || []
    };
  });

  const kdvOranPDF = (currentPortal === 'satis') ? (t.kdvOran || 0) : 0;
  const kdvTutar = Math.round(araToplam * kdvOranPDF) / 100;
  const genelToplam = araToplam + kdvTutar;
  const pb = t.paraBirimi || 'TRY';
  const pbSymbol = {TRY:'TL',USD:'USD',EUR:'EUR',GBP:'GBP'}[pb] || 'TL';

  // jsPDF init
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation: 'portrait', unit: 'pt', format: 'a4'});
  doc.addFileToVFS('Arial.ttf', toB64(regularBuf));
  doc.addFont('Arial.ttf', 'Arial', 'normal');
  doc.addFileToVFS('Arial_Bold.ttf', toB64(boldBuf));
  doc.addFont('Arial_Bold.ttf', 'Arial', 'bold');
  doc.setFont('Arial');
  doc.setCharSpace(0);

  // ── HEADER ──
  if(logoPngDataUrl) {
    try {
      doc.addImage(logoPngDataUrl, 'PNG', mm(19.812), mm(9.737), mm(39.793), mm(19.389), '', 'FAST');
    } catch(e) {}
  }

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.75);
  doc.line(mm(63.765), mm(11.642), mm(63.765), mm(25.517));

  const st = state.settings || {};

  doc.setFontSize(9);
  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(st.firma || 'Egefe Bilişim Sağlık San. ve Tic. A.Ş.', mm(68.457), mm(11.188)+9);

  doc.setFontSize(8);
  doc.setFont('Arial', 'normal');
  doc.setTextColor(...C.textLight);
  doc.text(st.adres || 'Harbiye Mah. Hürriyet Cad. No:7/12 Çankaya / Ankara', mm(68.457), mm(16.829)+6);

  const vergiText = st.vergiDairesi && st.vergiNo
    ? `${st.vergiDairesi} Vergi Dairesi: ${st.vergiNo}`
    : 'Başkent Vergi Dairesi: 5590520620';
  doc.text(vergiText, mm(68.457), mm(21.192)+6);

  doc.text(st.web || 'www.ege-fe.com', mm(68.457), mm(25.555)+6);

  doc.setDrawColor(...C.primary);
  doc.setLineWidth(2);
  doc.line(mm(15.446), mm(33.955), mm(194.556), mm(33.955));

  // ── RIGHT SIDE - TEKLİF MEKTUBU ──
  // Tüm blok mm(194.556) sağ kenara hizalı:
  //   değer sütunu → sağa yaslanmış mm(194.556)
  //   iki nokta    → mm(170.556)  (değer sütunundan 24mm solda)
  //   etiket       → sağa yaslanmış mm(168.556)  (iki noktadan 2mm solda)
  const _rEdge   = mm(194.556);
  const _colonX  = _rEdge - mm(24);
  const _labelRX = _colonX - mm(2);

  doc.setFontSize(14);
  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('TEKLİF MEKTUBU', _rEdge, mm(42.395)+11, {align: 'right'});

  doc.setFontSize(8);
  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('Teklif No', _labelRX, mm(50.611)+6, {align: 'right'});
  doc.text(':', _colonX, mm(50.611)+6);
  doc.setFont('Arial', 'normal');
  doc.text(t.teklifNo || '-', _rEdge, mm(50.611)+6, {align: 'right'});

  doc.setFont('Arial', 'bold');
  doc.text('Teklif Tarihi', _labelRX, mm(55.109)+6, {align: 'right'});
  doc.text(':', _colonX, mm(55.109)+6);
  doc.setFont('Arial', 'normal');
  doc.text(fmtDate(t.teklifTarihi)||'-', _rEdge, mm(55.109)+6, {align: 'right'});

  doc.setFont('Arial', 'bold');
  doc.text('Geçerlilik Tarihi', _labelRX, mm(59.58)+6, {align: 'right'});
  doc.text(':', _colonX, mm(59.58)+6);
  doc.setFont('Arial', 'normal');
  doc.text(fmtDate(t.gecerlilikTarihi)||'-', _rEdge, mm(59.607)+6, {align: 'right'});

  // ── BILL TO SECTION ──
  doc.setFontSize(8);
  doc.setTextColor(...C.textMid);
  const _lx1=mm(15.446),_lx2=mm(41.228),_lx3=mm(44.126);
  const _lMaxW=mm(72); // right column starts at mm(137), leave adequate buffer
  const _rGap=mm(4.291);  // baseline-to-baseline normal row gap
  const _lh8=8*1.15;      // 8pt line height in pt (unit='pt' doc)
  let _curY=mm(42.774)+6;

  // Kurum Adı — wrap long names
  doc.setFont('Arial','bold');
  doc.text('Kurum Adı',_lx1,_curY); doc.text(':',_lx2,_curY);
  doc.setFont('Arial','normal');
  const _kurumLines=doc.splitTextToSize(titleCase(t.kurum||''),_lMaxW);
  doc.text(_kurumLines,_lx3,_curY);
  _curY+=(_kurumLines.length-1)*_lh8+_rGap;

  // Adres + Şehir — look up from musteriler, wrap
  const _mRec=(state.musteriler||[]).find(function(m){return m.kurum===t.kurum;});
  const _adresParts=[(_mRec&&_mRec.adres)||'',(_mRec&&_mRec.sehir)||''].filter(Boolean);
  const _adresVal=_adresParts.join(', ');
  doc.setFont('Arial','bold');
  doc.text('Adres',_lx1,_curY); doc.text(':',_lx2,_curY);
  doc.setFont('Arial','normal');
  if(_adresVal){
    const _adresLines=doc.splitTextToSize(titleCase(_adresVal),_lMaxW);
    doc.text(_adresLines,_lx3,_curY);
    _curY+=(_adresLines.length-1)*_lh8+_rGap;
  } else {
    _curY+=_rGap;
  }

  // İlgili Kişi
  doc.setFont('Arial','bold');
  doc.text('İlgili Kişi',_lx1,_curY); doc.text(':',_lx2,_curY);
  doc.setFont('Arial','normal');
  doc.text(titleCase(t.ilgiliKisi||''),_lx3,_curY);
  _curY+=_rGap;

  // e-posta
  doc.setFont('Arial','bold');
  doc.text('e-posta',_lx1,_curY); doc.text(':',_lx2,_curY);
  doc.setFont('Arial','normal');
  doc.text(t.email||'',_lx3,_curY);
  _curY+=_rGap;

  // Tel
  doc.setFont('Arial','bold');
  doc.text('Tel',_lx1,_curY); doc.text(':',_lx2,_curY);
  doc.setFont('Arial','normal');
  doc.text(t.telefon||'',_lx3,_curY);
  _curY+=_rGap;

  doc.setDrawColor(...C.tableBg);
  doc.setLineWidth(0.75);
  const _divY=Math.max(mm(67.900),_curY+mm(3));
  doc.line(mm(15.446),_divY,mm(194.63),_divY);

  // ── TABLE ──
  const tableY=_divY+mm(2.517);
  // Pre-split params with 7pt font BEFORE autoTable (avoids state interference)
  const _col1Inner = mm(90.652) - 4; // cell width minus l+r padding (2+2)
  const _p7lh = 7 * 1.15 * 0.3528;  // 7pt line height in mm
  const _pGap = 6;                   // mm gap between product name and params
  doc.setFontSize(7); doc.setFont('Arial', 'normal');
  const _bodyRows = satirlar.map(s => {
    const params = s.seciliParametreler || [];
    const paramsStr = params.length ? '(' + params.map(p=>typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad)).join(', ') + ')' : '';
    const row = [s.no, s.aciklama, s.miktar, s.birim, fmtN(s.birimFiyat), fmtN(s.tutar)];
    if (paramsStr) {
      const pls = doc.splitTextToSize(paramsStr, _col1Inner);
      row._pls = pls;
      row._extraPad = pls.length * _p7lh + _pGap + 0.5;
    }
    return row;
  });
  doc.setFontSize(8); doc.setFont('Arial', 'normal');
  doc.autoTable({
    startY: tableY,
    head: [[' #', 'ÜRÜN ADI VE AÇIKLAMASI', 'MİKTAR', 'BİRİM', 'BİRİM FİYATI', 'TUTAR']],
    body: _bodyRows,
    theme: 'plain',
    styles: {
      font: 'Arial',
      fontSize: 8,
      cellPadding: {top: 4, right: 2, bottom: 4, left: 2},
      textColor: C.textDark,
      lineColor: C.tableBg,
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: C.tableBg,
      textColor: C.primary,
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: {top: 4, right: 2, bottom: 4, left: 2}
    },
    columnStyles: {
      0: {halign: 'center', valign: 'middle', cellWidth: mm(9.525)},
      1: {halign: 'left', valign: 'top', cellWidth: mm(90.652)},
      2: {halign: 'center', valign: 'middle', cellWidth: mm(16.669)},
      3: {halign: 'center', valign: 'middle', cellWidth: mm(16.404)},
      4: {halign: 'right', valign: 'middle', cellWidth: mm(21.111)},
      5: {halign: 'right', valign: 'middle', cellWidth: mm(24.823)}
    },
    margin: {left: mm(15.446), right: mm(210 - 179.184 - 15.446)},
    didParseCell: (data) => {
      if (data.section === 'head') {
        if (data.column.index === 1) data.cell.styles.halign = 'left';
        if (data.column.index === 4) data.cell.styles.halign = 'right';
        if (data.column.index === 5) data.cell.styles.halign = 'right';
      }
      if (data.section === 'body' && data.column.index === 1) {
        const extra = data.row.raw._extraPad || 0;
        if (extra > 0) {
          const p = data.cell.styles.cellPadding;
          data.cell.styles.cellPadding = typeof p === 'object'
            ? Object.assign({}, p, {bottom: (p.bottom || 1.5) + extra})
            : {top: 1.5, right: 2, bottom: 1.5 + extra, left: 2};
        }
      }
    },
    didDrawCell: (data) => {
      if (data.section !== 'body' || data.column.index !== 1) return;
      const pls = data.row.raw._pls;
      if (!pls || !pls.length) return;
      const extra = data.row.raw._extraPad || 0;
      const pad = data.cell.styles.cellPadding;
      const lpad = typeof pad === 'object' ? (pad.left || 2) : 2;
      // Params area starts after product name text + gap
      const paramsAreaTop = data.cell.y + data.cell.height - 1.5 - extra + _pGap;
      const pt7asc = 7 * 0.3528 * 0.82; // baseline offset for 7pt text
      doc.setFontSize(7);
      doc.setFont('Arial', 'normal');
      doc.setTextColor(...C.textLight);
      pls.forEach((line, i) => {
        doc.text(line, data.cell.x + lpad, paramsAreaTop + pt7asc + i * _p7lh);
      });
      doc.setFontSize(8);
      doc.setTextColor(...C.textDark);
    },
    didDrawPage: (data) => {
      tableEndY = data.cursor.y;
    }
  });
  doc.setCharSpace(0);
  doc.setFont('Arial','normal');

  const sectionY  = tableEndY + mm(7);
  const leftX     = mm(15.446);
  const leftAreaW = mm(115);

  // ── INFO BAR (Ödeme / Vade / Teslimat — tek satır düz metin) ──
  const infoItems = [
    t.seriNo      ? `Cihaz Seri No: ${t.seriNo}`              : null,
    t.odemeKosulu ? `Ödeme Şekli: ${t.odemeKosulu}`            : null,
    t.vade        ? `Vade: ${t.vade}`                          : null,
  ].filter(Boolean);

  let curY = sectionY;

  if (infoItems.length > 0) {
    doc.setFontSize(7);
    doc.setFont('Arial', 'normal');
    doc.setTextColor(...C.textLight);
    doc.text(infoItems.join('   |   '), leftX, curY + mm(3.5));
    curY += mm(5);
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.4);
    doc.line(leftX, curY + mm(1), leftX + leftAreaW, curY + mm(1));
    curY += mm(3.5);
  }

  // ── NOTES BOX ──
  const notLabelW    = mm(10);
  const notTextX     = leftX + mm(2.5) + notLabelW;
  const notTextW     = leftAreaW - mm(2.5) - notLabelW - mm(2.5);
  const pt8lh        = mm(4.5);

  doc.setFontSize(8);
  doc.setFont('Arial', 'normal');
  const notText    = t.notlar || 'Teklifimiz yukarıda belirtilen geçerlilik tarihi itibarıyla geçerliliğini yitirecektir.';
  const rawLines   = notText.split('\n');
  let allNotLines  = [];
  rawLines.forEach(line => {
    if (line.trim() === '') {
      allNotLines.push('');
    } else {
      allNotLines = allNotLines.concat(doc.splitTextToSize(line, notTextW));
    }
  });
  if(currentPortal === 'satis'){
    const pbLabel = {TRY:'TL',USD:'USD',EUR:'EUR',GBP:'GBP'}[pb] || 'TL';
    const kdvNote = kdvOranPDF > 0
      ? `Fiyatlarımız ${pbLabel} cinsinden verilmiş olup KDV (%${kdvOranPDF}) dahildir.`
      : `Fiyatlarımız ${pbLabel} cinsinden verilmiş olup KDV dahil değildir.`;
    allNotLines.push('');
    allNotLines = allNotLines.concat(doc.splitTextToSize(kdvNote, notTextW));
  }

  const notBoxTopY        = curY;
  const firstLineBaseline = notBoxTopY + mm(3);

  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textLabel);
  doc.text('Not:', leftX, firstLineBaseline);

  doc.setFont('Arial', 'normal');
  doc.setTextColor(...C.textMid);
  allNotLines.forEach((line, i) => {
    doc.text(line, notTextX, firstLineBaseline + i * pt8lh);
  });

  curY = notBoxTopY + mm(3) + allNotLines.length * pt8lh + mm(7);

  // ── İMZA BLOĞU (yalnızca Satış Pazarlama Portalı) ──
  if(currentPortal === 'satis'){
    const sigY = curY;
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.4);
    doc.line(leftX, sigY, leftX + leftAreaW, sigY);

    const u = state.currentUser || {};
    if(u.ad){
      doc.setFontSize(8);
      doc.setFont('Arial','bold');
      doc.setTextColor(...C.textMid);
      doc.text(u.ad, leftX, sigY + mm(4.5));
      doc.setFont('Arial','normal');
      doc.setTextColor(...C.textLight);
      if(u.email)   doc.text(u.email,   leftX, sigY + mm(9.5));
      if(u.telefon) doc.text(u.telefon, leftX, sigY + mm(14.5));
    }

    if(brandLogoPngDataUrl){
      const bLogoW = mm(26);
      const bLogoH = mm(26 * (212/674));
      const bLogoX = mm(194.556) - bLogoW;
      const bLogoY = sigY + mm(3);
      try{ doc.addImage(brandLogoPngDataUrl,'PNG', bLogoX, bLogoY, bLogoW, bLogoH,'','FAST'); }catch(e){}
      const trademarkY = bLogoY + bLogoH + mm(2.5);
      doc.setFontSize(5.5);
      doc.setFont('Arial','normal');
      doc.setTextColor(...C.textLight);
      doc.text('Cromtest®, Egefe A.Ş.\'nin tescilli markasıdır.', mm(194.556), trademarkY, {align:'right'});
    }

    curY = sigY + mm(20);
  }

  // ── TOTALS SECTION (Right side) ──
  const totalsY = sectionY;
  const totalBoxX = mm(141.901);
  const totalBoxRightEdge = mm(194.63);
  const totalBoxW = totalBoxRightEdge - totalBoxX;

  if(currentPortal === 'satis' && kdvOranPDF > 0){
    // Ara Toplam row
    doc.setFontSize(8);
    doc.setFont('Arial','bold');
    doc.setTextColor(...C.textLabel);
    doc.text('Ara Toplam', mm(143), totalsY + mm(5));
    doc.setFont('Arial','normal');
    doc.setTextColor(...C.textMid);
    doc.text(`${pbSymbol} ${fmtN(araToplam)}`, totalBoxRightEdge - mm(2.5), totalsY + mm(5), {align:'right'});

    // KDV row
    doc.setFont('Arial','bold');
    doc.setTextColor(...C.textLabel);
    doc.text(`KDV (%${kdvOranPDF})`, mm(143), totalsY + mm(11));
    doc.setFont('Arial','normal');
    doc.setTextColor(...C.textMid);
    doc.text(`${pbSymbol} ${fmtN(kdvTutar)}`, totalBoxRightEdge - mm(2.5), totalsY + mm(11), {align:'right'});

    // Divider
    doc.setDrawColor(...C.border);
    doc.setLineWidth(0.3);
    doc.line(mm(143), totalsY + mm(14), totalBoxRightEdge, totalsY + mm(14));

    // TEKLİF TOPLAMI box (shifted down)
    const totalBoxY = totalsY + mm(16);
    doc.setDrawColor(...C.primary);
    doc.setLineWidth(1.5);
    doc.setFillColor(...C.white);
    doc.roundedRect(totalBoxX, totalBoxY, totalBoxW, mm(12.40), 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('Arial','bold');
    doc.setTextColor(...C.primary);
    doc.text('TEKLİF TOPLAMI', totalBoxRightEdge - mm(2.5), totalBoxY + mm(4.0), {align:'right'});
    doc.setFontSize(11);
    doc.setFont('Arial','bold');
    doc.setTextColor(...C.textMid);
    doc.text(`${pbSymbol} ${fmtN(genelToplam)}`, totalBoxRightEdge - mm(2.5), totalBoxY + mm(9.2), {align:'right'});
  } else {
    // No KDV: single box (mevcut görünüm)
    const totalBoxY = totalsY;
    doc.setDrawColor(...C.primary);
    doc.setLineWidth(1.5);
    doc.setFillColor(...C.white);
    doc.roundedRect(totalBoxX, totalBoxY, totalBoxW, mm(12.40), 2, 2, 'FD');
    doc.setFontSize(8);
    doc.setFont('Arial','bold');
    doc.setTextColor(...C.primary);
    doc.text('TEKLİF TOPLAMI', totalBoxRightEdge - mm(2.5), totalBoxY + mm(4.0), {align:'right'});
    doc.setFontSize(11);
    doc.setFont('Arial','bold');
    doc.setTextColor(...C.textMid);
    doc.text(`${pbSymbol} ${fmtN(genelToplam)}`, totalBoxRightEdge - mm(2.5), totalBoxY + mm(9.2), {align:'right'});
  }

  // ── FOOTER ──
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(2);
  doc.line(mm(15.446), mm(279.929), mm(194.556), mm(279.929));

  doc.setFontSize(7);
  doc.setFont('Arial', 'normal');
  doc.setTextColor(...C.textLight);

  const emailText = st.email || 'info@ege-fe.com';
  const telText = st.tel || '0 (312) 482 5451';
  const faxText = st.fax || '0 (312) 480 5453';

  const footerParts = ['e-posta: ' + emailText];
  if (telText) footerParts.push('Tel: ' + telText);
  if (faxText) footerParts.push('Fax: ' + faxText);
  doc.text(footerParts.join('   |   '), mm(105), mm(284.604)+5, {align: 'center'});

  doc.save(`Teklif_${t.teklifNo || 'X'}.pdf`);
}

