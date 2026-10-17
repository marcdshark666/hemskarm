# Test åtgärdssystemet mot 127.0.0.1:5204 (lokalt = inloggad). Skapar 3 testposter på appen 'vanner' och tar bort dem (markerar klara).
# Kör: PYTHONIOENCODING=utf-8 python test/test_atgarder.py [skärmbildssökväg]
import os, sys, json, urllib.request
from playwright.sync_api import sync_playwright
base = 'http://127.0.0.1:5204/hemskarm/'
shot = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), 'atgarder.png')
fails = []
def ok(c, m):
    print(('OK  ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def api(path, body=None, ctype='application/json', hdr=None):
    h = {'Content-Type': ctype}; h.update(hdr or {})
    r = urllib.request.Request(base + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(r) as x: return x.status, json.loads(x.read() or 'null')
    except urllib.error.HTTPError as e: return e.code, e.read().decode()
ids = []
def skapa3():
    while ids: api('api/atgarder/%s/klar' % ids.pop(), {})
    for i in range(3):
        s, j = api('api/atgarder', {'app': 'vanner', 'titel': 'TESTÅTGÄRD %d' % (i + 1), 'forklaring': 'Test %d\n$ echo hej\nhttps://example.com/x' % (i + 1), 'prio': 'hog' if i == 0 else 'normal', 'kategori': 'godkann'})
        ok(s == 200, 'skapa %d' % i); ids.append(j['atgard']['id'])
ok(api('api/atgarder', {'app': 'finnsinte', 'titel': 'x', 'forklaring': 'y'})[0] == 400, 'okänd app -> 400')
ok(api('api/atgarder', {'app': 'vanner', 'titel': 'x', 'forklaring': 'password: hemligt123'})[0] == 400, 'hemlighet avvisas')
ok(api('api/atgarder', {'app': 'vanner', 'titel': 'x', 'forklaring': 'y'}, ctype='text/plain')[0] == 415, 'text/plain -> 415')
ok(api('api/atgarder', {'app': 'vanner', 'titel': 'x', 'forklaring': 'y'}, hdr={'Origin': 'https://evil.example'})[0] == 403, 'fel origin -> 403')
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for w, h in [(1024, 768), (768, 1024), (412, 900)]:
            skapa3()
            ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
            errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(base); pg.wait_for_selector('#grid .kort', timeout=15000); pg.wait_for_selector('.kort.at-has', timeout=8000)
            card = pg.locator('.kort.at-has', has_text='Vänkrets').first
            ok(card.count() == 1, '%d: Vänkrets blinkar (at-has)' % w)
            ok(card.locator('.atinfo .atn').inner_text() == '3', '%d: räknare 3' % w)
            an = pg.evaluate("getComputedStyle(document.querySelector('.kort.at-has')).animationName")
            ok(an == 'atpuls', '%d: animation %s' % (w, an))
            box = card.locator('.atinfo').bounding_box(); ok(box['width'] >= 44 and box['height'] >= 44, '%d: (i) >=44px %s' % (w, box))
            tot = int(pg.locator('.atchip .atn').inner_text()); ok(tot >= 18, '%d: total %d' % (w, tot))
            ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"), '%d: ingen sidled scroll' % w)
            card.locator('.atinfo').click(); pg.wait_for_selector('.atsheet')
            ok(pg.locator('.atkort').count() == 3, '%d: panel 3 poster' % w)
            ok(pg.locator('.atcmd code').first.inner_text() == 'echo hej' and pg.locator('.atcmd .atkop').count() == 3, '%d: kommando + kopiera' % w)
            ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"), '%d: panel ingen sidled' % w)
            if w == 412: pg.screenshot(path=shot.replace('.png', '-412-panel.png'))
            pg.locator('.atklar').first.click(); pg.wait_for_function("document.querySelectorAll('.atkort').length==2")
            ok(card.locator('.atinfo .atn').inner_text() == '2', '%d: räknare 2 efter klar' % w)
            pg.locator('.atstang').click()
            # filter: alla -> bara appar med åtgärder
            pg.locator('.atchip').click(); pg.wait_for_timeout(300)
            n = pg.locator('#grid .kort').count(); ok(0 < n < 86 and pg.locator('#grid .kort:not(.at-has)').count() == 0, '%d: filter Behöver åtgärd -> %d kort alla blinkar' % (w, n))
            ok(pg.locator('.atrr').count() > 0, '%d: Senaste förfrågningar' % w)
            pg.locator('.atfilter .fknapp', has_text='Hög prio').click(); pg.wait_for_timeout(200)
            ok(pg.locator('#grid .kort').count() > 0, '%d: filter Hög prio' % w)
            pg.locator('.atfilter .fknapp', has_text='Logga in').click(); pg.wait_for_timeout(200)
            ok(pg.locator('#grid .kort').count() == 1, '%d: kategori Logga in -> 1 app' % w)
            pg.locator('.atfilter .fknapp').first.click(); pg.wait_for_timeout(200)
            pg.locator('.atchip').click(); pg.wait_for_timeout(200)
            # sök i åtgärdstext
            pg.fill('#sok', 'govee'); pg.wait_for_timeout(300)
            ok(pg.locator('#grid .kort').count() == 1, '%d: sök i åtgärdstext' % w)
            pg.fill('#sok', ''); pg.wait_for_timeout(200)
            # kombinera med kategorifilter
            ok(not errs, '%d: 0 JS-fel %s' % (w, errs))
            if w == 768: pg.screenshot(path=shot)
            ctx.close()
        # reduced motion
        ctx = b.new_context(viewport={'width': 1024, 'height': 768}, reduced_motion='reduce'); pg = ctx.new_page()
        pg.goto(base); pg.wait_for_selector('.kort.at-has')
        r = pg.evaluate("(function(){var s=getComputedStyle(document.querySelector('.kort.at-has'));return [s.animationName,s.boxShadow]})()")
        ok(r[0] == 'none' and 'rgb(229, 57, 53)' in r[1], 'reduced-motion: ingen animation, statisk röd ring %s' % r)
        ctx.close(); b.close()
finally:
    for i in ids: api('api/atgarder/%s/klar' % i, {})
print('FAIL: %s' % fails if fails else 'ALLT OK')
sys.exit(1 if fails else 0)
