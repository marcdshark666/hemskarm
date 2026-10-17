// begar.mjs: Boss/agenter ber Marc göra något. Syns som blinkande röd markering på hemskärmen (iPad).
// Skriver direkt i data/atgarder.json (fillås + atomär skrivning, samma kod som servern; ingen omstart behövs).
//   node hemskarm/tools/begar.mjs add --app <id> --titel "..." --forklaring "..." [--prio hog|normal|lag] [--kategori logga-in|fyll-i|godkann|kor-kommando|granska|beslut] [--kalla Boss|agent|rutin] [--id <id>]
//   node hemskarm/tools/begar.mjs list [--alla] [--app <id>]
//   node hemskarm/tools/begar.mjs done <id>        (klart)       node hemskarm/tools/begar.mjs avvisa <id>
//   node hemskarm/tools/begar.mjs update <id> [--titel ...] [--forklaring ...] [--prio ...] [--kategori ...] [--status oppen|klar|avvisad]
// Ange --id vid add för stabilt id: samma id igen uppdaterar posten (och flyttar den överst). Skriv aldrig lösenord/nycklar.
import * as atg from '../lib/atgarder.js';

const [, , cmd, ...resten] = process.argv;
const flaggor = {}, pos = [];
for (let i = 0; i < resten.length; i++) {
  if (resten[i].startsWith('--')) {
    const k = resten[i].slice(2);
    if (k === 'alla') flaggor[k] = true; else flaggor[k] = resten[++i];
  } else pos.push(resten[i]);
}
const fel = (m) => { console.error('FEL: ' + m); process.exit(1); };
const rad = (a) => `${a.id}  [${a.status}] ${a.prio === 'hog' ? '!! ' : ''}${a.app}: ${a.titel}  (${a.kategori}, ${a.kalla}, ${a.uppdaterad.slice(0, 16).replace('T', ' ')})`;
try {
  if (cmd === 'add') {
    const b = { app: flaggor.app, titel: flaggor.titel, forklaring: flaggor.forklaring, prio: flaggor.prio, kategori: flaggor.kategori, kalla: flaggor.kalla || 'Boss', id: flaggor.id };
    const p = atg.spara(b);
    console.log('OK ' + p.id + ' (' + p.app + ': ' + p.titel + ')');
  } else if (cmd === 'update') {
    if (!pos[0]) fel('update <id> ...');
    if (!atg.las().some((a) => a.id === pos[0])) fel('Hittar inte ' + pos[0]);
    const p = atg.spara({ ...flaggor, id: pos[0] });
    console.log('OK uppdaterad ' + p.id);
  } else if (cmd === 'done' || cmd === 'avvisa') {
    if (!pos[0]) fel(cmd + ' <id>');
    const p = atg.markera(pos[0], cmd === 'done' ? 'klar' : 'avvisad');
    console.log('OK ' + p.id + ' -> ' + p.status);
  } else if (cmd === 'list') {
    const l = atg.sorterad(atg.las()).filter((a) => (flaggor.alla || a.status === 'oppen') && (!flaggor.app || a.app === flaggor.app));
    console.log(l.length ? l.map(rad).join('\n') : '(inga' + (flaggor.alla ? '' : ' öppna') + ' åtgärder)');
  } else {
    fel('Kommandon: add | list | done <id> | avvisa <id> | update <id>. Se huvudet i tools/begar.mjs');
  }
} catch (e) { fel(e.message); }
