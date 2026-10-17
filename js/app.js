/* Hemskärm: kategorier, "Senast använda (7 dagar)" överst, länkchips. Privat variant bakom Husvakt-login.
   Mina ändringar (localStorage 'hs_manuell') läggs ovanpå apps.json och överlever omgenerering. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var prio = null, pfilt = [], vy = 'home', klar = false, stTs = Number(load('hs_state_ts') || 0), stTimer = null, statusTxt = '', pkat = '', psok = '', PIK = { 1: '💎', 2: '🥇', 3: '🥈', 4: '🥉' }, PN = { 1: 'Platina', 2: 'Guld', 3: 'Silver', 4: 'Brons' };
  var data = null, man = { overrides: {}, nya: [], dolda: [] }, filter = '', sokord = '';
  var FARG = { 'Viktiga hemsidor': '#b5651d', 'Medicin & utbildning': '#2e7d6b', 'Diabetes & hälsa': '#c0475a', 'Ekonomi & affär': '#b08a2e', 'Hem & vardag': '#4a7c3a', 'Spel & quiz': '#c0602b', '3D-print & hobby': '#7a5ea8', 'Verktyg & AI': '#3a6ea5', 'Kommunikation & vänner': '#2b8aa0', 'Jobb & karriär': '#6f7a8a', 'Övrigt': '#6f7a8a' };
  var IKON = { tailscale: '🔒', github: '⚫', vercel: '▲', supabase: '🟢', base44: '🟣', lokal: '🖥️', annat: '🔗' };
  var NAMN = { tailscale: 'Tailscale', github: 'GitHub', vercel: 'Vercel', supabase: 'Supabase', base44: 'Base44', lokal: 'Lokalt' };

  function store(k, v) { try { if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }
  function safeUrl(u) { u = String(u || '').trim(); return /^https?:\/\//i.test(u) ? u : ''; }
  function show(id) { ['home', 'edit', 'prio'].forEach(function (x) { $(x).style.display = x === id ? 'block' : 'none'; }); window.scrollTo(0, 0); vy = id; if (klar) { stateChanged(); } }
  function stateObj() { return { pfilt: pfilt, kat: filter, sok: sokord, pv: visaPv, vy: vy, man: man }; }
  function stateChanged() {
    stTs = Date.now(); store('hs_state_ts', String(stTs));
    store('hs_state', JSON.stringify(stateObj()));
    if (stTimer) { clearTimeout(stTimer); }
    stTimer = setTimeout(pushState, 400);
  }
  function visaStatus() { var s = $('stampel'); if (s && statusTxt) { s.textContent = statusTxt; } }
  function pushState() {
    var x = new XMLHttpRequest();
    x.open('POST', 'api/state', true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () {
      if (x.readyState !== 4) { return; }
      if (x.status === 200) { statusTxt = ''; store('hs_state_dirty', null); }
      else if (x.status === 409) { store('hs_state_dirty', null); }
      else { store('hs_state_dirty', '1'); statusTxt = 'Ändringar sparades lokalt (servern nåddes inte). Skickas igen vid nästa laddning.'; visaStatus(); }
    };
    try { x.send(JSON.stringify({ ts: stTs, state: stateObj() })); } catch (e) { store('hs_state_dirty', '1'); }
  }
  function tillampaState(s) {
    if (!s || typeof s !== 'object') { return; }
    if (s.pfilt && s.pfilt.length !== undefined) { pfilt = s.pfilt.filter(function (v) { return ['1', '2', '3', '4', 'x'].indexOf(v) >= 0; }); }
    if (typeof s.kat === 'string') { filter = s.kat; }
    if (typeof s.sok === 'string') { sokord = s.sok; $('sok').value = s.sok; }
    if (typeof s.pv === 'boolean') { visaPv = s.pv; store('hs_pv', visaPv ? '1' : '0'); }
    if (s.man && s.man.overrides && s.man.nya && s.man.dolda) { man = { overrides: s.man.overrides, nya: s.man.nya, dolda: s.man.dolda }; store('hs_manuell', JSON.stringify(man)); }
    if (['home', 'prio', 'edit'].indexOf(s.vy) >= 0) { vy = s.vy; }
  }

  function loadMan() {
    try {
      var m = JSON.parse(load('hs_manuell') || 'null');
      if (m && m.overrides) { man = { overrides: m.overrides, nya: m.nya || [], dolda: m.dolda || [] }; }
    } catch (e) {}
  }
  function saveMan() { store('hs_manuell', JSON.stringify(man)); if (klar) { stateChanged(); } }

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
    var ut = [], i, a, o, ids;
    for (i = 0; i < data.apps.length; i++) {
      a = data.apps[i];
      if (man.dolda.indexOf(a.id) >= 0) { continue; }
      o = man.overrides[a.id];
      if (o) {
        a = Object.assign({}, a, o);
        if (o.lankar_add && o.lankar_add.length) { a.lankar = (o.lankar || data.apps[i].lankar || []).concat(o.lankar_add); }
      }
      ut.push(norm(a));
    }
    ids = {};
    data.apps.forEach(function (x) { ids[x.id] = 1; });
    return ut.concat(man.nya.filter(function (x) { return !ids[x.id]; }).map(norm));
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
  var visaPv = load('hs_pv') !== '0';
  var pend = {};
  try { pend = JSON.parse(load('hs_prio_lokal') || '{}') || {}; } catch (e) { pend = {}; }
  function savePend() { store('hs_prio_lokal', JSON.stringify(pend)); }
  function getPrio(a) {
    var v = pend[a.id] !== undefined ? pend[a.id] : (prio ? prio[a.id] : a.prio);
    return v >= 1 && v <= 4 ? Number(v) : 0;
  }
  function nyast(x, y) {
    var px = getPrio(x) || 5, py = getPrio(y) || 5;
    if (px !== py) { return px - py; }
    if (x.ordning !== undefined && x.ordning !== '' && y.ordning !== undefined && y.ordning !== '') { return Number(x.ordning) - Number(y.ordning); }
    return ms(y) - ms(x);
  }
  function postPrio(id, p, cb) {
    var x = new XMLHttpRequest();
    x.open('POST', 'api/prio', true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () { if (x.readyState === 4) { cb(x.status === 200); } };
    try { x.send(JSON.stringify({ id: id, prio: p || null })); } catch (e) { cb(false); }
  }
  function uppdatera() { renderHome(); if ($('prio').style.display === 'block') { renderPrio(); } }
  function setPrio(a, p) {
    pend[a.id] = p || 0; savePend();
    uppdatera();
    postPrio(a.id, p, function (ok) {
      if (ok) {
        if (!prio) { prio = {}; }
        if (p) { prio[a.id] = p; } else { delete prio[a.id]; }
        delete pend[a.id]; savePend();
        $('stampel').textContent = 'Prio sparad.';
      } else {
        $('stampel').textContent = 'Prio sparades lokalt (servern nåddes inte). Försöker igen vid nästa laddning.';
      }
      uppdatera();
    });
  }
  function skickaVantande() {
    Object.keys(pend).forEach(function (id) {
      var p = pend[id];
      postPrio(id, p, function (ok) {
        if (ok) { if (!prio) { prio = {}; } if (p) { prio[id] = p; } else { delete prio[id]; } delete pend[id]; savePend(); uppdatera(); }
      });
    });
  }
  function oppnaMeny(a) {
    var ov = el('div', 'pmeny'), sh = el('div', 'psheet'), cur = getPrio(a), n;
    function stang() { if (ov.parentNode) { ov.parentNode.removeChild(ov); } }
    sh.appendChild(el('div', 'ptit', (a.ikon || '') + ' ' + a.namn + ': välj prio'));
    [1, 2, 3, 4].forEach(function (k) {
      var b = el('button', 'pval' + (cur === k ? ' pa' : ''), PIK[k] + ' ' + PN[k] + ' (' + k + ')');
      b.type = 'button';
      b.onclick = function (e) { e.stopPropagation(); stang(); setPrio(a, k); };
      sh.appendChild(b);
    });
    n = el('button', 'pval' + (cur === 0 ? ' pa' : ''), 'Ingen prio');
    n.type = 'button';
    n.onclick = function (e) { e.stopPropagation(); stang(); setPrio(a, 0); };
    sh.appendChild(n);
    n = el('button', 'pval avbryt', 'Avbryt');
    n.type = 'button';
    n.onclick = function (e) { e.stopPropagation(); stang(); };
    sh.appendChild(n);
    sh.onclick = function (e) { e.stopPropagation(); };
    ov.onclick = stang;
    ov.appendChild(sh);
    document.body.appendChild(ov);
  }
  function matchar(a) {
    var hay;
    if (filter && a.kategori !== filter) { return false; }
    if (pfilt.length) {
      var gp = getPrio(a);
      if (!(gp ? pfilt.indexOf(String(gp)) >= 0 : pfilt.indexOf('x') >= 0)) { return false; }
    }
    if (!sokord) { return true; }
    hay = [a.namn, a.kategori, a.beskrivning].concat((a.lankar || []).map(function (l) { return l.etikett + ' ' + l.typ + ' ' + l.url; })).join(' ').toLowerCase();
    return hay.indexOf(sokord) >= 0;
  }

  function chip(l, nf) {
    var url = safeUrl(l.url), dod = l.status === 'ej uppe' || l.status === 'borttaget', dim = l.status === 'privat' || l.status === 'servern ej igång' || l.status === 'gammal adress', cls, c, sub;
    if (l.typ === 'lokal') { cls = 'lok'; } else if (l.kraver_tailscale) { cls = 'ts'; } else { cls = 'pub'; }
    if (dim) { cls = 'lok'; }
    if (dod) { cls = 'dod'; }
    if (!url) { cls = 'plan'; }
    sub = l.kraver_login ? 'publik, kräver egen inloggning' : l.typ === 'lokal' ? 'bara på datorn' : l.kraver_tailscale ? 'kräver Tailscale' : l.status === 'privat' ? 'kräver GitHub-inloggning' : l.status === 'servern ej igång' ? 'servern ej igång' : l.status === 'gammal adress' ? 'gammal adress' : l.status === 'borttaget' ? 'borttaget' : l.status === 'planerad' ? 'planerad' : dod ? 'ej uppe' : 'publik';
    c = el(url ? 'a' : 'span', 'chip ' + cls);
    c.appendChild(document.createTextNode((IKON[l.typ] || '🔗') + ' ' + (NAMN[l.typ] || l.etikett || 'Länk')));
    c.appendChild(el('small', null, sub));
    if (url) { c.href = url; c.target = nf ? '_blank' : '_self'; if (nf) { c.rel = 'noopener'; } c.title = l.etikett || ''; }
    return c;
  }
  function kort(a, gammalt) {
    var pbk, pv, im, k = el('div', 'kort' + (gammalt ? ' gammal' : '') + (safeUrl(a.primar) ? '' : ' utan')), hu, tx, ch, i, lank = a.lankar || [];
    k.style.position = 'relative';
    pbk = el('button', 'pb', getPrio(a) ? PIK[getPrio(a)] : '☆');
    pbk.type = 'button'; pbk.title = getPrio(a) ? 'Prio ' + getPrio(a) + ' ' + PN[getPrio(a)] + ' (tryck för att ändra)' : 'Sätt prio';
    pbk.onclick = function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } oppnaMeny(a); return false; };
    k.style.setProperty('--c', FARG[a.kategori] || '#3a6ea5');
    hu = el(safeUrl(a.primar) ? 'a' : 'div', 'hu');
    if (safeUrl(a.primar)) { hu.href = a.primar; hu.target = a.ny_flik ? '_blank' : '_self'; if (a.ny_flik) { hu.rel = 'noopener'; } }
    hu.appendChild(el('span', 'ic', a.ikon || '⭐'));
    tx = el('span', 'tx');
    tx.appendChild(el('span', 'nm', (Number(a.fast_rank) > 0 ? '📌 ' : '') + (a.namn || a.id || 'Namnlös')));
    if (a.beskrivning) { tx.appendChild(el('span', 'bs', a.beskrivning)); }
    if (a.senast_aktiv) { tx.appendChild(el('span', 'tid', 'Senast aktiv för ' + tidSedan(a.senast_aktiv) + ' sedan')); } else if (a.ny_flik) { tx.appendChild(el('span', 'tid', 'Extern webbplats (öppnas i ny flik)')); }
    hu.appendChild(tx);
    k.appendChild(hu);
    k.appendChild(pbk);
    if (visaPv) {
      pv = el(safeUrl(a.primar) ? 'a' : 'div', 'pv' + (a.forhandsvisning ? '' : ' ph'));
      if (safeUrl(a.primar)) { pv.href = a.primar; pv.target = a.ny_flik ? '_blank' : '_self'; if (a.ny_flik) { pv.rel = 'noopener'; } pv.tabIndex = -1; }
      if (a.forhandsvisning) {
        im = document.createElement('img');
        im.src = a.forhandsvisning; im.loading = 'lazy'; im.width = 160; im.height = 120;
        im.alt = 'Förhandsvisning av ' + (a.namn || a.id);
        pv.appendChild(im);
        if (a.suddad) { pv.appendChild(el('span', 'sud', '🔒 suddad')); } else if (a.login_sida) { pv.appendChild(el('span', 'sud', 'login')); }
      } else {
        pv.style.background = 'linear-gradient(135deg,' + (FARG[a.kategori] || '#3a6ea5') + ',#1b202a)';
        pv.appendChild(el('span', 'pi', a.ikon || '⭐'));
        pv.setAttribute('aria-label', 'Ingen förhandsvisning av ' + (a.namn || a.id));
      }
      k.appendChild(pv);
    }
    if (lank.length) {
      ch = el('div', 'chips');
      for (i = 0; i < lank.length; i++) { ch.appendChild(chip(lank[i], a.ny_flik)); }
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
      b.onclick = function () { filter = v; stateChanged(); renderHome(); };
      f.appendChild(b);
    }
    knapp('Alla', '');
    for (i = 0; i < kats.length; i++) { knapp(kats[i], kats[i]); }
  }
  function renderPFilter() {
    var f = $('pfilter'), v = [['1', PIK[1] + ' 1'], ['2', PIK[2] + ' 2'], ['3', PIK[3] + ' 3'], ['4', PIK[4] + ' 4'], ['x', 'Ej satt']], b;
    f.innerHTML = '';
    b = el('button', 'fknapp' + (!pfilt.length ? ' pa' : ''), 'Alla');
    b.type = 'button'; b.onclick = function () { pfilt = []; stateChanged(); renderHome(); }; f.appendChild(b);
    v.forEach(function (e) {
      var on = pfilt.indexOf(e[0]) >= 0, k = el('button', 'fknapp' + (on ? ' pa' : ''), e[1]);
      k.type = 'button'; k.setAttribute('aria-pressed', on ? 'true' : 'false');
      k.onclick = function () {
        var i = pfilt.indexOf(e[0]);
        if (i >= 0) { pfilt.splice(i, 1); } else { pfilt.push(e[0]); }
        stateChanged(); renderHome();
      };
      f.appendChild(k);
    });
    b = el('button', 'fknapp', 'Alla prio 1\u20134');
    b.type = 'button'; b.onclick = function () { pfilt = ['1', '2', '3', '4']; stateChanged(); renderHome(); }; f.appendChild(b);
  }
  function renderPrio() {
    var alla = effektiva(), box = $('plist'), cnt = [0, 0, 0, 0, 0], sel = $('pvsel'), kats = (data.kategorier || []).slice(), q = psok, y;
    alla.forEach(function (a) { cnt[getPrio(a)]++; if (kats.indexOf(a.kategori) < 0) { kats.push(a.kategori); } });
    $('pcount').innerHTML = '';
    [1, 2, 3, 4].forEach(function (n) { $('pcount').appendChild(el('span', null, PIK[n] + ' ' + n + ': ' + cnt[n])); });
    $('pcount').appendChild(el('span', null, 'Ej satt: ' + cnt[0]));
    if (!sel.options.length) {
      sel.appendChild(new Option('Alla kategorier', ''));
      kats.forEach(function (k) { sel.appendChild(new Option(k, k)); });
      sel.onchange = function () { pkat = sel.value; renderPrio(); };
    }
    box.innerHTML = '';
    alla.filter(function (a) {
      return (!pkat || a.kategori === pkat) && (!q || (a.namn + ' ' + a.kategori).toLowerCase().indexOf(q) >= 0);
    }).sort(nyast).forEach(function (a) {
      var r = el('div', 'prad'), n = el('div', 'pn', (a.ikon || '') + ' ' + a.namn), kn = el('div', 'pk');
      n.appendChild(el('small', null, a.kategori));
      [1, 2, 3, 4].forEach(function (p) {
        var b = el('button', 'pb' + (getPrio(a) === p ? ' pa' : ''), PIK[p] + ' ' + p);
        b.type = 'button'; b.title = PN[p];
        b.onclick = function () { setPrio(a, p); };
        kn.appendChild(b);
      });
      y = el('button', 'pb ing' + (getPrio(a) ? '' : ' pa'), 'ingen');
      y.type = 'button';
      y.onclick = function () { setPrio(a, 0); };
      kn.appendChild(y);
      r.appendChild(n); r.appendChild(kn);
      box.appendChild(r);
    });
  }
  function renderHome() {
    var g = $('grid'), alla = effektiva(), vis, senaste, fast, gr = Date.now() - 7 * 86400000, kats;
    g.innerHTML = '';
    $('rubrik').textContent = data.title || 'Hemskärm';
    renderFilter(alla);
    renderPFilter();
    vis = alla.filter(matchar).sort(nyast);
    if (pfilt.length) {
      [1, 2, 3, 4, 0].forEach(function (n) {
        var grp = vis.filter(function (a) { return getPrio(a) === n; }).sort(function (x, y) { return ms(y) - ms(x); });
        sektion(g, n ? PIK[n] + ' ' + PN[n] + ' (' + grp.length + ')' : 'Ej satt (' + grp.length + ')', grp, n === 1);
      });
      if (!vis.length) { g.appendChild(el('p', 'msg', 'Inget matchar filtren.')); }
      $('stampel').textContent = vis.length + ' av ' + alla.length + ' appar visas, rangordnade efter prio.';
      visaStatus();
      return;
    }
    senaste = vis.filter(function (a) { return ms(a) >= gr; });
    fast = vis.filter(function (a) { return Number(a.fast_rank) > 0; }).sort(function (x, y) { return Number(x.fast_rank) - Number(y.fast_rank); });
    if (!filter && !sokord) { sektion(g, '📌 Fästa', fast, true); }
    if (!filter) { sektion(g, 'Senast använda (7 dagar)', senaste, true); }
    kats = (data.kategorier || []).slice();
    vis.forEach(function (a) { if (kats.indexOf(a.kategori) < 0) { kats.push(a.kategori); } });
    kats.forEach(function (k) { sektion(g, k, vis.filter(function (a) { return a.kategori === k; }), false); });
    if (!vis.length) { g.appendChild(el('p', 'msg', 'Inget matchar sökningen.')); }
    visaStatus();
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
  function flytta(lista, i, d) {
    var j = i + d, t;
    if (j < 0 || j >= lista.length) { return; }
    t = lista[i]; lista[i] = lista[j]; lista[j] = t;
    lista.forEach(function (a, k) { sattFalt(a, 'ordning', k + 1); });
    renderEdit();
  }
  function lankRader(a) {
    var w = el('div', 'ed'), lank = (a.lankar || []).map(function (l) { return Object.assign({}, l); }), TYP = ['tailscale', 'github', 'vercel', 'supabase', 'base44', 'lokal', 'annat'];
    w.style.width = '100%'; w.style.background = '#1b202a';
    function spara() { sattFalt(a, 'lankar', lank.map(function (l) { return Object.assign({}, l); })); }
    function rita() {
      w.innerHTML = '';
      lank.forEach(function (l, i) {
        var r = el('div', null), t = el('select'), e = el('input'), u = el('input'), d = el('a', 'liten del', 'Ta bort');
        r.style.cssText = 'display:flex;gap:6px;flex-wrap:wrap;width:100%;align-items:center';
        TYP.forEach(function (x) { var o = el('option', null, x); o.value = x; if (x === l.typ) { o.selected = true; } t.appendChild(o); });
        t.onchange = function () { l.typ = t.value; l.kraver_tailscale = t.value === 'tailscale'; spara(); };
        e.type = 'text'; e.value = l.etikett || ''; e.placeholder = 'Etikett'; e.style.flex = '1 1 140px';
        e.oninput = function () { l.etikett = e.value; spara(); };
        u.type = 'url'; u.value = l.url || ''; u.placeholder = 'https://...'; u.style.flex = '3 1 220px';
        u.oninput = function () { l.url = u.value; spara(); };
        d.href = '#'; d.onclick = function () { lank.splice(i, 1); spara(); rita(); return false; };
        [t, e, u].forEach(function (x) { x.style.minHeight = '44px'; x.style.fontSize = '15px'; });
        r.appendChild(t); r.appendChild(e); r.appendChild(u); r.appendChild(d); w.appendChild(r);
      });
      var nb = el('a', 'liten', '+ länk'); nb.href = '#';
      nb.onclick = function () { lank.push({ typ: 'annat', etikett: '', url: '', status: 'okänd', kraver_tailscale: false }); spara(); rita(); return false; };
      w.appendChild(nb);
    }
    rita();
    return w;
  }
  function renderEdit() {
    var box = $('editlist'), alla = effektiva(), kats = data.kategorier || [], lista;
    box.innerHTML = '';
    alla.sort(function (x, y) {
      var ox = x.ordning === undefined || x.ordning === '' ? null : Number(x.ordning), oy = y.ordning === undefined || y.ordning === '' ? null : Number(y.ordning);
      if (ox !== null && oy !== null && ox !== oy) { return ox - oy; }
      if (ox !== null && oy === null) { return -1; }
      if (ox === null && oy !== null) { return 1; }
      return nyast(x, y);
    });
    lista = alla;
    alla.forEach(function (a, idx) {
      var row = el('div', 'ed'), n, ik, u, sel, del, rk, up, ner, sn;
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
      up = el('a', 'liten', '↑'); up.href = '#'; up.title = 'Flytta upp';
      up.onclick = function () { flytta(lista, idx, -1); return false; };
      ner = el('a', 'liten', '↓'); ner.href = '#'; ner.title = 'Flytta ner';
      ner.onclick = function () { flytta(lista, idx, 1); return false; };
      sn = el('input'); sn.type = 'text'; sn.className = 'f4'; sn.value = a.senast_aktiv || ''; sn.placeholder = 'Senast aktiv (ISO, t.ex. 2026-10-17T12:00:00Z)';
      sn.onchange = function () { if (sn.value === '' || !isNaN(Date.parse(sn.value))) { sattFalt(a, 'senast_aktiv', sn.value); } else { sn.value = a.senast_aktiv || ''; } };
      row.appendChild(n); row.appendChild(ik); row.appendChild(u); row.appendChild(rk); row.appendChild(sel); row.appendChild(sn);
      row.appendChild(up); row.appendChild(ner); row.appendChild(del);
      row.appendChild(lankRader(a));
      box.appendChild(row);
    });
    if (man.dolda.length) {
      box.appendChild(el('h2', null, 'Dolda (' + man.dolda.length + ')'));
      man.dolda.forEach(function (id) {
        var r = el('div', 'ed'), b = el('a', 'liten', 'Ångra (visa igen)');
        r.appendChild(el('span', null, id));
        b.href = '#';
        b.onclick = function () { man.dolda = man.dolda.filter(function (x) { return x !== id; }); saveMan(); renderEdit(); return false; };
        r.appendChild(b); box.appendChild(r);
      });
    }
  }
  function setup() {
    $('pvbtn').onclick = function () { visaPv = !visaPv; store('hs_pv', visaPv ? '1' : '0'); stateChanged(); $('pvbtn').textContent = visaPv ? 'Dölj förhandsvisning' : 'Visa förhandsvisning'; renderHome(); return false; };
    $('pvbtn').textContent = visaPv ? 'Dölj förhandsvisning' : 'Visa förhandsvisning';
    $('priobtn').onclick = function () { renderPrio(); show('prio'); return false; };
    $('pdonebtn').onclick = function () { renderHome(); show('home'); return false; };
    $('psok').oninput = function () { psok = this.value.trim().toLowerCase(); renderPrio(); };
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
    $('resetbtn').onclick = function () { man = { overrides: {}, nya: [], dolda: [] }; store('hs_manuell', null); stateChanged(); renderEdit(); return false; };
    $('logoutbtn').onclick = function () { location.href = (window.HS_CFG && window.HS_CFG.logout) || 'logga-ut'; return false; };
    $('sok').oninput = function () { sokord = this.value.trim().toLowerCase(); stateChanged(); renderHome(); };
  }
  function visa(id) {
    if (id === 'prio') { renderPrio(); } else if (id === 'edit') { renderEdit(); }
    show(id);
  }
  function init() {
    fetch('apps.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) {
      if (!r.ok) { throw new Error('http ' + r.status); }
      return r.json();
    }).then(function (d) {
      data = d; loadMan(); setup();
      try { var lokal = JSON.parse(load('hs_state') || 'null'); if (lokal) { tillampaState(lokal); } } catch (e) {}
      renderHome(); visa(vy); klar = true;
      fetch('api/state', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.state && Number(j.ts) > stTs) { tillampaState(j.state); stTs = Number(j.ts); store('hs_state_ts', String(stTs)); store('hs_state', JSON.stringify(j.state)); renderHome(); visa(vy); }
        else if (load('hs_state_dirty') === '1' || (stTs && stTs > Number((j && j.ts) || 0))) { pushState(); }
      }).catch(function () {});
      return fetch('api/prio', { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
        if (j && j.prio) { prio = j.prio; renderHome(); skickaVantande(); }
      }).catch(function () {});
    }).catch(function () { $('grid').appendChild(el('p', 'msg', 'Kunde inte läsa apps.json. Ladda om.')); });
  }
  init();
})();
