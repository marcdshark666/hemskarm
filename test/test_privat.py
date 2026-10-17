# Test av privata varianten (server.mjs pa 5204, lokalt = inloggad via loopback).
# Kor: PYTHONIOENCODING=utf-8 python test/test_privat.py
import os, sys, json
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(__file__), '..')
base = 'http://127.0.0.1:5204/hemskarm/'
ts = 'https://desktop-r13nmtb.tailf9ee87.ts.net/hemskarm/'
apps = json.load(open(os.path.join(root, 'apps.json'), encoding='utf-8'))['apps']
fails = []
def ok(c, m):
    print(('OK  ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in [(1024, 768), (768, 1024)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
        errs = []; reqs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('request', lambda r: reqs.append(r.url))
        pg.goto(base); pg.wait_for_selector('#home', state='visible', timeout=15000)
        ok(pg.is_hidden('#login'), '%d: ingen klientgrind' % w)
        ok(not any('auth.json' in u for u in reqs), '%d: auth.json hamtas inte' % w)
        n = pg.locator('.tile a').count(); ok(n == len(apps), '%d: %d knappar' % (w, n))
        hrefs = pg.evaluate("[].map.call(document.querySelectorAll('.tile a'),function(a){return a.href})")
        ok(hrefs == [a['url'] for a in apps], '%d: knapparnas URL:er = apps.json' % w)
        ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"), '%d: ingen sidled scroll' % w)
        pg.screenshot(path=os.path.join(root, 'test', 'privat-%d.png' % w))
        pg.click('#editbtn'); ok(pg.locator('.ed').count() == len(apps), '%d: edit-rader' % w)
        pg.click('#addbtn'); pg.locator('.ed').last.locator('input').first.fill('Test')
        pg.locator('.ed').last.locator('.liten', has_text='Upp').click()
        pg.click('#donebtn'); pg.reload(); pg.wait_for_selector('#home', state='visible')
        ok('Test' in pg.inner_text('#grid'), '%d: redigering sparad' % w)
        pg.click('#editbtn'); pg.click('#exportbtn'); ok('"Test"' in pg.input_value('#jsonbox'), '%d: Visa JSON' % w)
        pg.click('#resetbtn'); pg.click('#donebtn')
        ok('Test' not in pg.inner_text('#grid'), '%d: aterstall' % w)
        ok(not errs, '%d: 0 JS-fel %s' % (w, errs))
        ctx.close()
    # Via Tailscale utan session: inloggningssidan
    ctx = b.new_context(); pg = ctx.new_page()
    try:
        pg.goto(ts, timeout=20000)
        ok(pg.url.endswith('/hemskarm/logga-in') and pg.locator('input[name=losen]').count() == 1, 'ts.net utan session -> inloggning (%s)' % pg.url)
    except Exception as e:
        ok(False, 'ts.net: %s' % e)
    ctx.close(); b.close()
print('FAILS:', fails); sys.exit(1 if fails else 0)
