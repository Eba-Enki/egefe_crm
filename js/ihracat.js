// ════ YURTDIŞI SATIŞ PORTALI ════
// Yurtdışı projeler için teklif formu, Excel'den kalem aktarımı, para birimine göre
// banka hesabı seçimi ve İngilizce PDF çıktısı. Liste, detay, durum ve revizyon
// akışları teklif.js ile ortaktır (currentPortal==='ihracat' dallarıyla).

const IHR_BIRIMLER=['Pcs','Set','Box','Pack','Roll','Meter','Kg','Hour','Day','Lot'];
const IHR_INCOTERMS=[
  {k:'EXW',ad:'Ex Works'},
  {k:'FCA',ad:'Free Carrier'},
  {k:'FAS',ad:'Free Alongside Ship'},
  {k:'FOB',ad:'Free On Board'},
  {k:'CFR',ad:'Cost and Freight'},
  {k:'CIF',ad:'Cost, Insurance and Freight'},
  {k:'CPT',ad:'Carriage Paid To'},
  {k:'CIP',ad:'Carriage and Insurance Paid To'},
  {k:'DAP',ad:'Delivered At Place'},
  {k:'DPU',ad:'Delivered at Place Unloaded'},
  {k:'DDP',ad:'Delivered Duty Paid'}
];
const IHR_PB_ADLARI={USD:'US Dollars',EUR:'Euros',GBP:'British Pounds',TRY:'Turkish Lira'};

var ihrItems=[];
var _ihrBankaSnapshot=null;   // düzenlenen teklifte kayıtlı banka bilgisi (ayarlardan silinmiş olsa da korunur)
var _ihrBankaOtomatik=true;   // yeni teklifte ya da para birimi değişince ilk uygun hesap seçilir
var _ihrKisiListesi=[];

function _ihrEl(id){return document.getElementById(id);}
function _ihrBosKalem(){return{urunKodu:'',aciklama:'',kategori:'',marka:'',model:'',miktar:1,birim:'Pcs',birimFiyat:0,ymSatirId:null};}
function _ihrPB(){return(_ihrEl('itf-paraBirimi')||{}).value||'USD';}
function _ihrCurSym(pb){return{TRY:'₺',USD:'$',EUR:'€',GBP:'£'}[pb]||pb;}
function _ihrFmt(v){return fmtParaBirimi(v||0,_ihrPB());}
function _ihrFmtIban(s){return String(s||'').replace(/\s+/g,'').replace(/(.{4})/g,'$1 ').trim();}
function _ihrGunEkle(tarih,gun){var d=new Date(tarih+'T12:00:00');d.setDate(d.getDate()+gun);return d.toISOString().slice(0,10);}
function _ihrKalemDolu(s){return !!((s.urunKodu||'').trim()||(s.aciklama||'').trim()||(s.birimFiyat||0)>0);}

// ════ FORM ════
function goIhrTeklifForm(editId){
  var t=editId?state.teklifler.find(function(x){return x.id===editId;}):null;
  if(editId&&!t)return;
  _ihrEl('itf-edit-id').value=editId||'';
  _ihrEl('itf-title').textContent=t?'Yurtdışı Teklifini Düzenle':'Yeni Yurtdışı Teklifi';
  _ihrEl('itf-teklifNo').value=t?t.teklifNo:nextTN();
  _ihrEl('itf-teklifTarihi').value=t?(t.teklifTarihi||''):today();
  _ihrEl('itf-gecerlilik').value=t?(t.gecerlilikTarihi||''):_ihrGunEkle(today(),30);
  _ihrEl('itf-paraBirimi').value=t?(t.paraBirimi||'USD'):'USD';
  var alanlar={'itf-ilgiliKisi':'ilgiliKisi','itf-telefon':'telefon','itf-email':'email','itf-teslimYeri':'teslimYeri','itf-teslimat':'teslimat','itf-odemeKosulu':'odemeKosulu','itf-notlar':'notlar'};
  Object.keys(alanlar).forEach(function(id){_ihrEl(id).value=t?(t[alanlar[id]]||''):'';});
  _ihrFillIncoterms(t?t.incoterm:'');
  _ihrEl('itf-imza-gizle').checked=false;
  _ihrEl('itf-kurum').value=t?(t.kurum||''):'';
  if(t){
    var m=state.musteriler.find(function(x){return(t.musteriId&&x.id===t.musteriId)||x.kurum===(t.kurum||'');});
    if(m){lockMusteriField('itf-kurum',m.id);ihrMusteriSecildi(m,true);}
    else{unlockMusteriField('itf-kurum');if(t.kurum)_ihrEl('itf-musteri-id').value='__edit_existing__';_ihrRefreshKisiPicker(null);}
  } else {
    unlockMusteriField('itf-kurum');
    ihrMusteriSecildi(null);
  }
  ihrItems=(t&&t.satirlar&&t.satirlar.length)
    ?t.satirlar.map(function(s){return Object.assign(_ihrBosKalem(),{urunKodu:s.urunKodu||'',aciklama:s.aciklama||'',kategori:s.kategori||'',marka:s.marka||'',model:s.model||'',miktar:s.miktar,birim:s.birim||'Pcs',birimFiyat:s.birimFiyat||0,ymSatirId:s.ymSatirId||null});})
    :[_ihrBosKalem()];
  _ihrBankaSnapshot=t?(t.bankaHesabi||null):null;
  _ihrBankaOtomatik=!t;
  // Yaklaşık maliyetten aktarılan teklifte bağlantı bandı (belge hâlâ varsa)
  var band=_ihrEl('itf-ym-band');
  if(t&&t.yaklasikMaliyet){
    band.textContent=t.yaklasikMaliyet.numara+' yaklaşık maliyetinden aktarıldı.'+(t.durum==='Taslak'?' Tekrar aktarılırsa bu taslağın kalemleri yenilenir.':'');
    band.style.display='';
  } else band.style.display='none';
  ihrOnParaBirimiChange();
  showPage('ihr-teklif-form',true);
}

function _ihrFillIncoterms(secili){
  var sel=_ihrEl('itf-incoterm');if(!sel)return;
  sel.innerHTML='<option value="">— Seçin —</option>'+IHR_INCOTERMS.map(function(i){return'<option value="'+i.k+'">'+i.k+' — '+i.ad+'</option>';}).join('');
  sel.value=secili||'';
}

// Müşteri seçildiğinde ilgili kişi alanlarını doldurur; keep=true ise mevcut değerler korunur (düzenleme)
function ihrMusteriSecildi(m,keep){
  var ki=_ihrEl('itf-ilgiliKisi'),tel=_ihrEl('itf-telefon'),eml=_ihrEl('itf-email');
  if(!keep){
    ki.value=m?(m.kisi||''):'';
    tel.value=m?(m.tel||''):'';
    eml.value=m?(m.email||''):'';
  }
  _ihrRefreshKisiPicker(m);
}
function _ihrRefreshKisiPicker(m){
  var wrap=_ihrEl('itf-ilgili-kisi-sec-wrap'),sel=_ihrEl('itf-ilgili-kisi-sec');
  var liste=(m&&m.iletisimKisileri)||[];
  _ihrKisiListesi=liste;
  if(!liste.length){wrap.style.display='none';sel.innerHTML='';return;}
  var cur=_ihrEl('itf-ilgiliKisi').value||'';
  var idx=liste.findIndex(function(k){return k.ad===cur;});
  sel.innerHTML=(idx<0?'<option value="">— Seçin —</option>':'')+liste.map(function(k,i){return'<option value="'+i+'">'+esc(k.ad)+(k.departman?' — '+esc(k.departman):'')+'</option>';}).join('');
  sel.value=idx<0?'':String(idx);
  wrap.style.display='';
}
function ihrOnIlgiliKisiSecim(){
  var k=_ihrKisiListesi[parseInt(_ihrEl('itf-ilgili-kisi-sec').value)];
  if(!k)return;
  _ihrEl('itf-ilgiliKisi').value=k.ad||'';
  _ihrEl('itf-telefon').value=k.tel||'';
  _ihrEl('itf-email').value=k.email||'';
}

function ihrOnParaBirimiChange(kullanici){
  if(kullanici)_ihrBankaOtomatik=true;
  var sym=_ihrEl('itf-cur-sym');if(sym)sym.textContent=_ihrCurSym(_ihrPB());
  ihrRenderKalemler();
  ihrRenderBankaSecimi();
}

// ════ KALEMLER ════
function ihrRenderKalemler(){
  var body=_ihrEl('itf-body');if(!body)return;
  body.innerHTML=ihrItems.map(function(it,i){
    var birimler=IHR_BIRIMLER.indexOf(it.birim)<0&&it.birim?IHR_BIRIMLER.concat([it.birim]):IHR_BIRIMLER;
    return '<tr>'
      +'<td class="ihr-no">'+(i+1)+'</td>'
      +'<td class="ihr-kod"><input type="text" value="'+esc(it.urunKodu||'')+'" oninput="ihrItems['+i+'].urunKodu=this.value"></td>'
      +'<td class="ihr-aciklama"><textarea rows="'+Math.min(4,Math.max(1,Math.ceil((it.aciklama||'').length/30)))+'" placeholder="Item description (English)" oninput="ihrItems['+i+'].aciklama=this.value">'+esc(it.aciklama||'')+'</textarea></td>'
      +'<td class="ihr-kategori"><input type="text" value="'+esc(it.kategori||'')+'" oninput="ihrItems['+i+'].kategori=this.value"></td>'
      +'<td class="ihr-marka"><input type="text" value="'+esc(it.marka||'')+'" oninput="ihrItems['+i+'].marka=this.value"></td>'
      +'<td class="ihr-model"><input type="text" value="'+esc(it.model||'')+'" oninput="ihrItems['+i+'].model=this.value"></td>'
      +'<td class="ihr-miktar"><input type="number" min="0" step="any" value="'+(it.miktar||0)+'" oninput="ihrItems['+i+'].miktar=parseFloat(this.value)||0;ihrUpdateToplam()"></td>'
      +'<td class="ihr-birim"><select onchange="ihrItems['+i+'].birim=this.value">'+birimler.map(function(b){return'<option'+(b===it.birim?' selected':'')+'>'+esc(b)+'</option>';}).join('')+'</select></td>'
      +'<td class="ihr-fiyat"><input type="number" min="0" step="0.01" value="'+(it.birimFiyat||0)+'" oninput="ihrItems['+i+'].birimFiyat=parseFloat(this.value)||0;ihrUpdateToplam()"></td>'
      +'<td class="ihr-total" id="itf-total-'+i+'"></td>'
      +'<td class="ti-del"><button class="btn-icon" style="color:var(--red)" title="Kalemi sil" onclick="ihrRemoveKalem('+i+')"><i class="ti ti-trash"></i></button></td>'
    +'</tr>';
  }).join('');
  ihrUpdateToplam();
}
function ihrUpdateToplam(){
  var toplam=0;
  ihrItems.forEach(function(it,i){
    var a=(it.miktar||0)*(it.birimFiyat||0);
    toplam+=a;
    var el=_ihrEl('itf-total-'+i);if(el)el.textContent=_ihrFmt(a);
  });
  _ihrEl('itf-toplam').textContent=_ihrFmt(toplam);
  var dolu=ihrItems.filter(_ihrKalemDolu).length;
  _ihrEl('itf-kalem-sayisi').textContent=dolu?'('+dolu+' kalem)':'';
}
function ihrAddKalem(){ihrItems.push(_ihrBosKalem());ihrRenderKalemler();}
function ihrRemoveKalem(i){
  if(ihrItems.length>1)ihrItems.splice(i,1);else ihrItems=[_ihrBosKalem()];
  _formDirty=true;ihrRenderKalemler();
}
function ihrClearKalemler(){
  if(!ihrItems.some(_ihrKalemDolu))return;
  showConfirm('Tüm teklif kalemleri silinsin mi?',function(){
    ihrItems=[_ihrBosKalem()];_formDirty=true;ihrRenderKalemler();
  },{title:'Kalemleri Temizle',okText:'Temizle',okClass:'btn-danger'});
}

// ════ BANKA HESABI SEÇİMİ ════
function _ihrBankaHesaplari(){return(state.settings&&state.settings.bankaHesaplari)||[];}
function ihrRenderBankaSecimi(){
  var sel=_ihrEl('itf-banka');if(!sel)return;
  var pb=_ihrPB();
  var liste=_ihrBankaHesaplari().filter(function(b){return b.paraBirimi===pb&&b.iban;});
  var snap=(_ihrBankaSnapshot&&_ihrBankaSnapshot.paraBirimi===pb)?_ihrBankaSnapshot:null;
  var snapEslesen=snap?liste.find(function(b){return b.iban===snap.iban;}):null;
  var html='<option value="">— PDF\'e banka bilgisi eklenmesin —</option>'
    +liste.map(function(b){return'<option value="'+esc(b.id)+'">'+esc(b.bankaAdi||'Banka')+' — '+esc(_ihrFmtIban(b.iban))+'</option>';}).join('');
  if(snap&&!snapEslesen)html+='<option value="__snapshot__">'+esc(snap.bankaAdi||'Banka')+' — '+esc(_ihrFmtIban(snap.iban))+' (teklifte kayıtlı)</option>';
  sel.innerHTML=html;
  if(snap)sel.value=snapEslesen?snapEslesen.id:'__snapshot__';
  else sel.value=(_ihrBankaOtomatik&&liste.length)?liste[0].id:'';
  _ihrEl('itf-banka-pb').textContent='('+pb+' hesapları)';
  var uyari=_ihrEl('itf-banka-uyari');
  if(!liste.length&&!snap){
    uyari.textContent='Ayarlar › Banka Hesapları bölümünde '+pb+' para biriminde tanımlı hesap yok.';
    uyari.style.display='';
  } else uyari.style.display='none';
  ihrRenderBankaOnizleme();
}
function _ihrSeciliBanka(){
  var v=(_ihrEl('itf-banka')||{}).value||'';
  if(!v)return null;
  if(v==='__snapshot__')return _ihrBankaSnapshot;
  return _ihrBankaHesaplari().find(function(b){return b.id===v;})||null;
}
function ihrRenderBankaOnizleme(){
  var box=_ihrEl('itf-banka-onizleme');if(!box)return;
  var b=_ihrSeciliBanka();
  if(!b){box.style.display='none';box.innerHTML='';return;}
  var hucre=function(l,v,mono){return v?'<div><div class="lbl">'+l+'</div><div class="val'+(mono?' mono':'')+'">'+esc(v)+'</div></div>':'';};
  box.innerHTML=hucre('Hesap Sahibi',b.hesapSahibi)+hucre('Banka',b.bankaAdi)+hucre('Şube',b.sube)+hucre('IBAN',_ihrFmtIban(b.iban),true)+hucre('SWIFT / BIC',b.swift,true)+hucre('Para Birimi',b.paraBirimi);
  box.style.display='';
}

// ════ KAYDET ════
async function ihrSaveTeklif(andPrint){
  var editId=_ihrEl('itf-edit-id').value;
  var kurum=(_ihrEl('itf-kurum').value||'').trim();
  var musteriIdRaw=_ihrEl('itf-musteri-id').value||'';
  if(!kurum)return toast('Firma / müşteri zorunludur.','error');
  if(!musteriIdRaw&&!editId)return toast('Lütfen müşteri listesinden seçin veya "+ Yeni Müşteri Ekle" ile ekleyin.','error');
  var satirlar=ihrItems.filter(_ihrKalemDolu).map(function(s){
    return{urunKodu:(s.urunKodu||'').trim(),aciklama:(s.aciklama||'').trim(),kategori:(s.kategori||'').trim(),marka:(s.marka||'').trim(),model:(s.model||'').trim(),miktar:s.miktar||0,birim:s.birim||'Pcs',birimFiyat:s.birimFiyat||0,ymSatirId:s.ymSatirId||null};
  });
  if(!satirlar.length)return toast('En az bir teklif kalemi girin.','error');
  var payload={
    teklifNo:_ihrEl('itf-teklifNo').value,
    musteriId:musteriIdRaw==='__edit_existing__'?'':musteriIdRaw,
    kurum:kurum,
    ilgiliKisi:_ihrEl('itf-ilgiliKisi').value.trim(),
    telefon:_ihrEl('itf-telefon').value.trim(),
    email:_ihrEl('itf-email').value.trim(),
    teklifTarihi:_ihrEl('itf-teklifTarihi').value,
    gecerlilikTarihi:_ihrEl('itf-gecerlilik').value,
    paraBirimi:_ihrPB(),
    incoterm:_ihrEl('itf-incoterm').value,
    teslimYeri:_ihrEl('itf-teslimYeri').value.trim(),
    teslimat:_ihrEl('itf-teslimat').value.trim(),
    odemeKosulu:_ihrEl('itf-odemeKosulu').value.trim(),
    bankaHesabi:_ihrSeciliBanka(),
    notlar:_ihrEl('itf-notlar').value,
    kdvOran:0,
    satirlar:satirlar
  };
  var savedId;
  try{
    if(editId){
      var idx=state.teklifler.findIndex(function(x){return x.id===editId;});
      if(idx<0)return;
      var res=await apiPut('teklifler',Object.assign({},state.teklifler[idx],payload,{id:editId}));
      state.teklifler[idx]=res.teklif;
      savedId=editId;
      toast('Teklif güncellendi.','success');
    } else {
      var res2=await apiPost('teklifler',Object.assign({},payload,{portal:'ihracat'}));
      state.teklifler.push(res2.teklif);
      savedId=res2.teklif.id;
      toast('Teklif oluşturuldu.','success');
    }
  }catch(e){
    return toast(e.message||'Teklif kaydedilemedi.','error');
  }
  _formDirty=false;showPage('teklifler');
  if(andPrint&&savedId)setTimeout(function(){printTeklifById(savedId);},300);
}

// Teklif detay modalındaki kalem satırları (kod / marka / model ile)
function ihrDetaySatirlarHtml(t){
  return(t.satirlar||[]).map(function(s){
    var a=(s.miktar||0)*(s.birimFiyat||0);
    var alt=[s.kategori,s.marka,s.model].filter(Boolean).join(' · ');
    return'<tr><td>'+(s.urunKodu?'<span style="font-family:var(--font-mono);font-size:11px;color:var(--text3);margin-right:6px">'+esc(s.urunKodu)+'</span>':'')+esc(s.aciklama||'—')
      +(alt?'<div class="pd-sub-text">'+esc(alt)+'</div>':'')+'</td>'
      +'<td class="r" style="color:var(--text2)">'+s.miktar+' '+esc(s.birim)+'</td>'
      +'<td class="r">'+fmtParaBirimi(s.birimFiyat,t.paraBirimi)+'</td>'
      +'<td class="r">'+fmtParaBirimi(a,t.paraBirimi)+'</td></tr>';
  }).join('');
}

// ════ EXCEL — KALEM ŞABLONU / İÇE AKTARMA ════
const IHR_KOLONLAR={
  urunKodu:['kod','ürün kodu','urun kodu','stok kodu','code','item code','product code','part no','part number','ref','reference'],
  aciklama:['açıklama','aciklama','ürün adı','urun adi','ürün','urun','description','item description','item','product','product name'],
  kategori:['kategori','category','grup','group'],
  marka:['marka','brand','manufacturer','make'],
  model:['model','model no','model number'],
  miktar:['adet','miktar','qty','quantity','q ty'],
  birim:['birim','unit','uom'],
  birimFiyat:['birim fiyatı','birim fiyati','birim fiyat','fiyat','unit price','price','unit cost'],
  toplam:['toplam','tutar','toplam fiyat','total','amount','total price','line total']
};
const IHR_BIRIM_ESLESME={
  'adet':'Pcs','ad':'Pcs','pcs':'Pcs','pc':'Pcs','piece':'Pcs','pieces':'Pcs','ea':'Pcs','each':'Pcs','unit':'Pcs','units':'Pcs','parça':'Pcs','parca':'Pcs',
  'set':'Set','takım':'Set','takim':'Set','kit':'Set',
  'kutu':'Box','box':'Box','boxes':'Box',
  'paket':'Pack','pack':'Pack','pkg':'Pack','package':'Pack',
  'rulo':'Roll','roll':'Roll','rolls':'Roll',
  'metre':'Meter','m':'Meter','mt':'Meter','meter':'Meter','metre(m)':'Meter','meters':'Meter',
  'kg':'Kg','kilo':'Kg','kilogram':'Kg',
  'saat':'Hour','hour':'Hour','hours':'Hour','hr':'Hour','h':'Hour',
  'gün':'Day','gun':'Day','day':'Day','days':'Day',
  'lot':'Lot','lots':'Lot'
};

function ihrDownloadKalemSablon(){
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var wb=XLSX.utils.book_new();
  var ws=XLSX.utils.aoa_to_sheet([['Kod','Açıklama*','Marka','Model','Adet*','Birim','Birim Fiyatı*','Toplam']]);
  ws['!cols']=[{wch:16},{wch:48},{wch:16},{wch:16},{wch:8},{wch:8},{wch:14},{wch:14}];
  XLSX.utils.book_append_sheet(wb,ws,'Kalemler');
  var info=XLSX.utils.aoa_to_sheet([
    ['Yurtdışı Teklif Kalem Şablonu'],
    [''],
    ['• Açıklama, PDF\'e aynen aktarılır; İngilizce yazın.'],
    ['• Birim Fiyatı boşsa Toplam / Adet ile hesaplanır. Toplam sütunu bilgi amaçlıdır.'],
    ['• Adet boşsa 1 kabul edilir.'],
    ['• Geçerli birimler: '+IHR_BIRIMLER.join(', ')+' (Adet, Kutu, Paket, Metre, Saat, Gün gibi Türkçe karşılıklar da tanınır).']
  ]);
  info['!cols']=[{wch:100}];
  XLSX.utils.book_append_sheet(wb,info,'Açıklamalar');
  var wbout=XLSX.write(wb,{bookType:'xlsx',type:'array'});
  var blob=new Blob([wbout],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');a.href=url;a.download='yurtdisi-teklif-kalem-sablon.xlsx';
  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
}

// Türkçe ve İngilizce başlıklar aynı biçime indirgenir (DESCRIPTION → description, AÇIKLAMA → açiklama)
function _ihrNorm(v){
  return String(v==null?'':v).toLocaleLowerCase('tr-TR').replace(/ı/g,'i').replace(/\(.*?\)/g,'').replace(/[*:.#]/g,' ').replace(/[-_/]/g,' ').replace(/\s+/g,' ').trim();
}
var _IHR_KOLON_NORM={};
Object.keys(IHR_KOLONLAR).forEach(function(alan){_IHR_KOLON_NORM[alan]=IHR_KOLONLAR[alan].map(_ihrNorm);});
var _IHR_BIRIM_NORM={};
Object.keys(IHR_BIRIM_ESLESME).forEach(function(k){_IHR_BIRIM_NORM[_ihrNorm(k)]=IHR_BIRIM_ESLESME[k];});
IHR_BIRIMLER.forEach(function(b){_IHR_BIRIM_NORM[_ihrNorm(b)]=b;});
// Excel'den gelen sayı: hücre sayıysa olduğu gibi; metinse 1.234,56 / 1,234.56 / $ 12.50 biçimleri çözülür
function _ihrSayi(v){
  if(typeof v==='number')return isFinite(v)?v:0;
  var s=String(v==null?'':v).replace(/[^\d.,\-]/g,'');
  if(!s)return 0;
  var sonNokta=s.lastIndexOf('.'),sonVirgul=s.lastIndexOf(',');
  if(sonNokta>=0&&sonVirgul>=0){
    s=sonVirgul>sonNokta?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
  } else if(sonVirgul>=0){
    s=(s.split(',').length>2)?s.replace(/,/g,''):s.replace(',','.');
  } else if(s.split('.').length>2){
    s=s.replace(/\./g,'');
  }
  var n=parseFloat(s);
  return isFinite(n)?n:0;
}
function _ihrBirim(v){
  var k=_ihrNorm(v);
  if(!k)return'Pcs';
  return _IHR_BIRIM_NORM[k]||'Pcs';
}
function _ihrBaslikSatiriBul(rows){
  for(var r=0;r<Math.min(rows.length,20);r++){
    var map={},eslesen=0;
    (rows[r]||[]).forEach(function(h,c){
      var n=_ihrNorm(h);if(!n)return;
      Object.keys(_IHR_KOLON_NORM).forEach(function(alan){
        if(map[alan]===undefined&&_IHR_KOLON_NORM[alan].indexOf(n)>=0){map[alan]=c;eslesen++;}
      });
    });
    if(map.aciklama!==undefined&&eslesen>=2)return{satir:r,map:map};
  }
  return null;
}

function ihrImportKalemExcel(e){
  var file=e.target.files[0];e.target.value='';if(!file)return;
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var reader=new FileReader();
  reader.onload=function(ev){
    var yeni=[],farkli=0;
    try{
      var wb=XLSX.read(ev.target.result,{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:true});
      var bas=_ihrBaslikSatiriBul(rows);
      if(!bas)return toast('Başlık satırı bulunamadı. "Açıklama" ve "Adet" / "Birim Fiyatı" sütunları olmalı; şablonu kullanabilirsiniz.','error');
      var m=bas.map;
      var hucre=function(row,alan){return m[alan]===undefined?'':row[m[alan]];};
      var metin=function(row,alan){return String(hucre(row,alan)==null?'':hucre(row,alan)).trim();};
      for(var r=bas.satir+1;r<rows.length;r++){
        var row=rows[r]||[];
        var kod=metin(row,'urunKodu'),aciklama=metin(row,'aciklama');
        if(!kod&&!aciklama)continue;
        var miktarHam=hucre(row,'miktar'),fiyatHam=hucre(row,'birimFiyat'),toplamHam=hucre(row,'toplam');
        // Alt toplam / genel toplam satırları atlanır
        if(!kod&&/^(genel\s*)?(ara\s*)?toplam|^(sub\s*|grand\s*)?total/i.test(aciklama)&&String(miktarHam).trim()===''&&String(fiyatHam).trim()==='')continue;
        var miktar=String(miktarHam).trim()===''?1:_ihrSayi(miktarHam);
        var fiyat=_ihrSayi(fiyatHam);
        var toplam=_ihrSayi(toplamHam);
        if(!fiyat&&toplam&&miktar)fiyat=toplam/miktar;
        fiyat=Math.round(fiyat*100)/100;
        if(toplam&&Math.abs(miktar*fiyat-toplam)>0.01)farkli++;
        yeni.push(Object.assign(_ihrBosKalem(),{urunKodu:kod,aciklama:aciklama,kategori:metin(row,'kategori'),marka:metin(row,'marka'),model:metin(row,'model'),miktar:miktar,birim:_ihrBirim(hucre(row,'birim')),birimFiyat:fiyat}));
      }
    }catch(err){return toast('Dosya okunamadı: '+err.message,'error');}
    if(!yeni.length)return toast('Dosyada aktarılacak kalem bulunamadı.','info');
    var bitir=function(ekle){
      ihrItems=ekle?ihrItems.filter(_ihrKalemDolu).concat(yeni):yeni;
      _formDirty=true;
      ihrRenderKalemler();
      toast(yeni.length+' kalem içe aktarıldı.'+(farkli?' '+farkli+' satırda Excel\'deki toplam Adet × Birim Fiyatı ile tutmuyor; kontrol edin.':''),farkli?'info':'success');
    };
    var mevcut=ihrItems.filter(_ihrKalemDolu).length;
    if(!mevcut)return bitir(false);
    showConfirm('Formda '+mevcut+' kalem var. Excel\'deki '+yeni.length+' kalem mevcutların yerine mi geçsin, sonuna mı eklensin?',function(){bitir(false);},{title:'Excel\'den İçe Aktar',okText:'Yerine Koy',okClass:'btn-primary',cancelText:'Sona Ekle'});
    var cancelBtn=_ihrEl('confirm-cancel-btn');
    if(cancelBtn)cancelBtn.onclick=function(){closeModal('modal-confirm');bitir(true);};
  };
  reader.readAsArrayBuffer(file);
}

// ════ AYARLAR — BANKA HESAPLARI ════
function ihrRenderBankaHesaplari(){
  if(!state.settings.bankaHesaplari)state.settings.bankaHesaplari=[];
  var liste=state.settings.bankaHesaplari;
  var box=_ihrEl('ihr-banka-list');if(!box)return;
  // PDF İngilizce olduğundan banka/şube adları İngilizce de yazılabilir; değerler PDF'e aynen aktarılır
  var alan=function(i,k,etiket,ph,cls,mono){
    return'<div class="field'+(cls?' '+cls:'')+'"><label>'+etiket+'</label><input type="text" value="'+esc(liste[i][k]||'')+'" placeholder="'+ph+'"'+(mono?' style="font-family:var(--font-mono)"':'')+' oninput="state.settings.bankaHesaplari['+i+'].'+k+'=this.value"></div>';
  };
  box.innerHTML=liste.map(function(b,i){
    return'<div class="ihr-banka-kart">'
      +'<div class="field"><label>Para Birimi</label><select onchange="state.settings.bankaHesaplari['+i+'].paraBirimi=this.value">'+['USD','EUR','GBP','TRY'].map(function(pb){return'<option'+(pb===b.paraBirimi?' selected':'')+'>'+pb+'</option>';}).join('')+'</select></div>'
      +alan(i,'bankaAdi','Banka Adı','Türkiye İş Bankası')
      +alan(i,'sube','Şube','Kızılay / Ankara')
      +alan(i,'hesapSahibi','Hesap Sahibi (Beneficiary)','Şirket unvanı','field-iban')
      +alan(i,'swift','SWIFT / BIC','ISBKTRIS','',true)
      +alan(i,'iban','IBAN','TR00 0000 0000 0000 0000 0000 00','field-iban',true)
      +'<button class="btn-icon ihr-banka-sil" style="color:var(--red)" title="Hesabı sil" onclick="ihrRemoveBankaHesabi('+i+')"><i class="ti ti-trash"></i></button>'
    +'</div>';
  }).join('');
  var bos=_ihrEl('ihr-banka-empty');if(bos)bos.style.display=liste.length?'none':'';
}
function ihrAddBankaHesabi(){
  if(!state.settings.bankaHesaplari)state.settings.bankaHesaplari=[];
  state.settings.bankaHesaplari.push({id:'b'+Date.now(),paraBirimi:'USD',bankaAdi:'',sube:'',hesapSahibi:state.settings.firma||'',iban:'',swift:''});
  ihrRenderBankaHesaplari();
}
function ihrRemoveBankaHesabi(i){
  state.settings.bankaHesaplari.splice(i,1);
  ihrRenderBankaHesaplari();
  toast('Hesap listeden kaldırıldı. Kalıcı olması için "Değişiklikleri Kaydet"e basın.','info');
}

// ════ PDF (İngilizce) ════
function printIhracatTeklif(t){
  var imzaGizle=!!(_ihrEl('itf-imza-gizle')||{}).checked;
  var logoImg=new Image();
  logoImg.onload=function(){
    var cv=document.createElement('canvas');cv.width=534;cv.height=252;
    cv.getContext('2d').drawImage(logoImg,0,0,534,252);
    _ihrGeneratePDF(t,cv.toDataURL('image/png'),imzaGizle);
  };
  logoImg.onerror=function(){_ihrGeneratePDF(t,null,imzaGizle);};
  logoImg.src='brand_assets/logo_if_bg_white.svg';
}

async function _ihrGeneratePDF(t,logoPngDataUrl,imzaGizle){
  var toB64=function(buf){var bytes=new Uint8Array(buf);var s='';for(var i=0;i<bytes.byteLength;i++)s+=String.fromCharCode(bytes[i]);return btoa(s);};
  var fontlar;
  try{
    fontlar=await Promise.all([fetch('fonts/Arial.ttf').then(function(r){return r.arrayBuffer();}),fetch('fonts/Arial_Bold.ttf').then(function(r){return r.arrayBuffer();})]);
  }catch(e){return toast('PDF fontları yüklenemedi.','error');}

  var fmtN=function(v){return new Intl.NumberFormat('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}).format(v||0);};
  var fmtQty=function(v){return new Intl.NumberFormat('en-US',{maximumFractionDigits:3}).format(v||0);};
  var fmtD=function(d){if(!d)return'-';var x=new Date(d+'T12:00:00');return isNaN(x)?d:x.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'});};
  // Türkiye numaraları uluslararası biçime: +90 (312) 482 54 51; diğerleri olduğu gibi
  var fmtPhone=function(v){
    var d=String(v||'').replace(/\D/g,'');
    if(d.startsWith('90')&&d.length===12)d=d.slice(2);
    else if(d.startsWith('0')&&d.length===11)d=d.slice(1);
    if(d.length!==10)return String(v||'').trim();
    return'+90 ('+d.slice(0,3)+') '+d.slice(3,6)+' '+d.slice(6,8)+' '+d.slice(8);
  };

  var C={primary:[29,125,149],textDark:[26,46,59],textMid:[46,64,80],textLight:[143,164,176],textLabel:[74,96,112],border:[194,208,216],tableBg:[228,245,249],boxBg:[247,249,250],white:[255,255,255]};
  var mm=function(v){return v*2.83465;};
  var st=state.settings||{};
  var pb=t.paraBirimi||'USD';
  var contentBottom=mm(272);   // alt bilgi çizgisinin üstünde kalan son kullanılabilir y

  var satirlar=(t.satirlar||[]).map(function(s,i){
    return{no:i+1,kod:s.urunKodu||'',aciklama:s.aciklama||'-',kategori:s.kategori||'',marka:s.marka||'',model:s.model||'',miktar:s.miktar||0,birim:s.birim||'Pcs',fiyat:s.birimFiyat||0,tutar:(s.miktar||0)*(s.birimFiyat||0)};
  });
  var genelToplam=satirlar.reduce(function(a,s){return a+s.tutar;},0);

  var jsPDF=window.jspdf.jsPDF;
  var doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
  doc.addFileToVFS('Arial.ttf',toB64(fontlar[0]));doc.addFont('Arial.ttf','Arial','normal');
  doc.addFileToVFS('Arial_Bold.ttf',toB64(fontlar[1]));doc.addFont('Arial_Bold.ttf','Arial','bold');
  doc.setFont('Arial');doc.setCharSpace(0);

  // ── HEADER ──
  if(logoPngDataUrl){try{doc.addImage(logoPngDataUrl,'PNG',mm(19.812),mm(9.737),mm(39.793),mm(19.389),'','FAST');}catch(e){}}
  doc.setDrawColor.apply(doc,C.border);doc.setLineWidth(0.75);
  doc.line(mm(63.765),mm(11.642),mm(63.765),mm(25.517));
  doc.setFontSize(9);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.textMid);
  doc.text(st.firma||'Egefe Bilişim Sağlık San. ve Tic. A.Ş.',mm(68.457),mm(11.188)+9);
  doc.setFontSize(8);doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textLight);
  doc.text(doc.splitTextToSize(st.adres||'Harbiye Mah. Hürriyet Cad. No:7/12 Çankaya, Ankara, Türkiye',mm(124))[0],mm(68.457),mm(16.829)+6);
  var vergiText=(st.vergiDairesi&&st.vergiNo)?('Tax Office: '+st.vergiDairesi+'  ·  Tax ID: '+st.vergiNo):'Tax Office: Başkent  ·  Tax ID: 5590520620';
  doc.text(vergiText,mm(68.457),mm(21.192)+6);
  doc.text(st.web||'www.ege-fe.com',mm(68.457),mm(25.555)+6);
  doc.setDrawColor.apply(doc,C.primary);doc.setLineWidth(2);
  doc.line(mm(15.446),mm(33.955),mm(194.556),mm(33.955));

  // ── SAĞ BLOK: QUOTATION ──
  var rEdge=mm(194.556),colonX=rEdge-mm(24),labelRX=colonX-mm(2);
  doc.setFontSize(14);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.textMid);
  doc.text('QUOTATION',rEdge,mm(42.395)+11,{align:'right'});
  doc.setFontSize(8);
  [['Quotation No',t.teklifNo||'-'],['Date',fmtD(t.teklifTarihi)],['Valid Until',fmtD(t.gecerlilikTarihi)],['Currency',pb]].forEach(function(r,i){
    var y=mm(50.611+i*4.49)+6;
    doc.setFont('Arial','bold');doc.text(r[0],labelRX,y,{align:'right'});doc.text(':',colonX,y);
    doc.setFont('Arial','normal');doc.text(String(r[1]),rEdge,y,{align:'right'});
  });

  // ── MÜŞTERİ BLOĞU ──
  var lx1=mm(15.446),lx2=mm(36.5),lx3=mm(39.4),lMaxW=mm(76),rGap=mm(4.291),lh8=8*1.15;
  var curY=mm(42.774)+6;
  var mRec=(state.musteriler||[]).find(function(m){return(t.musteriId&&m.id===t.musteriId)||m.kurum===t.kurum;});
  var adresVal=[(mRec&&mRec.adres)||'',(mRec&&mRec.sehir)||'',(mRec&&mRec.ulke)||''].filter(Boolean).join(', ');
  [['Customer',t.kurum||'',true],['Address',adresVal,true],['Attn.',t.ilgiliKisi||''],['E-mail',t.email||''],['Phone',t.telefon||'']].forEach(function(r){
    doc.setFontSize(8);doc.setTextColor.apply(doc,C.textMid);
    doc.setFont('Arial','bold');doc.text(r[0],lx1,curY);doc.text(':',lx2,curY);
    doc.setFont('Arial','normal');
    var lines=r[2]?doc.splitTextToSize(String(r[1]),lMaxW):[String(r[1])];
    doc.text(lines,lx3,curY);
    curY+=(lines.length-1)*lh8+rGap;
  });
  doc.setDrawColor.apply(doc,C.tableBg);doc.setLineWidth(0.75);
  var divY=Math.max(mm(70.5),curY+mm(1));
  doc.line(mm(15.446),divY,mm(194.63),divY);

  // ── KALEM TABLOSU ──
  // Kod / Kategori / Marka / Model sütunlarından tamamen boş olanlar çıkarılır, genişlikleri açıklamaya eklenir
  var kolonlar=[
    {k:'no',head:'#',w:6,al:'center'},
    {k:'kod',head:'CODE',w:18,al:'left',opt:true},
    {k:'aciklama',head:'DESCRIPTION',w:44.184,al:'left'},
    {k:'kategori',head:'CATEGORY',w:16,al:'left',opt:true},
    {k:'marka',head:'BRAND',w:16,al:'left',opt:true},
    {k:'model',head:'MODEL',w:17,al:'left',opt:true},
    {k:'miktar',head:'QTY',w:11,al:'center'},
    {k:'birim',head:'UNIT',w:10,al:'center'},
    {k:'fiyat',head:'UNIT PRICE',w:20,al:'right'},
    {k:'tutar',head:'AMOUNT',w:21,al:'right'}
  ];
  var ekGenislik=0;
  kolonlar=kolonlar.filter(function(c){
    if(c.opt&&!satirlar.some(function(s){return String(s[c.k]).trim();})){ekGenislik+=c.w;return false;}
    return true;
  });
  kolonlar.forEach(function(c){if(c.k==='aciklama')c.w+=ekGenislik;});
  var hucreDeger=function(s,k){
    if(k==='miktar')return fmtQty(s.miktar);
    if(k==='fiyat')return fmtN(s.fiyat);
    if(k==='tutar')return fmtN(s.tutar);
    return String(s[k]);
  };
  var columnStyles={};
  kolonlar.forEach(function(c,i){columnStyles[i]={halign:c.al,valign:c.k==='aciklama'?'top':'middle',cellWidth:mm(c.w)};});
  doc.autoTable({
    startY:divY+mm(2.517),
    head:[kolonlar.map(function(c){return c.head;})],
    body:satirlar.map(function(s){return kolonlar.map(function(c){return hucreDeger(s,c.k);});}),
    theme:'plain',
    showHead:'everyPage',
    styles:{font:'Arial',fontSize:7.5,cellPadding:{top:3.5,right:2,bottom:3.5,left:2},textColor:C.textDark,lineColor:C.tableBg,lineWidth:0.5,overflow:'linebreak'},
    headStyles:{fillColor:C.tableBg,textColor:C.primary,fontStyle:'bold',fontSize:7},
    columnStyles:columnStyles,
    margin:{left:mm(15.446),right:mm(210-179.184-15.446),top:mm(15),bottom:mm(25)},
    didParseCell:function(data){if(data.section==='head')data.cell.styles.halign=kolonlar[data.column.index].al;}
  });
  var tableEndY=doc.lastAutoTable.finalY;
  doc.setFont('Arial','normal');

  // ── TİCARİ KOŞULLAR (sol) + TOPLAM (sağ) ──
  var leftX=mm(15.446),leftAreaW=mm(115),pt8lh=mm(4.5);
  var totalBoxX=mm(141.901),totalBoxRightEdge=mm(194.63),totalBoxW=totalBoxRightEdge-totalBoxX;
  var teslimText='';
  if(t.incoterm)teslimText=t.incoterm+(t.teslimYeri?' '+t.teslimYeri:'')+' (Incoterms® 2020)';
  var kosullar=[
    teslimText?['Delivery Terms:',teslimText]:(t.teslimYeri?['Delivery Place:',t.teslimYeri]:null),
    t.teslimat?['Delivery Time:',t.teslimat]:null,
    t.odemeKosulu?['Payment Terms:',t.odemeKosulu]:null,
    [null,'All prices are quoted in '+(IHR_PB_ADLARI[pb]||pb)+' ('+pb+').']
  ].filter(Boolean);
  // Satırları önceden böl, yüksekliği hesapla
  doc.setFontSize(8);
  var kosulBloklari=kosullar.map(function(r){
    doc.setFont('Arial','bold');
    var labelW=r[0]?doc.getTextWidth(r[0]+' '):0;
    doc.setFont('Arial','normal');
    return{label:r[0],labelW:labelW,lines:doc.splitTextToSize(String(r[1]),leftAreaW-labelW)};
  });
  var notText=t.notlar||'This quotation is valid until the date stated above.';
  var notLines=[];
  notText.split('\n').forEach(function(line){notLines=notLines.concat(line.trim()===''?['']:doc.splitTextToSize(line,leftAreaW));});
  var kosulYuk=kosulBloklari.reduce(function(a,b){return a+b.lines.length*pt8lh;},0);
  var gerekli=mm(4)+kosulYuk+mm(6)+Math.min(notLines.length,6)*pt8lh;

  var sectionY=tableEndY+mm(5);
  if(sectionY+Math.max(gerekli,mm(14))>contentBottom){doc.addPage();sectionY=mm(20);}

  var y=sectionY+mm(4);
  kosulBloklari.forEach(function(b){
    if(b.label){doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.textLabel);doc.text(b.label,leftX,y);}
    doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textMid);
    b.lines.forEach(function(line,i){doc.text(line,leftX+b.labelW,y+i*pt8lh);});
    y+=b.lines.length*pt8lh;
  });
  var kosulDivY=y-pt8lh+mm(3);
  doc.setDrawColor.apply(doc,C.border);doc.setLineWidth(0.3);
  doc.line(leftX,kosulDivY,leftX+leftAreaW,kosulDivY);

  // Toplam kutusu
  doc.setDrawColor.apply(doc,C.primary);doc.setLineWidth(1.5);doc.setFillColor.apply(doc,C.white);
  doc.roundedRect(totalBoxX,sectionY,totalBoxW,mm(12.40),2,2,'FD');
  doc.setFontSize(8);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.primary);
  doc.text('TOTAL AMOUNT',totalBoxRightEdge-mm(2.5),sectionY+mm(4.0),{align:'right'});
  doc.setFontSize(11);doc.setTextColor.apply(doc,C.textMid);
  doc.text(fmtN(genelToplam)+' '+pb,totalBoxRightEdge-mm(2.5),sectionY+mm(9.2),{align:'right'});
  var totalsEndY=sectionY+mm(12.4);

  // Notlar (sayfa sonuna gelirse yeni sayfada devam eder)
  doc.setFontSize(8);doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textMid);
  y=kosulDivY+mm(6);
  notLines.forEach(function(line){
    if(y>contentBottom){doc.addPage();y=mm(20);totalsEndY=0;}
    doc.text(line,leftX,y);
    y+=pt8lh;
  });
  var blokY=Math.max(y-pt8lh+mm(1.5),totalsEndY)+mm(6);

  // ── BANKA BİLGİLERİ ──
  var b=t.bankaHesabi;
  if(b&&b.iban){
    var bankH=mm(22);
    if(blokY+bankH>contentBottom){doc.addPage();blokY=mm(20);}
    var bx=leftX,bw=totalBoxRightEdge-leftX,colW=bw/2;
    doc.setDrawColor.apply(doc,C.border);doc.setLineWidth(0.4);doc.setFillColor.apply(doc,C.boxBg);
    doc.roundedRect(bx,blokY,bw,bankH,2,2,'FD');
    doc.setFontSize(7);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.primary);
    doc.text('BANK DETAILS',bx+mm(3.5),blokY+mm(5));
    var bankRows=[
      [['Beneficiary',b.hesapSahibi||st.firma||''],['Bank',b.bankaAdi||'']],
      [['IBAN',_ihrFmtIban(b.iban)],['SWIFT / BIC',b.swift||'']],
      [['Branch',b.sube||''],['Currency',b.paraBirimi||pb]]
    ];
    bankRows.forEach(function(row,ri){
      row.forEach(function(cell,ci){
        if(!cell[1])return;
        var cx=bx+mm(3.5)+ci*colW,cy=blokY+mm(10.5)+ri*mm(4.5);
        doc.setFontSize(7.5);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.textLabel);
        doc.text(cell[0]+':',cx,cy);
        doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textMid);
        doc.text(doc.splitTextToSize(String(cell[1]),colW-mm(26))[0],cx+mm(20),cy);
      });
    });
    blokY+=bankH+mm(5);
  }

  // ── İMZA TABLOSU ──
  if(!imzaGizle){
    var sigX=leftX,sigW=totalBoxRightEdge-leftX,sColW=sigW/2,sigH=mm(27),sigPad=mm(3.5);
    if(blokY+sigH>contentBottom){doc.addPage();blokY=mm(20);}
    doc.setDrawColor.apply(doc,C.border);doc.setLineWidth(0.4);
    doc.roundedRect(sigX,blokY,sigW,sigH,2,2,'S');
    doc.line(sigX+sColW,blokY,sigX+sColW,blokY+sigH);
    doc.setFontSize(7);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.primary);
    doc.text('PREPARED BY',sigX+sColW/2,blokY+mm(5),{align:'center'});
    doc.text('CUSTOMER APPROVAL',sigX+sColW*1.5,blokY+mm(5),{align:'center'});
    var cu=state.currentUser||{};
    var u=t.olusturanAd?{ad:t.olusturanAd,email:t.olusturanEmail,telefon:t.olusturanTelefon}:{ad:cu.ad,email:cu.email,telefon:cu.telefon};
    if(u.telefon)u.telefon=fmtPhone(u.telefon);
    if(u.ad){
      doc.setFontSize(8);doc.setFont('Arial','bold');doc.setTextColor.apply(doc,C.textMid);
      doc.text(u.ad,sigX+sigPad,blokY+mm(11));
      doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textLight);
      if(u.email)doc.text(u.email,sigX+sigPad,blokY+mm(16));
      if(u.telefon)doc.text(u.telefon,sigX+sigPad,blokY+mm(21));
    }
    doc.setFontSize(7);doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textLight);
    doc.text('Company Stamp / Signature',sigX+sColW*1.5,blokY+mm(10),{align:'center'});
  }

  // ── ALT BİLGİ (her sayfada) ──
  var footerParts=['E-mail: '+(st.email||'info@ege-fe.com')];
  var telText=fmtPhone(st.tel||'0 (312) 482 5451');if(telText)footerParts.push('Tel: '+telText);
  var faxText=fmtPhone(st.faks||'0 (312) 480 5453');if(faxText)footerParts.push('Fax: '+faxText);
  var sayfaSayisi=doc.getNumberOfPages();
  for(var p=1;p<=sayfaSayisi;p++){
    doc.setPage(p);
    doc.setDrawColor.apply(doc,C.primary);doc.setLineWidth(2);
    doc.line(mm(15.446),mm(279.929),mm(194.556),mm(279.929));
    doc.setFontSize(7);doc.setFont('Arial','normal');doc.setTextColor.apply(doc,C.textLight);
    doc.text(footerParts.join('   |   '),mm(105),mm(284.604)+5+mm(4.5),{align:'center'});
    if(sayfaSayisi>1)doc.text('Page '+p+' of '+sayfaSayisi,mm(194.556),mm(284.604)+5+mm(4.5),{align:'right'});
  }

  doc.save('Quotation_'+(t.teklifNo||'X')+'.pdf');
}
