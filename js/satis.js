// ════ SİPARİŞLER ════
const SP_DURUM_LIST=['Hazırlanıyor','Kısmen Sevk Edildi','Tamamlandı','İptal'];
const SP_DURUM_CSS={'Hazırlanıyor':'badge-yeni','Kısmen Sevk Edildi':'badge-sf','Tamamlandı':'badge-teslim','İptal':'badge-reddedildi','Fatura Edildi':'badge-onaylandi'};
const ARSIV_SIPARISLER=['Tamamlandı','İptal'];
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
  var nums=(state.siparisler||[]).map(function(s){return parseInt((s.siparisNo||'').replace('SIP',''))||0;});
  return 'SIP'+String((nums.length?Math.max.apply(null,nums):0)+1).padStart(5,'0');
}

function tekliftenSipariseAktar(teklifId){
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  if(t.durum==='Siparişe Aktarıldı'){toast('Bu teklif zaten siparişe dönüştürüldü.','error');return;}
  if(!state.siparisler)state.siparisler=[];
  var siparis={id:'sp'+Date.now(),siparisNo:nextSiparisNo(),teklifId:t.id,teklifNo:t.teklifNo,
    kurum:t.kurum||'',teklifTarihi:t.teklifTarihi||'',ilgiliKisi:t.ilgiliKisi||'',telefon:t.telefon||'',email:t.email||'',
    sorumlu:t.sorumlu||'',satirlar:t.satirlar?JSON.parse(JSON.stringify(t.satirlar)):[],
    paraBirimi:t.paraBirimi||'TRY',odemeVadesi:t.odemeVadesi||'',notlar:t.notlar||'',
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
  if(!filtered.length){tbody.innerHTML='';if(emptyEl)emptyEl.style.display='';return;}
  if(emptyEl)emptyEl.style.display='none';
  var currency={'TRY':'₺','USD':'$','EUR':'€','GBP':'£'};
  var canEdit=state.currentUser&&state.currentUser.rol!=='izleyici';
  tbody.innerHTML=filtered.sort(function(a,b){return new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi);}).map(function(s){
    var toplam=(s.satirlar||[]).reduce(function(a,i){return a+i.miktar*i.birimFiyat;},0);
    var cur=currency[s.paraBirimi||'TRY']||'₺';
    return '<tr>'
      +'<td><span class="kn-badge">'+s.siparisNo+'</span></td>'
      +'<td class="td-mono" style="color:var(--text2)">'+fmtDate(s.siparisTarihi||s.teklifTarihi||s.olusturmaTarihi)+'</td>'
      +'<td style="font-weight:500">'+(s.kurum||'—')+'</td>'
      +'<td style="font-family:DM Mono,monospace;color:var(--amber)">'+cur+' '+fmtTL(toplam)+'</td>'
      +'<td><span class="badge '+(SP_DURUM_CSS[s.durum]||'badge-sf')+'">'+s.durum+'</span></td>'
      +'<td style="font-size:12px;color:var(--text3)">'+(s.satisTemsilcisi||s.sorumlu||'—')+'</td>'
      +'<td style="text-align:right"><div class="action-row">'
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
  var el_fn=document.getElementById('fm-faturaNo');
  var el_ft=document.getElementById('fm-faturaTarihi');
  var el_vt=document.getElementById('fm-vadeTarihi');
  if(el_fn)el_fn.value=nextFaturaNo();
  if(el_ft)el_ft.value=today();
  if(el_vt)el_vt.value='';
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
    return '<div style="padding:8px 0;border-bottom:1px solid var(--border)">'
      +'<div style="font-size:13px;font-weight:500;margin-bottom:6px">'+escXml(k.aciklama||'')+'</div>'
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
  if(si>=0)state.siparisler[si].durum=tamam?'Tamamlandı':'Kısmen Sevk Edildi';
  saveAll();closeModal('modal-kismiteslim');
  renderSiparisler();
  toast(tamam?'Sipariş teslim edildi.':'Kısmi sevkiyat kaydedildi.','success');
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
  if(!filtered.length){tbody.innerHTML='';document.getElementById('fatura-empty').style.display='';return;}
  document.getElementById('fatura-empty').style.display='none';
  var currency={TRY:'₺',USD:'$',EUR:'€',GBP:'£'};
  tbody.innerHTML=[...filtered].sort(function(a,b){return new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi);}).map(function(f){
    var vadeDate=f.vadeTarihi?new Date(f.vadeTarihi):null;
    var vadeWarn=(vadeDate&&!isNaN(vadeDate)&&vadeDate.getTime()<today_ms&&f.durum==='Ödenmedi')?' <span style="color:var(--red);font-size:10px">⚠ Gecikmiş</span>':'';
    var cur=currency[f.paraBirimi||'TRY']||'₺';
    return '<tr>'
      +'<td><span class="kn-badge">'+escXml(f.faturaNo)+'</span></td>'
      +'<td><span class="kn-badge" style="color:var(--teal)">'+escXml(f.siparisNo)+'</span></td>'
      +'<td style="font-weight:500">'+escXml(f.kurum||'—')+'</td>'
      +'<td style="font-family:DM Mono,monospace;color:var(--amber)">'+cur+' '+fmtTL(f.tutar)+'</td>'
      +'<td class="td-mono">'+escXml(f.faturaTarihi||'—')+'</td>'
      +'<td class="td-mono">'+escXml(f.vadeTarihi||'—')+vadeWarn+'</td>'
      +'<td><span class="badge '+(f.durum==='Ödendi'?'badge-onaylandi':'badge-reddedildi')+'">'+f.durum+'</span>'
      +(f.durum==='Ödeme Bekleniyor'?'<button class="btn-icon" style="color:var(--green);margin-left:6px" onclick="markFaturaOdendi(\''+f.id+'\')" title="Ödendi İşaretle">✓</button>':'')
      +'</td></tr>';
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

function escXml(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}


// ════ SİPARİŞ FORMU ════
function goSiparisForm(teklifId){
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  document.getElementById('sf2-teklif-id').value=teklifId;
  document.getElementById('sf2-teklif-no').value=t.teklifNo||'';
  document.getElementById('sf2-kurum').value=t.kurum||'';
  document.getElementById('sf2-tutar').value=fmtTL(calcTeklifToplam(t));
  document.getElementById('sf2-sorumlu').value=t.sorumlu||state.currentUser?.ad||'';
  document.getElementById('sf2-tarih').value=today();
  document.getElementById('sf2-teslimat').value='';
  document.getElementById('sf2-notlar').value='';
  showPage('siparis-form',true);
}

function saveSiparisForm(){
  var teklifId=document.getElementById('sf2-teklif-id').value;
  var tarih=document.getElementById('sf2-tarih').value;
  if(!tarih){toast('Sipariş tarihi zorunludur.','error');return;}
  var t=state.teklifler.find(function(x){return x.id===teklifId;});
  if(!t)return;
  if(!state.siparisler)state.siparisler=[];
  // Generate siparis no
  var nums=(state.siparisler||[]).map(function(s){return parseInt((s.siparisNo||'').replace('SIP',''))||0;});
  var siparisNo='SIP'+String((nums.length?Math.max.apply(null,nums):0)+1).padStart(5,'0');
  var siparis={
    id:'sp'+Date.now(),
    siparisNo:siparisNo,
    teklifId:t.id,
    teklifNo:t.teklifNo,
    kurum:t.kurum||'',
    ilgiliKisi:t.ilgiliKisi||'',
    sorumlu:t.sorumlu||state.currentUser?.ad||'',
    satisTemsilcisi:t.sorumlu||state.currentUser?.ad||'',
    satirlar:t.satirlar?JSON.parse(JSON.stringify(t.satirlar)):[],
    paraBirimi:t.paraBirimi||'TRY',
    teklifTarihi:t.teklifTarihi||'',
    siparisTarihi:tarih,
    tahminTeslimat:document.getElementById('sf2-teslimat').value||'',
    notlar:document.getElementById('sf2-notlar').value||'',
    durum:'Hazırlanıyor',
    olusturmaTarihi:new Date().toISOString()
  };
  state.siparisler.push(siparis);
  // Update teklif status
  var ti=state.teklifler.findIndex(function(x){return x.id===teklifId;});
  if(ti>=0)state.teklifler[ti].durum='Siparişe Aktarıldı';
  DB.psave('siparisler',state.siparisler);
  DB.psave('teklifler',state.teklifler);
  toast('Sipariş oluşturuldu: '+siparisNo,'success');
  showPage('siparisler');
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
