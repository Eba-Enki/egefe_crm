function renderDashboard(){
  var s   = state.servisler  || [];
  var tl  = state.teklifler  || [];
  var sps = state.siparisler || [];
  var fts = state.faturalar  || [];
  var mus = state.musteriler || [];
  var now = new Date();
  var thisMonth = now.getMonth();
  var thisYear  = now.getFullYear();
  if(currentPortal === 'satis'){
    _dbSatis(tl, sps, fts, mus, now, thisMonth, thisYear);
  } else {
    _dbServis(s, tl, mus, now, thisMonth, thisYear);
  }
}

function _fmtN(n){
  return (n||0).toLocaleString('tr-TR',{minimumFractionDigits:0,maximumFractionDigits:0});
}

function _kpiCard(label,val,sub,col){
  return '<div style="background:var(--bg2);border:1px solid var(--border);border-top:3px solid '+col+';border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow-sm)">'
    +'<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:11px">'+label+'</div>'
    +'<div style="font-size:30px;font-weight:700;font-family:var(--font-mono);line-height:1;color:'+col+'">'+val+'</div>'
    +'<div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.4">'+sub+'</div>'
    +'</div>';
}

function _barRow(label,cnt,total,hex){
  var pct = total>0 ? Math.round(cnt/total*100) : 0;
  return '<div style="margin-bottom:11px">'
    +'<div style="display:flex;justify-content:space-between;align-items:baseline;font-size:12px;margin-bottom:5px">'
    +'<span style="color:var(--text2)">'+label+'</span>'
    +'<span style="font-family:var(--font-mono);color:var(--text);font-weight:600">'+cnt+' <span style="color:var(--text3);font-weight:400;font-size:11px">'+pct+'%</span></span>'
    +'</div>'
    +'<div style="height:7px;background:var(--bg3);border-radius:4px;overflow:hidden">'
    +'<div style="height:100%;width:'+pct+'%;background:'+hex+';border-radius:4px;transition:width .35s ease"></div>'
    +'</div></div>';
}

// ═══ TEKNİK SERVİS ═══
function _dbServis(s, tl, mus, now, thisMonth, thisYear){
  var aktif    = s.filter(function(x){return !['Teslim Edildi','Reddedildi','İşlemsiz İade'].includes(x.durum);});
  var bekleyen = s.filter(function(x){return ['Arıza Tespitinde','Yanıt Bekleniyor'].includes(x.durum);});
  var buAy     = s.filter(function(x){
    var d=new Date(x.gelisTarihi||x.olusturmaTarihi);
    return d.getMonth()===thisMonth && d.getFullYear()===thisYear;
  });
  var tamamlanan = s.filter(function(x){return x.durum==='Teslim Edildi';});

  // ─ KPI Kartları
  var kpiEl = document.getElementById('db-kpi-grid');
  if(kpiEl) kpiEl.innerHTML =
    _kpiCard('Aktif Kayıtlar', aktif.length, 'Tamamlanmamış servisler', 'var(--accent)')
   +_kpiCard('Bekleyen', bekleyen.length, 'Arıza Tespitinde + Yanıt Bekleniyor', 'var(--amber)')
   +_kpiCard('Bu Ay Gelen', buAy.length, now.toLocaleString('tr-TR',{month:'long',year:'numeric'}), 'var(--teal)')
   +_kpiCard('Teslim Edilen', tamamlanan.length, s.length+' toplam kayıttan', 'var(--green)');

  // ─ Durum Dağılımı (donut + legend)
  var DHEX = {
    'Cihaz Kabul':'#3d9bc4',
    'Arıza Tespitinde':'#f59e0b',
    'Yanıt Bekleniyor':'#a78bfa',
    'Onarımda':'#4ade80',
    'Teslim Edildi':'#2dd4bf',
    'Reddedildi':'#f87171',
    'İşlemsiz İade':'#f97316'
  };
  var sg = Object.entries(DHEX)
    .map(function(e){return{d:e[0],c:e[1],cnt:s.filter(function(x){return x.durum===e[0];}).length};})
    .filter(function(x){return x.cnt>0;});
  var total = s.length||1;
  var CX=70,CY=70,R=54,circ=2*Math.PI*R;
  var off=0;
  var svgPaths = sg.map(function(seg){
    var pct=seg.cnt/total;
    var arc='<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="'+seg.c
      +'" stroke-width="14" stroke-dasharray="'+(pct*circ).toFixed(2)+' '+(circ-pct*circ).toFixed(2)
      +'" stroke-dashoffset="'+(-off*circ).toFixed(2)+'" transform="rotate(-90 '+CX+' '+CY+')">'
      +'<title>'+seg.d+': '+seg.cnt+'</title></circle>';
    off+=pct;
    return arc;
  }).join('');
  var legendHtml = sg.map(function(seg){
    var pct=Math.round(seg.cnt/total*100);
    return '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">'
      +'<span style="width:9px;height:9px;border-radius:50%;background:'+seg.c+';flex-shrink:0;display:inline-block"></span>'
      +'<span style="flex:1;font-size:12px;color:var(--text2)">'+seg.d+'</span>'
      +'<span style="font-family:var(--font-mono);font-size:12px;color:var(--text);font-weight:600">'+seg.cnt+'</span>'
      +'<span style="font-family:var(--font-mono);font-size:11px;color:var(--text3);min-width:30px;text-align:right">'+pct+'%</span>'
      +'</div>';
  }).join('');

  var chartTitle = document.getElementById('db-chart-title');
  if(chartTitle) chartTitle.textContent = 'Servis Durum Dağılımı';

  var chartBody = document.getElementById('db-chart-body');
  if(chartBody) chartBody.innerHTML =
    '<div style="display:flex;gap:22px;align-items:flex-start">'
      +'<div style="flex-shrink:0;position:relative;width:140px;height:140px">'
        +'<svg width="140" height="140" viewBox="0 0 140 140">'
          +'<circle cx="70" cy="70" r="54" fill="none" stroke="var(--bg3)" stroke-width="14"/>'
          +svgPaths
        +'</svg>'
        +'<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column">'
          +'<span style="font-size:28px;font-weight:700;font-family:var(--font-mono);line-height:1;color:var(--text)">'+s.length+'</span>'
          +'<span style="font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Toplam</span>'
        +'</div>'
      +'</div>'
      +'<div style="flex:1">'+legendHtml+'</div>'
    +'</div>';

  // ─ Alt Panel: Teklif Özeti
  var tklDurumlar = [
    {l:'İletildi',    hex:'#f59e0b'},
    {l:'Kabul Edildi',hex:'#4ade80'},
    {l:'Reddedildi',  hex:'#f87171'},
    {l:'Kapandı',     hex:'#2dd4bf'}
  ]; // Servis portalı — Kabul Edildi servis akışında kullanılmaya devam ediyor
  var tTotal = tl.length||1;
  var tklBars = tklDurumlar.map(function(d){
    return _barRow(d.l, tl.filter(function(t){return t.durum===d.l;}).length, tTotal, d.hex);
  }).join('');

  var secEl = document.getElementById('db-secondary');
  if(secEl) secEl.innerHTML =
    '<div class="card">'
      +'<div class="card-header">'
        +'<span class="card-title">Teklif Özeti</span>'
        +'<span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">'+tl.length+' teklif toplam</span>'
      +'</div>'
      +'<div class="card-body">'
        +(tl.length ? tklBars : '<div style="color:var(--text3);font-size:13px">Henüz teklif bulunmuyor.</div>')
      +'</div>'
    +'</div>';

  if(typeof renderNotlar === 'function') renderNotlar();
}

// ═══ SATIŞ PAZARLAMAportalı ═══
function _dbSatis(tl, sps, fts, mus, now, thisMonth, thisYear){
  var onayBekl   = tl.filter(function(t){return t.durum==='Taslak';});
  var aktivSp    = sps.filter(function(s){return ['Hazırlanıyor','Kısmi Teslimat'].includes(s.durum);});
  var odenmemis  = fts.filter(function(f){return f.durum==='Ödenmedi';});
  var odenmemisToplam = odenmemis.reduce(function(a,f){return a+(f.tutar||0);},0);
  var buAyTeklif = tl.filter(function(t){
    var d=new Date(t.teklifTarihi||t.olusturmaTarihi);
    return d.getMonth()===now.getMonth() && d.getFullYear()===now.getFullYear();
  });

  // ─ KPI Kartları
  var kpiEl = document.getElementById('db-kpi-grid');
  if(kpiEl) kpiEl.innerHTML =
    _kpiCard('Toplam Teklif',  tl.length,       onayBekl.length+' taslak',                          'var(--accent)')
   +_kpiCard('Aktif Sipariş',  aktivSp.length,  sps.filter(function(s){return s.durum==='Kısmi Teslimat';}).length+' kısmi teslimat', 'var(--amber)')
   +_kpiCard('Toplam Fatura',  fts.length,      fts.filter(function(f){return f.durum==='Ödendi';}).length+' ödendi',                'var(--teal)')
   +_kpiCard('Ödenmemiş',      odenmemis.length, odenmemisToplam>0?'₺ '+_fmtN(odenmemisToplam):'Fatura yok',                         'var(--red)');

  // ─ Teklif Durum Dağılımı (bar chart)
  var tklDurumlar = [
    {l:'Taslak',           hex:'#64748b'},
    {l:'İletildi',         hex:'#f59e0b'},
    {l:'Siparişe Dönüştü', hex:'#3d9bc4'},
    {l:'Reddedildi',       hex:'#f87171'}
  ];
  var tTotal = tl.length||1;
  var chartTitle = document.getElementById('db-chart-title');
  if(chartTitle) chartTitle.textContent = 'Teklif Durum Dağılımı';

  var chartBody = document.getElementById('db-chart-body');
  if(chartBody){
    var bars = tklDurumlar.map(function(d){
      var cnt = tl.filter(function(t){return t.durum===d.l;}).length;
      return cnt>0 ? _barRow(d.l, cnt, tTotal, d.hex) : '';
    }).join('');
    chartBody.innerHTML = bars || '<div style="color:var(--text3);font-size:13px;padding:8px 0">Henüz teklif bulunmuyor.</div>';
  }

  // ─ Alt Panel: Sipariş Durumu + Fatura Durumu (2 kolon)
  var spDurumlar = [
    {l:'Hazırlanıyor',   hex:'#f59e0b'},
    {l:'Kısmi Teslimat', hex:'#2dd4bf'},
    {l:'Teslim Edildi',  hex:'#4ade80'},
    {l:'Fatura Edildi',  hex:'#3d9bc4'},
    {l:'İptal',          hex:'#f87171'}
  ];
  var spTotal = sps.length||1;
  var spBars = spDurumlar.map(function(d){
    var cnt = sps.filter(function(s){return s.durum===d.l;}).length;
    return cnt>0 ? _barRow(d.l, cnt, spTotal, d.hex) : '';
  }).join('');

  var ftDurumlar = [
    {l:'Ödendi',             hex:'#4ade80'},
    {l:'Ödenmedi',           hex:'#f87171'},
    {l:'Ödeme Bekleniyor',   hex:'#f59e0b'}
  ];
  var ftTotal = fts.length||1;
  var ftBars = ftDurumlar.map(function(d){
    var cnt = fts.filter(function(f){return f.durum===d.l;}).length;
    return cnt>0 ? _barRow(d.l, cnt, ftTotal, d.hex) : '';
  }).join('');

  var secEl = document.getElementById('db-secondary');
  if(secEl) secEl.innerHTML =
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:14px">'
      +'<div class="card">'
        +'<div class="card-header">'
          +'<span class="card-title">Sipariş Durumu</span>'
          +'<span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">'+sps.length+' toplam</span>'
        +'</div>'
        +'<div class="card-body">'+(spBars||'<div style="color:var(--text3);font-size:13px">Sipariş bulunamadı.</div>')+'</div>'
      +'</div>'
      +'<div class="card">'
        +'<div class="card-header">'
          +'<span class="card-title">Fatura Durumu</span>'
          +'<span style="font-size:10px;color:var(--text3);font-family:var(--font-mono)">'+fts.length+' toplam</span>'
        +'</div>'
        +'<div class="card-body">'+(ftBars||'<div style="color:var(--text3);font-size:13px">Fatura bulunamadı.</div>')+'</div>'
      +'</div>'
    +'</div>';

  if(typeof renderNotlar === 'function') renderNotlar();
}
