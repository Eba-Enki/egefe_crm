// ════ SİPARİŞLER ════
var siparislerPage=1;var _siparisFilterHash='';
function setSiparislerPage(n){siparislerPage=n;renderSiparisler();}
var faturalarPage=1;var _faturaFilterHash='';
function setFaturalarPage(n){faturalarPage=n;renderFaturalar();}
const SP_DURUM_LIST=['Hazırlanıyor','Kısmi Sevkiyat','Tamamlandı','İptal'];
const SP_DURUM_CSS={'Hazırlanıyor':'badge-yeni','Kısmi Sevkiyat':'badge-sf','Tamamlandı':'badge-teslim','İptal':'badge-reddedildi','Fatura Edildi':'badge-onaylandi'};
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

function nextSiparisNo(){
  var p=(state.settings&&state.settings.siparisPrefix)||'SIP';
  var d=parseInt((state.settings&&state.settings.siparisDigits)||5);
  var nums=(state.siparisler||[]).map(function(s){return parseInt((s.siparisNo||'').replace(/^[A-Za-z]+/,''))||0;});
  return p+String((nums.length?Math.max.apply(null,nums):0)+1).padStart(d,'0');
}

function tekliftenSipariseAktar(teklifId){
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  if(t.durum==='Siparişe Aktarıldı'){toast('Bu teklif zaten siparişe dönüştürüldü.','error');return;}
  if(!state.siparisler)state.siparisler=[];
  var satirlar=(t.satirlar||[]).map(function(s){return Object.assign({},s,{gonderilen:0});});
  var siparis={id:'sp'+Date.now(),siparisNo:nextSiparisNo(),teklifId:t.id,teklifNo:t.teklifNo,
    kurum:t.kurum||'',ilgiliKisi:t.ilgiliKisi||'',telefon:t.telefon||'',email:t.email||'',
    sorumlu:t.sorumlu||'',satisTemsilcisi:t.sorumlu||'',satirlar:satirlar,
    paraBirimi:t.paraBirimi||'TRY',odemeKosulu:t.odemeKosulu||'',vade:t.vade||'',teslimat:t.teslimat||'',
    teklifTarihi:t.teklifTarihi||'',siparisTarihi:today(),notlar:t.notlar||'',
    durum:'Hazırlanıyor',olusturmaTarihi:new Date().toISOString()};
  state.siparisler.push(siparis);
  var ti=state.teklifler.findIndex(function(x){return x.id===teklifId;});
  if(ti>=0)state.teklifler[ti].durum='Siparişe Aktarıldı';
  saveAll();renderTeklifler();renderSiparisler();
  toast('Sipariş oluşturuldu: '+siparis.siparisNo,'success');
}

function quickSiparisDurumChange(sid,yeni){
  if(!state.siparisler)return;
  var idx=state.siparisler.findIndex(function(x){return x.id===sid;});
  if(idx<0)return;
  state.siparisler[idx].durum=yeni;
  if(yeni==='İptal'){
    var tekId=state.siparisler[idx].teklifId;
    if(tekId){var ti=state.teklifler.findIndex(function(x){return x.id===tekId;});if(ti>=0)state.teklifler[ti].durum='İptal Edildi';}
  }
  saveAll();renderSiparisler();
  toast('Sipariş durumu: '+yeni,'success');
}

function showSiparisDurumMenu(sid,btnEl){
  document.querySelectorAll('.durum-quick-menu').forEach(function(m){m.remove();});
  var s=(state.siparisler||[]).find(function(x){return x.id===sid;});
  if(!s)return;
  var menu=document.createElement('div');
  menu.className='durum-quick-menu';
  menu.style.cssText='position:fixed;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;z-index:600;min-width:170px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;';
  menu.innerHTML=SP_DURUM_LIST.map(function(d){
    var active=d===s.durum;
    return '<div onmousedown="event.stopPropagation();quickSiparisDurumChange(\''+sid+'\',\''+d+'\');document.querySelectorAll(\'.durum-quick-menu\').forEach(function(m){m.remove();});" style="padding:9px 14px;font-size:13px;cursor:pointer;'+(active?'background:var(--accent-soft);color:var(--accent);font-weight:600':'color:var(--text2)')+'">'+(active?'✓ ':'')+d+'</div>';
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
  var SATIS_DUR=['Taslak','Açık Teklif','Kabul Edildi','İptal Edildi','Reddedildi'];
  var SERVIS_DUR=['Onay Bekleniyor','Onaylandı','Reddedildi','Tamamlandı'];
  var durList=currentPortal==='satis'?SATIS_DUR:SERVIS_DUR;
  var menu=document.createElement('div');
  menu.className='durum-quick-menu';
  menu.style.cssText='position:fixed;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;z-index:600;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,.5);overflow:hidden;';
  menu.innerHTML=durList.map(function(d){
    var active=d===t.durum;
    var needsReason=(d==='Reddedildi'||d==='İptal Edildi')&&!active;
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
  if(!state.siparisler)state.siparisler=DB.pload('siparisler',[]);
  var allData=state.siparisler;
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
  if(!filtered.length){tbody.innerHTML='';if(emptyEl)emptyEl.style.display='';renderPagination('siparis-pagination',1,0,'setSiparislerPage');return;}
  if(emptyEl)emptyEl.style.display='none';
  var newSPH=JSON.stringify([fK,fN,fD,fTs,fTe,siparisTab]);if(newSPH!==_siparisFilterHash){siparislerPage=1;_siparisFilterHash=newSPH;}
  var currency={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'};
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  var sortedSp=filtered.sort(function(a,b){return new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi);});
  var pagedSp=sortedSp.slice((siparislerPage-1)*PAGE_SIZE,siparislerPage*PAGE_SIZE);
  renderPagination('siparis-pagination',siparislerPage,filtered.length,'setSiparislerPage');
  tbody.innerHTML=pagedSp.map(function(s){
    var toplam=(s.satirlar||[]).reduce(function(a,i){return a+i.miktar*i.birimFiyat;},0);
    var cur=currency[s.paraBirimi||'TRY']||'₺';
    return '<tr>'
      +'<td><span class="kn-badge">'+s.siparisNo+'</span></td>'
      +'<td class="td-mono" style="color:var(--text2)">'+fmtDate(s.siparisTarihi||s.teklifTarihi||s.olusturmaTarihi)+'</td>'
      +'<td style="font-weight:500">'+(s.kurum||'—')+'</td>'
      +'<td style="font-family:DM Mono,monospace;color:var(--amber)">'+cur+' '+fmtNum(toplam)+'</td>'
      +'<td><span class="badge '+(SP_DURUM_CSS[s.durum]||'badge-sf')+'">'+s.durum+'</span></td>'
      +'<td style="font-size:12px;color:var(--text3)">'+(s.satisTemsilcisi||s.sorumlu||'—')+'</td>'
      +'<td style="text-align:right"><div class="action-row">'
      +'<button class="btn-icon" title="Detay" onclick="openSiparisDetay(\''+s.id+'\')">◎</button>'
      +(ARSIV_SIPARISLER.indexOf(s.durum)<0?'<button class="btn-icon" title="Sipariş Formu Yazdır" style="color:var(--teal)" onclick="printSiparisUretimFormu(\''+s.id+'\')">📋</button>':'')
      +(canEdit&&['Hazırlanıyor','Kısmi Sevkiyat'].indexOf(s.durum)>=0
        ?(s.formYazdirildi
          ?'<button class="btn-icon" title="Sevkiyat" style="color:var(--teal)" onclick="openKismiTeslim(\''+s.id+'\')">📦</button>'
          :'<button class="btn-icon" title="Önce sipariş formu yazdırın" style="color:var(--text3);cursor:not-allowed" disabled>📦</button>')
        :'')
      +(canEdit&&['Kısmi Sevkiyat','Tamamlandı'].indexOf(s.durum)>=0?'<button class="btn-icon" title="Faturaya Aktar" style="color:var(--amber)" onclick="openFaturaModal(\''+s.id+'\')">🧾</button>':'')
      +(canEdit?'<button class="btn-icon" title="Durum Değiştir" style="color:var(--accent)" onclick="showSiparisDurumMenu(\''+s.id+'\',this)">⇅</button>':'')
      +(canEdit?'<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete(\'siparis\',\''+s.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
  }).join('');
}


// ════ FATURA & KISMİ TESLİM ════
var _activeFaturaSpId='';
var _activeKismiSpId='';

function nextFaturaNo(){
  var nums=(state.faturalar||[]).map(function(f){return parseInt((f.faturaNo||'').replace('FAT',''))||0;});
  return 'FAT'+String((nums.length?Math.max.apply(null,nums):0)+1).padStart(5,'0');
}

function openFaturaModal(sipId){
  _activeFaturaSpId=sipId;
  var sp=(state.siparisler||[]).find(function(x){return x.id===sipId;});
  var el_fn=document.getElementById('fm-faturaNo');
  var el_ft=document.getElementById('fm-faturaTarihi');
  var el_vt=document.getElementById('fm-vadeTarihi');
  if(el_fn)el_fn.value='';
  if(el_ft)el_ft.value=today();
  if(el_vt)el_vt.value='';
  if(sp){
    var cur={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'}[sp.paraBirimi||'TRY']||'₺';
    var toplam=(sp.satirlar||[]).reduce(function(a,i){return a+i.miktar*(i.birimFiyat||0);},0);
    var ozetEl=document.getElementById('sp-fatura-ozet');
    if(ozetEl)ozetEl.innerHTML='<div style="display:flex;justify-content:space-between;align-items:center;gap:12px">'
      +'<div><div style="font-size:10px;color:var(--text3);letter-spacing:.05em">SİPARİŞ</div><div style="font-weight:600">'+escXml(sp.siparisNo)+'</div></div>'
      +'<div style="flex:1"><div style="font-size:10px;color:var(--text3);letter-spacing:.05em">MÜŞTERİ</div><div style="font-weight:500">'+escXml(sp.kurum||'')+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:10px;color:var(--text3);letter-spacing:.05em">TUTAR</div><div style="font-weight:700;color:var(--amber)">'+cur+' '+fmtNum(toplam)+'</div></div>'
      +'</div>';
  }
  openModal('modal-fatura');
}

function saveFatura(){
  var fatNo=(document.getElementById('fm-faturaNo')||{}).value||'';
  var fatTar=(document.getElementById('fm-faturaTarihi')||{}).value||'';
  if(!fatNo||!fatTar){toast('Fatura No ve Tarih zorunludur.','error');return;}
  var sp=(state.siparisler||[]).find(function(x){return x.id===_activeFaturaSpId;});
  if(!sp)return;
  if(!state.faturalar)state.faturalar=[];
  var toplam=(sp.satirlar||[]).reduce(function(a,i){return a+i.miktar*i.birimFiyat;},0);
  state.faturalar.push({
    id:'ft'+Date.now(),
    faturaNo:fatNo,
    siparisId:sp.id,siparisNo:sp.siparisNo,
    kurum:sp.kurum||'',
    tutar:toplam,paraBirimi:sp.paraBirimi||'TRY',
    faturaTarihi:fatTar,
    vadeTarihi:(document.getElementById('fm-vadeTarihi')||{}).value||'',
    durum:'Ödenmedi',
    olusturmaTarihi:new Date().toISOString()
  });
  var si=(state.siparisler||[]).findIndex(function(x){return x.id===_activeFaturaSpId;});
  if(si>=0)state.siparisler[si].durum='Fatura Edildi';
  saveAll();closeModal('modal-fatura');
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
    var kBase=ksp.length?(k.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim():k.aciklama||'';
    var kpHtml=ksp.length?'<div style="font-size:11px;color:rgb(143,164,176);margin-top:2px;line-height:1.4">('+ksp.join(', ')+')</div>':'';
    return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:13px;font-weight:500;margin-bottom:6px">'+escXml(kBase)+kpHtml+'</div>'
      +'<div style="display:flex;gap:12px;font-size:12px;color:var(--text3);margin-bottom:6px">'
      +'<span>Toplam: <b style="color:var(--text)">'+k.miktar+' '+escXml(k.birim||'Adet')+'</b></span>'
      +'<span>Gönderilen: <b style="color:var(--green)">'+gonderilen+'</b></span>'
      +'<span>Kalan: <b style="color:var(--amber)">'+kalan+'</b></span></div>'
      +(kalan>0?'<div style="display:flex;align-items:center;gap:8px"><label style="font-size:12px;color:var(--text2)">Bu Sevkiyat:</label><input type="number" id="kt-miktar-'+i+'" min="0" max="'+kalan+'" value="0" style="width:80px;padding:4px 8px;background:var(--bg3);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:13px"></div>':'<div style="font-size:12px;color:var(--green)">✓ Tamamen gönderildi</div>')
      +'</div>';
  }).join('');
  openModal('modal-kismiteslim');
}

function saveKismiTeslim(){
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
  var si=(state.siparisler||[]).findIndex(function(x){return x.id===_activeKismiSpId;});
  if(si>=0)state.siparisler[si].durum=tamam?'Tamamlandı':'Kısmi Sevkiyat';
  saveAll();closeModal('modal-kismiteslim');
  renderSiparisler();
  toast(tamam?'Tüm kalemler sevk edildi, sipariş tamamlandı.':'Kısmi sevkiyat kaydedildi.','success');
}

function renderFaturalar(){
  if(!state.faturalar)state.faturalar=[];
  var allData=state.faturalar;
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
  if(!filtered.length){tbody.innerHTML='';document.getElementById('fatura-empty').style.display='';renderPagination('fatura-pagination',1,0,'setFaturalarPage');return;}
  document.getElementById('fatura-empty').style.display='none';
  var newFH=JSON.stringify([fK,fN,fD,fTs,fTe,faturaTab]);if(newFH!==_faturaFilterHash){faturalarPage=1;_faturaFilterHash=newFH;}
  var currency={TRY:'₺',USD:'$',EUR:'€',GBP:'£'};
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  var sortedFt=[...filtered].sort(function(a,b){return new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi);});
  var pagedFt=sortedFt.slice((faturalarPage-1)*PAGE_SIZE,faturalarPage*PAGE_SIZE);
  renderPagination('fatura-pagination',faturalarPage,filtered.length,'setFaturalarPage');
  tbody.innerHTML=pagedFt.map(function(f){
    var vadeDate=f.vadeTarihi?new Date(f.vadeTarihi):null;
    var vadeWarn=(vadeDate&&!isNaN(vadeDate)&&vadeDate.getTime()<today_ms&&f.durum==='Ödenmedi')?' <span style="color:var(--red);font-size:10px">⚠ Gecikmiş</span>':'';
    var cur=currency[f.paraBirimi||'TRY']||'₺';
    return '<tr>'
      +'<td><span class="kn-badge">'+escXml(f.faturaNo)+'</span></td>'
      +'<td><span class="kn-badge" style="color:var(--teal)">'+escXml(f.siparisNo)+'</span></td>'
      +'<td style="font-weight:500">'+escXml(f.kurum||'—')+'</td>'
      +'<td style="font-family:DM Mono,monospace;color:var(--amber)">'+cur+' '+fmtNum(f.tutar)+'</td>'
      +'<td class="td-mono">'+escXml(f.faturaTarihi||'—')+'</td>'
      +'<td class="td-mono">'+escXml(f.vadeTarihi||'—')+vadeWarn+'</td>'
      +'<td><span class="badge '+(f.durum==='Ödendi'?'badge-onaylandi':'badge-reddedildi')+'">'+f.durum+'</span></td>'
      +'<td style="text-align:right"><div class="action-row">'
      +(canEdit?'<button class="btn-icon" title="Düzenle" onclick="openFaturaDuzenle(\''+f.id+'\')">✏</button>':'')
      +(canEdit&&f.durum!=='Ödendi'?'<button class="btn-icon" style="color:var(--green)" onclick="markFaturaOdendi(\''+f.id+'\')" title="Ödendi İşaretle">✓</button>':'')
      +(canEdit&&f.durum==='Ödendi'?'<button class="btn-icon" style="color:var(--text3)" onclick="markFaturaOdenmedi(\''+f.id+'\')" title="Ödenmedi olarak geri al">↩</button>':'')
      +(canEdit?'<button class="btn-icon" style="color:var(--red)" onclick="confirmDelete(\'fatura\',\''+f.id+'\')">⊗</button>':'')
      +'</div></td>'
      +'</tr>';
  }).join('');
}

function clearSiparisFilters(){
  ['sp-f-kurum','sp-f-no','sp-f-ts','sp-f-te'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  var e=document.getElementById('sp-f-durum');if(e)e.value='';
  renderSiparisler();
}
function clearFaturaFilters(){
  ['ft-f-kurum','ft-f-no','ft-f-ts','ft-f-te'].forEach(function(id){var e=document.getElementById(id);if(e)e.value='';});
  var e=document.getElementById('ft-f-durum');if(e)e.value='';
  renderFaturalar();
}
function markFaturaOdendi(fid){
  var fi=(state.faturalar||[]).findIndex(function(x){return x.id===fid;});
  if(fi>=0){state.faturalar[fi].durum='Ödendi';saveAll();renderFaturalar();toast('Fatura ödendi olarak işaretlendi.','success');}
}
function markFaturaOdenmedi(fid){
  var fi=(state.faturalar||[]).findIndex(function(x){return x.id===fid;});
  if(fi>=0){state.faturalar[fi].durum='Ödenmedi';saveAll();renderFaturalar();toast('Fatura ödenmedi olarak geri alındı.','info');}
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
function saveFaturaDuzenle(){
  var fatNo=(document.getElementById('fe-faturaNo')||{}).value||'';
  var fatTar=(document.getElementById('fe-faturaTarihi')||{}).value||'';
  if(!fatNo||!fatTar){toast('Fatura No ve Tarih zorunludur.','error');return;}
  var fi=(state.faturalar||[]).findIndex(function(x){return x.id===_editFaturaId;});
  if(fi<0)return;
  state.faturalar[fi].faturaNo=fatNo;
  state.faturalar[fi].faturaTarihi=fatTar;
  state.faturalar[fi].vadeTarihi=(document.getElementById('fe-vadeTarihi')||{}).value||'';
  saveAll();closeModal('modal-fatura-edit');
  renderFaturalar();
  toast('Fatura güncellendi.','success');
}

function escXml(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}


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
    var sBase=sp.length?(s.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim():s.aciklama||'';
    var pHtml=sp.length?'<div style="font-size:11px;color:rgb(143,164,176);margin-top:2px;line-height:1.4">('+sp.join(', ')+')</div>':'';
    return '<tr><td style="padding:6px 8px;font-size:13px">'+escXml(sBase)+pHtml+'</td>'
      +'<td style="padding:6px 8px;font-size:12px;text-align:center">'+s.miktar+' '+escXml(s.birim||'Adet')+'</td>'
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

function saveSiparisForm(){
  var teklifId=document.getElementById('sf2-teklif-id').value;
  var tarih=document.getElementById('sf2-tarih').value;
  if(!tarih){toast('Sipariş tarihi zorunludur.','error');return;}
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  if(!state.siparisler)state.siparisler=[];
  var siparisNo=nextSiparisNo();
  var satirlar=(t.satirlar||[]).map(function(s){return Object.assign({},s,{gonderilen:0});});
  var siparis={
    id:'sp'+Date.now(),
    siparisNo:siparisNo,teklifId:t.id,teklifNo:t.teklifNo,
    kurum:t.kurum||'',ilgiliKisi:t.ilgiliKisi||'',telefon:t.telefon||'',email:t.email||'',
    sorumlu:t.sorumlu||state.currentUser?.ad||'',satisTemsilcisi:t.sorumlu||state.currentUser?.ad||'',
    satirlar:satirlar,paraBirimi:t.paraBirimi||'TRY',
    odemeKosulu:t.odemeKosulu||'',vade:t.vade||'',teslimat:t.teslimat||'',
    teklifTarihi:t.teklifTarihi||'',siparisTarihi:tarih,
    tahminTeslimat:document.getElementById('sf2-teslimat').value||'',
    notlar:document.getElementById('sf2-notlar').value||'',
    durum:'Hazırlanıyor',olusturmaTarihi:new Date().toISOString()
  };
  state.siparisler.push(siparis);
  var ti=state.teklifler.findIndex(function(x){return x.id===teklifId;});
  if(ti>=0)state.teklifler[ti].durum='Siparişe Aktarıldı';
  saveAll();
  toast('Sipariş oluşturuldu: '+siparisNo,'success');
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
    var rBase=rsp.length?(k.aciklama||'').replace(/\s*\([^)]*\)/g,'').trim()||'—':k.aciklama||'—';
    var rpHtml=rsp.length?'<div style="font-size:11px;color:rgb(143,164,176);margin-top:2px;line-height:1.4">('+rsp.join(', ')+')</div>':'';
    return '<tr>'
      +'<td style="padding:7px 9px;font-size:13px">'+escXml(rBase)+rpHtml+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:center">'+k.miktar+' '+escXml(k.birim||'')+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:center;color:var(--green)">'+gonderilen+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:center;color:'+(kalan>0?'var(--amber)':'var(--text3)')+'">'+kalan+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:right">'+cur+' '+fmtNum(k.birimFiyat||0)+'</td>'
      +'<td style="padding:7px 9px;font-size:12px;text-align:right;color:var(--amber)">'+cur+' '+fmtNum(satir)+'</td>'
      +'</tr>';
  }).join('');
  var infoParts='';
  if(s.odemeKosulu)infoParts+='<div class="info-item"><div class="info-item-label">Ödeme Koşulu</div><div class="info-item-val">'+escXml(s.odemeKosulu)+'</div></div>';
  if(s.vade)infoParts+='<div class="info-item"><div class="info-item-label">Vade</div><div class="info-item-val">'+escXml(s.vade)+'</div></div>';
  if(s.tahminTeslimat)infoParts+='<div class="info-item"><div class="info-item-label">Tahmini Teslimat</div><div class="info-item-val td-mono">'+fmtDate(s.tahminTeslimat)+'</div></div>';
  if(s.satisTemsilcisi||s.sorumlu)infoParts+='<div class="info-item"><div class="info-item-label">Satış Temsilcisi</div><div class="info-item-val">'+escXml(s.satisTemsilcisi||s.sorumlu||'')+'</div></div>';
  var el=document.getElementById('sp-detay-body');if(!el)return;
  el.innerHTML=
    '<div class="info-grid" style="margin-bottom:14px">'
    +'<div class="info-item"><div class="info-item-label">Sipariş No</div><div class="info-item-val"><span class="kn-badge">'+escXml(s.siparisNo)+'</span></div></div>'
    +(s.teklifNo?'<div class="info-item"><div class="info-item-label">Teklif No</div><div class="info-item-val"><span class="kn-badge" style="color:var(--accent)">'+escXml(s.teklifNo)+'</span></div></div>':'')
    +'<div class="info-item"><div class="info-item-label">Kurum</div><div class="info-item-val" style="font-weight:600">'+escXml(s.kurum||'—')+'</div></div>'
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
    +(s.notlar?'<div style="background:var(--bg3);border-radius:var(--radius-sm);padding:11px 14px;font-size:13px;color:var(--text2)">'+escXml(s.notlar)+'</div>':'');
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
  doc.setFont('Arial','bold');doc.setTextColor(...C.textMid);
  doc.text('Kurum Adı',lx1,mm(42.774)+6);doc.text(':',lx2,mm(42.774)+6);
  doc.setFont('Arial','normal');doc.text(s.kurum||'',lx3,mm(42.774)+6);

  doc.setFont('Arial','bold');doc.text('İlgili Kişi',lx1,mm(47.065)+6);doc.text(':',lx2,mm(47.065)+6);
  doc.setFont('Arial','normal');doc.text(s.ilgiliKisi||'',lx3,mm(47.065)+6);

  doc.setFont('Arial','bold');doc.text('Satış Temsilcisi',lx1,mm(51.356)+6);doc.text(':',lx2,mm(51.356)+6);
  doc.setFont('Arial','normal');doc.text(s.satisTemsilcisi||s.sorumlu||'',lx3,mm(51.356)+6);

  // ── AYRAÇ ──
  doc.setDrawColor(...C.tableBg);doc.setLineWidth(0.75);
  doc.line(mm(15.446),mm(67.9),mm(194.63),mm(67.9));

  // ── TABLO ──
  // 4 sütun, toplam mm(179.108) = mm(194.556) - mm(15.446)
  const tableY=mm(69.667)+mm(0.75);
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
      const pLine='Parametreler: '+params.join(', ');
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
  // Formu yazdırıldı olarak işaretle → sevkiyat butonu aktifleşir
  const _spIdx=(state.siparisler||[]).findIndex(x=>x.id===s.id);
  if(_spIdx>=0){state.siparisler[_spIdx].formYazdirildi=true;saveAll();renderSiparisler();}
}

// ════ RED / İPTAL NEDENİ ════
function openRedNedenModal(teklifId, yeniDurum) {
  document.getElementById('red-teklif-id').value = teklifId;
  document.getElementById('red-yeni-durum').value = yeniDurum;
  var isIptal = yeniDurum === 'İptal Edildi';
  document.getElementById('red-modal-title').textContent = isIptal ? 'İptal Nedeni' : 'Red Nedeni';
  document.getElementById('red-neden-label').textContent = (isIptal ? 'İptal Nedeni' : 'Red Nedeni') + ' *';
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

function saveRedNeden() {
  var neden = document.getElementById('red-neden-select').value;
  if (!neden) { toast('Lütfen bir neden seçin.', 'error'); return; }
  var teklifId = document.getElementById('red-teklif-id').value;
  var yeniDurum = document.getElementById('red-yeni-durum').value;
  var ti = state.teklifler.findIndex(function(x){return x.id===teklifId;});
  if (ti < 0) return;
  state.teklifler[ti].durum = yeniDurum;
  state.teklifler[ti].redBilgi = {
    neden: neden === 'Diğer' ? document.getElementById('red-neden-other').value : neden,
    rakip: document.getElementById('red-rakip').value,
    rakipFiyat: document.getElementById('red-rakip-fiyat').value,
    notlar: document.getElementById('red-notlar').value,
    tarih: today()
  };
  DB.psave('teklifler', state.teklifler);
  closeModal('modal-red-neden');
  renderTeklifler();
  toast('Teklif ' + yeniDurum + ' olarak işaretlendi.', 'success');
}

// ════ IMPORT / EXPORT ════
