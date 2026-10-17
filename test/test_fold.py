# Skärmstorlekar: Galaxy Z Fold 7 (cover/uppfälld), iPad, desktop. Android-UA, touch. Kör: PYTHONIOENCODING=utf-8 python test/test_fold.py
import os, sys, json, urllib.request
from playwright.sync_api import sync_playwright
base = 'http://127.0.0.1:5204/hemskarm/'
OUT = r'C:\Users\PC\.claude\jobs\9bd9882c\tmp'
UA = 'Mozilla/5.0 (Linux; Android 16; SM-F966B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36 OPR/92.0.0.0'
fails = []
def ok(c, m):
    print(('OK  ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
def api(path, body):
    r = urllib.request.Request(base + path, data=json.dumps(body).encode(), headers={'Content-Type': 'application/json'}, method='POST')
    return json.loads(urllib.request.urlopen(r).read())
ids = [api('api/atgarder', {'app': 'vanner', 'titel': 'FOLDTEST %d' % i, 'forklaring': 'Steg %d\nhttps://example.com/x' % i, 'prio': 'hog' if i == 0 else 'normal', 'kategori': 'godkann'})['atgard']['id'] for i in range(3)]
VP = [('cover360', 360, 860, 3, True), ('cover412', 412, 915, 2.6, True), ('fold884', 884, 874, 2.6, True), ('fold968', 968, 848, 2, True), ('ipad768', 768, 1024, 2, False), ('ipad1024', 1024, 768, 2, False), ('desk1280', 1280, 800, 1, False)]
SMALL = """(function(){var o=[];[].forEach.call(document.querySelectorAll('button,.liten,.fknapp,.atchip,a.chip'),function(e){var r=e.getBoundingClientRect();if(r.width&&r.height&&(r.height<44||r.width<44))o.push((e.className||e.tagName)+' '+Math.round(r.width)+'x'+Math.round(r.height))});return o})()"""
try:
    with sync_playwright() as p:
        b = p.chromium.launch()
        for n, w, h, dpr, mob in VP:
            ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=dpr, has_touch=True, is_mobile=mob, user_agent=UA if mob else None)
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
            pg.goto(base); pg.wait_for_selector('.kort.at-has')
            sw = pg.evaluate("[document.documentElement.scrollWidth, window.innerWidth]")
            ok(sw[0] <= sw[1], '%s: ingen sidled scroll %s' % (n, sw))
            cols = pg.evaluate("getComputedStyle(document.querySelector('.rutnat')).gridTemplateColumns.split(' ').length")
            print('    kolumner', cols)
            if n.startswith('cover'): ok(cols == 1, '%s: 1 kolumn' % n)
            if n.startswith('fold'): ok(cols >= 3, '%s: >=3 kolumner (%d)' % (n, cols))
            card = pg.locator('.kort.at-has', has_text='Vänkrets').first
            card.scroll_into_view_if_needed()
            bb = card.locator('.atinfo').bounding_box(); cb = card.bounding_box()
            ok(bb['width'] >= 44 and bb['height'] >= 44 and bb['x'] >= cb['x'] and bb['x'] + bb['width'] <= cb['x'] + cb['width'] + 0.5 and bb['y'] >= cb['y'] and bb['y'] + bb['height'] <= cb['y'] + cb['height'] + 0.5, '%s: (i) helt synligt >=44 %s' % (n, bb))
            small = pg.evaluate(SMALL)
            ok(not small, '%s: inga för små tryckytor %s' % (n, small[:4]))
            card.locator('.atinfo').click(); pg.wait_for_selector('.atsheet')
            two = pg.locator('.atsheet.at2').count()
            if n.startswith('fold'): ok(two == 1 and pg.locator('.atnavb').count() == 3, '%s: tvåpanelsvy' % n)
            else: ok(two == 0, '%s: enpanel' % n)
            sb = pg.locator('.atsheet').bounding_box()
            ok(sb['y'] >= 0 and sb['y'] + sb['height'] <= h + 0.5 and sb['x'] >= 0 and sb['x'] + sb['width'] <= w + 0.5, '%s: panelen ryms i viewport %s' % (n, sb))
            ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"), '%s: panel ingen sidled' % n)
            pg.screenshot(path=os.path.join(OUT, 'fold-%s-panel.png' % n))
            pg.locator('.atstang').click()
            pg.screenshot(path=os.path.join(OUT, 'fold-%s.png' % n))
            ok(not errs, '%s: 0 JS-fel %s' % (n, errs))
            ctx.close()
        # vikning mitt i körning: cover -> uppfälld med öppen panel, scrollposition behålls
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2.6, has_touch=True, is_mobile=True, user_agent=UA)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(base); pg.wait_for_selector('.kort.at-has')
        pg.evaluate("window.scrollTo(0,900)"); pg.wait_for_timeout(100)
        y0 = pg.evaluate("window.scrollY")
        pg.locator('.kort.at-has', has_text='Vänkrets').first.locator('.atinfo').click(); pg.wait_for_selector('.atsheet')
        ok(pg.locator('.atsheet.at2').count() == 0, 'vik: enpanel före')
        y0 = pg.evaluate('window.scrollY')
        pg.set_viewport_size({'width': 884, 'height': 874}); pg.wait_for_timeout(500)
        ok(pg.locator('.atsheet.at2').count() == 1 and pg.locator('.atkort').count() == 1, 'vik: panelen öppen och tvåpanel efter uppvikning')
        ok(abs(pg.evaluate("window.scrollY") - y0) < 5, 'vik: scrollposition bevarad %s -> %s' % (y0, pg.evaluate("window.scrollY")))
        pg.screenshot(path=os.path.join(OUT, 'fold-vik-uppfald.png'))
        pg.set_viewport_size({'width': 412, 'height': 915}); pg.wait_for_timeout(500)
        ok(pg.locator('.atsheet').count() == 1 and pg.locator('.atsheet.at2').count() == 0 and pg.locator('.atkort').count() == 3, 'vik: tillbaka till enpanel, panel kvar')
        ok(not errs, 'vik: 0 JS-fel %s' % errs)
        ctx.close(); b.close()
finally:
    for i in ids: api('api/atgarder/%s/klar' % i, {})
print('FAIL: %s' % fails if fails else 'ALLT OK')
sys.exit(1 if fails else 0)
