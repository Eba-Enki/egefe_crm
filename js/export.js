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


// ════ SİPARİŞLER ════
// ════ IMPORT / EXPORT ════
function exportData(){
  const blob=new Blob([JSON.stringify({version:5,exportDate:new Date().toISOString(),servisler:state.servisler,teklifler:state.teklifler,musteriler:state.musteriler,urunler:state.urunler,users:state.users,settings:state.settings},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`egefe_yedek_${today()}.json`;a.click();toast('Dışa aktarıldı.','success');
}
function importData(e){
  const file=e.target.files[0];if(!file)return;
  const r=new FileReader();
  r.onload=ev=>{try{
    const d=JSON.parse(ev.target.result);if(!d.servisler)throw 0;
    if(!confirm(`${d.servisler.length} servis kaydı içe aktarılacak. Devam?`))return;
    const ex=new Set(state.servisler.map(s=>s.kayitNo));
    state.servisler=[...state.servisler,...d.servisler.filter(s=>!ex.has(s.kayitNo))];
    if(d.teklifler){const ext=new Set(state.teklifler.map(t=>t.teklifNo));state.teklifler=[...state.teklifler,...d.teklifler.filter(t=>!ext.has(t.teklifNo))]}
    if(d.musteriler)state.musteriler=[...state.musteriler,...d.musteriler.filter(m=>!state.musteriler.find(x=>x.id===m.id))];
    if(d.urunler)state.urunler=[...state.urunler,...d.urunler.filter(u=>!state.urunler.find(x=>x.id===u.id))];
    if(d.settings)state.settings=d.settings;
    saveAll();renderDashboard();renderTable();toast('İçe aktarıldı.','success');
  }catch{toast('Dosya okunamadı.','error')}};
  r.readAsText(file);e.target.value='';
}
function clearAllData(){if(!confirm('TÜM VERİLER silinecek!'))return;if(!confirm('Son onay?'))return;state.servisler=[];state.teklifler=[];saveAll();renderDashboard();renderTable();toast('Veriler silindi.','info')}

// ════ MODAL HELPERS ════
