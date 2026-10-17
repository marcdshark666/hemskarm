// Inloggning - samma e-post/lösenord som Husvakten/Månadsavräkningen/Spelkontrollen.
// Läser SAMMA hashfil (manadsavrakning/data/inloggning.json, salt + PBKDF2-SHA256).
// Inget eget lösenord, inga hemligheter loggas. Egna sessioner i data/sessioner.json.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const SESSION_SEK = 30 * 24 * 3600;
const SPARR_FONSTER = 15 * 60 * 1000;
const SPARR_MAX = 5;

export function skapaAuth({ inloggFil, sessionFil }) {
  const fel = new Map(); // ip -> [tidpunkter]

  function lasInlogg() {
    try {
      const d = JSON.parse(fs.readFileSync(inloggFil, 'utf8'));
      return d && d.losen_hash && d.epost_hash ? d : null;
    } catch {
      return null;
    }
  }

  function pbkdf2(varde, saltHex, it) {
    return crypto.pbkdf2Sync(Buffer.from(varde, 'utf8'), Buffer.from(saltHex, 'hex'), it, 32, 'sha256');
  }

  function lika(a, b) {
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  function kontrollera(epost, losen) {
    const d = lasInlogg();
    if (!d) return false; // ingen inloggningsfil = ingen kommer in utifrån
    const it = Number(d.iterationer) || 310000;
    const okE = lika(pbkdf2(String(epost).trim().toLowerCase(), d.epost_salt, it), Buffer.from(d.epost_hash, 'hex'));
    const okL = lika(pbkdf2(String(losen), d.losen_salt, it), Buffer.from(d.losen_hash, 'hex'));
    return okE && okL;
  }

  const th = (t) => crypto.createHash('sha256').update(t, 'utf8').digest('hex');

  function lasSessioner() {
    try {
      const d = JSON.parse(fs.readFileSync(sessionFil, 'utf8'));
      return d && typeof d === 'object' ? d : {};
    } catch {
      return {};
    }
  }

  function skrivSessioner(d) {
    const nu = Date.now() / 1000;
    const rena = Object.fromEntries(Object.entries(d).filter(([, v]) => typeof v === 'number' && v > nu));
    fs.mkdirSync(path.dirname(sessionFil), { recursive: true });
    fs.writeFileSync(sessionFil + '.tmp', JSON.stringify(rena));
    fs.renameSync(sessionFil + '.tmp', sessionFil);
  }

  function nySession() {
    const token = crypto.randomBytes(32).toString('base64url');
    const d = lasSessioner();
    d[th(token)] = Date.now() / 1000 + SESSION_SEK;
    skrivSessioner(d);
    return token;
  }

  function giltig(token) {
    if (!token || token.length > 200) return false;
    const utgar = lasSessioner()[th(token)];
    return typeof utgar === 'number' && utgar > Date.now() / 1000;
  }

  function taBort(token) {
    if (!token) return;
    const d = lasSessioner();
    if (d[th(token)] !== undefined) {
      delete d[th(token)];
      skrivSessioner(d);
    }
  }

  function sparrad(ip) {
    const nu = Date.now();
    const lista = (fel.get(ip) || []).filter((t) => nu - t < SPARR_FONSTER);
    fel.set(ip, lista);
    return lista.length >= SPARR_MAX;
  }

  return {
    kontrollera,
    nySession,
    giltig,
    taBort,
    sparrad,
    noteraFel: (ip) => fel.set(ip, [...(fel.get(ip) || []), Date.now()]),
    rensaFel: (ip) => fel.delete(ip),
    harInlogg: () => !!lasInlogg(),
  };
}
