#!/usr/bin/env node
// Kontrollerar apps.json. Inga beroenden.
// Kor: node tools/kolla.mjs [--lankar] [--fil sokvag]
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const kollaLankar = args.includes('--lankar');
const fi = args.indexOf('--fil');
const rot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fil = fi >= 0 && args[fi + 1] ? resolve(args[fi + 1]) : join(rot, 'apps.json');

const fel = []; // {id, text}
const lagg = (id, text) => fel.push({ id, text });

let data;
try {
  data = JSON.parse(readFileSync(fil, 'utf8').replace(/^﻿/, ''));
} catch (e) {
  console.log('FEL: kan inte lasa/tolka ' + fil + ': ' + e.message);
  process.exit(1);
}

const kategorier = Array.isArray(data.kategorier) ? data.kategorier : [];
const apps = Array.isArray(data.apps) ? data.apps : [];
if (!kategorier.length) lagg('(rot)', 'kategorier saknas eller tom lista');
if (!apps.length) lagg('(rot)', 'apps saknas eller tom lista');

const arUrl = (s) => {
  try { const u = new URL(s); return u.protocol === 'http:' || u.protocol === 'https:'; } catch { return false; }
};
const arIso = (s) =>
  typeof s === 'string' && /^\d{4}-\d{2}-\d{2}(T[\d:.]+(Z|[+-]\d{2}:?\d{2})?)?$/.test(s) && !isNaN(Date.parse(s));
const tom = (s) => typeof s !== 'string' || !s.trim();

const sedda = new Map();
const perKat = {};
const felId = new Set();
apps.forEach((a, i) => {
  const id = a && a.id ? a.id : '(post ' + (i + 1) + ')';
  const f = (t) => { lagg(id, t); felId.add(id); };
  if (!a || typeof a !== 'object') return f('inte ett objekt');
  if (tom(a.id)) f('id saknas');
  else if (sedda.has(a.id)) f('dubblett av id (post ' + sedda.get(a.id) + ')');
  else sedda.set(a.id, i + 1);
  if (tom(a.namn)) f('namn saknas');
  if (tom(a.ikon)) f('ikon saknas');
  if (tom(a.kategori)) f('kategori saknas');
  else {
    perKat[a.kategori] = (perKat[a.kategori] || 0) + 1;
    if (!kategorier.includes(a.kategori)) f('okand kategori: ' + a.kategori);
  }
  if (tom(a.senast_aktiv)) f('senast_aktiv saknas');
  else if (!arIso(a.senast_aktiv)) f('senast_aktiv ogiltig ISO: ' + a.senast_aktiv);
  if (tom(a.primar)) f('primar saknas');
  else if (!arUrl(a.primar)) f('primar ogiltig URL: ' + a.primar);
  if (!Array.isArray(a.lankar) || !a.lankar.length) f('minst en lank kravs');
  else a.lankar.forEach((l, j) => {
    if (!l || !arUrl(l.url)) f('lank ' + (j + 1) + ' har ogiltig url');
  });
});

console.log('Fil: ' + fil);
console.log('Antal appar: ' + apps.length + (apps.length === 80 ? '' : '  (forvantat 80)'));
console.log('Per kategori:');
for (const k of kategorier) console.log('  ' + k + ': ' + (perKat[k] || 0));
for (const k of Object.keys(perKat)) if (!kategorier.includes(k)) console.log('  [okand] ' + k + ': ' + perKat[k]);
if (apps.length !== 80) lagg('(rot)', 'antal appar ar ' + apps.length + ', forvantat 80');

let doda = [];
if (kollaLankar) {
  const urls = new Map(); // url -> [id]
  for (const a of apps) {
    const alla = [a && a.primar, ...(((a && a.lankar) || []).map((l) => l && l.url))].filter((u) => typeof u === 'string' && arUrl(u));
    for (const u of alla) { if (!urls.has(u)) urls.set(u, new Set()); urls.get(u).add(a.id); }
  }
  console.log('Kontrollerar ' + urls.size + ' URL:er (HEAD, 8 s timeout)...');
  const lista = [...urls.keys()];
  let nasta = 0;
  const jobb = async () => {
    while (nasta < lista.length) {
      const u = lista[nasta++];
      try {
        const r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(8000) });
        if (r.status >= 400) doda.push({ u, ids: [...urls.get(u)], orsak: 'HTTP ' + r.status });
      } catch (e) {
        doda.push({ u, ids: [...urls.get(u)], orsak: (e.cause && e.cause.code) || e.name || 'fel' });
      }
    }
  };
  await Promise.all(Array.from({ length: 8 }, jobb));
  console.log('Doda/onaabara lankar: ' + doda.length);
  for (const d of doda) console.log('  ' + d.orsak + '  ' + d.u + '  [' + d.ids.join(', ') + ']');
  if (doda.length) lagg('(lankar)', doda.length + ' URL:er svarar inte (se ovan)');
}

console.log('Poster med fel: ' + felId.size);
for (const f of fel) console.log('  ' + f.id + ': ' + f.text);
console.log(fel.length ? 'RESULTAT: FEL (' + fel.length + ')' : 'RESULTAT: OK');
process.exit(fel.length ? 1 : 0);
