function printTutanakData(tutanak){
  const logoImg = new Image();
  logoImg.onload = function(){
    const cv = document.createElement('canvas');
    cv.width = 534; cv.height = 252;
    cv.getContext('2d').drawImage(logoImg, 0, 0, 534, 252);
    _generateTutanakPDF(tutanak, cv.toDataURL('image/png'));
  };
  logoImg.onerror = function(){ _generateTutanakPDF(tutanak, null); };
  logoImg.src = 'brand_assets/logo_if_bg_white.svg';
}

async function _generateTutanakPDF(tutanak, logoPngDataUrl){
  const toB64 = buf => {
    const bytes = new Uint8Array(buf);
    let s = '';
    for(let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
    return btoa(s);
  };
  const [regularBuf, boldBuf] = await Promise.all([
    fetch('fonts/Arial.ttf').then(r => r.arrayBuffer()),
    fetch('fonts/Arial_Bold.ttf').then(r => r.arrayBuffer())
  ]);

  const mm = v => v * 2.83465;

  const C = {
    primary:   [29, 125, 149],
    textDark:  [26, 46, 59],
    textMid:   [46, 64, 80],
    textLight: [143, 164, 176],
    border:    [194, 208, 216],
    tableBg:   [228, 245, 249],
    boxBg:     [247, 249, 250],
    white:     [255, 255, 255],
    headerBg:  [26, 58, 92]
  };

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({orientation: 'portrait', unit: 'pt', format: 'a4'});
  doc.addFileToVFS('Arial.ttf', toB64(regularBuf));
  doc.addFont('Arial.ttf', 'Arial', 'normal');
  doc.addFileToVFS('Arial_Bold.ttf', toB64(boldBuf));
  doc.addFont('Arial_Bold.ttf', 'Arial', 'bold');
  doc.setFont('Arial');
  doc.setCharSpace(0);

  const st = state.settings || {};

  // ── HEADER (teklif ile aynı layout) ──
  if(logoPngDataUrl){
    try { doc.addImage(logoPngDataUrl, 'PNG', mm(19.812), mm(9.737), mm(39.793), mm(19.389), '', 'FAST'); } catch(e){}
  }

  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.75);
  doc.line(mm(63.765), mm(11.642), mm(63.765), mm(25.517));

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

  // ── TITLE (ortalı) ──
  doc.setFontSize(15);
  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('Teslim Tutanağı', mm(105), mm(42.395)+11, {align: 'center'});

  // ── META (sağ taraf, teklif ile aynı sütun pozisyonları) ──
  const tarihStr = fmtDate(tutanak.tarih) || '-';

  doc.setFontSize(8);
  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('Tutanak No', mm(141.66), mm(50.611)+6);
  doc.text(':', mm(165.354), mm(50.611)+6);
  doc.setFont('Arial', 'normal');
  doc.text(tutanak.no || '-', mm(171.249), mm(50.611)+6);

  doc.setFont('Arial', 'bold');
  doc.text('Tarih', mm(141.66), mm(55.109)+6);
  doc.text(':', mm(165.354), mm(55.109)+6);
  doc.setFont('Arial', 'normal');
  doc.text(tarihStr, mm(171.249), mm(55.109)+6);

  doc.setDrawColor(...C.tableBg);
  doc.setLineWidth(0.75);
  doc.line(mm(15.446), mm(64), mm(194.63), mm(64));

  // ── İBARA (şirket adı bold, kelime kelime akış) ──
  doc.setFontSize(9);
  doc.setTextColor(...C.textMid);

  const renderInline = (parts, sx, sy, maxW, lh) => {
    let cx = sx, cy = sy;
    for(const {text, bold} of parts){
      doc.setFont('Arial', bold ? 'bold' : 'normal');
      const tokens = text.match(/\S+\s*/g) || [];
      for(const token of tokens){
        const tw = doc.getTextWidth(token);
        if(cx > sx && cx + tw > sx + maxW){ cx = sx; cy += lh; }
        doc.text(token, cx, cy);
        cx += tw;
      }
    }
    return cy + lh;
  };

  const ibaraEndY = renderInline([
    {text: tarihStr + ' ', bold: true},
    {text: 'tarihinde aşağıda seri numarası yazılı olan ARMAS Marka Alkolmetre cihazları arızası giderilmek üzere ', bold: false},
    {text: 'Armas Elektronik San. ve Tic. Ltd. Şti', bold: true},
    {text: "'ne elden teslim edilmiştir.", bold: false}
  ], mm(15.446), mm(69), mm(179.108), 9 * 1.5);

  // ── TABLE ──
  let tableEndY = ibaraEndY + mm(4);

  doc.autoTable({
    startY: ibaraEndY + mm(4),
    head: [['#', 'KURUM ADI', 'SERİ NO', 'GARANTİ', 'AKSESUARLAR']],
    body: (tutanak.kalemler || []).map((k, i) => [
      i + 1,
      k.kurumAdi || '—',
      k.seriNo || '—',
      k.garantiDurumu || '—',
      k.aksesuarlar || '—'
    ]),
    theme: 'plain',
    styles: {
      font: 'Arial',
      fontSize: 9,
      cellPadding: {top: 2.5, right: 3, bottom: 2.5, left: 3},
      textColor: C.textDark,
      lineColor: C.border,
      lineWidth: 0.5
    },
    headStyles: {
      fillColor: C.headerBg,
      textColor: C.white,
      fontStyle: 'bold',
      fontSize: 9,
      cellPadding: {top: 3, right: 3, bottom: 3, left: 3}
    },
    columnStyles: {
      0: {halign: 'center', cellWidth: mm(10)},
      1: {halign: 'left',   cellWidth: mm(52)},
      2: {halign: 'center',   cellWidth: mm(35)},
      3: {halign: 'center', cellWidth: mm(20)},
      4: {halign: 'left'}
    },
    didParseCell: data => {
      if(data.section === 'head'){
        const aligns = ['center','center','center','center','left'];
        data.cell.styles.halign = aligns[data.column.index] || 'left';
      }
    },
    margin: {left: mm(15.446), right: mm(15.446)},
    didDrawPage: data => { tableEndY = data.cursor.y; }
  });
  doc.setCharSpace(0);
  doc.setFont('Arial', 'normal');

  // ── ÖZET ──
  const sumY = tableEndY + mm(4);
  doc.setFillColor(...C.boxBg);
  doc.setDrawColor(...C.border);
  doc.setLineWidth(0.5);
  doc.roundedRect(mm(15.446), sumY, mm(179.108), mm(8), 1.2, 1.2, 'FD');
  doc.setFontSize(9);
  doc.setFont('Arial', 'normal');
  doc.setTextColor(...C.textMid);
  doc.text(`Toplam ${(tutanak.kalemler||[]).length} adet cihaz teslim alınmıştır.`, mm(18), sumY + mm(4.5));

  // ── İMZA ──
  const signY = sumY + mm(16);
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(1.5);
  doc.line(mm(15.446), signY, mm(15.446)+mm(75), signY);
  doc.setFontSize(9);
  doc.setFont('Arial', 'bold');
  doc.setTextColor(...C.textMid);
  doc.text('Teslim Eden', mm(15.446)+mm(37.5), signY+mm(6), {align: 'center'});

  doc.line(mm(194.556)-mm(75), signY, mm(194.556), signY);
  doc.text('Teslim Alan', mm(194.556)-mm(37.5), signY+mm(6), {align: 'center'});

  // ── FOOTER ──
  doc.setDrawColor(...C.primary);
  doc.setLineWidth(2);
  doc.line(mm(15.446), mm(279.929), mm(194.556), mm(279.929));
  doc.setFontSize(7);
  doc.setFont('Arial', 'normal');
  doc.setTextColor(...C.textLight);

  const emailText = st.email || 'servis@ege-fe.com';
  const telText   = st.tel   || '0 (312) 482 54 51';
  const faxText   = st.fax   || '0 (312) 480 54 53';

  doc.text('e-posta: '+emailText, mm(59.953),  mm(284.604)+5);
  doc.text('|',                   mm(94.113),  mm(284.604)+5);
  doc.text('Tel: '+telText,       mm(97.662),  mm(284.604)+5);
  doc.text('|',                   mm(122.241), mm(284.604)+5);
  doc.text('Fax: '+faxText, mm(125.637), mm(284.604)+5);

  doc.save(`Tutanak_${tutanak.no||'X'}.pdf`);
}

// ════ TUTANAK ════

let savedTutanaklar = [];
function loadSavedTutanaklar(){
  savedTutanaklar = DB.pload('tutanaklar', []);
}

function nextTutanakNo(){
  loadSavedTutanaklar();
  const nums = savedTutanaklar.map(t=>parseInt((t.no||'').replace('TT',''))||0);
  return 'TT'+String((nums.length?Math.max(...nums):0)+1).padStart(5,'0');
}

function openYeniTutanak(){
  var yeniGelenler=state.servisler.filter(function(s){return s.durum==='Yeni Gelen';});
  var listEl=document.getElementById('tutanak-secim-listesi');
  var bosEl=document.getElementById('tutanak-secim-bos');
  if(!yeniGelenler.length){
    listEl.innerHTML='';
    bosEl.style.display='';
  } else {
    bosEl.style.display='none';
    listEl.innerHTML=yeniGelenler.map(function(s){
      return '<label style="display:flex;align-items:flex-start;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:8px;margin-bottom:8px;cursor:pointer" onmouseover="this.style.background=\'var(--bg3)\'" onmouseout="this.style.background=\'\'">'
        +'<input type="checkbox" class="tutanak-chk" data-id="'+s.id+'" style="margin-top:3px;accent-color:var(--accent);width:16px;height:16px;flex-shrink:0" onchange="updateTutanakSecimSayi()">'
        +'<div style="flex:1;min-width:0">'
        +'<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:3px">'
        +'<span class="kn-badge">'+s.kayitNo+'</span>'
        +'<span style="font-weight:600;font-size:13px">'+s.kurumAdi+'</span>'
        +'</div>'
        +'<div style="font-size:11px;color:var(--text3);display:flex;gap:12px;flex-wrap:wrap">'
        +(s.seriNo?'<span>Seri: <b>'+s.seriNo+'</b></span>':'')
        +(s.gelisTarihi?'<span>Geliş: <b>'+s.gelisTarihi+'</b></span>':'')
        +(s.ilgiliKisi?'<span>İlgili: <b>'+s.ilgiliKisi+'</b></span>':'')
        +'</div></div></label>';
    }).join('');
  }
  updateTutanakSecimSayi();
  openModal('modal-tutanak-secim');
}

function updateTutanakSecimSayi(){
  var chks=document.querySelectorAll('.tutanak-chk:checked');
  var sayiEl=document.getElementById('tutanak-secim-sayi');
  var btnEl=document.getElementById('tutanak-olustur-btn');
  if(sayiEl)sayiEl.textContent=chks.length+' kayıt seçili';
  if(btnEl)btnEl.disabled=chks.length===0;
}

function olusturTutanakSecimden(){
  var chks=document.querySelectorAll('.tutanak-chk:checked');
  if(!chks.length){toast('Lütfen en az 1 kayıt seçin.','error');return;}
  var secilenIds=Array.from(chks).map(function(c){return c.dataset.id;});
  var secilen=state.servisler.filter(function(s){return secilenIds.includes(s.id);});
  var no=nextTutanakNo();
  var tarih=today();
  var kalemler=secilen.map(function(s){return{
    kayitNo:s.kayitNo,
    kurumAdi:s.kurumAdi||'—',
    seriNo:s.seriNo||'—',
    garantiDurumu:s.garantiDurumu||'Hayır',
    aksesuarlar:buildAksesuarStr(s),
    urunAdi:s.urunAdi||'—',
    gelisTarihi:s.gelisTarihi||''
  };});
  closeModal('modal-tutanak-secim');
  showTutanakPreview({no:no,tarih:tarih,kalemler:kalemler,olusturan:state.currentUser?.ad||'',servisIds:secilenIds},true);
}

function tutanakSelectAll(checked){
  document.querySelectorAll('.ts-chk').forEach(function(c){c.checked=checked;});
  tutanakUpdateCount();
}

function tutanakUpdateCount(){
  var selected=document.querySelectorAll('.ts-chk:checked').length;
  var countEl=document.getElementById('ts-secim-say');
  if(countEl)countEl.textContent=selected+' kayıt seçildi';
  var btn=document.getElementById('ts-onayla-btn');
  if(btn)btn.disabled=(selected===0);
  // Sync select-all checkbox
  var all=document.querySelectorAll('.ts-chk').length;
  var saEl=document.getElementById('ts-select-all');
  if(saEl)saEl.indeterminate=(selected>0&&selected<all);
  if(saEl&&selected===all&&all>0)saEl.checked=true;
  if(saEl&&selected===0)saEl.checked=false;
}

function tutanakSecimOnayla(){
  var selectedIds=[];
  document.querySelectorAll('.ts-chk:checked').forEach(function(c){selectedIds.push(c.dataset.id);});
  if(!selectedIds.length){toast('Lütfen en az bir kayıt seçin.','error');return;}
  var secilen=state.servisler.filter(function(s){return selectedIds.includes(s.id);});
  var no=nextTutanakNo();
  var tarih=today();
  var kalemler=secilen.map(function(s){return{
    servisId:s.id,
    kayitNo:s.kayitNo,
    kurumAdi:s.kurumAdi||'—',
    seriNo:s.seriNo||'—',
    garantiDurumu:s.garantiDurumu||'Hayır',
    aksesuarlar:buildAksesuarStr(s),
    urunAdi:s.urunAdi||'—',
    gelisTarihi:s.gelisTarihi||''
  };});
  closeModal('modal-tutanak-secim');
  showTutanakPreview({no:no,tarih:tarih,kalemler:kalemler,olusturan:state.currentUser?.ad||''},true,selectedIds);
}

function buildAksesuarStr(s){
  const chips = Array.isArray(s.aksesuarlar)&&s.aksesuarlar.length ? [...s.aksesuarlar] : [];
  if(s.aksesyarDiger) chips.push(s.aksesyarDiger);
  return chips.length ? chips.join(', ') : '—';
}

function showTutanakPreview(tutanak, isNew, selectedIds){
  const st = state.settings;
  const logoSrc = document.getElementById('sb-logo-img').src;
  const rows = tutanak.kalemler.map((k,i)=>`
    <tr style="page-break-inside:avoid">
      <td style="padding:7px 10px;font-size:12px;border:1px solid var(--border);text-align:center;color:var(--text3)">${i+1}</td>
      <td style="padding:7px 10px;font-size:12px;border:1px solid var(--border);font-weight:500">${k.kurumAdi}</td>
      <td style="padding:7px 10px;font-size:12px;border:1px solid var(--border);font-family:'DM Mono',monospace">${k.seriNo}</td>
      <td style="padding:7px 10px;font-size:12px;border:1px solid var(--border);text-align:center">${k.garantiDurumu}</td>
      <td style="padding:7px 10px;font-size:12px;border:1px solid var(--border)">${k.aksesuarlar}</td>
    </tr>`).join('');

  document.getElementById('tutanak-modal-title').textContent = 'Teslim Tutanağı — '+tutanak.no;
  document.getElementById('tutanak-modal-body').innerHTML = `
    <div style="max-width:760px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid var(--accent);padding-bottom:14px;margin-bottom:0">
        <img src="${logoSrc}" style="width:90px;height:90px;object-fit:contain;display:block">
        <div style="text-align:right;font-size:11px;color:var(--text2);line-height:1.9">
          <strong style="font-size:13px;color:var(--text);display:block">Egefe Bilişim Sağlık San. Ve Tic. A.Ş.</strong>
          Harbiye Mah. Hürriyet Cad. No:7/12 Çankaya/Ankara
        </div>
      </div>
      <div style="text-align:center;margin:14px 0 6px">
        <div style="font-size:19px;font-weight:700;letter-spacing:.5px">TESLİM TUTANAĞI</div>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
        <div style="text-align:right;font-size:12px;line-height:2">
          <div><span style="font-size:11px;color:var(--text3)">Tutanak No:&nbsp;</span><strong style="color:var(--accent)">${tutanak.no}</strong></div>
          <div><span style="font-size:11px;color:var(--text3)">Tarih:&nbsp;</span><strong>${fmtDate(tutanak.tarih)}</strong></div>
        </div>
      </div>
      <div style="font-size:12px;color:var(--text2);line-height:1.8;margin-bottom:14px">
        <strong>${fmtDate(tutanak.tarih)}</strong> tarihinde aşağıda seri numarası yazılı olan ARMAS Marka Alkolmetre cihazları arızası giderilmek üzere Armas Elektronik San. ve Tic. Ltd. Şti'ne elden teslim edilmiştir.
      </div>
      <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
        <thead>
          <tr style="background:var(--bg3)">
            <th style="padding:8px 10px;font-size:10px;color:var(--text3);border:1px solid var(--border);width:30px">#</th>
            <th style="padding:8px 10px;font-size:10px;color:var(--text3);border:1px solid var(--border);text-align:left">KURUM ADI</th>
            <th style="padding:8px 10px;font-size:10px;color:var(--text3);border:1px solid var(--border);text-align:left">SERİ NO</th>
            <th style="padding:8px 10px;font-size:10px;color:var(--text3);border:1px solid var(--border);text-align:center">GARANTİ</th>
            <th style="padding:8px 10px;font-size:10px;color:var(--text3);border:1px solid var(--border);text-align:left">AKSESUARLAR</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="font-size:12px;color:var(--text3);margin-bottom:16px;background:var(--bg3);border-radius:6px;padding:10px 14px">
        Toplam <strong style="color:var(--text)">${tutanak.kalemler.length}</strong> adet cihaz teslim alınmıştır.
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:36px;margin-top:20px">
        <div style="border-top:2px solid var(--accent);padding-top:12px;text-align:center">
          <div style="font-size:12px;font-weight:700;color:var(--text);letter-spacing:.05em">TESLİM EDEN</div>
        </div>
        <div style="border-top:2px solid var(--accent);padding-top:12px;text-align:center">
          <div style="font-size:12px;font-weight:700;color:var(--text);letter-spacing:.05em">TESLİM ALAN</div>
        </div>
      </div>
      <div style="margin-top:30px;padding:10px 16px;border-top:2px solid var(--border);text-align:center;font-size:11px;color:var(--text3);background:var(--bg3);border-radius:0 0 8px 8px">
        Tel: 0 (312) 482 54 51 &nbsp;|&nbsp; Fax: 0 (312) 480 54 52 &nbsp;|&nbsp; E-mail: servis&#64;ege-fe.com
      </div>
    </div>`;

  // PDF button
  document.getElementById('tutanak-pdf-btn').onclick = ()=>printTutanakData(tutanak);

  // If new: save first
  if(isNew){
    loadSavedTutanaklar();
    savedTutanaklar.push({...tutanak});
    DB.psave('tutanaklar', savedTutanaklar);
    // Seçilen servislerin durumunu "S.F. Bekleniyor" yap
    var ids=selectedIds||(tutanak.kalemler||[]).map(function(k){return k.servisId;}).filter(Boolean);
    if(ids&&ids.length){
      ids.forEach(function(sid){
        var si=state.servisler.findIndex(function(x){return x.id===sid;});
        if(si>=0&&state.servisler[si].durum==='Yeni Gelen')state.servisler[si].durum='S.F. Bekleniyor';
      });
      DB.psave('servisler',state.servisler);
      renderTable();
    }
    toast('Tutanak kaydedildi. Seçilen kayıtlar S.F. Bekleniyor durumuna alındı.','success');
    renderTutanaklar();
  }
  openModal('modal-tutanak-onizleme');
}

function previewTutanak(no){
  loadSavedTutanaklar();
  const t = savedTutanaklar.find(x=>x.no===no);
  if(t) showTutanakPreview(t, false);
}

function deleteTutanak(no){
  if(!confirm('Bu tutanak silinsin mi?')) return;
  loadSavedTutanaklar();
  savedTutanaklar = savedTutanaklar.filter(t=>t.no!==no);
  DB.psave('tutanaklar', savedTutanaklar);
  renderTutanaklar();
  toast('Tutanak silindi.','info');
}

function printTutanakById(no){
  loadSavedTutanaklar();
  const t = savedTutanaklar.find(x=>x.no===no);
  if(t) printTutanakData(t);
}
