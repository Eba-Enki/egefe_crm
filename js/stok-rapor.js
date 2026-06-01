// ═══════════════════════════════════════════════════════
//  STOK TAKİP — RAPOR (CSV + PDF)
// ═══════════════════════════════════════════════════════

function stokExportCSV(){
  stokInit();
  var rows=[['Tarih','Tür','LOT / Ref','Açıklama','Kategori','Miktar','Kullanıcı']];
  var TIP={'ham-giris':'Ham Giriş','ham-cikis':'Ham Çıkış','bitmis-giris':'Bitmiş Giriş','bitmis-cikis':'Bitmiş Çıkış'};

  stokTumHareketler().forEach(function(h){
    var kat=(stokKatById(h.kategoriId)||{}).ad||h.kategoriId||'';
    rows.push([
      h.tarih||'',
      TIP[h.tip]||h.tip,
      h.lotNo||h.ref||'',
      h.aciklama||'',
      kat,
      h.miktarStr||'',
      h.kullanici||''
    ]);
  });

  var csv=rows.map(function(r){
    return r.map(function(c){
      var s=String(c||'').replace(/"/g,'""');
      return '"'+s+'"';
    }).join(',');
  }).join('\r\n');

  var bom='﻿';
  var blob=new Blob([bom+csv],{type:'text/csv;charset=utf-8;'});
  var url=URL.createObjectURL(blob);
  var a=document.createElement('a');
  a.href=url;
  a.download='Stok_Hareket_'+new Date().toISOString().slice(0,10)+'.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('CSV dosyası indirildi.','success');
}

function stokPrintHareket(){
  stokInit();
  var hareketler=stokTumHareketler();

  // Apply active filters
  var fTS=(document.getElementById('sh-tarih-s')||{}).value||'';
  var fTE=(document.getElementById('sh-tarih-e')||{}).value||'';
  var fTip=(document.getElementById('sh-tip')||{}).value||'';
  var fKat=(document.getElementById('sh-kat')||{}).value||'';
  var fLot=((document.getElementById('sh-lot')||{}).value||'').toLowerCase();
  hareketler=hareketler.filter(function(h){
    if(fTS&&(h.tarih||'')<fTS) return false;
    if(fTE&&(h.tarih||'')>fTE) return false;
    if(fTip&&h.tip!==fTip) return false;
    if(fKat&&h.kategoriId!==fKat) return false;
    if(fLot&&!(h.lotNo||'').toLowerCase().includes(fLot)) return false;
    return true;
  });

  var {jsPDF}=window.jspdf;
  var doc=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.setTextColor(30,46,59);
  doc.text('Stok Hareket Raporu',14,18);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(130,150,170);
  doc.text('Egefe Bilişim Sağlık — '+(new Date().toLocaleDateString('tr-TR')),14,25);

  var TIP={'ham-giris':'Ham Giriş','ham-cikis':'Ham Çıkış','bitmis-giris':'Bitmiş Giriş','bitmis-cikis':'Bitmiş Çıkış'};
  var body=hareketler.map(function(h){
    return [
      h.tarih||'',
      TIP[h.tip]||h.tip,
      h.lotNo||h.ref||'',
      (h.aciklama||'').slice(0,60),
      (stokKatById(h.kategoriId)||{}).ad||h.kategoriId||'',
      h.miktarStr||'',
      h.kullanici||''
    ];
  });

  doc.autoTable({
    startY:30,
    head:[['Tarih','Tür','LOT','Açıklama','Kategori','Miktar','Kullanıcı']],
    body:body,
    styles:{fontSize:8,cellPadding:2.5},
    headStyles:{fillColor:[30,123,168],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,248,250]},
    columnStyles:{0:{cellWidth:22},1:{cellWidth:22},2:{cellWidth:28},3:{cellWidth:70},4:{cellWidth:22},5:{cellWidth:30},6:{cellWidth:22}}
  });

  doc.save('Stok_Hareket_Raporu_'+new Date().toISOString().slice(0,10)+'.pdf');
  toast('PDF raporu indirildi.','success');
}

function stokPrintStokDurumu(){
  stokInit();
  var {jsPDF}=window.jspdf;
  var doc=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  doc.setFont('helvetica','bold');
  doc.setFontSize(14);
  doc.setTextColor(30,46,59);
  doc.text('Stok Durum Raporu',14,18);
  doc.setFont('helvetica','normal');
  doc.setFontSize(9);
  doc.setTextColor(130,150,170);
  doc.text('Egefe Bilişim Sağlık — '+(new Date().toLocaleDateString('tr-TR')),14,25);

  // Ham stok özeti
  var hamRows=[];
  var groups={};
  (state.hamStokLotlar||[]).forEach(function(l){
    var key=l.parametreAd+'||'+l.kategoriId+'||'+(l.cutoff||'');
    if(!groups[key]) groups[key]={parametreAd:l.parametreAd,cutoff:l.cutoff||'',kategoriId:l.kategoriId,toplamStrip:0,lotSayisi:0};
    groups[key].toplamStrip+=l.mevcutStrip;
    groups[key].lotSayisi++;
  });
  Object.values(groups).forEach(function(g){
    var kat=(stokKatById(g.kategoriId)||{}).ad||g.kategoriId;
    var sps=stokSPS(g.kategoriId);
    hamRows.push([
      g.parametreAd,g.cutoff||'—',kat,
      String(Math.floor(g.toplamStrip/sps)),
      String(g.toplamStrip.toLocaleString('tr-TR')),
      String(g.lotSayisi)
    ]);
  });

  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(30,46,59);
  doc.text('Ham Stok (Strip)',14,33);

  doc.autoTable({
    startY:37,
    head:[['Parametre','Cut-off','Kategori','Mevcut Sheet','Mevcut Strip','LOT Sayısı']],
    body:hamRows.length?hamRows:[['—','—','—','—','—','—']],
    styles:{fontSize:8,cellPadding:2.5},
    headStyles:{fillColor:[30,123,168],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,248,250]}
  });

  // Bitmiş stok
  var bitRows=[];
  var bitGroups={};
  (state.bitmisStokLotlar||[]).forEach(function(l){
    var key=l.urunAdi+'||'+l.kategoriId;
    if(!bitGroups[key]) bitGroups[key]={urunAdi:l.urunAdi,kategoriId:l.kategoriId,parametreler:l.parametreler||[],toplamMevcut:0,lotSayisi:0};
    bitGroups[key].toplamMevcut+=l.mevcutMiktar;
    bitGroups[key].lotSayisi++;
  });
  Object.values(bitGroups).forEach(function(g){
    var kat=(stokKatById(g.kategoriId)||{}).ad||g.kategoriId;
    bitRows.push([g.urunAdi,kat,(g.parametreler||[]).join(', '),String(g.toplamMevcut.toLocaleString('tr-TR')),String(g.lotSayisi)]);
  });

  var yBit=doc.lastAutoTable.finalY+10;
  doc.setFont('helvetica','bold');
  doc.setFontSize(10);
  doc.setTextColor(30,46,59);
  doc.text('Bitmiş Ürün Stok',14,yBit);

  doc.autoTable({
    startY:yBit+4,
    head:[['Ürün Adı','Kategori','Parametreler','Mevcut Adet','LOT Sayısı']],
    body:bitRows.length?bitRows:[['—','—','—','—','—']],
    styles:{fontSize:8,cellPadding:2.5},
    headStyles:{fillColor:[22,163,74],textColor:255,fontStyle:'bold'},
    alternateRowStyles:{fillColor:[245,248,250]}
  });

  doc.save('Stok_Durum_'+new Date().toISOString().slice(0,10)+'.pdf');
  toast('Stok durum raporu indirildi.','success');
}
