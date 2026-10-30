// ════ REFERANS STANDARTLAR — ANA STOKLAR (Faz 1) ════
// Hacimler µL, konsantrasyonlar µg/mL. Kalan hacim yalnızca hareketlerle değişir.

var _refAnaTab='aktif';
var _refAnaPage=1;
var REF_AKTIF_DURUMLAR=['Kapalı Ambalaj','Açık Ambalaj'];
// Çözücü ve konum seçenekleri Stok Ayarlar → Çözücü ve Konumlar'dan yönetilir
var REF_AYAR_VARSAYILAN={refCozuculer:['Metanol','Asetonitril'],refKonumlar:['Ampul Kutusu','Siyah Rack','Mor Rack']};
var REF_AYAR_ETIKET={refCozuculer:'Çözücü',refKonumlar:'Konum'};
// Başlıklar CSS ile büyük harfe çevriliyor; µ büyüyünce M gibi görünmesin
function refBirim(b){return '<span style="text-transform:none">'+b+'</span>';}

function refAyarListe(k){return (state.refAyarlar&&state.refAyarlar[k])||REF_AYAR_VARSAYILAN[k];}
async function refAyarlariYukle(){
  try{
    var a=(await apiGet('stok/ayarlar')).ayarlar||{};
    state.refAyarlar={refCozuculer:a.refCozuculer||REF_AYAR_VARSAYILAN.refCozuculer,refKonumlar:a.refKonumlar||REF_AYAR_VARSAYILAN.refKonumlar};
  }catch(e){
    state.refAyarlar=state.refAyarlar||null;
  }
}

async function loadRefAnaStok(){
  var ayarYukleme=refAyarlariYukle();
  try{
    var res=await apiGet('stok/ref-ana-stoklar');
    state.refAnaStoklar=res.stoklar||[];
  }catch(e){
    toast(e.message||'Ana stoklar yüklenemedi.','error');
    state.refAnaStoklar=state.refAnaStoklar||[];
  }
  await ayarYukleme;
  refFillFilterOptions();
  renderRefAnaStok();
}

// ── Biçimlendirme ──
function refFmtSayi(n){return n==null?'—':Number(n).toLocaleString('tr-TR',{maximumFractionDigits:3});}
function refFmtHacim(n){return refFmtSayi(n)+' µL';}
function refFmtKons(n){return n==null?'<span style="color:var(--amber)" title="Konsantrasyon bilinmiyor">?</span>':refFmtSayi(n);}
function refKonumText(s){
  if(!s.konumTipi&&!s.konumPozisyon)return '—';
  return (s.konumTipi||'')+(s.konumPozisyon?' · '+s.konumPozisyon:'');
}
function refSktInfo(skt){
  if(!skt)return {renk:'var(--text3)',etiket:''};
  var bugun=today();
  if(skt<bugun)return {renk:'var(--red)',etiket:'Doldu'};
  var d=new Date();d.setMonth(d.getMonth()+3);
  if(skt<=d.toISOString().slice(0,10))return {renk:'var(--amber)',etiket:'Yaklaşıyor'};
  return {renk:'var(--text2)',etiket:''};
}
function refDurumBadge(d){
  var cls={'Kapalı Ambalaj':'badge-gray','Açık Ambalaj':'badge-blue','Tükendi':'badge-sf','İmha':'badge-reddedildi'}[d]||'badge-gray';
  return '<span class="badge '+cls+'">'+esc(d)+'</span>';
}
function refHacimBar(s){
  var oran=s.ilkHacim>0?Math.max(0,Math.min(1,s.kalanHacim/s.ilkHacim)):0;
  var renk=oran<=0.2?'var(--amber)':'var(--accent)';
  return '<div style="display:flex;align-items:center;gap:8px;justify-content:flex-end">'
    +'<span style="font-family:var(--font-mono);white-space:nowrap">'+refFmtSayi(s.kalanHacim)+'<span style="color:var(--text3)"> / '+refFmtSayi(s.ilkHacim)+'</span></span>'
    +'<span style="width:48px;height:5px;border-radius:3px;background:var(--bg4);overflow:hidden;flex-shrink:0"><span style="display:block;height:100%;width:'+Math.round(oran*100)+'%;background:'+renk+'"></span></span>'
    +'</div>';
}

// ── Filtreler / sekmeler ──
function refFillFilterOptions(){
  var list=state.refAnaStoklar||[];
  var gSel=document.getElementById('ra-f-grup');
  if(gSel){
    var cur=gSel.value;
    var gruplar=Array.from(new Set(list.map(function(s){return s.grup||'';}).filter(Boolean))).sort(function(a,b){return a.localeCompare(b,'tr');});
    gSel.innerHTML='<option value="">Tüm Gruplar</option>'+gruplar.map(function(g){return '<option'+(g===cur?' selected':'')+'>'+esc(g)+'</option>';}).join('');
  }
  var kSel=document.getElementById('ra-f-konum');
  if(kSel){
    var curK=kSel.value;
    var konumlar=Array.from(new Set(refAyarListe('refKonumlar').concat(list.map(function(s){return s.konumTipi||'';}).filter(Boolean))));
    kSel.innerHTML='<option value="">Tüm Konumlar</option>'+konumlar.map(function(k){return '<option'+(k===curK?' selected':'')+'>'+esc(k)+'</option>';}).join('');
  }
}
function switchRefAnaTab(tab){_refAnaTab=tab;_refAnaPage=1;renderRefAnaStok();}
function setRefAnaPage(p){_refAnaPage=p;renderRefAnaStok();}

function renderRefAnaStok(){
  var all=state.refAnaStoklar||[];
  var aktifC=all.filter(function(s){return REF_AKTIF_DURUMLAR.includes(s.durum);}).length;
  var tA=document.getElementById('tab-refana-aktif');if(tA){tA.className='servis-tab'+(_refAnaTab==='aktif'?' active':'');document.getElementById('tab-refana-aktif-count').textContent=aktifC;}
  var tR=document.getElementById('tab-refana-arsiv');if(tR){tR.className='servis-tab'+(_refAnaTab==='arsiv'?' active':'');document.getElementById('tab-refana-arsiv-count').textContent=all.length-aktifC;}

  var q=((document.getElementById('ra-f-arama')||{}).value||'').toLocaleLowerCase('tr');
  var fGrup=(document.getElementById('ra-f-grup')||{}).value||'';
  var fKonum=(document.getElementById('ra-f-konum')||{}).value||'';
  var fUyari=(document.getElementById('ra-f-uyari')||{}).value||'';
  var data=all.filter(function(s){
    var aktif=REF_AKTIF_DURUMLAR.includes(s.durum);
    if((_refAnaTab==='aktif')!==aktif)return false;
    if(fGrup&&s.grup!==fGrup)return false;
    if(fKonum&&s.konumTipi!==fKonum)return false;
    if(fUyari==='skt'&&!refSktInfo(s.skt).etiket)return false;
    if(fUyari==='dogrulanmadi'&&!s.dogrulanmadi)return false;
    if(fUyari==='bilinmeyen'&&s.konsantrasyon!=null)return false;
    if(q){
      var hay=[s.kod,s.grup,s.standartAdi,s.katalogNo,s.lotNo,s.uretici,s.notlar].join(' ').toLocaleLowerCase('tr');
      if(!hay.includes(q))return false;
    }
    return true;
  });
  data.sort(function(a,b){
    var c=(a.grup||'').localeCompare(b.grup||'','tr');if(c)return c;
    c=(a.standartAdi||'').localeCompare(b.standartAdi||'','tr');if(c)return c;
    return (b.konsantrasyon||0)-(a.konsantrasyon||0);
  });

  var wrap=document.getElementById('ref-ana-wrap');if(!wrap)return;
  if(!data.length){
    wrap.innerHTML='<div style="text-align:center;padding:40px;color:var(--text3)">'+(_refAnaTab==='aktif'?'Kayıt bulunamadı.':'Arşivde kayıt yok.')+'</div>';
    renderPagination('ref-ana-pagination',1,0,'setRefAnaPage');
    return;
  }
  var paged=data.slice((_refAnaPage-1)*PAGE_SIZE,_refAnaPage*PAGE_SIZE);
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var cols=10;
  var html='<div class="table-wrap"><table class="compact-table" style="min-width:1080px"><thead><tr>'
    +'<th>Kod</th><th class="col-name">Standart</th><th>Kat. No / Lot</th><th style="text-align:right">Kons. ('+refBirim('µg/mL')+')</th><th>Çözücü</th>'
    +'<th style="text-align:right">Kalan / İlk ('+refBirim('µL')+')</th><th>Durum</th><th>SKT</th><th>Konum</th><th></th></tr></thead><tbody>';
  var lastGrup=null;
  paged.forEach(function(s){
    var g=s.grup||'Grupsuz';
    if(g!==lastGrup){
      html+='<tr><td colspan="'+cols+'" style="text-align:left;padding:9px 16px;background:var(--bg4);font-size:11px;font-weight:700;color:var(--accent);text-transform:uppercase;letter-spacing:.05em">'+esc(g)+'</td></tr>';
      lastGrup=g;
    }
    var skt=refSktInfo(s.skt);
    var aktif=REF_AKTIF_DURUMLAR.includes(s.durum);
    html+='<tr style="cursor:pointer" onclick="openRefAnaDetay(\''+s.id+'\')">'
      +'<td><span class="kn-badge" style="white-space:nowrap">'+esc(s.kod)+'</span></td>'
      +'<td class="col-name" style="font-weight:500">'+esc(s.standartAdi)
        +(s.dogrulanmadi?' <i class="ti ti-alert-triangle" style="color:var(--amber)" title="Bilgi doğrulanmadı"></i>':'')+'</td>'
      +'<td style="font-size:12px"><div style="font-family:var(--font-mono)">'+esc(s.katalogNo||'—')+'</div>'+(s.lotNo?'<div style="color:var(--text3);font-size:11px">Lot: '+esc(s.lotNo)+'</div>':'')+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+refFmtKons(s.konsantrasyon)+'</td>'
      +'<td style="font-size:12px;color:var(--text2)">'+esc(s.cozucu||'—')+'</td>'
      +'<td>'+refHacimBar(s)+'</td>'
      +'<td>'+refDurumBadge(s.durum)+'</td>'
      +'<td style="font-family:var(--font-mono);font-size:12px;color:'+skt.renk+'">'+(s.skt?fmtDate(s.skt)+(skt.etiket?' ('+skt.etiket+')':''):'—')+'</td>'
      +'<td style="font-size:12px;color:var(--text2);white-space:nowrap">'+esc(refKonumText(s))+'</td>'
      +'<td onclick="event.stopPropagation()"><div class="action-row" style="justify-content:flex-end">'
        +(canWrite&&s.durum==='Kapalı Ambalaj'?'<button class="btn-icon" title="Ambalajı Aç" style="color:var(--accent)" onclick="openRefHareket(\''+s.id+'\',\'Açılış\')"><i class="ti ti-lock-open"></i></button>':'')
        +(canWrite&&aktif?'<button class="btn-icon" title="Kullanım Düş" style="color:var(--teal)" onclick="openRefHareket(\''+s.id+'\',\'Kullanım\')"><i class="ti ti-droplet-minus"></i></button>':'')
      +'</div></td>'
      +'</tr>';
  });
  wrap.innerHTML=html+'</tbody></table></div>';
  renderPagination('ref-ana-pagination',_refAnaPage,data.length,'setRefAnaPage');
}

// ── Form (yeni / düzenle) ──
// Seçenekler ayarlardaki listeden gelir; kayıttaki değer listeden çıkarılmışsa yine de korunur
function refSelectDoldur(id,ayarKey,mevcut){
  var el=document.getElementById(id);if(!el)return;
  var vals=refAyarListe(ayarKey).slice();
  if(mevcut&&vals.indexOf(mevcut)<0)vals.push(mevcut);
  el.innerHTML='<option value="">— Seçin —</option>'+vals.map(function(v){return '<option value="'+esc(v)+'">'+esc(v)+'</option>';}).join('');
}

function openRefAnaForm(id){
  if(state.currentUser&&state.currentUser.rol==='izleyici'){toast('Yetki yok.','error');return;}
  if(!id)_refFormDetaydan=false;
  var s=id?(state.refAnaStoklar||[]).find(function(x){return x.id===id;}):null;
  refSelectDoldur('ra-form-cozucu','refCozuculer',s&&s.cozucu);
  refSelectDoldur('ra-form-konum-tipi','refKonumlar',s&&s.konumTipi);
  document.getElementById('ra-form-title').textContent=s?'Ana Stok Düzenle — '+s.kod:'Yeni Ana Stok';
  document.getElementById('ra-form-id').value=s?s.id:'';
  var set=function(fid,v){var el=document.getElementById(fid);if(el)el.value=v==null?'':v;};
  set('ra-form-grup',s&&s.grup);
  set('ra-form-standart',s&&s.standartAdi);
  set('ra-form-katalog',s&&s.katalogNo);
  set('ra-form-lot',s&&s.lotNo);
  set('ra-form-uretici',s&&s.uretici);
  set('ra-form-kons',s&&s.konsantrasyon);
  set('ra-form-cozucu',s&&s.cozucu);
  set('ra-form-hacim',s?s.ilkHacim:'');
  set('ra-form-durum',s?s.durum:'Kapalı Ambalaj');
  set('ra-form-acilis',s&&s.acilisTarihi);
  set('ra-form-skt',s&&s.skt);
  set('ra-form-konum-tipi',s&&s.konumTipi);
  set('ra-form-konum-poz',s&&s.konumPozisyon);
  set('ra-form-notlar',s&&s.notlar);
  document.getElementById('ra-form-dogrulanmadi').checked=!!(s&&s.dogrulanmadi);
  // Durum yalnızca yeni kayıtta seçilir; sonrasında hareketlerle değişir
  document.getElementById('ra-form-durum-wrap').style.display=s?'none':'';
  document.getElementById('ra-form-hacim-not').textContent=s?'Kullanım görmemiş stokta düzeltilebilir.':'';
  refFormDurumChange();
  if(s&&s.durum==='Kapalı Ambalaj')document.getElementById('ra-form-acilis-wrap').style.display='none';
  openModal('modal-ref-ana-form');
}
function refFormDurumChange(){
  var d=document.getElementById('ra-form-durum').value;
  var isEdit=!!document.getElementById('ra-form-id').value;
  document.getElementById('ra-form-acilis-wrap').style.display=(isEdit||d==='Açık Ambalaj')?'':'none';
}

async function saveRefAnaForm(){
  var id=document.getElementById('ra-form-id').value;
  var v=function(fid){return (document.getElementById(fid)||{}).value||'';};
  var payload={
    grup:v('ra-form-grup').trim(),
    standartAdi:v('ra-form-standart').trim(),
    katalogNo:v('ra-form-katalog').trim(),
    lotNo:v('ra-form-lot').trim(),
    uretici:v('ra-form-uretici').trim(),
    konsantrasyon:v('ra-form-kons')===''?null:parseFloat(v('ra-form-kons')),
    cozucu:v('ra-form-cozucu').trim(),
    ilkHacim:v('ra-form-hacim')===''?null:parseFloat(v('ra-form-hacim')),
    durum:v('ra-form-durum'),
    acilisTarihi:v('ra-form-acilis'),
    skt:v('ra-form-skt'),
    konumTipi:v('ra-form-konum-tipi').trim(),
    konumPozisyon:v('ra-form-konum-poz').trim(),
    dogrulanmadi:document.getElementById('ra-form-dogrulanmadi').checked,
    notlar:v('ra-form-notlar').trim()
  };
  if(!payload.standartAdi)return toast('Standart adı zorunludur.','error');
  if(!id&&(payload.ilkHacim==null||isNaN(payload.ilkHacim)||payload.ilkHacim<0))return toast('Hacim (µL) girin.','error');
  if(payload.konsantrasyon!=null&&(isNaN(payload.konsantrasyon)||payload.konsantrasyon<=0))return toast('Konsantrasyon geçersiz.','error');
  try{
    var res;
    if(id){
      res=await apiPut('stok/ref-ana-stoklar',Object.assign({id:id},payload));
      var idx=state.refAnaStoklar.findIndex(function(x){return x.id===id;});
      if(idx>=0)state.refAnaStoklar[idx]=res.stok;
      toast('Ana stok güncellendi.','success');
    }else{
      res=await apiPost('stok/ref-ana-stoklar',payload);
      state.refAnaStoklar.push(res.stok);
      toast(res.stok.kod+' kaydedildi.','success');
    }
  }catch(e){return toast(e.message||'Kaydedilemedi.','error');}
  closeModal('modal-ref-ana-form');
  refFillFilterOptions();renderRefAnaStok();
  if(id&&_refFormDetaydan){_refFormDetaydan=false;openRefAnaDetay(id);}
}

// ── Detay ──
var _refAktifDetayId=null;
async function openRefAnaDetay(id){
  _refAktifDetayId=id;
  var body=document.getElementById('ra-detay-body');
  var s=(state.refAnaStoklar||[]).find(function(x){return x.id===id;});
  if(!s)return;
  document.getElementById('ra-detay-title').innerHTML=esc(s.kod)+' · '+esc(s.standartAdi);
  body.innerHTML='<div style="padding:30px;text-align:center;color:var(--text3)">Yükleniyor...</div>';
  openModal('modal-ref-ana-detay');
  var detay;
  try{detay=(await apiGet('stok/ref-ana-stoklar?id='+encodeURIComponent(id))).stok;}
  catch(e){body.innerHTML='<div style="padding:30px;text-align:center;color:var(--red)">'+esc(e.message||'Yüklenemedi')+'</div>';return;}
  var idx=state.refAnaStoklar.findIndex(function(x){return x.id===id;});
  if(idx>=0){var kopya=Object.assign({},detay);delete kopya.hareketler;state.refAnaStoklar[idx]=kopya;}
  refDetayCiz(detay);
}

function refDetayCiz(s){
  var canWrite=state.currentUser&&state.currentUser.rol!=='izleyici';
  var aktif=REF_AKTIF_DURUMLAR.includes(s.durum);
  var skt=refSktInfo(s.skt);
  function box(l,v){return '<div class="pd-info-box"><div class="info-item-label">'+l+'</div><div class="info-item-val">'+v+'</div></div>';}
  var html='';
  if(s.dogrulanmadi)html+='<div style="display:flex;gap:8px;align-items:center;padding:8px 12px;margin-bottom:12px;border-radius:var(--radius-sm);background:var(--amber-soft);color:var(--amber);font-size:12px"><i class="ti ti-alert-triangle"></i> Bu kaydın bazı bilgileri doğrulanmadı. Etiketle kontrol edip düzenleyin.</div>';
  html+='<div class="pd-section"><div class="pd-section-title">Standart Bilgileri</div><div class="pd-info-grid">'
    +box('Grup',esc(s.grup||'—'))
    +box('Katalog No','<span style="font-family:var(--font-mono)">'+esc(s.katalogNo||'—')+'</span>')
    +box('Lot No',esc(s.lotNo||'—'))
    +box('Üretici',esc(s.uretici||'—'))
    +box('Konsantrasyon',s.konsantrasyon==null?'<span style="color:var(--amber)">Bilinmiyor</span>':refFmtSayi(s.konsantrasyon)+' µg/mL')
    +box('Çözücü',esc(s.cozucu||'—'))
    +'</div></div>';
  html+='<div class="pd-section"><div class="pd-section-title">Stok Durumu</div><div class="pd-info-grid">'
    +box('Durum',refDurumBadge(s.durum))
    +box('Kalan / İlk Hacim',refFmtHacim(s.kalanHacim)+' <span style="color:var(--text3)">/ '+refFmtSayi(s.ilkHacim)+'</span>')
    +box('Açılış Tarihi',fmtDate(s.acilisTarihi))
    +box('SKT','<span style="color:'+skt.renk+'">'+fmtDate(s.skt)+(skt.etiket?' ('+skt.etiket+')':'')+'</span>')
    +box('Konum',esc(refKonumText(s)))
    +'</div></div>';
  if(s.notlar)html+='<div class="pd-section"><div class="pd-section-title">Not</div><div style="font-size:12px;color:var(--text2);white-space:pre-wrap">'+esc(s.notlar)+'</div></div>';

  var rows=(s.hareketler||[]).slice().reverse().map(function(h){
    var renk=h.miktar>0?'var(--green)':(h.miktar<0?'var(--red)':'var(--text3)');
    var miktar=h.miktar===0?'—':(h.miktar>0?'+':'')+refFmtSayi(h.miktar);
    return '<tr><td style="font-size:12px;white-space:nowrap">'+fmtDate(h.tarih)+'</td><td>'+esc(h.tip)+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono);color:'+renk+'">'+miktar+'</td>'
      +'<td style="text-align:right;font-family:var(--font-mono)">'+refFmtSayi(h.kalanSonra)+'</td>'
      +'<td style="font-size:12px;color:var(--text2)">'+esc(h.aciklama||'')+'</td>'
      +'<td style="font-size:11px;color:var(--text3);white-space:nowrap">'+esc(h.kullaniciAd||'')+'</td></tr>';
  }).join('');
  html+='<div class="pd-section"><div class="pd-section-title">Hareket Geçmişi</div>'
    +'<div class="table-wrap"><table class="compact-table" style="min-width:640px"><thead><tr><th>Tarih</th><th>İşlem</th><th style="text-align:right">Miktar ('+refBirim('µL')+')</th><th style="text-align:right">Kalan ('+refBirim('µL')+')</th><th>Açıklama</th><th>Kullanıcı</th></tr></thead><tbody>'
    +(rows||'<tr><td colspan="6" style="text-align:center;color:var(--text3)">Hareket yok</td></tr>')+'</tbody></table></div></div>';
  document.getElementById('ra-detay-body').innerHTML=html;

  var actions='';
  if(canWrite){
    if(s.durum==='Kapalı Ambalaj')actions+='<button class="btn btn-ghost btn-sm" onclick="openRefHareket(\''+s.id+'\',\'Açılış\')"><i class="ti ti-lock-open"></i> Ambalajı Aç</button>';
    if(aktif)actions+='<button class="btn btn-ghost btn-sm" onclick="openRefHareket(\''+s.id+'\',\'Kullanım\')"><i class="ti ti-droplet-minus"></i> Kullanım Düş</button>';
    if(s.durum!=='İmha')actions+='<button class="btn btn-ghost btn-sm" onclick="openRefHareket(\''+s.id+'\',\'Sayım Düzeltme\')"><i class="ti ti-adjustments"></i> Sayım Düzeltme</button>';
    if(s.durum!=='İmha')actions+='<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="openRefHareket(\''+s.id+'\',\'İmha\')"><i class="ti ti-flame"></i> İmha</button>';
  }
  document.getElementById('ra-detay-actions').innerHTML=actions;
  document.getElementById('ra-detay-edit-btn').style.display=canWrite?'':'none';
  var silinebilir=canWrite&&!(s.hareketler||[]).some(function(h){return h.tip!=='Giriş'&&h.tip!=='Açılış';});
  document.getElementById('ra-detay-delete-btn').style.display=silinebilir?'':'none';
}
var _refFormDetaydan=false;
function editRefAnaFromDetay(){
  if(!_refAktifDetayId)return;
  closeModal('modal-ref-ana-detay');
  _refFormDetaydan=true;
  openRefAnaForm(_refAktifDetayId);
}
function deleteRefAnaFromDetay(){
  var id=_refAktifDetayId;if(!id)return;
  showConfirm('Bu ana stok kaydı silinsin mi? Bu işlem geri alınamaz.',async function(){
    try{await apiDelete('stok/ref-ana-stoklar?id='+encodeURIComponent(id));}
    catch(e){return toast(e.message||'Silinemedi.','error');}
    state.refAnaStoklar=state.refAnaStoklar.filter(function(x){return x.id!==id;});
    closeModal('modal-ref-ana-detay');
    refFillFilterOptions();renderRefAnaStok();
    toast('Kayıt silindi.','success');
  });
}

// ── Hareket (açılış / kullanım / sayım / imha) ──
function openRefHareket(id,tip){
  var s=(state.refAnaStoklar||[]).find(function(x){return x.id===id;});if(!s)return;
  document.getElementById('rh-stok-id').value=id;
  document.getElementById('rh-tip').value=tip;
  document.getElementById('rh-title').textContent=tip==='Açılış'?'Ambalajı Aç':tip==='Kullanım'?'Kullanım Düş':tip;
  document.getElementById('rh-stok-bilgi').innerHTML='<strong>'+esc(s.kod)+'</strong> · '+esc(s.standartAdi)
    +(s.konsantrasyon!=null?' · '+refFmtSayi(s.konsantrasyon)+' µg/mL':'')
    +'<div style="margin-top:4px;color:var(--text3)">Kalan: <span style="font-family:var(--font-mono);color:var(--text)">'+refFmtHacim(s.kalanHacim)+'</span></div>';
  document.getElementById('rh-tarih').value=today();
  document.getElementById('rh-miktar').value='';
  document.getElementById('rh-olculen').value='';
  document.getElementById('rh-aciklama').value='';
  document.getElementById('rh-miktar-wrap').style.display=tip==='Kullanım'?'':'none';
  document.getElementById('rh-olculen-wrap').style.display=tip==='Sayım Düzeltme'?'':'none';
  var uyari='';
  if(tip==='Kullanım'&&s.durum==='Kapalı Ambalaj')uyari='Ambalaj kapalı görünüyor; kayıtla birlikte açılış tarihi olarak bu tarih işlenecek.';
  if(tip==='İmha')uyari='Kalan '+refFmtHacim(s.kalanHacim)+' imha edilecek ve kayıt arşive taşınacak.';
  var uEl=document.getElementById('rh-uyari');uEl.textContent=uyari;uEl.style.display=uyari?'':'none';
  var btn=document.getElementById('rh-save-btn');
  btn.className='btn '+(tip==='İmha'?'btn-danger':'btn-primary');
  openModal('modal-ref-hareket');
  setTimeout(function(){var f=document.getElementById(tip==='Kullanım'?'rh-miktar':tip==='Sayım Düzeltme'?'rh-olculen':'rh-aciklama');if(f)f.focus();},50);
}

async function saveRefHareket(){
  var id=document.getElementById('rh-stok-id').value;
  var tip=document.getElementById('rh-tip').value;
  var payload={stokTipi:'ana',stokId:id,tip:tip,tarih:document.getElementById('rh-tarih').value,aciklama:document.getElementById('rh-aciklama').value.trim()};
  if(tip==='Kullanım'){
    var m=parseFloat(document.getElementById('rh-miktar').value);
    if(!(m>0))return toast('Kullanılan hacmi (µL) girin.','error');
    payload.miktar=m;
  }
  if(tip==='Sayım Düzeltme'){
    var o=parseFloat(document.getElementById('rh-olculen').value);
    if(isNaN(o)||o<0)return toast('Ölçülen hacmi (µL) girin.','error');
    payload.olculenHacim=o;
  }
  var btn=document.getElementById('rh-save-btn');btn.disabled=true;
  var res;
  try{res=await apiPost('stok/ref-hareketler',payload);}
  catch(e){btn.disabled=false;return toast(e.message||'İşlem kaydedilemedi.','error');}
  btn.disabled=false;
  var idx=state.refAnaStoklar.findIndex(function(x){return x.id===id;});
  if(idx>=0){var kopya=Object.assign({},res.stok);delete kopya.hareketler;state.refAnaStoklar[idx]=kopya;}
  closeModal('modal-ref-hareket');
  renderRefAnaStok();
  if(document.getElementById('modal-ref-ana-detay').classList.contains('open')&&_refAktifDetayId===id)refDetayCiz(res.stok);
  toast(tip+' kaydedildi.','success');
}

// ── Excel dışa aktarma ──
function refExportAnaStokExcel(){
  var headers=['Kod','Grup','Standart Adı','Katalog No','Lot No','Üretici','Konsantrasyon (µg/mL)','Çözücü','İlk Hacim (µL)','Kalan Hacim (µL)','Durum','Açılış Tarihi','SKT','Konum','Pozisyon','Doğrulanmadı','Not'];
  var rows=(state.refAnaStoklar||[]).slice().sort(function(a,b){
    var c=(a.grup||'').localeCompare(b.grup||'','tr');return c||(a.standartAdi||'').localeCompare(b.standartAdi||'','tr');
  }).map(function(s){
    return [s.kod,s.grup||'',s.standartAdi,s.katalogNo||'',s.lotNo||'',s.uretici||'',s.konsantrasyon==null?'':s.konsantrasyon,s.cozucu||'',s.ilkHacim,s.kalanHacim,s.durum,s.acilisTarihi||'',s.skt||'',s.konumTipi||'',s.konumPozisyon||'',s.dogrulanmadi?'Evet':'',s.notlar||''];
  });
  _xlsxDownload(rows,headers,'Ana Stoklar','referans-ana-stoklar');
}

// ── Excel'den içe aktarma ──
// Beklenen başlıklar (eski takip dosyası): Ampul Kutusunda, Siyah Rack Pozisyon, Mor Rack Pozisyon,
// Kısaltma, Cat. No, Stok Adı, Ana stok derişimi (µg/mL), Ana stok mevcut (Yakl) (µL), Durum
var _refImportKayitlar=[];

function refImportSec(){
  if(!window.XLSX){toast('Excel kütüphanesi yüklenemedi.','error');return;}
  var inp=document.getElementById('ra-import-file');inp.value='';inp.click();
}

function refImportDosya(inp){
  var file=inp.files&&inp.files[0];if(!file)return;
  var reader=new FileReader();
  reader.onload=function(ev){
    try{
      var wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      var ws=wb.Sheets[wb.SheetNames[0]];
      var aoa=XLSX.utils.sheet_to_json(ws,{header:1,raw:true,defval:''});
      _refImportKayitlar=refImportParse(aoa);
      if(!_refImportKayitlar.length){toast('Dosyada aktarılacak satır bulunamadı. Başlık satırında "Stok Adı" sütunu olmalı.','error');return;}
      refImportOnizle();
    }catch(e){toast('Excel dosyası okunamadı: '+e.message,'error');}
  };
  reader.readAsArrayBuffer(file);
}

function refNorm(s){
  return String(s==null?'':s).toLocaleLowerCase('tr').replace(/ı/g,'i').replace(/ş/g,'s').replace(/ç/g,'c').replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ö/g,'o').replace(/\s+/g,' ').trim();
}

// "1.000" / "1,5" / 1000 / "?" → sayı ya da null
function refParseSayi(v){
  if(typeof v==='number')return isFinite(v)?v:null;
  var t=String(v==null?'':v).trim();
  if(!t||/\?/.test(t))return null;
  t=t.replace(/\s/g,'');
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t))t=t.replace(/\./g,'').replace(',','.');
  else t=t.replace(',','.');
  var n=parseFloat(t);
  return isFinite(n)?n:null;
}

function refImportParse(aoa){
  var hdrIdx=-1,map={};
  for(var r=0;r<Math.min(aoa.length,15);r++){
    var row=aoa[r].map(refNorm);
    if(row.some(function(c){return c.indexOf('stok adi')===0;})){hdrIdx=r;
      row.forEach(function(c,i){
        if(c.indexOf('ampul')===0&&map.ampul==null)map.ampul=i;
        else if(c.indexOf('siyah')===0&&map.siyah==null)map.siyah=i;
        else if(c.indexOf('mor')===0&&map.mor==null)map.mor=i;
        else if(c.indexOf('kisaltma')===0&&map.grup==null)map.grup=i;
        else if((c.indexOf('cat')===0||c.indexOf('katalog')===0)&&map.katalog==null)map.katalog=i;
        else if(c.indexOf('stok adi')===0&&map.ad==null)map.ad=i;
        else if((c.indexOf('derisim')>=0||c.indexOf('konsantrasyon')>=0)&&map.kons==null)map.kons=i;
        else if(c.indexOf('mevcut')>=0&&map.hacim==null)map.hacim=i;
        else if(c.indexOf('durum')===0&&map.durum==null)map.durum=i;
      });
      break;
    }
  }
  if(hdrIdx<0||map.ad==null)return [];
  var out=[];
  for(var j=hdrIdx+1;j<aoa.length;j++){
    var row2=aoa[j];
    var cell=function(k){return map[k]==null?'':String(row2[map[k]]==null?'':row2[map[k]]).trim();};
    var ad=cell('ad');if(!ad)continue;
    var uyarilar=[];
    var k={standartAdi:ad,grup:cell('grup').toUpperCase(),katalogNo:cell('katalog'),konsantrasyon:refParseSayi(map.kons==null?'':row2[map.kons]),ilkHacim:refParseSayi(map.hacim==null?'':row2[map.hacim]),dogrulanmadi:false,notlar:'',acilisTarihi:'',konumTipi:'',konumPozisyon:''};

    // Konum: üç sütundan dolu olan
    if(cell('ampul')){k.konumTipi='Ampul Kutusu';}
    else if(cell('siyah')){k.konumTipi='Siyah Rack';k.konumPozisyon=cell('siyah');}
    else if(cell('mor')){k.konumTipi='Mor Rack';k.konumPozisyon=cell('mor');}

    // Katalog no içinde açılış tarihi / okunamayan kod
    var kat=k.katalogNo;
    var tarihM=kat.match(/(\d{1,2})[.\/](\d{1,2})[.\/](\d{4})/);
    if(tarihM&&/a[cç][iı]l/i.test(kat)){
      k.acilisTarihi=tarihM[3]+'-'+('0'+tarihM[2]).slice(-2)+'-'+('0'+tarihM[1]).slice(-2);
      k.notlar='Kaynak dosyada katalog no yerine: "'+kat+'"';
      k.katalogNo='';k.dogrulanmadi=true;uyarilar.push('Katalog no yok, açılış tarihi alındı');
    }else if(/okunmuyor|\?/i.test(kat)||!kat){
      if(kat)k.notlar='Kaynak dosyada katalog no: "'+kat+'"';
      k.katalogNo='';k.dogrulanmadi=true;uyarilar.push('Katalog no okunmuyor');
    }
    if(k.konsantrasyon==null){k.dogrulanmadi=true;uyarilar.push('Konsantrasyon bilinmiyor');}
    if(k.ilkHacim==null){k.ilkHacim=0;uyarilar.push('Hacim yok (0 alındı)');}

    // Çözücü: katalog no son eki (-ME metanol, -AN asetonitril)
    if(/-ME$/i.test(k.katalogNo))k.cozucu='Metanol';
    else if(/-AN$/i.test(k.katalogNo))k.cozucu='Asetonitril';
    else if(/asetonitril/i.test(ad))k.cozucu='Asetonitril';

    k.durum=/kapal/i.test(cell('durum'))?'Kapalı Ambalaj':'Açık Ambalaj';
    k._uyarilar=uyarilar;
    out.push(k);
  }
  return out;
}

function refImportOnizle(){
  var list=_refImportKayitlar;
  var uyariC=list.filter(function(k){return k._uyarilar.length;}).length;
  var mevcut=(state.refAnaStoklar||[]).length;
  var html='<div style="font-size:12px;color:var(--text2);margin-bottom:10px">'
    +'<strong>'+list.length+'</strong> satır okundu'+(uyariC?', <span style="color:var(--amber)">'+uyariC+' satır kontrol gerektiriyor</span> (bunlar "doğrulanmadı" olarak işaretlenecek)':'')+'.'
    +(mevcut?' <span style="color:var(--amber)">Sistemde zaten '+mevcut+' kayıt var; aktarılan satırlar bunlara eklenecek.</span>':'')
    +'</div>'
    +'<div class="table-wrap" style="max-height:52vh;overflow:auto"><table class="compact-table" style="min-width:960px"><thead><tr><th>Grup</th><th>Standart</th><th>Kat. No</th><th style="text-align:right">Kons. ('+refBirim('µg/mL')+')</th><th>Çözücü</th><th style="text-align:right">Hacim ('+refBirim('µL')+')</th><th>Durum</th><th>Konum</th><th>Uyarı</th></tr></thead><tbody>'
    +list.map(function(k){
      return '<tr'+(k._uyarilar.length?' style="background:var(--amber-soft)"':'')+'>'
        +'<td>'+esc(k.grup)+'</td><td>'+esc(k.standartAdi)+'</td>'
        +'<td style="font-family:var(--font-mono);font-size:11px">'+esc(k.katalogNo||'—')+'</td>'
        +'<td style="text-align:right;font-family:var(--font-mono)">'+refFmtKons(k.konsantrasyon)+'</td>'
        +'<td style="font-size:12px">'+esc(k.cozucu||'—')+'</td>'
        +'<td style="text-align:right;font-family:var(--font-mono)">'+refFmtSayi(k.ilkHacim)+'</td>'
        +'<td style="font-size:12px">'+esc(k.durum)+'</td>'
        +'<td style="font-size:12px;white-space:nowrap">'+esc(refKonumText(k))+'</td>'
        +'<td style="font-size:11px;color:var(--amber)">'+esc(k._uyarilar.join(', '))+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  document.getElementById('ra-import-body').innerHTML=html;
  document.getElementById('ra-import-save-btn').textContent=list.length+' Kaydı Aktar';
  openModal('modal-ref-import');
}

async function saveRefImport(){
  if(!_refImportKayitlar.length)return;
  var btn=document.getElementById('ra-import-save-btn');btn.disabled=true;
  var kayitlar=_refImportKayitlar.map(function(k){var c=Object.assign({},k);delete c._uyarilar;return c;});
  try{
    var res=await apiPost('stok/ref-ana-stoklar',{kayitlar:kayitlar});
    toast(res.eklenen+' kayıt aktarıldı.','success');
  }catch(e){btn.disabled=false;return toast(e.message||'Aktarım başarısız.','error');}
  btn.disabled=false;
  _refImportKayitlar=[];
  closeModal('modal-ref-import');
  loadRefAnaStok();
}

// ── Stok Ayarlar → Çözücü ve Konumlar ──
async function refAyarPanelYukle(){
  await refAyarlariYukle();
  refAyarRender('refCozuculer');
  refAyarRender('refKonumlar');
}

function refAyarRender(k){
  var el=document.getElementById('ref-ayar-liste-'+k);if(!el)return;
  var list=refAyarListe(k);
  if(!list.length){el.innerHTML='<div style="padding:8px 0;font-size:13px;color:var(--text3)">Henüz tanımlanmamış.</div>';return;}
  el.innerHTML='<div style="display:flex;flex-direction:column;gap:4px">'+list.map(function(v,i){
    return '<div style="display:flex;align-items:center;justify-content:space-between;padding:7px 10px;background:var(--bg3);border-radius:var(--radius-sm);border:1px solid var(--border)">'
      +'<span style="font-size:13px;color:var(--text)">'+esc(v)+'</span>'
      +'<button class="btn-icon sa-action" style="color:var(--red);flex-shrink:0" title="Sil" onclick="refAyarSil(\''+k+'\','+i+')"><i class="ti ti-trash"></i></button>'
      +'</div>';
  }).join('')+'</div>';
}

async function refAyarKaydet(k,yeni){
  var body={};body[k]=yeni;
  var res=await apiPut('stok/ayarlar',body);
  state.refAyarlar=state.refAyarlar||{refCozuculer:refAyarListe('refCozuculer'),refKonumlar:refAyarListe('refKonumlar')};
  state.refAyarlar[k]=(res.ayarlar&&res.ayarlar[k])||yeni;
  refAyarRender(k);
}

async function refAyarEkle(k){
  var inp=document.getElementById('ref-ayar-yeni-'+k);if(!inp)return;
  var val=inp.value.trim();
  if(!val)return toast(REF_AYAR_ETIKET[k]+' adı boş olamaz.','error');
  var list=refAyarListe(k);
  if(list.some(function(v){return v.toLocaleLowerCase('tr')===val.toLocaleLowerCase('tr');}))return toast('Bu '+REF_AYAR_ETIKET[k].toLocaleLowerCase('tr')+' zaten listede.','info');
  try{await refAyarKaydet(k,list.concat([val]));}
  catch(e){return toast(e.message||'Kaydedilemedi.','error');}
  inp.value='';
  toast(REF_AYAR_ETIKET[k]+' eklendi.','success');
}

function refAyarSil(k,i){
  var list=refAyarListe(k);
  var ad=list[i];if(ad==null)return;
  showConfirm('"'+ad+'" listeden kaldırılsın mı? Bu değeri kullanan mevcut kayıtlar değişmez.',async function(){
    var yeni=list.slice();yeni.splice(i,1);
    try{await refAyarKaydet(k,yeni);}
    catch(e){return toast(e.message||'Silinemedi.','error');}
    toast(REF_AYAR_ETIKET[k]+' kaldırıldı.','info');
  });
}
