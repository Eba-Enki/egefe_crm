// ════ SİPARİŞLER ════
var siparislerPage=1;var _siparisFilterHash='';
function setSiparislerPage(n){siparislerPage=n;renderSiparisler();}
var faturalarPage=1;var _faturaFilterHash='';
function setFaturalarPage(n){faturalarPage=n;renderFaturalar();}
const SP_DURUM_LIST=['Hazırlanıyor','Kısmi Teslimat','Teslim Edildi','İptal'];
const SP_DURUM_CSS={'Hazırlanıyor':'badge-yeni','Kısmi Teslimat':'badge-sf','Teslim Edildi':'badge-teslim','İptal':'badge-reddedildi','Fatura Edildi':'badge-onaylandi'};
const ARSIV_SIPARISLER=['Fatura Edildi','İptal'];
const ARSIV_FATURALAR=['Ödendi'];
let siparisTab='aktif';
let faturaTab='aktif';

function switchSiparisTab(tab){
  siparisTab=tab;
  var aktifBtn=document.getElementById('tab-siparis-aktif');
  var arsivBtn=document.getElementById('tab-siparis-arsiv');
  if(aktifBtn)aktifBtn.classList.toggle('active',tab==='aktif');
  if(arsivBtn)arsivBtn.classList.toggle('active',tab==='arsiv');
  var e=document.getElementById('sp-f-durum');if(e)e.value='';
  renderSiparisler();
}
function switchFaturaTab(tab){
  faturaTab=tab;
  var aktifBtn=document.getElementById('tab-fatura-aktif');
  var arsivBtn=document.getElementById('tab-fatura-arsiv');
  if(aktifBtn)aktifBtn.classList.toggle('active',tab==='aktif');
  if(arsivBtn)arsivBtn.classList.toggle('active',tab==='arsiv');
  var e=document.getElementById('ft-f-durum');if(e)e.value='';
  renderFaturalar();
}

// ════ SİPARİŞLER — API ════
async function loadSiparisler(){
  try{
    var res=await apiGet('siparisler');
    state.siparisler=res.siparisler||[];
  }catch(e){
    toast(e.message||'Siparişler yüklenemedi.','error');
    state.siparisler=state.siparisler||[];
  }
  renderSiparisler();
}
async function updateSiparisDurum(siparisId,changes){
  var idx=state.siparisler.findIndex(function(x){return x.id===siparisId;});
  if(idx<0)return null;
  try{
    var res=await apiPut('siparisler',Object.assign({},state.siparisler[idx],changes,{id:siparisId}));
    state.siparisler[idx]=res.siparis;
    return res.siparis;
  }catch(e){
    toast(e.message||'Sipariş güncellenemedi.','error');
    return null;
  }
}

async function quickSiparisDurumChange(sid,yeni){
  var idx=(state.siparisler||[]).findIndex(function(x){return x.id===sid;});
  if(idx<0)return;
  var tekId=state.siparisler[idx].teklifId;
  var oncekiDurum=state.siparisler[idx].durum;
  var updated=await updateSiparisDurum(sid,{durum:yeni});
  if(!updated)return;
  if(yeni==='İptal'&&tekId&&oncekiDurum!=='İptal'){
    var ti=state.teklifler.findIndex(function(x){return x.id===tekId;});
    if(ti>=0)state.teklifler[ti].durum='Reddedildi';
  }
  renderSiparisler();
  toast('Sipariş durumu: '+yeni,'success');
}

async function siparisGeriAl(sid){
  showConfirm('Sipariş "Hazırlanıyor" durumuna geri alınacak ve teslim edilen miktarlar sıfırlanacak. Onaylıyor musunuz?',async function(){
    var sp=(state.siparisler||[]).find(function(x){return x.id===sid;});
    if(!sp)return;
    var satirlarSifir=(sp.satirlar||[]).map(function(s){return Object.assign({},s,{gonderilen:0});});
    var updated=await updateSiparisDurum(sid,{durum:'Hazırlanıyor',satirlar:satirlarSifir});
    if(!updated)return;
    renderSiparisler();
    toast('Sipariş Hazırlanıyor durumuna alındı.','success');
  });
}

var SP_GECIS={
  'Hazırlanıyor':['Kısmi Teslimat','Teslim Edildi','İptal'],
  'Kısmi Teslimat':['Teslim Edildi','İptal'],
  'Teslim Edildi':[]
};
function showSiparisDurumMenu(sid,btnEl){
  document.querySelectorAll('.durum-quick-menu').forEach(function(m){m.remove();});
  var s=(state.siparisler||[]).find(function(x){return x.id===sid;});
  if(!s)return;
  var izinliDurumlar=SP_GECIS[s.durum];
  if(!izinliDurumlar||!izinliDurumlar.length)return;
  var menu=document.createElement('div');
  menu.className='durum-quick-menu';
  menu.style.cssText='position:fixed;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;z-index:600;min-width:170px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;';
  menu.innerHTML=izinliDurumlar.map(function(d){
    var isIptal=d==='İptal';
    return '<div onmousedown="event.stopPropagation();quickSiparisDurumChange(\''+sid+'\',\''+d+'\');document.querySelectorAll(\'.durum-quick-menu\').forEach(function(m){m.remove();});" style="padding:9px 14px;font-size:13px;cursor:pointer;color:'+(isIptal?'var(--red)':'var(--text2)')+'">'+d+'</div>';
  }).join('');
  document.body.appendChild(menu);
  var r=btnEl.getBoundingClientRect();
  menu.style.top=(r.bottom+2)+'px';
  menu.style.left=Math.max(8,r.right-170)+'px';
  setTimeout(function(){document.addEventListener('click',function _c(){menu.remove();document.removeEventListener('click',_c);});},10);
}

function showTeklifDurumMenu(tid,btnEl){
  document.querySelectorAll('.durum-quick-menu').forEach(function(m){m.remove();});
  var t=state.teklifler.find(function(x){return x.id===tid;});
  if(!t)return;
  var SATIS_DUR=['Reddedildi'];
  var SERVIS_DUR=['İletildi','Kabul Edildi','Reddedildi','Kapandı'];
  var durList=currentPortal==='satis'?SATIS_DUR:SERVIS_DUR;
  var menu=document.createElement('div');
  menu.className='durum-quick-menu';
  menu.style.cssText='position:fixed;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;z-index:600;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;';
  menu.innerHTML=durList.map(function(d){
    var active=d===t.durum;
    var needsReason=d==='Reddedildi'&&!active;
    var action=needsReason
      ?'document.querySelectorAll(\'.durum-quick-menu\').forEach(function(m){m.remove();});openRedNedenModal(\''+tid+'\',\''+d+'\');'
      :'changeTeklifDurum(\''+tid+'\',\''+d+'\');document.querySelectorAll(\'.durum-quick-menu\').forEach(function(m){m.remove();});';
    return '<div onmousedown="event.stopPropagation();'+action+'" style="padding:9px 14px;font-size:13px;cursor:pointer;'+(active?'background:var(--accent-soft);color:var(--accent);font-weight:600':'color:var(--text2)')+'">'+(active?'✓ ':'')+d+'</div>';
  }).join('');
  document.body.appendChild(menu);
  var r=btnEl.getBoundingClientRect();
  menu.style.top=(r.bottom+2)+'px';
  menu.style.left=Math.max(8,r.right-180)+'px';
  setTimeout(function(){document.addEventListener('click',function _c(){menu.remove();document.removeEventListener('click',_c);});},10);
}

function renderSiparisler(){
  var allData=state.siparisler||[];
  var aktifSayisi=allData.filter(function(s){return ARSIV_SIPARISLER.indexOf(s.durum)<0;}).length;
  var arsivSayisi=allData.filter(function(s){return ARSIV_SIPARISLER.indexOf(s.durum)>=0;}).length;
  var aktifEl=document.getElementById('tab-siparis-aktif-count');
  var arsivEl=document.getElementById('tab-siparis-arsiv-count');
  if(aktifEl)aktifEl.textContent=aktifSayisi;
  if(arsivEl)arsivEl.textContent=arsivSayisi;
  var isArsiv=siparisTab==='arsiv';
  var data=isArsiv
    ?allData.filter(function(s){return ARSIV_SIPARISLER.indexOf(s.durum)>=0;})
    :allData.filter(function(s){return ARSIV_SIPARISLER.indexOf(s.durum)<0;});
  var fK=(document.getElementById('sp-f-kurum')||{}).value||'';
  var fN=(document.getElementById('sp-f-no')||{}).value||'';
  var fD=(document.getElementById('sp-f-durum')||{}).value||'';
  var fTs=(document.getElementById('sp-f-ts')||{}).value||'';
  var fTe=(document.getElementById('sp-f-te')||{}).value||'';
  var filtered=data.filter(function(s){
    var tarih=s.siparisTarihi||s.teklifTarihi||(s.olusturmaTarihi||'').slice(0,10);
    return(!fK||(s.kurum||'').toLowerCase().includes(fK.toLowerCase()))
      &&(!fN||(s.siparisNo||'').toLowerCase().includes(fN.toLowerCase()))
      &&(!fD||s.durum===fD)
      &&(!fTs||tarih>=fTs)
      &&(!fTe||tarih<=fTe);
  });
  var cntEl=document.getElementById('siparis-filter-count');
  if(cntEl)cntEl.textContent=filtered.length+' kayıt';
  var tbody=document.getElementById('siparis-table-body');
  var emptyEl=document.getElementById('siparis-empty');
  if(!tbody)return;
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  var canBulk=isArsiv&&canEdit;
  if(!isArsiv) bulkClear('siparisArsiv');
  bulkSetVisible('siparisArsiv',filtered.map(function(s){return s.id;}));
  var thCheck=document.getElementById('th-siparis-check');
  if(thCheck){
    thCheck.style.display=canBulk?'':'none';
    var thCb=thCheck.querySelector('input');if(thCb)thCb.checked=canBulk&&bulkAllChecked('siparisArsiv');
  }
  var bulkBarEl=document.getElementById('siparis-bulk-bar');
  var bulkCountEl=document.getElementById('siparis-bulk-count');
  var selCount=canBulk?bulkCount('siparisArsiv'):0;
  if(bulkCountEl)bulkCountEl.textContent=selCount>0?selCount+' öğe seçildi':'';
  if(bulkBarEl)bulkBarEl.innerHTML=selCount>0
    ?'<button class="btn btn-danger btn-sm" onclick="confirmDeleteBulk(\'siparis\',bulkSelectedIds(\'siparisArsiv\'))"><i class="ti ti-trash"></i> Seçilenleri Sil</button>'
    :'';
  if(!filtered.length){tbody.innerHTML='';if(emptyEl)emptyEl.style.display='';renderPagination('siparis-pagination',1,0,'setSiparislerPage');return;}
  if(emptyEl)emptyEl.style.display='none';
  var newSPH=JSON.stringify([fK,fN,fD,fTs,fTe,siparisTab]);if(newSPH!==_siparisFilterHash){siparislerPage=1;_siparisFilterHash=newSPH;}
  var currency={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'};
  var sortedSp=filtered.sort(function(a,b){return new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi);});
  var pagedSp=sortedSp.slice((siparislerPage-1)*PAGE_SIZE,siparislerPage*PAGE_SIZE);
  renderPagination('siparis-pagination',siparislerPage,filtered.length,'setSiparislerPage');
  tbody.innerHTML=pagedSp.map(function(s){
    var toplam=(s.satirlar||[]).reduce(function(a,i){return a+i.miktar*i.birimFiyat;},0);
    var cur=currency[s.paraBirimi||'TRY']||'₺';
    return '<tr>'
      +(canBulk?'<td><input type="checkbox" '+(bulkIsChecked('siparisArsiv',s.id)?'checked':'')+' onchange="bulkToggleRow(\'siparisArsiv\',\''+s.id+'\',\'renderSiparisler\')"></td>':'')
      +'<td><span class="kn-badge">'+esc(s.siparisNo)+'</span></td>'
      +'<td class="td-mono" style="color:var(--text2)">'+fmtDate(s.siparisTarihi||s.teklifTarihi||s.olusturmaTarihi)+'</td>'
      +'<td style="font-weight:500;max-width:220px;white-space:normal;word-break:break-word">'+esc(s.kurum||'—')+'</td>'
      +'<td style="font-family:DM Mono,monospace;color:var(--amber)">'+esc(cur)+' '+fmtNum(toplam)+'</td>'
      +'<td><span class="badge '+(SP_DURUM_CSS[s.durum]||'badge-sf')+'">'+esc(s.durum)+'</span></td>'
      +'<td style="font-size:12px;color:var(--text3)">'+esc(s.satisTemsilcisi||s.sorumlu||'—')+'</td>'
      +'<td style="text-align:right"><div class="action-row">'
      +'<button class="btn-icon" title="Detay" style="color:var(--accent)" onclick="openSiparisDetay(\''+s.id+'\')"><i class="ti ti-info-circle"></i></button>'
      +(ARSIV_SIPARISLER.indexOf(s.durum)<0?'<button class="btn-icon" title="Sipariş Formu Yazdır" style="color:var(--teal)" onclick="printSiparisUretimFormu(\''+s.id+'\')"><i class="ti ti-printer"></i></button>':'')
      +(canEdit&&['Hazırlanıyor','Kısmi Teslimat'].indexOf(s.durum)>=0
        ?'<button class="btn-icon" title="Teslimat Gir" style="color:var(--teal)" onclick="openKismiTeslim(\''+s.id+'\')"><i class="ti ti-truck-delivery"></i></button>'
        :'')
      +(canEdit&&ARSIV_SIPARISLER.indexOf(s.durum)<0?'<button class="btn-icon" title="Faturaya Aktar" style="color:var(--amber)" onclick="openFaturaModal(\''+s.id+'\')"><i class="ti ti-file-invoice"></i></button>':'')
      +(canEdit&&(s.durum==='Kısmi Teslimat'||s.durum==='Teslim Edildi')?'<button class="btn-icon" title="İşlemi Geri Al" style="color:var(--text3)" onclick="siparisGeriAl(\''+s.id+'\')">↩</button>':'')
      +(canEdit&&SP_GECIS[s.durum]&&SP_GECIS[s.durum].length?'<button class="btn-icon" title="Durum Değiştir" style="color:var(--accent)" onclick="showSiparisDurumMenu(\''+s.id+'\',this)"><i class="ti ti-loader"></i></button>':'')
      +(canEdit?'<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete(\'siparis\',\''+s.id+'\')"><i class="ti ti-trash"></i></button>':'')
      +'</div></td>'
      +'</tr>';
  }).join('');
}


// ════ FATURA & KISMİ TESLİM ════
var _activeFaturaSpId='';
var _activeKismiSpId='';

function openFaturaModal(sipId){
  _activeFaturaSpId=sipId;
  var sp=(state.siparisler||[]).find(function(x){return x.id===sipId;});
  var el_fn=document.getElementById('fm-faturaNo');
  var el_ft=document.getElementById('fm-faturaTarihi');
  var el_vt=document.getElementById('fm-vadeTarihi');
  if(el_fn)el_fn.value='';
  if(el_ft)el_ft.value=today();
  if(el_vt)el_vt.value='';
  if(!sp)return;
  var cur={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'}[sp.paraBirimi||'TRY']||'₺';
  var ozetEl=document.getElementById('sp-fatura-ozet');
  if(ozetEl)ozetEl.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:10px">'
    +'<div><div style="font-size:10px;color:var(--text3);letter-spacing:.05em">SİPARİŞ</div><div style="font-weight:600">'+esc(sp.siparisNo)+'</div></div>'
    +'<div style="flex:1"><div style="font-size:10px;color:var(--text3);letter-spacing:.05em">MÜŞTERİ</div><div style="font-weight:500">'+esc(sp.kurum||'')+'</div></div>'
    +'</div>'
    +(sp.durum==='Hazırlanıyor'?'<div style="font-size:11px;color:var(--amber);margin-bottom:10px;padding:6px 10px;background:rgba(var(--amber-rgb,245,158,11),0.1);border-radius:6px">⚠ Ürün henüz gönderilmedi — ön fatura oluşturuluyor</div>':'')
    +'<table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:4px">'
    +'<thead><tr style="border-bottom:1px solid var(--border)"><th style="text-align:left;padding:4px 6px;color:var(--text3)">Kalem</th><th style="text-align:center;padding:4px 6px;color:var(--text3)">Sipariş</th><th style="text-align:center;padding:4px 6px;color:var(--text3)">Fatural.</th><th style="text-align:center;padding:4px 6px;color:var(--text3)">Kalan</th><th style="text-align:center;padding:4px 6px;color:var(--text3)">Bu Fatura</th></tr></thead>'
    +'<tbody>'+(sp.satirlar||[]).map(function(k,i){
      var faturalanan=k.faturalanan||0;
      var kalan=k.miktar-faturalanan;
      var sp2=k.seciliParametreler||[];
      var base=sp2.length?(k._baseAciklama||(k.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim()):k.aciklama||'';
      return '<tr style="border-bottom:1px solid var(--border)">'
        +'<td style="padding:5px 6px">'+esc(base)+'</td>'
        +'<td style="text-align:center;padding:5px 6px">'+k.miktar+' '+esc(k.birim||'Adet')+'</td>'
        +'<td style="text-align:center;padding:5px 6px;color:var(--text3)">'+faturalanan+'</td>'
        +'<td style="text-align:center;padding:5px 6px;color:'+(kalan>0?'var(--amber)':'var(--text3)')+'">'+kalan+'</td>'
        +'<td style="text-align:center;padding:5px 6px">'
        +(kalan>0?'<input type="number" id="fm-fat-'+i+'" min="0" max="'+kalan+'" value="'+kalan+'" step="0.001" style="width:70px;padding:3px 6px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:12px" oninput="updateFaturaModalToplam()">':'<span style="color:var(--green)">✓</span>')
        +'</td>'
        +'</tr>';
    }).join('')+'</tbody></table>'
    +'<div style="text-align:right;font-size:12px;color:var(--text3);margin-top:4px">Bu fatura toplamı: <b id="fm-fat-toplam" style="color:var(--amber)">'+cur+' 0</b></div>';
  openModal('modal-fatura');
  // Başlangıç toplamını hesapla
  updateFaturaModalToplam();
}

function updateFaturaModalToplam(){
  var sp=(state.siparisler||[]).find(function(x){return x.id===_activeFaturaSpId;});
  if(!sp)return;
  var cur={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'}[sp.paraBirimi||'TRY']||'₺';
  var toplam=0;
  (sp.satirlar||[]).forEach(function(k,i){
    var inp=document.getElementById('fm-fat-'+i);
    if(!inp)return;
    toplam+=(parseFloat(inp.value)||0)*(k.birimFiyat||0);
  });
  var el=document.getElementById('fm-fat-toplam');
  if(el)el.textContent=cur+' '+fmtNum(toplam);
}

async function saveFatura(){
  var fatNo=(document.getElementById('fm-faturaNo')||{}).value||'';
  var fatTar=(document.getElementById('fm-faturaTarihi')||{}).value||'';
  if(!fatNo||!fatTar){toast('Fatura No ve Tarih zorunludur.','error');return;}
  var sp=(state.siparisler||[]).find(function(x){return x.id===_activeFaturaSpId;});
  if(!sp)return;
  // Her kalem için faturalanacak miktarları topla
  var satirFaturalananlar=(sp.satirlar||[]).map(function(k,i){
    var inp=document.getElementById('fm-fat-'+i);
    return inp?parseFloat(inp.value)||0:0;
  });
  var payload={
    siparisId:sp.id,faturaNo:fatNo,faturaTarihi:fatTar,
    vadeTarihi:(document.getElementById('fm-vadeTarihi')||{}).value||'',
    satirFaturalananlar:satirFaturalananlar
  };
  var res;
  try{
    res=await apiPost('faturalar',payload);
  }catch(e){
    toast(e.message||'Fatura oluşturulamadı.','error');
    return;
  }
  if(!state.faturalar)state.faturalar=[];
  state.faturalar.push(res.fatura);
  // Siparişi yeniden yükle (faturalanan + durum güncellenmiş olabilir)
  var siRes=await apiGet('siparisler');
  if(siRes&&siRes.siparisler)state.siparisler=siRes.siparisler;
  closeModal('modal-fatura');
  renderSiparisler();renderFaturalar();
  toast('Fatura oluşturuldu: '+fatNo,'success');
}

function openKismiTeslim(sipId){
  _activeKismiSpId=sipId;
  var sp=(state.siparisler||[]).find(function(x){return x.id===sipId;});
  if(!sp)return;
  var ktEl=document.getElementById('kt-kalemler');
  if(!ktEl)return;
  ktEl.innerHTML=(sp.satirlar||[]).map(function(k,i){
    var gonderilen=k.gonderilen||0;
    var kalan=k.miktar-gonderilen;
    var ksp=k.seciliParametreler||[];
    var kBase=ksp.length?(k._baseAciklama||(k.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim()):k.aciklama||'';
    var kpHtml=ksp.length?'<div style="font-size:11px;color:rgb(143,164,176);margin-top:2px;line-height:1.4">('+ksp.map(function(p){return esc(typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad));}).join(', ')+')</div>':'';
    return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:13px;font-weight:500;margin-bottom:6px">'+esc(kBase)+kpHtml+'</div>'
      +'<div style="display:flex;gap:12px;font-size:12px;color:var(--text3);margin-bottom:6px">'
      +'<span>Toplam: <b style="color:var(--text)">'+k.miktar+' '+esc(k.birim||'Adet')+'</b></span>'
      +'<span>Gönderilen: <b style="color:var(--green)">'+gonderilen+'</b></span>'
      +'<span>Kalan: <b style="color:var(--amber)">'+kalan+'</b></span></div>'
      +(kalan>0?'<div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--text2)">Bu Sevkiyat:</label><input type="number" id="kt-miktar-'+i+'" min="0" max="'+kalan+'" value="0" style="width:80px;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px"></div>':'<div style="font-size:12px;color:var(--green)">✓ Tamamen gönderildi</div>')
      +'</div>';
  }).join('');
  openModal('modal-kismiteslim');
}

async function saveKismiTeslim(){
  var sp=(state.siparisler||[]).find(function(x){return x.id===_activeKismiSpId;});
  if(!sp)return;
  var tamam=true;
  (sp.satirlar||[]).forEach(function(k,i){
    var inp=document.getElementById('kt-miktar-'+i);
    if(!inp)return;
    var miktar=parseInt(inp.value)||0;
    if(miktar>0){
      k.gonderilen=(k.gonderilen||0)+miktar;
      if(k.gonderilen<k.miktar)tamam=false;
    } else if((k.gonderilen||0)<k.miktar){
      tamam=false;
    }
  });
  var updated=await updateSiparisDurum(_activeKismiSpId,{satirlar:sp.satirlar,durum:tamam?'Teslim Edildi':'Kısmi Teslimat'});
  if(!updated)return;
  // Siparişi yeniden yükle — API otomatik Fatura Edildi'ye çekmiş olabilir
  var siRes=await apiGet('siparisler');
  if(siRes&&siRes.siparisler)state.siparisler=siRes.siparisler;
  closeModal('modal-kismiteslim');
  renderSiparisler();
  toast(tamam?'Tüm kalemler teslim edildi.':'Kısmi teslimat kaydedildi.','success');
}

async function loadFaturalar(){
  try{
    var res=await apiGet('faturalar');
    state.faturalar=res.faturalar||[];
  }catch(e){
    toast(e.message||'Faturalar yüklenemedi.','error');
    state.faturalar=state.faturalar||[];
  }
  renderFaturalar();
}

function renderFaturalar(){
  var allData=state.faturalar||[];
  var aktifSayisi=allData.filter(function(f){return ARSIV_FATURALAR.indexOf(f.durum)<0;}).length;
  var arsivSayisi=allData.filter(function(f){return ARSIV_FATURALAR.indexOf(f.durum)>=0;}).length;
  var aktifEl=document.getElementById('tab-fatura-aktif-count');
  var arsivEl=document.getElementById('tab-fatura-arsiv-count');
  if(aktifEl)aktifEl.textContent=aktifSayisi;
  if(arsivEl)arsivEl.textContent=arsivSayisi;
  var isArsiv=faturaTab==='arsiv';
  var data=isArsiv
    ?allData.filter(function(f){return ARSIV_FATURALAR.indexOf(f.durum)>=0;})
    :allData.filter(function(f){return ARSIV_FATURALAR.indexOf(f.durum)<0;});
  var fK=(document.getElementById('ft-f-kurum')||{}).value||'';
  var fN=(document.getElementById('ft-f-no')||{}).value||'';
  var fD=(document.getElementById('ft-f-durum')||{}).value||'';
  var fTs=(document.getElementById('ft-f-ts')||{}).value||'';
  var fTe=(document.getElementById('ft-f-te')||{}).value||'';
  var filtered=data.filter(function(f){
    return(!fK||(f.kurum||'').toLowerCase().includes(fK.toLowerCase()))
      &&(!fN||(f.faturaNo||'').toLowerCase().includes(fN.toLowerCase()))
      &&(!fD||f.durum===fD)
      &&(!fTs||(f.faturaTarihi||'')>=fTs)
      &&(!fTe||(f.faturaTarihi||'')<=fTe);
  });
  var cntEl=document.getElementById('fatura-filter-count');
  if(cntEl)cntEl.textContent=filtered.length+' kayıt';
  var today_ms=new Date().getTime();
  var tbody=document.getElementById('fatura-table-body');
  if(!tbody)return;
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  var canBulk=isArsiv&&canEdit;
  if(!isArsiv) bulkClear('faturaArsiv');
  bulkSetVisible('faturaArsiv',filtered.map(function(f){return f.id;}));
  var thCheck=document.getElementById('th-fatura-check');
  if(thCheck){
    thCheck.style.display=canBulk?'':'none';
    var thCb=thCheck.querySelector('input');if(thCb)thCb.checked=canBulk&&bulkAllChecked('faturaArsiv');
  }
  var bulkBarEl=document.getElementById('fatura-bulk-bar');
  var bulkCountEl=document.getElementById('fatura-bulk-count');
  var selCount=canBulk?bulkCount('faturaArsiv'):0;
  if(bulkCountEl)bulkCountEl.textContent=selCount>0?selCount+' öğe seçildi':'';
  if(bulkBarEl)bulkBarEl.innerHTML=selCount>0
    ?'<button class="btn btn-danger btn-sm" onclick="confirmDeleteBulk(\'fatura\',bulkSelectedIds(\'faturaArsiv\'))"><i class="ti ti-trash"></i> Seçilenleri Sil</button>'
    :'';
  if(!filtered.length){tbody.innerHTML='';document.getElementById('fatura-empty').style.display='';renderPagination('fatura-pagination',1,0,'setFaturalarPage');return;}
  document.getElementById('fatura-empty').style.display='none';
  var newFH=JSON.stringify([fK,fN,fD,fTs,fTe,faturaTab]);if(newFH!==_faturaFilterHash){faturalarPage=1;_faturaFilterHash=newFH;}
  var currency={TRY:'₺',USD:'$',EUR:'€',GBP:'£'};
  var sortedFt=[...filtered].sort(function(a,b){return new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi);});
  var pagedFt=sortedFt.slice((faturalarPage-1)*PAGE_SIZE,faturalarPage*PAGE_SIZE);
  renderPagination('fatura-pagination',faturalarPage,filtered.length,'setFaturalarPage');
  tbody.innerHTML=pagedFt.map(function(f){
    var vadeDate=f.vadeTarihi?new Date(f.vadeTarihi):null;
    var vadeWarn=(vadeDate&&!isNaN(vadeDate)&&vadeDate.getTime()<today_ms&&f.durum==='Ödenmedi')?' <span style="color:var(--red);font-size:10px">⚠ Gecikmiş</span>':'';
    var cur=currency[f.paraBirimi||'TRY']||'₺';
    return '<tr>'
      +(canBulk?'<td><input type="checkbox" '+(bulkIsChecked('faturaArsiv',f.id)?'checked':'')+' onchange="bulkToggleRow(\'faturaArsiv\',\''+f.id+'\',\'renderFaturalar\')"></td>':'')
      +'<td><span class="kn-badge">'+esc(f.faturaNo)+'</span></td>'
      +'<td><span class="kn-badge" style="color:var(--teal)">'+esc(f.siparisNo)+'</span></td>'
      +'<td style="font-weight:500">'+esc(f.kurum||'—')+'</td>'
      +'<td style="font-family:DM Mono,monospace;color:var(--amber)">'+cur+' '+fmtNum(f.tutar)+'</td>'
      +'<td class="td-mono">'+esc(f.faturaTarihi||'—')+'</td>'
      +'<td class="td-mono">'+esc(f.vadeTarihi||'—')+vadeWarn+'</td>'
      +'<td><span class="badge '+(f.durum==='Ödendi'?'badge-onaylandi':'badge-reddedildi')+'">'+f.durum+'</span></td>'
      +'<td style="text-align:right"><div class="action-row">'
      +(canEdit?'<button class="btn-icon" title="Düzenle" onclick="openFaturaDuzenle(\''+f.id+'\')"><i class="ti ti-edit" style="color:var(--accent)"></i></button>':'')
      +(canEdit&&f.durum!=='Ödendi'?'<button class="btn-icon" style="color:var(--green)" onclick="markFaturaOdendi(\''+f.id+'\')" title="Ödendi İşaretle"><i class="ti ti-check"></i></button>':'')
      +(canEdit&&f.durum==='Ödendi'?'<button class="btn-icon" style="color:var(--text3)" onclick="markFaturaOdenmedi(\''+f.id+'\')" title="Ödenmedi olarak geri al">↩</button>':'')
      +(canEdit?'<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete(\'fatura\',\''+f.id+'\')"><i class="ti ti-trash"></i></button>':'')
      +'</div></td>'
      +'</tr>';
  }).join('');
}

function clearSiparisFilters(){
  ['sp-f-kurum','sp-f-no','sp-f-ts','sp-f-te'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  var e=document.getElementById('sp-f-durum');if(e)e.value='';
  syncCustomSelectLabels();
  renderSiparisler();
}
function clearFaturaFilters(){
  ['ft-f-kurum','ft-f-no','ft-f-ts','ft-f-te'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  var e=document.getElementById('ft-f-durum');if(e)e.value='';
  syncCustomSelectLabels();
  renderFaturalar();
}
async function updateFaturaDurum(faturaId,changes){
  var idx=state.faturalar.findIndex(function(x){return x.id===faturaId;});
  if(idx<0)return null;
  try{
    var res=await apiPut('faturalar',Object.assign({},state.faturalar[idx],changes,{id:faturaId}));
    state.faturalar[idx]=res.fatura;
    return res.fatura;
  }catch(e){
    toast(e.message||'Fatura güncellenemedi.','error');
    return null;
  }
}
async function markFaturaOdendi(fid){
  var updated=await updateFaturaDurum(fid,{durum:'Ödendi'});
  if(!updated)return;
  renderFaturalar();
  toast('Fatura ödendi olarak işaretlendi.','success');
}
async function markFaturaOdenmedi(fid){
  var updated=await updateFaturaDurum(fid,{durum:'Ödenmedi'});
  if(!updated)return;
  renderFaturalar();
  toast('Fatura ödenmedi olarak geri alındı.','info');
}
var _editFaturaId='';
function openFaturaDuzenle(fatId){
  var f=(state.faturalar||[]).find(function(x){return x.id===fatId;});
  if(!f)return;
  _editFaturaId=fatId;
  var el_id=document.getElementById('fe-fatura-id');if(el_id)el_id.value=fatId;
  var el_no=document.getElementById('fe-faturaNo');if(el_no)el_no.value=f.faturaNo||'';
  var el_ft=document.getElementById('fe-faturaTarihi');if(el_ft)el_ft.value=f.faturaTarihi||'';
  var el_vt=document.getElementById('fe-vadeTarihi');if(el_vt)el_vt.value=f.vadeTarihi||'';
  openModal('modal-fatura-edit');
}
async function saveFaturaDuzenle(){
  var fatNo=(document.getElementById('fe-faturaNo')||{}).value||'';
  var fatTar=(document.getElementById('fe-faturaTarihi')||{}).value||'';
  if(!fatNo||!fatTar){toast('Fatura No ve Tarih zorunludur.','error');return;}
  var vadeTar=(document.getElementById('fe-vadeTarihi')||{}).value||'';
  var updated=await updateFaturaDurum(_editFaturaId,{faturaNo:fatNo,faturaTarihi:fatTar,vadeTarihi:vadeTar});
  if(!updated)return;
  closeModal('modal-fatura-edit');
  renderFaturalar();
  toast('Fatura güncellendi.','success');
}



// ════ SİPARİŞ FORMU ════
function goSiparisForm(teklifId){
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  document.getElementById('sf2-teklif-id').value=teklifId;
  document.getElementById('sf2-teklif-no').value=t.teklifNo||'';
  document.getElementById('sf2-kurum').value=t.kurum||'';
  document.getElementById('sf2-sorumlu').value=t.sorumlu||state.currentUser?.ad||'';
  document.getElementById('sf2-tarih').value=today();
  document.getElementById('sf2-teslimat').value=t.teslimat||'';
  document.getElementById('sf2-notlar').value=t.notlar||'';
  var cur={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'}[t.paraBirimi||'TRY']||'₺';
  var toplam=0;
  var itemsHtml=(t.satirlar||[]).map(function(s){
    var satir=s.miktar*(s.birimFiyat||0);toplam+=satir;
    var sp=s.seciliParametreler||[];
    var sBase=sp.length?(s._baseAciklama||(s.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim()):s.aciklama||'';
    var pHtml=sp.length?'<div style="font-size:11px;color:rgb(143,164,176);margin-top:2px;line-height:1.4">('+sp.map(function(p){return esc(typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad));}).join(', ')+')</div>':'';
    return '<tr><td style="padding:6px 8px;font-size:13px">'+esc(sBase)+pHtml+'</td>'
      +'<td style="padding:6px 8px;font-size:12px;text-align:center">'+s.miktar+' '+esc(s.birim||'Adet')+'</td>'
      +'<td style="padding:6px 8px;font-size:12px;text-align:right">'+cur+' '+fmtNum(s.birimFiyat||0)+'</td>'
      +'<td style="padding:6px 8px;font-size:12px;text-align:right;color:var(--amber)">'+cur+' '+fmtNum(satir)+'</td>'
      +'</tr>';
  }).join('');
  var infoEl=document.getElementById('sf2-items-body');if(infoEl)infoEl.innerHTML=itemsHtml;
  var totalEl=document.getElementById('sf2-items-total');if(totalEl)totalEl.textContent=cur+' '+fmtNum(toplam);
  var opEl=document.getElementById('sf2-odeme-info');
  if(opEl)opEl.textContent=(t.odemeKosulu||'')+(t.vade?' · Vade: '+t.vade:'');
  showPage('siparis-form',true);
}

async function saveSiparisForm(){
  var teklifId=document.getElementById('sf2-teklif-id').value;
  var tarih=document.getElementById('sf2-tarih').value;
  if(!tarih){toast('Sipariş tarihi zorunludur.','error');return;}
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  var satirlar=(t.satirlar||[]).map(function(s){return Object.assign({},s,{gonderilen:0});});
  var payload={
    teklifId:t.id,teklifNo:t.teklifNo,
    kurum:t.kurum||'',ilgiliKisi:t.ilgiliKisi||'',telefon:t.telefon||'',email:t.email||'',
    sorumlu:t.sorumlu||state.currentUser?.ad||'',satisTemsilcisi:t.sorumlu||state.currentUser?.ad||'',
    satirlar:satirlar,paraBirimi:t.paraBirimi||'TRY',
    odemeKosulu:t.odemeKosulu||'',vade:t.vade||'',teslimat:t.teslimat||'',
    teklifTarihi:t.teklifTarihi||'',siparisTarihi:tarih,
    tahminTeslimat:document.getElementById('sf2-teslimat').value||'',
    notlar:document.getElementById('sf2-notlar').value||''
  };
  var res;
  try{
    res=await apiPost('siparisler',payload);
  }catch(e){
    toast(e.message||'Sipariş oluşturulamadı.','error');
    return;
  }
  if(!state.siparisler)state.siparisler=[];
  state.siparisler.push(res.siparis);
  var ti=state.teklifler.findIndex(function(x){return x.id===teklifId;});
  if(ti>=0)state.teklifler[ti].durum='Siparişe Dönüştü';
  toast('Sipariş oluşturuldu: '+res.siparis.siparisNo,'success');
  showPage('siparisler');
}

var _activeSiparisDetayId='';
function openSiparisDetay(sipId){
  var s=(state.siparisler||[]).find(function(x){return x.id===sipId;});
  if(!s)return;
  _activeSiparisDetayId=sipId;
  var _pb=document.getElementById('sp-detay-print-btn');
  if(_pb)_pb.style.display=ARSIV_SIPARISLER.indexOf(s.durum)>=0?'none':'';
  var cur={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'}[s.paraBirimi||'TRY']||'₺';
  var toplam=0;
  var rowsHtml=(s.satirlar||[]).map(function(k){
    var gonderilen=k.gonderilen||0;var kalan=k.miktar-gonderilen;
    var satir=k.miktar*(k.birimFiyat||0);toplam+=satir;
    var rsp=k.seciliParametreler||[];
    var rBase=rsp.length?(k._baseAciklama||(k.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim())||'—':k.aciklama||'—';
    var rpHtml=rsp.length?'<div style="font-size:11px;color:rgb(143,164,176);margin-top:2px;line-height:1.4">('+rsp.map(function(p){return esc(typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad));}).join(', ')+')</div>':'';
    return '<tr>'
      +'<td style="padding:7px 9px;font-size:13px">'+esc(rBase)+rpHtml+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:center">'+k.miktar+' '+esc(k.birim||'')+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:center;color:var(--green)">'+gonderilen+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:center;color:'+(kalan>0?'var(--amber)':'var(--text3)')+'">'+kalan+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:right">'+cur+' '+fmtNum(k.birimFiyat||0)+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:right;color:var(--amber)">'+cur+' '+fmtNum(satir)+'</td>'
      +'</tr>';
  }).join('');
  var infoParts='';
  if(s.odemeKosulu)infoParts+='<div class="info-item"><div class="info-item-label">Ödeme Koşulu</div><div class="info-item-val">'+esc(s.odemeKosulu)+'</div></div>';
  if(s.vade)infoParts+='<div class="info-item"><div class="info-item-label">Vade</div><div class="info-item-val">'+esc(s.vade)+'</div></div>';
  if(s.tahminTeslimat)infoParts+='<div class="info-item"><div class="info-item-label">Tahmini Teslimat</div><div class="info-item-val td-mono">'+fmtDate(s.tahminTeslimat)+'</div></div>';
  if(s.satisTemsilcisi||s.sorumlu)infoParts+='<div class="info-item"><div class="info-item-label">Satış Temsilcisi</div><div class="info-item-val">'+esc(s.satisTemsilcisi||s.sorumlu||'')+'</div></div>';
  var el=document.getElementById('sp-detay-body');if(!el)return;
  el.innerHTML=
    '<div class="info-grid" style="margin-bottom:14px">'
    +'<div class="info-item"><div class="info-item-label">Sipariş No</div><div class="info-item-val"><span class="kn-badge">'+esc(s.siparisNo)+'</span></div></div>'
    +(s.teklifNo?'<div class="info-item"><div class="info-item-label">Teklif No</div><div class="info-item-val"><span class="kn-badge" style="color:var(--accent)">'+esc(s.teklifNo)+'</span></div></div>':'')
    +'<div class="info-item"><div class="info-item-label">Kurum</div><div class="info-item-val" style="font-weight:600">'+esc(s.kurum||'—')+'</div></div>'
    +'<div class="info-item"><div class="info-item-label">Sipariş Tarihi</div><div class="info-item-val td-mono">'+fmtDate(s.siparisTarihi||s.olusturmaTarihi)+'</div></div>'
    +infoParts
    +'</div>'
    +'<table style="width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:var(--radius-sm);overflow:hidden;margin-bottom:14px">'
    +'<thead><tr style="background:var(--bg3)">'
    +'<th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:left">ÜRÜN / HİZMET</th>'
    +'<th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:center">MİKTAR</th>'
    +'<th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:center">GÖNDERİLEN</th>'
    +'<th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:center">KALAN</th>'
    +'<th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:right">BİRİM F.</th>'
    +'<th style="padding:7px 9px;font-size:10px;color:var(--text3);text-align:right">TOPLAM</th>'
    +'</tr></thead><tbody>'+rowsHtml+'</tbody></table>'
    +'<div style="text-align:right;margin-bottom:'+(s.notlar?'14':'4')+'px">'
    +'<div style="display:inline-block;background:var(--bg3);border-radius:var(--radius-sm);padding:10px 16px">'
    +'<div style="font-size:11px;color:var(--text3);margin-bottom:3px">TOPLAM</div>'
    +'<div style="font-size:17px;font-weight:700;color:var(--amber)">'+cur+' '+fmtNum(toplam)+'</div>'
    +'</div></div>'
    +(s.notlar?'<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:11px 14px;font-size:13px;color:var(--text2)">'+esc(s.notlar)+'</div>':'');
  document.getElementById('sp-detay-title').textContent=s.siparisNo+' — Detay';
  openModal('modal-siparis-detay');
}


// ════ ÜRETİM SİPARİŞ FORMU PDF ════
function printSiparisUretimFormu(sipId){
  const s=(state.siparisler||[]).find(x=>x.id===sipId);
  if(!s)return;
  const logoImg=new Image();
  logoImg.onload=function(){
    const cv=document.createElement('canvas');cv.width=534;cv.height=252;
    cv.getContext('2d').drawImage(logoImg,0,0,534,252);
    _generateUretimFormPDF(s,cv.toDataURL('image/png'));
  };
  logoImg.onerror=function(){_generateUretimFormPDF(s,null);};
  logoImg.src='brand_assets/logo_if_bg_white.svg';
}

async function _generateUretimFormPDF(s,logoPngDataUrl){
  const toB64=buf=>{const b=new Uint8Array(buf);let r='';for(let i=0;i<b.byteLength;i++)r+=String.fromCharCode(b[i]);return btoa(r);};
  const [regularBuf,boldBuf]=await Promise.all([
    fetch('fonts/Arial.ttf').then(r=>r.arrayBuffer()),
    fetch('fonts/Arial_Bold.ttf').then(r=>r.arrayBuffer())
  ]);
  const fmtD=d=>{if(!d)return '—';const p=(d||'').split('-');return p.length===3?p[2]+'.'+p[1]+'.'+p[0]:d;};

  const C={
    primary:[29,125,149],textDark:[26,46,59],textMid:[46,64,80],
    textLight:[143,164,176],textLabel:[74,96,112],
    border:[194,208,216],tableBg:[228,245,249],boxBg:[247,249,250],white:[255,255,255]
  };
  const mm=v=>v*2.83465;
  const pageW=mm(210),pageH=mm(297);

  const {jsPDF}=window.jspdf;
  const doc=new jsPDF({orientation:'portrait',unit:'pt',format:'a4'});
  doc.addFileToVFS('Arial.ttf',toB64(regularBuf));
  doc.addFont('Arial.ttf','Arial','normal');
  doc.addFileToVFS('Arial_Bold.ttf',toB64(boldBuf));
  doc.addFont('Arial_Bold.ttf','Arial','bold');
  doc.setFont('Arial');doc.setCharSpace(0);

  // ── LOGO ──
  if(logoPngDataUrl){try{doc.addImage(logoPngDataUrl,'PNG',mm(19.812),mm(9.737),mm(39.793),mm(19.389),'','FAST');}catch(e){}}

  doc.setDrawColor(...C.border);doc.setLineWidth(0.75);
  doc.line(mm(63.765),mm(11.642),mm(63.765),mm(25.517));

  const st=state.settings||{};
  doc.setFontSize(9);doc.setFont('Arial','bold');doc.setTextColor(...C.textMid);
  doc.text(st.firma||'Egefe Bilişim Sağlık San. ve Tic. A.Ş.',mm(68.457),mm(11.188)+9);
  doc.setFontSize(8);doc.setFont('Arial','normal');doc.setTextColor(...C.textLight);
  doc.text(st.adres||'Harbiye Mah. Hürriyet Cad. No:7/12 Çankaya / Ankara',mm(68.457),mm(16.829)+6);
  const vergiText=st.vergiDairesi&&st.vergiNo?`${st.vergiDairesi} Vergi Dairesi: ${st.vergiNo}`:'Başkent Vergi Dairesi: 5590520620';
  doc.text(vergiText,mm(68.457),mm(21.192)+6);
  doc.text(st.web||'www.ege-fe.com',mm(68.457),mm(25.555)+6);

  // ── PRİMARY ÇİZGİ ──
  doc.setDrawColor(...C.primary);doc.setLineWidth(2);
  doc.line(mm(15.446),mm(33.955),mm(194.556),mm(33.955));

  // ── BAŞLIK (sağ) ──
  doc.setFontSize(14);doc.setFont('Arial','bold');doc.setTextColor(...C.textMid);
  doc.text('SİPARİŞ FORMU',mm(194.556),mm(42.395)+11,{align:'right'});

  // ── SİPARİŞ BİLGİLERİ (sağ) ──
  const rx1=mm(141.66),rx2=mm(165.354),rx3=mm(171.249);
  doc.setFontSize(8);
  doc.setFont('Arial','bold');doc.setTextColor(...C.textMid);
  doc.text('Sipariş No',rx1,mm(50.611)+6);doc.text(':',rx2,mm(50.611)+6);
  doc.setFont('Arial','normal');doc.text(s.siparisNo||'-',rx3,mm(50.611)+6);

  doc.setFont('Arial','bold');doc.text('Sipariş Tarihi',rx1,mm(55.109)+6);doc.text(':',rx2,mm(55.109)+6);
  doc.setFont('Arial','normal');doc.text(fmtD(s.siparisTarihi||(s.olusturmaTarihi||'').slice(0,10)),rx3,mm(55.109)+6);

  if(s.tahminTeslimat){
    doc.setFont('Arial','bold');doc.text('Tahmini Teslimat',rx1,mm(59.58)+6);doc.text(':',rx2,mm(59.58)+6);
    doc.setFont('Arial','normal');doc.text(fmtD(s.tahminTeslimat),rx3,mm(59.58)+6);
  }

  // ── MÜŞTERİ BİLGİLERİ (sol) ──
  const lx1=mm(15.446),lx2=mm(41.228),lx3=mm(44.126);
  const _slMaxW=mm(93),_slRGap=mm(4.291),_slLh8=8*1.15;
  let _scurY=mm(42.774)+6;
  const _smRec=(state.musteriler||[]).find(function(m){return m.kurum===s.kurum;});

  // Kurum Adı — wrap long names
  doc.setFont('Arial','bold');doc.setTextColor(...C.textMid);
  doc.text('Kurum Adı',lx1,_scurY);doc.text(':',lx2,_scurY);
  doc.setFont('Arial','normal');
  const _skurumLines=doc.splitTextToSize(s.kurum||'',_slMaxW);
  doc.text(_skurumLines,lx3,_scurY);
  _scurY+=(_skurumLines.length-1)*_slLh8+_slRGap;

  // Adres + Şehir
  const _sAdresParts=[(_smRec&&_smRec.adres)||'',(_smRec&&_smRec.sehir)||''].filter(Boolean);
  const _sAdresVal=_sAdresParts.join(', ');
  doc.setFont('Arial','bold');doc.text('Adres',lx1,_scurY);doc.text(':',lx2,_scurY);
  doc.setFont('Arial','normal');
  if(_sAdresVal){
    const _sAdresLines=doc.splitTextToSize(_sAdresVal,_slMaxW);
    doc.text(_sAdresLines,lx3,_scurY);
    _scurY+=(_sAdresLines.length-1)*_slLh8+_slRGap;
  } else { _scurY+=_slRGap; }

  // İlgili Kişi
  doc.setFont('Arial','bold');doc.text('İlgili Kişi',lx1,_scurY);doc.text(':',lx2,_scurY);
  doc.setFont('Arial','normal');doc.text(s.ilgiliKisi||'',lx3,_scurY);
  _scurY+=_slRGap;

  // Satış Temsilcisi
  doc.setFont('Arial','bold');doc.text('Satış Temsilcisi',lx1,_scurY);doc.text(':',lx2,_scurY);
  doc.setFont('Arial','normal');doc.text(s.satisTemsilcisi||s.sorumlu||'',lx3,_scurY);
  _scurY+=_slRGap;

  // ── AYRAÇ ──
  doc.setDrawColor(...C.tableBg);doc.setLineWidth(0.75);
  const _sdivY=Math.max(mm(67.9),_scurY+mm(3));
  doc.line(mm(15.446),_sdivY,mm(194.63),_sdivY);

  // ── TABLO ──
  // 4 sütun, toplam mm(179.108) = mm(194.556) - mm(15.446)
  const tableY=_sdivY+mm(2.517);
  const colW={no:mm(9),urun:mm(127),miktar:mm(23),birim:mm(20.1)};
  const _col1Inner=colW.urun-4;
  const _infoLineH=mm(3);  // satırlar arası 3mm (baseline-to-baseline)
  const _infoGap=mm(3);    // ürün adından ilk bilgi satırına boşluk

  doc.setFontSize(7);doc.setFont('Arial','normal');
  const bodyRows=(s.satirlar||[]).map((k,i)=>{
    const base=(k.seciliParametreler&&k.seciliParametreler.length)
      ?(k._baseAciklama||(k.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim())
      :(k.aciklama||'');
    const params=k.seciliParametreler||[];
    const urun=(state.urunler||[]).find(u=>u.urunAdi===(k._baseAciklama||k.aciklama));
    const kategori=urun?(urun.kategori||''):'';

    // Hücre içinde alt alta gösterilecek bilgi satırları
    const infoLines=[];
    if(kategori) infoLines.push('Kategori: '+kategori);
    if(params.length>0){
      infoLines.push('Parametre Sayısı: '+params.length);
      const pLine='Parametreler: '+params.map(p=>typeof p==='string'?p:(p.deger?p.ad+': '+p.deger:p.ad)).join(', ');
      doc.splitTextToSize(pLine,_col1Inner).forEach(l=>infoLines.push(l));
    }

    const row=[i+1,base||'—',String(k.miktar),k.birim||'Adet'];
    if(infoLines.length){
      row._infoLines=infoLines;
      row._extraPad=infoLines.length*_infoLineH+_infoGap+0.5;
    }
    return row;
  });
  doc.setFontSize(8);doc.setFont('Arial','normal');

  let tableEndY=tableY;
  doc.autoTable({
    startY:tableY,
    head:[['#','ÜRÜN ADI VE ÖZELLİKLERİ','MİKTAR','BİRİM']],
    body:bodyRows,
    theme:'plain',
    styles:{font:'Arial',fontSize:8,cellPadding:{top:1.5,right:2,bottom:1.5,left:2},textColor:C.textDark,lineColor:C.tableBg,lineWidth:0.5},
    headStyles:{fillColor:C.tableBg,textColor:C.primary,fontStyle:'bold',fontSize:8,halign:'center',cellPadding:{top:1.6,right:2,bottom:1.6,left:2}},
    columnStyles:{
      0:{halign:'center',valign:'middle',cellWidth:colW.no},
      1:{halign:'left',valign:'top',cellWidth:colW.urun},
      2:{halign:'center',valign:'middle',cellWidth:colW.miktar},
      3:{halign:'center',valign:'middle',cellWidth:colW.birim}
    },
    margin:{left:mm(15.446),right:mm(15.446)},
    didParseCell:(data)=>{
      if(data.section==='head'&&data.column.index===1)data.cell.styles.halign='left';
      if(data.section==='body'&&data.column.index===1){
        const extra=data.row.raw._extraPad||0;
        if(extra>0){
          const p=data.cell.styles.cellPadding;
          data.cell.styles.cellPadding=typeof p==='object'
            ?Object.assign({},p,{bottom:(p.bottom||1.5)+extra})
            :{top:1.5,right:2,bottom:1.5+extra,left:2};
        }
      }
    },
    didDrawCell:(data)=>{
      if(data.section!=='body'||data.column.index!==1)return;
      const lines=data.row.raw._infoLines;if(!lines||!lines.length)return;
      const extra=data.row.raw._extraPad||0;
      const pad=data.cell.styles.cellPadding;
      const lpad=typeof pad==='object'?(pad.left||2):2;
      const infoTop=data.cell.y+data.cell.height-1.5-extra+_infoGap;
      const pt7asc=7*0.3528*0.82;
      doc.setFontSize(7);doc.setFont('Arial','normal');doc.setTextColor(...C.textLight);
      lines.forEach((line,i)=>{doc.text(line,data.cell.x+lpad,infoTop+pt7asc+i*_infoLineH);});
      doc.setFontSize(8);doc.setTextColor(...C.textDark);
    },
    didDrawPage:(data)=>{tableEndY=data.cursor.y;}
  });
  doc.setCharSpace(0);doc.setFont('Arial','normal');

  let y=tableEndY+mm(6);

  // ── NOTLAR ──
  if(s.notlar){
    doc.setFontSize(8);doc.setFont('Arial','bold');doc.setTextColor(...C.textLabel);
    doc.text('Not :',mm(15.446),y);
    doc.setFont('Arial','normal');doc.setTextColor(...C.textMid);
    const notLines=doc.splitTextToSize(s.notlar,mm(160));
    doc.text(notLines,mm(24.405),y);
    y+=notLines.length*mm(4.5)+mm(6);
  }

  // ── İMZA ALANLARI ──
  const sigY=y+mm(8);
  const sigH=mm(24),sigW=mm(78);

  // Hazırlayan
  doc.setDrawColor(...C.border);doc.setLineWidth(0.75);
  doc.setFillColor(...C.boxBg);
  doc.roundedRect(mm(15.446),sigY,sigW,sigH,2,2,'FD');
  doc.setFontSize(7.5);doc.setFont('Arial','bold');doc.setTextColor(...C.textLight);
  doc.text('HAZIRLAYAN',mm(15.446)+mm(3),sigY+mm(4.5));
  doc.setFont('Arial','normal');doc.setTextColor(...C.textMid);
  doc.text('Ad Soyad :',mm(15.446)+mm(3),sigY+mm(10));
  doc.text('Tarih :',mm(15.446)+mm(3),sigY+mm(15.5));
  doc.text('İmza :',mm(15.446)+mm(3),sigY+mm(21));

  // Kontrol / Onay
  const sig2X=mm(15.446)+sigW+mm(10);
  doc.setFillColor(...C.boxBg);
  doc.roundedRect(sig2X,sigY,sigW,sigH,2,2,'FD');
  doc.setFont('Arial','bold');doc.setTextColor(...C.textLight);
  doc.text('KONTROL / ONAY',sig2X+mm(3),sigY+mm(4.5));
  doc.setFont('Arial','normal');doc.setTextColor(...C.textMid);
  doc.text('Ad Soyad :',sig2X+mm(3),sigY+mm(10));
  doc.text('Tarih :',sig2X+mm(3),sigY+mm(15.5));
  doc.text('İmza :',sig2X+mm(3),sigY+mm(21));

  // ── FOOTER ──
  doc.setFontSize(7);doc.setFont('Arial','normal');doc.setTextColor(...C.textLight);
  doc.text('Bu form üretim birimi için düzenlenmiştir. Ticari bilgi içermez.',mm(15.446),pageH-mm(10));
  doc.text(st.firma||'Egefe Bilişim Sağlık San. ve Tic. A.Ş.',pageW-mm(15.446),pageH-mm(10),{align:'right'});

  doc.save('siparis-formu-'+(s.siparisNo||'siparis')+'.pdf');
}

// ════ RED / İPTAL NEDENİ ════
function openRedNedenModal(teklifId, yeniDurum) {
  document.getElementById('red-teklif-id').value = teklifId;
  document.getElementById('red-yeni-durum').value = yeniDurum;
  document.getElementById('red-modal-title').textContent = 'Red Nedeni';
  document.getElementById('red-neden-label').textContent = 'Red Nedeni *';
  // Reset form
  document.getElementById('red-neden-select').value = '';
  document.getElementById('red-neden-other').value = '';
  document.getElementById('red-rakip').value = '';
  document.getElementById('red-rakip-fiyat').value = '';
  document.getElementById('red-notlar').value = '';
  document.getElementById('red-neden-other-wrap').style.display = 'none';
  openModal('modal-red-neden');
}

function updateRedNedenOther() {
  var val = document.getElementById('red-neden-select').value;
  document.getElementById('red-neden-other-wrap').style.display = val === 'Diğer' ? '' : 'none';
}

async function saveRedNeden() {
  var neden = document.getElementById('red-neden-select').value;
  if (!neden) { toast('Lütfen bir neden seçin.', 'error'); return; }
  var teklifId = document.getElementById('red-teklif-id').value;
  var yeniDurum = document.getElementById('red-yeni-durum').value;
  var redBilgi = {
    neden: neden === 'Diğer' ? document.getElementById('red-neden-other').value : neden,
    rakip: document.getElementById('red-rakip').value,
    rakipFiyat: document.getElementById('red-rakip-fiyat').value,
    notlar: document.getElementById('red-notlar').value,
    tarih: today()
  };
  var tForServis = state.teklifler.find(function(x){return x.id===teklifId;});
  var updated = await updateTeklifDurum(teklifId, {durum: yeniDurum, redNedeni: JSON.stringify(redBilgi)});
  if (!updated) return;
  if (tForServis && tForServis.servisId) {
    var TEKLIF_SERVIS_MAP = {'Kabul Edildi':'Onarımda','Reddedildi':'Reddedildi','Kapandı':'Teslim Edildi'};
    var servisDurum = TEKLIF_SERVIS_MAP[yeniDurum];
    if (servisDurum) updateServisDurum(tForServis.servisId, {durum: servisDurum});
  }
  closeModal('modal-red-neden');
  renderTeklifler();
  toast('Teklif ' + yeniDurum + ' olarak işaretlendi.', 'success');
}

// ════ IMPORT / EXPORT ════
