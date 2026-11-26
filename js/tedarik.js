// ════ TEDARİK (SATIN ALMA) ════
// Tedarik listesi: seçilen kategorilerdeki yarı mamul (sheet) ve hazır ürün (adet)
// kalemleri için, kalemin A/B/C sınıfına karşılık gelen hedef stoğa göre tedarik
// miktarı önerilir. Sınıflar her kategoride kendi içinde, son N aydaki tüketimin
// birikimli payına göre otomatik hesaplanır; kullanıcı elle değiştirebilir.

var TD_DURUMLAR=['Taslak','Tedarikçiye İletildi','Kısmi Mal Kabul','Mal Kabul Tamamlandı','İptal'];
var TD_DURUM_BADGE={'Taslak':'badge-gray','Tedarikçiye İletildi':'badge-blue','Kısmi Mal Kabul':'badge-sf','Mal Kabul Tamamlandı':'badge-teslim','İptal':'badge-reddedildi'};
var TD_HEDEF_VARSAYILAN={ham:{A:10,B:5,C:0},bitmis:{A:0,B:0,C:0}};
var TD_KAYNAK_ETIKET={ham:'Yarı Mamul',bitmis:'Hazır Ürün'};
var TD_SINIF_RENK={A:'var(--green)',B:'var(--amber)',C:'var(--text3)'};

var _tdPage=1;
var _tdExpanded=new Set();
var _tdEditId=null;
var _tdSatirlar=[];
var _tdHedefler={};   // kategori ihtiyaçları: {"ham|kategoriId": miktar}
var _tdManuelSayac=0;

// ─── Veri ─────────────────────────────────────────────────────────────────────

async function loadTedarikData(force){
  await loadStokData(force);
  try{
    var r=await Promise.all([apiGet('stok/tedarikler'),apiGet('stok/tedarik-siniflari')]);
    state.tedarikler=r[0].tedarikler||[];
    state.tedarikSiniflari=r[1].siniflar||[];
  }catch(e){
    toast(e.message||'Tedarik verileri yüklenemedi.','error');
    state.tedarikler=state.tedarikler||[];
    state.tedarikSiniflari=state.tedarikSiniflari||[];
  }
}
async function loadTedarikler(){await loadTedarikData();renderTedarikler();}
async function loadTedarikFormPage(){await loadTedarikData();renderTedarikForm();}

function tdR3(n){return Math.round((Number(n)||0)*1000)/1000;}
function tdFmt(n){return (Number(n)||0).toLocaleString('tr-TR',{maximumFractionDigits:3});}
function tdTarihTr(t){return t?t.split('-').reverse().join('.'):'—';}

function tdKategoriAd(kaynak,katId){
  if(kaynak==='ham'){var k=stokKatById(katId);return k?k.ad:(katId||'—');}
  var t=stokTicariKatById(katId);
  if(!t) return katId||'—';
  if(t.parentId){var ana=stokTicariKatById(t.parentId);return (ana?ana.ad+' › ':'')+t.ad;}
  return t.ad;
}

function tdParamBul(ad){
  var list=(state.stokSettings&&state.stokSettings.parametreler)||[];
  return list.find(function(p){return p.kisaltma&&p.kisaltma===ad;})||list.find(function(p){return p.ad===ad;})||null;
}

function tdBitmisAnahtar(l){
  return [(l.urunAdi||'').trim().toLowerCase(),(l.marka||'').trim().toLowerCase(),(l.model||'').trim().toLowerCase()].join('|');
}

// Stoktaki (tükenmiş olanlar dahil) tüm kalemler; mevcut miktarlar toplanır.
// Yarı mamulde parametre + cut-off ayrı kalemdir; sınıf parametre bazındadır.
function tdKatalog(){
  var map={};var sira=[];
  (state.hamStokLotlar||[]).forEach(function(l){
    if(!l.kategoriId||!l.parametreAd) return;
    var cutoff=(l.cutoff||'').trim();
    var key='ham|'+l.kategoriId+'|'+l.parametreAd+'|'+cutoff;
    if(!map[key]){
      var tamAd,kisaltma;
      if(l.tip==='coklu'){
        tamAd=l.parametreAd;
        kisaltma=(l.parametreler||[]).map(function(p){return p.ad;}).join(' / ');
      }else{
        var p=tdParamBul(l.parametreAd);
        tamAd=p?p.ad:l.parametreAd;
        kisaltma=p?(p.kisaltma||''):l.parametreAd;
      }
      map[key]={key:key,kaynak:'ham',kategoriId:l.kategoriId,anahtar:l.parametreAd,tamAd:tamAd,kisaltma:kisaltma,cutoff:cutoff,marka:'',model:'',mevcut:0,birim:'sheet'};
      sira.push(key);
    }
    map[key].mevcut=tdR3(map[key].mevcut+(Number(stokMevcutSheet(l))||0));
  });
  (state.bitmisStokLotlar||[]).forEach(function(l){
    if(!l.kategoriId||!(l.urunAdi||'').trim()) return;
    var anahtar=tdBitmisAnahtar(l);
    var key='bitmis|'+l.kategoriId+'|'+anahtar;
    if(!map[key]){
      var params=(l.parametreler||[]).filter(function(p){return p&&typeof p==='object';});
      var tamAd=(l.urunAdi||'').trim()+((l.marka||l.model)?' ('+[l.marka,l.model].filter(Boolean).join(' ')+')':'');
      map[key]={key:key,kaynak:'bitmis',kategoriId:l.kategoriId,anahtar:anahtar,tamAd:tamAd,
        kisaltma:params.map(function(p){return p.ad;}).filter(Boolean).join(' / '),
        cutoff:params.filter(function(p){return p.deger;}).map(function(p){return p.ad+':'+p.deger;}).join(' · '),
        marka:l.marka||'',model:l.model||'',mevcut:0,birim:'adet'};
      sira.push(key);
    }
    map[key].mevcut=tdR3(map[key].mevcut+(Number(l.mevcutMiktar)||0));
  });
  return sira.map(function(k){return map[k];});
}

// Son N aydaki tüketim: sınıf anahtarı (kaynak|kategori|anahtar) → miktar.
// Sayım düzeltmesinden doğan çıkışlar tüketim sayılmaz.
function tdTuketimler(){
  var ay=(state.stokSettings&&state.stokSettings.tedarikDonemAy)||6;
  var d=new Date();d.setMonth(d.getMonth()-ay);
  var since=d.toISOString().slice(0,10);
  var out={};
  var hamLot={};(state.hamStokLotlar||[]).forEach(function(l){hamLot[l.id]=l;});
  (state.hamStokCikislar||[]).forEach(function(c){
    if((c.tarih||'')<since||c.aciklama==='Stok Sayım Eksiği') return;
    (c.satirlar||[]).forEach(function(s){
      var l=hamLot[s.lotId]||{};
      var kat=l.kategoriId||s.kategoriId; var ad=l.parametreAd||s.parametreAd;
      if(!kat||!ad) return;
      var k='ham|'+kat+'|'+ad;
      out[k]=(out[k]||0)+(Number(s.sheetCikis)||0)+(Number(s.fireSheet)||0);
    });
  });
  var bmLot={};(state.bitmisStokLotlar||[]).forEach(function(l){bmLot[l.id]=l;});
  (state.bitmisCikislar||[]).forEach(function(c){
    if((c.tarih||'')<since||c.aciklama==='Stok Sayım Eksiği') return;
    (c.satirlar||[]).forEach(function(s){
      var l=bmLot[s.lotId];
      if(!l||!l.kategoriId) return;
      var k='bitmis|'+l.kategoriId+'|'+tdBitmisAnahtar(l);
      out[k]=(out[k]||0)+(Number(s.miktar)||0);
    });
  });
  return out;
}

// Her kategori kendi içinde: tüketime göre büyükten küçüğe sıralanır; birikimli
// payı A% sınırına kadar olanlar A, sonraki B% B, kalanlar ve tüketimi olmayanlar C.
function tdSiniflar(katalog){
  katalog=katalog||tdKatalog();
  var tuk=tdTuketimler();
  var pA=(state.stokSettings&&state.stokSettings.tedarikSinifA)||70;
  var pB=(state.stokSettings&&state.stokSettings.tedarikSinifB)||0;
  var elle={};(state.tedarikSiniflari||[]).forEach(function(s){elle[s.kaynak+'|'+s.kategoriId+'|'+s.anahtar]=s.sinif;});
  var gruplar={};
  katalog.forEach(function(r){
    var g=r.kaynak+'|'+r.kategoriId;
    var sk=g+'|'+r.anahtar;
    if(!gruplar[g]) gruplar[g]={};
    gruplar[g][sk]=1;
  });
  var out={};
  Object.keys(gruplar).forEach(function(g){
    var keys=Object.keys(gruplar[g]);
    var toplam=keys.reduce(function(a,k){return a+(tuk[k]||0);},0);
    keys.sort(function(a,b){return (tuk[b]||0)-(tuk[a]||0);});
    var birikimli=0;
    keys.forEach(function(k){
      var t=tuk[k]||0;
      var once=toplam>0?birikimli/toplam*100:100;
      var oto=(t<=0||toplam<=0)?'C':(once<pA?'A':(once<pA+pB?'B':'C'));
      birikimli+=t;
      out[k]={oto:oto,sinif:elle[k]||oto,manuel:!!elle[k],tuketim:tdR3(t),pay:toplam>0?Math.round(t/toplam*1000)/10:0};
    });
  });
  return out;
}
function tdSinifKey(r){return r.kaynak+'|'+r.kategoriId+'|'+r.anahtar;}

async function tdSinifKaydet(kaynak,kategoriId,anahtar,sinif){
  await apiPut('stok/tedarik-siniflari',{kaynak:kaynak,kategoriId:kategoriId,anahtar:anahtar,sinif:sinif||null});
  var list=(state.tedarikSiniflari||[]).filter(function(s){return !(s.kaynak===kaynak&&s.kategoriId===kategoriId&&s.anahtar===anahtar);});
  if(sinif) list.push({kaynak:kaynak,kategoriId:kategoriId,anahtar:anahtar,sinif:sinif});
  state.tedarikSiniflari=list;
}

// ─── Liste sayfası ────────────────────────────────────────────────────────────

function tdMiktarOzet(t){
  var sh=0,ad=0;
  (t.kalemler||[]).forEach(function(k){if(k.birim==='adet')ad+=k.miktar;else sh+=k.miktar;});
  var p=[];if(sh)p.push(tdFmt(sh)+' sheet');if(ad)p.push(tdFmt(ad)+' adet');
  return p.join(' · ')||'—';
}

function renderTedarikler(){
  var fAra=((document.getElementById('tdl-arama')||{}).value||'').toLocaleLowerCase('tr');
  var fDurum=(document.getElementById('tdl-durum')||{}).value||'';
  var list=(state.tedarikler||[]).filter(function(t){
    if(fDurum&&t.durum!==fDurum) return false;
    if(fAra&&!((t.evrakNo||'')+' '+(t.tedarikci||'')+' '+(t.notlar||'')).toLocaleLowerCase('tr').includes(fAra)) return false;
    return true;
  });
  var wrap=document.getElementById('tedarikler-wrap'); if(!wrap) return;
  if(!list.length){wrap.innerHTML='<div style="padding:40px;text-align:center;color:var(--text3)">Tedarik listesi bulunamadı.</div>';renderPagination('tedarikler-pagination',1,0,'setTedariklerPage');return;}
  var toplam=list.length;
  list=list.slice((_tdPage-1)*PAGE_SIZE,_tdPage*PAGE_SIZE);
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var html='<div class="table-wrap"><table class="compact-table" data-resize-key="stok-tedarikler"><thead><tr>'
    +'<th style="width:28px"></th><th>Tedarik No</th><th style="width:90px">Tarih</th><th>Tedarikçi</th><th style="width:70px;text-align:center">Kalem</th><th>Miktar</th><th style="width:170px">Durum</th><th></th>'
    +'</tr></thead><tbody>';
  list.forEach(function(t){
    var exp=_tdExpanded.has(t.id);
    var taslak=t.durum==='Taslak';
    html+='<tr style="cursor:pointer;background:var(--bg3)" onclick="tdToggle(\''+t.id+'\')">'
      +'<td style="text-align:center;color:var(--amber);font-weight:700">'+(exp?'<i class="ti ti-arrow-narrow-down"></i>':'<i class="ti ti-arrow-narrow-right"></i>')+'</td>'
      +'<td><span class="kn-badge">'+esc(t.evrakNo||'—')+'</span></td>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+tdTarihTr(t.tarih)+'</td>'
      +'<td style="font-size:12px">'+esc(t.tedarikci||'—')+'</td>'
      +'<td style="text-align:center;font-family:var(--font-mono)">'+(t.kalemler||[]).length+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:12px">'+tdMiktarOzet(t)+'</td>'
      +'<td><span class="badge '+(TD_DURUM_BADGE[t.durum]||'badge-gray')+'">'+esc(t.durum)+'</span>'
        +(tdKabulVarMi(t)?'<span style="font-size:11px;font-family:var(--font-mono);color:var(--text3);margin-left:6px">%'+tdKabulYuzde(t)+'</span>':'')+'</td>'
      +'<td><div class="action-row">'
        +(canWrite&&TD_KABUL_DURUMLARI.indexOf(t.durum)>=0?['ham','bitmis'].filter(function(kaynak){return tdKaynakKalan(t,kaynak).length;}).map(function(kaynak){
          return '<button class="btn btn-ghost btn-sm" style="color:var(--accent)" onclick="event.stopPropagation();tdMalKabulBaslat(\''+t.id+'\',\''+kaynak+'\')" title="Gelen '+TD_KAYNAK_ETIKET[kaynak].toLocaleLowerCase('tr')+' kalemlerini stoğa giriş yap"><i class="ti ti-package-import"></i> '+(kaynak==='ham'?'Yarı Mamul':'Hazır Ürün')+' Mal Kabul</button>';
        }).join(''):'')
        +'<button class="btn btn-ghost btn-sm" style="color:var(--green)" onclick="event.stopPropagation();tdExcel(\''+t.id+'\')" title="Tedarikçiye gönderilecek Excel listesi"><i class="ti ti-file-download"></i> Excel</button>'
        +(canWrite&&taslak?'<button class="btn-icon" onclick="event.stopPropagation();goTedarikDuzenle(\''+t.id+'\')" title="Düzenle"><i class="ti ti-edit"></i></button>':'')
        +(canWrite&&(taslak||t.durum==='İptal')&&!tdKabulVarMi(t)?'<button class="btn-icon" style="color:var(--red)" onclick="event.stopPropagation();tdSil(\''+t.id+'\')" title="Sil"><i class="ti ti-trash"></i></button>':'')
      +'</div></td></tr>';
    if(exp){
      var sub='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 10px">';
      if(canWrite){
        sub+='<label style="font-size:12px;color:var(--text2)">Durum</label><select onchange="tdDurumDegistir(\''+t.id+'\',this.value)" style="font-size:12px;padding:4px 8px">'
          +TD_DURUMLAR.filter(function(d){return d!=='Taslak'||t.durum==='Taslak'||!tdKabulVarMi(t);}).map(function(d){return '<option'+(d===t.durum?' selected':'')+'>'+esc(d)+'</option>';}).join('')+'</select>';
      }
      if(t.notlar) sub+='<span style="font-size:12px;color:var(--text3)">Not: '+esc(t.notlar)+'</span>';
      var girisler=tdBagliGirisler(t);
      var gEvrak=Object.keys(girisler);
      if(gEvrak.length) sub+='<span style="font-size:12px;color:var(--text3)">Mal kabul girişleri: '+gEvrak.map(function(e){return '<span class="kn-badge">'+esc(e)+'</span>';}).join(' ')+'</span>';
      var kabulGoster=t.durum!=='Taslak';
      sub+='</div><table class="compact-table" style="width:100%;margin:0" data-resize-key="stok-tedarikler-detay"><thead><tr style="background:var(--bg4)">'
        +'<th>Tür</th><th>Kategori</th><th style="width:50px;text-align:center">Sınıf</th><th class="col-name">Tam Adı</th><th>Kısaltma</th><th>Cut-off</th><th style="text-align:right">Mevcut (o an)</th><th style="text-align:right">Tedarik Miktarı</th>'
        +(kabulGoster?'<th style="text-align:right">Kabul Edilen</th><th style="text-align:right">Kalan</th>':'')
        +'</tr></thead><tbody>';
      (t.kalemler||[]).forEach(function(k){
        var kalan=tdKalan(k); var kabul=Number(k.kabulEdilen)||0;
        sub+='<tr>'
          +'<td style="font-size:12px">'+TD_KAYNAK_ETIKET[k.kaynak]+(k.manuel?' <span style="font-size:10px;color:var(--text3)">(manuel)</span>':'')+'</td>'
          +'<td style="font-size:12px">'+esc(tdKategoriAd(k.kaynak,k.kategoriId))+'</td>'
          +'<td style="text-align:center;font-weight:700;color:'+(TD_SINIF_RENK[k.sinif]||'var(--text3)')+'">'+esc(k.sinif||'—')+'</td>'
          +'<td class="col-name" style="font-weight:500">'+esc(k.tamAd)+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(k.kisaltma||'—')+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(k.cutoff||'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">'+(k.mevcut!=null?tdFmt(k.mevcut):'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono);font-weight:600">'+tdFmt(k.miktar)+' '+k.birim+'</td>'
          +(kabulGoster?'<td style="text-align:right;font-family:var(--font-mono);color:'+(kabul>0?'var(--green)':'var(--text3)')+'">'+(kabul>0?tdFmt(kabul):'—')+'</td>'
            +'<td style="text-align:right;font-family:var(--font-mono);font-weight:600;color:'+(kalan>0?'var(--amber)':'var(--green)')+'">'+(kalan>0?tdFmt(kalan):'✓')+'</td>':'')
          +'</tr>';
      });
      sub+='</tbody></table>';
      html+='<tr style="border-bottom:2px solid var(--border2)"><td colspan="8" style="padding:0 0 8px 32px;background:var(--bg)">'+sub+'</td></tr>';
    }
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('tedarikler-pagination',_tdPage,toplam,'setTedariklerPage');
}
function setTedariklerPage(p){_tdPage=p;renderTedarikler();}
function tdToggle(id){if(_tdExpanded.has(id))_tdExpanded.delete(id);else _tdExpanded.add(id);renderTedarikler();}

async function tdDurumDegistir(id,durum){
  try{
    var res=await apiPut('stok/tedarikler',{id:id,durum:durum});
    state.tedarikler=(state.tedarikler||[]).map(function(t){return t.id===id?res.tedarik:t;});
    toast('Durum güncellendi: '+durum,'success');
  }catch(e){toast(e.message||'Durum güncellenemedi.','error');}
  renderTedarikler();
}

function tdSil(id){
  showConfirm('Bu tedarik listesi silinecek. Emin misiniz?',async function(){
    try{await apiDelete('stok/tedarikler?id='+encodeURIComponent(id));}
    catch(e){toast(e.message||'Silinemedi.','error');return;}
    state.tedarikler=(state.tedarikler||[]).filter(function(t){return t.id!==id;});
    renderTedarikler();toast('Tedarik listesi silindi.','success');
  });
}

// Tedarikçiye gönderilecek Excel: tam adı, kısaltma, cut-off, kategori ve miktar.
function tdExcel(id){
  var t=(state.tedarikler||[]).find(function(x){return x.id===id;}); if(!t) return;
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var aoa=[['Tedarik Listesi',t.evrakNo||''],['Tarih',tdTarihTr(t.tarih)]];
  if(t.tedarikci) aoa.push(['Tedarikçi',t.tedarikci]);
  if(t.notlar) aoa.push(['Not',t.notlar]);
  aoa.push([]);
  aoa.push(['Sıra','Tür','Kategori','Tam Adı','Kısaltma','Cut-off','Miktar','Birim']);
  (t.kalemler||[]).forEach(function(k,i){
    aoa.push([i+1,TD_KAYNAK_ETIKET[k.kaynak]||'',tdKategoriAd(k.kaynak,k.kategoriId),k.tamAd||'',k.kisaltma||'',k.cutoff||'',k.miktar,k.birim==='adet'?'Adet':'Sheet']);
  });
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols']=[{wch:6},{wch:12},{wch:24},{wch:34},{wch:18},{wch:30},{wch:10},{wch:8}];
  XLSX.utils.book_append_sheet(wb,ws,'Tedarik Listesi');
  var dosya=(t.evrakNo||'tedarik')+(t.tedarikci?' - '+t.tedarikci:'');
  XLSX.writeFile(wb,dosya.replace(/[\\\/:*?"<>|]/g,'_')+'.xlsx');
}

// ─── Form ─────────────────────────────────────────────────────────────────────
// Ana form yalnızca listeye aktarılan kalemleri gösterir. Kalemler üç yoldan eklenir:
//  • Yarı Mamul Önerileri / Hazır Ürün Ekle: kategori sekmeli pencere; kategoriye
//    tek bir ihtiyaç miktarı yazılır, öneri = ihtiyaç − mevcut. Miktarlar düzeltilir,
//    istenmeyenler X ile çıkarılır, "Listeye Aktar" ile ana listeye geçer.
//  • Yeni Kalem: stokta hiç kaydı olmayan ürün (çoklu parametre + cut-off girilebilir).

function goTedarikYeni(){_tdEditId=null;showPage('tedarik');}
function goTedarikDuzenle(id){_tdEditId=id;showPage('tedarik');}

function tdSonrakiEvrak(){
  var prefix=(state.stokSettings&&state.stokSettings.tedarikPrefix)||'TD';
  var mx=0;
  (state.tedarikler||[]).forEach(function(t){
    var m=(t.evrakNo||'').match(new RegExp('^'+prefix.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'-(\\d+)$'));
    if(m) mx=Math.max(mx,parseInt(m[1],10));
  });
  return prefix+'-'+String(mx+1).padStart(5,'0');
}

// Kategori listesi: tüm yarı mamul kategorileri + kalemi olan hazır ürün kategorileri
function tdKapsamListesi(){
  var out=stokKatList().map(function(k){return {kaynak:'ham',kategoriId:k.id,ad:k.ad};});
  var bmKatlar={};
  (state.bitmisStokLotlar||[]).forEach(function(l){if(l.kategoriId) bmKatlar[l.kategoriId]=1;});
  Object.keys(bmKatlar).map(function(id){return {kaynak:'bitmis',kategoriId:id,ad:tdKategoriAd('bitmis',id)};})
    .sort(function(a,b){return a.ad.localeCompare(b.ad,'tr');})
    .forEach(function(x){out.push(x);});
  return out;
}

function tdSiraKarsilastir(x,y){return (x.tamAd||'').localeCompare(y.tamAd||'','tr')||(x.cutoff||'').localeCompare(y.cutoff||'','tr');}
function tdEsc(s){return esc(s).replace(/'/g,"\\'");}
function tdKayitKey(k){return k.kaynak==='ham'?('ham|'+k.kategoriId+'|'+k.anahtar+'|'+(k.cutoff||'')):('bitmis|'+k.kategoriId+'|'+k.anahtar);}

function renderTedarikForm(){
  var t=_tdEditId?(state.tedarikler||[]).find(function(x){return x.id===_tdEditId;}):null;
  if(_tdEditId&&(!t||t.durum!=='Taslak')){
    toast('Yalnızca taslak tedarik listeleri düzenlenebilir.','error');
    _tdEditId=null;showPage('tedarikler');return;
  }
  var baslik=document.getElementById('td-form-baslik');
  if(baslik) baslik.textContent=t?('Tedarik Listesini Düzenle — '+t.evrakNo):'Yeni Tedarik Listesi';
  document.getElementById('td-evrak').value=t?t.evrakNo:tdSonrakiEvrak();
  document.getElementById('td-tarih').value=t?(t.tarih||stokToday()):stokToday();
  var sonTedarikci=((state.tedarikler||[])[0]||{}).tedarikci||'';
  document.getElementById('td-tedarikci').value=t?(t.tedarikci||''):sonTedarikci;
  document.getElementById('td-notlar').value=t?(t.notlar||''):'';

  // Kategori ihtiyaçları: düzenlenen listeden, yoksa en son listeden hatırlanır
  var son=(state.tedarikler||[]).find(function(x){return x.hedefler&&x.hedefler.kategoriler;});
  _tdHedefler=Object.assign({},(t&&t.hedefler&&t.hedefler.kategoriler)||(son&&son.hedefler.kategoriler)||{});
  _tdOneri=null;
  _tdCikarilanlar={};

  // Düzenlemede yalnızca kayıtlı kalemler gelir
  _tdSatirlar=[];
  if(t){
    var katalog=tdKatalog();
    var sinif=tdSiniflar(katalog);
    var byKey={};katalog.forEach(function(r){byKey[r.key]=r;});
    (t.kalemler||[]).forEach(function(k){
      var kat=!k.manuel?byKey[tdKayitKey(k)]:null;
      if(kat){
        _tdSatirlar.push(Object.assign({},kat,{sinif:(sinif[tdSinifKey(kat)]||{}).sinif||k.sinif||'',miktar:k.miktar,hedef:k.hedef,manuel:false}));
      }else{
        _tdSatirlar.push({key:'m'+(++_tdManuelSayac),kaynak:k.kaynak,kategoriId:k.kategoriId,anahtar:k.anahtar||'',tamAd:k.tamAd,kisaltma:k.kisaltma||'',cutoff:k.cutoff||'',
          parametreler:tdCutoffParametreler(k.kisaltma,k.cutoff),marka:k.marka||'',model:k.model||'',mevcut:k.mevcut,hedef:k.hedef,
          birim:k.birim||(k.kaynak==='ham'?'sheet':'adet'),sinif:k.sinif||'',manuel:true,miktar:k.miktar});
      }
    });
  }
  tdRenderSatirlar();
}

function tdSatirBul(key){
  if(key==='yeni') return _tdYeniTaslak;
  return _tdSatirlar.find(function(r){return r.key===key;});
}

// Ana listedeki kalemler, kategori grupları halinde (ekrandaki ve kayıttaki sıra)
function tdGruplar(){
  var sira=tdKapsamListesi().map(function(x){return x.kaynak+'|'+x.kategoriId;});
  var gruplar={};
  _tdSatirlar.forEach(function(r){
    var g=r.kaynak+'|'+(r.kategoriId||'');
    if(!gruplar[g]){
      gruplar[g]={key:g,kaynak:r.kaynak,kategoriId:r.kategoriId,ad:tdKategoriAd(r.kaynak,r.kategoriId),satirlar:[]};
      if(sira.indexOf(g)<0) sira.push(g);
    }
    gruplar[g].satirlar.push(r);
  });
  return sira.filter(function(g){return gruplar[g];}).map(function(g){
    gruplar[g].satirlar.sort(tdSiraKarsilastir);
    return gruplar[g];
  });
}

function tdRenderSatirlar(){
  var el=document.getElementById('td-satirlar'); if(!el) return;
  var gruplar=tdGruplar();
  if(!gruplar.length){
    el.innerHTML='<div style="padding:28px;text-align:center;color:var(--text3);font-size:13px;border:1px dashed var(--border);border-radius:var(--radius-sm)">'
      +'Liste boş. <b>Yarı Mamul Önerileri</b> veya <b>Hazır Ürün Ekle</b> ile stoktaki ürünlerden, <b>Yeni Kalem</b> ile stokta olmayan bir üründen ekleyin.</div>';
    tdOzetRender();return;
  }
  var thead='<thead><tr><th style="width:50px;text-align:center">Sınıf</th><th class="col-name">Tam Adı</th><th>Kısaltma</th><th>Cut-off</th>'
    +'<th style="text-align:right;width:90px">Mevcut</th><th style="width:140px">Tedarik Miktarı</th><th style="width:34px"></th></tr></thead>';
  el.innerHTML=gruplar.map(function(g){
    var birim=g.kaynak==='ham'?'sheet':'adet';
    var top=g.satirlar.reduce(function(a,r){return a+(Number(r.miktar)||0);},0);
    return '<div class="td-bolum"><div class="td-bolum-baslik"><span>'+esc(g.ad)+' <span style="font-weight:400;color:var(--text3)">· '+TD_KAYNAK_ETIKET[g.kaynak]+' · '+g.satirlar.length+' kalem</span></span>'
      +'<span style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">'+tdFmt(top)+' '+birim+'</span></div>'
      +'<div class="table-wrap"><table class="compact-table" style="width:100%">'+thead+'<tbody>'
      +g.satirlar.map(function(r){
        var k=tdEsc(r.key);
        return '<tr'+(!(r.miktar>0)?' style="opacity:.55"':'')+'>'
          +'<td style="text-align:center;font-weight:700;color:'+(TD_SINIF_RENK[r.sinif]||'var(--text3)')+'">'+esc(r.sinif||'—')+'</td>'
          +'<td class="col-name" style="font-weight:500">'+esc(r.tamAd)+(r.manuel?' <span class="badge badge-blue" style="font-size:10px">yeni</span>':'')+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(r.kisaltma||'—')+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(r.cutoff||'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">'+(r.mevcut!=null?tdFmt(r.mevcut):'—')+'</td>'
          +'<td><div style="display:flex;align-items:center;gap:4px"><input type="number" min="0" step="'+(r.kaynak==='ham'?'0.001':'1')+'" value="'+(r.miktar||'')+'" placeholder="0" style="width:100%" onchange="tdMiktarDegis(\''+k+'\',this.value)"><span style="font-size:11px;color:var(--text3)">'+(r.kaynak==='ham'?'sh':'ad')+'</span></div></td>'
          +'<td><button class="btn-icon" style="color:var(--red)" onclick="tdSatirSil(\''+k+'\')" title="Listeden çıkar"><i class="ti ti-x"></i></button></td>'
          +'</tr>';
      }).join('')+'</tbody></table></div></div>';
  }).join('');
  tdOzetRender();
}

function tdMiktarDegis(key,val){
  var r=tdSatirBul(key); if(!r) return;
  var n=Math.max(0,parseFloat(String(val).replace(',','.'))||0);
  r.miktar=r.kaynak==='ham'?tdR3(n):Math.round(n);
  tdRenderSatirlar();
}
function tdSatirSil(key){
  // Ana listeden çıkarılan stok kalemi öneri penceresinde de tekrar önerilmez (geri alınabilir)
  var r=tdSatirBul(key); if(r&&!r.manuel) _tdCikarilanlar[key]=1;
  _tdSatirlar=_tdSatirlar.filter(function(x){return x.key!==key;});tdRenderSatirlar();
}

function tdSeciliSatirlar(){return _tdSatirlar.filter(function(r){return r.miktar>0;});}

function tdOzetRender(){
  var el=document.getElementById('td-ozet'); if(!el) return;
  var sec=tdSeciliSatirlar();
  var sh=0,ad=0;sec.forEach(function(r){if(r.kaynak==='ham')sh+=r.miktar;else ad+=r.miktar;});
  el.innerHTML='<b>'+sec.length+'</b> kalem'+(sh?' · <b>'+tdFmt(sh)+'</b> sheet':'')+(ad?' · <b>'+tdFmt(ad)+'</b> adet':'');
}

// ─── Öneri penceresi (Yarı Mamul Önerileri / Hazır Ürün Ekle) ───

var _tdOneri=null; // {kaynak, katlar:[{key,ad}], aktif, satirlar:[], tumu, arama}
var _tdCikarilanlar={}; // X ile çıkarılan stok kalemleri (form açık kaldıkça tekrar önerilmez)

function tdOneriAc(kaynak){
  var katalog=tdKatalog().filter(function(r){return r.kaynak===kaynak;});
  var sinif=tdSiniflar();
  var listede={};_tdSatirlar.forEach(function(r){if(!r.manuel)listede[r.key]=r;});
  var satirlar=katalog.map(function(r){
    var s=sinif[tdSinifKey(r)]||{};var l=listede[r.key];
    return Object.assign({},r,{sinif:s.sinif||'C',tuketim:s.tuketim||0,listede:!!l,miktar:l?l.miktar:0,elle:!!l,cikarildi:!l&&!!_tdCikarilanlar[r.key]});
  });
  var katlar=tdKapsamListesi().filter(function(x){return x.kaynak===kaynak&&satirlar.some(function(r){return r.kategoriId===x.kategoriId;});})
    .map(function(x){return {key:x.kaynak+'|'+x.kategoriId,ad:x.ad};});
  if(!katlar.length) return toast('Stokta kayıtlı '+TD_KAYNAK_ETIKET[kaynak].toLocaleLowerCase('tr')+' bulunamadı. "Yeni Kalem" ile ekleyebilirsiniz.','info');
  var oncekiAktif=_tdOneri&&_tdOneri.kaynak===kaynak?_tdOneri.aktif:null;
  _tdOneri={kaynak:kaynak,katlar:katlar,aktif:katlar.some(function(k){return k.key===oncekiAktif;})?oncekiAktif:katlar[0].key,satirlar:satirlar,tumu:false,arama:''};
  tdOneriHesapla();
  document.getElementById('td-oneri-baslik').textContent=kaynak==='ham'?'Yarı Mamul Önerileri':'Hazır Ürün Ekle';
  tdOneriRender();
  openModal('modal-td-oneri');
}

function tdOneriHedef(katKey){
  var v=_tdHedefler[katKey];
  return (v===undefined||v===null||v==='')?null:Number(v);
}

// Elle değiştirilmemiş satırlarda öneri = ihtiyaç − mevcut (tam sayıya yukarı)
function tdOneriHesapla(){
  _tdOneri.satirlar.forEach(function(r){
    var h=tdOneriHedef(r.kaynak+'|'+r.kategoriId);
    r.hedef=h;
    if(r.elle||r.cikarildi) return;
    r.miktar=h===null?0:(r.mevcut<h?Math.ceil(tdR3(h-r.mevcut)):0);
  });
}

function tdOneriAktifSatirlar(){return _tdOneri.satirlar.filter(function(r){return r.kaynak+'|'+r.kategoriId===_tdOneri.aktif;});}
function tdOneriAktarilacak(){return _tdOneri.satirlar.filter(function(r){return !r.cikarildi&&r.miktar>0;});}

function tdOneriRender(){
  if(!_tdOneri) return;
  var o=_tdOneri;
  var birim=o.kaynak==='ham'?'sheet':'adet';
  document.getElementById('td-oneri-sekmeler').innerHTML=o.katlar.map(function(k){
    var n=o.satirlar.filter(function(r){return r.kaynak+'|'+r.kategoriId===k.key&&!r.cikarildi&&r.miktar>0;}).length;
    return '<button type="button" class="td-sekme'+(k.key===o.aktif?' td-sekme-on':'')+'" onclick="tdOneriSekme(\''+tdEsc(k.key)+'\')">'+esc(k.ad)
      +(n?' <span class="td-sekme-say">'+n+'</span>':'')+'</button>';
  }).join('');
  var h=tdOneriHedef(o.aktif);
  var cikan=tdOneriAktifSatirlar().filter(function(r){return r.cikarildi;}).length;
  document.getElementById('td-oneri-arac').innerHTML=
    '<label style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--text)">İhtiyaç'
      +'<input type="number" min="0" step="1" value="'+(h===null?'':h)+'" placeholder="—" style="width:90px;text-align:center" onchange="tdOneriHedefDegis(this.value)">'
      +'<span style="font-weight:400;color:var(--text3)">'+birim+'</span></label>'
    +'<input type="text" placeholder="Ara..." value="'+esc(o.arama)+'" style="min-width:200px" oninput="_tdOneri.arama=this.value;tdOneriRenderTablo()">'
    +(h!==null?'<label style="display:flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);cursor:pointer"><input type="checkbox"'+(o.tumu?' checked':'')+' onchange="_tdOneri.tumu=this.checked;tdOneriRenderTablo()"> Önerisi olmayanları da göster</label>':'')
    +(cikan?'<button class="btn btn-ghost btn-sm" onclick="tdOneriGeriAl()"><i class="ti ti-arrow-back-up"></i> Çıkarılan '+cikan+' kalemi geri al</button>':'')
    +'<span style="font-size:12px;color:var(--text3);margin-left:auto">'+(h===null?'İhtiyaç girerseniz öneri = ihtiyaç − mevcut hesaplanır; girmezseniz miktarları elle yazabilirsiniz.':'Öneri = ihtiyaç − mevcut. Miktarları değiştirebilir, istemediklerinizi X ile çıkarabilirsiniz.')+'</span>';
  tdOneriRenderTablo();
}

function tdOneriRenderTablo(){
  var o=_tdOneri; if(!o) return;
  var h=tdOneriHedef(o.aktif);
  var ara=(o.arama||'').toLocaleLowerCase('tr').trim();
  var rows=tdOneriAktifSatirlar().filter(function(r){
    if(r.cikarildi) return false;
    if(h!==null&&!o.tumu&&!(r.miktar>0)&&!r.listede) return false;
    if(ara&&!((r.tamAd||'')+' '+(r.kisaltma||'')+' '+(r.cutoff||'')).toLocaleLowerCase('tr').includes(ara)) return false;
    return true;
  }).sort(function(x,y){return (y.tuketim-x.tuketim)||tdSiraKarsilastir(x,y);});
  var el=document.getElementById('td-oneri-tablo');
  if(!rows.length){
    el.innerHTML='<div style="padding:24px;text-align:center;color:var(--text3);font-size:12px">'+(ara?'Aramaya uyan ürün yok.':(h!==null?'Bu kategoride ihtiyacın altında kalan ürün yok.':'Bu kategoride ürün yok.'))+'</div>';
  }else{
    var ay=(state.stokSettings&&state.stokSettings.tedarikDonemAy)||6;
    el.innerHTML='<div class="table-wrap"><table class="compact-table" style="width:100%"><thead><tr>'
      +'<th style="width:50px;text-align:center">Sınıf</th><th class="col-name">Tam Adı</th><th>Kısaltma</th><th>Cut-off</th>'
      +'<th style="text-align:right;width:100px" title="Son '+ay+' aydaki çıkışlar">Tüketim ('+ay+' ay)</th><th style="text-align:right;width:80px">Mevcut</th><th style="width:140px">Tedarik Miktarı</th><th style="width:34px"></th>'
      +'</tr></thead><tbody>'
      +rows.map(function(r){
        var k=tdEsc(r.key);
        return '<tr'+(!(r.miktar>0)?' style="opacity:.6"':'')+'>'
          +'<td style="text-align:center;font-weight:700;color:'+(TD_SINIF_RENK[r.sinif]||'var(--text3)')+'">'+esc(r.sinif)+'</td>'
          +'<td class="col-name" style="font-weight:500">'+esc(r.tamAd)+(r.listede?' <span class="badge badge-teslim" style="font-size:10px">listede</span>':'')+(r.mevcut>0?'':' <span class="badge badge-gray" style="font-size:10px">tükenmiş</span>')+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(r.kisaltma||'—')+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(r.cutoff||'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text3)">'+(r.tuketim?tdFmt(r.tuketim):'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono)">'+tdFmt(r.mevcut)+'</td>'
          +'<td><div style="display:flex;align-items:center;gap:4px"><input type="number" min="0" step="'+(r.kaynak==='ham'?'0.001':'1')+'" value="'+(r.miktar||'')+'" placeholder="0" style="width:100%;'+(r.elle?'border-color:var(--amber)':'')+'" onchange="tdOneriMiktar(\''+k+'\',this.value)"><span style="font-size:11px;color:var(--text3)">'+(r.kaynak==='ham'?'sh':'ad')+'</span></div></td>'
          +'<td><button class="btn-icon" style="color:var(--red)" onclick="tdOneriCikar(\''+k+'\')" title="Listeden çıkar"><i class="ti ti-x"></i></button></td>'
          +'</tr>';
      }).join('')+'</tbody></table></div>';
  }
  var akt=tdOneriAktarilacak();
  var sh=0,ad=0;akt.forEach(function(r){if(r.kaynak==='ham')sh+=r.miktar;else ad+=r.miktar;});
  document.getElementById('td-oneri-ozet').innerHTML='Aktarılacak: <b>'+akt.length+'</b> kalem'+(sh?' · <b>'+tdFmt(sh)+'</b> sheet':'')+(ad?' · <b>'+tdFmt(ad)+'</b> adet':'')+' <span style="color:var(--text3)">(tüm sekmeler)</span>';
}

function tdOneriSatir(key){return _tdOneri.satirlar.find(function(r){return r.key===key;});}
function tdOneriSekme(key){_tdOneri.aktif=key;_tdOneri.arama='';tdOneriRender();}
function tdOneriHedefDegis(val){
  var v=String(val).trim();
  if(v==='') delete _tdHedefler[_tdOneri.aktif];
  else _tdHedefler[_tdOneri.aktif]=Math.max(0,parseFloat(v.replace(',','.'))||0);
  // İhtiyaç değişince o kategoride elle girilmemiş miktarlar yeniden hesaplanır
  tdOneriHesapla();tdOneriRender();
}
function tdOneriMiktar(key,val){
  var r=tdOneriSatir(key); if(!r) return;
  var n=Math.max(0,parseFloat(String(val).replace(',','.'))||0);
  r.miktar=r.kaynak==='ham'?tdR3(n):Math.round(n);
  r.elle=true;
  tdOneriRender();
}
function tdOneriCikar(key){
  var r=tdOneriSatir(key); if(!r) return;
  r.cikarildi=true;r.miktar=0;_tdCikarilanlar[key]=1;
  tdOneriRender();
}
function tdOneriGeriAl(){
  tdOneriAktifSatirlar().forEach(function(r){if(r.cikarildi){r.cikarildi=false;r.elle=r.listede;delete _tdCikarilanlar[r.key];}});
  tdOneriHesapla();tdOneriRender();
}

// Miktarı olanlar ana listeye eklenir / güncellenir; listede olup pencerede
// çıkarılan veya 0 yapılanlar ana listeden de çıkarılır.
function tdOneriAktar(){
  var o=_tdOneri; if(!o) return;
  var eklenen=0,guncellenen=0,cikan=0;
  o.satirlar.forEach(function(r){
    var mevcutSatir=_tdSatirlar.find(function(x){return !x.manuel&&x.key===r.key;});
    var aktar=!r.cikarildi&&r.miktar>0;
    if(aktar){
      if(mevcutSatir){
        if(mevcutSatir.miktar!==r.miktar) guncellenen++;
        mevcutSatir.miktar=r.miktar;mevcutSatir.hedef=r.hedef;
      }else{
        _tdSatirlar.push({key:r.key,kaynak:r.kaynak,kategoriId:r.kategoriId,anahtar:r.anahtar,tamAd:r.tamAd,kisaltma:r.kisaltma,cutoff:r.cutoff,
          marka:r.marka,model:r.model,mevcut:r.mevcut,birim:r.birim,sinif:r.sinif,hedef:r.hedef,miktar:r.miktar,manuel:false});
        eklenen++;
      }
    }else if(mevcutSatir){
      _tdSatirlar=_tdSatirlar.filter(function(x){return x!==mevcutSatir;});
      cikan++;
    }
  });
  closeModal('modal-td-oneri');
  tdRenderSatirlar();
  var p=[];if(eklenen)p.push(eklenen+' kalem eklendi');if(guncellenen)p.push(guncellenen+' kalem güncellendi');if(cikan)p.push(cikan+' kalem çıkarıldı');
  toast(p.length?p.join(', ')+'.':'Listede değişiklik olmadı.',p.length?'success':'info');
}

// ─── Yeni Kalem penceresi (stokta kaydı olmayan ürün) ───

var _tdYeniTaslak=null;

function tdYeniKalemAc(){
  _tdYeniTaslak={key:'yeni',kaynak:'ham',kategoriId:(stokKatList()[0]||{}).id||'',tamAd:'',kisaltma:'',cutoff:'',marka:'',model:'',parametreler:[],miktar:''};
  tdYeniRender();
  openModal('modal-td-yeni');
}

function tdYeniRender(){
  var r=_tdYeniTaslak; if(!r) return;
  var ham=r.kaynak==='ham';
  var alan=function(etiket,html,tam){return '<div class="field"'+(tam?' style="grid-column:1/-1"':'')+'><label>'+etiket+'</label>'+html+'</div>';};
  var inp=function(a,ph,extra){return '<input type="text" value="'+esc(r[a]||'')+'" placeholder="'+ph+'" onchange="_tdYeniTaslak.'+a+'=this.value.trim()"'+(extra||'')+'>';};
  var chips=(r.parametreler||[]).map(function(p){
    return '<span style="display:inline-flex;align-items:center;padding:3px 10px;border-radius:20px;background:var(--accent-soft);color:var(--accent);font-size:11px;font-weight:600;border:1px solid var(--accent);margin:2px 4px 2px 0">'+esc(p.ad)+(p.deger?': '+esc(p.deger):'')+'</span>';
  }).join('');
  document.getElementById('td-yeni-govde').innerHTML='<div class="form-grid">'
    +alan('Tür <span class="req">*</span>','<select onchange="tdYeniAlan(\'kaynak\',this.value)"><option value="ham"'+(ham?' selected':'')+'>Yarı Mamul</option><option value="bitmis"'+(!ham?' selected':'')+'>Hazır Ürün</option></select>')
    +alan('Kategori <span class="req">*</span>','<select onchange="_tdYeniTaslak.kategoriId=this.value"><option value="">Seçin...</option>'+tdKatOptions(r.kaynak,r.kategoriId)+'</select>')
    +alan((ham?'Parametre / Ürün Adı':'Ürün Adı')+' <span class="req">*</span>',inp('tamAd',ham?'ör. Amfetamin veya 5\'li Multi Panel':'ör. 4\'lü İdrar Test Kiti',ham?' list="td-param-dl" onchange="tdYeniAlan(\'tamAd\',this.value)"':''),true)
    +(!ham?alan('Marka',inp('marka','')):'')+(!ham?alan('Model',inp('model','')):'')
    +alan('Parametreler ve Cut-off','<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-ghost btn-sm" onclick="bgOpenParamModal(\'yeni\',\'td\')"><i class="ti ti-list-check"></i> Parametre Seç ('+(r.parametreler||[]).length+')</button>'+chips+'</div>'
      +'<div style="font-size:11px;color:var(--text3);margin-top:4px">'+(ham?'Çoklu panel için birden fazla parametre seçin; tekli parametrede tek seçim yeterli.':'Test kitlerinde içerdiği parametreleri cut-off değerleriyle seçin.')+'</div>',true)
    +alan('Kısaltma',inp('kisaltma','ör. AMP'))
    +alan('Cut-off',inp('cutoff','ör. 50'))
    +alan('Tedarik Miktarı ('+(ham?'sheet':'adet')+') <span class="req">*</span>','<input type="number" min="0" step="'+(ham?'0.001':'1')+'" value="'+esc(r.miktar)+'" onchange="_tdYeniTaslak.miktar=this.value">')
    +'</div><datalist id="td-param-dl">'+(state.stokSettings.parametreler||[]).filter(function(p){return p.aktif!==false;}).map(function(p){return '<option value="'+esc(p.ad)+'">'+esc(p.kisaltma||'')+'</option>';}).join('')+'</datalist>';
}

function tdYeniAlan(alan,val){
  var r=_tdYeniTaslak; if(!r) return;
  r[alan]=val;
  if(alan==='kaynak'){
    r.kategoriId=val==='ham'?((stokKatList()[0]||{}).id||''):'';
    r.parametreler=[];r.kisaltma='';r.cutoff='';
  }
  if(alan==='tamAd'&&r.kaynak==='ham'){
    // Parametre listesinden seçildiyse kısaltma otomatik dolar
    var p=(state.stokSettings.parametreler||[]).find(function(x){return x.ad===val||x.kisaltma===val;});
    if(p){r.tamAd=p.ad;r.kisaltma=p.kisaltma||'';}
  }
  tdYeniRender();
}

function tdKatOptions(kaynak,secili){
  var list=kaynak==='ham'
    ?stokKatList().map(function(k){return {id:k.id,ad:k.ad};})
    :stokTicariKatList().map(function(k){return {id:k.id,ad:tdKategoriAd('bitmis',k.id)};}).sort(function(a,b){return a.ad.localeCompare(b.ad,'tr');});
  return list.map(function(k){return '<option value="'+esc(k.id)+'"'+(k.id===secili?' selected':'')+'>'+esc(k.ad)+'</option>';}).join('');
}

// "AMP / THC" + "AMP:50 · THC:25" → [{ad:'AMP',deger:'50'},{ad:'THC',deger:'25'}]
function tdCutoffParametreler(kisaltma,cutoff){
  var adlar=String(kisaltma||'').split('/').map(function(s){return s.trim();}).filter(Boolean);
  var degerler={};
  String(cutoff||'').split('·').forEach(function(p){var i=p.indexOf(':');if(i>0)degerler[p.slice(0,i).trim()]=p.slice(i+1).trim();});
  // Tek parametrede cut-off "50" gibi yalın yazılmış olabilir
  if(adlar.length===1&&cutoff&&String(cutoff).indexOf(':')<0) degerler[adlar[0]]=String(cutoff).trim();
  return adlar.map(function(ad){return {ad:ad,deger:degerler[ad]||''};});
}

// Parametre seçim penceresinden gelen seçim (çoklu) yeni kalem taslağına uygulanır
function tdParametrelerUygula(key,secilen){
  var r=tdSatirBul(key); if(!r) return;
  r.parametreler=secilen;
  r.kisaltma=secilen.map(function(p){return p.ad;}).join(' / ');
  // Yarı mamul tekli parametrede cut-off yalın ("50"), diğerlerinde "AD:değer" biçiminde
  var yalin=r.kaynak==='ham'&&secilen.length===1;
  r.cutoff=secilen.filter(function(p){return p.deger;}).map(function(p){return yalin?p.deger:p.ad+':'+p.deger;}).join(' · ');
  if(r.kaynak==='ham'&&secilen.length===1&&!(r.tamAd||'').trim()){
    var p=tdParamBul(secilen[0].ad); r.tamAd=p?p.ad:secilen[0].ad;
  }
  if(key==='yeni') tdYeniRender(); else tdRenderSatirlar();
}

function tdYeniKalemEkle(){
  var r=_tdYeniTaslak; if(!r) return;
  var tamAd=(r.tamAd||'').trim();
  var miktar=Math.max(0,parseFloat(String(r.miktar).replace(',','.'))||0);
  if(!r.kategoriId) return toast('Kategori seçin.','error');
  if(!tamAd) return toast('Ürün / parametre adı zorunludur.','error');
  if(!(miktar>0)) return toast('Tedarik miktarı girin.','error');
  miktar=r.kaynak==='ham'?tdR3(miktar):Math.round(miktar);
  var cok=(r.parametreler||[]).length>1;
  var anahtar,key;
  if(r.kaynak==='ham'){
    anahtar=cok?tamAd:((r.kisaltma||'').trim()||tamAd);
    key='ham|'+r.kategoriId+'|'+anahtar+'|'+(r.cutoff||'').trim();
  }else{
    anahtar=[tamAd.toLowerCase(),(r.marka||'').trim().toLowerCase(),(r.model||'').trim().toLowerCase()].join('|');
    key='bitmis|'+r.kategoriId+'|'+anahtar;
  }
  // Stokta zaten kayıtlıysa yeni kalem değil, o ürünün kendi satırı olarak eklenir
  var kat=tdKatalog().find(function(x){return x.key===key;});
  var listede=_tdSatirlar.find(function(x){return x.key===key;});
  if(listede){
    listede.miktar=miktar;
    toast(listede.tamAd+' zaten listedeydi; miktarı güncellendi.','info');
  }else if(kat){
    var s=tdSiniflar()[tdSinifKey(kat)]||{};
    _tdSatirlar.push(Object.assign({},kat,{sinif:s.sinif||'',miktar:miktar,hedef:null,manuel:false}));
    toast(kat.tamAd+' stokta kayıtlı bir ürün; listeye eklendi.','info');
  }else{
    _tdSatirlar.push({key:'m'+(++_tdManuelSayac),kaynak:r.kaynak,kategoriId:r.kategoriId,anahtar:anahtar,tamAd:tamAd,kisaltma:(r.kisaltma||'').trim(),cutoff:(r.cutoff||'').trim(),
      parametreler:r.parametreler||[],marka:(r.marka||'').trim(),model:(r.model||'').trim(),mevcut:null,hedef:null,birim:r.kaynak==='ham'?'sheet':'adet',sinif:'',manuel:true,miktar:miktar});
  }
  closeModal('modal-td-yeni');
  _tdYeniTaslak=null;
  tdRenderSatirlar();
}

async function saveTedarik(){
  var tarih=document.getElementById('td-tarih').value;
  if(!tarih) return toast('Tarih zorunludur.','error');
  var sira=[];
  tdGruplar().forEach(function(g){g.satirlar.forEach(function(r){if(r.miktar>0)sira.push(r);});});
  if(!sira.length) return toast('Listeye en az bir kalem ekleyin ve miktarını girin.','error');
  var payload={
    id:_tdEditId||undefined,
    tarih:tarih,
    tedarikci:document.getElementById('td-tedarikci').value.trim(),
    notlar:document.getElementById('td-notlar').value.trim(),
    hedefler:{kategoriler:_tdHedefler},
    kalemler:sira.map(function(r){
      return {kaynak:r.kaynak,kategoriId:r.kategoriId||null,anahtar:r.anahtar||'',tamAd:(r.tamAd||'').trim(),kisaltma:r.kisaltma||'',cutoff:r.cutoff||'',
        marka:r.marka||'',model:r.model||'',sinif:r.sinif||'',mevcut:r.mevcut,hedef:r.hedef!=null?r.hedef:null,miktar:r.miktar,manuel:!!r.manuel};
    })
  };
  var res;
  try{
    res=_tdEditId?await apiPut('stok/tedarikler',payload):await apiPost('stok/tedarikler',payload);
  }catch(e){toast(e.message||'Kaydedilemedi.','error');return;}
  toast('Tedarik listesi kaydedildi ('+res.tedarik.evrakNo+').','success');
  _formDirty=false;
  _tdEditId=null;
  _tdExpanded.add(res.tedarik.id);
  showPage('tedarikler');
}

// ─── Ayarlar: Tedarik & Sınıflar ──────────────────────────────────────────────

async function tdAyarPanelYukle(){
  var s=state.stokSettings||{};
  var set=function(id,v){var el=document.getElementById(id);if(el)el.value=v;};
  set('td-set-prefix',s.tedarikPrefix||'TD');
  set('td-set-a',s.tedarikSinifA!=null?s.tedarikSinifA:70);
  set('td-set-b',s.tedarikSinifB!=null?s.tedarikSinifB:20);
  set('td-set-donem',s.tedarikDonemAy||6);
  tdAyarCOzet();
  try{state.tedarikSiniflari=(await apiGet('stok/tedarik-siniflari')).siniflar||[];}
  catch(e){state.tedarikSiniflari=state.tedarikSiniflari||[];}
  var sel=document.getElementById('td-set-kat');
  if(sel){
    var cur=sel.value;
    sel.innerHTML=tdKapsamListesi().map(function(x){var v=x.kaynak+'|'+x.kategoriId;return '<option value="'+esc(v)+'"'+(v===cur?' selected':'')+'>'+esc(x.ad)+' — '+TD_KAYNAK_ETIKET[x.kaynak]+'</option>';}).join('');
  }
  tdAyarSinifRender();
}

function tdAyarCOzet(){
  var a=parseInt((document.getElementById('td-set-a')||{}).value)||0;
  var b=parseInt((document.getElementById('td-set-b')||{}).value)||0;
  var el=document.getElementById('td-set-c'); if(el) el.textContent='%'+Math.max(0,100-a-b);
}

async function tdAyarKaydet(){
  var a=parseInt(document.getElementById('td-set-a').value)||0;
  var b=parseInt(document.getElementById('td-set-b').value)||0;
  if(a<1||a+b>100) return toast('A en az %1 olmalı ve A + B toplamı %100\'ü geçmemeli.','error');
  try{
    var res=await apiPut('stok/ayarlar',{
      tedarikPrefix:document.getElementById('td-set-prefix').value.trim()||'TD',
      tedarikSinifA:a,tedarikSinifB:b,
      tedarikDonemAy:parseInt(document.getElementById('td-set-donem').value)||6
    });
    var ay=res.ayarlar||{};
    state.stokSettings.tedarikPrefix=ay.tedarikPrefix;
    state.stokSettings.tedarikSinifA=ay.tedarikSinifA;
    state.stokSettings.tedarikSinifB=ay.tedarikSinifB;
    state.stokSettings.tedarikDonemAy=ay.tedarikDonemAy;
  }catch(e){toast(e.message||'Kaydedilemedi.','error');return;}
  toast('Tedarik ayarları kaydedildi.','success');
  tdAyarPanelYukle();
}

function tdAyarSinifRender(){
  var el=document.getElementById('td-set-siniflar'); if(!el) return;
  var v=(document.getElementById('td-set-kat')||{}).value||'';
  if(!v){el.innerHTML='<div style="font-size:12px;color:var(--text3)">Stokta kayıtlı kalem bulunamadı.</div>';return;}
  var parca=v.split('|'); var kaynak=parca[0]; var katId=parca.slice(1).join('|');
  var katalog=tdKatalog();
  var sinif=tdSiniflar(katalog);
  // Sınıf parametre (yarı mamul) / ürün grubu (hazır ürün) bazındadır; cut-off'lar birleşir
  var gor={};var rows=[];
  katalog.filter(function(r){return r.kaynak===kaynak&&r.kategoriId===katId;}).forEach(function(r){
    var k=tdSinifKey(r); if(gor[k]) return; gor[k]=1;
    rows.push({r:r,s:sinif[k]||{oto:'C',sinif:'C',manuel:false,tuketim:0,pay:0}});
  });
  rows.sort(function(x,y){return (y.s.tuketim-x.s.tuketim)||(x.r.tamAd||'').localeCompare(y.r.tamAd||'','tr');});
  var birim=kaynak==='ham'?'sheet':'adet';
  var ay=(state.stokSettings&&state.stokSettings.tedarikDonemAy)||6;
  el.innerHTML='<div class="table-wrap"><table class="compact-table" style="width:100%"><thead><tr>'
    +'<th class="col-name">'+(kaynak==='ham'?'Parametre':'Ürün')+'</th><th style="text-align:right">Son '+ay+' Ay Tüketim ('+birim+')</th><th style="text-align:right">Pay</th><th style="text-align:center">Otomatik</th><th style="width:150px">Sınıf</th>'
    +'</tr></thead><tbody>'
    +rows.map(function(x){
      var arg=['\''+kaynak+'\'','\''+esc(katId).replace(/'/g,"\\'")+'\'','\''+esc(x.r.anahtar).replace(/'/g,"\\'")+'\''].join(',');
      return '<tr><td class="col-name" style="font-weight:500">'+esc(x.r.kaynak==='ham'?(x.r.anahtar+(x.r.tamAd!==x.r.anahtar?' — '+x.r.tamAd:'')):x.r.tamAd)+'</td>'
        +'<td style="text-align:right;font-family:var(--font-mono)">'+(x.s.tuketim?tdFmt(x.s.tuketim):'—')+'</td>'
        +'<td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">%'+tdFmt(x.s.pay)+'</td>'
        +'<td style="text-align:center;font-weight:700;color:'+TD_SINIF_RENK[x.s.oto]+'">'+x.s.oto+'</td>'
        +'<td><select style="width:100%;font-weight:600" onchange="tdAyarSinifDegis('+arg+',this.value)">'
          +'<option value=""'+(!x.s.manuel?' selected':'')+'>Otomatik ('+x.s.oto+')</option>'
          +['A','B','C'].map(function(s){return '<option value="'+s+'"'+(x.s.manuel&&x.s.sinif===s?' selected':'')+'>'+s+' (elle)</option>';}).join('')
        +'</select></td></tr>';
    }).join('')
    +'</tbody></table></div>';
}

async function tdAyarSinifDegis(kaynak,katId,anahtar,sinif){
  try{await tdSinifKaydet(kaynak,katId,anahtar,sinif||null);}
  catch(e){toast(e.message||'Sınıf kaydedilemedi.','error');return;}
  tdAyarSinifRender();
}

// ─── Mal Kabul ────────────────────────────────────────────────────────────────
// Tedarik listesinden "Mal Kabul" ile Yarı Mamul / Hazır Ürün giriş formu, kalan
// miktarlarla dolu açılır. Her giriş satırı bir tedarik kalemine bağlanır; bir
// kalem birden fazla LOT ile gelebilir. Kabul edilen miktar ve tedarik durumu,
// giriş kaydedilince/düzenlenince/silinince sunucuda yeniden hesaplanır.

var TD_KABUL_DURUMLARI=['Tedarikçiye İletildi','Kısmi Mal Kabul','Mal Kabul Tamamlandı'];
var _tdMalKabul=null;                    // {tedarikId, kaynak} — form açılırken tüketilir
var _tdGirisBaglam={ham:null,bitmis:null}; // giriş formunun bağlı olduğu tedarik listesi

function tdKalan(k){return Math.max(0,tdR3((Number(k.miktar)||0)-(Number(k.kabulEdilen)||0)));}
function tdKaynakKalan(t,kaynak){return (t.kalemler||[]).filter(function(k){return k.kaynak===kaynak&&tdKalan(k)>0;});}
function tdKabulYuzde(t){
  var top=0,gelen=0;
  (t.kalemler||[]).forEach(function(k){top+=Number(k.miktar)||0;gelen+=Math.min(Number(k.kabulEdilen)||0,Number(k.miktar)||0);});
  return top>0?Math.round(gelen/top*100):0;
}
function tdKabulVarMi(t){return (t.kalemler||[]).some(function(k){return (Number(k.kabulEdilen)||0)>0;});}

// Kalemlere bağlı giriş belgelerinin evrak numaraları
function tdBagliGirisler(t){
  var ids={};(t.kalemler||[]).forEach(function(k){ids[k.id]=k.kaynak;});
  var out={};
  (state.hamStokLotlar||[]).forEach(function(l){if(l.tedarikKalemId&&ids[l.tedarikKalemId])out[l.evrakNo||'—']='ham';});
  (state.bitmisStokLotlar||[]).forEach(function(l){if(l.tedarikKalemId&&ids[l.tedarikKalemId])out[l.evrakNo||'—']='bitmis';});
  return out;
}

function tdMalKabulBaslat(id,kaynak){
  var t=(state.tedarikler||[]).find(function(x){return x.id===id;}); if(!t) return;
  if(TD_KABUL_DURUMLARI.indexOf(t.durum)<0) return toast('Mal kabul için tedarik listesinin "Tedarikçiye İletildi" durumunda olması gerekir.','error');
  if(!tdKaynakKalan(t,kaynak).length) return toast('Bu türde kabul edilecek kalan kalem yok.','info');
  _tdMalKabul={tedarikId:id,kaynak:kaynak};
  if(kaynak==='ham') goHamGirisYeni(); else goBitmisGirisYeni();
}

// Yeni giriş formu açılırken çağrılır: mal kabul başlatıldıysa kalan kalemlerle
// dolu kalem listesini döndürür, değilse null.
function tdGirisOnDoldur(kaynak){
  _tdGirisBaglam[kaynak]=null;
  var mk=_tdMalKabul;
  if(!mk||mk.kaynak!==kaynak) return null;
  _tdMalKabul=null;
  var t=(state.tedarikler||[]).find(function(x){return x.id===mk.tedarikId;}); if(!t) return null;
  _tdGirisBaglam[kaynak]=t;
  var kalemler=tdKaynakKalan(t,kaynak).map(function(k){
    var kalan=tdKalan(k);
    if(kaynak==='ham'){
      var src=(state.hamStokLotlar||[]).find(function(l){return l.kategoriId===k.kategoriId&&l.parametreAd===k.anahtar&&(l.cutoff||'').trim()===(k.cutoff||'');});
      // Stokta karşılığı olmayan (manuel eklenmiş) kalemde parametreler kısaltma/cut-off'tan çözülür
      var cozulen=src?null:tdCutoffParametreler(k.kisaltma,k.cutoff);
      var coklu=src?src.tip==='coklu':cozulen.length>1;
      var params=src?(src.parametreler||[]):cozulen;
      var parametreAd=src?k.anahtar:(coklu?k.tamAd:((cozulen[0]||{}).ad||k.anahtar||''));
      var cutoff=src?(k.cutoff||''):(coklu?'':((cozulen[0]||{}).deger||k.cutoff||''));
      return {kategoriId:k.kategoriId||'',tip:coklu?'coklu':'tekli',parametreAd:parametreAd||'',cutoff:coklu?'':cutoff,
        parametreler:coklu?JSON.parse(JSON.stringify(params)):[],ekOzellik:'',lotNo:'',sheetMiktar:kalan,sktTarih:'',tedarikKalemId:k.id};
    }
    var bsrc=(state.bitmisStokLotlar||[]).find(function(l){return l.kategoriId===k.kategoriId&&tdBitmisAnahtar(l)===k.anahtar;});
    return {lotNo:'',urunAdi:bsrc?bsrc.urunAdi:k.tamAd,kategoriId:k.kategoriId||'',marka:bsrc?(bsrc.marka||''):(k.marka||''),model:bsrc?(bsrc.model||''):(k.model||''),
      seriNo:'',seriNolar:[],parametreler:JSON.parse(JSON.stringify(bsrc?(bsrc.parametreler||[]):tdCutoffParametreler(k.kisaltma,k.cutoff))),miktar:Math.ceil(kalan),sktTarih:'',notlar:'',tedarikKalemId:k.id};
  });
  return {kalemler:kalemler,notlar:(t.evrakNo||'')+' mal kabulü'+(t.tedarikci?' — '+t.tedarikci:'')};
}

// Var olan bir giriş düzenlenirken: kalemleri tedarike bağlıysa bağlamı kurar.
function tdGirisBaglamKur(kaynak,kalemler,yenidenCiz){
  _tdGirisBaglam[kaynak]=null;
  var ids=(kalemler||[]).map(function(k){return k.tedarikKalemId;}).filter(Boolean);
  if(!ids.length) return;
  var bul=function(){
    var t=(state.tedarikler||[]).find(function(x){return (x.kalemler||[]).some(function(k){return ids.indexOf(k.id)>=0;});});
    _tdGirisBaglam[kaynak]=t||null;
  };
  if(state.tedarikler){bul();return;}
  apiGet('stok/tedarikler').then(function(r){state.tedarikler=r.tedarikler||[];bul();if(yenidenCiz)yenidenCiz();}).catch(function(){});
}

function tdGirisBannerHtml(kaynak){
  var t=_tdGirisBaglam[kaynak]; if(!t) return '';
  return '<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:10px 14px;margin-bottom:10px;border:1px solid var(--accent);background:var(--accent-soft);border-radius:var(--radius-sm);font-size:12px;color:var(--text)">'
    +'<i class="ti ti-truck-delivery" style="font-size:16px;color:var(--accent)"></i>'
    +'<span><b>'+esc(t.evrakNo)+'</b> mal kabulü'+(t.tedarikci?' · '+esc(t.tedarikci):'')+'</span>'
    +'<span style="color:var(--text3)">Gelen miktarları ve LOT bilgilerini girin. Bir kalem birden fazla LOT ile geldiyse "Kalem Ekle" ile satır ekleyip aynı tedarik kalemini seçin; gelmeyen satırları silin.</span>'
    +'</div>';
}

function tdGirisSatirHtml(kaynak,i,k){
  var t=_tdGirisBaglam[kaynak]; if(!t) return '';
  var dizi=kaynak==='ham'?'_hgKalemler':'_bgKalemler';
  var opts=(t.kalemler||[]).filter(function(x){return x.kaynak===kaynak;}).map(function(x){
    var etiket=x.tamAd+(x.kisaltma&&x.kisaltma!==x.tamAd?' ('+x.kisaltma+')':'')+(x.cutoff?' · '+x.cutoff:'')+' — '+tdKategoriAd(x.kaynak,x.kategoriId)
      +' — tedarik '+tdFmt(x.miktar)+', kabul '+tdFmt(x.kabulEdilen)+' '+x.birim;
    return '<option value="'+x.id+'"'+(Number(k.tedarikKalemId)===x.id?' selected':'')+'>'+esc(etiket)+'</option>';
  }).join('');
  return '<div style="display:flex;align-items:center;gap:8px;margin-top:8px">'
    +'<span style="font-size:10px;font-weight:600;color:var(--accent);white-space:nowrap"><i class="ti ti-truck-delivery"></i> Tedarik Kalemi</span>'
    +'<select style="flex:1;font-size:12px;padding:3px 6px" onchange="'+dizi+'['+i+'].tedarikKalemId=this.value?parseInt(this.value,10):null">'
    +'<option value="">— Tedarik dışı —</option>'+opts+'</select></div>';
}

// Giriş kaydedildikten sonra: mal kabulüyse tedarik listesine dönülür.
async function tdGirisKaydedildi(kaynak){
  var t=_tdGirisBaglam[kaynak];
  _tdGirisBaglam[kaynak]=null;
  if(!t) return false;
  _tdExpanded.add(t.id);
  showPage('tedarikler');
  return true;
}
