// ════ EXCEL EXPORT ════
function _exXml(v){return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function _xlsBlob(rows,headers){
  var cols=headers.map(function(){return '<Column ss:AutoFitWidth="1"/>';}).join('');
  var hdr='<Row>'+headers.map(function(h){return '<Cell><Data ss:Type="String">'+_exXml(h)+'</Data></Cell>';}).join('')+'</Row>';
  var body=rows.map(function(r){return '<Row>'+r.map(function(c){var t=typeof c==='number'?'Number':'String';return '<Cell><Data ss:Type="'+t+'">'+_exXml(c)+'</Data></Cell>';}).join('')+'</Row>';}).join('');
  var xml='<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Sayfa1"><Table>'+cols+hdr+body+'</Table></Worksheet></Workbook>';
  return new Blob([xml],{type:'application/vnd.ms-excel;charset=utf-8'});
}
function _dlBlob(blob,name){var u=URL.createObjectURL(blob);var a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();document.body.removeChild(a);setTimeout(function(){URL.revokeObjectURL(u);},5000);}
function exportServislerExcel(){
  var data=[...state.servisler];
  var fK=(document.getElementById('f-kurum')||{}).value||'';
  var fS=(document.getElementById('f-seri')||{}).value||'';
  var fD=(document.getElementById('f-durum')||{}).value||'';
  var fG=(document.getElementById('f-garanti')||{}).value||'';
  var fTs=(document.getElementById('f-ts')||{}).value||'';
  var fTe=(document.getElementById('f-te')||{}).value||'';
  if(fK)data=data.filter(function(s){return s.kurumAdi.toLowerCase().includes(fK.toLowerCase());});
  if(fS)data=data.filter(function(s){return (s.seriNo||'').includes(fS)||s.kayitNo.toLowerCase().includes(fS);});
  if(fD)data=data.filter(function(s){return s.durum===fD;});
  if(fG)data=data.filter(function(s){return s.garantiDurumu===fG;});
  if(fTs)data=data.filter(function(s){return s.gelisTarihi>=fTs;});
  if(fTe)data=data.filter(function(s){return s.gelisTarihi<=fTe;});
  var rows=data.map(function(s){return[s.kayitNo,s.kurumAdi||'',s.seriNo||'',s.gelisTarihi||'',s.durum||'',s.garantiDurumu||'',s.ilgiliKisi||'',s.notlar||''];});
  _dlBlob(_xlsBlob(rows,['Kayıt No','Kurum','Seri No','Geliş Tarihi','Durum','Garanti','İlgili Kişi','Notlar']),'servisler_'+today()+'.xls');
  toast('Excel indirildi.','success');
}
function exportTekliflerExcel(){
  var rows=state.teklifler.map(function(t){return[t.teklifNo,t.kurum||'',calcTeklifToplam(t),t.teklifTarihi||'',t.durum||'',t.sorumlu||''];});
  _dlBlob(_xlsBlob(rows,['Teklif No','Kurum','Toplam','Tarih','Durum','Sorumlu']),'teklifler_'+today()+'.xls');
  toast('Excel indirildi.','success');
}


function exportSiparislerExcel(){
  var data=state.siparisler||[];
  var fK=(document.getElementById('sp-f-kurum')||{}).value||'';
  var fN=(document.getElementById('sp-f-no')||{}).value||'';
  var fD=(document.getElementById('sp-f-durum')||{}).value||'';
  var fTs=(document.getElementById('sp-f-ts')||{}).value||'';
  var fTe=(document.getElementById('sp-f-te')||{}).value||'';
  if(fK)data=data.filter(function(s){return(s.kurum||'').toLowerCase().includes(fK.toLowerCase());});
  if(fN)data=data.filter(function(s){return(s.siparisNo||'').toLowerCase().includes(fN.toLowerCase());});
  if(fD)data=data.filter(function(s){return s.durum===fD;});
  if(fTs)data=data.filter(function(s){var t=s.siparisTarihi||s.teklifTarihi||(s.olusturmaTarihi||'').slice(0,10);return t>=fTs;});
  if(fTe)data=data.filter(function(s){var t=s.siparisTarihi||s.teklifTarihi||(s.olusturmaTarihi||'').slice(0,10);return t<=fTe;});
  var rows=data.map(function(s){
    var toplam=(s.satirlar||[]).reduce(function(a,i){return a+i.miktar*i.birimFiyat;},0);
    return[s.siparisNo||'',s.kurum||'',toplam,s.siparisTarihi||s.teklifTarihi||'',s.durum||'',s.satisTemsilcisi||s.sorumlu||''];
  });
  _dlBlob(_xlsBlob(rows,['Sipariş No','Kurum','Tutar','Tarih','Durum','Satış Temsilcisi']),'siparisler_'+today()+'.xls');
  toast('Excel indirildi.','success');
}

// ════ IMPORT / EXPORT ════
function exportData(){
  var portal=currentPortal||'servis';
  var data={
    version:7,
    portal:portal,
    exportDate:new Date().toISOString(),
    servisler:state.servisler||[],
    teklifler:state.teklifler||[],
    musteriler:state.musteriler||[],
    urunler:state.urunler||[],
    siparisler:state.siparisler||[],
    faturalar:state.faturalar||[],
    settings:state.settings||{}
  };
  var portal_tag=portal==='satis'?'satis':'servis';
  var fname='egefe_yedek_'+portal_tag+'_'+today()+'.json';
  _dlBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),fname);
  toast('Yedek alındı: '+fname,'success');
}
function importData(e){
  var file=e.target.files[0];if(!file)return;
  var r=new FileReader();
  r.onload=function(ev){
    try{
      var d=JSON.parse(ev.target.result);
      var counts=[];
      if(d.servisler&&d.servisler.length)counts.push(d.servisler.length+' servis');
      if(d.teklifler&&d.teklifler.length)counts.push(d.teklifler.length+' teklif');
      if(d.siparisler&&d.siparisler.length)counts.push(d.siparisler.length+' sipariş');
      if(d.faturalar&&d.faturalar.length)counts.push(d.faturalar.length+' fatura');
      if(d.musteriler&&d.musteriler.length)counts.push(d.musteriler.length+' müşteri');
      if(d.urunler&&d.urunler.length)counts.push(d.urunler.length+' ürün');
      if(!counts.length){toast('Yedek dosyası boş veya geçersiz.','error');return;}
      if(!confirm('Yedek içeriği:\n'+counts.join(', ')+'\n\nMevcut verilerle birleştirilecek (aynı kayıtlar atlanır). Devam?'))return;
      if(d.servisler){var exS=new Set((state.servisler||[]).map(function(s){return s.kayitNo;}));state.servisler=[...(state.servisler||[]),...d.servisler.filter(function(s){return!exS.has(s.kayitNo);})];}
      if(d.teklifler){var exT=new Set((state.teklifler||[]).map(function(t){return t.teklifNo;}));state.teklifler=[...(state.teklifler||[]),...d.teklifler.filter(function(t){return!exT.has(t.teklifNo);})];}
      if(d.musteriler){state.musteriler=[...(state.musteriler||[]),...d.musteriler.filter(function(m){return!(state.musteriler||[]).find(function(x){return x.id===m.id;});})];}
      if(d.urunler){state.urunler=[...(state.urunler||[]),...d.urunler.filter(function(u){return!(state.urunler||[]).find(function(x){return x.id===u.id;});})];}
      if(d.siparisler){if(!state.siparisler)state.siparisler=[];state.siparisler=[...state.siparisler,...d.siparisler.filter(function(s){return!state.siparisler.find(function(x){return x.id===s.id;});})];}
      if(d.faturalar){if(!state.faturalar)state.faturalar=[];state.faturalar=[...state.faturalar,...d.faturalar.filter(function(f){return!state.faturalar.find(function(x){return x.id===f.id;});})];}
      if(d.settings)state.settings=d.settings;
      saveAll();
      if(typeof renderDashboard==='function')renderDashboard();
      if(typeof renderTable==='function')renderTable();
      if(typeof renderTeklifler==='function')renderTeklifler();
      if(typeof renderSiparisler==='function')renderSiparisler();
      if(typeof renderFaturalar==='function')renderFaturalar();
      toast('Yedek yüklendi: '+counts.join(', '),'success');
    }catch(err){console.error(err);toast('Dosya okunamadı veya geçersiz format.','error');}
  };
  r.readAsText(file);e.target.value='';
}
function clearAllData(){
  if(!confirm('TÜM VERİLER SİLİNECEK!\n\nServis, teklif, sipariş, fatura, müşteri ve ürün kayıtları tamamen kaldırılır. Bu işlem geri alınamaz!'))return;
  if(!confirm('Son onay: Devam edilsin mi?'))return;
  state.servisler=[];state.teklifler=[];state.siparisler=[];state.faturalar=[];
  state.musteriler=[];state.urunler=[];
  saveAll();
  if(typeof renderDashboard==='function')renderDashboard();
  if(typeof renderTable==='function')renderTable();
  if(typeof renderTeklifler==='function')renderTeklifler();
  if(typeof renderSiparisler==='function')renderSiparisler();
  if(typeof renderFaturalar==='function')renderFaturalar();
  toast('Tüm veriler silindi.','info');
}

// ════ MODAL HELPERS ════
