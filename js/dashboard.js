function renderDashboard(){
  const s=state.servisler;
  const aktif=s.filter(x=>!['Tamamlandı','Reddedildi'].includes(x.durum));
  const bekl=s.filter(x=>['Onay Bekleniyor','S.F. Bekleniyor'].includes(x.durum));
  const buAy=s.filter(x=>{const d=new Date(x.gelisTarihi),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear()});
  const tl=state.teklifler;
  const sps=state.siparisler||[];
  // Stat cards
  const statEl=document.getElementById('stat-cards');
  if(statEl){
    if(currentPortal==='satis'){
      statEl.innerHTML=
        '<div class="stat-card"><div class="stat-label">Toplam Teklif</div><div class="stat-value" style="color:var(--accent)">'+tl.length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Açık Teklif</div><div class="stat-value" style="color:var(--teal)">'+tl.filter(function(t){return['Açık Teklif','Taslak'].includes(t.durum);}).length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Kabul Edilen Teklif</div><div class="stat-value" style="color:var(--green)">'+tl.filter(function(t){return t.durum==='Kabul Edildi';}).length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Reddedilen Teklif</div><div class="stat-value" style="color:var(--red)">'+tl.filter(function(t){return['Reddedildi','İptal Edildi'].includes(t.durum);}).length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Açık Sipariş</div><div class="stat-value" style="color:var(--amber)">'+sps.filter(function(s){return s.durum==='Hazırlanıyor';}).length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Tamamlanan Siparişler</div><div class="stat-value" style="color:var(--purple)">'+sps.filter(function(s){return s.durum==='Tamamlandı';}).length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">İptal Edilen</div><div class="stat-value" style="color:var(--text3)">'+sps.filter(function(s){return s.durum==='İptal';}).length+'</div></div>';
    } else {
      statEl.innerHTML=
        '<div class="stat-card"><div class="stat-label">Toplam Servis</div><div class="stat-value" style="color:var(--accent)">'+s.length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Aktif</div><div class="stat-value" style="color:var(--teal)">'+aktif.length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Onay Bekleyen</div><div class="stat-value" style="color:var(--amber)">'+bekl.length+'</div></div>'
        +'<div class="stat-card"><div class="stat-label">Bu Ay</div><div class="stat-value" style="color:var(--purple)">'+buAy.length+'</div></div>';
    }
  }
  // Donut chart (servis portal)
  const DURUM_COLORS={'Yeni Gelen':'#2dd4bf','S.F. Bekleniyor':'#f59e0b','Onay Bekleniyor':'#818cf8','Onaylandı':'#4ade80','Kargoya Verildi':'#a78bfa','Tamamlandı':'#94a3b8','Reddedildi':'#f87171'};
  const sg=Object.entries(DURUM_COLORS).map(function([d,c]){return{d:d,c:c,cnt:s.filter(function(x){return x.durum===d;}).length};}).filter(function(x){return x.cnt>0;});
  const total=s.length||1;
  const CX=70,CY=70,R=50,circ=2*Math.PI*R;
  const svgEl=document.getElementById('donut-svg');
  if(svgEl){
    let off=0;
    svgEl.innerHTML=sg.map(function(seg){const pct=seg.cnt/total;const d='<circle cx="'+CX+'" cy="'+CY+'" r="'+R+'" fill="none" stroke="'+seg.c+'" stroke-width="20" stroke-dasharray="'+(pct*circ).toFixed(2)+' '+(circ-(pct*circ)).toFixed(2)+'" stroke-dashoffset="'+(-off*circ).toFixed(2)+'" transform="rotate(-90 '+CX+' '+CY+'"><title>'+seg.d+': '+seg.cnt+'</title></circle>';off+=pct;return d;}).join('');
    document.getElementById('dc-total').textContent=s.length;
  }
  const legendEl=document.getElementById('durum-legend');
  if(legendEl)legendEl.innerHTML=sg.map(function(seg){return'<div style="display:flex;align-items:center;gap:7px;font-size:12px;margin:2px 0"><span style="width:10px;height:10px;border-radius:50%;background:'+seg.c+';display:inline-block;flex-shrink:0"></span><span style="color:var(--text2);flex:1">'+seg.d+'</span><span style="font-weight:600;font-family:\'DM Mono\',monospace;color:var(--text2)">'+seg.cnt+'</span></div>';}).join('');
  // Teklif durum chart
  const titleEl=document.getElementById('durum-chart-title');
  if(titleEl)titleEl.textContent='Teklif Durum Dağılımı';
  const tklDurumlar=currentPortal==='satis'?['Taslak','Açık Teklif','Kabul Edildi','Reddedildi']:['Onay Bekleniyor','Onaylandı','Reddedildi'];
  const tklColors=currentPortal==='satis'?['#94a3b8','#2dd4bf','#4ade80','#f87171']:['#f59e0b','#4ade80','#f87171'];
  const tklChart=document.getElementById('teklif-durum-chart');
  if(tklChart){
    const tklTotal=tl.length||1;
    tklChart.innerHTML=tklDurumlar.map(function(d,i){
      const cnt=tl.filter(function(t){return t.durum===d;}).length;
      const pct=Math.round(cnt/tklTotal*100);
      return'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text2)">'+d+'</span><span style="font-family:DM Mono,monospace;color:var(--text3)">'+cnt+'</span></div><div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+tklColors[i]+';border-radius:4px"></div></div></div>';
    }).join('')+'<div style="margin-top:12px;font-size:11px;color:var(--text3);text-align:right">Toplam: <strong style="color:var(--text)">'+tl.length+'</strong> teklif</div>';
  }
  // Recent list (servis portal)
  const rlEl=document.getElementById('recent-list');
  if(rlEl){
    if(currentPortal==='satis'){
      // Sipariş durum dağılımı
      const spDurs=[{l:'Hazırlanıyor',c:'#f59e0b'},{l:'Kısmen Sevk Edildi',c:'#2dd4bf'},{l:'Tamamlandı',c:'#4ade80'},{l:'İptal',c:'#f87171'}];
      const spTotal=sps.length||1;
      rlEl.innerHTML=spDurs.map(function(sd){
        const cnt=sps.filter(function(x){return x.durum===sd.l;}).length;
        const pct=Math.round(cnt/spTotal*100);
        return'<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px"><span style="color:var(--text2)">'+sd.l+'</span><span style="font-family:DM Mono,monospace;color:var(--text3)">'+cnt+'</span></div><div style="height:8px;background:var(--bg3);border-radius:4px;overflow:hidden"><div style="height:100%;width:'+pct+'%;background:'+sd.c+';border-radius:4px"></div></div></div>';
      }).join('')+'<div style="margin-top:12px;font-size:11px;color:var(--text3);text-align:right">Toplam: <strong style="color:var(--text)">'+sps.length+'</strong> sipariş</div>';
    } else {
      const recent=[...s].sort((a,b)=>new Date(b.olusturmaTarihi)-new Date(a.olusturmaTarihi)).slice(0,6);
      rlEl.innerHTML=recent.length?recent.map(r=>`<div style="padding:8px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:9px;cursor:pointer" onclick="goServisForm('${r.id}')"><div style="flex:1;min-width:0"><div style="font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.kurumAdi}</div><div style="font-size:11px;color:var(--text3)">${r.kayitNo}</div></div>${durumBadge(r.durum)}</div>`).join(''):'<div style="font-size:13px;color:var(--text3)">Kayıt yok.</div>';
    }
  }
  // "Son Eklenen" / "Sipariş Durum Dağılımı" title
  const rlTitle=document.getElementById('recent-list-title');
  if(rlTitle)rlTitle.textContent=currentPortal==='satis'?'Sipariş Durum Dağılımı':'Son Eklenen';
}

function showDurumMenu(sid, btnEl){
