/* Hemskarm - ren ES5. Klientgrind (bekvamlighetsspärr, inte riktig sakerhet). */
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var auth = null, repo = null, apps = [], editMode = false;

  function store(k, v) { try { if (v === null) { localStorage.removeItem(k); } else { localStorage.setItem(k, v); } } catch (e) {} }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function getJSON(url, cb) {
    var x = new XMLHttpRequest();
    x.open('GET', url + '?t=' + (new Date().getTime()), true);
    x.onreadystatechange = function () {
      var d;
      if (x.readyState !== 4) { return; }
      if (x.status === 200 || (x.status === 0 && x.responseText)) {
        try { d = JSON.parse(x.responseText); } catch (e) { cb(null); return; }
        cb(d);
      } else { cb(null); }
    };
    try { x.send(null); } catch (e) { cb(null); }
  }

  function show(id) {
    var ids = ['login', 'home', 'edit'], i;
    for (i = 0; i < ids.length; i++) { $(ids[i]).style.display = ids[i] === id ? 'block' : 'none'; }
  }
  function on(id, fn) { $(id).onclick = function () { fn(); return false; }; }
  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) { e.className = cls; }
    if (text !== undefined) { e.appendChild(document.createTextNode(text)); }
    return e;
  }

  /* ---------- data ---------- */
  function loadApps() {
    var raw = load('hs_apps'), loc = null;
    try { loc = raw ? JSON.parse(raw) : null; } catch (e) { loc = null; }
    if (loc && loc.rev === repo.rev && loc.apps && loc.apps.length !== undefined) { apps = loc.apps; }
    else { apps = JSON.parse(JSON.stringify(repo.apps || [])); }
  }
  function saveApps() { store('hs_apps', JSON.stringify({ rev: repo.rev, apps: apps })); }
  function safeUrl(u) { u = String(u || '').replace(/^\s+|\s+$/g, ''); return /^https?:\/\//i.test(u) ? u : ''; }
  function safeColor(c) { return /^#[0-9a-f]{3,6}$/i.test(c || '') ? c : '#3a6ea5'; }

  /* ---------- hem ---------- */
  function renderHome() {
    var g = $('grid'), i, a, grp, cur = null, box = null, t, link;
    g.innerHTML = '';
    $('rubrik').innerHTML = '';
    $('rubrik').appendChild(document.createTextNode(repo.title || 'Hemskärm'));
    for (i = 0; i < apps.length; i++) {
      a = apps[i];
      grp = a.group || '';
      if (box === null || grp !== cur) {
        cur = grp;
        if (grp) { g.appendChild(el('h2', null, grp)); }
        box = el('div', 'grp');
        g.appendChild(box);
      }
      t = el('div', 'tile');
      link = el('a');
      link.href = safeUrl(a.url) || '#';
      link.target = '_self';
      link.style.backgroundColor = safeColor(a.color);
      link.appendChild(el('span', 'ic', a.icon || '⭐'));
      link.appendChild(el('span', 'nm', a.name || '?'));
      t.appendChild(link);
      box.appendChild(t);
    }
    if (!apps.length) { g.appendChild(el('p', 'msg', 'Inga appar. Tryck Redigera.')); }
  }

  /* ---------- redigera ---------- */
  function field(cls, val, ph, key, idx, type) {
    var d = el('div', 'f ' + cls), inp = el('input');
    inp.type = type || 'text';
    inp.value = val || '';
    inp.placeholder = ph;
    inp.setAttribute('autocapitalize', 'off');
    inp.setAttribute('autocorrect', 'off');
    inp.onchange = inp.onkeyup = function () { apps[idx][key] = inp.value; saveApps(); };
    d.appendChild(inp);
    return d;
  }
  function btn(txt, cls, fn) {
    var b = el('a', 'liten ' + (cls || ''), txt);
    b.href = '#';
    b.onclick = function () { fn(); return false; };
    return b;
  }
  function renderEdit() {
    var box = $('editlist'), i, a, row, bs;
    box.innerHTML = '';
    for (i = 0; i < apps.length; i++) {
      (function (idx) {
        a = apps[idx];
        row = el('div', 'ed');
        row.appendChild(field('f1', a.name, 'Namn', 'name', idx));
        row.appendChild(field('f2', a.icon, 'Ikon', 'icon', idx));
        row.appendChild(field('f3', a.url, 'https://...', 'url', idx, 'url'));
        row.appendChild(field('f4', a.color, '#rrggbb', 'color', idx));
        row.appendChild(field('f5', a.group, 'Grupp', 'group', idx));
        bs = el('div', 'btns');
        bs.appendChild(btn('Upp', '', function () { move(idx, -1); }));
        bs.appendChild(btn('Ner', '', function () { move(idx, 1); }));
        bs.appendChild(btn('Ta bort', 'del', function () { apps.splice(idx, 1); saveApps(); renderEdit(); }));
        row.appendChild(bs);
        box.appendChild(row);
      })(i);
    }
  }
  function move(i, d) {
    var j = i + d, t;
    if (j < 0 || j >= apps.length) { return; }
    t = apps[i]; apps[i] = apps[j]; apps[j] = t;
    saveApps(); renderEdit();
  }

  function setupUi() {
    on('editbtn', function () { editMode = true; renderEdit(); show('edit'); window.scrollTo(0, 0); });
    on('donebtn', function () {
      var i;
      for (i = 0; i < apps.length; i++) { apps[i].url = safeUrl(apps[i].url) || apps[i].url; }
      saveApps(); editMode = false; renderHome(); show('home'); window.scrollTo(0, 0);
    });
    on('addbtn', function () {
      apps.push({ name: 'Ny app', icon: '⭐', url: 'https://', color: '#3a6ea5', group: apps.length ? (apps[apps.length - 1].group || '') : '' });
      saveApps(); renderEdit();
    });
    on('exportbtn', function () {
      var b = $('jsonbox');
      b.value = JSON.stringify({ title: repo.title, rev: repo.rev + 1, apps: apps }, null, 1);
      b.style.display = 'block';
      b.focus();
      try { b.select(); } catch (e) {}
    });
    on('resetbtn', function () { store('hs_apps', null); loadApps(); renderEdit(); });
    on('logoutbtn', function () { store('hs_ok', null); location.reload(); });
  }

  /* ---------- inloggning ---------- */
  function startApp() {
    loadApps(); renderHome(); setupUi(); show('home');
  }
  function doLogin() {
    var e = $('epost').value.replace(/^\s+|\s+$/g, '').toLowerCase(), p = $('losen').value, msg = $('loginmsg');
    if (!e || !p) { msg.innerHTML = 'Fyll i båda fälten.'; return; }
    $('loginbtn').disabled = true;
    msg.innerHTML = 'Kontrollerar...';
    window.pbkdf2Sha256(e + '\n' + p, auth.salt, auth.iter, function (f) {
      msg.innerHTML = 'Kontrollerar ' + Math.round(f * 100) + ' %';
    }, function (hex) {
      $('loginbtn').disabled = false;
      $('losen').value = '';
      if (hex === auth.hash) { store('hs_ok', auth.hash); msg.innerHTML = '&nbsp;'; startApp(); }
      else { msg.innerHTML = 'Fel e-post eller lösenord.'; }
    });
  }

  function init() {
    getJSON('auth.json', function (a) {
      auth = a;
      getJSON('apps.json', function (r) {
        repo = r;
        if (!auth || !repo) {
          show('login');
          $('loginmsg').innerHTML = 'Kunde inte läsa sidans filer. Ladda om.';
          return;
        }
        if (load('hs_ok') === auth.hash) { startApp(); return; }
        show('login');
        $('loginform').onsubmit = function () { doLogin(); return false; };
      });
    });
  }
  init();
})();
