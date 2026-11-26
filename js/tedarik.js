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
var _tdHedefler=null;
var _tdKapsam={};
var _tdSadeceMiktarli=false;
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
      +'<td><span class="badge '+(TD_DURUM_BADGE[t.durum]||'badge-gray')+'">'+esc(t.durum)+'</span></td>'
      +'<td><div class="action-row">'
        +'<button class="btn btn-ghost btn-sm" style="color:var(--green)" onclick="event.stopPropagation();tdExcel(\''+t.id+'\')" title="Tedarikçiye gönderilecek Excel listesi"><i class="ti ti-file-download"></i> Excel</button>'
        +(canWrite&&taslak?'<button class="btn-icon" onclick="event.stopPropagation();goTedarikDuzenle(\''+t.id+'\')" title="Düzenle"><i class="ti ti-edit"></i></button>':'')
        +(canWrite&&(taslak||t.durum==='İptal')?'<button class="btn-icon" style="color:var(--red)" onclick="event.stopPropagation();tdSil(\''+t.id+'\')" title="Sil"><i class="ti ti-trash"></i></button>':'')
      +'</div></td></tr>';
    if(exp){
      var sub='<div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:6px 0 10px">';
      if(canWrite){
        sub+='<label style="font-size:12px;color:var(--text2)">Durum</label><select onchange="tdDurumDegistir(\''+t.id+'\',this.value)" style="font-size:12px;padding:4px 8px">'
          +TD_DURUMLAR.map(function(d){return '<option'+(d===t.durum?' selected':'')+'>'+esc(d)+'</option>';}).join('')+'</select>';
      }
      if(t.notlar) sub+='<span style="font-size:12px;color:var(--text3)">Not: '+esc(t.notlar)+'</span>';
      sub+='</div><table class="compact-table" style="width:100%;margin:0" data-resize-key="stok-tedarikler-detay"><thead><tr style="background:var(--bg4)">'
        +'<th>Tür</th><th>Kategori</th><th style="width:50px;text-align:center">Sınıf</th><th class="col-name">Tam Adı</th><th>Kısaltma</th><th>Cut-off</th><th style="text-align:right">Mevcut (o an)</th><th style="text-align:right">Tedarik Miktarı</th>'
        +'</tr></thead><tbody>';
      (t.kalemler||[]).forEach(function(k){
        sub+='<tr>'
          +'<td style="font-size:12px">'+TD_KAYNAK_ETIKET[k.kaynak]+(k.manuel?' <span style="font-size:10px;color:var(--text3)">(manuel)</span>':'')+'</td>'
          +'<td style="font-size:12px">'+esc(tdKategoriAd(k.kaynak,k.kategoriId))+'</td>'
          +'<td style="text-align:center;font-weight:700;color:'+(TD_SINIF_RENK[k.sinif]||'var(--text3)')+'">'+esc(k.sinif||'—')+'</td>'
          +'<td class="col-name" style="font-weight:500">'+esc(k.tamAd)+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(k.kisaltma||'—')+'</td>'
          +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(k.cutoff||'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">'+(k.mevcut!=null?tdFmt(k.mevcut):'—')+'</td>'
          +'<td style="text-align:right;font-family:var(--font-mono);font-weight:600">'+tdFmt(k.miktar)+' '+k.birim+'</td>'
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

function tdKapsamListesi(){
  var out=stokKatList().map(function(k){return {kaynak:'ham',kategoriId:k.id,ad:k.ad};});
  var bmKatlar={};
  (state.bitmisStokLotlar||[]).forEach(function(l){if(l.kategoriId) bmKatlar[l.kategoriId]=1;});
  Object.keys(bmKatlar).map(function(id){return {kaynak:'bitmis',kategoriId:id,ad:tdKategoriAd('bitmis',id)};})
    .sort(function(a,b){return a.ad.localeCompare(b.ad,'tr');})
    .forEach(function(x){out.push(x);});
  return out;
}

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

  var sonHedef=((state.tedarikler||[]).find(function(x){return x.hedefler;})||{}).hedefler;
  _tdHedefler=JSON.parse(JSON.stringify((t&&t.hedefler)||sonHedef||TD_HEDEF_VARSAYILAN));
  ['ham','bitmis'].forEach(function(k){if(!_tdHedefler[k])_tdHedefler[k]=Object.assign({},TD_HEDEF_VARSAYILAN[k]);});

  _tdKapsam={};
  tdKapsamListesi().forEach(function(x){_tdKapsam[x.kaynak+'|'+x.kategoriId]=true;});
  _tdSadeceMiktarli=!!t;
  _tdSatirlar=[];
  tdSatirlariKur(t?t.kalemler:null);
  tdRenderForm();
}

// Katalogdan satırları kurar; kayıtlı (düzenlenen) listenin miktarları korunur,
// katalogda karşılığı olmayan kayıtlı kalemler manuel satır olarak eklenir.
function tdSatirlariKur(kayitliKalemler){
  var katalog=tdKatalog();
  var sinif=tdSiniflar(katalog);
  var oncekiler={};
  _tdSatirlar.forEach(function(r){oncekiler[r.key]=r;});
  var manueller=_tdSatirlar.filter(function(r){return r.manuel;});
  var satirlar=katalog.map(function(r){
    var s=sinif[tdSinifKey(r)]||{sinif:'C',oto:'C',manuel:false,tuketim:0};
    var eski=oncekiler[r.key];
    return Object.assign({},r,{sinif:s.sinif,sinifManuel:s.manuel,tuketim:s.tuketim,manuel:false,
      elle:eski?eski.elle:false,miktar:eski&&eski.elle?eski.miktar:0});
  });
  if(kayitliKalemler){
    var byKey={};satirlar.forEach(function(r){byKey[r.key]=r;});
    kayitliKalemler.forEach(function(k){
      var key=k.kaynak==='ham'?('ham|'+k.kategoriId+'|'+k.anahtar+'|'+(k.cutoff||'')):('bitmis|'+k.kategoriId+'|'+k.anahtar);
      if(!k.manuel&&byKey[key]){byKey[key].miktar=k.miktar;byKey[key].elle=true;return;}
      manueller.push({key:'m'+(++_tdManuelSayac),kaynak:k.kaynak,kategoriId:k.kategoriId,anahtar:k.anahtar||'',tamAd:k.tamAd,kisaltma:k.kisaltma||'',cutoff:k.cutoff||'',
        marka:k.marka||'',model:k.model||'',mevcut:null,birim:k.birim,sinif:k.sinif||'',manuel:true,elle:true,miktar:k.miktar});
    });
  }
  _tdSatirlar=satirlar.concat(manueller);
  tdOneriHesapla();
}

function tdHedefOf(r){return Number((_tdHedefler[r.kaynak]||{})[r.sinif])||0;}

function tdOneriHesapla(){
  _tdSatirlar.forEach(function(r){
    if(r.manuel||r.elle) return;
    var h=tdHedefOf(r);
    r.miktar=r.mevcut<h?Math.ceil(tdR3(h-r.mevcut)):0;
  });
}

function tdRenderForm(){
  // Kapsam
  var kEl=document.getElementById('td-kapsam');
  if(kEl){
    var liste=tdKapsamListesi();
    var grup=function(kaynak){
      var items=liste.filter(function(x){return x.kaynak===kaynak;});
      if(!items.length) return '';
      return '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:6px">'
        +'<span style="font-size:11px;font-weight:600;color:var(--text3);width:84px">'+TD_KAYNAK_ETIKET[kaynak].toLocaleUpperCase('tr')+'</span>'
        +items.map(function(x){
          var k=x.kaynak+'|'+x.kategoriId; var on=!!_tdKapsam[k];
          return '<label class="td-chip'+(on?' td-chip-on':'')+'"><input type="checkbox"'+(on?' checked':'')+' onchange="tdKapsamDegis(\''+esc(k).replace(/'/g,"\\'")+'\',this.checked)">'+esc(x.ad)+'</label>';
        }).join('')
        +'<button class="btn btn-ghost btn-sm" style="font-size:11px;padding:2px 8px" onclick="tdKapsamHepsi(\''+kaynak+'\')">Tümü / Hiçbiri</button>'
        +'</div>';
    };
    kEl.innerHTML=grup('ham')+grup('bitmis');
  }
  // Hedefler
  var hEl=document.getElementById('td-hedefler');
  if(hEl){
    hEl.innerHTML=['ham','bitmis'].map(function(kaynak){
      return '<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">'
        +'<span style="font-size:12px;color:var(--text2);width:150px">'+TD_KAYNAK_ETIKET[kaynak]+' <span style="color:var(--text3)">('+(kaynak==='ham'?'sheet':'adet')+')</span></span>'
        +['A','B','C'].map(function(s){
          return '<label style="display:flex;align-items:center;gap:4px;font-size:12px;font-weight:700;color:'+TD_SINIF_RENK[s]+'">'+s
            +'<input type="number" min="0" step="1" value="'+(_tdHedefler[kaynak][s]||0)+'" style="width:64px;text-align:center" onchange="tdHedefDegis(\''+kaynak+'\',\''+s+'\',this.value)"></label>';
        }).join('')
        +'</div>';
    }).join('');
  }
  var smEl=document.getElementById('td-sadece-miktarli'); if(smEl) smEl.checked=_tdSadeceMiktarli;
  tdRenderSatirlar();
}

function tdKapsamDegis(k,on){_tdKapsam[k]=on;tdRenderForm();}
function tdKapsamHepsi(kaynak){
  var items=tdKapsamListesi().filter(function(x){return x.kaynak===kaynak;});
  var hepsiAcik=items.every(function(x){return _tdKapsam[x.kaynak+'|'+x.kategoriId];});
  items.forEach(function(x){_tdKapsam[x.kaynak+'|'+x.kategoriId]=!hepsiAcik;});
  tdRenderForm();
}
function tdHedefDegis(kaynak,s,val){
  _tdHedefler[kaynak][s]=Math.max(0,parseFloat(String(val).replace(',','.'))||0);
  // Hedef değişince elle girilmemiş satırların önerisi yeniden hesaplanır
  tdOneriHesapla();tdRenderSatirlar();
}
function tdSadeceMiktarliDegis(on){_tdSadeceMiktarli=on;tdRenderSatirlar();}
function tdOnerileriSifirla(){
  _tdSatirlar.forEach(function(r){if(!r.manuel) r.elle=false;});
  tdOneriHesapla();tdRenderSatirlar();
  toast('Elle değiştirilen miktarlar önerilen değerlere döndürüldü.','info');
}

function tdSatirBul(key){return _tdSatirlar.find(function(r){return r.key===key;});}

function tdMiktarDegis(key,val){
  var r=tdSatirBul(key); if(!r) return;
  var n=Math.max(0,parseFloat(String(val).replace(',','.'))||0);
  r.miktar=r.kaynak==='ham'?tdR3(n):Math.round(n);
  r.elle=true;
  tdRenderSatirlar();
}

async function tdSinifDegis(key,sinif){
  var r=tdSatirBul(key); if(!r) return;
  if(r.manuel){r.sinif=sinif;tdRenderSatirlar();return;}
  try{
    // "Otomatik" seçilirse elle verilen sınıf silinir
    await tdSinifKaydet(r.kaynak,r.kategoriId,r.anahtar,sinif==='oto'?null:sinif);
  }catch(e){toast(e.message||'Sınıf kaydedilemedi.','error');return;}
  var sinifMap=tdSiniflar();
  var s=sinifMap[tdSinifKey(r)];
  _tdSatirlar.forEach(function(x){
    if(!x.manuel&&tdSinifKey(x)===tdSinifKey(r)&&s){x.sinif=s.sinif;x.sinifManuel=s.manuel;}
  });
  tdOneriHesapla();tdRenderSatirlar();
}

function tdManuelEkle(){
  var ilkKat=(stokKatList()[0]||{}).id||'';
  _tdSatirlar.push({key:'m'+(++_tdManuelSayac),kaynak:'ham',kategoriId:ilkKat,anahtar:'',tamAd:'',kisaltma:'',cutoff:'',marka:'',model:'',
    mevcut:null,birim:'sheet',sinif:'',manuel:true,elle:true,miktar:0});
  tdRenderSatirlar();
  var inp=document.querySelector('#td-satirlar tr[data-key="m'+_tdManuelSayac+'"] input[data-alan="tamAd"]');
  if(inp) inp.focus();
}
function tdManuelSil(key){_tdSatirlar=_tdSatirlar.filter(function(r){return r.key!==key;});tdRenderSatirlar();}
function tdManuelAlan(key,alan,val){
  var r=tdSatirBul(key); if(!r) return;
  r[alan]=val;
  if(alan==='kaynak'){
    r.birim=val==='ham'?'sheet':'adet';
    var ilk=val==='ham'?(stokKatList()[0]||{}).id:(tdKapsamListesi().filter(function(x){return x.kaynak==='bitmis';})[0]||{}).kategoriId;
    r.kategoriId=ilk||'';
    tdRenderSatirlar();
  }
  if(alan==='tamAd'&&r.kaynak==='ham'){
    // Parametre listesinden seçildiyse kısaltma otomatik dolar
    var p=(state.stokSettings.parametreler||[]).find(function(x){return x.ad===val||x.kisaltma===val;});
    if(p){r.tamAd=p.ad;r.kisaltma=p.kisaltma||'';r.anahtar=p.kisaltma||p.ad;tdRenderSatirlar();}
  }
}

function tdKatOptions(kaynak,secili){
  var list=kaynak==='ham'
    ?stokKatList().map(function(k){return {id:k.id,ad:k.ad};})
    :stokTicariKatList().map(function(k){return {id:k.id,ad:tdKategoriAd('bitmis',k.id)};}).sort(function(a,b){return a.ad.localeCompare(b.ad,'tr');});
  return list.map(function(k){return '<option value="'+esc(k.id)+'"'+(k.id===secili?' selected':'')+'>'+esc(k.ad)+'</option>';}).join('');
}

function tdRenderSatirlar(){
  var el=document.getElementById('td-satirlar'); if(!el) return;
  var sinifSira={A:0,B:1,C:2};
  var gorunur=function(r){return !_tdSadeceMiktarli||r.miktar>0;};
  var html='';
  var bolumler=tdKapsamListesi().filter(function(x){return _tdKapsam[x.kaynak+'|'+x.kategoriId];});
  var thead='<thead><tr><th style="width:74px;text-align:center">Sınıf</th><th class="col-name">Tam Adı</th><th>Kısaltma</th><th>Cut-off</th>'
    +'<th style="text-align:right;width:90px">Tüketim*</th><th style="text-align:right;width:80px">Mevcut</th><th style="text-align:right;width:70px">Hedef</th><th style="width:120px">Tedarik Miktarı</th><th style="width:34px"></th></tr></thead>';
  bolumler.forEach(function(b){
    var rows=_tdSatirlar.filter(function(r){return !r.manuel&&r.kaynak===b.kaynak&&r.kategoriId===b.kategoriId;});
    if(!rows.length) return;
    rows.sort(function(x,y){return (sinifSira[x.sinif]-sinifSira[y.sinif])||(x.tamAd||'').localeCompare(y.tamAd||'','tr')||(x.cutoff||'').localeCompare(y.cutoff||'','tr');});
    var gorunen=rows.filter(gorunur);
    var top=rows.reduce(function(a,r){return a+(r.miktar||0);},0);
    html+='<div class="td-bolum"><div class="td-bolum-baslik"><span>'+esc(b.ad)+' <span style="font-weight:400;color:var(--text3)">· '+TD_KAYNAK_ETIKET[b.kaynak]+'</span></span>'
      +'<span style="font-family:var(--font-mono);font-size:12px;color:var(--text2)">'+(top?tdFmt(top)+' '+(b.kaynak==='ham'?'sheet':'adet'):'—')+'</span></div>';
    if(!gorunen.length){html+='<div style="padding:8px 12px;font-size:12px;color:var(--text3)">Bu kategoride tedarik miktarı girilmiş kalem yok.</div></div>';return;}
    html+='<div class="table-wrap"><table class="compact-table" style="width:100%">'+thead+'<tbody>'
      +gorunen.map(tdSatirHtml).join('')+'</tbody></table></div></div>';
  });
  var manuel=_tdSatirlar.filter(function(r){return r.manuel;});
  html+='<div class="td-bolum"><div class="td-bolum-baslik"><span>Manuel Eklenen Kalemler</span>'
    +'<button class="btn btn-ghost btn-sm" onclick="tdManuelEkle()"><i class="ti ti-plus"></i> Manuel Kalem Ekle</button></div>';
  if(manuel.length){
    html+='<div class="table-wrap"><table class="compact-table" style="width:100%"><thead><tr><th style="width:110px">Tür</th><th style="width:170px">Kategori</th><th class="col-name">Tam Adı</th><th>Kısaltma</th><th>Cut-off</th><th style="width:120px">Tedarik Miktarı</th><th style="width:34px"></th></tr></thead><tbody>'
      +manuel.map(tdManuelSatirHtml).join('')+'</tbody></table></div>';
  }else{
    html+='<div style="padding:8px 12px;font-size:12px;color:var(--text3)">Önerilerde olmayan bir ürünü veya parametreyi buradan ekleyebilirsiniz.</div>';
  }
  html+='</div>';
  if(!bolumler.length) html='<div style="padding:12px;font-size:12px;color:var(--text3)">Yukarıdan en az bir kategori seçin.</div>'+html;
  el.innerHTML=html+'<datalist id="td-param-dl">'+(state.stokSettings.parametreler||[]).filter(function(p){return p.aktif!==false;}).map(function(p){return '<option value="'+esc(p.ad)+'">'+esc(p.kisaltma||'')+'</option>';}).join('')+'</datalist>';
  tdOzetRender();
}

function tdSatirHtml(r){
  var h=tdHedefOf(r);
  var sinifSel='<select style="font-size:12px;padding:2px 4px;font-weight:700;color:'+TD_SINIF_RENK[r.sinif]+'" onchange="tdSinifDegis(\''+esc(r.key).replace(/'/g,"\\'")+'\',this.value)" title="'+(r.sinifManuel?'Elle verildi':'Otomatik (tüketime göre)')+'">'
    +['A','B','C'].map(function(s){return '<option value="'+s+'"'+(s===r.sinif?' selected':'')+'>'+s+(s===r.sinif&&r.sinifManuel?' ✎':'')+'</option>';}).join('')
    +(r.sinifManuel?'<option value="oto">Otomatiğe dön</option>':'')+'</select>';
  var bos=!r.miktar;
  return '<tr data-key="'+esc(r.key)+'"'+(bos?' style="opacity:.55"':'')+'>'
    +'<td style="text-align:center">'+sinifSel+'</td>'
    +'<td class="col-name" style="font-weight:500">'+esc(r.tamAd)+'</td>'
    +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(r.kisaltma||'—')+'</td>'
    +'<td style="font-family:var(--font-mono);font-size:12px">'+esc(r.cutoff||'—')+'</td>'
    +'<td style="text-align:right;font-family:var(--font-mono);font-size:12px;color:var(--text3)">'+(r.tuketim?tdFmt(r.tuketim):'—')+'</td>'
    +'<td style="text-align:right;font-family:var(--font-mono)">'+tdFmt(r.mevcut)+'</td>'
    +'<td style="text-align:right;font-family:var(--font-mono);color:var(--text3)">'+tdFmt(h)+'</td>'
    +'<td><input type="number" min="0" step="'+(r.kaynak==='ham'?'0.001':'1')+'" value="'+(r.miktar||'')+'" placeholder="0" style="width:100%;'+(r.elle?'border-color:var(--amber)':'')+'" title="'+(r.elle?'Elle girildi':'Önerilen miktar')+'" onchange="tdMiktarDegis(\''+esc(r.key).replace(/'/g,"\\'")+'\',this.value)"></td>'
    +'<td style="font-size:11px;color:var(--text3)">'+(r.kaynak==='ham'?'sh':'ad')+'</td>'
    +'</tr>';
}

function tdManuelSatirHtml(r){
  var k=esc(r.key).replace(/'/g,"\\'");
  var inp=function(alan,ph,extra){return '<input type="text" data-alan="'+alan+'" value="'+esc(r[alan]||'')+'" placeholder="'+ph+'" style="width:100%" onchange="tdManuelAlan(\''+k+'\',\''+alan+'\',this.value)"'+(extra||'')+'>';};
  return '<tr data-key="'+esc(r.key)+'">'
    +'<td><select style="width:100%" onchange="tdManuelAlan(\''+k+'\',\'kaynak\',this.value)"><option value="ham"'+(r.kaynak==='ham'?' selected':'')+'>Yarı Mamul</option><option value="bitmis"'+(r.kaynak==='bitmis'?' selected':'')+'>Hazır Ürün</option></select></td>'
    +'<td><select style="width:100%" onchange="tdManuelAlan(\''+k+'\',\'kategoriId\',this.value)">'+tdKatOptions(r.kaynak,r.kategoriId)+'</select></td>'
    +'<td>'+inp('tamAd',r.kaynak==='ham'?'Parametre / ürün adı':'Ürün adı',r.kaynak==='ham'?' list="td-param-dl"':'')+'</td>'
    +'<td>'+inp('kisaltma','ör. AMP')+'</td>'
    +'<td>'+inp('cutoff','ör. 50')+'</td>'
    +'<td><div style="display:flex;align-items:center;gap:4px"><input type="number" min="0" step="'+(r.kaynak==='ham'?'0.001':'1')+'" value="'+(r.miktar||'')+'" placeholder="0" style="width:100%" onchange="tdMiktarDegis(\''+k+'\',this.value)"><span style="font-size:11px;color:var(--text3)">'+(r.kaynak==='ham'?'sh':'ad')+'</span></div></td>'
    +'<td><button class="btn-icon" style="color:var(--red)" onclick="tdManuelSil(\''+k+'\')" title="Kaldır"><i class="ti ti-x"></i></button></td>'
    +'</tr>';
}

function tdSeciliSatirlar(){
  return _tdSatirlar.filter(function(r){
    if(!(r.miktar>0)) return false;
    if(r.manuel) return true;
    return !!_tdKapsam[r.kaynak+'|'+r.kategoriId];
  });
}

function tdOzetRender(){
  var el=document.getElementById('td-ozet'); if(!el) return;
  var sec=tdSeciliSatirlar();
  var sh=0,ad=0;sec.forEach(function(r){if(r.kaynak==='ham')sh+=r.miktar;else ad+=r.miktar;});
  el.innerHTML='<b>'+sec.length+'</b> kalem'+(sh?' · <b>'+tdFmt(sh)+'</b> sheet':'')+(ad?' · <b>'+tdFmt(ad)+'</b> adet':'');
}

async function saveTedarik(){
  var tarih=document.getElementById('td-tarih').value;
  if(!tarih) return toast('Tarih zorunludur.','error');
  var sec=tdSeciliSatirlar();
  if(!sec.length) return toast('En az bir kaleme tedarik miktarı girin.','error');
  var eksik=sec.find(function(r){return r.manuel&&!(r.tamAd||'').trim();});
  if(eksik) return toast('Manuel eklenen kalemlerde ürün / parametre adı zorunludur.','error');
  // Kaydedilen sıra = ekrandaki sıra (kategori bölümleri, sonra manueller)
  var sira=[];
  var sinifSira={A:0,B:1,C:2};
  tdKapsamListesi().forEach(function(b){
    sec.filter(function(r){return !r.manuel&&r.kaynak===b.kaynak&&r.kategoriId===b.kategoriId;})
      .sort(function(x,y){return (sinifSira[x.sinif]-sinifSira[y.sinif])||(x.tamAd||'').localeCompare(y.tamAd||'','tr')||(x.cutoff||'').localeCompare(y.cutoff||'','tr');})
      .forEach(function(r){sira.push(r);});
  });
  sec.filter(function(r){return r.manuel;}).forEach(function(r){sira.push(r);});
  var payload={
    id:_tdEditId||undefined,
    tarih:tarih,
    tedarikci:document.getElementById('td-tedarikci').value.trim(),
    notlar:document.getElementById('td-notlar').value.trim(),
    hedefler:_tdHedefler,
    kalemler:sira.map(function(r){
      return {kaynak:r.kaynak,kategoriId:r.kategoriId||null,anahtar:r.anahtar||(r.manuel?(r.kisaltma||r.tamAd):''),tamAd:(r.tamAd||'').trim(),kisaltma:r.kisaltma||'',cutoff:r.cutoff||'',
        marka:r.marka||'',model:r.model||'',sinif:r.sinif||'',mevcut:r.manuel?null:r.mevcut,hedef:r.manuel?null:tdHedefOf(r),miktar:r.miktar,manuel:!!r.manuel};
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
