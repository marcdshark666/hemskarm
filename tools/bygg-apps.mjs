// Hemskärm: bygger apps.json ur Work List (projekt-senast.json), Tailscale-register (sidor.json),
// kända publika adresser (nedan) och git-remotes. Slår ihop apps.manuell.json (manuellt vinner).
// Kör: node tools/bygg-apps.mjs [--ingen-probe]   (probe = HEAD mot publika adresser, bara läsning)
// Inga hemligheter läses: av projekt-senast.json används bara id, senast, kalla, privat.dir (för git/mtime).
// gadget-drop (stoppnivå): visas som post, ingen probe, inga åtgärder.
import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HEM = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPIDEER = path.resolve(HEM, '..');
const PROBE = !process.argv.includes('--ingen-probe');
const TS = 'https://desktop-r13nmtb.tailf9ee87.ts.net';
const GH = 'https://github.com/marcdshark666/';
const PAGES = 'https://marcdshark666.github.io/';

const KAT = ['Medicin & utbildning', 'Diabetes & hälsa', 'Ekonomi & affär', 'Hem & vardag', 'Spel & quiz', '3D-print & hobby', 'Verktyg & AI', 'Kommunikation & vänner', 'Jobb & karriär', 'Övrigt'];
const V = (n) => `https://${n}.vercel.app/`;

// k=kategori, i=ikon, n=namn, b=beskrivning, ts=Tailscale-sido-id, v=[vercel], pg=[github pages], b44=[base44], gh=[extra GitHub-url], dir=mapp (om annan än id), skydd=gadget-drop
const M = {
  'medhop': { k: 0, i: '🩺', n: 'MedHop', b: 'Medicinsk kunskap och OSCE-vinjetter. Privat version har extra kapitel.', ts: 'medhop', v: [V('medhop')] },
  'medhop-daily': { k: 0, i: '📅', n: 'MedHop Daily', b: 'Daglig medicinfråga.' },
  'patientfall-daily': { k: 0, i: '🧾', n: 'Patientfall Daily', b: 'Dagligt patientfall för övning.' },
  'ddxai': { k: 0, i: '🧠', n: 'DDxAi', b: 'Differentialdiagnostik med AI-stöd.', v: [V('ddxai')] },
  'klinisk-evidens': { k: 0, i: '📚', n: 'Klinisk Evidens', b: 'Evidenssammanställningar för klinik.', v: [V('klinisk-evidens')] },
  'kliniskt': { k: 0, i: '🏥', n: 'KLINISKT', b: 'Kliniskt stöd.', v: [V('kliniskt')], dir: 'kliniskt' },
  'ward-rush': { k: 4, i: '🏃', n: 'Ward Rush', b: 'Medicinskt avdelningsspel.', v: [V('ward-rush')] },
  'openevidence-consensus-medveta': { k: 0, i: '🔎', n: 'MedVeta / OpenEvidence', b: 'Konsensus och evidens, MedVeta.' },
  'medicinskt-snurrhjul': { k: 0, i: '🎡', n: 'Medicinskt snurrhjul', b: 'Slumpa medicinska övningsämnen.', v: [V('medicinskt-snurrhjul')], dir: 'medicinskt-snurrhjul' },
  'radcore': { k: 0, i: '🩻', n: 'RADCORE', b: 'Radiologi, bokbank och kompendium.', v: [V('radcore')] },
  'cynergi-med-flow': { k: 0, i: '💊', n: 'Cynergi Med Flow', b: 'Medicinskt flödesverktyg. Privat instans på :8443, Base44 som äldre kopia.', ts: 'cynergi', v: [V('cynergi-med-flow')], b44: ['https://cynergi-med-flow.base44.app/'], ex: [{ typ: 'supabase', etikett: 'Supabase (planerad, väntar på nycklar)', url: '', status: 'planerad' }] },
  'synergy-application-regarding': { k: 0, i: '✅', n: 'Synergi-checklista', b: 'Checklista för Synergi-ärenden.', v: [V('synergy-application-regarding')] },
  'ovningsportal-bt-folk': { k: 0, i: '🎓', n: 'Övningsportal BT', b: 'Övningsportal för BT-läkare.', v: [V('ovningsportal-bt-folk')] },
  'pubmed-applikation-swipa': { k: 0, i: '📄', n: 'PubMed-swipa', b: 'Swipa igenom PubMed-artiklar.' },
  'ada-zdrowa': { k: 0, i: '🇵🇱', n: 'Ada Zdrowa', b: 'Hälsoapp på polska.', v: [V('ada-zdrowa')], dir: 'ada-zdrowa' },
  'forelasningar': { k: 0, i: '🎙️', n: 'Föreläsningar', b: 'Föreläsningsanteckningar.', pg: [PAGES + 'forelasningar/'], dir: 'forelasningar' },
  'bt-start': { k: 0, i: '📋', n: 'BT-start', b: 'BT-schema, dokument och startsida.', ts: 'bt', dir: 'bt-start' },
  'plaud-kalender': { k: 0, i: '🗓️', n: 'PLAUD Kalender', b: 'PLAUD-inspelningar och kalender.', v: [V('plaud-kalender')] },
  'plaud-syncthing': { k: 0, i: '🔄', n: 'PLAUD Syncthing', b: 'Synk av PLAUD-filer.', dir: 'plaud-syncthing' },
  'sugar-buddy-bot': { k: 1, i: '🍬', n: 'Sugar Buddy', b: 'Diabetesstöd, centralen.', v: [V('sugar-buddy-bot')] },
  'dexcom-reklamations-assistent': { k: 1, i: '📟', n: 'Dexcom-reklamation', b: 'Hjälp med sensorreklamationer.', v: [V('dexcom-reklamations-assistent')] },
  'marcs-halsoai': { k: 1, i: '❤️', n: 'Marcs HälsoAI', b: 'Marcs hälsosida.', ts: 'halsa-marc', v: [V('marcs-halsoai')], },
  'bertils-halsoai': { k: 1, i: '👴', n: 'Bertils HälsoAI', b: 'Hälsosida för Bertil.', v: [V('bertils-halsoai')] },
  'lilianas-salud': { k: 1, i: '🌿', n: 'Lilianas Salud', b: 'Hälsosida för Liliana.', v: [V('lilianas-salud')], b44: ['https://lilianas-salud.base44.app/'] },
  'gym-3d-streaks': { k: 1, i: '🏋️', n: 'Gym 3D Streaks', b: 'Gympass och streaks i 3D.' },
  'squat-counter': { k: 1, i: '🦵', n: 'Squat Counter', b: 'Räknar knäböj.', dir: 'squat-counter' },
  'manadsavrakning': { k: 2, i: '💶', n: 'Månadsavräkning', b: 'Marc & Adas månadsavräkning.', ts: 'manadsavrakning' },
  'marcs-resell': { k: 2, i: '🏷️', n: 'Marcs Resell', b: 'Återförsäljning och lager.', v: [V('marcs-resell')], pg: [PAGES + 'marcs-resell/'] },
  'fondkompassen': { k: 2, i: '🧭', n: 'Fondkompassen', b: 'Fondjämförelse.' },
  'etsy-butiker': { k: 2, i: '🛍️', n: 'Etsy-butiker', b: 'Etsy-butikerna.' },
  'aaron-prints': { k: 5, i: '🖨️', n: 'Aaron Prints / DrJonsson', b: 'Print-motiv och butik.', pg: [PAGES + 'drjonsson/'] },
  'gadget-drop': { k: 2, i: '📦', n: 'Gadget Drop / Mr Gadget', b: 'Affiliate-kanal. Stoppnivå: inga automatiska åtgärder härifrån.', v: ['https://gadget-drop-one.vercel.app/', 'https://mr-gadget.vercel.app/'], skydd: true },
  'husvakten': { k: 3, i: '🏠', n: 'Husvakten', b: 'Hemkontroll och hushållsstatus.', ts: 'hem', pg: [PAGES + 'husvakten/'] },
  'kalender-bradet': { k: 3, i: '🗓️', n: 'Kalenderbräde', b: 'Kalenderbräde.', v: [V('kalender-bradet')] },
  'kalender-skogen': { k: 3, i: '🌲', n: 'Kalenderskog', b: 'Kalender som skog.' },
  'restaurang-roulette': { k: 3, i: '🍽️', n: 'Restaurang Roulette', b: 'Slumpa restaurang.' },
  'stockholm-dag': { k: 3, i: '🏙️', n: 'Stockholm Dag', b: 'Dagsplanering i Stockholm.', v: [V('stockholm-dag')] },
  'packing-road': { k: 3, i: '🧳', n: 'Packing Road', b: 'Packlistor.', v: [V('packing-road')] },
  'allinclusive-finder': { k: 3, i: '🏝️', n: 'SolJakt', b: 'Hitta all inclusive-resor.', v: [V('allinclusive-finder')] },
  'svenska-ord': { k: 3, i: '🔤', n: 'Svenska Ord', b: 'Ordspel och ordlistor.', pg: [PAGES + 'svenska-ord/'] },
  'hemmaracet': { k: 3, i: '🏁', n: 'Hemmaracet', b: 'Hemmatävling.', dir: 'hemmaracet' },
  'olasta-meddelanden': { k: 7, i: '✉️', n: 'Olästa meddelanden', b: 'Olästa meddelanden samlade.', ts: 'olasta' },
  'quiz-runner': { k: 4, i: '🎮', n: 'Quiz Rush', b: 'Quizspel.', v: [V('quiz-rush-game')] },
  'spelkontroll': { k: 4, i: '🕹️', n: 'Spelkontroll', b: 'Styr spel och skärm från mobilen.', ts: 'spel' },
  'print-planer': { k: 5, i: '🧱', n: 'Print-planer', b: '3D-skrivarstyrning och print-planer.', ts: 'skrivare', pg: [PAGES + 'print-planer/'] },
  'filer-privat': { k: 5, i: '🗃️', n: 'Filer (3D-print, privat)', b: 'Printade objekt med originalfiler.', ts: 'filer', dir: 'filer-privat' },
  '3d-sida-objekt': { k: 5, i: '🧊', n: '3D-sida objekt', b: '3D-objektsida.' },
  '3dcal': { k: 5, i: '📐', n: '3D Cal', b: '3D-kalender (vinext).' },
  'bambu-elegoo-profiler': { k: 5, i: '🛠️', n: 'Bambu/Elegoo-profiler', b: 'Skrivarprofiler.', dir: 'bambu-elegoo-profiler' },
  'the-work-list': { k: 6, i: '📝', n: 'The Work List', b: 'Projektlistan, uppdrag och rutiner.', ts: 'worklist', v: [V('the-work-list')] },
  'tailscale-hemsidor': { k: 6, i: '🔒', n: 'Tailscale-sidor', b: 'Register över alla privata sidor.', ts: 'sidor' },
  'hemskarm': { k: 6, i: '🏡', n: 'Hemskärm', b: 'Den här sidan.', ts: 'hemskarm', dir: 'hemskarm' },
  'boss': { k: 6, i: '👑', n: 'BOSS BOT / vakthundar', b: 'Chefen och vakthundarna: status och uppdrag i Botlabbet.', ts: 'bots', dir: 'worklist-bots', },
  'work-list-bots': { k: 6, i: '🤖', n: 'Work List Bots', b: 'Botarna: aktivitet, namn och uppdrag (Marcs bot).', ts: 'bots', dir: 'worklist-bots' },
  'botlabbet': { k: 6, i: '🤖', n: 'Botlabbet', b: 'Work List-bottar och deras namn.', ts: 'bots', v: [V('botlabbet')] },
  'uppdateringsvakt': { k: 6, i: '🛡️', n: 'Uppdateringsvakt', b: 'Vakt för uppdateringar.' },
  'server-uppdaterare': { k: 6, i: '♻️', n: 'Server-uppdaterare', b: 'Startar om app-servrar efter kodändring.', dir: 'server-uppdaterare' },
  'skarmstyrning': { k: 6, i: '🖥️', n: 'Skärmstyrning', b: 'Styr datorn med Python (skarm_plus).' },
  'bionic-verktyg': { k: 6, i: '🦾', n: 'Bionic-verktyg', b: 'Lokal AI-hjärna (Qwen).' },
  'idea-autopilot': { k: 6, i: '💡', n: 'Idé-autopilot', b: 'Hämtar idéer och bygger appar.' },
  'startup-admin-boost': { k: 6, i: '🚀', n: 'StartupBoost', b: 'Startup-program minimerat och som admin.' },
  'session-tracker': { k: 6, i: '📊', n: 'NEXUS Session Tracker', b: 'Spårar Claude-sessioner.', v: [V('nexus-session-tracker')] },
  'telegram-autocommit': { k: 6, i: '💬', n: 'Telegram-autocommit', b: 'Auto-commit via Telegram.' },
  'vakttornet': { k: 6, i: '🗼', n: 'Vakttornet', b: 'Övervakning.' },
  'tornet': { k: 6, i: '🏰', n: 'Tornet', b: 'Tornet.' },
  'rostagent': { k: 6, i: '🎤', n: 'Röstagent', b: 'Röststyrd agent.' },
  'us-proxy-browser': { k: 6, i: '🌐', n: 'US Proxy Browser', b: 'Webbläsare via US-proxy.', v: [V('us-proxy-browser')] },
  'skrivbordet': { k: 6, i: '🪟', n: 'Skrivbordet', b: 'Se datorn live från mobilen.' },
  'tangentbordsapp-dar-skriva': { k: 6, i: '⌨️', n: 'Handskriftstangentbord', b: 'Tangentbordsapp där man skriver.', v: [V('tangentbordsapp-dar-skriva')] },
  'resolve-claude-mcp': { k: 6, i: '🎬', n: 'Resolve Claude MCP', b: 'DaVinci Resolve via MCP.', dir: 'resolve-claude-mcp' },
  'language-learning-other': { k: 6, i: '🗣️', n: 'Språkinlärning', b: 'Språkinlärning.' },
  'munder-difflin': { k: 9, i: '🏢', n: 'Munder Difflin', b: 'Kontoret (extern kod).' },
  'munder-difflin-app': { k: 9, i: '🏢', n: 'Munder Difflin App', b: 'Kontorsappen.' },
  'vanner': { k: 7, i: '👥', n: 'Vänkrets', b: 'Vänlistor, prioritet och utkast.', ts: 'vanner', dir: 'vanner' },
  'vanskapsapp': { k: 7, i: '🤝', n: 'Vänskapsapp', b: 'Vänskapsapp.', v: [V('vanskapsapp')], dir: 'vanskapsapp' },
  'gmail-improvement-sliding': { k: 7, i: '📧', n: 'Slide Mail', b: 'Svep inkorgen ren.', v: [V('gmail-improvement-sliding')] },
  'inbox-zero-hero': { k: 7, i: '📥', n: 'Inbox Zero Hero', b: 'Inbox zero-spel.', v: [V('inbox-zero-hero')] },
  'live-oversattare-samtal': { k: 7, i: '🗨️', n: 'Live-översättare', b: 'Översättning i samtal.', v: [V('live-oversattare-samtal')] },
  'spindelnatet': { k: 7, i: '🕸️', n: 'Spindelnät', b: 'Kopplingskarta.', ts: 'spindel', v: [V('spindelnatet')] },
  'jobbans-kandrswe': { k: 8, i: '💼', n: 'Jobbradar KanDrSwe', b: 'Jobb för läkare i Sverige.', v: [V('jobbans-kandrswe')], pg: [PAGES + 'Jobbans-kanDrSwe/'] },
  'cv-portal': { k: 8, i: '📄', n: 'CV-portal', b: 'CV-portal.', v: ['https://cv-portal-rose.vercel.app/'] },
  'cv-claude-dar': { k: 8, i: '✍️', n: 'Meritbrev & CV', b: 'CV och meritbrev med Claude.', v: [V('cv-claude-dar')] },
};
// Vercel-projekt utan Work List-kort: lägg bara med om mappen finns eller listan säger det.
const EXTRA_IDS = ['boss', 'work-list-bots', 'bt-start', 'vanner', 'forelasningar', 'hemskarm', 'filer-privat', 'server-uppdaterare', 'squat-counter', 'hemmaracet', 'bambu-elegoo-profiler', 'plaud-syncthing', 'resolve-claude-mcp', 'kliniskt', 'vanskapsapp', 'medicinskt-snurrhjul', 'ada-zdrowa', 'bertils-halsoai', 'lilianas-salud', 'gym-3d-streaks'];

const lasJson = (f, fb) => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); } catch { return fb; } };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

function nyastMtime(dir) {
  let max = 0;
  const skip = new Set(['node_modules', '.git', 'data', 'test', 'tests', '.claude', 'logs', 'shots']);
  (function gå(d, nivå) {
    let lista;
    try { lista = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of lista) {
      if (e.isDirectory()) { if (nivå < 2 && !skip.has(e.name) && !e.name.endsWith('.bak')) gå(path.join(d, e.name), nivå + 1); continue; }
      if (/\.(bak|log)/i.test(e.name) || /^\./.test(e.name)) continue;
      try { max = Math.max(max, fs.statSync(path.join(d, e.name)).mtimeMs); } catch {}
    }
  })(dir, 0);
  return max ? new Date(max).toISOString() : null;
}
function gitRemote(dir) {
  try {
    const top = execFileSync('git', ['-C', dir, 'rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (path.resolve(top).toLowerCase() !== path.resolve(dir).toLowerCase()) return null;
    const u = execFileSync('git', ['-C', dir, 'remote', 'get-url', 'origin'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    const m = /github\.com[/:]([^/]+)\/([^/\s]+?)(?:\.git)?$/.exec(u);
    return m ? `https://github.com/${m[1]}/${m[2]}` : null; // aldrig token/credentials
  } catch { return null; }
}
const lyssnar = (port) => new Promise((res) => {
  const s = net.connect({ host: '127.0.0.1', port, timeout: 800 });
  s.on('connect', () => { s.destroy(); res(true); });
  s.on('error', () => res(false));
  s.on('timeout', () => { s.destroy(); res(false); });
});
const cache = new Map();
async function probe(url) {
  if (!PROBE) return 'okänd';
  if (cache.has(url)) return cache.get(url);
  const p = (async () => {
    try {
      const r = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(12000) });
      if (r.status >= 200 && r.status < 400) return 'uppe';
      if (r.status === 401 || r.status === 403) return 'uppe';
      return 'ej uppe';
    } catch { return 'ej uppe'; }
  })();
  cache.set(url, p);
  return p;
}

const wl = lasJson(path.join(APPIDEER, 'the-work-list', 'projekt-senast.json'), { projekt: [] });
const sidor = lasJson(path.join(APPIDEER, 'tailscale-hemsidor', 'sidor.json'), { sidor: [] });
const sidaMap = new Map((sidor.sidor || []).map((s) => [s.id, s]));
if (!sidaMap.has('sidor')) sidaMap.set('sidor', { id: 'sidor', route: '/sidor', port: 5200, namn: 'Tailscale-sidor' });
const host = sidor.host ? `https://${sidor.host}` : TS;
const wlMap = new Map();
for (const p of wl.projekt || []) wlMap.set(String(p.id).toLowerCase(), p);

const ids = new Set([...wlMap.keys(), ...Object.keys(M).filter((k) => EXTRA_IDS.includes(k))]);
const tsAnvanda = new Set();
const lista = [];
for (const id of ids) {
  const m = M[id] || M[Object.keys(M).find((k) => k.toLowerCase() === id)] || { k: 9, i: '📦', n: id, b: 'Projekt i Work List.' };
  const w = wlMap.get(id);
  const dirOverride = m.dir ? path.join(APPIDEER, m.dir) : null;
  const dir = dirOverride || (w && w.privat && w.privat.dir) || path.join(APPIDEER, id);
  const finns = fs.existsSync(dir);
  let senast = w && w.senast ? w.senast : null;
  if (!senast && finns) senast = nyastMtime(dir);
  const lank = [];
  if (m.ts) {
    const s = sidaMap.get(m.ts);
    if (s) {
      tsAnvanda.add(m.ts);
      const url = s.route.startsWith(':') ? `${host}${s.route}` : `${host}${s.route === '/' ? '/' : s.route + '/'}`;
      lank.push({ typ: 'tailscale', etikett: 'Tailscale ' + (s.route.startsWith(':') ? s.route : s.route), url, status: (await lyssnar(s.port)) ? 'uppe' : 'ej uppe', kraver_tailscale: true });
      lank.push({ typ: 'lokal', etikett: `127.0.0.1:${s.port} (bara på datorn)`, url: `http://127.0.0.1:${s.port}/`, status: lank[0].status, kraver_tailscale: false, bara_dator: true });
    }
  }
  const skydd = !!m.skydd;
  for (const u of m.v || []) lank.push({ typ: 'vercel', etikett: 'Vercel ' + u.replace(/^https:\/\//, '').replace(/\/$/, ''), url: u, status: skydd ? 'ej kollad' : await probe(u), kraver_tailscale: false });
  for (const u of m.b44 || []) lank.push({ typ: 'base44', etikett: 'Base44 ' + u.replace(/^https:\/\//, '').replace(/\/$/, ''), url: u, status: skydd ? 'ej kollad' : await probe(u), kraver_tailscale: false });
  for (const u of m.pg || []) lank.push({ typ: 'github', etikett: 'GitHub Pages', url: u, status: await probe(u), kraver_tailscale: false });
  const remote = finns ? gitRemote(dir) : null;
  if (remote) lank.push({ typ: 'github', etikett: 'GitHub repo' + (/marcdshark666\/hemskarm/.test(remote) ? ' (peka aldrig push hit)' : ''), url: remote, status: skydd ? 'ej kollad' : await probe(remote), kraver_tailscale: false });
  for (const e of m.ex || []) lank.push({ kraver_tailscale: false, ...e });
  for (const l of lank) if (l.status === 'ej uppe' && l.typ === 'github' && /github\.com/.test(l.url)) l.status = 'ej uppe';
  let primar = '';
  const ordning = ['tailscale', 'vercel', 'github', 'base44', 'annat'];
  for (const t of ordning) { const x = lank.find((l) => l.typ === t && l.url && l.status !== 'ej uppe'); if (x) { primar = x.url; break; } }
  if (!primar) { const x = lank.find((l) => l.url && l.typ !== 'lokal'); primar = x ? x.url : ''; }
  lista.push({
    id: slug(id), namn: m.n, ikon: m.i, kategori: KAT[m.k], senast_aktiv: senast, beskrivning: m.b,
    primar, lankar: lank, ...(m.fr ? { fast_rank: m.fr } : {}), ...(skydd ? { skyddad: true } : {}),
  });
}
// Tailscale-sidor som ingen app pekar på ännu.
for (const s of sidor.sidor || []) {
  if (tsAnvanda.has(s.id)) continue;
  const d = path.join(APPIDEER, s.mapp || '');
  const url = s.route.startsWith(':') ? `${host}${s.route}` : `${host}${s.route === '/' ? '/' : s.route + '/'}`;
  const st = (await lyssnar(s.port)) ? 'uppe' : 'ej uppe';
  lista.push({ id: slug('ts-' + s.id), namn: s.namn, ikon: '🔒', kategori: 'Övrigt', senast_aktiv: fs.existsSync(d) ? nyastMtime(d) : null, beskrivning: s.beskrivning || '', primar: url, lankar: [{ typ: 'tailscale', etikett: 'Tailscale ' + s.route, url, status: st, kraver_tailscale: true }] });
}


// Berikningsfiler (data/berikning.*.json) från hjälpagenter: slås ihop när de finns, tolerant mot format.
const BER = (n) => lasJson(path.join(HEM, 'data', 'berikning.' + n + '.json'), null);
const arObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
(function berika() {
  const idOf = (k) => slug(String(k));
  const byId = new Map(lista.map((a) => [a.id, a]));
  const besk = BER('beskrivningar');
  if (arObj(besk)) {
    const src = arObj(besk.beskrivningar) ? besk.beskrivningar : arObj(besk.apps) ? besk.apps : besk;
    for (const [k, v] of Object.entries(src)) {
      const a = byId.get(idOf(k)); if (!a) continue;
      if (typeof v === 'string') a.beskrivning = v;
      else if (arObj(v)) { if (v.beskrivning) a.beskrivning = String(v.beskrivning); if (v.ikon) a.ikon = String(v.ikon); }
    }
  } else if (Array.isArray(besk)) for (const v of besk) { const a = v && byId.get(idOf(v.id)); if (a) { if (v.beskrivning) a.beskrivning = v.beskrivning; if (v.ikon) a.ikon = v.ikon; } }
  const kat = BER('kategorier');
  if (arObj(kat)) {
    const map = [kat.poster, kat.id_kategori, kat.id_till_kategori, kat.apps, kat.map, kat.kategori_per_id].find(arObj) || kat;
    if (Array.isArray(kat.kategorier)) { KAT.length = 0; for (const k of kat.kategorier) KAT.push(typeof k === 'string' ? k : k.namn); }
    for (const [k, v] of Object.entries(map)) { const a = byId.get(idOf(k)); if (a && typeof v === 'string') a.kategori = v; }
  }
  const ls = BER('lankstatus');
  if (ls) {
    const st = new Map();
    (function gå(x, nyckel) {
      if (typeof x === 'string' && /^https?:/.test(nyckel || '')) st.set(nyckel, x);
      else if (Array.isArray(x)) x.forEach((y) => gå(y));
      else if (arObj(x)) { if (x.url && x.status) st.set(x.url, String(x.status)); else if (x.status && /^https?:/.test(nyckel || '')) st.set(nyckel, String(x.status)); else for (const [k, v] of Object.entries(x)) gå(v, k); }
    })(ls);
    for (const a of lista) { if (a.skyddad) continue; for (const l of a.lankar) if (st.has(l.url)) { const v = st.get(l.url); l.status = /^(uppe|ej uppe|planerad|ej kollad|okänd)$/.test(v) ? v : /login|skydd|auth/i.test(v) ? 'uppe' : v; } }
  }
  const se = BER('senast');
  if (arObj(se)) for (const [k, v] of Object.entries(arObj(se.senast) ? se.senast : se)) {
    const a = byId.get(idOf(k)); const t = typeof v === 'string' ? v : arObj(v) ? v.senast_aktiv : null;
    if (a && t && !isNaN(Date.parse(t))) a.senast_aktiv = new Date(t).toISOString();
  }
})();

// Statusfinish: privata GitHub-repon (gh, ingen token i output), serverstatus, gamla adresser.
const ghCache = new Map();
function ghPrivat(url) {
  const m = /^https:\/\/github\.com\/([^/]+)\/([^/]+)$/.exec(url);
  if (!m) return null;
  if (ghCache.has(url)) return ghCache.get(url);
  let r = null;
  try { r = execFileSync('gh', ['api', `repos/${m[1]}/${m[2]}`, '--jq', '.private'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 20000 }).trim() === 'true' ? 'privat' : 'uppe'; }
  catch (e) { r = /404|Not Found/i.test(String(e.stderr || '')) ? 'borttaget' : null; }
  ghCache.set(url, r);
  return r;
}
for (const a of lista) {
  if (a.skyddad) continue;
  const tsUppe = a.lankar.some((l) => l.typ === 'tailscale' && l.status === 'uppe');
  for (const l of a.lankar) {
    if (l.typ === 'github' && /github\.com\/[^/]+\/[^/]+$/.test(l.url) && PROBE) { const g = ghPrivat(l.url); if (g) l.status = g; }
    else if ((l.typ === 'tailscale' || l.typ === 'lokal') && l.status === 'ej uppe') l.status = 'servern ej igång';
    else if (l.typ === 'vercel' && l.status === 'ej uppe' && a.id === 'the-work-list' && tsUppe) l.status = 'gammal adress';
  }
}

// Prio 1-4 (1 = platina ... 4 = brons): data/prio.start.json (startvärden) och data/prio.json (Marcs val, skrivs av servern) läses bara.
for (const f of ['prio.start.json', 'prio.json']) {
  const pr = lasJson(path.join(HEM, 'data', f), null);
  if (arObj(pr)) for (const a of lista) { const v = pr[a.id]; if (Number.isInteger(v) && v >= 1 && v <= 4) a.prio = v; }
}

// Manuell sammanslagning (manuellt vinner).
const man = lasJson(path.join(HEM, 'apps.manuell.json'), { overrides: {}, nya: [], dolda: [] });
const dolda = new Set(man.dolda || []);
let ut = lista.filter((a) => !dolda.has(a.id)).map((a) => {
  const o = (man.overrides || {})[a.id];
  if (!o) return a;
  const { lankar_add, ...rest } = o;
  const r = { ...a, ...rest };
  if (Array.isArray(lankar_add)) r.lankar = [...(r.lankar || []), ...lankar_add];
  return r;
});
for (const n of man.nya || []) if (n && n.id && !ut.find((a) => a.id === n.id)) ut.push({ lankar: [], kategori: 'Övrigt', ...n });
// Förhandsvisning: img/preview/<id>.jpg om den finns (känsliga är suddade av tools/skarmbilder.py, metadata i _meta.json). gadget-drop får aldrig.
const PV_META = lasJson(path.join(HEM, 'img', 'preview', '_meta.json'), {});
for (const x of ut) {
  const f = path.join(HEM, 'img', 'preview', x.id + '.jpg');
  if (fs.existsSync(f) && x.id !== 'gadget-drop') {
    x.forhandsvisning = 'img/preview/' + x.id + '.jpg';
    const m = PV_META[x.id] || {};
    if (m.blur) x.suddad = true; else delete x.suddad;
    if (m.login) x.login_sida = true; else delete x.login_sida;
  } else { delete x.forhandsvisning; delete x.suddad; delete x.login_sida; }
}
ut.sort((a, b) => String(b.senast_aktiv || '').localeCompare(String(a.senast_aktiv || '')));

// Kategorin 'Viktiga hemsidor' (externa sajter) direkt efter Fästa/Senast.
const VIKTIGA = 'Viktiga hemsidor';
if (ut.some((x) => x.kategori === VIKTIGA) || true) { const i = KAT.indexOf(VIKTIGA); if (i >= 0) KAT.splice(i, 1); KAT.unshift(VIKTIGA); }
const gammal = lasJson(path.join(HEM, 'apps.json'), { rev: 0 });
const kategorier = [...KAT.filter((k) => ut.some((a) => a.kategori === k)), ...[...new Set(ut.map((a) => a.kategori))].filter((k) => !KAT.includes(k))];
const doc = { title: 'Hemskärm', rev: (Number(gammal.rev) || 0) + 1, genererad: new Date().toISOString(), kategorier, apps: ut };
fs.writeFileSync(path.join(HEM, 'apps.json'), JSON.stringify(doc, null, 1) + '\n', 'utf8');
const lk = ut.flatMap((a) => a.lankar);
console.log(`apps.json rev ${doc.rev}: ${ut.length} appar, ${kategorier.length} kategorier, ${lk.length} länkar (ej uppe/borttaget: ${lk.filter((l) => l.status === 'ej uppe' || l.status === 'borttaget').length}, privata: ${lk.filter((l) => l.status === 'privat').length}, server ej igång: ${lk.filter((l) => l.status === 'servern ej igång').length})`);
for (const k of kategorier) console.log(' ', k, ut.filter((a) => a.kategori === k).length);
