// ═══════════════════════════════════════════════════════
//  STOK YÖNETİM PORTALI
// ═══════════════════════════════════════════════════════

var STOK_KAT_DEFAULT = [
  {id:'idrar',  ad:'İdrar',       sheetBoyu:300, kesimBoleni:3, firePct:10},
  {id:'agiz',   ad:'Ağız Sıvısı', sheetBoyu:300, kesimBoleni:4, firePct:0},
  {id:'yuzey',  ad:'Yüzey / Toz', sheetBoyu:300, kesimBoleni:3, firePct:10}
];

// ─── Başlangıç / Helpers ─────────────────────────────────────────────────────

function stokInit(){
  if(!state.stokSettings){
    state.stokSettings={kategoriler:JSON.parse(JSON.stringify(STOK_KAT_DEFAULT)),parametreler:[],globalEsik:1,hamCikisPrefix:'HC',ticariCikisPrefix:'TC'};
  }
  if(!state.stokSettings.kategoriler) state.stokSettings.kategoriler=JSON.parse(JSON.stringify(STOK_KAT_DEFAULT));
  if(!state.stokSettings.parametreler) state.stokSettings.parametreler=[];
  if(state.stokSettings.globalEsik===undefined) state.stokSettings.globalEsik=1;
  if(!state.stokSettings.hamCikisPrefix) state.stokSettings.hamCikisPrefix='HC';
  if(!state.stokSettings.ticariCikisPrefix) state.stokSettings.ticariCikisPrefix='TC';
  if(!state.stokSettings.cikisNedenleri) state.stokSettings.cikisNedenleri=['Müşteri Siparişi','Demo / Numune','E-ticaret','İç Kullanım','İade','Diğer'];
  if(!state.hamStokGirisler)  state.hamStokGirisler=[];
  if(!state.hamStokLotlar)    state.hamStokLotlar=[];
  if(!state.hamStokCikislar)  state.hamStokCikislar=[];
  if(!state.bitmisStokGirisler) state.bitmisStokGirisler=[];
  if(!state.bitmisStokLotlar) state.bitmisStokLotlar=[];
  if(!state.bitmisCikislar)   state.bitmisCikislar=[];
}

// ─── Evrak No Üretici ────────────────────────────────────────────────────────

function nextHamCikisEvrak(){
  var prefix=state.stokSettings.hamCikisPrefix||'HC';
  var nums=(state.hamStokCikislar||[]).map(function(c){return parseInt((c.evrakNo||'').replace(prefix+'-',''))||0;});
  var next=nums.length?Math.max.apply(null,nums)+1:1;
  return prefix+'-'+String(next).padStart(5,'0');
}

function nextTicariCikisEvrak(){
  var prefix=state.stokSettings.ticariCikisPrefix||'TC';
  var nums=(state.bitmisCikislar||[]).map(function(c){return parseInt((c.evrakNo||'').replace(prefix+'-',''))||0;});
  var next=nums.length?Math.max.apply(null,nums)+1:1;
  return prefix+'-'+String(next).padStart(5,'0');
}

function stokKatList(){return (state.stokSettings&&state.stokSettings.kategoriler)||STOK_KAT_DEFAULT;}
function stokParamList(){return (state.stokSettings&&state.stokSettings.parametreler)||[];}
function stokKatById(id){return stokKatList().find(function(k){return k.id===id;});}

function stokSPS(kategoriId){
  var k=stokKatById(kategoriId);
  if(!k) return 90;
  return Math.round((k.sheetBoyu/k.kesimBoleni)*(1-k.firePct/100));
}

function stokMevcutSheet(lot){
  var sps=stokSPS(lot.kategoriId);
  return sps>0?Math.floor(lot.mevcutStrip/sps):0;
}

function stokToplam(parametreAd, kategoriId){
  // Strip toplamı, tüm cut-off'lar dahil
  return (state.hamStokLotlar||[]).filter(function(l){
    return l.parametreAd===parametreAd && l.kategoriId===kategoriId && l.mevcutStrip>0;
  }).reduce(function(a,l){return a+l.mevcutStrip;},0);
}

function stokKritikler(){
  stokInit();
  var sonuc=[];
  var params=stokParamList();
  var kats=stokKatList();
  var paramAdlar=[...new Set(params.filter(function(p){return p.aktif!==false;}).map(function(p){return p.kisaltma||p.ad;}))];
  paramAdlar.forEach(function(ad){
    kats.forEach(function(kat){
      var lots=(state.hamStokLotlar||[]).filter(function(l){return l.parametreAd===ad&&l.kategoriId===kat.id;});
      if(!lots.length) return;
      var toplamStrip=lots.reduce(function(a,l){return a+l.mevcutStrip;},0);
      var sps=stokSPS(kat.id);
      var sheetEq=sps>0?toplamStrip/sps:0;
      var esik=state.stokSettings.globalEsik||1;
      if(sheetEq<=esik){
        sonuc.push({ad:ad,kat:kat,toplamStrip:toplamStrip,sps:sps,sheetEq:sheetEq,esik:esik});
      }
    });
  });
  return sonuc;
}

function stokFmtN(n){return (n||0).toLocaleString('tr-TR');}
function stokToday(){return new Date().toISOString().slice(0,10);}
function stokEsc(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

function stokKatSelect(elId, selectedId){
  var el=document.getElementById(elId); if(!el)return;
  el.innerHTML=stokKatList().map(function(k){
    return '<option value="'+k.id+'"'+(k.id===selectedId?' selected':'')+'>'+k.ad+'</option>';
  }).join('');
}

function stokParamSelect(elId, selectedKisaltma){
  var el=document.getElementById(elId); if(!el)return;
  var params=stokParamList().filter(function(p){return p.aktif!==false;});
  el.innerHTML='<option value="">Seçin...</option>'+params.map(function(p){
    var k=p.kisaltma||p.ad;
    var label=k+(p.ad&&p.ad!==k?' — '+p.ad:'');
    return '<option value="'+stokEsc(k)+'"'+(k===selectedKisaltma?' selected':'')+'>'+stokEsc(label)+'</option>';
  }).join('');
}

function stokBadge(toplamStrip, sps, esik){
  var sheetEq=sps>0?toplamStrip/sps:0;
  if(sheetEq<=esik) return '<span class="badge badge-reddedildi">Kritik</span>';
  if(sheetEq<=esik*3) return '<span class="badge badge-sf">Düşük</span>';
  return '<span class="badge badge-teslim">Yeterli</span>';
}

function stokFmtSkt(skt){
  // YYYY-MM → MM.YYYY görünümü
  if(!skt) return '—';
  var p=skt.split('-');
  return p.length>=2?p[1]+'.'+p[0]:skt;
}

function stokSktInfo(skt){
  // skt: "YYYY-MM" formatında
  if(!skt) return {renk:'var(--text3)',etiket:'',doldu:false};
  var nowYM=new Date().toISOString().slice(0,7); // "YYYY-MM"
  if(skt<nowYM) return {renk:'var(--red)',etiket:'Doldu',doldu:true};
  var d3=new Date(); d3.setMonth(d3.getMonth()+3);
  if(skt<=d3.toISOString().slice(0,7)) return {renk:'var(--amber)',etiket:'Yaklaşıyor',doldu:false};
  return {renk:'var(--text2)',etiket:'',doldu:false};
}

// ─── DASHBOARD ───────────────────────────────────────────────────────────────

function renderStokDashboard(){
  stokInit();
  var ham=state.hamStokLotlar||[];
  var hamC=state.hamStokCikislar||[];
  var bit=state.bitmisStokLotlar||[];
  var bitC=state.bitmisCikislar||[];
  var kritikler=stokKritikler();
  var buAy=stokToday().slice(0,7);

  var bugToplam=ham.reduce(function(a,l){return a+l.mevcutStrip;},0);
  var buAyGiris=ham.filter(function(l){return (l.tarih||'').slice(0,7)===buAy;}).length;
  var buAyCikis=hamC.filter(function(c){return (c.tarih||'').slice(0,7)===buAy;}).length;
  var bitMevcut=bit.reduce(function(a,l){return a+l.mevcutMiktar;},0);

  var kpiEl=document.getElementById('stok-kpi-grid');
  if(kpiEl) kpiEl.innerHTML=[
    {label:'Kritik Stok',    val:kritikler.length,  sub:'Uyarı eşiğinde parametre',          col:'var(--red)'},
    {label:'Toplam Strip',   val:stokFmtN(bugToplam), sub:'Tüm LOT\'larda mevcut',           col:'var(--accent)'},
    {label:'Bu Ay Giriş',    val:buAyGiris,          sub:buAy+' tarihli sheet girişleri',     col:'var(--teal)'},
    {label:'Bitmiş Mevcut',  val:stokFmtN(bitMevcut),sub:'Hazır kit toplamı',                col:'var(--green)'}
  ].map(function(k){
    return '<div style="background:var(--bg2);border:1px solid var(--border);border-top:3px solid '+k.col+';border-radius:var(--radius);padding:16px 18px;box-shadow:var(--shadow-sm)">'
      +'<div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.08em;font-weight:600;margin-bottom:11px">'+k.label+'</div>'
      +'<div style="font-size:30px;font-weight:700;font-family:var(--font-mono);line-height:1;color:'+k.col+'">'+k.val+'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:8px">'+k.sub+'</div>'
      +'</div>';
  }).join('');

  var sayEl=document.getElementById('stok-kritik-say');
  if(sayEl) sayEl.textContent=kritikler.length?kritikler.length+' uyarı':'';

  var kritikEl=document.getElementById('stok-kritik-list');
  if(kritikEl){
    if(!kritikler.length){
      kritikEl.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Kritik stok yok.</div>';
    } else {
      kritikEl.innerHTML=kritikler.map(function(k){
        return '<div style="padding:10px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">'
          +'<div style="flex:1">'
            +'<div style="font-size:13px;font-weight:500;color:var(--text)">'+stokEsc(k.ad)+' <span style="color:var(--text3);font-size:11px">('+stokEsc(k.kat.ad)+')</span></div>'
            +'<div style="font-size:11px;color:var(--text3);font-family:var(--font-mono);margin-top:2px">'+stokFmtN(k.toplamStrip)+' strip ≈ '+k.sheetEq.toFixed(1)+' sheet</div>'
          +'</div>'
          +'<span class="badge badge-reddedildi">Kritik</span>'
          +'</div>';
      }).join('');
    }
  }

  // Son hareketler (birleşik)
  var hareketler=[];
  (state.hamStokLotlar||[]).slice(-5).forEach(function(l){hareketler.push({tarih:l.tarih,tip:'ham-giris',aciklama:stokEsc(l.parametreAd)+(l.cutoff?' '+stokEsc(l.cutoff):'')+'  ('+stokEsc((stokKatById(l.kategoriId)||{}).ad||l.kategoriId)+')',detay:l.sheetGiren+' sheet / '+stokFmtN(l.stripGiren)+' strip',lot:l.lotNo});});
  (state.hamStokCikislar||[]).slice(-5).forEach(function(c){hareketler.push({tarih:c.tarih,tip:'ham-cikis',aciklama:stokEsc(c.aciklama||''),detay:c.kitMiktari+' kit',lot:''});});
  (state.bitmisStokLotlar||[]).slice(-5).forEach(function(l){hareketler.push({tarih:l.tarih,tip:'bitmis-giris',aciklama:stokEsc(l.urunAdi),detay:stokFmtN(l.miktar)+' adet',lot:l.lotNo});});
  (state.bitmisCikislar||[]).slice(-5).forEach(function(c){hareketler.push({tarih:c.tarih,tip:'bitmis-cikis',aciklama:stokEsc(c.aciklama||''),detay:'',lot:''});});
  hareketler.sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
  hareketler=hareketler.slice(0,8);

  var TIP_LABELS={'ham-giris':'Ham Giriş','ham-cikis':'Ham Çıkış','bitmis-giris':'Bit. Giriş','bitmis-cikis':'Bit. Çıkış'};
  var TIP_COLORS={'ham-giris':'var(--teal)','ham-cikis':'var(--amber)','bitmis-giris':'var(--green)','bitmis-cikis':'var(--red)'};
  var sonEl=document.getElementById('stok-son-hareket');
  if(sonEl){
    if(!hareketler.length){
      sonEl.innerHTML='<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Hareket bulunamadı.</div>';
    } else {
      sonEl.innerHTML=hareketler.map(function(h){
        return '<div style="padding:10px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px">'
          +'<span style="width:6px;height:6px;border-radius:50%;background:'+TIP_COLORS[h.tip]+';flex-shrink:0;display:inline-block"></span>'
          +'<div style="flex:1;min-width:0">'
            +'<div style="font-size:12px;font-weight:500;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+h.aciklama+'</div>'
            +'<div style="font-size:10px;color:var(--text3);margin-top:1px">'+stokEsc(TIP_LABELS[h.tip]||h.tip)+(h.lot?' · '+stokEsc(h.lot):'')+'</div>'
          +'</div>'
          +'<div style="font-size:11px;color:var(--text3);font-family:var(--font-mono);white-space:nowrap">'+stokEsc(h.tarih||'')+'</div>'
          +'</div>';
      }).join('');
    }
  }
}

// ─── Pagination & Tab Değişkenleri ───────────────────────────────────────────
var _hamStokPage=1;        var _hamStokTab='aktif';
var _hamGirislerPage=1;
var _hamCikislarPage=1;
var _bitmisStokPage=1;     var _bitmisStokTab='aktif';
var _bitmisGirislerPage=1;
var _bitmisCikislarPage=1;
var _stokHareketPage=1;
var _stokParamPage=1;

function switchHamStokTab(t){_hamStokTab=t;_hamStokPage=1;renderHamStok();}
function switchBitmisStokTab(t){_bitmisStokTab=t;_bitmisStokPage=1;renderBitmisStok();}

// Çıkış Nedeni select doldurma
function stokNedenSelect(elId){
  var el=document.getElementById(elId); if(!el) return;
  var nedenleri=(state.stokSettings&&state.stokSettings.cikisNedenleri)||[];
  el.innerHTML='<option value="">Seçin...</option>'+nedenleri.map(function(n){return '<option value="'+stokEsc(n)+'">'+stokEsc(n)+'</option>';}).join('');
}

// ─── HAM STOK GÖRÜNÜMÜ (Accordion) ──────────────────────────────────────────

var _expandedParams=new Set();

function toggleHamStokParam(paramAd){
  if(_expandedParams.has(paramAd)) _expandedParams.delete(paramAd);
  else _expandedParams.add(paramAd);
  renderHamStok();
}

function renderHamStok(){
  stokInit();
  var fKat=(document.getElementById('hs-f-kat')||{}).value||'';
  var fParam=(document.getElementById('hs-f-param')||{}).value||'';
  var fKritik=(document.getElementById('hs-f-kritik')||{}).checked||false;

  var katSel=document.getElementById('hs-f-kat');
  if(katSel){var cv=katSel.value;katSel.innerHTML='<option value="">Tüm Kategoriler</option>'+stokKatList().map(function(k){return '<option value="'+k.id+'">'+k.ad+'</option>';}).join('');katSel.value=cv;}
  var paramSel=document.getElementById('hs-f-param');
  if(paramSel){var pv=paramSel.value;var pAdlar=[...new Set(stokParamList().map(function(p){return p.kisaltma||p.ad;}))].sort();paramSel.innerHTML='<option value="">Tüm Parametreler</option>'+pAdlar.map(function(a){return '<option value="'+stokEsc(a)+'">'+stokEsc(a)+'</option>';}).join('');paramSel.value=pv;}

  var kritikSet=new Set(stokKritikler().map(function(k){return k.ad+'|'+k.kat.id;}));
  var allLots=(state.hamStokLotlar||[]).filter(function(l){
    if(fKat&&l.kategoriId!==fKat) return false;
    if(fParam&&l.parametreAd!==fParam) return false;
    if(fKritik&&!kritikSet.has(l.parametreAd+'|'+l.kategoriId)) return false;
    return true;
  });

  // Sekme sayaçlarını güncelle
  var aktifCount=allLots.filter(function(l){return l.mevcutStrip>0;}).length>0?(function(){var pg={};allLots.filter(function(l){return l.mevcutStrip>0;}).forEach(function(l){pg[l.parametreAd+'|'+l.kategoriId]=1;});return Object.keys(pg).length;})():0;
  var arsivCount=(function(){var pg={};allLots.filter(function(l){return l.mevcutStrip===0;}).forEach(function(l){pg[l.parametreAd+'|'+l.kategoriId+l.lotNo]=1;});return Object.keys(pg).length;})();
  var tabAktif=document.getElementById('tab-hamstok-aktif'); if(tabAktif){tabAktif.className='servis-tab'+(_hamStokTab==='aktif'?' active':'');var ac=document.getElementById('tab-hamstok-aktif-count');if(ac)ac.textContent=aktifCount;}
  var tabArsiv=document.getElementById('tab-hamstok-arsiv'); if(tabArsiv){tabArsiv.className='servis-tab'+(_hamStokTab==='arsiv'?' active':'');var arc=document.getElementById('tab-hamstok-arsiv-count');if(arc)arc.textContent=arsivCount;}

  // Sekmeye göre filtrele
  var lots = _hamStokTab==='arsiv'
    ? allLots.filter(function(l){return l.mevcutStrip===0;})
    : allLots; // aktif sekmede tüm lot'lar gösteriliyor (parametre grup bazlı)

  var wrap=document.getElementById('ham-stok-wrap'); if(!wrap)return;
  if(!lots.length){
    wrap.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">'+(_hamStokTab==='arsiv'?'Tükenmiş stok yok.':'Ham stok kaydı bulunamadı.')+'</div>';
    var pg2=document.getElementById('ham-stok-pagination'); if(pg2)pg2.innerHTML='';
    return;
  }

  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var paramObjs={};
  stokParamList().forEach(function(p){paramObjs[p.kisaltma||p.ad]=p;});

  // Gruplama: parametreAd → { katId → [lots] }
  var paramGroups={};
  lots.forEach(function(l){
    if(!paramGroups[l.parametreAd]) paramGroups[l.parametreAd]={};
    if(!paramGroups[l.parametreAd][l.kategoriId]) paramGroups[l.parametreAd][l.kategoriId]=[];
    paramGroups[l.parametreAd][l.kategoriId].push(l);
  });

  var allKats=stokKatList();

  // ─ Accordion header tablosu
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th style="width:28px"></th>'
    +'<th>Parametre</th>'
    +'<th style="width:60px;text-align:center">LOT</th>'
    +'<th>Kategori Özeti</th>'
    +'<th style="width:90px">Durum</th>'
    +'</tr></thead><tbody>';

  Object.keys(paramGroups).sort().forEach(function(paramAd){
    var pObj=paramObjs[paramAd]||{};
    var kisaltma=pObj.kisaltma||paramAd;
    var tamAd=pObj.ad&&pObj.ad!==kisaltma?pObj.ad+' ('+kisaltma+')':kisaltma;
    var katMap=paramGroups[paramAd];
    var kats=allKats.filter(function(k){return katMap[k.id]&&katMap[k.id].length>0;});
    var totalLots=kats.reduce(function(a,k){return a+(katMap[k.id]||[]).length;},0);
    var expanded=_expandedParams.has(paramAd);

    // Kategori özeti: "İdrar: 2160 str • Ağız: 225 str"
    var ozetParts=kats.map(function(kat){
      var topStrip=(katMap[kat.id]||[]).reduce(function(a,l){return a+l.mevcutStrip;},0);
      var sps=stokSPS(kat.id);
      return stokEsc(kat.ad)+': <b>'+stokFmtN(Math.floor(topStrip/sps))+'</b> sh / <b>'+stokFmtN(topStrip)+'</b> str';
    });

    // Genel durum = en kötü kategori durumu
    var enKotu='teslim'; // green = yeterli
    kats.forEach(function(kat){
      var topStrip=(katMap[kat.id]||[]).reduce(function(a,l){return a+l.mevcutStrip;},0);
      var sps=stokSPS(kat.id);
      var esik=state.stokSettings.globalEsik||1;
      var sheetEq=sps>0?topStrip/sps:0;
      if(sheetEq<=esik) enKotu='reddedildi';
      else if(sheetEq<=esik*3&&enKotu!=='reddedildi') enKotu='sf';
    });
    var durumBadgeHtml={
      'reddedildi':'<span class="badge badge-reddedildi">Kritik</span>',
      'sf':'<span class="badge badge-sf">Düşük</span>',
      'teslim':'<span class="badge badge-teslim">Yeterli</span>'
    }[enKotu];

    // Header satırı
    html+='<tr style="cursor:pointer;background:var(--bg3);border-bottom:1px solid var(--border)" onclick="toggleHamStokParam(\''+paramAd.replace(/'/g,"\\'")+'\')">'
      +'<td style="text-align:center;color:var(--accent);font-size:13px;font-weight:700">'+(expanded?'▼':'▶')+'</td>'
      +'<td style="font-weight:600;color:var(--text)">'+stokEsc(tamAd)+'</td>'
      +'<td style="text-align:center;font-family:var(--font-mono);color:var(--text3)">'+totalLots+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+ozetParts.join(' &nbsp;•&nbsp; ')+'</td>'
      +'<td>'+durumBadgeHtml+'</td>'
      +'</tr>';

    // Accordion içerik satırı
    if(expanded){
      // İçerideki sub-tablo
      var subHtml='<table class="compact-table" style="width:100%;margin:0">'
        +'<thead><tr style="background:var(--bg4)">'
        +'<th>Kategori</th><th>Cut-off</th><th>LOT No</th>'
        +'<th style="text-align:right">Mevcut Sheet</th><th style="text-align:right">Mevcut Strip</th>'
        +'<th>SKT</th><th>Giriş Tarihi</th><th>Durum</th><th></th>'
        +'</tr></thead><tbody>';

      kats.forEach(function(kat){
        var katLots=(katMap[kat.id]||[]).slice().sort(function(a,b){
          var co=(parseFloat(b.cutoff)||0)-(parseFloat(a.cutoff)||0);
          return co!==0?co:(a.tarih||'').localeCompare(b.tarih||'');
        });
        var katFirstRow=true;
        katLots.forEach(function(lot){
          var ms=stokMevcutSheet(lot);
          var skt=stokSktInfo(lot.sktTarih);
          var sps=stokSPS(lot.kategoriId);
          var esik=state.stokSettings.globalEsik||1;
          var durum=lot.mevcutStrip===0
            ?'<span class="badge" style="background:var(--bg4);color:var(--text3)">Tükendi</span>'
            :skt.doldu?'<span class="badge badge-reddedildi">SKT Geçti</span>'
            :stokBadge(lot.mevcutStrip,sps,esik);

          subHtml+='<tr style="opacity:'+(lot.mevcutStrip===0?'.5':'1')+'">';
          if(katFirstRow){
            subHtml+='<td rowspan="'+katLots.length+'" style="vertical-align:middle;font-weight:500;color:var(--text2);border-right:1px solid var(--border);font-size:11px">'+stokEsc(kat.ad)+'</td>';
            katFirstRow=false;
          }
          subHtml+='<td style="font-family:var(--font-mono)">'+stokEsc(lot.cutoff||'—')+'</td>'
            +'<td><span class="kn-badge">'+stokEsc(lot.lotNo)+'</span></td>'
            +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(ms)+'</td>'
            +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(lot.mevcutStrip)+'</td>'
            +'<td style="font-family:var(--font-mono);font-size:11px;color:'+skt.renk+'">'+stokFmtSkt(lot.sktTarih)+(skt.etiket?' ('+skt.etiket+')':'')+'</td>'
            +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(lot.tarih||'')+'</td>'
            +'<td>'+durum+'</td>'
            +'<td><div class="action-row">'
              +(canWrite?'<button class="btn-icon" title="Düzenle" onclick="event.stopPropagation();goHamGirisEdit(\''+lot.girisId+'\')">✏</button>':'')
              +(canWrite?'<button class="btn-icon" style="color:var(--red)" title="Sil" onclick="event.stopPropagation();stokSilHamLot(\''+lot.id+'\')">⊗</button>':'')
            +'</div></td>'
            +'</tr>';
        });
      });

      subHtml+='</tbody></table>';
      html+='<tr style="border-bottom:2px solid var(--border2)">'
        +'<td colspan="5" style="padding:0 0 8px 32px;background:var(--bg)">'+subHtml+'</td>'
        +'</tr>';
    }
  });

  wrap.innerHTML=html+'</tbody></table></div>';
  var pgEl=document.getElementById('ham-stok-pagination');
  if(pgEl) renderPagination('ham-stok-pagination',_hamStokPage,Object.keys(paramGroups).length,'setHamStokPage');
}
function setHamStokPage(p){_hamStokPage=p;renderHamStok();}

// ─── HAM STOK GİRİŞLER LİSTESİ (Accordion) ──────────────────────────────────

var _expandedHamGirisler=new Set();
function toggleHamGiris(id){if(_expandedHamGirisler.has(id))_expandedHamGirisler.delete(id);else _expandedHamGirisler.add(id);renderHamGirisler();}

function renderHamGirisler(){
  stokInit();
  var fAra=((document.getElementById('hgl-arama')||{}).value||'').toLowerCase();
  var fTs=(document.getElementById('hgl-ts')||{}).value||'';
  var fTe=(document.getElementById('hgl-te')||{}).value||'';
  var girisler=(state.hamStokGirisler||[]).filter(function(g){
    if(fTs&&(g.tarih||'')<fTs) return false;
    if(fTe&&(g.tarih||'')>fTe) return false;
    if(fAra){var hay=(g.evrakNo+g.tarih+(g.notlar||'')+(g.kalemler||[]).map(function(k){return k.lotNo+k.parametreAd+k.cutoff;}).join(' ')).toLowerCase();if(!hay.includes(fAra))return false;}
    return true;
  }).sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
  var wrap=document.getElementById('ham-girisler-wrap'); if(!wrap) return;
  if(!girisler.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Stok girişi bulunamadı.</div>';renderPagination('ham-girisler-pagination',1,0,'setHamGirislerPage');return;}
  var totalHG=girisler.length;
  girisler=girisler.slice((_hamGirislerPage-1)*PAGE_SIZE,_hamGirislerPage*PAGE_SIZE);
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th style="width:28px"></th><th>Evrak No</th><th>Tarih</th><th style="width:50px;text-align:center">Kalem</th>'
    +'<th>Parametreler Özeti</th><th>Notlar</th><th></th>'
    +'</tr></thead><tbody>';
  girisler.forEach(function(g){
    var expanded=_expandedHamGirisler.has(g.id);
    var kalemStr=(g.kalemler||[]).map(function(k){return k.parametreAd+(k.cutoff?' ('+k.cutoff+')':'');}).join(' • ');
    var katStr=[...new Set((g.kalemler||[]).map(function(k){return (stokKatById(k.kategoriId)||{}).ad||k.kategoriId;}))].join(', ');
    // Header satır
    html+='<tr style="cursor:pointer;background:var(--bg3)" onclick="toggleHamGiris(\''+g.id+'\')">'
      +'<td style="text-align:center;color:var(--accent);font-weight:700">'+(expanded?'▼':'▶')+'</td>'
      +'<td><span class="kn-badge">'+stokEsc(g.evrakNo)+'</span></td>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+stokEsc(g.tarih)+'</td>'
      +'<td style="text-align:center;font-family:var(--font-mono);color:var(--text3)">'+((g.kalemler||[]).length)+'</td>'
      +'<td style="font-size:12px;color:var(--text2)">'+stokEsc(kalemStr)+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(g.notlar||'')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" onclick="event.stopPropagation();goHamGirisEdit(\''+g.id+'\')">✏</button>':'')
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" onclick="event.stopPropagation();stokSilHamGiris(\''+g.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
    // Accordion detay
    if(expanded){
      var subHtml='<table class="compact-table" style="width:100%;margin:0"><thead><tr style="background:var(--bg4)">'
        +'<th>Kategori</th><th>Parametre</th><th>Cut-off</th><th>LOT No</th>'
        +'<th style="text-align:right">Sheet</th><th style="text-align:right">Strip</th><th>SKT</th>'
        +'</tr></thead><tbody>';
      (g.kalemler||[]).forEach(function(k){
        var kat=(stokKatById(k.kategoriId)||{}).ad||k.kategoriId;
        var sps=stokSPS(k.kategoriId);
        subHtml+='<tr>'
          +'<td style="font-size:11px">'+stokEsc(kat)+'</td>'
          +'<td style="font-weight:500">'+stokEsc(k.parametreAd)+'</td>'
          +'<td style="font-family:var(--font-mono)">'+stokEsc(k.cutoff||'—')+'</td>'
          +'<td><span class="kn-badge">'+stokEsc(k.lotNo)+'</span></td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(k.sheetGiren)+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(k.stripGiren)+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:11px">'+stokFmtSkt(k.sktTarih)+'</td>'
          +'</tr>';
      });
      subHtml+='</tbody></table>';
      html+='<tr style="border-bottom:2px solid var(--border2)">'
        +'<td colspan="7" style="padding:0 0 8px 32px;background:var(--bg)">'+subHtml+'</td>'
        +'</tr>';
    }
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('ham-girisler-pagination',_hamGirislerPage,totalHG,'setHamGirislerPage');
}
function setHamGirislerPage(p){_hamGirislerPage=p;renderHamGirisler();}

function goHamGirisYeni(){
  if(document.getElementById('hg-edit-id')) document.getElementById('hg-edit-id').value='';
  showPage('ham-giris');
}

function goHamGirisEdit(id){
  if(document.getElementById('hg-edit-id')) document.getElementById('hg-edit-id').value=id;
  showPage('ham-giris');
}

function stokSilHamGiris(id){
  if(!confirm('Bu giriş belgesi ve tüm LOT kayıtları silinecek. Emin misiniz?')) return;
  // İlişkili lotları da sil
  state.hamStokLotlar=(state.hamStokLotlar||[]).filter(function(l){return l.girisId!==id;});
  state.hamStokGirisler=(state.hamStokGirisler||[]).filter(function(g){return g.id!==id;});
  saveAll(); renderHamGirisler(); toast('Giriş belgesi silindi.','info');
}

function stokSilHamLot(id){
  if(!confirm('Bu LOT kaydını silmek istiyor musunuz?')) return;
  state.hamStokLotlar=(state.hamStokLotlar||[]).filter(function(l){return l.id!==id;});
  saveAll(); renderHamStok(); toast('Silindi.','info');
}

// ─── HAM STOK GİRİŞ FORMU (çok kalemli) ─────────────────────────────────────

var _hgKalemler=[];
var _hgEditGirisId=null;

function renderHamGirisForm(){
  stokInit();
  var editId=(document.getElementById('hg-edit-id')||{}).value||'';
  _hgEditGirisId=editId||null;
  var titleEl=document.getElementById('hg-form-title');
  if(titleEl) titleEl.textContent=_hgEditGirisId?'Stok Girişi Düzenle':'Yeni Stok Girişi';

  if(_hgEditGirisId){
    var g=(state.hamStokGirisler||[]).find(function(x){return x.id===_hgEditGirisId;});
    if(g){
      if(document.getElementById('hg-evrak')) document.getElementById('hg-evrak').value=g.evrakNo||'';
      if(document.getElementById('hg-tarih')) document.getElementById('hg-tarih').value=g.tarih||'';
      if(document.getElementById('hg-notlar')) document.getElementById('hg-notlar').value=g.notlar||'';
      _hgKalemler=(g.kalemler||[]).map(function(k){return Object.assign({},k);});
      hgRenderKalemler();
      return;
    }
  }
  _hgKalemler=[];
  if(document.getElementById('hg-evrak')) document.getElementById('hg-evrak').value='';
  var tarihEl=document.getElementById('hg-tarih');
  if(tarihEl) tarihEl.value=stokToday();
  if(document.getElementById('hg-notlar')) document.getElementById('hg-notlar').value='';
  hgRenderKalemler();
}

function hgAddKalem(){
  _hgKalemler.push({kategoriId:'',parametreAd:'',cutoff:'',lotNo:'',sheetMiktar:0,sktTarih:''});
  hgRenderKalemler();
}

function hgRemoveKalem(i){_hgKalemler.splice(i,1);hgRenderKalemler();}

function hgRenderKalemler(){
  var el=document.getElementById('hg-kalemler'); if(!el) return;
  if(!_hgKalemler.length){
    el.innerHTML='<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">+ Kalem Ekle butonuyla satır ekleyin.</div>';
    return;
  }
  var katOptions='<option value="">Seçin...</option>'+stokKatList().map(function(k){return '<option value="'+k.id+'">'+k.ad+'</option>';}).join('');
  var paramOptions='<option value="">Seçin...</option>'+stokParamList().filter(function(p){return p.aktif!==false;}).map(function(p){var k=p.kisaltma||p.ad;return '<option value="'+stokEsc(k)+'">'+stokEsc(k+(p.ad&&p.ad!==k?' — '+p.ad:''))+'</option>';}).join('');

  el.innerHTML=_hgKalemler.map(function(k,i){
    var sps=k.kategoriId?stokSPS(k.kategoriId):0;
    var prevTxt=k.sheetMiktar&&sps?(k.sheetMiktar+' × '+sps+' = '+stokFmtN(k.sheetMiktar*sps)+' strip'):'—';
    var katOpts=stokKatList().map(function(kat){return '<option value="'+kat.id+'"'+(k.kategoriId===kat.id?' selected':'')+'>'+kat.ad+'</option>';}).join('');
    var paramOpts=stokParamList().filter(function(p){return p.aktif!==false;}).map(function(p){var kk=p.kisaltma||p.ad;return '<option value="'+stokEsc(kk)+'"'+(k.parametreAd===kk?' selected':'')+'>'+stokEsc(kk+(p.ad&&p.ad!==kk?' — '+p.ad:''))+'</option>';}).join('');
    return '<div style="display:grid;grid-template-columns:130px 150px 100px 130px 80px 120px 1fr auto;gap:8px;align-items:end;padding:10px 12px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:8px">'
      +'<div class="field" style="margin:0"><label style="font-size:10px">Kategori *</label><select onchange="_hgKalemler['+i+'].kategoriId=this.value;hgRenderKalemler()"><option value="">Seçin...</option>'+katOpts+'</select></div>'
      +'<div class="field" style="margin:0"><label style="font-size:10px">Parametre *</label><select onchange="_hgKalemler['+i+'].parametreAd=this.value"><option value="">Seçin...</option>'+paramOpts+'</select></div>'
      +'<div class="field" style="margin:0"><label style="font-size:10px">Cut-off</label><input type="text" value="'+stokEsc(k.cutoff||'')+'" placeholder="ör. 500" onchange="_hgKalemler['+i+'].cutoff=this.value.trim()"></div>'
      +'<div class="field" style="margin:0"><label style="font-size:10px">LOT No *</label><input type="text" value="'+stokEsc(k.lotNo||'')+'" placeholder="ör. LOT-001" onchange="_hgKalemler['+i+'].lotNo=this.value.trim()"></div>'
      +'<div class="field" style="margin:0"><label style="font-size:10px">Sheet *</label><input type="number" min="1" value="'+(k.sheetMiktar||'')+'" onchange="_hgKalemler['+i+'].sheetMiktar=parseInt(this.value)||0;hgRenderKalemler()"></div>'
      +'<div class="field" style="margin:0"><label style="font-size:10px">SKT (AA.YYYY)</label><input type="month" value="'+stokEsc(k.sktTarih||'')+'" onchange="_hgKalemler['+i+'].sktTarih=this.value"></div>'
      +'<div style="font-family:var(--font-mono);font-size:11px;color:var(--teal);padding-bottom:4px;white-space:nowrap">'+prevTxt+'</div>'
      +'<button class="btn-icon" style="color:var(--red);margin-bottom:2px" onclick="hgRemoveKalem('+i+')">⊗</button>'
      +'</div>';
  }).join('');
}

function saveHamGiris(){
  stokInit();
  var evrakNo=((document.getElementById('hg-evrak')||{}).value||'').trim();
  var tarih=(document.getElementById('hg-tarih')||{}).value;
  var notlar=((document.getElementById('hg-notlar')||{}).value||'').trim();
  if(!evrakNo) return toast('Evrak No zorunludur.','error');
  if(!tarih) return toast('Tarih zorunludur.','error');
  if(!_hgKalemler.length) return toast('En az bir kalem ekleyin.','error');
  for(var i=0;i<_hgKalemler.length;i++){
    var k=_hgKalemler[i];
    if(!k.kategoriId) return toast((i+1)+'. kalemde kategori seçilmedi.','error');
    if(!k.parametreAd) return toast((i+1)+'. kalemde parametre seçilmedi.','error');
    if(!k.lotNo) return toast((i+1)+'. kalemde LOT No girilmedi.','error');
    if(!k.sheetMiktar||k.sheetMiktar<1) return toast((i+1)+'. kalemde sheet miktarı geçersiz.','error');
  }
  var girisId=_hgEditGirisId||('hg'+Date.now());
  var kullanici=(state.currentUser&&state.currentUser.username)||'';
  var kalemlerSaved=_hgKalemler.map(function(k,i){
    var sps=stokSPS(k.kategoriId);
    var stripMiktar=k.sheetMiktar*sps;
    var lotId='hl'+Date.now()+i;
    return {lotId:lotId,lotNo:k.lotNo,parametreAd:k.parametreAd,cutoff:k.cutoff||'',kategoriId:k.kategoriId,sheetGiren:k.sheetMiktar,stripGiren:stripMiktar,sktTarih:k.sktTarih||''};
  });
  if(_hgEditGirisId){
    // Güncelleme: eski lotları sil, yenilerini ekle
    state.hamStokLotlar=(state.hamStokLotlar||[]).filter(function(l){return l.girisId!==_hgEditGirisId;});
    var gIdx=(state.hamStokGirisler||[]).findIndex(function(x){return x.id===_hgEditGirisId;});
    if(gIdx>=0){state.hamStokGirisler[gIdx].evrakNo=evrakNo;state.hamStokGirisler[gIdx].tarih=tarih;state.hamStokGirisler[gIdx].notlar=notlar;state.hamStokGirisler[gIdx].kalemler=kalemlerSaved;}
    toast('Giriş belgesi güncellendi.','success');
  } else {
    state.hamStokGirisler.push({id:girisId,evrakNo:evrakNo,tarih:tarih,notlar:notlar,kalemler:kalemlerSaved,olusturmaTarihi:new Date().toISOString(),olusturanKullanici:kullanici});
    toast('Stok girişi kaydedildi.','success');
  }
  // Lot kayıtlarını ekle
  kalemlerSaved.forEach(function(k){
    state.hamStokLotlar.push({id:k.lotId,girisId:girisId,evrakNo:evrakNo,lotNo:k.lotNo,tarih:tarih,parametreAd:k.parametreAd,cutoff:k.cutoff,kategoriId:k.kategoriId,sheetGiren:k.sheetGiren,stripGiren:k.stripGiren,mevcutStrip:k.stripGiren,sktTarih:k.sktTarih,olusturmaTarihi:new Date().toISOString(),olusturanKullanici:kullanici});
  });
  saveAll();
  if(document.getElementById('hg-edit-id')) document.getElementById('hg-edit-id').value='';
  showPage('ham-girisler');
}

// ─── HAM STOK ÇIKIŞLAR LİSTESİ ───────────────────────────────────────────────

var _expandedHamCikislar=new Set();
function toggleHamCikis(id){if(_expandedHamCikislar.has(id))_expandedHamCikislar.delete(id);else _expandedHamCikislar.add(id);renderHamCikislar();}

function renderHamCikislar(){
  stokInit();
  var fAra=((document.getElementById('hcl-arama')||{}).value||'').toLowerCase();
  var fTs=(document.getElementById('hcl-ts')||{}).value||'';
  var fTe=(document.getElementById('hcl-te')||{}).value||'';
  var cikislar=(state.hamStokCikislar||[]).filter(function(c){
    if(fTs&&(c.tarih||'')<fTs) return false;
    if(fTe&&(c.tarih||'')>fTe) return false;
    if(fAra&&!((c.evrakNo||'').toLowerCase()+' '+(c.aciklama||'').toLowerCase()+(c.satirlar||[]).map(function(s){return s.parametreAd;}).join(' ').toLowerCase()).includes(fAra)) return false;
    return true;
  }).sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
  var wrap=document.getElementById('ham-cikislar-wrap'); if(!wrap) return;
  if(!cikislar.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Stok çıkışı bulunamadı.</div>';renderPagination('ham-cikislar-pagination',1,0,'setHamCikislarPage');return;}
  var totalHC=cikislar.length;
  cikislar=cikislar.slice((_hamCikislarPage-1)*PAGE_SIZE,_hamCikislarPage*PAGE_SIZE);
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th style="width:28px"></th><th>Evrak No</th><th>Tarih</th><th>Kategori</th>'
    +'<th>Çıkış Nedeni</th><th style="width:50px;text-align:center">Kit</th><th>Parametreler Özeti</th><th></th>'
    +'</tr></thead><tbody>';
  cikislar.forEach(function(c){
    var expanded=_expandedHamCikislar.has(c.id);
    var kat=(stokKatById(c.kategoriId)||{}).ad||c.kategoriId||'';
    var params=(c.satirlar||[]).map(function(s){return s.parametreAd+(s.cutoff?' ('+s.cutoff+')':'');}).join(' • ');
    html+='<tr style="cursor:pointer;background:var(--bg3)" onclick="toggleHamCikis(\''+c.id+'\')">'
      +'<td style="text-align:center;color:var(--amber);font-weight:700">'+(expanded?'▼':'▶')+'</td>'
      +'<td><span class="kn-badge">'+stokEsc(c.evrakNo||'—')+'</span></td>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+stokEsc(c.tarih||'')+'</td>'
      +'<td style="font-size:12px">'+stokEsc(kat)+'</td>'
      +'<td style="font-size:12px">'+stokEsc(c.aciklama||'')+'</td>'
      +'<td style="text-align:center;font-family:var(--font-mono)">'+stokFmtN(c.kitMiktari)+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(params)+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" onclick="event.stopPropagation();stokSilHamCikis(\''+c.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
    if(expanded){
      var subHtml='<table class="compact-table" style="width:100%;margin:0"><thead><tr style="background:var(--bg4)">'
        +'<th>Parametre</th><th>Cut-off</th><th>LOT No</th><th style="text-align:right">Strip Çıkış</th>'
        +'</tr></thead><tbody>';
      (c.satirlar||[]).forEach(function(s){
        subHtml+='<tr>'
          +'<td style="font-weight:500">'+stokEsc(s.parametreAd)+'</td>'
          +'<td style="font-family:var(--font-mono)">'+stokEsc(s.cutoff||'—')+'</td>'
          +'<td><span class="kn-badge">'+stokEsc(s.lotNo)+'</span></td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(s.stripCikis)+'</td>'
          +'</tr>';
      });
      subHtml+='</tbody></table>';
      html+='<tr style="border-bottom:2px solid var(--border2)">'
        +'<td colspan="8" style="padding:0 0 8px 32px;background:var(--bg)">'+subHtml+'</td>'
        +'</tr>';
    }
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('ham-cikislar-pagination',_hamCikislarPage,totalHC,'setHamCikislarPage');
}
function setHamCikislarPage(p){_hamCikislarPage=p;renderHamCikislar();}

function goHamCikisYeni(){
  var evrak=nextHamCikisEvrak();
  if(document.getElementById('hc-evrak')) document.getElementById('hc-evrak').value=evrak;
  var dispEl=document.getElementById('hc-evrak-display');
  if(dispEl) dispEl.textContent='Evrak No: '+evrak;
  showPage('ham-cikis');
}

function stokSilHamCikis(id){
  if(!confirm('Bu çıkış kaydı silinecek. Stok geri yüklenmeyecek. Emin misiniz?')) return;
  state.hamStokCikislar=(state.hamStokCikislar||[]).filter(function(c){return c.id!==id;});
  saveAll(); renderHamCikislar(); toast('Çıkış silindi.','info');
}

// ─── HAM STOK ÇIKIŞ FORMU ────────────────────────────────────────────────────

var _hcSatirlar=[];

function renderHamCikisForm(){
  stokInit();
  _hcSatirlar=[];
  // Evrak no göster
  var evrak=(document.getElementById('hc-evrak')||{}).value||nextHamCikisEvrak();
  if(document.getElementById('hc-evrak')) document.getElementById('hc-evrak').value=evrak;
  var dispEl=document.getElementById('hc-evrak-display');
  if(dispEl) dispEl.textContent='Evrak No: '+evrak;
  var tarihEl=document.getElementById('hc-tarih');
  if(tarihEl&&!tarihEl.value) tarihEl.value=stokToday();
  if(document.getElementById('hc-kit')) document.getElementById('hc-kit').value='';
  stokNedenSelect('hc-aciklama');
  if(document.getElementById('hc-notlar')) document.getElementById('hc-notlar').value='';
  stokKatSelect('hc-kategori','');
  hcRenderSatirlar();
}

function hcKategoriChange(){_hcSatirlar=[];hcRenderSatirlar();}

function hcAddSatir(){
  _hcSatirlar.push({paramKey:'',lotId:''});
  hcRenderSatirlar();
}

function hcRemoveSatir(idx){
  _hcSatirlar.splice(idx,1);
  hcRenderSatirlar();
}

function hcRenderSatirlar(){
  var katId=(document.getElementById('hc-kategori')||{}).value||'';
  var kitMiktar=parseInt((document.getElementById('hc-kit')||{}).value)||0;
  var el=document.getElementById('hc-satirlar'); if(!el) return;

  if(!_hcSatirlar.length){
    el.innerHTML='<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">Parametre ekleyin.</div>';
    return;
  }

  var params=stokParamList().filter(function(p){return p.aktif!==false;});
  var lots=(state.hamStokLotlar||[]).filter(function(l){return l.kategoriId===katId&&l.mevcutStrip>0;});

  el.innerHTML=_hcSatirlar.map(function(s,i){
    // Parametre dropdown (kisaltma değeri)
    var paramOptions=params.map(function(p){
      var k=p.kisaltma||p.ad;
      var label=k+(p.ad&&p.ad!==k?' — '+p.ad:'');
      return '<option value="'+stokEsc(k)+'"'+(s.paramKey===k?' selected':'')+'>'+stokEsc(label)+'</option>';
    }).join('');

    // LOT listesi: sadece kisaltma ile filtrele, cutoff bilgisini LOT'tan göster
    var filtLots=lots.filter(function(l){
      if(!s.paramKey) return true;
      return l.parametreAd===s.paramKey;
    });
    var lotOptions=filtLots.map(function(l){
      var ms=stokMevcutSheet(l);
      var cutoffInfo=l.cutoff?' (cut-off: '+l.cutoff+')':'';
      return '<option value="'+stokEsc(l.id)+'"'+(s.lotId===l.id?' selected':'')+'>'+stokEsc(l.lotNo+cutoffInfo)+' — '+stokFmtN(l.mevcutStrip)+' strip ('+ms+' sh)</option>';
    }).join('');
    if(!lotOptions) lotOptions='<option value="">— Mevcut LOT yok —</option>';

    var secilenLot=filtLots.find(function(l){return l.id===s.lotId;});
    var mevcutInfo=secilenLot?'Mevcut: '+stokFmtN(secilenLot.mevcutStrip)+' strip':'';

    return '<div style="display:grid;grid-template-columns:1fr 1fr auto;gap:10px;align-items:end;padding:12px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:8px">'
      +'<div class="field" style="margin:0"><label style="font-size:11px">Parametre</label>'
        +'<select onchange="hcParamChange('+i+',this.value)"><option value="">Seçin...</option>'+paramOptions+'</select></div>'
      +'<div class="field" style="margin:0"><label style="font-size:11px">LOT <span style="color:var(--text3);font-weight:400">'+stokEsc(mevcutInfo)+'</span></label>'
        +'<select onchange="hcLotChange('+i+',this.value)"><option value="">LOT Seçin...</option>'+lotOptions+'</select></div>'
      +'<button class="btn-icon" style="color:var(--red);margin-bottom:2px" onclick="hcRemoveSatir('+i+')">⊗</button>'
      +'</div>';
  }).join('');

  // Stok uyarı güncelle
  hcStokUyariGuncelle();
}

function hcParamChange(idx,val){_hcSatirlar[idx].paramKey=val;_hcSatirlar[idx].lotId='';hcRenderSatirlar();}
function hcLotChange(idx,val){_hcSatirlar[idx].lotId=val;hcRenderSatirlar();}
function hcUpdateStrips(){hcRenderSatirlar();}

function hcStokUyariGuncelle(){
  var kitMiktar=parseInt((document.getElementById('hc-kit')||{}).value)||0;
  var uyariEl=document.getElementById('hc-stok-uyari'); if(!uyariEl) return;
  var uyarilar=[];
  _hcSatirlar.forEach(function(s){
    if(!s.lotId) return;
    var lot=(state.hamStokLotlar||[]).find(function(l){return l.id===s.lotId;});
    if(lot&&kitMiktar>lot.mevcutStrip){
      uyarilar.push(stokEsc(lot.parametreAd)+(lot.cutoff?' ('+stokEsc(lot.cutoff)+')':'')+': '+stokFmtN(lot.mevcutStrip)+' strip mevcut, '+stokFmtN(kitMiktar)+' gerekli');
    }
  });
  if(uyarilar.length){
    uyariEl.style.display='';
    uyariEl.innerHTML='⚠ Yetersiz stok:<br>'+uyarilar.join('<br>');
  } else {
    uyariEl.style.display='none';
  }
}

function saveHamCikis(){
  stokInit();
  var tarih=(document.getElementById('hc-tarih')||{}).value;
  var katId=(document.getElementById('hc-kategori')||{}).value;
  var kitMiktar=parseInt((document.getElementById('hc-kit')||{}).value)||0;
  var aciklama=(document.getElementById('hc-aciklama')||{}).value.trim();
  var notlar=(document.getElementById('hc-notlar')||{}).value.trim();

  if(!tarih) return toast('Tarih zorunludur.','error');
  if(!katId) return toast('Kategori seçin.','error');
  if(kitMiktar<1) return toast('Kit miktarı geçerli olmalı.','error');
  if(!aciklama) return toast('Müşteri / Amaç zorunludur.','error');
  if(!_hcSatirlar.length) return toast('En az bir parametre satırı ekleyin.','error');

  var satirFinal=[];
  for(var i=0;i<_hcSatirlar.length;i++){
    var s=_hcSatirlar[i];
    if(!s.paramKey) return toast((i+1)+'. satırda parametre seçilmedi.','error');
    if(!s.lotId) return toast((i+1)+'. satırda LOT seçilmedi.','error');
    var lot=(state.hamStokLotlar||[]).find(function(l){return l.id===s.lotId;});
    if(!lot) return toast('Seçili LOT bulunamadı.','error');
    if(kitMiktar>lot.mevcutStrip) return toast(stokEsc(lot.parametreAd)+' için yeterli stok yok. Mevcut: '+stokFmtN(lot.mevcutStrip)+' strip.','error');
    satirFinal.push({lotId:lot.id,lotNo:lot.lotNo,parametreAd:s.paramKey,cutoff:lot.cutoff||'',kategoriId:katId,stripCikis:kitMiktar});
  }

  // Stoktan düş
  satirFinal.forEach(function(sf){
    var idx=(state.hamStokLotlar||[]).findIndex(function(l){return l.id===sf.lotId;});
    if(idx>=0) state.hamStokLotlar[idx].mevcutStrip-=sf.stripCikis;
  });

  var evrakNo=((document.getElementById('hc-evrak')||{}).value)||nextHamCikisEvrak();
  state.hamStokCikislar.push({
    id:'hc'+Date.now(),evrakNo:evrakNo,tarih:tarih,kategoriId:katId,
    kitMiktari:kitMiktar,aciklama:aciklama,notlar:notlar,
    satirlar:satirFinal,
    olusturmaTarihi:new Date().toISOString(),
    olusturanKullanici:(state.currentUser&&state.currentUser.username)||''
  });

  saveAll();
  toast(stokFmtN(kitMiktar)+' Kit çıkışı yapıldı ('+evrakNo+').','success');
  showPage('ham-cikislar');
}

// ─── BİTMİŞ STOK GÖRÜNÜMÜ ────────────────────────────────────────────────────

function renderBitmisStok(){
  stokInit();
  var fKat=(document.getElementById('bs-f-kat')||{}).value||'';
  var fAra=((document.getElementById('bs-f-arama')||{}).value||'').toLowerCase();

  var katSel=document.getElementById('bs-f-kat');
  if(katSel){var cv=katSel.value;katSel.innerHTML='<option value="">Tüm Kategoriler</option>'+stokKatList().map(function(k){return '<option value="'+k.id+'">'+k.ad+'</option>';}).join('');katSel.value=cv;}

  var allBL=(state.bitmisStokLotlar||[]).filter(function(l){
    if(fKat&&l.kategoriId!==fKat) return false;
    if(fAra&&!(l.urunAdi||'').toLowerCase().includes(fAra)&&!(l.lotNo||'').toLowerCase().includes(fAra)) return false;
    return true;
  });

  // Sekme sayaçları
  var bAktifC=allBL.filter(function(l){return l.mevcutMiktar>0;}).length;
  var bArsivC=allBL.filter(function(l){return l.mevcutMiktar===0;}).length;
  var tabBA=document.getElementById('tab-bitmis-aktif'); if(tabBA){tabBA.className='servis-tab'+(_bitmisStokTab==='aktif'?' active':'');var bac=document.getElementById('tab-bitmis-aktif-count');if(bac)bac.textContent=bAktifC;}
  var tabBAr=document.getElementById('tab-bitmis-arsiv'); if(tabBAr){tabBAr.className='servis-tab'+(_bitmisStokTab==='arsiv'?' active':'');var barc=document.getElementById('tab-bitmis-arsiv-count');if(barc)barc.textContent=bArsivC;}

  var lots=_bitmisStokTab==='arsiv'
    ? allBL.filter(function(l){return l.mevcutMiktar===0;})
    : allBL.filter(function(l){return l.mevcutMiktar>0;});
  lots=lots.slice().sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});

  var wrap=document.getElementById('bitmis-stok-wrap'); if(!wrap) return;
  if(!lots.length){
    wrap.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">'+(_bitmisStokTab==='arsiv'?'Tükenmiş ürün yok.':'Hazır ürün kaydı bulunamadı.')+'</div>';
    var bpg=document.getElementById('bitmis-stok-pagination');if(bpg)bpg.innerHTML=''; return;
  }
  var totalBS=lots.length;
  var pagedBL=lots.slice((_bitmisStokPage-1)*PAGE_SIZE,_bitmisStokPage*PAGE_SIZE);

  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr><th>Ürün Adı</th><th>LOT No</th><th>Kategori</th><th>Parametreler</th><th style="text-align:right">Giren</th><th style="text-align:right">Mevcut</th><th>Giriş Tarihi</th><th>SKT</th><th></th></tr></thead><tbody>';
  pagedBL.forEach(function(l){
    var kat=stokKatById(l.kategoriId)||{ad:l.kategoriId};
    var paramStr=(l.parametreler||[]).join(', ');
    var skt=stokSktInfo(l.sktTarih);
    html+='<tr>'
      +'<td style="font-weight:500">'+stokEsc(l.urunAdi||'—')+'</td>'
      +'<td><span class="kn-badge">'+stokEsc(l.lotNo)+'</span></td>'
      +'<td>'+stokEsc(kat.ad)+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(paramStr)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(l.miktar)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(l.mevcutMiktar)+'</td>'
      +'<td style="font-size:12px;color:var(--text3)">'+stokEsc(l.tarih||'')+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:12px;color:'+skt.renk+'">'+stokFmtSkt(l.sktTarih)+(skt.etiket?' ('+skt.etiket+')':'')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" onclick="goBitmisGirisEdit(\''+l.girisId+'\')">✏</button>':'')
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" onclick="stokSilBitmisLot(\''+l.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('bitmis-stok-pagination',_bitmisStokPage,totalBS,'setBitmisStokPage');
}
function setBitmisStokPage(p){_bitmisStokPage=p;renderBitmisStok();}

// ─── TİCARİ STOK GİRİŞLER LİSTESİ ───────────────────────────────────────────

var _expandedBitmisGirisler=new Set();
function toggleBitmisGiris(id){if(_expandedBitmisGirisler.has(id))_expandedBitmisGirisler.delete(id);else _expandedBitmisGirisler.add(id);renderBitmisGirisler();}

function renderBitmisGirisler(){
  stokInit();
  var fAra=((document.getElementById('bgl-arama')||{}).value||'').toLowerCase();
  var fTs=(document.getElementById('bgl-ts')||{}).value||'';
  var fTe=(document.getElementById('bgl-te')||{}).value||'';
  var girisler=(state.bitmisStokGirisler||[]).filter(function(g){
    if(fTs&&(g.tarih||'')<fTs) return false;
    if(fTe&&(g.tarih||'')>fTe) return false;
    if(fAra){var hay=(g.evrakNo+g.tarih+(g.notlar||'')+(g.kalemler||[]).map(function(k){return k.urunAdi+k.lotNo;}).join(' ')).toLowerCase();if(!hay.includes(fAra))return false;}
    return true;
  }).sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
  var wrap=document.getElementById('bitmis-girisler-wrap'); if(!wrap) return;
  if(!girisler.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Hazır ürün girişi bulunamadı.</div>';renderPagination('bitmis-girisler-pagination',1,0,'setBitmisGirislerPage');return;}
  var totalBG=girisler.length;
  girisler=girisler.slice((_bitmisGirislerPage-1)*PAGE_SIZE,_bitmisGirislerPage*PAGE_SIZE);
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th style="width:28px"></th><th>Evrak No</th><th>Tarih</th><th style="width:50px;text-align:center">Kalem</th>'
    +'<th>Ürünler Özeti</th><th>Notlar</th><th></th>'
    +'</tr></thead><tbody>';
  girisler.forEach(function(g){
    var expanded=_expandedBitmisGirisler.has(g.id);
    var urunStr=(g.kalemler||[]).map(function(k){return k.urunAdi;}).join(' • ');
    html+='<tr style="cursor:pointer;background:var(--bg3)" onclick="toggleBitmisGiris(\''+g.id+'\')">'
      +'<td style="text-align:center;color:var(--green);font-weight:700">'+(expanded?'▼':'▶')+'</td>'
      +'<td><span class="kn-badge">'+stokEsc(g.evrakNo)+'</span></td>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+stokEsc(g.tarih)+'</td>'
      +'<td style="text-align:center;font-family:var(--font-mono);color:var(--text3)">'+((g.kalemler||[]).length)+'</td>'
      +'<td style="font-size:12px;color:var(--text2)">'+stokEsc(urunStr)+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(g.notlar||'')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" onclick="event.stopPropagation();goBitmisGirisEdit(\''+g.id+'\')">✏</button>':'')
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" onclick="event.stopPropagation();stokSilBitmisGiris(\''+g.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
    if(expanded){
      var subHtml='<table class="compact-table" style="width:100%;margin:0"><thead><tr style="background:var(--bg4)">'
        +'<th>Ürün Adı</th><th>Kategori</th><th>LOT No</th><th style="text-align:right">Miktar</th><th>SKT</th><th>Parametreler</th>'
        +'</tr></thead><tbody>';
      (g.kalemler||[]).forEach(function(k){
        var kat=(stokKatById(k.kategoriId)||{}).ad||k.kategoriId;
        subHtml+='<tr>'
          +'<td style="font-weight:500">'+stokEsc(k.urunAdi)+'</td>'
          +'<td style="font-size:11px">'+stokEsc(kat)+'</td>'
          +'<td><span class="kn-badge">'+stokEsc(k.lotNo)+'</span></td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(k.miktar)+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:11px">'+stokFmtSkt(k.sktTarih)+'</td>'
          +'<td style="font-size:11px;color:var(--text3)">'+(k.parametreler||[]).join(', ')+'</td>'
          +'</tr>';
      });
      subHtml+='</tbody></table>';
      html+='<tr style="border-bottom:2px solid var(--border2)">'
        +'<td colspan="7" style="padding:0 0 8px 32px;background:var(--bg)">'+subHtml+'</td>'
        +'</tr>';
    }
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('bitmis-girisler-pagination',_bitmisGirislerPage,totalBG,'setBitmisGirislerPage');
}
function setBitmisGirislerPage(p){_bitmisGirislerPage=p;renderBitmisGirisler();}

function goBitmisGirisYeni(){
  if(document.getElementById('bg-edit-id')) document.getElementById('bg-edit-id').value='';
  showPage('bitmis-giris');
}

function goBitmisGirisEdit(id){
  if(document.getElementById('bg-edit-id')) document.getElementById('bg-edit-id').value=id;
  showPage('bitmis-giris');
}

function stokSilBitmisGiris(id){
  if(!confirm('Bu giriş belgesi ve LOT kayıtları silinecek. Emin misiniz?')) return;
  state.bitmisStokLotlar=(state.bitmisStokLotlar||[]).filter(function(l){return l.girisId!==id;});
  state.bitmisStokGirisler=(state.bitmisStokGirisler||[]).filter(function(g){return g.id!==id;});
  saveAll(); renderBitmisGirisler(); toast('Silindi.','info');
}

function stokSilBitmisLot(id){
  if(!confirm('Bu LOT kaydını silmek istiyor musunuz?')) return;
  state.bitmisStokLotlar=(state.bitmisStokLotlar||[]).filter(function(l){return l.id!==id;});
  saveAll(); renderBitmisStok(); toast('Silindi.','info');
}

// ─── TİCARİ STOK GİRİŞ FORMU (çok kalemli) ──────────────────────────────────

var _bgKalemler=[];
var _bgEditGirisId=null;

function renderBitmisGirisForm(){
  stokInit();
  var editId=(document.getElementById('bg-edit-id')||{}).value||'';
  _bgEditGirisId=editId||null;
  var titleEl=document.getElementById('bg-form-title');
  if(titleEl) titleEl.textContent=_bgEditGirisId?'Hazır Ürün Girişi Düzenle':'Yeni Hazır Ürün Girişi';

  if(_bgEditGirisId){
    var g=(state.bitmisStokGirisler||[]).find(function(x){return x.id===_bgEditGirisId;});
    if(g){
      if(document.getElementById('bg-evrak')) document.getElementById('bg-evrak').value=g.evrakNo||'';
      if(document.getElementById('bg-tarih')) document.getElementById('bg-tarih').value=g.tarih||'';
      if(document.getElementById('bg-notlar')) document.getElementById('bg-notlar').value=g.notlar||'';
      _bgKalemler=(g.kalemler||[]).map(function(k){return Object.assign({},k);});
      bgRenderKalemler();
      return;
    }
  }
  _bgKalemler=[];
  if(document.getElementById('bg-evrak')) document.getElementById('bg-evrak').value='';
  if(document.getElementById('bg-tarih')) document.getElementById('bg-tarih').value=stokToday();
  if(document.getElementById('bg-notlar')) document.getElementById('bg-notlar').value='';
  bgRenderKalemler();
}

function bgAddKalem(){
  _bgKalemler.push({lotNo:'',urunAdi:'',kategoriId:'',parametreler:[],miktar:0,sktTarih:''});
  bgRenderKalemler();
}

function bgRemoveKalem(i){_bgKalemler.splice(i,1);bgRenderKalemler();}

function bgRenderKalemler(){
  var el=document.getElementById('bg-kalemler'); if(!el) return;
  if(!_bgKalemler.length){
    el.innerHTML='<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">+ Kalem Ekle butonuyla satır ekleyin.</div>';
    return;
  }
  var paramAdlar=[...new Set(stokParamList().filter(function(p){return p.aktif!==false;}).map(function(p){return p.kisaltma||p.ad;}))].sort();
  el.innerHTML=_bgKalemler.map(function(k,i){
    var katOpts=stokKatList().map(function(kat){return '<option value="'+kat.id+'"'+(k.kategoriId===kat.id?' selected':'')+'>'+kat.ad+'</option>';}).join('');
    var paramCheckboxes=paramAdlar.map(function(ad){
      return '<label style="display:flex;align-items:center;gap:5px;font-size:11px;white-space:nowrap"><input type="checkbox" onchange="bgKalemParamToggle('+i+',\''+stokEsc(ad)+'\',this.checked)" '+(( k.parametreler||[]).includes(ad)?'checked':'')+'>'+stokEsc(ad)+'</label>';
    }).join('');
    return '<div style="padding:12px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:10px">'
      +'<div style="display:grid;grid-template-columns:130px 1fr 80px 120px auto;gap:8px;align-items:end;margin-bottom:8px">'
        +'<div class="field" style="margin:0"><label style="font-size:10px">Kategori *</label><select onchange="_bgKalemler['+i+'].kategoriId=this.value"><option value="">Seçin...</option>'+katOpts+'</select></div>'
        +'<div class="field" style="margin:0"><label style="font-size:10px">Ürün Adı *</label><input type="text" value="'+stokEsc(k.urunAdi||'')+'" placeholder="ör. 4\'lü İdrar Test Kiti" onchange="_bgKalemler['+i+'].urunAdi=this.value.trim()"></div>'
        +'<div class="field" style="margin:0"><label style="font-size:10px">Miktar *</label><input type="number" min="1" value="'+(k.miktar||'')+'" onchange="_bgKalemler['+i+'].miktar=parseInt(this.value)||0"></div>'
        +'<div class="field" style="margin:0"><label style="font-size:10px">LOT No *</label><input type="text" value="'+stokEsc(k.lotNo||'')+'" placeholder="ör. KLOT-001" onchange="_bgKalemler['+i+'].lotNo=this.value.trim()"></div>'
        +'<button class="btn-icon" style="color:var(--red);margin-bottom:2px" onclick="bgRemoveKalem('+i+')">⊗</button>'
      +'</div>'
      +'<div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">'
        +'<span style="font-size:10px;color:var(--text3);font-weight:500">SKT:</span>'
        +'<input type="month" value="'+stokEsc(k.sktTarih||'')+'" style="font-size:11px;padding:2px 6px;background:var(--bg4);border:1px solid var(--border);border-radius:4px;color:var(--text)" onchange="_bgKalemler['+i+'].sktTarih=this.value">'
        +'<span style="font-size:10px;color:var(--text3);font-weight:500;margin-left:8px">Parametreler:</span>'
        +paramCheckboxes
      +'</div>'
      +'</div>';
  }).join('');
}

function bgKalemParamToggle(i,ad,checked){
  if(!_bgKalemler[i].parametreler) _bgKalemler[i].parametreler=[];
  if(checked){if(!_bgKalemler[i].parametreler.includes(ad))_bgKalemler[i].parametreler.push(ad);}
  else{_bgKalemler[i].parametreler=_bgKalemler[i].parametreler.filter(function(p){return p!==ad;});}
}

function bgRenderParams(selected){} // eski tek-lot form - artık kullanılmıyor

function saveBitmisGiris(){
  stokInit();
  var evrakNo=((document.getElementById('bg-evrak')||{}).value||'').trim();
  var tarih=(document.getElementById('bg-tarih')||{}).value;
  var notlar=((document.getElementById('bg-notlar')||{}).value||'').trim();
  if(!evrakNo) return toast('Evrak No zorunludur.','error');
  if(!tarih) return toast('Tarih zorunludur.','error');
  if(!_bgKalemler.length) return toast('En az bir kalem ekleyin.','error');
  for(var i=0;i<_bgKalemler.length;i++){
    var k=_bgKalemler[i];
    if(!k.kategoriId) return toast((i+1)+'. kalemde kategori seçilmedi.','error');
    if(!k.urunAdi) return toast((i+1)+'. kalemde ürün adı girilmedi.','error');
    if(!k.lotNo) return toast((i+1)+'. kalemde LOT No girilmedi.','error');
    if(!k.miktar||k.miktar<1) return toast((i+1)+'. kalemde miktar geçersiz.','error');
  }
  var girisId=_bgEditGirisId||('bg'+Date.now());
  var kullanici=(state.currentUser&&state.currentUser.username)||'';
  var kalemlerSaved=_bgKalemler.map(function(k,i){
    return {lotId:'bl'+Date.now()+i,lotNo:k.lotNo,urunAdi:k.urunAdi,kategoriId:k.kategoriId,parametreler:k.parametreler||[],miktar:k.miktar,sktTarih:k.sktTarih||''};
  });
  if(_bgEditGirisId){
    state.bitmisStokLotlar=(state.bitmisStokLotlar||[]).filter(function(l){return l.girisId!==_bgEditGirisId;});
    var gIdx=(state.bitmisStokGirisler||[]).findIndex(function(x){return x.id===_bgEditGirisId;});
    if(gIdx>=0){state.bitmisStokGirisler[gIdx].evrakNo=evrakNo;state.bitmisStokGirisler[gIdx].tarih=tarih;state.bitmisStokGirisler[gIdx].notlar=notlar;state.bitmisStokGirisler[gIdx].kalemler=kalemlerSaved;}
    toast('Giriş belgesi güncellendi.','success');
  } else {
    state.bitmisStokGirisler.push({id:girisId,evrakNo:evrakNo,tarih:tarih,notlar:notlar,kalemler:kalemlerSaved,olusturmaTarihi:new Date().toISOString(),olusturanKullanici:kullanici});
    toast('Hazır ürün girişi kaydedildi.','success');
  }
  kalemlerSaved.forEach(function(k){
    state.bitmisStokLotlar.push({id:k.lotId,girisId:girisId,evrakNo:evrakNo,lotNo:k.lotNo,tarih:tarih,urunAdi:k.urunAdi,kategoriId:k.kategoriId,parametreler:k.parametreler,miktar:k.miktar,mevcutMiktar:k.miktar,sktTarih:k.sktTarih,olusturmaTarihi:new Date().toISOString(),olusturanKullanici:kullanici});
  });
  saveAll();
  if(document.getElementById('bg-edit-id')) document.getElementById('bg-edit-id').value='';
  showPage('bitmis-girisler');
}

// ─── TİCARİ STOK ÇIKIŞLAR LİSTESİ ───────────────────────────────────────────

var _expandedBitmisCikislar=new Set();
function toggleBitmisCikis(id){if(_expandedBitmisCikislar.has(id))_expandedBitmisCikislar.delete(id);else _expandedBitmisCikislar.add(id);renderBitmisCikislar();}

function renderBitmisCikislar(){
  stokInit();
  var fAra=((document.getElementById('bcl-arama')||{}).value||'').toLowerCase();
  var fTs=(document.getElementById('bcl-ts')||{}).value||'';
  var fTe=(document.getElementById('bcl-te')||{}).value||'';
  var cikislar=(state.bitmisCikislar||[]).filter(function(c){
    if(fTs&&(c.tarih||'')<fTs) return false;
    if(fTe&&(c.tarih||'')>fTe) return false;
    if(fAra&&!((c.evrakNo||'').toLowerCase()+' '+(c.aciklama||'').toLowerCase()+(c.satirlar||[]).map(function(s){return s.urunAdi;}).join(' ').toLowerCase()).includes(fAra)) return false;
    return true;
  }).sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
  var wrap=document.getElementById('bitmis-cikislar-wrap'); if(!wrap) return;
  if(!cikislar.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Hazır ürün çıkışı bulunamadı.</div>';renderPagination('bitmis-cikislar-pagination',1,0,'setBitmisCikislarPage');return;}
  var totalBC=cikislar.length;
  cikislar=cikislar.slice((_bitmisCikislarPage-1)*PAGE_SIZE,_bitmisCikislarPage*PAGE_SIZE);
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th style="width:28px"></th><th>Evrak No</th><th>Tarih</th><th>Çıkış Nedeni</th>'
    +'<th>Ürünler Özeti</th><th style="width:60px;text-align:right">Toplam</th><th></th>'
    +'</tr></thead><tbody>';
  cikislar.forEach(function(c){
    var expanded=_expandedBitmisCikislar.has(c.id);
    var urunStr=(c.satirlar||[]).map(function(s){return s.urunAdi;}).join(' • ');
    var toplam=(c.satirlar||[]).reduce(function(a,s){return a+s.miktar;},0);
    html+='<tr style="cursor:pointer;background:var(--bg3)" onclick="toggleBitmisCikis(\''+c.id+'\')">'
      +'<td style="text-align:center;color:var(--amber);font-weight:700">'+(expanded?'▼':'▶')+'</td>'
      +'<td><span class="kn-badge">'+stokEsc(c.evrakNo||'—')+'</span></td>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+stokEsc(c.tarih||'')+'</td>'
      +'<td style="font-size:12px">'+stokEsc(c.aciklama||'')+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(urunStr)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(toplam)+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" onclick="event.stopPropagation();stokSilBitmisCikis(\''+c.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
    if(expanded){
      var subHtml='<table class="compact-table" style="width:100%;margin:0"><thead><tr style="background:var(--bg4)">'
        +'<th>Ürün Adı</th><th>LOT No</th><th style="text-align:right">Miktar</th>'
        +'</tr></thead><tbody>';
      (c.satirlar||[]).forEach(function(s){
        subHtml+='<tr>'
          +'<td style="font-weight:500">'+stokEsc(s.urunAdi)+'</td>'
          +'<td><span class="kn-badge">'+stokEsc(s.lotNo)+'</span></td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(s.miktar)+'</td>'
          +'</tr>';
      });
      subHtml+='</tbody></table>';
      html+='<tr style="border-bottom:2px solid var(--border2)">'
        +'<td colspan="7" style="padding:0 0 8px 32px;background:var(--bg)">'+subHtml+'</td>'
        +'</tr>';
    }
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('bitmis-cikislar-pagination',_bitmisCikislarPage,totalBC,'setBitmisCikislarPage');
}
function setBitmisCikislarPage(p){_bitmisCikislarPage=p;renderBitmisCikislar();}

function gobitmisCikisYeni(){
  var evrak=nextTicariCikisEvrak();
  if(document.getElementById('bc-evrak')) document.getElementById('bc-evrak').value=evrak;
  var dispEl=document.getElementById('bc-evrak-display');
  if(dispEl) dispEl.textContent='Evrak No: '+evrak;
  showPage('bitmis-cikis');
}

function stokSilBitmisCikis(id){
  if(!confirm('Bu çıkış kaydı silinecek. Stok geri yüklenmeyecek. Emin misiniz?')) return;
  state.bitmisCikislar=(state.bitmisCikislar||[]).filter(function(c){return c.id!==id;});
  saveAll(); renderBitmisCikislar(); toast('Çıkış silindi.','info');
}

// ─── TİCARİ STOK ÇIKIŞ FORMU ─────────────────────────────────────────────────

var _bcSatirlar=[];

function renderBitmisCikisForm(){
  stokInit();
  _bcSatirlar=[];
  var evrak=(document.getElementById('bc-evrak')||{}).value||nextTicariCikisEvrak();
  if(document.getElementById('bc-evrak')) document.getElementById('bc-evrak').value=evrak;
  var dispEl=document.getElementById('bc-evrak-display');
  if(dispEl) dispEl.textContent='Evrak No: '+evrak;
  var tarihEl=document.getElementById('bc-tarih');
  if(tarihEl&&!tarihEl.value) tarihEl.value=stokToday();
  stokNedenSelect('bc-aciklama');
  if(document.getElementById('bc-notlar')) document.getElementById('bc-notlar').value='';
  bcRenderSatirlar();
}

function bcAddSatir(){
  _bcSatirlar.push({lotId:'',miktar:1});
  bcRenderSatirlar();
}

function bcRemoveSatir(idx){_bcSatirlar.splice(idx,1);bcRenderSatirlar();}

function bcRenderSatirlar(){
  var el=document.getElementById('bc-satirlar'); if(!el) return;
  var lots=(state.bitmisStokLotlar||[]).filter(function(l){return l.mevcutMiktar>0;});
  if(!_bcSatirlar.length){
    el.innerHTML='<div style="padding:16px;color:var(--text3);font-size:13px;text-align:center">Ürün / LOT ekleyin.</div>';
    return;
  }
  el.innerHTML=_bcSatirlar.map(function(s,i){
    var lotOptions=lots.map(function(l){
      var kat=stokKatById(l.kategoriId)||{ad:''};
      return '<option value="'+l.id+'"'+(s.lotId===l.id?' selected':'')+'>'+stokEsc(l.lotNo)+' — '+stokEsc(l.urunAdi)+' ('+stokEsc(kat.ad)+') Mevcut: '+stokFmtN(l.mevcutMiktar)+'</option>';
    }).join('');
    if(!lotOptions) lotOptions='<option value="">— Mevcut LOT yok —</option>';
    return '<div style="display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:end;padding:12px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:8px">'
      +'<div class="field" style="margin:0"><label style="font-size:11px">Ürün / LOT</label><select onchange="bcLotChange('+i+',this.value)"><option value="">Seçin...</option>'+lotOptions+'</select></div>'
      +'<div class="field" style="margin:0;width:90px"><label style="font-size:11px">Miktar</label><input type="number" min="1" value="'+s.miktar+'" onchange="bcMiktarChange('+i+',this.value)"></div>'
      +'<button class="btn-icon" style="color:var(--red);margin-bottom:2px" onclick="bcRemoveSatir('+i+')">⊗</button>'
      +'</div>';
  }).join('');
}

function bcLotChange(idx,val){_bcSatirlar[idx].lotId=val;bcRenderSatirlar();}
function bcMiktarChange(idx,val){_bcSatirlar[idx].miktar=parseInt(val)||1;}

function saveBitmisCikis(){
  stokInit();
  var tarih=(document.getElementById('bc-tarih')||{}).value;
  var aciklama=(document.getElementById('bc-aciklama')||{}).value.trim();
  var notlar=(document.getElementById('bc-notlar')||{}).value.trim();
  if(!tarih) return toast('Tarih zorunludur.','error');
  if(!aciklama) return toast('Müşteri / Amaç zorunludur.','error');
  if(!_bcSatirlar.length) return toast('En az bir ürün ekleyin.','error');

  var satirFinal=[];
  for(var i=0;i<_bcSatirlar.length;i++){
    var s=_bcSatirlar[i];
    if(!s.lotId) return toast((i+1)+'. satırda LOT seçilmedi.','error');
    var lot=(state.bitmisStokLotlar||[]).find(function(l){return l.id===s.lotId;});
    if(!lot) return toast('LOT bulunamadı.','error');
    if(s.miktar>lot.mevcutMiktar) return toast(stokEsc(lot.urunAdi)+': yeterli stok yok. Mevcut: '+stokFmtN(lot.mevcutMiktar),'error');
    satirFinal.push({lotId:lot.id,lotNo:lot.lotNo,urunAdi:lot.urunAdi,kategoriId:lot.kategoriId,miktar:s.miktar});
  }

  satirFinal.forEach(function(sf){
    var idx=(state.bitmisStokLotlar||[]).findIndex(function(l){return l.id===sf.lotId;});
    if(idx>=0) state.bitmisStokLotlar[idx].mevcutMiktar-=sf.miktar;
  });

  var evrakNo=((document.getElementById('bc-evrak')||{}).value)||nextTicariCikisEvrak();
  state.bitmisCikislar.push({
    id:'bc'+Date.now(),evrakNo:evrakNo,tarih:tarih,aciklama:aciklama,notlar:notlar,
    satirlar:satirFinal,
    olusturmaTarihi:new Date().toISOString(),
    olusturanKullanici:(state.currentUser&&state.currentUser.username)||''
  });

  saveAll();
  toast('Hazır ürün çıkışı kaydedildi ('+evrakNo+').','success');
  showPage('bitmis-cikislar');
}

// ─── HAREKET GEÇMİŞİ ─────────────────────────────────────────────────────────

function renderStokHareket(){
  stokInit();
  var fTS=(document.getElementById('sh-tarih-s')||{}).value||'';
  var fTE=(document.getElementById('sh-tarih-e')||{}).value||'';
  var fTip=(document.getElementById('sh-tip')||{}).value||'';
  var fKat=(document.getElementById('sh-kat')||{}).value||'';
  var fLot=((document.getElementById('sh-lot')||{}).value||'').toLowerCase();

  var katSel=document.getElementById('sh-kat');
  if(katSel){var cv=katSel.value;katSel.innerHTML='<option value="">Tüm Kategoriler</option>'+stokKatList().map(function(k){return '<option value="'+k.id+'">'+k.ad+'</option>';}).join('');katSel.value=cv;}

  var tümHareketler=stokTumHareketler();
  var filtered=tümHareketler.filter(function(h){
    if(fTS&&(h.tarih||'')<fTS) return false;
    if(fTE&&(h.tarih||'')>fTE) return false;
    if(fTip&&h.tip!==fTip) return false;
    if(fKat&&h.kategoriId!==fKat) return false;
    if(fLot&&!(h.lotNo||'').toLowerCase().includes(fLot)) return false;
    return true;
  });

  var wrap=document.getElementById('stok-hareket-wrap'); if(!wrap) return;
  if(!filtered.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Hareket bulunamadı.</div>';renderPagination('stok-hareket-pagination',1,0,'setStokHareketPage');return;}

  var totalSH=filtered.length;
  var pagedSH=filtered.slice((_stokHareketPage-1)*PAGE_SIZE,_stokHareketPage*PAGE_SIZE);
  var TIP={'ham-giris':'Ham Giriş','ham-cikis':'Ham Çıkış','bitmis-giris':'Ticari Giriş','bitmis-cikis':'Ticari Çıkış'};
  var TCOL={'ham-giris':'var(--teal)','ham-cikis':'var(--amber)','bitmis-giris':'var(--green)','bitmis-cikis':'var(--red)'};

  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th>Tarih</th><th>Tür</th><th>Evrak / Ref</th><th>Açıklama</th><th>Kategori</th><th style="text-align:right">Miktar</th><th>Kullanıcı</th>'
    +'</tr></thead><tbody>';
  pagedSH.forEach(function(h){
    html+='<tr>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+stokEsc(h.tarih||'')+'</td>'
      +'<td><span style="font-size:11px;font-weight:600;color:'+TCOL[h.tip]+'">'+stokEsc(TIP[h.tip]||h.tip)+'</span></td>'
      +'<td><span class="kn-badge">'+stokEsc(h.lotNo||h.ref||'—')+'</span></td>'
      +'<td style="font-size:12px">'+stokEsc(h.aciklama||'')+'</td>'
      +'<td style="font-size:12px">'+stokEsc((stokKatById(h.kategoriId)||{}).ad||h.kategoriId||'')+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+stokEsc(h.miktarStr||'')+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(h.kullanici||'')+'</td>'
      +'</tr>';
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('stok-hareket-pagination',_stokHareketPage,totalSH,'setStokHareketPage');
}
function setStokHareketPage(p){_stokHareketPage=p;renderStokHareket();}

function stokTumHareketler(){
  var h=[];
  (state.hamStokLotlar||[]).forEach(function(l){
    h.push({id:l.id,tarih:l.tarih,tip:'ham-giris',lotNo:l.lotNo,kategoriId:l.kategoriId,
      aciklama:l.parametreAd+(l.cutoff?' ('+l.cutoff+')':''),
      miktarStr:l.sheetGiren+' sh / '+stokFmtN(l.stripGiren)+' strip',kullanici:l.olusturanKullanici||''});
  });
  (state.hamStokCikislar||[]).forEach(function(c){
    var params=(c.satirlar||[]).map(function(s){return s.parametreAd+(s.cutoff?' ('+s.cutoff+')':'');}).join(', ');
    h.push({id:c.id,tarih:c.tarih,tip:'ham-cikis',lotNo:c.evrakNo||'',ref:c.evrakNo||c.id.slice(-6),kategoriId:c.kategoriId,
      aciklama:stokEsc(c.aciklama||'')+(params?' — '+params:''),
      miktarStr:c.kitMiktari+' kit / '+stokFmtN((c.satirlar||[]).reduce(function(a,s){return a+s.stripCikis;},0))+' strip',kullanici:c.olusturanKullanici||''});
  });
  (state.bitmisStokGirisler||[]).forEach(function(g){
    var urunStr=(g.kalemler||[]).map(function(k){return k.urunAdi;}).join(', ');
    h.push({id:g.id,tarih:g.tarih,tip:'bitmis-giris',lotNo:g.evrakNo||'',ref:g.evrakNo||'',kategoriId:'',
      aciklama:urunStr,miktarStr:(g.kalemler||[]).reduce(function(a,k){return a+k.miktar;},0)+' adet',kullanici:g.olusturanKullanici||''});
  });
  (state.bitmisCikislar||[]).forEach(function(c){
    var acik=(c.aciklama||'')+(c.satirlar&&c.satirlar.length?' — '+(c.satirlar||[]).map(function(s){return s.urunAdi;}).join(', '):'');
    h.push({id:c.id,tarih:c.tarih,tip:'bitmis-cikis',lotNo:c.evrakNo||'',ref:c.evrakNo||c.id.slice(-6),kategoriId:((c.satirlar||[])[0]||{}).kategoriId||'',
      aciklama:acik,
      miktarStr:stokFmtN((c.satirlar||[]).reduce(function(a,s){return a+s.miktar;},0))+' adet',kullanici:c.olusturanKullanici||''});
  });
  return h.sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
}

// ─── AYARLAR ─────────────────────────────────────────────────────────────────

function loadStokAyarlar(){
  stokInit();
  // Her açılışta kilitle
  var pg=document.getElementById('page-stok-ayarlar');
  if(pg) pg.classList.add('sa-locked');
  stokRenderKatAyar();
  stokRenderEsikler();
  stokNedenRender();
  var hcpEl=document.getElementById('set-ham-cikis-prefix');
  if(hcpEl){hcpEl.value=state.stokSettings.hamCikisPrefix||'HC'; stokPrefixPrev();}
  var tcpEl=document.getElementById('set-ticari-cikis-prefix');
  if(tcpEl){tcpEl.value=state.stokSettings.ticariCikisPrefix||'TC'; stokPrefixPrev();}
}

function stokAyarDuzenle(){
  var pg=document.getElementById('page-stok-ayarlar');
  if(pg) pg.classList.remove('sa-locked');
}

function stokAyarKilitle(){
  var pg=document.getElementById('page-stok-ayarlar');
  if(pg) pg.classList.add('sa-locked');
}

function stokNedenRender(){
  var el=document.getElementById('stok-neden-listesi'); if(!el) return;
  var nedenleri=(state.stokSettings&&state.stokSettings.cikisNedenleri)||[];
  if(!nedenleri.length){el.innerHTML='<div style="padding:8px 0;font-size:13px;color:var(--text3)">Henüz neden tanımlanmamış.</div>';return;}
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:4px">'+nedenleri.map(function(n,i){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border)">'
      +'<span style="font-size:13px;color:var(--text)">'+stokEsc(n)+'</span>'
      +'<button class="btn-icon sa-action" style="color:var(--red);flex-shrink:0" onclick="stokNedenSil('+i+')">⊗</button>'
      +'</div>';
  }).join('')+'</div>';
}

function stokNedenEkle(){
  var el=document.getElementById('neden-yeni'); if(!el) return;
  var val=el.value.trim(); if(!val) return toast('Çıkış nedeni boş olamaz.','error');
  stokInit();
  if(state.stokSettings.cikisNedenleri.includes(val)) return toast('Bu çıkış nedeni zaten var.','info');
  state.stokSettings.cikisNedenleri.push(val);
  el.value='';
  saveAll(); stokNedenRender(); toast('Çıkış nedeni eklendi.','success');
}

function stokNedenSil(i){
  if(!confirm('Bu nedeni silmek istiyor musunuz?')) return;
  stokInit();
  state.stokSettings.cikisNedenleri.splice(i,1);
  saveAll(); stokNedenRender(); toast('Çıkış nedeni silindi.','info');
}

function saveStokEsikler(){
  toast('Eşikler otomatik kaydedilir. Güncellendi.','success');
}

function stokPrefixPrev(){
  var hp=((document.getElementById('set-ham-cikis-prefix')||{}).value||'HC').toUpperCase();
  var tp=((document.getElementById('set-ticari-cikis-prefix')||{}).value||'TC').toUpperCase();
  var hPrev=document.getElementById('set-ham-cikis-prev');
  var tPrev=document.getElementById('set-ticari-cikis-prev');
  if(hPrev) hPrev.textContent='Örnek: '+hp+'-00001';
  if(tPrev) tPrev.textContent='Örnek: '+tp+'-00001';
}

function saveStokPrefixler(){
  stokInit();
  var hp=((document.getElementById('set-ham-cikis-prefix')||{}).value||'').trim().toUpperCase()||'HC';
  var tp=((document.getElementById('set-ticari-cikis-prefix')||{}).value||'').trim().toUpperCase()||'TC';
  state.stokSettings.hamCikisPrefix=hp;
  state.stokSettings.ticariCikisPrefix=tp;
  saveAll(); toast('Ön Ekler kaydedildi.','success');
  stokPrefixPrev();
}

function stokRenderKatAyar(){
  var el=document.getElementById('stok-kat-body'); if(!el) return;
  el.innerHTML=stokKatList().map(function(k,i){
    return '<div style="margin-bottom:18px;padding-bottom:16px;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px">'+stokEsc(k.ad)+'</div>'
      +'<div class="form-grid" style="gap:10px">'
        +'<div class="field" style="margin:0"><label style="font-size:11px">Sheet Boyu (mm)</label><input type="number" id="kat-sb-'+i+'" value="'+k.sheetBoyu+'" min="1"></div>'
        +'<div class="field" style="margin:0"><label style="font-size:11px">Kesim Böleni (mm)</label><input type="number" id="kat-kb-'+i+'" value="'+k.kesimBoleni+'" min="1"></div>'
        +'<div class="field" style="margin:0"><label style="font-size:11px">Fire (%)</label><input type="number" id="kat-fp-'+i+'" value="'+k.firePct+'" min="0" max="50"></div>'
        +'<div class="field" style="margin:0"><label style="font-size:11px;color:var(--teal)">= Strip/Sheet</label><div style="padding:8px;background:var(--bg3);border-radius:var(--radius-sm);font-family:var(--font-mono);font-size:13px;color:var(--teal)">'+stokSPS(k.id)+'</div></div>'
      +'</div>'
      +'</div>';
  }).join('');
}

function saveStokAyarlar(){
  stokKatList().forEach(function(k,i){
    var sb=parseInt((document.getElementById('kat-sb-'+i)||{}).value)||k.sheetBoyu;
    var kb=parseInt((document.getElementById('kat-kb-'+i)||{}).value)||k.kesimBoleni;
    var fp=parseFloat((document.getElementById('kat-fp-'+i)||{}).value)||0;
    k.sheetBoyu=sb; k.kesimBoleni=kb; k.firePct=fp;
  });
  saveAll();
  toast('Kategori ayarları kaydedildi.','success');
  stokRenderKatAyar();
}

// ─── PARAMETRELER SAYFASI ─────────────────────────────────────────────────────

var _paramEditIdx=null;

function renderStokParametreler(){
  stokInit();
  paramFormKapat();
  stokParamTabloRender();
}

function stokParamFormAc(idx){
  _paramEditIdx=(idx!==undefined&&idx!==null)?idx:null;
  var titleEl=document.getElementById('param-form-title');
  if(titleEl) titleEl.textContent=_paramEditIdx!==null?'Parametreyi Düzenle':'Yeni Parametre';
  var formCard=document.getElementById('param-form-card');
  if(formCard) formCard.style.display='';
  var adEl=document.getElementById('param-ad');
  var kisaltmaEl=document.getElementById('param-kisaltma');
  var aktifEl=document.getElementById('param-aktif');
  var idxEl=document.getElementById('param-edit-idx');
  if(_paramEditIdx!==null){
    var p=stokParamList()[_paramEditIdx];
    if(p){
      if(adEl) adEl.value=p.ad||'';
      if(kisaltmaEl) kisaltmaEl.value=p.kisaltma||'';
      if(aktifEl) aktifEl.checked=p.aktif!==false;
    }
  } else {
    if(adEl) adEl.value='';
    if(kisaltmaEl) kisaltmaEl.value='';
    if(aktifEl) aktifEl.checked=true;
  }
  if(idxEl) idxEl.value=_paramEditIdx!==null?String(_paramEditIdx):'';
  if(adEl) adEl.focus();
}

function paramFormKapat(){
  var formCard=document.getElementById('param-form-card');
  if(formCard) formCard.style.display='none';
  _paramEditIdx=null;
}

function saveStokParam(){
  stokInit();
  var ad=((document.getElementById('param-ad')||{}).value||'').trim();
  var kisaltma=((document.getElementById('param-kisaltma')||{}).value||'').trim().toUpperCase();
  var aktif=(document.getElementById('param-aktif')||{}).checked!==false;
  var idxStr=((document.getElementById('param-edit-idx')||{}).value||'');
  if(!kisaltma) return toast('Kısaltma zorunludur.','error');
  var editIdx=idxStr!==''?parseInt(idxStr):null;
  if(editIdx!==null&&editIdx>=0&&editIdx<stokParamList().length){
    state.stokSettings.parametreler[editIdx]={ad:ad,kisaltma:kisaltma,aktif:aktif};
    toast('Parametre güncellendi.','success');
  } else {
    state.stokSettings.parametreler.push({ad:ad,kisaltma:kisaltma,aktif:aktif});
    toast('Parametre eklendi.','success');
  }
  saveAll(); paramFormKapat(); stokParamTabloRender(); stokRenderEsikler();
}

function stokParamTabloRender(){
  var el=document.getElementById('stok-param-tablo'); if(!el) return;
  var params=stokParamList();
  if(!params.length){
    el.innerHTML='<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px">Henüz parametre tanımlanmamış.<br>Yukarıdaki "+ Yeni Parametre" butonuyla ekleyin.</div>';
    var pgEl=document.getElementById('stok-param-pagination'); if(pgEl) pgEl.innerHTML='';
    return;
  }
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var totalP=params.length;
  var pagedParams=params.slice((_stokParamPage-1)*PAGE_SIZE,_stokParamPage*PAGE_SIZE);
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr><th style="width:40px">#</th><th>Parametre Adı</th><th>Kısaltma</th><th style="text-align:center">Durum</th><th></th></tr></thead><tbody>';
  pagedParams.forEach(function(p,i){
    var globalIdx=(_stokParamPage-1)*PAGE_SIZE+i;
    var kisaltma=p.kisaltma||p.ad;
    html+='<tr>'
      +'<td style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">'+(globalIdx+1)+'</td>'
      +'<td style="font-weight:500">'+stokEsc(p.ad||kisaltma)+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--accent)">'+stokEsc(kisaltma)+'</td>'
      +'<td style="text-align:center">'+(p.aktif!==false
        ?'<span class="badge badge-teslim">Aktif</span>'
        :'<span class="badge" style="background:var(--bg4);color:var(--text3)">Pasif</span>')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" title="Düzenle" onclick="stokParamFormAc('+globalIdx+')">✏</button>':'')
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" title="Sil" onclick="stokParamSil('+globalIdx+')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
  });
  el.innerHTML=html+'</tbody></table></div>';
  renderPagination('stok-param-pagination',_stokParamPage,totalP,'setStokParamPage');
}
function setStokParamPage(p){_stokParamPage=p;stokParamTabloRender();}

function stokParamSil(i){
  if(!confirm('Bu parametreyi silmek istiyor musunuz?')) return;
  state.stokSettings.parametreler.splice(i,1);
  saveAll(); stokParamTabloRender(); stokRenderEsikler();
  toast('Parametre silindi.','info');
}

function stokRenderEsikler(){
  var el=document.getElementById('stok-esik-body'); if(!el) return;
  var esik=state.stokSettings.globalEsik||1;
  el.innerHTML='<div style="display:flex;align-items:center;gap:14px">'
    +'<label style="font-size:13px;color:var(--text2)">Parametreler için minimum stok eşiği <span style="font-size:11px;color:var(--text3)">(min sheet — tüm parametrelere uygulanır)</span></label>'
    +'<input type="number" min="0" value="'+esik+'" style="width:80px;text-align:center;padding:6px 8px;font-family:var(--font-mono);font-size:14px;font-weight:600;background:var(--bg3);border:1px solid var(--border);border-radius:6px;color:var(--text)" onchange="stokEsikGuncelle(this.value)">'
    +'</div>';
}

function stokEsikGuncelle(val){
  state.stokSettings.globalEsik=parseFloat(val)||0;
  saveAll();
}

// ─── EXCEL EXPORT ─────────────────────────────────────────────────────────────

function _xlsxDownload(rows,headers,sheetName,fileName){
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet([headers].concat(rows));
  XLSX.utils.book_append_sheet(wb,ws,sheetName);
  var wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url; a.download=fileName+'.xlsx';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

function stokExportHamStokExcel(){
  stokInit();
  var lots=state.hamStokLotlar||[];
  var headers=['LOT No','Parametre','Cut-off','Kategori','Giriş Tarihi','Sheet Girdi','Strip Girdi','Mevcut Strip','Mevcut Sheet','SKT','Evrak No','Durum'];
  var rows=lots.map(function(l){
    var kat=(stokKatById(l.kategoriId)||{}).ad||l.kategoriId;
    var sps=stokSPS(l.kategoriId);
    var ms=sps>0?Math.floor(l.mevcutStrip/sps):0;
    return [l.lotNo,l.parametreAd,l.cutoff||'',kat,l.tarih||'',l.sheetGiren||0,l.stripGiren||0,l.mevcutStrip||0,ms,stokFmtSkt(l.sktTarih),l.evrakNo||'',l.mevcutStrip===0?'Tükendi':'Mevcut'];
  });
  _xlsxDownload(rows,headers,'Yarı Mamul Stok','yari-mamul-stok-listesi');
}

function stokExportHamGirislerExcel(){
  stokInit();
  var headers=['Evrak No','Tarih','LOT No','Parametre','Cut-off','Kategori','Sheet','Strip','SKT','Notlar'];
  var rows=[];
  (state.hamStokGirisler||[]).forEach(function(g){
    (g.kalemler||[]).forEach(function(k){
      var kat=(stokKatById(k.kategoriId)||{}).ad||k.kategoriId;
      rows.push([g.evrakNo,g.tarih||'',k.lotNo,k.parametreAd,k.cutoff||'',kat,k.sheetGiren||0,k.stripGiren||0,stokFmtSkt(k.sktTarih),g.notlar||'']);
    });
  });
  _xlsxDownload(rows,headers,'Yarı Mamul Girişler','yari-mamul-girisler');
}

function stokExportHamCikislarExcel(){
  stokInit();
  var headers=['Evrak No','Tarih','Kategori','Çıkış Nedeni','Kit Miktar','Parametre','Cut-off','LOT No','Strip Çıkış','Notlar'];
  var rows=[];
  (state.hamStokCikislar||[]).forEach(function(c){
    var kat=(stokKatById(c.kategoriId)||{}).ad||c.kategoriId;
    (c.satirlar||[]).forEach(function(s){
      rows.push([c.evrakNo||'',c.tarih||'',kat,c.aciklama||'',c.kitMiktari||0,s.parametreAd,s.cutoff||'',s.lotNo,s.stripCikis||0,c.notlar||'']);
    });
  });
  _xlsxDownload(rows,headers,'Yarı Mamul Çıkışlar','yari-mamul-cikislar');
}

function stokExportBitmisStokExcel(){
  stokInit();
  var headers=['LOT No','Ürün Adı','Kategori','Parametreler','Giriş Tarihi','Giren Miktar','Mevcut Miktar','SKT','Evrak No','Durum'];
  var rows=(state.bitmisStokLotlar||[]).map(function(l){
    var kat=(stokKatById(l.kategoriId)||{}).ad||l.kategoriId;
    return [l.lotNo,l.urunAdi||'',kat,(l.parametreler||[]).join(', '),l.tarih||'',l.miktar||0,l.mevcutMiktar||0,stokFmtSkt(l.sktTarih),l.evrakNo||'',l.mevcutMiktar===0?'Tükendi':'Mevcut'];
  });
  _xlsxDownload(rows,headers,'Harzır Ürün Stok','hazir-urun-stok-listesi');
}

function stokExportBitmisGirislerExcel(){
  stokInit();
  var headers=['Evrak No','Tarih','Ürün Adı','LOT No','Kategori','Miktar','SKT','Parametreler','Notlar'];
  var rows=[];
  (state.bitmisStokGirisler||[]).forEach(function(g){
    (g.kalemler||[]).forEach(function(k){
      var kat=(stokKatById(k.kategoriId)||{}).ad||k.kategoriId;
      rows.push([g.evrakNo,g.tarih||'',k.urunAdi||'',k.lotNo,kat,k.miktar||0,stokFmtSkt(k.sktTarih),(k.parametreler||[]).join(', '),g.notlar||'']);
    });
  });
  _xlsxDownload(rows,headers,'Hazır Ürün Girişler','hazir-urun-girisler');
}

function stokExportBitmisCikislarExcel(){
  stokInit();
  var headers=['Evrak No','Tarih','Çıkış Nedeni','Ürün Adı','LOT No','Miktar','Notlar'];
  var rows=[];
  (state.bitmisCikislar||[]).forEach(function(c){
    (c.satirlar||[]).forEach(function(s){
      rows.push([c.evrakNo||'',c.tarih||'',c.aciklama||'',s.urunAdi||'',s.lotNo||'',s.miktar||0,c.notlar||'']);
    });
  });
  _xlsxDownload(rows,headers,'Hazır Ürün Çıkışlar','hazir-urun-cikislar');
}

function stokExportHareketExcel(){
  var h=stokTumHareketler();
  var TIP={'ham-giris':'Ham Giriş','ham-cikis':'Ham Çıkış','bitmis-giris':'Ticari Giriş','bitmis-cikis':'Ticari Çıkış'};
  var headers=['Tarih','Tür','Evrak / LOT','Açıklama','Kategori','Miktar','Kullanıcı'];
  var rows=h.map(function(h){
    var kat=(stokKatById(h.kategoriId)||{}).ad||h.kategoriId||'';
    return [h.tarih||'',TIP[h.tip]||h.tip,h.lotNo||h.ref||'',h.aciklama||'',kat,h.miktarStr||'',h.kullanici||''];
  });
  _xlsxDownload(rows,headers,'Hareket Geçmişi','stok-hareket-gecmisi');
}
