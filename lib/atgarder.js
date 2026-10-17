// Åtgärder: saker Marc måste göra (logga in, fylla i, godkänna ...). Delas av server.mjs och tools/begar.mjs.
// Fil: data/atgarder.json (gitignorerad, privat). Skrivs atomiskt under ett mapplås. Aldrig hemligheter här.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIL = path.join(ROT, 'data', 'atgarder.json');
const LAS = FIL + '.lock';
export const PRIO = ['hog', 'normal', 'lag'];
export const STATUS = ['oppen', 'klar', 'avvisad'];
export const KALLA = ['Boss', 'agent', 'rutin'];
export const KATEGORI = ['logga-in', 'fyll-i', 'godkann', 'kor-kommando', 'granska', 'beslut'];
const MAX_ANTAL = 500, MAX_TITEL = 120, MAX_FORKLARING = 4000, MAX_FIL = 1024 * 1024, BEHALL_KLARA_MS = 30 * 86400000;
// Grov hemlighetsspärr: avvisar uppenbara nycklar/lösenord i text.
const HEMLIGT = /(sk-[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|(?:l[öo]senord|password|passwd|secret|token|api[-_ ]?key)\s*[:=]\s*[^\s<"'`]{6,})/i;

export function appIds() {
  try { return new Set((JSON.parse(fs.readFileSync(path.join(ROT, 'apps.json'), 'utf8')).apps || []).map((a) => String(a.id))); } catch { return new Set(); }
}
export function las() {
  let t;
  try { t = fs.readFileSync(FIL, 'utf8'); } catch (e) { if (e.code === 'ENOENT') return []; throw e; }
  const o = JSON.parse(t);
  if (!Array.isArray(o)) throw new Error('atgarder.json ogiltig (ingen lista), skriver inte över');
  return o;
}
export function sorterad(lista) { return lista.slice().sort((a, b) => String(b.uppdaterad).localeCompare(String(a.uppdaterad))); }

function medLas(fn) {
  fs.mkdirSync(path.dirname(FIL), { recursive: true });
  const start = Date.now();
  for (;;) {
    try { fs.mkdirSync(LAS); break; } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      try { if (Date.now() - fs.statSync(LAS).mtimeMs > 10000) { fs.rmdirSync(LAS); continue; } } catch {}
      if (Date.now() - start > 5000) throw new Error('Kunde inte ta fillås (atgarder)');
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
    }
  }
  try { return fn(); } finally { try { fs.rmdirSync(LAS); } catch {} }
}
function skriv(lista) {
  const nu = Date.now();
  lista = lista.filter((a) => !(a.status !== 'oppen' && nu - Date.parse(a.uppdaterad) > BEHALL_KLARA_MS));
  const txt = JSON.stringify(lista, null, 1);
  if (txt.length > MAX_FIL) throw new Error('atgarder.json för stor');
  const tmp = FIL + '.tmp';
  fs.writeFileSync(tmp, txt);
  fs.renameSync(tmp, FIL);
}
const str = (v, max, namn, krav) => {
  if (v === undefined || v === null) { if (krav) throw new Error(namn + ' saknas'); return undefined; }
  if (typeof v !== 'string') throw new Error(namn + ' måste vara text');
  v = v.replace(/\r\n/g, '\n').trim();
  if (krav && !v) throw new Error(namn + ' saknas');
  if (v.length > max) throw new Error(namn + ' för lång (max ' + max + ')');
  if (HEMLIGT.test(v)) throw new Error(namn + ' ser ut att innehålla en hemlighet (nyckel/lösenord). Lägg aldrig sådant här.');
  return v;
};
const val = (v, lista, namn) => {
  if (v === undefined || v === null || v === '') return undefined;
  if (lista.indexOf(v) < 0) throw new Error(namn + ' måste vara ett av: ' + lista.join(', '));
  return v;
};
// Validerar fält (delvis för uppdatering, fullt för skapande).
function rensa(b, full) {
  if (!b || typeof b !== 'object' || Array.isArray(b)) throw new Error('Ogiltigt objekt');
  const u = {};
  const app = str(b.app, 100, 'app', full);
  if (app !== undefined) { if (!appIds().has(app)) throw new Error('Okänd app: ' + app); u.app = app; }
  const t = str(b.titel, MAX_TITEL, 'titel', full); if (t !== undefined) u.titel = t;
  const f = str(b.forklaring, MAX_FORKLARING, 'forklaring', full); if (f !== undefined) u.forklaring = f;
  const p = val(b.prio, PRIO, 'prio'); if (p) u.prio = p;
  const s = val(b.status, STATUS, 'status'); if (s) u.status = s;
  const k = val(b.kalla, KALLA, 'kalla'); if (k) u.kalla = k;
  const c = val(b.kategori, KATEGORI, 'kategori'); if (c) u.kategori = c;
  return u;
}
export function nyttId() { return 'a-' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'); }
const ID = /^[A-Za-z0-9_-]{1,64}$/;

// Skapar eller uppdaterar (om b.id finns). Returnerar posten.
export function spara(b) {
  const id = b && b.id !== undefined ? String(b.id) : '';
  if (id && !ID.test(id)) throw new Error('Ogiltigt id');
  return medLas(() => {
    const lista = las();
    const hit = id ? lista.find((a) => a.id === id) : null;
    const nu = new Date().toISOString();
    let post;
    if (hit) {
      Object.assign(hit, rensa(b, false), { uppdaterad: nu });
      post = hit;
    } else {
      if (lista.length >= MAX_ANTAL) throw new Error('För många åtgärder (max ' + MAX_ANTAL + ')');
      const u = rensa(b, true);
      post = { id: id || nyttId(), app: u.app, titel: u.titel, forklaring: u.forklaring, skapad: nu, uppdaterad: nu, prio: u.prio || 'normal', status: u.status || 'oppen', kalla: u.kalla || 'Boss', kategori: u.kategori || 'fyll-i' };
      lista.push(post);
    }
    skriv(lista);
    return post;
  });
}
export function markera(id, status = 'klar') {
  if (!ID.test(String(id))) throw new Error('Ogiltigt id');
  return medLas(() => {
    const lista = las();
    const hit = lista.find((a) => a.id === id);
    if (!hit) { const e = new Error('Hittar inte åtgärden'); e.kod = 404; throw e; }
    hit.status = status; hit.uppdaterad = new Date().toISOString();
    skriv(lista);
    return hit;
  });
}
