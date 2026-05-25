function addTeklifItem(){teklifItems.push({aciklama:'',miktar:1,birim:'Adet',birimFiyat:0});renderTeklifItems()}
function removeTeklifItem(i){if(teklifItems.length>1)teklifItems.splice(i,1);renderTeklifItems()}
function renderTeklifItems(){
  document.getElementById('ti-body').innerHTML=teklifItems.map((item,i)=>`<tr>
    <td class="ti-aciklama" style="position:relative">
      <input type="text" id="ti-aciklama-${i}" value="${(item.aciklama||'').replace(/"/g,'&quot;')}" placeholder="Yazın veya listeden seçin..." autocomplete="off"
        oninput="teklifItems[${i}].aciklama=this.value;openTiCombo(${i})" onfocus="openTiCombo(${i})" onkeydown="tiKeydown(event,${i})">
      <div id="cb-ti-${i}" style="display:none;position:absolute;top:100%;left:0;right:0;z-index:500;background:var(--bg3);border:1px solid var(--border2);border-radius:4px;max-height:180px;overflow-y:auto;box-shadow:0 6px 20px rgba(0,0,0,.4)"></div>
    </td>
    <td class="ti-miktar"><input type="number" value="${item.miktar}" min="0.01" step="0.01" oninput="teklifItems[${i}].miktar=parseFloat(this.value)||0;updateTeklifTotals()"></td>
    <td class="ti-birim"><select onchange="teklifItems[${i}].birim=this.value"><option ${item.birim==='Adet'?'selected':''}>Adet</option><option ${item.birim==='Saat'?'selected':''}>Saat</option><option ${item.birim==='Gün'?'selected':''}>Gün</option><option ${item.birim==='Parça'?'selected':''}>Parça</option></select></td>
    <td class="ti-fiyat"><input type="number" id="ti-fiyat-${i}" value="${item.birimFiyat}" min="0" step="0.01" oninput="teklifItems[${i}].birimFiyat=parseFloat(this.value)||0;updateTeklifTotals()"></td>
    
    <td class="ti-total" id="ti-total-${i}">${fmtTL(item.miktar*item.birimFiyat*(1+item.kdvOran/100))}</td>
    <td class="ti-del"><button class="btn-icon" style="color:var(--red)" onclick="removeTeklifItem(${i})">⊗</button></td>
  </tr>`).join('');
  updateTeklifTotals();
}
function updateTeklifTotals(){
  let toplam=0;
  teklifItems.forEach(function(item,i){
    const a=item.miktar*item.birimFiyat;
    toplam+=a;
    const el=document.getElementById('ti-total-'+i);
    if(el)el.textContent=fmtTL(a);
  });
  const araEl=document.getElementById('tt-ara');if(araEl)araEl.textContent=fmtTL(toplam);
  const genEl=document.getElementById('tt-genel');if(genEl)genEl.textContent=fmtTL(toplam);
}

// ════ SAVE TEKLIF ════
function buildTeklifPayload(){
  return{teklifNo:document.getElementById('tf-teklifNo').value,servisId:(function(){var _ps=document.getElementById('tf-servis-ara');return _ps?(_ps.dataset.servisid||''):'';})(),kayitNo:document.getElementById('tf-kayitNo').value,seriNo:document.getElementById('tf-seriNo').value,kurum:document.getElementById('tf-kurum').value,ilgiliKisi:document.getElementById('tf-ilgiliKisi').value,teklifTarihi:document.getElementById('tf-teklifTarihi').value,gecerlilikTarihi:document.getElementById('tf-gecerlilik').value,notlar:document.getElementById('tf-notlar').value,telefon:(document.getElementById('tf-telefon')||{}).value||'',email:(document.getElementById('tf-email')||{}).value||'',satirlar:JSON.parse(JSON.stringify(teklifItems))};
}
function saveTeklif(andPrint=false){
  const editId=document.getElementById('tf-edit-id').value;
  const payload=buildTeklifPayload();
  let savedId;
  if(editId){
    const idx=state.teklifler.findIndex(x=>x.id===editId);
    if(idx>=0){state.teklifler[idx]={...state.teklifler[idx],...payload};savedId=editId;toast('Teklif güncellendi.','success');}
  } else {
    savedId='t'+Date.now();
    state.teklifler.push({id:savedId,...payload,durum:'Onay Bekleniyor',olusturmaTarihi:new Date().toISOString(),olusturanKullanici:state.currentUser?.username});
    toast('Teklif oluşturuldu.','success');
  }
  if(payload.servisId){
    const si=state.servisler.findIndex(x=>x.id===payload.servisId);
    if(si>=0&&!['Onaylandı','Tamamlandı','Kargoya Verildi'].includes(state.servisler[si].durum))state.servisler[si].durum='Onay Bekleniyor';
  }
  saveAll();showPage('teklifler');
  if(andPrint&&savedId)setTimeout(()=>printTeklifById(savedId),300);
}
function saveTeklifAndPrint(){saveTeklif(true)}

// ════ TEKLIF LIST ════
const TSD={'Onay Bekleniyor':'badge-onay-bekl','Onaylandı':'badge-onaylandi','Taslak':'badge-sf','Açık Teklif':'badge-yeni','Kabul Edildi':'badge-onaylandi','Siparişe Aktarıldı':'badge-teslim','Reddedildi':'badge-reddedildi','İptal Edildi':'badge-reddedildi'};
function renderTeklifler(){
  const tl=state.teklifler;
  const ob=tl.filter(t=>t.durum==='Onay Bekleniyor'),on=tl.filter(t=>t.durum==='Onaylandı'),re=tl.filter(t=>t.durum==='Reddedildi');
  const ciro=on.reduce((a,t)=>a+calcTeklifToplam(t),0);
  document.getElementById('teklif-stats').innerHTML=`
    <div class="stat-card"><div class="stat-label">Toplam Teklif</div><div class="stat-value" style="color:var(--accent)">${tl.length}</div></div>
    <div class="stat-card"><div class="stat-label">Onay Bekleyen</div><div class="stat-value" style="color:var(--amber)">${ob.length}</div></div>
    <div class="stat-card"><div class="stat-label">Onaylanan</div><div class="stat-value" style="color:var(--green)">${on.length}</div></div>
    <div class="stat-card"><div class="stat-label">Reddedilen</div><div class="stat-value" style="color:var(--red)">${re.length}</div></div>
    <div class="stat-card"><div class="stat-label">Onaylı Ciro</div><div class="stat-value" style="color:var(--teal);font-size:17px">${fmtTL(ciro)}</div></div>
  `;
  const tbody=document.getElementById('teklif-table-body');
  if(!tl.length){tbody.innerHTML='';document.getElementById('teklif-empty').style.display='';return}
  document.getElementById('teklif-empty').style.display='none';
  const canEdit=state.currentUser?.rol!=='izleyici';
  var fK2=(document.getElementById('tf-f-kurum')||{}).value||'';
  var fTN=(document.getElementById('tf-f-teklif')||{}).value||'';
  var fD2=(document.getElementById('tf-f-durum')||{}).value||'';
  var fTS2=(document.getElementById('tf-f-ts')||{}).value||'';
  var fTE2=(document.getElementById('tf-f-te')||{}).value||'';
  var filtTl2=tl.filter(function(t){
    return(!fK2||(t.kurum||'').toLowerCase().includes(fK2.toLowerCase()))
      &&(!fTN||(t.teklifNo||'').toLowerCase().includes(fTN.toLowerCase()))
      &&(!fD2||t.durum===fD2)&&(!fTS2||t.teklifTarihi>=fTS2)&&(!fTE2||t.teklifTarihi<=fTE2);
  });
  var fcEl=document.getElementById('teklif-filter-count');
  if(fcEl)fcEl.textContent=filtTl2.length!==tl.length?filtTl2.length+'/'+tl.length+' teklif':tl.length+' teklif';
  tbody.innerHTML=[...filtTl2].sort((a,b)=>new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi)).map(t=>`<tr>
    <td><span class="kn-badge">${t.teklifNo}</span></td>
    <td class="td-mono" style="color:var(--text2)">${fmtDate(t.teklifTarihi)}</td>
    <td style="font-weight:500">${t.kurum||'—'}</td>
    <td style="font-family:'DM Mono',monospace;color:var(--amber);font-size:12px">${fmtTL(calcTeklifToplam(t))}</td>
    <td><span class="badge ${TSD[t.durum]||'badge-sf'}">${t.durum}</span>${t.redBilgi?'<span title="'+t.redBilgi.neden+'" style="margin-left:6px;font-size:10px;color:var(--text3);cursor:help">📋</span>':''}</td>
    <td id="td-sorumlu-${t.id}" class="td-sorumlu" style="font-size:12px;color:var(--text3)">${t.sorumlu||'—'}</td>
    <td><div class="action-row" style="justify-content:flex-end">
      <button class="btn-icon" title="Detay" onclick="openTeklifDetay('${t.id}')">◎</button>
      ${canEdit?`<button class="btn-icon" title="Durum Değiştir" style="color:var(--accent)" onclick="showTeklifDurumMenu('${t.id}',this)">⇅</button>`:''}
      ${canEdit&&currentPortal==='satis'&&t.durum==='Açık Teklif'?`<button class="btn-icon" style="color:var(--green)" title="Kabul Et" onclick="changeTeklifDurum('${t.id}','Kabul Edildi')">✓</button>`:''}
      ${canEdit&&currentPortal==='satis'&&['Açık Teklif','Taslak'].includes(t.durum)?`<button class="btn-icon" style="color:var(--red)" title="Reddet" onclick="openRedNedenModal('${t.id}','Reddedildi')">✕</button>`:''}
      ${canEdit&&currentPortal==='satis'&&!['İptal Edildi','Siparişe Aktarıldı'].includes(t.durum)?`<button class="btn-icon" style="color:var(--text3);font-size:10px" title="İptal Et" onclick="openRedNedenModal('${t.id}','İptal Edildi')">⊗</button>`:''}
      ${canEdit&&t.durum!=='Siparişe Aktarıldı'?`<button class="btn-icon" title="Düzenle" onclick="goTeklifForm('${t.id}')">✎</button>`:''}
      <button class="btn-icon" style="color:var(--accent)" title="PDF" onclick="printTeklifById('${t.id}')">⬇</button>
      ${canEdit&&currentPortal==='satis'&&t.durum==='Kabul Edildi'?`<button class="btn-icon" title="Sipariş Oluştur" style="color:var(--purple)" onclick="goSiparisForm('${t.id}')">📦</button>`:''}
      ${canEdit?`<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete('teklif','${t.id}')">⊗</button>`:''}
    </div></td>
  </tr>`).join('');
}
function changeTeklifDurum(id,yeni){
  if(!confirm(`Teklif "${yeni}" olarak güncellensin mi? Servis kaydı da değişecek.`))return;
  const ti=state.teklifler.findIndex(x=>x.id===id);if(ti<0)return;
  state.teklifler[ti].durum=yeni;
  if(yeni==='Onaylandı')state.teklifler[ti].onayTarihi=today();
  const sid=state.teklifler[ti].servisId;
  if(sid){const si=state.servisler.findIndex(x=>x.id===sid);if(si>=0){state.servisler[si].durum=yeni;if(yeni==='Onaylandı')state.servisler[si].onayTarihi=today();}}
  saveAll();renderTeklifler();renderDashboard();toast(`Teklif ${yeni.toLowerCase()}. Servis kaydı güncellendi.`,'success');
}

function openTeklifDetay(id){
  const t=state.teklifler.find(x=>x.id===id);if(!t)return;
  state.activeTeklifId=id;
  const toplam=calcTeklifToplam(t);
  let ara=0;
  const sarHtml=(t.satirlar||[]).map(s=>{const a=s.miktar*s.birimFiyat;ara+=a;return`<tr style="border-bottom:1px solid rgba(36,48,69,.4)"><td style="padding:7px 9px;font-size:13px">${s.aciklama||'—'}</td><td style="padding:7px 9px;font-size:12px;font-family:'DM Mono',monospace;color:var(--text2)">${s.miktar} ${s.birim}</td><td style="padding:7px 9px;font-size:12px;font-family:'DM Mono',monospace;color:var(--text2);text-align:right">${fmtTL(s.birimFiyat)}</td><td style="padding:7px 9px;font-size:12px;font-family:'DM Mono',monospace;color:var(--amber);text-align:right">${fmtTL(a)}</td></tr>`;}).join('');
  const canEdit=state.currentUser?.rol!=='izleyici';
  document.getElementById('td-title').textContent=`${t.teklifNo} — Detay`;
  var _eb=document.getElementById('td-edit-btn');if(_eb)_eb.style.display=canEdit?'':'none';
  const steps=[{l:'Servis',c:'done'},{l:'Teklif',c:'done'},{l:'Bekliyor',c:t.durum==='Onay Bekleniyor'?'active':'done'},{l:t.durum==='Reddedildi'?'Reddedildi':'Onaylandı',c:t.durum==='Onaylandı'?'done':t.durum==='Reddedildi'?'rejected':'pending'}];
  document.getElementById('td-body').innerHTML=`
    <div class="teklif-akis">${steps.map((st,i,a)=>`<div class="t-step"><div class="t-dot ${st.c}">${st.c==='done'?'✓':st.c==='active'?'⏳':st.c==='rejected'?'✕':'○'}</div><div class="t-step-lbl">${st.l}</div></div>${i<a.length-1?'<div class="t-arrow">→</div>':''}`).join('')}</div>
    ${canEdit&&t.durum==='Onay Bekleniyor'?`<div style="display:flex;gap:8px;margin-bottom:14px"><button class="btn btn-green btn-sm" onclick="changeTeklifDurum('${t.id}','Onaylandı');closeModal('modal-teklif-detay')">✓ Onayla</button><button class="btn btn-danger btn-sm" onclick="changeTeklifDurum('${t.id}','Reddedildi');closeModal('modal-teklif-detay')">✕ Reddet</button></div>`:''}
    <div class="separator"></div>
    <div class="info-grid" style="margin-bottom:14px">
      <div class="info-item"><div class="info-item-label">Teklif No</div><div class="info-item-val text-mono" style="color:var(--accent)">${t.teklifNo}</div></div>
      ${currentPortal==='servis'?`<div class="info-item"><div class="info-item-label">Kayıt No</div><div class="info-item-val text-mono">${t.kayitNo||'—'}</div></div>`:''}
      <div class="info-item"><div class="info-item-label">Kurum</div><div class="info-item-val">${t.kurum||'—'}</div></div>
      ${currentPortal==='servis'?`<div class="info-item"><div class="info-item-label">Seri No</div><div class="info-item-val text-mono">${t.seriNo||'—'}</div></div>`:''}
      ${(t.telefon||t.email)?`<div class="info-item"><div class="info-item-label">Telefon</div><div class="info-item-val">${t.telefon||'—'}</div></div><div class="info-item"><div class="info-item-label">E-posta</div><div class="info-item-val">${t.email||'—'}</div></div>`:''}
      <div class="info-item"><div class="info-item-label">Teklif Tarihi</div><div class="info-item-val text-mono">${fmtDate(t.teklifTarihi)}</div></div>
      <div class="info-item"><div class="info-item-label">Geçerlilik</div><div class="info-item-val text-mono">${fmtDate(t.gecerlilikTarihi)}</div></div>
    </div>
    <table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden">
      <thead><tr style="background:var(--bg3)"><th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:left">AÇIKLAMA</th><th style="padding:7px 9px;font-size:10px;color:var(--text3)">MİKTAR</th><th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:right">BİRİM F.</th><th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:right">TOPLAM</th></tr></thead>
      <tbody>${sarHtml}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-top:12px"><div style="background:var(--bg3);border-radius:var(--radius-sm);padding:12px 16px;min-width:210px">
      <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text2);margin-bottom:5px"><span>Ara Toplam</span><span class="text-mono">${fmtTL(ara)}</span></div>
      
      <div style="display:flex;justify-content:space-between;font-size:15px;font-weight:700;border-top:1px solid var(--border);padding-top:8px"><span>Toplam</span><span class="text-mono" style="color:var(--amber)">${fmtTL(toplam)}</span></div>
    </div></div>
    ${t.notlar?`<div style="margin-top:12px;background:var(--bg3);border-radius:var(--radius-sm);padding:11px 14px;font-size:13px;color:var(--text2)">${t.notlar}</div>`:''}
  `;

  // Show red/iptal info if exists
  if(t.redBilgi){
    var rb=t.redBilgi;
    var rbEl=document.createElement('div');
    rbEl.style.cssText='margin-top:12px;background:var(--bg4);border:1px solid var(--border);border-radius:8px;padding:12px;border-left:3px solid var(--red)';
    rbEl.innerHTML='<div style="font-size:11px;font-weight:700;letter-spacing:.06em;color:var(--red);margin-bottom:8px">'+(t.durum==='İptal Edildi'?'İPTAL':'RED')+' BİLGİSİ</div>'
      +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:12px">'
      +'<div><span style="color:var(--text3)">Neden: </span><b>'+(rb.neden||'—')+'</b></div>'
      +'<div><span style="color:var(--text3)">Rakip: </span><b>'+(rb.rakip||'—')+'</b></div>'
      +'<div><span style="color:var(--text3)">Rakip Fiyatı: </span><b>'+(rb.rakipFiyat||'—')+'</b></div>'
      +'<div><span style="color:var(--text3)">Tarih: </span><b>'+fmtDate(rb.tarih)+'</b></div>'
      +(rb.notlar?'<div style="grid-column:1/-1"><span style="color:var(--text3)">Not: </span><b>'+rb.notlar+'</b></div>':'')
      +'</div>';
    document.getElementById('td-body').appendChild(rbEl);
  }
  openModal('modal-teklif-detay');
}
function editCurrentTeklif(){closeModal('modal-teklif-detay');if(state.activeTeklifId)goTeklifForm(state.activeTeklifId)}
function printCurrentTeklif(){if(state.activeTeklifId)printTeklifById(state.activeTeklifId)}

// ════ PDF ════
function printTeklifById(id){
  const t=state.teklifler.find(x=>x.id===id);if(!t)return;
  const logoImg=new Image();
  logoImg.onload=function(){
    const cv=document.createElement('canvas');cv.width=534;cv.height=252;
    cv.getContext('2d').drawImage(logoImg,0,0,534,252);
    _generateTeklifPDF(t,cv.toDataURL('image/png'));
  };
  logoImg.onerror=function(){_generateTeklifPDF(t,null);};
  logoImg.src='brand_assets/logo_if_bg_white.svg';
}
function _generateTeklifPDF(t,logoPngDataUrl){
  // Türkçe karakter fix (jsPDF Helvetica için)
  const trFix = (str) => {
    if(!str) return '';
    return String(str)
      .replace(/İ/g,'I').replace(/ı/g,'i').replace(/Ş/g,'S').replace(/ş/g,'s')
      .replace(/Ğ/g,'G').replace(/ğ/g,'g').replace(/Ü/g,'U').replace(/ü/g,'u')
      .replace(/Ö/g,'O').replace(/ö/g,'o').replace(/Ç/g,'C').replace(/ç/g,'c');
  };
  
  // Text case helpers
  const toTitleCase = (str) => {
    if(!str) return '';
    return String(str).toLowerCase().split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  };
  
  const toLowerCase = (str) => {
    if(!str) return '';
    return String(str).toLowerCase();
  };

  const fmtN = (v) => new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);

  // Color palette (RGB) - TEKLİF FORMATI'na göre güncellenmiş
  const C = {
    primary:    [29, 125, 149],   // #1D7D95
    textDark:   [26, 46, 59],      // #1A2E3B
    textMid:    [46, 64, 80],      // #2E4050
    textLight:  [143, 164, 176],   // #8FA4B0
    textLabel:  [74, 96, 112],     // #4A6070
    border:     [194, 208, 216],   // #C2D0D8
    tableBg:    [228, 245, 249],   // #E4F5F9
    boxBg:      [247, 249, 250],   // #F7F9FA
    white:      [255, 255, 255]    // #FFFFFF
  };
  
  // mm → pt conversion
  const mm = (v) => v * 2.83465;
  const pageW = mm(210), pageH = mm(297);
  
  // Ürün satırları + hesaplamalar
  let araToplam = 0;
  const satirlar = (t.satirlar || []).map((s, idx) => {
    const tutar = s.miktar * s.birimFiyat;
    araToplam += tutar;
    return {
      no: idx + 1,
      aciklama: trFix(s.aciklama || '—'),
      miktar: s.miktar || 0,
      birim: trFix(s.birim || 'Adet'),
      birimFiyat: s.birimFiyat || 0,
      tutar: tutar
    };
  });
  
  const kdv = 0;
  const genelToplam = araToplam + kdv;
  const pb = t.paraBirimi || 'USD';
  const pbSymbol = {TRY:'TL',USD:'USD',EUR:'EUR',GBP:'GBP'}[pb] || 'USD';
  
  // jsPDF init
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation: 'portrait', unit: 'pt', format: 'a4'});
  doc.setFont('Helvetica');
  
  // ── HEADER ──
  // Logo - X: 19.812mm, Y: 9.737mm, W: 39.793mm, H: 19.389mm
  if(logoPngDataUrl) {
    try {
      doc.addImage(logoPngDataUrl, 'PNG', mm(19.812), mm(9.737), mm(39.793), mm(19.389), '', 'FAST');
    } catch(e) {}
  }
  
  // Vertical Line - X: 63.765mm, Y1: 11.642mm, Y2: 25.517mm, 0.75pt color #C2D0D8
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.75);
  doc.line(mm(63.765), mm(11.642), mm(63.765), mm(25.517));
  
  // Company info
  const st = state.settings || {};
  
  // Company Name - X: 68.457mm Y: 11.188mm Font: Arial bold 12pt Color: #2E4050
  doc.setFontSize(9);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(trFix(st.firma || 'Egefe Bilişim Sağlık San. ve Tic. A.Ş.'), mm(68.457), mm(11.188)+9);
  
  // Company Address - X: 68.457mm, Y: 16.829mm, Font: Arial regular 8pt Color: #8FA4B0
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...C.textLight);
  doc.text(trFix(st.adres || 'Harbiye Mah. Hurriyet Cad. No:7/12 Cankaya / Ankara'), mm(68.457), mm(16.829)+6);
  
  // Company VAT - X: 68.457mm, Y: 21.192mm Arial regular 8pt Color: #8FA4B0
  const vergiText = st.vergiDairesi && st.vergiNo 
    ? trFix(`${st.vergiDairesi} Vergi Dairesi: ${st.vergiNo}`)
    : trFix('Baskent Vergi Dairesi: 5590520620');
  doc.text(vergiText, mm(68.457), mm(21.192)+6);
  
  // Company WEB - X: 68.457mm, Y: 25.555mm Arial regular 8pt Color: #8FA4B0
  doc.text(st.web || 'www.ege-fe.com', mm(68.457), mm(25.555)+6);
  
  // Horizontal Line 1 - X1: 15.446mm Y: 33.955mm X2: 194.556mm thickness: 2pt Color: #1D7D95
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(2);
  doc.line(mm(15.446), mm(33.955), mm(194.556), mm(33.955));
  
  // ── RIGHT SIDE - TEKLİF MEKTUBU ──
  // "TEKLİF MEKTUBU" - Arial bold 14pt, X:141.628mm Y: 42.395mm color: #2E4050
  doc.setFontSize(14);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(trFix('TEKLIF MEKTUBU'), mm(141.628), mm(42.395)+11);
  
  // "Teklif No" - Arial bold 8pt, X:141.66mm Y: 50.611mm color: #2E4050
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('Teklif No', mm(141.66), mm(50.611)+6);

  // ":" - X: 165.354mm Y: 50.611mm
  doc.text(':', mm(165.354), mm(50.611)+6);
  
  // Teklif no value - Arial regular 8pt, X:171.249mm Y: 50.611mm color: #2E4050
  doc.setFont('Helvetica', 'normal');
  doc.text(t.teklifNo || '-', mm(171.249), mm(50.611)+6);
  
  // "Teklif Tarihi" - Arial bold 8pt, X:141.66mm Y:55.109mm color: #2E4050
  doc.setFont('Helvetica', 'bold');
  doc.text('Teklif Tarihi', mm(141.66), mm(55.109)+6);

  // ":" - X: 165.354mm Y: 55.109mm
  doc.text(':', mm(165.354), mm(55.109)+6);
  
  // Teklif tarihi value - Arial regular 8pt, X: 171.249mm Y:55.109mm color: #2E4050
  doc.setFont('Helvetica', 'normal');
  doc.text(fmtDate(t.teklifTarihi) || '-', mm(171.249), mm(55.109)+6);
  
  // "Geçerlilik Tarihi" - Arial bold 8pt, X:141.66mm Y:59.58mm color: #2E4050
  doc.setFont('Helvetica', 'bold');
  doc.text(trFix('Geçerlilik Tarihi'), mm(141.66), mm(59.58)+6);

  // ":" - X: 165.354mm Y: 59.58mm
  doc.text(':', mm(165.354), mm(59.58)+6);
  
  // Geçerlilik tarihi value - Arial regular 8pt, X: 171.249mm Y:59.607mm color: #2E4050
  doc.setFont('Helvetica', 'normal');
  doc.text(fmtDate(t.gecerlilikTarihi) || '-', mm(171.249), mm(59.607)+6);
  
  // ── BILL TO SECTION ──
  // "Kurum Adı" - X: 15.446mm Y: 42.774mm
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('Kurum Adı', mm(15.446), mm(42.774)+6);
  
  // ":" - X: 41.228mm Y: 42.774mm
  doc.text(':', mm(41.228), mm(42.774)+6);
  
  // "Kurum Adı" value - X: 44.126mm, Y: 42.774mm - Title Case
  doc.setFont('Helvetica', 'normal');
  doc.text(trFix(toTitleCase(t.kurum || '')), mm(44.126), mm(42.774)+6);
  
  // "Adres" - X: 15.446mm Y: 47.065mm
  doc.setFont('Helvetica', 'bold');
  doc.text('Adres', mm(15.446), mm(47.065)+6);
  
  // ":" - X: 41.228mm Y: 47.065mm
  doc.text(':', mm(41.228), mm(47.065)+6);
  
  // "Adres" value - X: 44.126mm, Y: 47.065mm - Title Case
  doc.setFont('Helvetica', 'normal');
  doc.text(trFix(toTitleCase(t.adres || '')), mm(44.126), mm(47.065)+6);
  
  // "İlgili Kişi" - X: 15.446mm, Y: 51.356mm
  doc.setFont('Helvetica', 'bold');
  doc.text(trFix('İlgili Kişi'), mm(15.446), mm(51.356)+6);
  
  // ":" - X: 41.228mm, Y: 51.356mm
  doc.text(':', mm(41.228), mm(51.356)+6);
  
  // İlgili kişi value - X: 44.126mm, Y: 51.356mm - Title Case
  doc.setFont('Helvetica', 'normal');
  doc.text(trFix(toTitleCase(t.ilgiliKisi || '')), mm(44.126), mm(51.356)+6);
  
  // "e-posta" - X: 15.446mm, Y: 55.647mm
  doc.setFont('Helvetica', 'bold');
  doc.text('e-posta', mm(15.446), mm(55.647)+6);
  
  // ":" - X: 41.228mm, Y: 55.647mm
  doc.text(':', mm(41.228), mm(55.647)+6);
  
  // e-posta value - X: 44.126mm, Y: 55.647mm - lowercase
  doc.setFont('Helvetica', 'normal');
  doc.text(toLowerCase(t.email || ''), mm(44.126), mm(55.647)+6);
  
  // "Tel" - X: 15.446mm, Y: 59.938mm
  doc.setFont('Helvetica', 'bold');
  doc.text('Tel', mm(15.446), mm(59.938)+6);
  
  // ":" - X: 41.228mm, Y: 59.938mm
  doc.text(':', mm(41.228), mm(59.938)+6);
  
  // Tel value - X: 44.126mm, Y: 59.938mm
  doc.setFont('Helvetica', 'normal');
  doc.text(t.telefon || '', mm(44.126), mm(59.938)+6);
  
  // Horizontal Line 2 - X1: 15.446mm X2: 194.63mm Y: 67.900mm thickness: 0.75pt color: #E4F5F9
  doc.setDrawColor(...C.tableBg);
  doc.setLineWidth(0.75);
  doc.line(mm(15.446), mm(67.900), mm(194.63), mm(67.900));
  
  // ── TABLE ──
  const tableY = mm(69.667) + mm(0.75);
  doc.autoTable({
    startY: tableY,
    head: [[' #', trFix('ÜRÜN ADI VE AÇIKLAMASI'), 'MİKTAR', 'BİRİM', trFix('BİRİM FİYAT'), 'TUTAR']],
    body: satirlar.map(s => [
      s.no,
      s.aciklama,
      s.miktar,
      s.birim,
      fmtN(s.birimFiyat),
      fmtN(s.tutar)
    ]),
    theme: 'plain',
    styles: {
      font: 'Helvetica',
      fontSize: 8,
      cellPadding: {top: 1.5, right: 2, bottom: 1.5, left: 2},
      textColor: C.textDark,
      lineColor: C.tableBg,
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: C.tableBg,
      textColor: C.primary,
      fontStyle: 'bold',
      fontSize: 8,
      //halign: 'center',
      halign: 0: 'center', 1: 'left', 2: 'center', 3: 'center', 4: 'center', 5: 'center',
      cellPadding: {top: 1.6, right: 2, bottom: 1.6, left: 2}
    },
    columnStyles: {
      0: {halign: 'center', cellWidth: mm(9.525)},   // # - center
      1: {halign: 'left', cellWidth: mm(90.652)},    // ÜRÜN ADI - left
      2: {halign: 'center', cellWidth: mm(16.669)},   // MİKTAR - center
      3: {halign: 'center', cellWidth: mm(16.404)},  // BİRİM - center
      4: {halign: 'right', cellWidth: mm(21.111)},   // BİRİM FİYAT - right-align
      5: {halign: 'right', cellWidth: mm(24.823)}    // TUTAR - right-align
    },
    margin: {left: mm(15.446), right: mm(210 - 179.184 - 15.446)},
    didDrawPage: (data) => { 
      tableEndY = data.cursor.y; 
    }
  });
  
  let y = tableEndY + mm(3);
  
  // ── BOTTOM GRID - 3 boxes ──
  const boxY = y;
  const boxH = mm(13);
  const boxPadding = 1.4;
  
  // Rectangle 1: ÖDEME KOŞULU - X1:15.446mm, Y: 91.624mm, X2:36.248mm
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.75);
  doc.setFillColor(...C.boxBg);
  doc.roundedRect(mm(15.446), boxY, mm(36.248), boxH, boxPadding, boxPadding, 'FD');
  
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textLight);
  doc.text(trFix('ÖDEME KOŞULU'), mm(17.725), boxY + mm(3.5));
  
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(trFix(t.odemeKosulu || 'Pesin'), mm(17.814), boxY + mm(7.8));
  
  // Rectangle 2: VADE - X1:53.546mm
  doc.setFillColor(...C.boxBg);
  doc.roundedRect(mm(53.546), boxY, mm(36.248), boxH, boxPadding, boxPadding, 'FD');
  
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textLight);
  doc.text('VADE', mm(55.953), boxY + mm(3.5));
  
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(trFix(t.vade || '-'), mm(56.07), boxY + mm(7.8));
  
  // Rectangle 3: TAHMİNİ TESLİMAT - X1:91.91mm
  doc.setFillColor(...C.boxBg);
  doc.roundedRect(mm(91.91), boxY, mm(36.248), boxH, boxPadding, boxPadding, 'FD');
  
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textLight);
  doc.text(trFix('TAHMİNİ TESLİMAT'), mm(94.276), boxY + mm(3.5));
  
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(trFix(t.teslimat || '10-15 Gun'), mm(94.276), boxY + mm(7.8));
  
  // Not - X: 15.446mm, Y: 104.821mm
  const notY = boxY + boxH + mm(4);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textLabel);
  doc.text('Not :', mm(15.446), notY);
  
  // Not text value - X: 24.405mm, Y: 104.821mm
  doc.setFont('Helvetica', 'normal');
  const notText = trFix(t.not || 'Teklifimiz yukarida belirtilen gecerlilik tarihi itibariyla gecerlilini yitirecektir.');
  const notLines = doc.splitTextToSize(notText, mm(100));
  doc.text(notLines, mm(24.405), notY);
  
  // ── TOTALS SECTION (Right side) ──
  const totalsY = boxY;
  
  // "Ara Toplam" - X: 137.109mm Y: 93.33mm
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...C.textLabel);
  doc.text('Ara Toplam', mm(137.109), totalsY + mm(1.7));
  
  // Ara toplam value - right align X2: 193.881mm
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text(fmtN(araToplam), mm(193.881), totalsY + mm(1.7), {align: 'right'});
  
  // Horizontal Line 3 - X1: 137.109mm, X2: 194.63mm, Y: 97.312mm
  doc.setDrawColor(...C.tableBg);
  doc.setLineWidth(0.75);
  doc.line(mm(137.109), totalsY + mm(3.982), mm(194.63), totalsY + mm(3.982));
  
  // "Genel İskonto" - X: 137.22mm, Y: 87.474mm
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.textLabel);
  doc.text(trFix('Genel İskonto'), mm(137.22), totalsY + mm(6.062));
  
  // Genel iskonto value
  doc.setFont('Helvetica', 'normal');
  doc.text('- %', mm(193.881), totalsY + mm(6.062), {align: 'right'});
  
  // Horizontal Line 4 - X1: 137.109mm, X2: 194.63mm, Y: 103.398mm
  doc.line(mm(137.109), totalsY + mm(10.068), mm(194.63), totalsY + mm(10.068));
  
  // "KDV" - X: 137.109mm Y: 93.573mm
  doc.setFont('Helvetica', 'bold');
  doc.text('KDV', mm(137.109), totalsY + mm(12.171));
  
  // KDV value
  doc.setFont('Helvetica', 'normal');
  doc.text(fmtN(kdv), mm(193.881), totalsY + mm(12.171), {align: 'right'});
  
  // Horizontal Line 5 - X1: 137.109mm, X2: 194.63mm, Y: 109.483mm
  doc.line(mm(137.109), totalsY + mm(16.153), mm(194.63), totalsY + mm(16.153));
  
  // Rectangle 4: TEKLİF TOPLAMI - X1:141.901mm, Y: 100.364mm, X2:194.63mm
  const totalBoxY = totalsY + mm(18.269);
  const totalBoxW = mm(194.63) - mm(141.901);
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(1.5);
  doc.setFillColor(...C.white);
  doc.roundedRect(mm(141.901), totalBoxY, totalBoxW, mm(12.40), 2, 2, 'FD');
  
  // "TEKLİF TOPLAMI" - X: 145.228mm, Y: 102.635mm
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.setTextColor(...C.primary);
  doc.text(trFix('TEKLİF TOPLAMI'), mm(145.228), totalBoxY + mm(2.47));
  
  // Teklif toplamı value - X: 145.228mm, Y: 106.328mm - 11pt bold
  doc.setFontSize(11);
  doc.setTextColor(...C.textMid);
  doc.text(`${pbSymbol} ${fmtN(genelToplam)}`, mm(145.228), totalBoxY + mm(7.071));
  
  // Horizontal Line 6 - X: 15.446mm W: 53.975mm Y: 121.389mm
  const sigLineY = totalBoxY + mm(10) + mm(2);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.75);
  doc.line(mm(15.446), sigLineY, mm(15.446) + mm(53.975), sigLineY);
  
  // Horizontal Line 7 - X: 74.712mm W: 53.975mm Y: 121.389mm
  doc.line(mm(74.712), sigLineY, mm(74.712) + mm(53.975), sigLineY);
  
  // "Yetkili İmza / Kaşe" - 15.446mm Y: 127.447mm
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...C.textLight);
  doc.text(trFix('Yetkili İmza / Kaşe'), mm(15.446), sigLineY + mm(6.058));
  
  // ── FOOTER ──
  // Horizontal Line 8 - X1: 15.446mm Y: 279.929mm X2: 194.556mm thickness: 2pt Color: #1D7D95
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(2);
  doc.line(mm(15.446), mm(279.929), mm(194.556), mm(279.929));
  
  // Footer text - Y: 284.604mm
  doc.setFontSize(7);
  doc.setTextColor(...C.textLight);
  
  const emailText = st.email || 'info@ege-fe.com';
  const telText = st.tel || '0 (312) 482 5451';
  const faxText = st.fax || '0 (312) 480 5453';
  
  // "e-posta: ..." - X: 59.953mm Y: 284.604mm
  doc.text('e-posta: ' + emailText, mm(59.953), mm(284.604)+5);
  
  // "|" - X: 94.113mm Y: 284.604mm
  doc.text('|', mm(94.113), mm(284.604)+5);
  
  // "Tel: ..." - X: 97.662mm Y: 284.604mm
  doc.text('Tel: ' + telText, mm(97.662), mm(284.604)+5);
  
  // "|" - X: 122.241mm Y: 284.604mm
  doc.text('|', mm(122.241), mm(284.604)+5);
  
  // "Fax: ..." - X: 125.637mm Y: 284.604mm
  doc.text('Fax: ' + faxText, mm(125.637), mm(284.604)+5);
  
  // Export
  doc.save(`Teklif_${t.teklifNo || 'X'}.pdf`);
}

