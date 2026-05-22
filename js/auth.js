function selectPortal(pkey){
  currentPortal=pkey;
  // Set default users for this portal
  var defaultServisUsers=[
    {id:'u1',ad:'Admin',username:'admin',sifre:'admin',rol:'admin',email:'',sonGiris:null},
    {id:'u2',ad:'Teknisyen',username:'teknisyen',sifre:'1234',rol:'teknisyen',email:'',sonGiris:null},
    {id:'u3',ad:'İzleyici',username:'izleyici',sifre:'1234',rol:'izleyici',email:'',sonGiris:null}
  ];
  var defaultSatisUsers=[
    {id:'s1',ad:'Satış Admin',username:'satis',sifre:'satis',rol:'admin',email:'',sonGiris:null},
    {id:'s2',ad:'Satış Uzmanı',username:'uzman',sifre:'1234',rol:'teknisyen',email:'',sonGiris:null}
  ];
  // Load portal-specific state
  state.users=DB.pload('users', pkey==='servis'?defaultServisUsers:defaultSatisUsers);
  state.servisler=pkey==='servis'?DB.pload('servisler',genSample()):[];
  state.teklifler=DB.pload('teklifler',[]);
  state.musteriler=DB.pload('musteriler',[]);
  state.urunler=DB.pload('urunler',[]);
  state.settings=DB.pload('settings',{firma:'Egefe Teknik Servis',tel:'',faks:'',adres:'',email:'',web:''});
  savedTutanaklar=[];
  // Check existing session
  var saved=sessionStorage.getItem('ege_ses_'+pkey);
  if(saved){
    try{
      var sd=JSON.parse(saved);
      var found=state.users.find(function(x){return x.id===sd.id&&x.username===sd.username;});
      if(found){
        state.currentUser=found;
        document.getElementById('portal-screen').style.display='none';
        applyUser(found);
        applyPortal();
        initApp();
        return;
      }
    }catch(e){}
  }
  // Show login
  document.getElementById('portal-screen').style.display='none';
  var nameEl=document.getElementById('login-portal-name');
  if(nameEl)nameEl.textContent=pkey==='servis'?'Teknik Servis Portalı':'Satış Pazarlama Portalı';
  document.getElementById('login-screen').style.display='flex';
}

function backToPortal(){
  document.getElementById('login-screen').style.display='none';
  document.getElementById('portal-screen').style.display='flex';
  document.getElementById('login-user').value='';
  document.getElementById('login-pass').value='';
  document.getElementById('login-error').style.display='none';
}

function applyPortal(){
  // Show/hide portal-specific sidebar items
  var isServis=currentPortal==='servis';
  document.querySelectorAll('.servis-only').forEach(function(el){
    el.style.display=isServis?'':'none';
  document.querySelectorAll('.satis-only').forEach(function(el){el.style.display=isServis?'none':'';});
  document.querySelectorAll('.td-sorumlu').forEach(function(el){el.style.display=isServis?'none':'';});
  var thS=document.getElementById('th-sorumlu');if(thS)thS.style.display=isServis?'none':'';
  });
  // Badge
  var badge=document.getElementById('portal-badge');
  if(badge){
    badge.textContent=isServis?'Teknik Servis':'Satış & Pazarlama';
    badge.className='portal-badge '+(isServis?'portal-badge-servis':'portal-badge-satis');
  }
  // Sidebar portal name
  var sbpn=document.getElementById('sb-portal-name');
  if(sbpn)sbpn.textContent=isServis?'Teknik Servis Portalı':'Satış Pazarlama Portalı';
  // Show/hide teklif form portal-specific fields
  document.querySelectorAll('.tf-servis-field').forEach(function(el){el.style.display=isServis?'':'none';});
  document.querySelectorAll('.tf-satis-field').forEach(function(el){el.style.display=isServis?'none':'';});
  // Dashboard default page
  var defaultPage=isServis?'dashboard':'teklifler';
  showPage(defaultPage);
}

function switchPortal(){
  if(!confirm('Portala geri dönmek istiyor musunuz? Mevcut oturum kapatılacak.'))return;
  sessionStorage.removeItem('ege_ses_'+currentPortal);
  state.currentUser=null;
  currentPortal='';
  document.getElementById('portal-screen').style.display='flex';
  document.getElementById('main').querySelector('#page-dashboard').classList.add('active');
}

function doLogin(){
  const u=document.getElementById('login-user').value.trim();
  const p=document.getElementById('login-pass').value;
  const user=state.users.find(x=>x.username===u&&x.sifre===p);
  if(!user){document.getElementById('login-error').style.display='block';return}
  document.getElementById('login-error').style.display='none';
  user.sonGiris=new Date().toISOString();state.currentUser=user;saveAll();
  sessionStorage.setItem('ege_ses_'+currentPortal,JSON.stringify({id:user.id,username:user.username}));
  applyUser(user);document.getElementById('login-screen').style.display='none';
  applyPortal();
  initApp();
}
function applyUser(u){
  document.getElementById('sb-avatar').textContent=u.ad[0].toUpperCase();
  document.getElementById('sb-username').textContent=u.ad;
  document.getElementById('sb-role-text').textContent={admin:'Yönetici',teknisyen:'Teknisyen',izleyici:'İzleyici'}[u.rol]||u.rol;
  document.querySelectorAll('.admin-only').forEach(el=>el.style.display=u.rol==='admin'?'':'none');
  document.querySelectorAll('.can-write').forEach(el=>el.style.display=u.rol==='izleyici'?'none':'');
}
function doLogout(){if(!confirm('Çıkış yapılsın mı?'))return;sessionStorage.removeItem('ege_ses_'+currentPortal);state.currentUser=null;document.getElementById('login-screen').style.display='none';document.getElementById('portal-screen').style.display='flex';}
document.getElementById('login-pass').addEventListener('keydown',e=>e.key==='Enter'&&doLogin());
document.getElementById('login-user').addEventListener('keydown',e=>e.key==='Enter'&&document.getElementById('login-pass').focus());

// ════ NAV ════
