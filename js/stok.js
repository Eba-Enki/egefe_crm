// ═══════════════════════════════════════════════════════
//  STOK TAKİP PORTALI
// ═══════════════════════════════════════════════════════

var STOK_KAT_DEFAULT = [
  {id:'idrar',  ad:'İdrar',       sheetBoyu:300, kesimBoleni:3, firePct:10},
  {id:'agiz',   ad:'Ağız Sıvısı', sheetBoyu:300, kesimBoleni:4, firePct:0},
  {id:'yuzey',  ad:'Yüzey / Toz', sheetBoyu:300, kesimBoleni:3, firePct:10}
];

// ─── Başlangıç / Helpers ─────────────────────────────────────────────────────

function stokInit(){
  if(!state.stokSettings){
    state.stokSettings={kategoriler:JSON.parse(JSON.stringify(STOK_KAT_DEFAULT)),parametreler:[],minStokEsikleri:[]};
  }
  if(!state.stokSettings.kategoriler) state.stokSettings.kategoriler=JSON.parse(JSON.stringify(STOK_KAT_DEFAULT));
  if(!state.stokSettings.parametreler) state.stokSettings.parametreler=[];
  if(!state.stokSettings.minStokEsikleri) state.stokSettings.minStokEsikleri=[];
  if(!state.hamStokLotlar)    state.hamStokLotlar=[];
  if(!state.hamStokCikislar)  state.hamStokCikislar=[];
  if(!state.bitmisStokLotlar) state.bitmisStokLotlar=[];
  if(!state.bitmisCikislar)   state.bitmisCikislar=[];
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
      var esik=((state.stokSettings.minStokEsikleri||[]).find(function(e){return e.parametreAd===ad&&e.kategoriId===kat.id;})||{}).minSheet||1;
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

function stokSktInfo(skt){
  if(!skt) return {renk:'var(--text3)',etiket:'',doldu:false};
  var today=stokToday();
  if(skt<today) return {renk:'var(--red)',etiket:'Doldu',doldu:true};
  var d30=new Date(); d30.setDate(d30.getDate()+30);
  if(skt<=d30.toISOString().slice(0,10)) return {renk:'var(--amber)',etiket:'Yaklaşıyor',doldu:false};
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

// ─── HAM STOK GÖRÜNÜMÜ ───────────────────────────────────────────────────────

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
  var lots=(state.hamStokLotlar||[]).filter(function(l){
    if(fKat&&l.kategoriId!==fKat) return false;
    if(fParam&&l.parametreAd!==fParam) return false;
    if(fKritik&&!kritikSet.has(l.parametreAd+'|'+l.kategoriId)) return false;
    return true;
  });

  var wrap=document.getElementById('ham-stok-wrap'); if(!wrap)return;
  if(!lots.length){
    wrap.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">Ham stok kaydı bulunamadı.<br><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showPage(\'ham-giris\')">+ Yeni Giriş</button></div>';
    return;
  }

  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';

  // Parametre objelerini kisaltma ile indeksle
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
  var html='<div class="table-wrap"><table class="compact-table" style="border-collapse:collapse"><thead><tr>'
    +'<th style="min-width:160px">Parametre</th><th>Kategori</th><th>Cut-off</th><th>LOT No</th>'
    +'<th style="text-align:right">Mevcut Sheet</th><th style="text-align:right">Mevcut Strip</th>'
    +'<th>SKT</th><th>Giriş Tarihi</th><th>Durum</th><th></th>'
    +'</tr></thead><tbody>';

  Object.keys(paramGroups).sort().forEach(function(paramAd){
    var pObj=paramObjs[paramAd]||{};
    // "Amphetamine (AMP)" formatı
    var kisaltma=pObj.kisaltma||paramAd;
    var tamAd=pObj.ad&&pObj.ad!==kisaltma?pObj.ad+' ('+kisaltma+')':kisaltma;

    var katMap=paramGroups[paramAd];
    // Kategori sırasını ayarlara göre koru
    var kats=allKats.filter(function(k){return katMap[k.id]&&katMap[k.id].length>0;});

    // Toplam LOT sayısı (parametre rowspan için)
    var totalLots=kats.reduce(function(a,k){return a+(katMap[k.id]||[]).length;},0);
    var paramFirstRow=true;

    kats.forEach(function(kat){
      var katLots=(katMap[kat.id]||[]).slice().sort(function(a,b){
        // Cut-off büyükten küçüğe, sonra tarih eskiden yeniye
        var co=(parseFloat(b.cutoff)||0)-(parseFloat(a.cutoff)||0);
        return co!==0?co:(a.tarih||'').localeCompare(b.tarih||'');
      });
      var katFirstRow=true;

      katLots.forEach(function(lot){
        var ms=stokMevcutSheet(lot);
        var skt=stokSktInfo(lot.sktTarih);
        var sps=stokSPS(lot.kategoriId);
        var esik=((state.stokSettings.minStokEsikleri||[]).find(function(e){return e.parametreAd===paramAd&&e.kategoriId===kat.id;})||{}).minSheet||1;
        var durum=lot.mevcutStrip===0
          ?'<span class="badge" style="background:var(--bg4);color:var(--text3)">Tükendi</span>'
          :skt.doldu?'<span class="badge badge-reddedildi">SKT Geçti</span>'
          :stokBadge(lot.mevcutStrip,sps,esik);

        html+='<tr>';

        // Parametre hücresi — sadece ilk LOT satırında, tüm LOTları kapsayan rowspan
        if(paramFirstRow){
          html+='<td rowspan="'+totalLots+'" style="font-weight:600;color:var(--accent);vertical-align:middle;'
            +'border-right:2px solid var(--border2);border-bottom:2px solid var(--border2);background:var(--bg2);line-height:1.4">'
            +stokEsc(tamAd)+'</td>';
          paramFirstRow=false;
        }

        // Kategori hücresi — her kategorinin ilk LOT satırında rowspan
        if(katFirstRow){
          html+='<td rowspan="'+katLots.length+'" style="vertical-align:middle;text-align:center;'
            +'border-right:1px solid var(--border);border-bottom:1px solid var(--border2);'
            +'font-size:11px;color:var(--text2);font-weight:500">'
            +stokEsc(kat.ad)+'</td>';
          katFirstRow=false;
        }

        html+='<td style="font-family:var(--font-mono)">'+stokEsc(lot.cutoff||'—')+'</td>'
          +'<td><span class="kn-badge">'+stokEsc(lot.lotNo)+'</span></td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+(lot.mevcutStrip===0?'<span style="color:var(--text3)">0</span>':stokFmtN(ms))+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+(lot.mevcutStrip===0?'<span style="color:var(--text3)">0</span>':stokFmtN(lot.mevcutStrip))+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:11px;color:'+skt.renk+'">'+stokEsc(lot.sktTarih||'—')+(skt.etiket?'<br><span style="font-size:10px">('+skt.etiket+')</span>':'')+'</td>'
          +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(lot.tarih||'')+'</td>'
          +'<td>'+durum+'</td>'
          +'<td><div class="action-row">'
            +(canWrite?'<button class="btn-icon" title="Düzenle" onclick="goHamGirisEdit(\''+lot.id+'\')">✏</button>':'')
            +(canWrite?'<button class="btn-icon" style="color:var(--red)" title="Sil" onclick="stokSilHamLot(\''+lot.id+'\')">⊗</button>':'')
          +'</div></td>'
          +'</tr>';
      });
    });
  });

  wrap.innerHTML=html+'</tbody></table></div>';
}

// ─── HAM STOK GİRİŞ FORMU ────────────────────────────────────────────────────

var _hgEditId=null;

function renderHamGirisForm(){
  stokInit();
  var titleEl=document.getElementById('hg-form-title');
  var tarihEl=document.getElementById('hg-tarih');
  var editId=(document.getElementById('hg-edit-id')||{}).value||'';
  _hgEditId=editId||null;

  if(titleEl) titleEl.textContent=_hgEditId?'Ham Stok Düzenle':'Ham Stok Girişi';
  stokKatSelect('hg-kategori','');
  stokParamSelect('hg-parametre','');

  if(_hgEditId){
    var lot=(state.hamStokLotlar||[]).find(function(l){return l.id===_hgEditId;});
    if(lot){
      if(document.getElementById('hg-lot')) document.getElementById('hg-lot').value=lot.lotNo||'';
      if(tarihEl) tarihEl.value=lot.tarih||'';
      stokKatSelect('hg-kategori',lot.kategoriId);
      stokParamSelect('hg-parametre',lot.parametreAd);
      if(document.getElementById('hg-cutoff')) document.getElementById('hg-cutoff').value=lot.cutoff||'';
      if(document.getElementById('hg-sheet')) document.getElementById('hg-sheet').value=lot.sheetGiren||'';
      if(document.getElementById('hg-skt')) document.getElementById('hg-skt').value=lot.sktTarih||'';
      if(document.getElementById('hg-notlar')) document.getElementById('hg-notlar').value=lot.notlar||'';
      hgCalcStrips();
      return;
    }
  }
  if(tarihEl && !tarihEl.value) tarihEl.value=stokToday();
  if(document.getElementById('hg-lot')) document.getElementById('hg-lot').value='';
  if(document.getElementById('hg-cutoff')) document.getElementById('hg-cutoff').value='';
  if(document.getElementById('hg-sheet')) document.getElementById('hg-sheet').value='';
  if(document.getElementById('hg-skt')) document.getElementById('hg-skt').value='';
  if(document.getElementById('hg-notlar')) document.getElementById('hg-notlar').value='';
  hgCalcStrips();
}

function goHamGirisEdit(id){
  var editEl=document.getElementById('hg-edit-id');
  if(editEl) editEl.value=id||'';
  showPage('ham-giris');
}

function hgCalcStrips(){
  var katId=(document.getElementById('hg-kategori')||{}).value||'';
  var sheet=parseInt((document.getElementById('hg-sheet')||{}).value)||0;
  var sps=stokSPS(katId);
  var prev=document.getElementById('hg-strip-prev');
  if(!prev) return;
  if(!sheet||!katId){prev.textContent='—';return;}
  var k=stokKatById(katId)||{};
  prev.textContent=sheet+' sheet × '+sps+' strip/sheet = '+stokFmtN(sheet*sps)+' strip'
    +(k.firePct?' ('+k.firePct+'% fire dahil)':'');
}

function saveHamGiris(){
  stokInit();
  var lotNo=(document.getElementById('hg-lot')||{}).value.trim();
  var tarih=(document.getElementById('hg-tarih')||{}).value;
  var katId=(document.getElementById('hg-kategori')||{}).value;
  var paramKey=(document.getElementById('hg-parametre')||{}).value;
  var cutoff=((document.getElementById('hg-cutoff')||{}).value||'').trim();
  var sheetStr=(document.getElementById('hg-sheet')||{}).value;
  var sktTarih=(document.getElementById('hg-skt')||{}).value||'';
  var notlar=(document.getElementById('hg-notlar')||{}).value.trim();

  if(!lotNo) return toast('LOT No zorunludur.','error');
  if(!tarih) return toast('Tarih zorunludur.','error');
  if(!katId) return toast('Kategori seçin.','error');
  if(!paramKey) return toast('Parametre seçin.','error');
  var sheet=parseInt(sheetStr);
  if(!sheet||sheet<1) return toast('Sheet miktarı geçerli bir sayı olmalı.','error');

  var paramAd=paramKey; // kisaltma değeri
  var sps=stokSPS(katId);
  var stripMiktar=sheet*sps;

  if(_hgEditId){
    var idx=(state.hamStokLotlar||[]).findIndex(function(l){return l.id===_hgEditId;});
    if(idx>=0){
      var eski=state.hamStokLotlar[idx];
      var fark=stripMiktar-eski.stripGiren;
      state.hamStokLotlar[idx].lotNo=lotNo;
      state.hamStokLotlar[idx].tarih=tarih;
      state.hamStokLotlar[idx].kategoriId=katId;
      state.hamStokLotlar[idx].parametreAd=paramAd;
      state.hamStokLotlar[idx].cutoff=cutoff;
      state.hamStokLotlar[idx].sheetGiren=sheet;
      state.hamStokLotlar[idx].stripGiren=stripMiktar;
      state.hamStokLotlar[idx].mevcutStrip=Math.max(0,eski.mevcutStrip+fark);
      state.hamStokLotlar[idx].sktTarih=sktTarih;
      state.hamStokLotlar[idx].notlar=notlar;
    }
    toast('LOT güncellendi.','success');
  } else {
    state.hamStokLotlar.push({
      id:'hl'+Date.now(),lotNo:lotNo,tarih:tarih,
      parametreAd:paramAd,cutoff:cutoff,kategoriId:katId,
      sheetGiren:sheet,stripGiren:stripMiktar,
      mevcutStrip:stripMiktar,sktTarih:sktTarih,
      notlar:notlar,
      olusturmaTarihi:new Date().toISOString(),
      olusturanKullanici:(state.currentUser&&state.currentUser.username)||''
    });
    toast('Stok girişi kaydedildi.','success');
  }
  saveAll();
  document.getElementById('hg-edit-id').value='';
  showPage('ham-stok');
}

function stokSilHamLot(id){
  if(!confirm('Bu LOT kaydını silmek istiyor musunuz?')) return;
  state.hamStokLotlar=(state.hamStokLotlar||[]).filter(function(l){return l.id!==id;});
  saveAll(); renderHamStok(); toast('Silindi.','info');
}

// ─── HAM STOK ÇIKIŞ FORMU ────────────────────────────────────────────────────

var _hcSatirlar=[];

function renderHamCikisForm(){
  stokInit();
  _hcSatirlar=[];
  var tarihEl=document.getElementById('hc-tarih');
  if(tarihEl&&!tarihEl.value) tarihEl.value=stokToday();
  if(document.getElementById('hc-kit')) document.getElementById('hc-kit').value='';
  if(document.getElementById('hc-aciklama')) document.getElementById('hc-aciklama').value='';
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

  state.hamStokCikislar.push({
    id:'hc'+Date.now(),tarih:tarih,kategoriId:katId,
    kitMiktari:kitMiktar,aciklama:aciklama,notlar:notlar,
    satirlar:satirFinal,
    olusturmaTarihi:new Date().toISOString(),
    olusturanKullanici:(state.currentUser&&state.currentUser.username)||''
  });

  saveAll();
  toast(stokFmtN(kitMiktar)+' kit için stok çıkışı yapıldı.','success');
  showPage('ham-stok');
}

// ─── BİTMİŞ STOK GÖRÜNÜMÜ ────────────────────────────────────────────────────

function renderBitmisStok(){
  stokInit();
  var fKat=(document.getElementById('bs-f-kat')||{}).value||'';
  var fAra=((document.getElementById('bs-f-arama')||{}).value||'').toLowerCase();

  var katSel=document.getElementById('bs-f-kat');
  if(katSel){var cv=katSel.value;katSel.innerHTML='<option value="">Tüm Kategoriler</option>'+stokKatList().map(function(k){return '<option value="'+k.id+'">'+k.ad+'</option>';}).join('');katSel.value=cv;}

  var lots=(state.bitmisStokLotlar||[]).filter(function(l){
    if(fKat&&l.kategoriId!==fKat) return false;
    if(fAra&&!(l.urunAdi||'').toLowerCase().includes(fAra)&&!(l.lotNo||'').toLowerCase().includes(fAra)) return false;
    return true;
  });

  var wrap=document.getElementById('bitmis-stok-wrap'); if(!wrap) return;
  if(!lots.length){
    wrap.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">Bitmiş ürün kaydı bulunamadı.<br><button class="btn btn-primary btn-sm" style="margin-top:12px" onclick="showPage(\'bitmis-giris\')">+ Yeni Giriş</button></div>';
    return;
  }

  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr><th>Ürün Adı</th><th>LOT No</th><th>Kategori</th><th>Parametreler</th><th style="text-align:right">Giren</th><th style="text-align:right">Mevcut</th><th>Giriş Tarihi</th><th>SKT</th><th></th></tr></thead><tbody>';
  lots.slice().sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');}).forEach(function(l){
    var kat=stokKatById(l.kategoriId)||{ad:l.kategoriId};
    var paramStr=(l.parametreler||[]).join(', ');
    var skt=stokSktInfo(l.sktTarih);
    html+='<tr style="opacity:'+(l.mevcutMiktar===0?'.45':'1')+'">'
      +'<td style="font-weight:500">'+stokEsc(l.urunAdi||'—')+'</td>'
      +'<td><span class="kn-badge">'+stokEsc(l.lotNo)+'</span></td>'
      +'<td>'+stokEsc(kat.ad)+'</td>'
      +'<td style="font-size:11px;color:var(--text3)">'+stokEsc(paramStr)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+stokFmtN(l.miktar)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono);color:'+(l.mevcutMiktar===0?'var(--red)':'var(--text)')+'">'+stokFmtN(l.mevcutMiktar)+'</td>'
      +'<td style="font-size:12px;color:var(--text3)">'+stokEsc(l.tarih||'')+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:12px;color:'+skt.renk+'">'+stokEsc(l.sktTarih||'—')+(skt.etiket?' <span style="font-size:10px">('+skt.etiket+')</span>':'')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" onclick="goBitmisGirisEdit(\''+l.id+'\')">✏</button>':'')
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" onclick="stokSilBitmisLot(\''+l.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
  });
  wrap.innerHTML=html+'</tbody></table></div>';
}

// ─── BİTMİŞ STOK GİRİŞ FORMU ─────────────────────────────────────────────────

var _bgEditId=null;

function renderBitmisGirisForm(){
  stokInit();
  var editId=(document.getElementById('bg-edit-id')||{}).value||'';
  _bgEditId=editId||null;
  var titleEl=document.getElementById('bg-form-title');
  if(titleEl) titleEl.textContent=_bgEditId?'Bitmiş Ürün Düzenle':'Bitmiş Ürün Girişi';

  stokKatSelect('bg-kategori','');
  var tarihEl=document.getElementById('bg-tarih');
  if(tarihEl&&!tarihEl.value) tarihEl.value=stokToday();

  if(_bgEditId){
    var lot=(state.bitmisStokLotlar||[]).find(function(l){return l.id===_bgEditId;});
    if(lot){
      if(document.getElementById('bg-lot')) document.getElementById('bg-lot').value=lot.lotNo||'';
      if(tarihEl) tarihEl.value=lot.tarih||'';
      if(document.getElementById('bg-urun-adi')) document.getElementById('bg-urun-adi').value=lot.urunAdi||'';
      stokKatSelect('bg-kategori',lot.kategoriId);
      if(document.getElementById('bg-miktar')) document.getElementById('bg-miktar').value=lot.miktar||'';
      if(document.getElementById('bg-skt')) document.getElementById('bg-skt').value=lot.sktTarih||'';
      if(document.getElementById('bg-notlar')) document.getElementById('bg-notlar').value=lot.notlar||'';
      bgRenderParams(lot.parametreler||[]);
      return;
    }
  }
  if(document.getElementById('bg-lot')) document.getElementById('bg-lot').value='';
  if(document.getElementById('bg-urun-adi')) document.getElementById('bg-urun-adi').value='';
  if(document.getElementById('bg-miktar')) document.getElementById('bg-miktar').value='';
  if(document.getElementById('bg-skt')) document.getElementById('bg-skt').value='';
  if(document.getElementById('bg-notlar')) document.getElementById('bg-notlar').value='';
  bgRenderParams([]);
}

function goBitmisGirisEdit(id){
  var el=document.getElementById('bg-edit-id');
  if(el) el.value=id||'';
  showPage('bitmis-giris');
}

function bgRenderParams(selected){
  var el=document.getElementById('bg-params'); if(!el) return;
  selected=selected||[];
  var params=stokParamList().filter(function(p){return p.aktif!==false;});
  if(!params.length){el.innerHTML='<div style="color:var(--text3);font-size:12px">Parametreler sayfasından parametre tanımlayın.</div>';return;}
  el.innerHTML=params.map(function(p){
    var kisaltma=p.kisaltma||p.ad;
    var checked=selected.includes(kisaltma);
    var label=kisaltma+(p.ad&&p.ad!==kisaltma?' — '+p.ad:'');
    return '<label style="display:flex;align-items:center;gap:7px;font-size:13px;cursor:pointer;padding:6px 10px;border-radius:6px;background:var(--bg4);border:1px solid var(--border)">'
      +'<input type="checkbox" value="'+stokEsc(kisaltma)+'" '+(checked?'checked':'')+'>'+stokEsc(label)+'</label>';
  }).join('');
}

function saveBitmisGiris(){
  stokInit();
  var lotNo=(document.getElementById('bg-lot')||{}).value.trim();
  var tarih=(document.getElementById('bg-tarih')||{}).value;
  var urunAdi=(document.getElementById('bg-urun-adi')||{}).value.trim();
  var katId=(document.getElementById('bg-kategori')||{}).value;
  var miktar=parseInt((document.getElementById('bg-miktar')||{}).value)||0;
  var sktTarih=(document.getElementById('bg-skt')||{}).value||'';
  var notlar=(document.getElementById('bg-notlar')||{}).value.trim();
  var checked=[...document.querySelectorAll('#bg-params input[type=checkbox]:checked')].map(function(cb){return cb.value;});

  if(!lotNo) return toast('LOT No zorunludur.','error');
  if(!tarih) return toast('Tarih zorunludur.','error');
  if(!urunAdi) return toast('Ürün adı zorunludur.','error');
  if(!katId) return toast('Kategori seçin.','error');
  if(miktar<1) return toast('Miktar geçerli olmalı.','error');

  if(_bgEditId){
    var idx=(state.bitmisStokLotlar||[]).findIndex(function(l){return l.id===_bgEditId;});
    if(idx>=0){
      var eski=state.bitmisStokLotlar[idx];
      var fark=miktar-eski.miktar;
      state.bitmisStokLotlar[idx].lotNo=lotNo;
      state.bitmisStokLotlar[idx].tarih=tarih;
      state.bitmisStokLotlar[idx].urunAdi=urunAdi;
      state.bitmisStokLotlar[idx].kategoriId=katId;
      state.bitmisStokLotlar[idx].miktar=miktar;
      state.bitmisStokLotlar[idx].mevcutMiktar=Math.max(0,eski.mevcutMiktar+fark);
      state.bitmisStokLotlar[idx].parametreler=checked;
      state.bitmisStokLotlar[idx].sktTarih=sktTarih;
      state.bitmisStokLotlar[idx].notlar=notlar;
    }
    toast('Güncellendi.','success');
  } else {
    state.bitmisStokLotlar.push({
      id:'bl'+Date.now(),lotNo:lotNo,tarih:tarih,
      urunAdi:urunAdi,kategoriId:katId,parametreler:checked,
      miktar:miktar,mevcutMiktar:miktar,sktTarih:sktTarih,notlar:notlar,
      olusturmaTarihi:new Date().toISOString(),
      olusturanKullanici:(state.currentUser&&state.currentUser.username)||''
    });
    toast('Bitmiş ürün girişi kaydedildi.','success');
  }
  saveAll();
  document.getElementById('bg-edit-id').value='';
  showPage('bitmis-stok');
}

function stokSilBitmisLot(id){
  if(!confirm('Bu LOT kaydını silmek istiyor musunuz?')) return;
  state.bitmisStokLotlar=(state.bitmisStokLotlar||[]).filter(function(l){return l.id!==id;});
  saveAll(); renderBitmisStok(); toast('Silindi.','info');
}

// ─── BİTMİŞ STOK ÇIKIŞ FORMU ─────────────────────────────────────────────────

var _bcSatirlar=[];

function renderBitmisCikisForm(){
  stokInit();
  _bcSatirlar=[];
  var tarihEl=document.getElementById('bc-tarih');
  if(tarihEl&&!tarihEl.value) tarihEl.value=stokToday();
  if(document.getElementById('bc-aciklama')) document.getElementById('bc-aciklama').value='';
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

  state.bitmisCikislar.push({
    id:'bc'+Date.now(),tarih:tarih,aciklama:aciklama,notlar:notlar,
    satirlar:satirFinal,
    olusturmaTarihi:new Date().toISOString(),
    olusturanKullanici:(state.currentUser&&state.currentUser.username)||''
  });

  saveAll();
  toast('Bitmiş ürün çıkışı kaydedildi.','success');
  showPage('bitmis-stok');
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
  if(!filtered.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Hareket bulunamadı.</div>';return;}

  var TIP={'ham-giris':'Ham Giriş','ham-cikis':'Ham Çıkış / Kit','bitmis-giris':'Bitmiş Giriş','bitmis-cikis':'Bitmiş Çıkış'};
  var TCOL={'ham-giris':'var(--teal)','ham-cikis':'var(--amber)','bitmis-giris':'var(--green)','bitmis-cikis':'var(--red)'};

  var html='<div class="table-wrap"><table class="compact-table"><thead><tr>'
    +'<th>Tarih</th><th>Tür</th><th>LOT / Ref</th><th>Açıklama</th><th>Kategori</th><th style="text-align:right">Miktar</th><th>Kullanıcı</th>'
    +'</tr></thead><tbody>';
  filtered.forEach(function(h){
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
}

function stokTumHareketler(){
  var h=[];
  (state.hamStokLotlar||[]).forEach(function(l){
    h.push({id:l.id,tarih:l.tarih,tip:'ham-giris',lotNo:l.lotNo,kategoriId:l.kategoriId,
      aciklama:l.parametreAd+(l.cutoff?' ('+l.cutoff+')':''),
      miktarStr:l.sheetGiren+' sh / '+stokFmtN(l.stripGiren)+' strip',kullanici:l.olusturanKullanici||''});
  });
  (state.hamStokCikislar||[]).forEach(function(c){
    var params=(c.satirlar||[]).map(function(s){return s.parametreAd+(s.cutoff?' ('+s.cutoff+')':'');}).join(', ');
    h.push({id:c.id,tarih:c.tarih,tip:'ham-cikis',lotNo:'',ref:c.id.slice(-6),kategoriId:c.kategoriId,
      aciklama:stokEsc(c.aciklama||'')+(params?' — '+params:''),
      miktarStr:c.kitMiktari+' kit / '+stokFmtN((c.satirlar||[]).reduce(function(a,s){return a+s.stripCikis;},0))+' strip',kullanici:c.olusturanKullanici||''});
  });
  (state.bitmisStokLotlar||[]).forEach(function(l){
    h.push({id:l.id,tarih:l.tarih,tip:'bitmis-giris',lotNo:l.lotNo,kategoriId:l.kategoriId,
      aciklama:l.urunAdi+((l.parametreler&&l.parametreler.length)?' ('+l.parametreler.join(', ')+')':''),
      miktarStr:stokFmtN(l.miktar)+' adet',kullanici:l.olusturanKullanici||''});
  });
  (state.bitmisCikislar||[]).forEach(function(c){
    var acik=(c.aciklama||'')+(c.satirlar&&c.satirlar.length?' — '+(c.satirlar||[]).map(function(s){return s.urunAdi;}).join(', '):'');
    h.push({id:c.id,tarih:c.tarih,tip:'bitmis-cikis',lotNo:'',ref:c.id.slice(-6),kategoriId:((c.satirlar||[])[0]||{}).kategoriId||'',
      aciklama:acik,
      miktarStr:stokFmtN((c.satirlar||[]).reduce(function(a,s){return a+s.miktar;},0))+' adet',kullanici:c.olusturanKullanici||''});
  });
  return h.sort(function(a,b){return (b.tarih||'').localeCompare(a.tarih||'');});
}

// ─── AYARLAR ─────────────────────────────────────────────────────────────────

function loadStokAyarlar(){
  stokInit();
  stokRenderKatAyar();
  stokRenderEsikler();
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
    return;
  }
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table"><thead><tr><th style="width:40px">#</th><th>Parametre Adı</th><th>Kısaltma</th><th style="text-align:center">Durum</th><th></th></tr></thead><tbody>';
  params.forEach(function(p,i){
    var kisaltma=p.kisaltma||p.ad;
    html+='<tr>'
      +'<td style="font-family:var(--font-mono);font-size:12px;color:var(--text3)">'+(i+1)+'</td>'
      +'<td style="font-weight:500">'+stokEsc(p.ad||kisaltma)+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:13px;font-weight:600;color:var(--accent)">'+stokEsc(kisaltma)+'</td>'
      +'<td style="text-align:center">'+(p.aktif!==false
        ?'<span class="badge badge-teslim">Aktif</span>'
        :'<span class="badge" style="background:var(--bg4);color:var(--text3)">Pasif</span>')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite?'<button class="btn-icon" title="Düzenle" onclick="stokParamFormAc('+i+')">✏</button>':'')
        +(canWrite?'<button class="btn-icon" style="color:var(--red)" title="Sil" onclick="stokParamSil('+i+')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
  });
  el.innerHTML=html+'</tbody></table></div>';
}

function stokParamSil(i){
  if(!confirm('Bu parametreyi silmek istiyor musunuz?')) return;
  state.stokSettings.parametreler.splice(i,1);
  saveAll(); stokParamTabloRender(); stokRenderEsikler();
  toast('Parametre silindi.','info');
}

function stokRenderEsikler(){
  var el=document.getElementById('stok-esik-body'); if(!el) return;
  var paramAdlar=[...new Set(stokParamList().filter(function(p){return p.aktif!==false;}).map(function(p){return p.ad;}))].sort();
  var kats=stokKatList();

  if(!paramAdlar.length){el.innerHTML='<div style="color:var(--text3);font-size:13px">Önce parametre tanımlayın.</div>';return;}

  var html='<div style="overflow-x:auto"><table class="compact-table"><thead><tr><th>Parametre</th>'
    +kats.map(function(k){return '<th style="text-align:center">'+stokEsc(k.ad)+'<div style="font-size:10px;color:var(--text3);font-weight:400">min sheet</div></th>';}).join('')
    +'</tr></thead><tbody>';
  paramAdlar.forEach(function(ad){
    html+='<tr><td style="font-weight:500">'+stokEsc(ad)+'</td>';
    kats.forEach(function(k){
      var esik=((state.stokSettings.minStokEsikleri||[]).find(function(e){return e.parametreAd===ad&&e.kategoriId===k.id;})||{}).minSheet||1;
      html+='<td style="text-align:center"><input type="number" min="0" value="'+esik+'" style="width:60px;text-align:center;padding:4px 6px;font-family:var(--font-mono);font-size:13px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text)" onchange="stokEsikGuncelle(\''+stokEsc(ad)+'\',\''+k.id+'\',this.value)"></td>';
    });
    html+='</tr>';
  });
  el.innerHTML=html+'</tbody></table></div>';
}

function stokEsikGuncelle(ad,katId,val){
  if(!state.stokSettings.minStokEsikleri) state.stokSettings.minStokEsikleri=[];
  var idx=state.stokSettings.minStokEsikleri.findIndex(function(e){return e.parametreAd===ad&&e.kategoriId===katId;});
  var v=parseFloat(val)||0;
  if(idx>=0) state.stokSettings.minStokEsikleri[idx].minSheet=v;
  else state.stokSettings.minStokEsikleri.push({parametreAd:ad,kategoriId:katId,minSheet:v});
  saveAll();
}
