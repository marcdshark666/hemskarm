/* Hemskärm: kategorier, "Senast använda (7 dagar)" överst, länkchips. Privat variant bakom Husvakt-login.
   Mina ändringar (localStorage 'hs_manuell') läggs ovanpå apps.json och överlever omgenerering. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var data = null, man = { overrides: {}, nya: [], dolda: [] }, filter = '', sokord = '';
  var FARG = { 'Medicin & utbildning': '#2e7d6b', 'Diabetes & hälsa': '#c0475a', 'Ekonomi & affär': '#b08a2e', 'Hem & vardag': '#4a7c3a', 'Spel & quiz': '#c0602b', '3D-print & hobby': '#7a5ea8', 'Verktyg & AI': '#3a6ea5', 'Kommunikation & vänner': '#2b8aa0', 'Jobb & karriär': '#6f7a8a', 'Övrigt': '#6f7a8a' };
  var IKON = { tailscale: '🔒', github: '⚫', vercel: '▲', supabase: '🟢', base44: '🟣', lokal: '🖥️', annat: '🔗' };
  var NAMN = { tailscale: 'Tailscale', github: 'GitHub', vercel: 'Vercel', supabase: 'Supabase', base44: 'Base44', lokal: 'Lokalt' };

  function store(k, v) { try { if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function show(id) { ['home', 'edit'].forEach(function (x) { $(x).style.display = x === id ? 'block' : 'none'; }); window.scrollTo(0, 0); }

  function loadMan() {
    try {
      var m = JSON.parse(load('hs_manuell') || 'null');
      if (m && m.overrides) { man = { overrides: m.overrides, nya: m.nya || [], dolda: m.dolda || [] }; }
    } catch (e) {}
  }
  function saveMan() { store('hs_manuell', JSON.stringify(man)); }

  function norm(a) {
    var u, dom = '';
    a = Object.assign({}, a);
    if (!a.namn && a.name) { a.namn = a.name; }
    if (!a.ikon && a.icon) { a.ikon = a.icon; }
    if (!a.kategori) { a.kategori = a.group || 'Övrigt'; }
    if (!a.primar && a.url) { a.primar = a.url; }
    if (!a.lankar) { a.lankar = []; }
    u = a.primar || '';
    if (u) { dom = u.replace(/^https?:\/\//, '').split('/')[0]; }
    if (!a.namn) { a.namn = a.id || dom || 'Namnlös'; }
    return a;
  }
  function effektiva() {
    var ut = [], i, a, o;
    for (i = 0; i < data.apps.length; i++) {
      a = data.apps[i];
      if (man.dolda.indexOf(a.id) >= 0) { continue; }
      o = man.overrides[a.id];
      ut.push(norm(o ? Object.assign({}, a, o) : a));
    }
    return ut.concat(man.nya.map(norm));
  }
  function tidSedan(iso) {
    if (!iso) { return 'okänt'; }
    var s = (Date.now() - new Date(iso).getTime()) / 1000, m;
    if (isNaN(s)) { return 'okänt'; }
    if (s < 90) { return 'nyss'; }
    m = s / 60;
    if (m < 60) { return Math.round(m) + ' min'; }
    if (m < 60 * 36) { return Math.round(m / 60) + ' tim'; }
    if (m < 60 * 24 * 60) { return Math.round(m / 1440) + ' dagar'; }
    return Math.round(m / 43200) + ' mån';
  }
  var ms = function (a) { return a.senast_aktiv ? new Date(a.senast_aktiv).getTime() || 0 : 0; };
  function nyast(x, y) { return ms(y) - ms(x); }

  function matchar(a) {
    var hay;
    if (filter && a.kategori !== filter) { return false; }
    if (!sokord) { return true; }
    hay = [a.namn, a.kategori, a.beskrivning].concat((a.lankar || []).map(function (l) { return l.etikett + ' ' + l.typ + ' ' + l.url; })).join(' ').toLowerCase();
    return hay.indexOf(sokord) >= 0;
  }

  function chip(l) {
    var url = safeUrl(l.url), dod = l.status === 'ej uppe' || l.status === 'borttaget', dim = l.status === 'privat' || l.status === 'servern ej igång' || l.status === 'gammal adress', cls, c, sub;
    if (l.typ === 'lokal') { cls = 'lok'; } else if (l.kraver_tailscale) { cls = 'ts'; } else { cls = 'pub'; }
    if (dim) { cls = 'lok'; }
    if (dod) { cls = 'dod'; }
    if (!url) { cls = 'plan'; }
    sub = l.typ === 'lokal' ? 'bara på datorn' : l.kraver_tailscale ? 'kräver Tailscale' : l.status === 'privat' ? 'kräver GitHub-inloggning' : l.status === 'servern ej igång' ? 'servern ej igång' : l.status === 'gammal adress' ? 'gammal adress' : l.status === 'borttaget' ? 'borttaget' : l.status === 'planerad' ? 'planerad' : dod ? 'ej uppe' : 'publik';
    c = el(url ? 'a' : 'span', 'chip ' + cls);
    c.appendChild(document.createTextNode((IKON[l.typ] || '🔗') + ' ' + (NAMN[l.typ] || l.etikett || 'Länk')));
    c.appendChild(el('small', null, sub));
    if (url) { c.href = url; c.target = '_self'; c.title = l.etikett || ''; }
    return c;
  }
  function kort(a, gammalt) {
    var k = el('div', 'kort' + (gammalt ? ' gammal' : '') + (safeUrl(a.primar) ? '' : ' utan')), hu, tx, ch, i, lank = a.lankar || [];
    k.style.setProperty('--c', FARG[a.kategori] || '#3a6ea5');
    hu = el(safeUrl(a.primar) ? 'a' : 'div', 'hu');
    if (safeUrl(a.primar)) { hu.href = a.primar; hu.target = '_self'; }
    hu.appendChild(el('span', 'ic', a.ikon || '⭐'));
    tx = el('span', 'tx');
    tx.appendChild(el('span', 'nm', (Number(a.fast_rank) > 0 ? '📌 ' : '') + (a.namn || a.id || 'Namnlös')));
    if (a.beskrivning) { tx.appendChild(el('span', 'bs', a.beskrivning)); }
    tx.appendChild(el('span', 'tid', 'Senast aktiv för ' + tidSedan(a.senast_aktiv) + ' sedan'));
    hu.appendChild(tx);
    k.appendChild(hu);
    if (lank.length) {
      ch = el('div', 'chips');
      for (i = 0; i < lank.length; i++) { ch.appendChild(chip(lank[i])); }
      k.appendChild(ch);
    }
    return k;
  }
  function sektion(g, titel, lista, ny) {
    var h, r, i, gr = Date.now() - 7 * 86400000;
    if (!lista.length) { return; }
    h = el('h2', ny ? 'ny' : '', titel);
    h.appendChild(el('small', null, lista.length + ' st'));
    g.appendChild(h);
    r = el('div', 'rutnat');
    for (i = 0; i < lista.length; i++) { r.appendChild(kort(lista[i], ms(lista[i]) < gr)); }
    g.appendChild(r);
  }
  function renderFilter(alla) {
    var f = $('filter'), kats = (data.kategorier || []).slice(), i;
    f.innerHTML = '';
    alla.forEach(function (a) { if (kats.indexOf(a.kategori) < 0) { kats.push(a.kategori); } });
    function knapp(txt, v) {
      var b = el('button', 'fknapp' + (filter === v ? ' pa' : ''), txt);
      b.type = 'button';
      b.onclick = function () { filter = v; renderHome(); };
      f.appendChild(b);
    }
    knapp('Alla', '');
    for (i = 0; i < kats.length; i++) { knapp(kats[i], kats[i]); }
  }
  function renderHome() {
    var g = $('grid'), alla = effektiva(), vis, senaste, fast, gr = Date.now() - 7 * 86400000, kats;
    g.innerHTML = '';
    $('rubrik').textContent = data.title || 'Hemskärm';
    renderFilter(alla);
    vis = alla.filter(matchar).sort(nyast);
    senaste = vis.filter(function (a) { return ms(a) >= gr; });
    fast = vis.filter(function (a) { return Number(a.fast_rank) > 0; }).sort(function (x, y) { return Number(x.fast_rank) - Number(y.fast_rank); });
    if (!filter && !sokord) { sektion(g, '📌 Fästa', fast, true); }
    if (!filter) { sektion(g, 'Senast använda (7 dagar)', senaste, true); }
    kats = (data.kategorier || []).slice();
    vis.forEach(function (a) { if (kats.indexOf(a.kategori) < 0) { kats.push(a.kategori); } });
    kats.forEach(function (k) { sektion(g, k, vis.filter(function (a) { return a.kategori === k; }), false); });
    if (!vis.length) { g.appendChild(el('p', 'msg', 'Inget matchar sökningen.')); }
    $('stampel').textContent = alla.length + ' appar i ' + kats.length + ' kategorier. Lista byggd ' + (data.genererad ? data.genererad.slice(0, 16).replace('T', ' ') : '?') + ' UTC (rev ' + data.rev + ').';
  }

  /* ---------- redigera ---------- */
  function sattFalt(a, key, val) {
    var o;
    if (a._ny) {
      man.nya.forEach(function (x) { if (x.id === a.id) { x[key] = val; } });
    } else {
      o = man.overrides[a.id] = man.overrides[a.id] || {};
      o[key] = val;
    }
    saveMan();
  }
  function renderEdit() {
    var box = $('editlist'), alla = effektiva(), kats = data.kategorier || [];
    box.innerHTML = '';
    alla.sort(nyast).forEach(function (a) {
      var row = el('div', 'ed'), n, ik, u, sel, del, rk;
      n = el('input'); n.type = 'text'; n.className = 'f1'; n.value = a.namn || ''; n.placeholder = 'Namn';
      n.oninput = function () { sattFalt(a, 'namn', n.value); };
      ik = el('input'); ik.type = 'text'; ik.className = 'f2'; ik.value = a.ikon || ''; ik.placeholder = 'Ikon';
      ik.oninput = function () { sattFalt(a, 'ikon', ik.value); };
      u = el('input'); u.type = 'url'; u.className = 'f3'; u.value = a.primar || ''; u.placeholder = 'https://... (öppnas vid tryck)';
      u.oninput = function () { sattFalt(a, 'primar', u.value); };
      rk = el('input'); rk.type = 'number'; rk.className = 'f5'; rk.min = '0'; rk.style.width = '84px'; rk.value = a.fast_rank || ''; rk.placeholder = 'Fäst #'; rk.title = 'Fästa: 1 = överst, tomt = ej fäst';
      rk.oninput = function () { sattFalt(a, 'fast_rank', rk.value === '' ? 0 : Number(rk.value)); };
      sel = el('select'); sel.className = 'f4';
      kats.concat(kats.indexOf(a.kategori) < 0 ? [a.kategori] : []).forEach(function (k) {
        var o = el('option', null, k); o.value = k; if (k === a.kategori) { o.selected = true; } sel.appendChild(o);
      });
      sel.onchange = function () { sattFalt(a, 'kategori', sel.value); };
      del = el('a', 'liten del', 'Dölj'); del.href = '#';
      del.onclick = function () {
        if (a._ny) { man.nya = man.nya.filter(function (x) { return x.id !== a.id; }); } else { man.dolda.push(a.id); }
        saveMan(); renderEdit(); return false;
      };
      row.appendChild(n); row.appendChild(ik); row.appendChild(u); row.appendChild(rk); row.appendChild(sel); row.appendChild(del);
      box.appendChild(row);
    });
    if (man.dolda.length) { box.appendChild(el('p', 'msg', 'Dolda: ' + man.dolda.join(', '))); }
  }
  function setup() {
    $('editbtn').onclick = function () { renderEdit(); show('edit'); return false; };
    $('donebtn').onclick = function () { renderHome(); show('home'); return false; };
    $('addbtn').onclick = function () {
      man.nya.push({ _ny: true, id: 'ny-' + Date.now(), namn: 'Ny app', ikon: '⭐', kategori: 'Övrigt', beskrivning: '', primar: '', lankar: [], senast_aktiv: new Date().toISOString() });
      saveMan(); renderEdit(); return false;
    };
    $('exportbtn').onclick = function () {
      var b = $('jsonbox');
      b.value = JSON.stringify({ overrides: man.overrides, nya: man.nya.map(function (x) { var c = Object.assign({}, x); delete c._ny; return c; }), dolda: man.dolda }, null, 1);
      b.style.display = 'block'; b.focus();
      try { b.select(); } catch (e) {}
      return false;
    };
    $('resetbtn').onclick = function () { man = { overrides: {}, nya: [], dolda: [] }; store('hs_manuell', null); renderEdit(); return false; };
    $('logoutbtn').onclick = function () { location.href = (window.HS_CFG && window.HS_CFG.logout) || 'logga-ut'; return false; };
    $('sok').oninput = function () { sokord = this.value.trim().toLowerCase(); renderHome(); };
  }
  function init() {
    fetch('apps.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('http ' + r.status); }
      return r.json();
    }).then(function (d) {
      data = d; loadMan(); setup(); renderHome(); show('home');
    }).catch(function () { $('grid').appendChild(el('p', 'msg', 'Kunde inte läsa apps.json. Ladda om.')); });
  }
  init();
})();
