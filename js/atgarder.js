/* Åtgärder: appar som Marc måste göra något i blinkar rött, (i) förklarar, filter + senaste. ES5 (gamla iPad). Data: api/atgarder. */
(function () {
  'use strict';
  var lista = [], sig = '', atf = '', opts = null, sheetApp = null, timer = null, msg = '';
  var KAT = [['logga-in', 'Logga in'], ['fyll-i', 'Fyll i'], ['godkann', 'Godkänn'], ['kor-kommando', 'Kör kommando'], ['granska', 'Granska'], ['beslut', 'Beslut']];
  var KATN = {}, PRIN = { hog: 'Hög prio', normal: 'Normal', lag: 'Låg' };
  KAT.forEach(function (k) { KATN[k[0]] = k[1]; });
  try { atf = localStorage.getItem('hs_atf') || ''; } catch (e) { atf = ''; }
  if (!/^(behover|nya|hog|cat:[a-z-]+)$/.test(atf)) { atf = ''; }

  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) { e.className = cls; } if (text !== undefined) { e.textContent = text; } return e; }
  function setAtf(v) { atf = v; try { localStorage.setItem('hs_atf', v); } catch (e) {} }
  function oppna() { return lista.filter(function (x) { return x.status === 'oppen'; }); }
  function forApp(id) { return oppna().filter(function (x) { return x.app === id; }); }
  function idagStart() { var d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); }
  function t(iso) { var v = Date.parse(iso); return isNaN(v) ? 0 : v; }
  function sedan(iso) {
    var s = (Date.now() - t(iso)) / 1000, m = s / 60;
    if (!t(iso)) { return ''; }
    if (s < 90) { return 'nyss'; }
    if (m < 60) { return 'för ' + Math.round(m) + ' min sedan'; }
    if (m < 60 * 36) { return 'för ' + Math.round(m / 60) + ' tim sedan'; }
    return 'för ' + Math.round(m / 1440) + ' dagar sedan';
  }
  function traff(x) {
    if (atf === 'nya') { return t(x.skapad) >= idagStart(); }
    if (atf === 'hog') { return x.prio === 'hog'; }
    if (atf.indexOf('cat:') === 0) { return x.kategori === atf.slice(4); }
    return true;
  }
  // Filtret: appen måste ha minst en öppen åtgärd som träffar (när filter satt).
  function matcha(a) { return !atf || forApp(a.id).filter(traff).length > 0; }
  function sok(a, q) {
    var h = forApp(a.id).map(function (x) { return x.titel + ' ' + x.forklaring + ' ' + (KATN[x.kategori] || ''); }).join(' ').toLowerCase();
    return h.indexOf(q) >= 0;
  }
  function senastApp(id) { var m = 0; forApp(id).forEach(function (x) { m = Math.max(m, t(x.uppdaterad)); }); return m; }
  function cmp(x, y) {
    var a = senastApp(x.id), b = senastApp(y.id);
    if (a || b) { return b - a; }
    return 0;
  }
  function nyligen(a) { return senastApp(a.id) >= Date.now() - 7 * 86400000 && senastApp(a.id) > 0; }

  function kopiera(txt, knapp) {
    function ok() { var o = knapp.textContent; knapp.textContent = 'Kopierat'; setTimeout(function () { knapp.textContent = o; }, 1500); }
    function reserv() {
      var ta = document.createElement('textarea');
      ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); ok(); } catch (e) {}
      document.body.removeChild(ta);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(txt).then(ok, reserv); } else { reserv(); }
  }
  function kopKnapp(txt) {
    var b = el('button', 'atkop', 'Kopiera');
    b.type = 'button';
    b.onclick = function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } kopiera(txt, b); };
    return b;
  }
  function forklaring(txt) {
    var box = el('div', 'atfork');
    String(txt).split('\n').forEach(function (rad) {
      var m, rest, re = /https?:\/\/[^\s)<>"]+/g, last = 0, p, cmd;
      if (!rad.trim()) { return; }
      if (rad.indexOf('$ ') === 0) {
        cmd = el('div', 'atcmd');
        cmd.appendChild(el('code', null, rad.slice(2)));
        cmd.appendChild(kopKnapp(rad.slice(2)));
        box.appendChild(cmd);
        return;
      }
      p = el('p');
      rest = rad;
      while ((m = re.exec(rest)) !== null) {
        if (m.index > last) { p.appendChild(document.createTextNode(rest.slice(last, m.index))); }
        var a = el('a', 'atlank', m[0]);
        a.href = m[0]; a.target = '_blank'; a.rel = 'noopener';
        p.appendChild(a);
        p.appendChild(kopKnapp(m[0]));
        last = m.index + m[0].length;
      }
      if (last < rest.length) { p.appendChild(document.createTextNode(rest.slice(last))); }
      box.appendChild(p);
    });
    return box;
  }

  function post(url, body, cb) {
    var x = new XMLHttpRequest();
    x.open('POST', url, true);
    x.setRequestHeader('Content-Type', 'application/json');
    x.onreadystatechange = function () { if (x.readyState === 4) { cb(x.status === 200, x.responseText); } };
    try { x.send(JSON.stringify(body || {})); } catch (e) { cb(false, ''); }
  }
  function klar(x) {
    msg = '';
    post('api/atgarder/' + encodeURIComponent(x.id) + '/klar', {}, function (ok) {
      if (ok) { x.status = 'klar'; sig = ''; omrita(); } else { msg = 'Kunde inte markera klar (servern nåddes inte). Försök igen.'; ritaSheet(); }
    });
  }

  /* ---------- infopanel ---------- */
  var selId = null, MQ2 = '(min-width:800px) and (max-width:990px) and (min-aspect-ratio:4/5) and (max-aspect-ratio:5/4)';
  function tvapanel() {
    try { return !!(window.matchMedia && (window.matchMedia(MQ2).matches || window.matchMedia('(horizontal-viewport-segments: 2)').matches)); } catch (e) { return false; }
  }
  function kortAt(x, i, n) {
    var c = el('div', 'atkort p-' + x.prio), h = el('div', 'atkh'), kn;
    h.appendChild(el('span', 'atnr', String(i + 1) + '/' + n));
    h.appendChild(el('span', 'atpill ' + x.prio, PRIN[x.prio] || x.prio));
    h.appendChild(el('span', 'atpill kat', KATN[x.kategori] || x.kategori));
    h.appendChild(el('span', 'atpill kal', x.kalla));
    h.appendChild(el('span', 'attid', sedan(x.uppdaterad)));
    c.appendChild(h);
    c.appendChild(el('div', 'attitel', x.titel));
    c.appendChild(forklaring(x.forklaring));
    kn = el('button', 'atklar', 'Markera klar');
    kn.type = 'button'; kn.onclick = function () { klar(x); };
    c.appendChild(kn);
    return c;
  }
  function ritaSheet() {
    var ov = document.getElementById('atov'), lst, items, hdr, app, sc, sc2, two = tvapanel(), nav, det, sel = null, i;
    if (!ov || !sheetApp) { return; }
    lst = ov.querySelector('.atlist'); nav = ov.querySelector('.atnav');
    sc = lst ? lst.scrollTop : 0; sc2 = nav ? nav.scrollTop : 0;
    ov.innerHTML = '';
    app = opts.vilkenApp(sheetApp) || { namn: sheetApp, ikon: '' };
    items = forApp(sheetApp).sort(function (a, b) { return t(b.uppdaterad) - t(a.uppdaterad); });
    var sh = el('div', 'atsheet' + (two ? ' at2' : ''));
    sh.setAttribute('role', 'dialog'); sh.setAttribute('aria-label', 'Åtgärder för ' + app.namn);
    sh.onclick = function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } };
    hdr = el('div', 'athdr');
    hdr.appendChild(el('div', 'atht', (app.ikon || '') + ' ' + app.namn + ' (' + items.length + ' att göra)'));
    var cl = el('button', 'atstang', 'Stäng');
    cl.type = 'button'; cl.onclick = stangSheet;
    hdr.appendChild(cl);
    sh.appendChild(hdr);
    if (msg) { sh.appendChild(el('p', 'atmsg', msg)); }
    if (two && items.length) {
      for (i = 0; i < items.length; i++) { if (items[i].id === selId) { sel = i; } }
      if (sel === null) { sel = 0; selId = items[0].id; }
      var body = el('div', 'at2body');
      nav = el('div', 'atnav'); det = el('div', 'atlist atdet');
      items.forEach(function (x, k) {
        var b = el('button', 'atnavb p-' + x.prio + (k === sel ? ' pa' : ''));
        b.type = 'button';
        b.appendChild(el('span', 'atnavt', (k + 1) + '. ' + x.titel));
        b.appendChild(el('span', 'atnavs', (KATN[x.kategori] || '') + ' · ' + sedan(x.uppdaterad)));
        b.onclick = function () { selId = x.id; sc = 0; ritaSheet(); };
        nav.appendChild(b);
      });
      det.appendChild(kortAt(items[sel], sel, items.length));
      body.appendChild(nav); body.appendChild(det);
      sh.appendChild(body);
      ov.appendChild(sh);
      nav.scrollTop = sc2; det.scrollTop = sc;
      return;
    }
    lst = el('div', 'atlist');
    if (!items.length) { lst.appendChild(el('p', 'atmsg', 'Inget kvar att göra här. Bra jobbat!')); }
    items.forEach(function (x, k) { lst.appendChild(kortAt(x, k, items.length)); });
    sh.appendChild(lst);
    ov.appendChild(sh);
    lst.scrollTop = sc;
  }
  function stangSheet() {
    var ov = document.getElementById('atov');
    sheetApp = null; msg = '';
    if (ov && ov.parentNode) { ov.parentNode.removeChild(ov); }
  }
  function oppnaSheet(appId) {
    stangSheet();
    sheetApp = appId; msg = '';
    var ov = el('div', 'atov');
    ov.id = 'atov';
    ov.onclick = stangSheet;
    document.body.appendChild(ov);
    ritaSheet();
  }

  /* ---------- kort, bar, senaste ---------- */
  function dekorera(k, a) {
    var n = forApp(a.id).length, b, hu;
    if (!n) { return; }
    k.className += ' at-has';
    b = el('button', 'atinfo');
    b.type = 'button';
    b.setAttribute('aria-label', n + ' åtgärder för ' + (a.namn || a.id) + ': visa vad som behöver göras');
    b.title = 'Vad behöver göras?';
    b.appendChild(el('span', 'ati', 'i'));
    b.appendChild(el('span', 'atn', String(n)));
    b.onclick = function (e) { if (e && e.stopPropagation) { e.stopPropagation(); } oppnaSheet(a.id); return false; };
    k.appendChild(b);
    hu = k.querySelector('.hu');
    if (hu) { hu.className += ' at-hu'; }
  }
  function antalTot() { return oppna().length; }
  function bar() {
    var h = document.getElementById('atbar'), n = antalTot(), tot = oppna(), f, c, rad;
    if (!h) { return; }
    h.innerHTML = '';
    if (!n && !atf) { return; }
    rad = el('div', 'atrad');
    c = el('button', 'atchip' + (n ? ' blink' : '') + (atf ? ' pa' : ''), '');
    c.type = 'button'; c.setAttribute('aria-pressed', atf ? 'true' : 'false');
    c.appendChild(el('span', 'atchipt', 'Åtgärder'));
    c.appendChild(el('span', 'atn', String(n)));
    c.onclick = function () { setAtf(atf ? '' : 'behover'); opts.rerender(); };
    rad.appendChild(c);
    f = el('div', 'filter atfilter');
    function knapp(txt, v, antal) {
      var b = el('button', 'fknapp' + (atf === v ? ' pa' : '') + (antal === 0 ? ' noll' : ''), txt + (antal === undefined ? '' : ' ' + antal));
      b.type = 'button';
      b.onclick = function () { setAtf(v); opts.rerender(); };
      f.appendChild(b);
    }
    knapp('Alla', '');
    knapp('Behöver åtgärd', 'behover', tot.length);
    knapp('Nya idag', 'nya', tot.filter(function (x) { return t(x.skapad) >= idagStart(); }).length);
    knapp('Hög prio', 'hog', tot.filter(function (x) { return x.prio === 'hog'; }).length);
    KAT.forEach(function (k) { knapp(k[1], 'cat:' + k[0], tot.filter(function (x) { return x.kategori === k[0]; }).length); });
    rad.appendChild(f);
    h.appendChild(rad);
  }
  // Senaste förfrågningar överst när ett åtgärdsfilter är valt (apps = redan filtrerade appar).
  function recent(g, apps) {
    var ids = {}, rader, h, box;
    if (!atf) { return; }
    apps.forEach(function (a) { ids[a.id] = a; });
    rader = oppna().filter(function (x) { return ids[x.app] && traff(x); }).sort(function (a, b) { return t(b.uppdaterad) - t(a.uppdaterad); });
    if (!rader.length) { return; }
    h = el('h2', 'ny', 'Senaste förfrågningar');
    h.appendChild(el('small', null, rader.length + ' st'));
    g.appendChild(h);
    box = el('div', 'atrecent');
    rader.slice(0, 30).forEach(function (x) {
      var a = ids[x.app], r = el('button', 'atrr p-' + x.prio), tx = el('span', 'atrt');
      r.type = 'button';
      r.appendChild(el('span', 'atrik', a.ikon || '⭐'));
      tx.appendChild(el('span', 'atrtitel', x.titel));
      tx.appendChild(el('span', 'atrsub', (a.namn || a.id) + ' · ' + (KATN[x.kategori] || x.kategori) + ' · ' + (PRIN[x.prio] || '') + ' · ' + sedan(x.uppdaterad)));
      r.appendChild(tx);
      r.onclick = function () { oppnaSheet(x.app); };
      box.appendChild(r);
    });
    g.appendChild(box);
  }

  /* ---------- hämtning + polling ---------- */
  function omrita() {
    var y = window.pageYOffset || 0;
    opts.rerender();
    if (sheetApp) { ritaSheet(); }
    window.scrollTo(0, y);
  }
  function ladda() {
    if (document.hidden) { return; }
    fetch('api/atgarder?t=' + Date.now(), { cache: 'no-store', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      var s;
      if (!j || !j.atgarder) { return; }
      s = JSON.stringify(j.atgarder);
      if (s === sig) { return; }
      sig = s; lista = j.atgarder;
      omrita();
    }).catch(function () {});
  }
  function init(o) {
    opts = o;
    ladda();
    if (!timer) { timer = setInterval(ladda, 60000); }
    var rt = null, lastTwo = tvapanel();
    function vv() { try { var h = window.visualViewport ? window.visualViewport.height : window.innerHeight; document.documentElement.style.setProperty('--vvh', Math.round(h) + 'px'); } catch (e) {} }
    function efterResize() {
      vv();
      clearTimeout(rt);
      rt = setTimeout(function () { var n = tvapanel(); if (sheetApp && n !== lastTwo) { ritaSheet(); } lastTwo = n; }, 120);
    }
    vv();
    window.addEventListener('resize', efterResize);
    window.addEventListener('orientationchange', efterResize);
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', efterResize); }
    try { var mq = window.matchMedia('(horizontal-viewport-segments: 2)'); if (mq.addEventListener) { mq.addEventListener('change', efterResize); } } catch (e) {}
    document.addEventListener('visibilitychange', function () { if (!document.hidden) { ladda(); } });
  }
  window.HS_AT = { init: init, dekorera: dekorera, matcha: matcha, sok: sok, cmp: cmp, nyligen: nyligen, bar: bar, recent: recent, aktiv: function () { return atf; } };
})();
