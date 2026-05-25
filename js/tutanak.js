function printTutanakData(tutanak){
  var logoSrc='data:image/svg+xml;base64,'+LOGO_SVG_B64;
  var tarihStr=fmtDate(tutanak.tarih);
  var rows=(tutanak.kalemler||[]).map(function(k,i){
    return '<tr style="background:'+(i%2===0?'#fff':'#f8fafc')+'">'
      +'<td style="padding:8px 10px;font-size:12px;border:1px solid #c8d4e0;text-align:center;color:#888">'+(i+1)+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;border:1px solid #c8d4e0;font-weight:500">'+k.kurumAdi+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;border:1px solid #c8d4e0;font-family:monospace">'+k.seriNo+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;border:1px solid #c8d4e0;text-align:center">'+k.garantiDurumu+'</td>'
      +'<td style="padding:8px 10px;font-size:12px;border:1px solid #c8d4e0">'+k.aksesuarlar+'</td>'
      +'</tr>';
  }).join('');
  var pdfHtml='<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Tutanak '+tutanak.no+'</title>'
    +'<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Segoe UI,Arial,sans-serif;color:#1a2a3a;padding:24px 32px;font-size:13px}'
    +'.header{display:flex;align-items:flex-start;justify-content:space-between;border-bottom:2px solid #2d7fa8;padding-bottom:14px;margin-bottom:0}'
    +'.logo{width:90px;height:90px;object-fit:contain;display:block;background:#fff;padding:4px;border-radius:4px}'
    +'.firma-block{text-align:right;font-size:11px;color:#444;line-height:1.9}'
    +'.firma-block strong{font-size:13px;font-weight:700;color:#1a3a5c;display:block;margin-bottom:2px}'
    +'.title-row{text-align:center;margin:16px 0 6px}.title-main{font-size:20px;font-weight:700;color:#1a3a5c;letter-spacing:.5px}'
    +'.meta-block{text-align:right;font-size:12px;color:#333;line-height:2;margin-bottom:14px}'
    +'.meta-block .label{color:#888;font-size:11px}'
    +'.ibara{font-size:12px;color:#333;line-height:1.8;margin-bottom:16px}'
    +'table{width:100%;border-collapse:collapse;margin-bottom:12px}'
    +'thead th{padding:9px 10px;background:#1a3a5c;color:#fff;font-size:11px;font-weight:600;text-align:left}'
    +'thead th:first-child{text-align:center;width:36px}thead th:nth-child(3){width:130px}thead th:nth-child(4){width:68px;text-align:center}'
    +'.summary{font-size:12px;color:#555;margin-bottom:20px;padding:8px 12px;background:#f0f5fa;border-radius:4px}'
    +'.sign-section{display:grid;grid-template-columns:1fr 1fr;gap:48px;margin-top:24px}'
    +'.sign-box{border-top:2px solid #2d7fa8;padding-top:14px;text-align:center}'
    +'.sign-title{font-size:13px;font-weight:700;color:#1a3a5c;letter-spacing:.08em}'
    +'.footer{position:fixed;bottom:0;left:0;right:0;padding:8px 32px;border-top:1px solid #ccd6e0;text-align:center;font-size:11px;color:#666;line-height:1.8;background:#fff}'
    +'@media print{@page{size:A4;margin:14mm}}</style></head><body>'
    +'<div class="header"><img class="logo" src="'+logoSrc+'" alt="Egefe">'
    +'<div class="firma-block"><strong>Egefe Bili&#351;im Sa&#287;l&#305;k San. Ve Tic. A.&#350;.</strong>Harbiye Mah. H&#252;rriyet Cad. No:7/12 &#199;ankaya/Ankara</div></div>'
    +'<div class="title-row"><div class="title-main">TESL&#304;M TUTANA&#286;I</div></div>'
    +'<div class="meta-block"><div><span class="label">Tutanak No:&nbsp;</span><strong style="color:#2d7fa8">'+tutanak.no+'</strong></div>'
    +'<div><span class="label">Tarih:&nbsp;</span><strong>'+tarihStr+'</strong></div></div>'
    +'<div class="ibara"><strong>'+tarihStr+'</strong> tarihinde a&#351;a&#287;&#305;da seri numaras&#305; yaz&#305;l&#305; olan ARMAS Marka Alkolmetre cihazlar&#305; ar&#305;zas&#305; giderilmek &#252;zere Armas Elektronik San. ve Tic. Ltd. &#350;ti\u0027ne elden teslim edilmi&#351;tir.</div>'
    +'<table><thead><tr><th>#</th><th>KURUM ADI</th><th>SER&#304; NO</th><th>GARANT&#304;</th><th>AKSESUARLAR</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="summary">Toplam <strong>'+(tutanak.kalemler||[]).length+'</strong> adet cihaz teslim al&#305;nm&#305;&#351;t&#305;r.</div>'
    +'<div class="sign-section"><div class="sign-box"><div class="sign-title">TESL&#304;M EDEN</div></div>'
    +'<div class="sign-box"><div class="sign-title">TESL&#304;M ALAN</div></div></div>'
    +'<div class="footer">Tel: 0 (312) 482 54 51 &nbsp;|&nbsp; Fax: 0 (312) 480 54 52 &nbsp;|&nbsp; E-mail: servis&#64;ege-fe.com</div>'
    +'</body></html>';
  var _w2=window.open('','_blank');
  if(_w2){_w2.document.write(pdfHtml);_w2.document.close();}
  else{var _b2=new Blob([pdfHtml],{type:'text/html;charset=utf-8'});var _u2=URL.createObjectURL(_b2);var _a2=document.createElement('a');_a2.href=_u2;_a2.target='_blank';document.body.appendChild(_a2);_a2.click();document.body.removeChild(_a2);setTimeout(function(){URL.revokeObjectURL(_u2);},10000);}
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

