// Hemskärm privat: 127.0.0.1:5204, utåt bara via `tailscale serve --set-path /hemskarm` (tailnet, aldrig Funnel).
// Husvakt-inloggning (samma hashfil som vanner/bt-start). Klientgrinden (auth.json) serveras ALDRIG här;
// js/config.js serveras virtuellt med login:false så appen startar direkt efter Husvakt-login.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { skapaAuth, SESSION_SEK } from './lib/auth.js';
import * as atg from './lib/atgarder.js';

const ROT = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.HEMSKARM_PORT) || 5204;
const PREFIX = '/hemskarm';
const COOKIE = 'hemskarm_session';
const PROXYHUVUDEN = ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'tailscale-user-login', 'tailscale-user-name'];
// Vitlista: bara dessa webbfiler serveras (inte auth.json, tools/, test/, data/, server.mjs, .git).
const FILER = {
  '/index.html': 'text/html; charset=utf-8',
  '/style.css': 'text/css; charset=utf-8',
  '/apps.json': 'application/json; charset=utf-8',
  '/apple-touch-icon.png': 'image/png',
  '/robots.txt': 'text/plain; charset=utf-8',
  '/js/app.js': 'text/javascript; charset=utf-8',
  '/js/pbkdf2.js': 'text/javascript; charset=utf-8',
  '/js/atgarder.js': 'text/javascript; charset=utf-8',
  '/atgarder.css': 'text/css; charset=utf-8',
};
const CONFIG_JS = 'window.HS_CFG={login:false,logout:"logga-ut"};\n';
fs.mkdirSync(path.join(ROT, 'data'), { recursive: true });
const auth = skapaAuth({ inloggFil: path.join(ROT, '..', 'manadsavrakning', 'data', 'inloggning.json'), sessionFil: path.join(ROT, 'data', 'sessioner.json') });
const INLOGG = fs.readFileSync(path.join(ROT, 'inlogg.html'), 'utf8');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const proxad = (req) => PROXYHUVUDEN.some((h) => req.headers[h]);
const arLokal = (req) => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress) && !proxad(req);
const klientIp = (req) => String(req.headers['x-forwarded-for'] || '').split(',')[0].trim().slice(0, 64) || req.socket.remoteAddress;
const https = (req) => String(req.headers['x-forwarded-proto'] || '').toLowerCase() === 'https' || /\.ts\.net(:\d+)?$/i.test(req.headers.host || '');
function skicka(res, kod, kropp, typ = 'text/plain; charset=utf-8', extra = {}) {
  res.writeHead(kod, { 'Content-Type': typ, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow', ...extra });
  res.end(kropp);
}
const omdirigera = (res, dit, extra = {}) => skicka(res, 303, '', 'text/plain; charset=utf-8', { Location: dit, ...extra });
function kaka(req) {
  for (const bit of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = bit.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return null;
}
const kakRad = (req, varde, maxAge) => `${COOKIE}=${varde}; Path=${PREFIX}; Max-Age=${maxAge}; HttpOnly; SameSite=Lax${https(req) ? '; Secure' : ''}`;
function vag(req) {
  let p;
  try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname || '/'); } catch { return null; }
  return p === PREFIX || p.startsWith(`${PREFIX}/`) ? p.slice(PREFIX.length) || '/' : p;
}
function lasKropp(req, max = 10000) {
  return new Promise((resolve) => {
    let b = '';
    req.on('data', (d) => { b += d; if (b.length > max) { b = ''; req.destroy(); } });
    req.on('end', () => resolve(b));
    req.on('error', () => resolve(''));
  });
}
function visaInlogg(res, fel = '', kod = 200) {
  const nonce = crypto.randomBytes(16).toString('base64url');
  const html = INLOGG.replaceAll('{PREFIX}', PREFIX).replaceAll('{NONCE}', nonce).replace('{FEL}', fel ? `<div class="fel">${esc(fel)}</div>` : '');
  skicka(res, kod, html, 'text/html; charset=utf-8', { 'Content-Security-Policy': `default-src 'none'; style-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'` });
}
// Statisk fil med Range-stöd (bytes=a-b, a-, -n).
function skickaFil(req, res, data, typ) {
  const storlek = data.length;
  const r = /^bytes=(\d*)-(\d*)$/.exec(String(req.headers.range || ''));
  const bas = { 'Accept-Ranges': 'bytes' };
  if (!r || (!r[1] && !r[2])) {
    return skicka(res, 200, req.method === 'HEAD' ? '' : data, typ, { ...bas, 'Content-Length': storlek });
  }
  let start = r[1] ? Number(r[1]) : Math.max(0, storlek - Number(r[2]));
  let slut = r[1] && r[2] ? Math.min(Number(r[2]), storlek - 1) : storlek - 1;
  if (start >= storlek || start > slut) return skicka(res, 416, '', typ, { ...bas, 'Content-Range': `bytes */${storlek}` });
  const del = data.subarray(start, slut + 1);
  return skicka(res, 206, req.method === 'HEAD' ? '' : del, typ, { ...bas, 'Content-Range': `bytes ${start}-${slut}/${storlek}`, 'Content-Length': del.length });
}

// Prio 1-4 (1 = platina) per app-id, delas mellan enheter. Skrivs atomiskt till data/prio.json. Bara bakom sessionen (grinden ovan).
const PRIOFIL = path.join(ROT, 'data', 'prio.json');
function lasPrioStrikt() {
  if (!fs.existsSync(PRIOFIL)) return {};
  const o = JSON.parse(fs.readFileSync(PRIOFIL, 'utf8'));
  if (!o || typeof o !== 'object' || Array.isArray(o)) throw new Error('prio.json ogiltig');
  return o;
}
function lasPrio() { try { const o = JSON.parse(fs.readFileSync(PRIOFIL, 'utf8')); return o && typeof o === 'object' && !Array.isArray(o) ? o : {}; } catch { return {}; } }
function appIds() { try { return new Set((JSON.parse(fs.readFileSync(path.join(ROT, 'apps.json'), 'utf8')).apps || []).map((a) => String(a.id))); } catch { return new Set(); } }
async function hanteraPrio(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') return skicka(res, 200, JSON.stringify({ prio: lasPrio() }), 'application/json; charset=utf-8');
  if (req.method !== 'POST') return skicka(res, 405, 'Metod ej tillåten', undefined, { Allow: 'GET, HEAD, POST' });
  if (!/^application\/json/i.test(String(req.headers['content-type'] || ''))) return skicka(res, 415, 'Kräver application/json');
  let b;
  try { b = JSON.parse(await lasKropp(req, 2000)); } catch { return skicka(res, 400, 'Ogiltig JSON'); }
  const id = b && typeof b.id === 'string' ? b.id : '';
  const p = b ? b.prio : undefined;
  if (!id || id.length > 100 || !appIds().has(id)) return skicka(res, 400, 'Okänt id');
  if (!(p === null || (Number.isInteger(p) && p >= 1 && p <= 4))) return skicka(res, 400, 'prio måste vara 1-4 eller null');
  let nu;
  try { nu = lasPrioStrikt(); } catch (e) { console.error(e.message); return skicka(res, 500, 'prio.json oläsbar, skriver inte över'); }
  if (p === null) delete nu[id]; else nu[id] = p;
  const tmp = PRIOFIL + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify(nu, null, 1)); fs.renameSync(tmp, PRIOFIL); } catch (e) { console.error(e.message); return skicka(res, 500, 'Kunde inte spara'); }
  return skicka(res, 200, JSON.stringify({ ok: true, prio: nu }), 'application/json; charset=utf-8');
}

async function hantera(req, res) {
  const v = vag(req);
  if (v === null) return skicka(res, 400, 'Ogiltig sökväg');
  if (v === '/api/halsa') return skicka(res, 200, '{"ok":true}', 'application/json');
  if (v === '/logga-in') {
    if (req.method !== 'POST') return visaInlogg(res);
    const ip = klientIp(req);
    const f = new URLSearchParams(await lasKropp(req));
    if (auth.sparrad(ip)) return visaInlogg(res, 'För många felaktiga försök. Vänta 15 minuter.', 429);
    if (!auth.kontrollera((f.get('epost') || '').slice(0, 200), (f.get('losen') || '').slice(0, 500))) {
      auth.noteraFel(ip);
      return visaInlogg(res, 'Fel e-post eller lösenord.', 401);
    }
    auth.rensaFel(ip);
    return omdirigera(res, `${PREFIX}/`, { 'Set-Cookie': kakRad(req, auth.nySession(), SESSION_SEK) });
  }
  if (v === '/logga-ut') {
    auth.taBort(kaka(req));
    return omdirigera(res, `${PREFIX}/logga-in`, { 'Set-Cookie': kakRad(req, '', 0) });
  }
  if (!(arLokal(req) || auth.giltig(kaka(req)))) return omdirigera(res, `${PREFIX}/logga-in`);
  if (v === '/api/prio') return hanteraPrio(req, res);
  if (v === '/api/state') return hanteraState(req, res);
  if (v === '/api/atgarder' || /^\/api\/atgarder\/[A-Za-z0-9_-]{1,64}\/klar$/.test(v)) return hanteraAtgarder(req, res, v);
  if (req.method !== 'GET' && req.method !== 'HEAD') return skicka(res, 405, 'Metod ej tillåten', undefined, { Allow: 'GET, HEAD' });
  if (v === '/js/config.js') return skickaFil(req, res, Buffer.from(CONFIG_JS), 'text/javascript; charset=utf-8');
  if (/^\/img\/preview\/[a-z0-9-]{1,80}\.jpg$/.test(v)) {
    let bild;
    try { bild = fs.readFileSync(path.join(ROT, v.slice(1))); } catch { return skicka(res, 404, 'Hittas inte'); }
    return skickaFil(req, res, bild, 'image/jpeg');
  }
  const nyckel = v === '/' ? '/index.html' : v;
  const typ = FILER[nyckel];
  if (!typ) return skicka(res, 404, 'Hittas inte');
  let data;
  try { data = fs.readFileSync(path.join(ROT, nyckel.slice(1))); } catch { return skicka(res, 404, 'Hittas inte'); }
  // <base> så relativa sökvägar fungerar även på /hemskarm utan avslutande snedstreck (Tailscale strippar prefixet).
  if (nyckel === '/index.html') data = Buffer.from(data.toString('utf8').replace('<head>', `<head>\n<base href="${PREFIX}/">`));
  return skickaFil(req, res, data, typ);
}

http.createServer((req, res) => {
  hantera(req, res).catch((e) => { try { skicka(res, 500, 'Serverfel'); } catch {} console.error(e.message); });
}).listen(PORT, '127.0.0.1', () => console.log(`Hemskärm lyssnar på 127.0.0.1:${PORT} (utåt: tailscale serve /hemskarm)`));

// ---- UI-state (filter, vy, redigeringar) delas mellan enheter: data/state.json {ts, state}. Bara bakom sessionen.
const STATEFIL = path.join(ROT, 'data', 'state.json');
const VYER = new Set(['home', 'prio', 'edit']);
function lasState() { try { const o = JSON.parse(fs.readFileSync(STATEFIL, 'utf8')); return o && typeof o.ts === 'number' ? o : { ts: 0, state: null }; } catch { return { ts: 0, state: null }; } }
function giltigtState(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  if (!Array.isArray(s.pfilt) || s.pfilt.length > 5 || !s.pfilt.every((x) => ['1', '2', '3', '4', 'x'].includes(x))) return false;
  if (typeof s.kat !== 'string' || s.kat.length > 80 || typeof s.sok !== 'string' || s.sok.length > 200) return false;
  if (typeof s.pv !== 'boolean' || !VYER.has(s.vy)) return false;
  const m = s.man;
  if (!m || typeof m !== 'object' || !m.overrides || typeof m.overrides !== 'object' || Array.isArray(m.overrides) || !Array.isArray(m.nya) || !Array.isArray(m.dolda)) return false;
  if (m.nya.length > 200 || m.dolda.length > 500) return false;
  return true;
}
async function hanteraState(req, res) {
  if (req.method === 'GET' || req.method === 'HEAD') return skicka(res, 200, JSON.stringify(lasState()), 'application/json; charset=utf-8');
  if (req.method !== 'POST') return skicka(res, 405, 'Metod ej tillåten', undefined, { Allow: 'GET, HEAD, POST' });
  if (!/^application\/json/i.test(String(req.headers['content-type'] || ''))) return skicka(res, 415, 'Kräver application/json');
  let b;
  try { b = JSON.parse(await lasKropp(req, 300000)); } catch { return skicka(res, 400, 'Ogiltig JSON'); }
  if (!b || typeof b.ts !== 'number' || !Number.isFinite(b.ts) || !giltigtState(b.state)) return skicka(res, 400, 'Ogiltigt state');
  const nu = lasState();
  if (b.ts < nu.ts) return skicka(res, 409, JSON.stringify(nu), 'application/json; charset=utf-8');
  const tmp = STATEFIL + '.tmp';
  try { fs.writeFileSync(tmp, JSON.stringify({ ts: b.ts, state: b.state })); fs.renameSync(tmp, STATEFIL); } catch (e) { console.error(e.message); return skicka(res, 500, 'Kunde inte spara'); }
  return skicka(res, 200, '{"ok":true}', 'application/json; charset=utf-8');
}
// ---- Åtgärder (data/atgarder.json): GET lista, POST skapa/uppdatera, POST /<id>/klar. Bara bakom sessionen (grinden i hantera).
// POST kräver application/json (utlöser CORS-preflight korsorigin) och, om Origin finns, samma värd som Host.
function samOrigin(req) {
  const o = req.headers.origin;
  if (!o) return true;
  try { return new URL(o).host === String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim(); } catch { return false; }
}
async function hanteraAtgarder(req, res, v) {
  const json = 'application/json; charset=utf-8';
  if (req.method === 'GET' || req.method === 'HEAD') {
    try { return skicka(res, 200, JSON.stringify({ atgarder: atg.sorterad(atg.las()) }), json); } catch (e) { console.error(e.message); return skicka(res, 500, 'atgarder.json oläsbar'); }
  }
  if (req.method !== 'POST') return skicka(res, 405, 'Metod ej tillåten', undefined, { Allow: 'GET, HEAD, POST' });
  if (!samOrigin(req)) return skicka(res, 403, 'Fel origin');
  if (!/^application\/json/i.test(String(req.headers['content-type'] || ''))) return skicka(res, 415, 'Kräver application/json');
  const m = /^\/api\/atgarder\/([A-Za-z0-9_-]{1,64})\/klar$/.exec(v);
  try {
    if (m) { await lasKropp(req, 2000); return skicka(res, 200, JSON.stringify({ ok: true, atgard: atg.markera(m[1]) }), json); }
    let b;
    try { b = JSON.parse(await lasKropp(req, 20000)); } catch { return skicka(res, 400, 'Ogiltig JSON'); }
    return skicka(res, 200, JSON.stringify({ ok: true, atgard: atg.spara(b) }), json);
  } catch (e) {
    if (e.kod === 404) return skicka(res, 404, e.message);
    if (/^(Ogiltig|Okänd|.* (saknas|måste|för lång|ser ut)|För många)/.test(e.message)) return skicka(res, 400, e.message);
    console.error(e.message); return skicka(res, 500, 'Kunde inte spara');
  }
}
// Daglig säkerhetskopia av prio.json (behåll 14).
function backupPrio() {
  try {
    const o = lasPrioStrikt();
    if (!Object.keys(o).length) return;
    const dir = path.join(ROT, 'data', 'backup');
    fs.mkdirSync(dir, { recursive: true });
    const f = path.join(dir, `prio-${new Date().toISOString().slice(0, 10)}.json`);
    if (!fs.existsSync(f)) fs.copyFileSync(PRIOFIL, f);
    const alla = fs.readdirSync(dir).filter((n) => /^prio-\d{4}-\d{2}-\d{2}\.json$/.test(n)).sort();
    for (const n of alla.slice(0, Math.max(0, alla.length - 14))) fs.unlinkSync(path.join(dir, n));
  } catch (e) { console.error('backup: ' + e.message); }
}
backupPrio();
setInterval(backupPrio, 3600 * 1000).unref();
