// ─── API CLIENT ──────────────────────────────────────────────────────────────
// PHP REST API (api/) için ortak fetch sarmalayıcısı. Oturum çerezi ile
// 'same-origin' istek yapar ve hata durumlarını ApiError olarak fırlatır.

const API_BASE = 'api';

async function apiRequest(method, path, body){
  var opts = {method: method, credentials: 'same-origin', headers: {}};
  if(body !== undefined){
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }

  var res;
  try{
    res = await fetch(API_BASE + '/' + path, opts);
  }catch(e){
    var connErr = new Error('Sunucuya bağlanılamadı. İnternet bağlantınızı kontrol edin.');
    connErr.status = 0;
    throw connErr;
  }

  var data = null;
  try{ data = await res.json(); }catch(e){}

  if(!res.ok){
    var err = new Error((data && data.error) || ('İstek başarısız (HTTP ' + res.status + ')'));
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function apiGet(path){ return apiRequest('GET', path); }
function apiPost(path, body){ return apiRequest('POST', path, body); }
function apiPut(path, body){ return apiRequest('PUT', path, body); }
function apiDelete(path){ return apiRequest('DELETE', path); }
