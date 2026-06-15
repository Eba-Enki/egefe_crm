// ─── ŞİFRE HASHLEME (Web Crypto API — PBKDF2/SHA-256) ───────────────────────

function generateSalt() {
  var arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

async function hashPassword(password, salt) {
  var enc = new TextEncoder();
  var keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), {name:'PBKDF2'}, false, ['deriveBits']
  );
  var bits = await crypto.subtle.deriveBits(
    {name:'PBKDF2', salt:enc.encode(salt), iterations:100000, hash:'SHA-256'},
    keyMaterial, 256
  );
  return Array.from(new Uint8Array(bits)).map(function(b){return b.toString(16).padStart(2,'0');}).join('');
}

async function verifyPassword(password, hash, salt) {
  return (await hashPassword(password, salt)) === hash;
}
