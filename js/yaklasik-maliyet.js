// ════ YAKLAŞIK MALİYET (Yurtdışı Satış Portalı) ════
// Teklif öncesi fiyat araştırması: kalem alış fiyatı + navlun % + gümrük % + kâr % → teklif birim fiyatı.
// Sonuç "Teklife Aktar" ile taslak teklife aktarılır (sunucu: api/yaklasik-maliyet, tek işlemde kayıt + aktarım).
// Durum saklanmaz: bağlı teklif yoksa Taslak, teklif Taslak ise "Teklife aktarıldı", değilse Kilitli.

// ── HESAP ÇEKİRDEĞİ (DOM'dan bağımsız; formüller spesifikasyondan birebir) ──
// Üç oran da alış fiyatının yüzdesidir ve toplanır (bileşik değildir). Yalnızca teklif birim fiyatı 2 ondalığa yuvarlanır.
const YM_ORANLAR=[['navlun','Navlun %','frt'],['gumruk','Gümrük %','cus'],['kar','Kâr %','mar']];
function ymNum(v){var n=parseFloat(v);return isFinite(n)?n:0;}
function ymBos(v){return String(v==null?'':v).trim()==='';}
function ymSatirHesap(it){
  var q=ymNum(it.adet),c=ymNum(it.alis);
  var fr=ymNum(it.navlun)/100,cu=ymNum(it.gumruk)/100,ma=ymNum(it.kar)/100;
  var f=c*(1+fr),g=c*(1+fr+cu);
  var o=Math.round(c*(1+fr+cu+ma)*100)/100;
  return{q:q,c:c,f:f,g:g,o:o,tc:c*q,tf:f*q,tg:g*q,to:o*q};
}
function ymToplamlar(items){
  return(items||[]).reduce(function(s,it){var x=ymSatirHesap(it);return{c:s.c+x.tc,f:s.f+x.tf,g:s.g+x.tg,o:s.o+x.to};},{c:0,f:0,g:0,o:0});
}
// Alış fiyatı veya oranlardan biri boşsa eksik (0 boş değildir)
function ymEksik(it){return ymBos(it.alis)||YM_ORANLAR.some(function(r){return ymBos(it[r[0]]);});}
// Yalnızca ürün adı dolu satırlar eksik sayılır
function ymSatirEksik(it){return !ymBos(it.aciklama)&&ymEksik(it);}

// ── DURUM / BİÇİM ──
const YM_DURUM={taslak:{ad:'Taslak',en:'Draft',cls:'badge-sf'},aktarildi:{ad:'Teklife aktarıldı',en:'Transferred',cls:'badge-onaylandi'},kilitli:{ad:'Kilitli',en:'Locked',cls:'badge-gray'}};
function ymDurumRozet(d){var x=YM_DURUM[d]||YM_DURUM.taslak;return'<span class="badge '+x.cls+'">'+x.ad+'</span>';}
function ymSembol(pb){return{USD:'$',EUR:'€',GBP:'£',TRY:'₺'}[pb]||'';}
function ymSayi(v){return new Intl.NumberFormat('tr-TR',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);}
function ymPara(v,pb){return ymSembol(pb)+ymSayi(v);}
function ymUuid(){
  if(window.crypto&&crypto.randomUUID)return crypto.randomUUID();
  return'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,function(c){var r=Math.random()*16|0;return(c==='x'?r:(r&3|8)).toString(16);});
}
function ymMusteriAdi(m){return(m.musteri&&(m.musteri.firma||m.musteri.kisi))||'';}

// ════ LİSTE ════
var _ymSort={col:'tarih',dir:'desc'};
var _ymSayfa=1,_ymSayfaBoyutu=25,_ymFiltreHash='';
function setYmSayfa(n){_ymSayfa=n;renderYaklasikMaliyetler();}
function ymSayfaBoyutu(v){_ymSayfaBoyutu=parseInt(v)||25;_ymSayfa=1;renderYaklasikMaliyetler();}

async function loadYaklasikMaliyetler(){
  try{
    var res=await apiGet('yaklasik-maliyet');
    state.yaklasikMaliyetler=res.maliyetler||[];
  }catch(e){
    toast(esc(e.message||'Yaklaşık maliyetler yüklenemedi.'),'error');
    state.yaklasikMaliyetler=state.yaklasikMaliyetler||[];
  }
  var bs=document.getElementById('ym-sayfa-boyutu');if(bs)bs.value=String(_ymSayfaBoyutu);
  renderYaklasikMaliyetler();
}
function ymSirala(col){
  if(_ymSort.col===col)_ymSort.dir=_ymSort.dir==='asc'?'desc':'asc';
  else{_ymSort.col=col;_ymSort.dir=(col==='tarih'||col==='alis'||col==='teklifTutari')?'desc':'asc';}
  renderYaklasikMaliyetler();
}
function ymFiltreTemizle(){
  document.getElementById('ym-ara').value='';
  document.getElementById('ym-f-durum').value='';
  renderYaklasikMaliyetler();
}
function _ymFiltreli(){
  var q=(document.getElementById('ym-ara').value||'').trim().toLocaleLowerCase('tr-TR');
  var fd=document.getElementById('ym-f-durum').value;
  return(state.yaklasikMaliyetler||[]).filter(function(m){
    if(fd&&m.durum!==fd)return false;
    if(!q)return true;
    var alanlar=[m.numara,ymMusteriAdi(m),m.teklif&&m.teklif.teklifNo].concat((m.kalemler||[]).map(function(k){return k.aciklama;}));
    return alanlar.some(function(a){return String(a||'').toLocaleLowerCase('tr-TR').indexOf(q)>=0;});
  });
}
function _ymSirali(list){
  var deger=function(m){
    switch(_ymSort.col){
      case 'tarih':return m.tarih||'';
      case 'numara':return m.numara||'';
      case 'musteri':return ymMusteriAdi(m).toLocaleLowerCase('tr-TR');
      case 'kalem':return(m.kalemler||[]).length;
      case 'alis':return ymToplamlar(m.kalemler).c;
      case 'teklifTutari':return ymToplamlar(m.kalemler).o;
      case 'teklif':return m.teklif?m.teklif.teklifNo:'';
      case 'durum':return(YM_DURUM[m.durum]||{}).ad||'';
    }
    return'';
  };
  var dir=_ymSort.dir==='asc'?1:-1;
  return list.slice().sort(function(a,b){var va=deger(a),vb=deger(b);return va<vb?-dir:va>vb?dir:0;});
}
function renderYaklasikMaliyetler(){
  var tum=state.yaklasikMaliyetler||[];
  var liste=_ymSirali(_ymFiltreli());
  var aktifFiltre=(document.getElementById('ym-ara').value.trim()?1:0)+(document.getElementById('ym-f-durum').value?1:0);
  document.getElementById('ym-filtre-sayi').textContent=aktifFiltre?(aktifFiltre+' filtre · '+liste.length+'/'+tum.length+' belge'):(tum.length+' belge');
  document.getElementById('ym-filtre-temizle').style.display=aktifFiltre?'':'none';
  document.querySelectorAll('[id^=ymsort-]').forEach(function(el){el.innerHTML='';});
  var si=document.getElementById('ymsort-'+_ymSort.col);if(si)si.innerHTML=_ymSort.dir==='asc'?'<i class="ti ti-arrow-narrow-up"></i>':'<i class="ti ti-arrow-narrow-down"></i>';
  var hash=JSON.stringify([document.getElementById('ym-ara').value,document.getElementById('ym-f-durum').value,_ymSort]);
  if(hash!==_ymFiltreHash){_ymSayfa=1;_ymFiltreHash=hash;}

  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  bulkSetVisible('ymList',liste.map(function(m){return m.id;}));
  var secili=bulkCount('ymList');
  var ca=document.getElementById('ym-check-all');if(ca){ca.checked=bulkAllChecked('ymList');ca.style.display=canEdit?'':'none';}
  document.getElementById('ym-bulk-count').textContent=secili?secili+' belge seçildi':'';
  document.getElementById('ym-bulk-bar').innerHTML=secili
    ?'<button class="btn btn-ghost btn-sm" style="color:var(--green)" onclick="ymListeExcel(true)"><i class="ti ti-file-download"></i> Seçilenleri dışa aktar</button><button class="btn btn-danger btn-sm" onclick="ymTopluSil()"><i class="ti ti-trash"></i> Sil</button>'
    :'';

  var tbody=document.getElementById('ym-table-body');
  var bos=document.getElementById('ym-empty');
  if(!liste.length){
    tbody.innerHTML='';
    bos.innerHTML=tum.length
      ?'<div class="icon"><i class="ti ti-filter-off"></i></div><h3 style="color:var(--text2)">Filtreye uyan kayıt yok</h3>'
      :'<div class="icon"><i class="ti ti-calculator"></i></div><h3 style="color:var(--text2)">Henüz yaklaşık maliyet yok</h3><p style="font-size:13px;max-width:460px;margin:8px auto 0;line-height:1.6">Her kalemin alış fiyatını toplayın, navlun, gümrük ve kâr oranlarını ekleyin, ardından sonucu teklife aktarın.</p>';
    bos.style.display='';
    renderPagination('ym-pagination',1,0,'setYmSayfa',_ymSayfaBoyutu);
    return;
  }
  bos.style.display='none';
  var sayfa=liste.slice((_ymSayfa-1)*_ymSayfaBoyutu,_ymSayfa*_ymSayfaBoyutu);
  renderPagination('ym-pagination',_ymSayfa,liste.length,'setYmSayfa',_ymSayfaBoyutu);
  tbody.innerHTML=sayfa.map(function(m){
    var t=ymToplamlar(m.kalemler);
    return'<tr tabindex="0" style="cursor:pointer" onclick="goYmForm(\''+esc(m.id)+'\')" onkeydown="if(event.key===\'Enter\')goYmForm(\''+esc(m.id)+'\')">'
      +'<td style="text-align:center" onclick="event.stopPropagation()">'+(canEdit?'<input type="checkbox" '+(bulkIsChecked('ymList',m.id)?'checked':'')+' onchange="bulkToggleRow(\'ymList\',\''+esc(m.id)+'\',\'renderYaklasikMaliyetler\')">':'')+'</td>'
      +'<td style="color:var(--text3);font-size:12px">'+fmtDate(m.tarih)+'</td>'
      +'<td><span class="kn-badge">'+esc(m.numara)+'</span></td>'
      +'<td style="font-weight:500;max-width:260px;white-space:normal;word-break:break-word">'+esc(ymMusteriAdi(m)||'—')+'</td>'
      +'<td style="text-align:center">'+(m.kalemler||[]).length+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono);font-size:12px">'+ymPara(t.c,m.paraBirimi)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono);font-size:12px;font-weight:700">'+ymPara(t.o,m.paraBirimi)+'</td>'
      +'<td>'+(m.teklif?'<span class="ym-chip">'+esc(m.teklif.teklifNo)+'</span>':'<span style="color:var(--text3)">—</span>')+'</td>'
      +'<td style="text-align:center">'+ymDurumRozet(m.durum)+'</td>'
    +'</tr>';
  }).join('');
}
function ymTopluSil(){
  var ids=bulkSelectedIds('ymList');if(!ids.length)return;
  showConfirm('Seçilen '+ids.length+' belge silinsin mi?',async function(){
    var hata=0;
    for(var i=0;i<ids.length;i++){
      try{await apiDelete('yaklasik-maliyet?id='+encodeURIComponent(ids[i]));state.yaklasikMaliyetler=state.yaklasikMaliyetler.filter(function(x){return x.id!==ids[i];});}
      catch(e){hata++;}
    }
    bulkClear('ymList');renderYaklasikMaliyetler();
    toast(hata?(ids.length-hata)+' belge silindi, '+hata+' belge silinemedi (kilitli olabilir).':ids.length+' belge silindi.',hata?'error':'info');
  },{title:'Sil',okText:'Sil',okClass:'btn-danger'});
}

// ════ FORM ════
var ymCur=null;          // açık belge (yeni belgede id:null)
var ymItems=[];
var ymSecili=new Set();  // seçili satır id'leri
var _ymKaynakIdx=-1;

function _ymEl(id){return document.getElementById(id);}
function _ymKilitli(){return!!(ymCur&&ymCur.durum==='kilitli');}
function _ymPB(){return _ymEl('ymf-paraBirimi').value||'USD';}
function ymYeniSatir(){var o=(ymCur&&ymCur.oranlar)||{};return{id:ymUuid(),kategori:'',aciklama:'',marka:'',model:'',birim:'',adet:'1',alis:'',navlun:o.frt||'',gumruk:o.cus||'',kar:o.mar||'',kaynak:''};}
function _ymSatirBos(it){return ymBos(it.aciklama)&&ymBos(it.alis);}
function _ymSonrakiNumara(){
  var p=(state.settings&&state.settings.ymPrefix)||'YM';
  var bas=Math.max(1,parseInt(state.settings&&state.settings.ymBaslangic)||1);
  var mx=0;
  (state.yaklasikMaliyetler||[]).forEach(function(m){if((m.numara||'').indexOf(p)===0){var r=m.numara.slice(p.length);if(/^\d+$/.test(r))mx=Math.max(mx,parseInt(r));}});
  return p+String(Math.max(bas,mx+1)).padStart(4,'0');
}

function goYmForm(idOrDoc){
  var d=typeof idOrDoc==='object'&&idOrDoc?idOrDoc:(idOrDoc?(state.yaklasikMaliyetler||[]).find(function(x){return x.id===idOrDoc;}):null);
  if(idOrDoc&&!d)return;
  if(!d&&state.currentUser&&state.currentUser.rol==='izleyici'){toast('Yetki yok.','error');return;}
  ymCur=d?JSON.parse(JSON.stringify(d)):{id:null,numara:_ymSonrakiNumara(),tarih:today(),paraBirimi:'USD',musteriId:null,musteri:{firma:'',kisi:'',email:'',tel:'',adres:''},oranlar:{frt:'',cus:'',mar:''},notlar:'',teklif:null,durum:'taslak',kalemler:[]};
  ymItems=ymCur.kalemler&&ymCur.kalemler.length?ymCur.kalemler.map(function(k){return Object.assign({},k);}):[ymYeniSatir()];
  ymSecili=new Set();
  _ymEl('ymf-numara').value=ymCur.numara||'';
  _ymEl('ymf-tarih').value=ymCur.tarih||today();
  _ymEl('ymf-paraBirimi').value=ymCur.paraBirimi||'USD';
  _ymEl('ymf-notlar').value=ymCur.notlar||'';
  _ymEl('ymf-oran-frt').value=ymCur.oranlar.frt||'';
  _ymEl('ymf-oran-cus').value=ymCur.oranlar.cus||'';
  _ymEl('ymf-oran-mar').value=ymCur.oranlar.mar||'';
  _ymEl('ymf-firma').value=ymCur.musteri.firma||'';
  var sel=_ymEl('ymf-musteri');
  sel.innerHTML='<option value="">— Seçin —</option>'+(state.musteriler||[]).slice().sort(function(a,b){return(a.kurum||'').localeCompare(b.kurum||'','tr');}).map(function(m){return'<option value="'+esc(m.id)+'">'+esc(m.kurum)+'</option>';}).join('');
  sel.value=ymCur.musteriId&&(state.musteriler||[]).some(function(m){return m.id===ymCur.musteriId;})?ymCur.musteriId:'';
  _ymBaslikGuncelle();
  ymRenderTablo();
  showPage('ym-form',true);
  _formDirty=false;
}

function _ymBaslikGuncelle(){
  var kilitli=_ymKilitli();
  var t=ymCur.teklif;
  _ymEl('ymf-title').textContent=ymCur.id?'Yaklaşık Maliyet Düzenle — '+ymCur.numara:'Yeni Yaklaşık Maliyet';
  _ymEl('ymf-durum').innerHTML=ymCur.id?ymDurumRozet(ymCur.durum):'';
  _ymEl('ymf-sil-btn').style.display=(ymCur.id&&!kilitli)?'':'none';
  _ymEl('ymf-aktar-btn').style.display=kilitli?'none':'';
  _ymEl('ymf-aktar-label').textContent=(t&&ymCur.durum==='aktarildi')?t.teklifNo+' Teklifini Güncelle':'Teklife Aktar';
  _ymEl('ymf-kaydet-btn').style.display=kilitli?'none':'';
  _ymEl('ymf-alt-aksiyon').style.display=kilitli?'none':'';
  _ymEl('ymf-oran-card').style.display=kilitli?'none':'';
  _ymEl('ymf-arac').style.display=kilitli?'none':'';
  _ymEl('ymf-satir-ekle').style.display=kilitli?'none':'';
  var band=_ymEl('ymf-band');
  if(t&&ymCur.durum==='aktarildi'){band.className='ym-band';band.textContent=t.teklifNo+' taslak teklifine aktarıldı. Burada oran veya kalem değiştirdikten sonra "Teklifi Güncelle" ile teklife yansıtın.';band.style.display='';}
  else if(t&&kilitli){band.className='ym-band ym-band-kilitli';band.textContent=t.teklifNo+' teklifine aktarıldı ve teklif gönderildi — bu yaklaşık maliyet artık değiştirilemez. Revizyonlara Teklifler menüsünden devam edin.';band.style.display='';}
  else band.style.display='none';
  ['ymf-numara','ymf-tarih','ymf-paraBirimi','ymf-musteri','ymf-firma','ymf-notlar'].forEach(function(id){_ymEl(id).disabled=kilitli;});
}

// ── Detaylar ──
function ymOnParaBirimi(){ymRenderTablo();}
function ymOnMusteriSec(){
  var id=_ymEl('ymf-musteri').value;
  var m=(state.musteriler||[]).find(function(x){return x.id===id;});
  ymCur.musteriId=m?m.id:null;
  if(m){
    ymCur.musteri={firma:m.kurum||'',kisi:m.kisi||'',email:m.email||'',tel:m.tel||'',adres:[m.adres,m.sehir,m.ulke].filter(Boolean).join(', ')};
    _ymEl('ymf-firma').value=m.kurum||'';
  }
}
function ymOnFirmaYaz(){
  // Elle yazılan firma adı kayıtlı müşteri bağlantısını kaldırır
  ymCur.musteriId=null;
  _ymEl('ymf-musteri').value='';
  ymCur.musteri={firma:_ymEl('ymf-firma').value,kisi:'',email:'',tel:'',adres:''};
}
// Varsayılan oran değişince yalnızca ürün adı ve alış fiyatı boş satırlara da yazılır
function ymOnVarsayilanOran(k,v){
  ymCur.oranlar[k]=v;
  var alan={frt:'navlun',cus:'gumruk',mar:'kar'}[k];
  var degisti=false;
  ymItems.forEach(function(it){if(_ymSatirBos(it)){it[alan]=v;degisti=true;}});
  if(degisti)ymRenderTablo();
}

// ── Kalem tablosu ──
const YM_KOLONLAR=[
  {k:'_sec',w:34,sticky:true},
  {k:'_no',ad:'#',w:34,sticky:true},
  {k:'aciklama',ad:'Ürün Adı',w:280,sticky:true},
  {k:'kategori',ad:'Kategori',w:110},
  {k:'marka',ad:'Marka',w:110},
  {k:'model',ad:'Model',w:100},
  {k:'birim',ad:'Birim',w:64},
  {k:'adet',ad:'Adet',w:68,sag:true},
  {k:'alis',ad:'Birim Alış Fiyatı',w:104,sag:true},
  {k:'navlun',ad:'Navlun %',w:80,sag:true},
  {k:'gumruk',ad:'Gümrük %',w:80,sag:true},
  {k:'kar',ad:'Kâr %',w:80,sag:true},
  {k:'_o',ad:'Teklif Birim Fiyatı',w:104,sag:true},
  {k:'_to',ad:'Teklif Tutarı',w:116,sag:true},
  {k:'kaynak',ad:'Kaynak',w:150},
  {k:'_sil',w:34}
];
function _ymKolonlar(){var k=_ymKilitli();return YM_KOLONLAR.filter(function(c){return!(k&&(c.k==='_sec'||c.k==='_sil'));});}

function ymRenderTablo(){
  var kilitli=_ymKilitli();
  var kol=_ymKolonlar();
  var tablo=_ymEl('ymf-tablo');
  tablo.style.width=kol.reduce(function(a,c){return a+c.w;},0)+'px';
  tablo.classList.toggle('ym-kilitli',kilitli);
  _ymEl('ymf-colgroup').innerHTML=kol.map(function(c){return'<col style="width:'+c.w+'px">';}).join('');
  // Yapışık kolonların sol ofsetleri: kilitliyken # = 0, Ürün Adı = 34; normalde # = 34, Ürün Adı = 68
  var sol=0,ofset={};
  kol.forEach(function(c){if(c.sticky){ofset[c.k]=sol;sol+=c.w;}});
  var stil=function(c){return c.sticky?' style="left:'+ofset[c.k]+'px"':'';};
  var cls=function(c,ek){return(c.sticky?'ym-sticky'+(c.k==='aciklama'?' ym-sticky-son':''):'')+(c.sag?' ym-sag':'')+(ek?' '+ek:'');};
  var tumSecili=ymItems.length>0&&ymItems.every(function(it){return ymSecili.has(it.id);});
  _ymEl('ymf-thead').innerHTML='<tr>'+kol.map(function(c){
    var ic=c.k==='_sec'?'<input type="checkbox" '+(tumSecili?'checked':'')+' onchange="ymTumunuSec(this.checked)" aria-label="Tümünü seç">':(c.ad||'');
    return'<th class="'+cls(c,c.k==='_sec'||c.k==='_no'?'ym-orta':'')+'"'+stil(c)+'>'+ic+'</th>';
  }).join('')+'</tr>';
  var ro=kilitli?' readonly':'';
  var pb=_ymPB();
  _ymEl('ymf-body').innerHTML=ymItems.map(function(it,i){
    var tr='<tr id="ymr-'+i+'" class="'+(ymSecili.has(it.id)?'ym-secili':'')+'">';
    kol.forEach(function(c){
      var h='';
      switch(c.k){
        case '_sec':h='<input type="checkbox" '+(ymSecili.has(it.id)?'checked':'')+' onchange="ymSatirSec('+i+',this.checked)" aria-label="Satırı seç">';break;
        case '_no':h='<span class="ym-no">'+(i+1)+'</span>';break;
        case 'aciklama':h='<textarea rows="1" data-f="aciklama" data-i="'+i+'" oninput="ymSet('+i+',\'aciklama\',this.value);ymOtoYukseklik(this)"'+ro+'>'+esc(it.aciklama||'')+'</textarea>';break;
        case 'kategori':case 'marka':case 'model':case 'birim':
          h='<input type="text" data-f="'+c.k+'" data-i="'+i+'" value="'+esc(it[c.k]||'')+'"'+(c.k==='birim'?' placeholder="pcs"':'')+' oninput="ymSet('+i+',\''+c.k+'\',this.value)"'+ro+'>';break;
        case 'adet':h='<input type="number" min="0" step="any" data-f="adet" data-i="'+i+'" value="'+esc(it.adet)+'" oninput="ymSet('+i+',\'adet\',this.value)"'+ro+'>';break;
        case 'alis':h='<input type="number" min="0" step="any" data-f="alis" data-i="'+i+'" value="'+esc(it.alis)+'" placeholder="0.00" oninput="ymSet('+i+',\'alis\',this.value)"'+ro+'>';break;
        case 'navlun':case 'gumruk':case 'kar':
          h='<input type="number" step="any" data-f="'+c.k+'" data-i="'+i+'" value="'+esc(it[c.k])+'" placeholder="—" oninput="ymSet('+i+',\''+c.k+'\',this.value)"'+ro+'>'
            +(c.k!=='kar'?'<div class="ym-ara" id="ymr-'+c.k+'-'+i+'"></div>':'');break;
        case '_o':h='<span id="ymr-o-'+i+'"></span>';break;
        case '_to':h='<strong id="ymr-to-'+i+'"></strong>';break;
        case 'kaynak':h='<button type="button" class="ym-kaynak-btn" id="ymr-kaynak-'+i+'" onclick="ymKaynakAc('+i+')"></button>';break;
        case '_sil':h='<button type="button" class="btn-icon" style="color:var(--red)" title="Satırı sil" onclick="ymSatirSil('+i+')">×</button>';break;
      }
      tr+='<td class="'+cls(c,c.k==='_sec'||c.k==='_no'||c.k==='_sil'?'ym-orta':'')+'"'+stil(c)+'>'+h+'</td>';
    });
    return tr+'</tr>';
  }).join('');
  _ymEl('ymf-body').querySelectorAll('textarea').forEach(ymOtoYukseklik);
  ymItems.forEach(function(_,i){_ymSatirGuncelle(i);});
  _ymToplamGuncelle();
  _ymSecimBar();
  _ymKategoriListesi();
}
function ymOtoYukseklik(el){el.style.height='auto';el.style.height=el.scrollHeight+'px';}

// Hesaplanan hücreler ve eksik işaretleri (yazarken odak kaybolmasın diye yalnızca ilgili hücreler güncellenir)
function _ymSatirGuncelle(i){
  var it=ymItems[i];if(!it)return;
  var x=ymSatirHesap(it),pb=_ymPB();
  var tr=_ymEl('ymr-'+i);if(!tr)return;
  var eksik=ymSatirEksik(it);
  tr.classList.toggle('ym-eksik',eksik);
  ['alis','navlun','gumruk','kar'].forEach(function(f){
    var inp=tr.querySelector('[data-f="'+f+'"]');
    if(inp)inp.classList.toggle('ym-bos',eksik&&ymBos(it[f]));
  });
  var alisVar=!ymBos(it.alis);
  var fe=_ymEl('ymr-navlun-'+i);if(fe)fe.textContent=alisVar?ymSayi(x.f):'';
  var ge=_ymEl('ymr-gumruk-'+i);if(ge)ge.textContent=alisVar?ymSayi(x.g):'';
  _ymEl('ymr-o-'+i).textContent=ymSayi(x.o);
  _ymEl('ymr-to-'+i).textContent=ymSayi(x.to);
  var kb=_ymEl('ymr-kaynak-'+i);
  if(kb){
    var ilk=(it.kaynak||'').split('\n').map(function(s){return s.trim();}).find(Boolean)||'';
    var link=/(https?:\/\/|www\.)/i.test(it.kaynak||'');
    kb.innerHTML=ilk?(link?'<i class="ti ti-link"></i> ':'')+'<span>'+esc(ilk)+'</span>':(_ymKilitli()?'<span style="color:var(--text3)">—</span>':'<span style="color:var(--text3)">+ Ekle</span>');
    kb.title=it.kaynak||'';
  }
}
function _ymToplamGuncelle(){
  var t=ymToplamlar(ymItems),pb=_ymPB();
  _ymEl('ymf-alt-toplam').textContent=ymPara(t.o,pb);
  var kart=function(ad,v,vurgu){return'<div class="ym-ozet-kart'+(vurgu?' ym-ozet-vurgu':'')+'"><div class="ym-ozet-ad">'+ad+'</div><div class="ym-ozet-deger">'+ymPara(v,pb)+'</div></div>';};
  _ymEl('ymf-ozet').innerHTML=kart('Toplam Alış',t.c)+kart('Navlun Maliyeti',t.f-t.c)+kart('Gümrük Maliyeti',t.g-t.f)+kart('Gümrüklü Maliyet',t.g)+kart('Kâr',t.o-t.g)+kart('Teklif Tutarı',t.o,true);
  var eksik=ymItems.filter(ymSatirEksik).length;
  var ek=_ymEl('ymf-eksik');
  ek.textContent=eksik+' kalemde alış fiyatı ya da bir oran boş (işaretli satırlar).';
  ek.style.display=eksik?'':'none';
}
function ymSet(i,f,v){
  if(!ymItems[i])return;
  ymItems[i][f]=v;
  _ymSatirGuncelle(i);
  _ymToplamGuncelle();
  if(f==='kategori')_ymKategoriListesi();
}

// ── Satır işlemleri ──
function ymSatirEkle(sonraki){
  var yeni=ymYeniSatir();
  if(typeof sonraki==='number')ymItems.splice(sonraki,0,yeni);else ymItems.push(yeni);
  _formDirty=true;
  ymRenderTablo();
  var idx=typeof sonraki==='number'?sonraki:ymItems.length-1;
  var el=document.querySelector('#ymr-'+idx+' [data-f="aciklama"]');if(el)el.focus();
  return idx;
}
function ymSatirSil(i){
  var it=ymItems[i];if(!it)return;
  ymSecili.delete(it.id);
  ymItems.splice(i,1);
  if(!ymItems.length)ymItems=[ymYeniSatir()];
  _formDirty=true;
  ymRenderTablo();
}
function ymSatirSec(i,v){var it=ymItems[i];if(!it)return;if(v)ymSecili.add(it.id);else ymSecili.delete(it.id);var tr=_ymEl('ymr-'+i);if(tr)tr.classList.toggle('ym-secili',v);_ymSecimBar();var h=document.querySelector('#ymf-thead input[type=checkbox]');if(h)h.checked=ymItems.every(function(x){return ymSecili.has(x.id);});}
function ymTumunuSec(v){ymSecili=new Set(v?ymItems.map(function(x){return x.id;}):[]);ymRenderTablo();}
function _ymSecimBar(){
  var bar=_ymEl('ymf-secim-bar');
  var n=ymItems.filter(function(x){return ymSecili.has(x.id);}).length;
  if(!n||_ymKilitli()){bar.style.display='none';bar.innerHTML='';return;}
  bar.innerHTML='<span>'+n+' satır seçili</span><button class="btn btn-ghost btn-sm" onclick="ymOranAc()"><i class="ti ti-percentage"></i> Oran Uygula</button><button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="ymSeciliSil()"><i class="ti ti-trash"></i> Sil</button><button class="btn btn-ghost btn-sm" style="color:var(--text3)" onclick="ymTumunuSec(false)">Seçimi temizle</button>';
  bar.style.display='';
}
function ymSeciliSil(){
  var n=ymItems.filter(function(x){return ymSecili.has(x.id);}).length;if(!n)return;
  showConfirm('Seçilen '+n+' satır silinsin mi?',function(){
    ymItems=ymItems.filter(function(x){return!ymSecili.has(x.id);});
    ymSecili=new Set();
    if(!ymItems.length)ymItems=[ymYeniSatir()];
    _formDirty=true;ymRenderTablo();
  },{title:'Satırları Sil',okText:'Sil',okClass:'btn-danger'});
}
function _ymKategoriListesi(){
  var sel=_ymEl('ymf-kategori-sec');
  var kat=[];ymItems.forEach(function(it){var k=(it.kategori||'').trim();if(k&&kat.indexOf(k)<0)kat.push(k);});
  if(!kat.length||_ymKilitli()){sel.style.display='none';return;}
  kat.sort(function(a,b){return a.localeCompare(b,'tr');});
  sel.innerHTML='<option value="">Kategoriye göre seç…</option>'+kat.map(function(k){return'<option value="'+esc(k)+'">'+esc(k)+'</option>';}).join('');
  sel.style.display='';
}
function ymKategoriSec(k){
  if(!k)return;
  ymItems.forEach(function(it){if((it.kategori||'').trim()===k)ymSecili.add(it.id);});
  ymRenderTablo();
}

// Enter: alttaki satır boşsa oraya geçer, değilse altına yeni satır ekleyip aynı alana odaklanır
document.addEventListener('keydown',function(e){
  if(e.key!=='Enter'||e.shiftKey||e.ctrlKey||e.altKey||e.metaKey)return;
  var t=e.target;
  if(!t||!t.closest||!t.closest('#ymf-body')||!t.dataset.f||t.readOnly||t.type==='checkbox')return;
  e.preventDefault();
  var i=parseInt(t.dataset.i),f=t.dataset.f;
  var hedef=i+1;
  if(!(ymItems[hedef]&&_ymSatirBos(ymItems[hedef])))hedef=ymSatirEkle(i+1);
  var el=document.querySelector('#ymr-'+hedef+' [data-f="'+f+'"]');if(el)el.focus();
});

// ── Oran Uygula ──
function ymOranAc(){
  var n=ymItems.filter(function(x){return ymSecili.has(x.id);}).length;if(!n)return;
  _ymEl('ym-oran-baslik').textContent='Oran Uygula — '+n+' seçili';
  ['frt','cus','mar'].forEach(function(k){_ymEl('ym-oran-'+k).value='';});
  ymOranButon();
  openModal('modal-ym-oran');
  setTimeout(function(){_ymEl('ym-oran-frt').focus();},50);
}
function ymOranButon(){
  var n=ymItems.filter(function(x){return ymSecili.has(x.id);}).length;
  var dolu=['frt','cus','mar'].some(function(k){return!ymBos(_ymEl('ym-oran-'+k).value);});
  var b=_ymEl('ym-oran-uygula-btn');b.disabled=!dolu;b.textContent=n+' kaleme uygula';
}
function ymOranUygula(){
  var deger={navlun:_ymEl('ym-oran-frt').value,gumruk:_ymEl('ym-oran-cus').value,kar:_ymEl('ym-oran-mar').value};
  if(!Object.keys(deger).some(function(k){return!ymBos(deger[k]);}))return;
  ymItems.forEach(function(it){
    if(!ymSecili.has(it.id))return;
    Object.keys(deger).forEach(function(k){if(!ymBos(deger[k]))it[k]=deger[k].trim();});
  });
  ymSecili=new Set();
  _formDirty=true;
  closeModal('modal-ym-oran');
  ymRenderTablo();
}

// ── Kaynak ──
function _ymLinkler(metin){
  var m=String(metin||'').match(/(https?:\/\/[^\s<>"']+|www\.[^\s<>"']+)/gi)||[];
  return m.map(function(l){return{metin:l,url:/^www\./i.test(l)?'https://'+l:l};});
}
function ymKaynakAc(i){
  var it=ymItems[i];if(!it)return;
  _ymKaynakIdx=i;
  _ymEl('ym-kaynak-baslik').textContent='Kaynak — '+(it.aciklama||'(ürün adı yok)');
  var ta=_ymEl('ym-kaynak-metin');
  ta.value=it.kaynak||'';
  ta.readOnly=_ymKilitli();
  _ymEl('ym-kaynak-kaydet').style.display=_ymKilitli()?'none':'';
  ymKaynakLinkler();
  openModal('modal-ym-kaynak');
  if(!_ymKilitli())setTimeout(function(){ta.focus();},50);
}
function ymKaynakLinkler(){
  var l=_ymLinkler(_ymEl('ym-kaynak-metin').value);
  _ymEl('ym-kaynak-linkler').innerHTML=l.length?l.map(function(x){return'<a href="'+esc(x.url)+'" target="_blank" rel="noopener noreferrer"><i class="ti ti-external-link"></i> '+esc(x.metin)+'</a>';}).join(''):'';
}
function ymKaynakKaydet(){
  if(_ymKilitli()||!ymItems[_ymKaynakIdx])return;
  ymItems[_ymKaynakIdx].kaynak=_ymEl('ym-kaynak-metin').value.trim();
  _formDirty=true;
  _ymSatirGuncelle(_ymKaynakIdx);
  closeModal('modal-ym-kaynak');
}

// ── Kaydet / Sil / Teklife Aktar ──
function _ymPayload(aktar){
  return{
    id:ymCur.id,
    numara:_ymEl('ymf-numara').value.trim(),
    tarih:_ymEl('ymf-tarih').value||today(),
    paraBirimi:_ymPB(),
    musteriId:ymCur.musteriId||null,
    musteri:ymCur.musteri,
    oranlar:{frt:_ymEl('ymf-oran-frt').value,cus:_ymEl('ymf-oran-cus').value,mar:_ymEl('ymf-oran-mar').value},
    notlar:_ymEl('ymf-notlar').value,
    kalemler:ymItems.filter(function(it){return!_ymSatirBos(it);}).map(function(it){return Object.assign({},it,{aciklama:(it.aciklama||'').trim()});}),
    aktar:!!aktar
  };
}
async function _ymGonder(aktar){
  var p=_ymPayload(aktar);
  var res=p.id?await apiPut('yaklasik-maliyet',p):await apiPost('yaklasik-maliyet',p);
  var m=res.maliyet;
  var list=state.yaklasikMaliyetler||(state.yaklasikMaliyetler=[]);
  var idx=list.findIndex(function(x){return x.id===m.id;});
  if(idx>=0)list[idx]=m;else list.unshift(m);
  _formDirty=false;
  return res;
}
async function ymKaydet(){
  if(_ymKilitli())return;
  try{
    var res=await _ymGonder(false);
    toast('Yaklaşık maliyet kaydedildi: '+esc(res.maliyet.numara),'success');
    goYmForm(res.maliyet);
  }catch(e){toast(esc(e.message||'Kaydedilemedi.'),'error');}
}
function ymSil(){
  if(!ymCur||!ymCur.id||_ymKilitli())return;
  showConfirm('Bu yaklaşık maliyet silinsin mi?',async function(){
    try{await apiDelete('yaklasik-maliyet?id='+encodeURIComponent(ymCur.id));}
    catch(e){return toast(esc(e.message||'Silinemedi.'),'error');}
    state.yaklasikMaliyetler=(state.yaklasikMaliyetler||[]).filter(function(x){return x.id!==ymCur.id;});
    _formDirty=false;
    toast('Silindi.','info');
    showPage('yaklasik-maliyetler');
  },{title:'Sil',okText:'Sil',okClass:'btn-danger'});
}
function _ymOnayZinciri(adimlar,son){
  // showConfirm modalı kapanırken bir sonrakini açmak için kısa gecikme
  var i=0;
  var sonraki=function(){
    if(i>=adimlar.length)return son();
    var a=adimlar[i++];
    setTimeout(function(){showConfirm(a.mesaj,sonraki,{title:a.baslik,okText:a.ok,okClass:'btn-primary'});},i>1?60:0);
  };
  sonraki();
}
function ymTeklifeAktar(){
  if(_ymKilitli())return;
  var adli=ymItems.filter(function(it){return!ymBos(it.aciklama);});
  if(!adli.length)return toast('Ürün adı olan en az bir kalem ekleyin','error');
  var t=ymCur.teklif;
  if(t&&ymCur.durum==='kilitli')return toast('Teklif gönderilmiş — buradan artık değiştirilemez','error');
  var adimlar=[];
  var eksik=adli.filter(ymSatirEksik).length;
  if(eksik)adimlar.push({baslik:'Eksik Kalemler',mesaj:eksik+' kalemde alış fiyatı ya da bir oran boş. Yine de aktarılsın mı?',ok:'Yine de aktar'});
  if(t&&ymCur.durum==='aktarildi')adimlar.push({baslik:'Teklifi Güncelle',mesaj:esc(t.teklifNo)+' taslak teklifi bu kalemlerle güncellenecek. Teklifte kalemlere elle yapılan değişikliklerin yerine bunlar yazılır.',ok:'Teklifi Güncelle'});
  _ymOnayZinciri(adimlar,async function(){
    var res;
    try{res=await _ymGonder(true);}
    catch(e){
      // Teklif bu arada gönderildiyse belge kilitlenmiştir; güncel hâli yükle
      toast(esc(e.message||'Teklife aktarılamadı.'),'error');
      if(e.status===409&&ymCur.id){
        await loadYaklasikMaliyetler();
        var guncel=(state.yaklasikMaliyetler||[]).find(function(x){return x.id===ymCur.id;});
        if(guncel){_formDirty=false;goYmForm(guncel);}
      }
      return;
    }
    var tk=res.teklif;
    toast(esc(tk.teklifNo)+(tk.yeni?' teklifi taslak olarak oluşturuldu':' teklifi güncellendi'),'success');
    try{var tr=await apiGet('teklifler?portal=ihracat');state.teklifler=tr.teklifler||[];}catch(e){}
    goTeklifForm(tk.id);
  });
}

// ════ EXCEL ════
function _ymXlsxIndir(wb,ad){
  var out=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([out],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download=ad;
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}
function ymSablonIndir(){
  if(!window.XLSX)return toast('Excel kütüphanesi yüklenemedi.','error');
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet([
    ['Category','Product Name','Brand','Model','Unit','Qty','Unit Cost','Source'],
    ['Microbiology','Vortex Mixer','IKA','Vortex 2','pcs',1,437.31,'https://www.example.com/product']
  ]);
  ws['!cols']=[{wch:16},{wch:40},{wch:14},{wch:14},{wch:8},{wch:8},{wch:12},{wch:40}];
  XLSX.utils.book_append_sheet(wb,ws,'Items');
  _ymXlsxIndir(wb,'approximate-cost-template.xlsx');
}

// Başlık karşılaştırması: küçük harf, Türkçe karakterler sadeleşir, * ve : silinir, boşluklar teke iner
function ymBaslikNorm(v){
  return String(v==null?'':v).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/i̇/g,'i').replace(/ş/g,'s').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/ç/g,'c').replace(/[*:]/g,'').replace(/\s+/g,' ').trim();
}
const YM_BASLIKLAR={
  aciklama:['urun adi','urun','adi','ad','urun ismi','malzeme','malzeme adi','description','desc','name','item name','item description','product','product name'],
  adet:['adet','miktar','qty','quantity'],
  birim:['birim','unit','units','uom','olcu birimi'],
  marka:['marka','brand'],
  model:['model'],
  kategori:['kategori','category','cat','grup','group'],
  alis:['birim fiyat','birim alis fiyati','birim alis','alis fiyati','alis','unit cost','unit price','price','cost','purchase price']
};
const YM_KAYNAK_BASLIK=['kaynak','source','web','link','not','notes','note'];
function _ymKaynakBaslikMi(n){return YM_KAYNAK_BASLIK.indexOf(n)>=0||/^(kaynak|source|web|link)/.test(n);}
// TR ve EN sayı biçimleri: hem , hem . varsa sondaki ondalıktır; yalnızca , varsa ondalıktır
function ymSayiCoz(v){
  if(typeof v==='number')return isFinite(v)?v:NaN;
  var s=String(v==null?'':v).replace(/\s/g,'');
  if(!s)return NaN;
  var nokta=s.lastIndexOf('.'),virgul=s.lastIndexOf(',');
  if(nokta>=0&&virgul>=0)s=virgul>nokta?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  else if(virgul>=0)s=s.replace(',','.');
  if(!/^-?\d*\.?\d+$/.test(s))return NaN;
  return parseFloat(s);
}
function ymBaslikBul(rows){
  for(var r=0;r<Math.min(rows.length,20);r++){
    var map={},kaynak=[];
    (rows[r]||[]).forEach(function(h,c){
      var n=ymBaslikNorm(h);if(!n)return;
      Object.keys(YM_BASLIKLAR).forEach(function(alan){if(map[alan]===undefined&&YM_BASLIKLAR[alan].indexOf(n)>=0)map[alan]=c;});
      if(_ymKaynakBaslikMi(n))kaynak.push(c);
    });
    if(map.aciklama!==undefined&&map.adet!==undefined)return{satir:r,map:map,kaynak:kaynak};
  }
  return null;
}
// Satırları okur: {kalemler, atlananlar:[{satir, sebep, urun}]}; satır numaraları Excel'deki gibi 1'den başlar
function ymSatirlariOku(rows,oranlar){
  var bas=ymBaslikBul(rows);
  if(!bas)return null;
  var o=oranlar||{};
  var tek=function(v){return String(v==null?'':v).replace(/[\r\n]+/g,' ').trim();};
  var kalemler=[],atlananlar=[];
  for(var r=bas.satir+1;r<rows.length;r++){
    var row=rows[r]||[];
    if(!row.some(function(v){return String(v==null?'':v).trim()!=='';}))continue;
    var h=function(alan){return bas.map[alan]===undefined?'':row[bas.map[alan]];};
    var ad=tek(h('aciklama'));
    var adetHam=String(h('adet')==null?'':h('adet')).trim();
    if(!ad&&!adetHam)continue;
    if(!ad){atlananlar.push({satir:r+1,sebep:'Ürün adı yok',urun:''});continue;}
    var adet=ymSayiCoz(h('adet'));
    if(!(adet>0)){atlananlar.push({satir:r+1,sebep:'Geçersiz adet',urun:ad});continue;}
    var alis=ymSayiCoz(h('alis'));
    var kaynak=bas.kaynak.map(function(c){return String(row[c]==null?'':row[c]).trim();}).filter(Boolean).join('\n');
    kalemler.push({id:ymUuid(),kategori:tek(h('kategori')),aciklama:ad,marka:tek(h('marka')),model:tek(h('model')),birim:tek(h('birim')),
      adet:String(adet),alis:isFinite(alis)?String(Math.round(alis*10000)/10000):'',
      navlun:o.frt||'',gumruk:o.cus||'',kar:o.mar||'',kaynak:kaynak});
  }
  return{kalemler:kalemler,atlananlar:atlananlar};
}

var _ymImportBekleyen=[];
function ymImportExcel(e){
  var file=e.target.files[0];e.target.value='';if(!file)return;
  if(!window.XLSX)return toast('Excel kütüphanesi yüklenemedi.','error');
  var reader=new FileReader();
  reader.onload=function(ev){
    var sonuc;
    try{
      var wb=XLSX.read(ev.target.result,{type:'array'});
      var rows=XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:'',raw:true});
      sonuc=ymSatirlariOku(rows,ymCur.oranlar);
    }catch(err){return toast('Dosya okunamadı: '+esc(err.message),'error');}
    if(!sonuc)return toast('"Ürün Adı" ve "Adet" sütunları bulunamadı. Beklenen başlıklar için "Şablon İndir"i kullanın.','error');
    _ymImportBekleyen=sonuc.kalemler;
    var pb=_ymPB();
    _ymEl('ym-import-body').innerHTML=
      '<div style="font-size:13px;margin-bottom:10px"><strong>'+sonuc.kalemler.length+' kalem okundu</strong> · '+sonuc.atlananlar.length+' satır atlandı</div>'
      +(sonuc.atlananlar.length?'<div class="ym-atlanan">'+sonuc.atlananlar.map(function(a){return'<div>Satır '+a.satir+': '+esc(a.sebep)+(a.urun?' — '+esc(a.urun):'')+'</div>';}).join('')+'</div>':'')
      +(sonuc.kalemler.length?'<div class="pd-table-wrap" style="max-height:340px;overflow:auto"><table class="pd-table"><thead><tr><th>#</th><th>Ürün Adı</th><th class="r">Adet</th><th>Birim</th><th class="r">Birim Alış Fiyatı</th></tr></thead><tbody>'
        +sonuc.kalemler.map(function(k,i){return'<tr><td>'+(i+1)+'</td><td>'+esc(k.aciklama)+'</td><td class="r">'+esc(k.adet)+'</td><td>'+esc(k.birim)+'</td><td class="r">'+(ymBos(k.alis)?'<span style="color:var(--text3)">—</span>':ymPara(ymNum(k.alis),pb))+'</td></tr>';}).join('')
        +'</tbody></table></div>':'');
    var b=_ymEl('ym-import-ekle');b.textContent=sonuc.kalemler.length+' kalemi ekle';b.disabled=!sonuc.kalemler.length;
    openModal('modal-ym-import');
  };
  reader.readAsArrayBuffer(file);
}
function ymImportOnayla(){
  var n=_ymImportBekleyen.length;if(!n)return;
  ymItems=ymItems.filter(function(it){return!_ymSatirBos(it);}).concat(_ymImportBekleyen);
  _ymImportBekleyen=[];
  _formDirty=true;
  closeModal('modal-ym-import');
  ymRenderTablo();
  toast(n+' kalem içe aktarıldı','success');
}

// Liste dışa aktarımı (filtrelenmiş/sıralanmış ya da seçili belgeler)
function ymListeExcel(seciliMi){
  if(!window.XLSX)return toast('Excel kütüphanesi yüklenemedi.','error');
  var liste=_ymSirali(_ymFiltreli());
  if(seciliMi){var s=new Set(bulkSelectedIds('ymList'));liste=liste.filter(function(m){return s.has(m.id);});}
  var r2=function(v){return Math.round(v*100)/100;};
  var aoa=[['Date','Number','Customer','Currency','Items','Total Cost','Offer Total','Sales Quotation','Status']].concat(liste.map(function(m){
    var t=ymToplamlar(m.kalemler);
    return[m.tarih||'',m.numara,ymMusteriAdi(m),m.paraBirimi,(m.kalemler||[]).length,r2(t.c),r2(t.o),m.teklif?m.teklif.teklifNo:'',(YM_DURUM[m.durum]||YM_DURUM.taslak).en];
  }));
  var ws=XLSX.utils.aoa_to_sheet(aoa);
  for(var i=1;i<aoa.length;i++){['F','G'].forEach(function(c){var cell=ws[c+(i+1)];if(cell)cell.z='#,##0.00';});}
  ws['!cols']=[{wch:12},{wch:12},{wch:36},{wch:9},{wch:7},{wch:14},{wch:14},{wch:16},{wch:14}];
  var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Approximate Costs');
  _ymXlsxIndir(wb,'approximate-costs-'+today()+'.xlsx');
}

// Belge dışa aktarımı — eski maliyet tablosu düzeni (grup başlıkları birleştirilmiş)
function ymBelgeExcel(){
  if(!window.XLSX)return toast('Excel kütüphanesi yüklenemedi.','error');
  var numara=_ymEl('ymf-numara').value.trim()||'YM';
  var pb=_ymPB();
  var r2=function(v){return Math.round(v*100)/100;};
  var oran=function(v){return ymBos(v)?'':ymNum(v);};
  var aoa=[
    ['Approximate Cost',numara,'','Date',_ymEl('ymf-tarih').value||'','','Customer',(ymCur.musteri&&(ymCur.musteri.firma||ymCur.musteri.kisi))||'','','Currency',pb],
    [],
    ['PRODUCT COST','','','','','','','','','FREIGHT','','','CUSTOMS','','','MARGIN & OFFER','','','SOURCE'],
    ['No','Category','Product Name','Brand','Model','Unit','Qty','Unit Cost','Total Cost','Freight %','Unit Price','Total','Customs %','Unit Price','Total','Margin %','Offer Unit Price','Offer Total','Source']
  ];
  var yazilan=ymItems.filter(function(it){return!_ymSatirBos(it);});
  yazilan.forEach(function(it,i){
    var x=ymSatirHesap(it);
    aoa.push([i+1,it.kategori||'',it.aciklama||'',it.marka||'',it.model||'',it.birim||'',x.q,r2(x.c),r2(x.tc),oran(it.navlun),r2(x.f),r2(x.tf),oran(it.gumruk),r2(x.g),r2(x.tg),oran(it.kar),r2(x.o),r2(x.to),it.kaynak||'']);
  });
  var t=ymToplamlar(yazilan);
  var toplamSatir=aoa.length;
  aoa.push(['','','TOTAL','','','','','',r2(t.c),'','',r2(t.f),'','',r2(t.g),'','',r2(t.o),'']);
  aoa.push([]);
  var ozetBas=aoa.length;
  aoa.push(['','','Freight cost',r2(t.f-t.c)],['','','Customs cost',r2(t.g-t.f)],['','','Profit',r2(t.o-t.g)],['','','Offer total',r2(t.o)]);
  var ws=XLSX.utils.aoa_to_sheet(aoa);
  ws['!merges']=[{s:{r:2,c:0},e:{r:2,c:8}},{s:{r:2,c:9},e:{r:2,c:11}},{s:{r:2,c:12},e:{r:2,c:14}},{s:{r:2,c:15},e:{r:2,c:17}}];
  ws['!cols']=[5,18,48,14,14,7,7,11,12,9,11,12,9,11,12,9,13,13,50].map(function(w){return{wch:w};});
  var paraKolon=['H','I','K','L','N','O','Q','R'];
  for(var r=4;r<=toplamSatir;r++){paraKolon.forEach(function(c){var cell=ws[c+(r+1)];if(cell&&typeof cell.v==='number')cell.z='#,##0.00';});}
  for(var s=ozetBas;s<ozetBas+4;s++){var cell=ws['D'+(s+1)];if(cell)cell.z='#,##0.00';}
  var wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,'Approximate Cost');
  _ymXlsxIndir(wb,'approximate-cost-'+numara.toLowerCase()+'-'+today()+'.xlsx');
}
