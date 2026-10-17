import sys, threading, http.server, socketserver, functools, os, json
from playwright.sync_api import sync_playwright
root = os.path.join(os.path.dirname(__file__), '..')
H = functools.partial(http.server.SimpleHTTPRequestHandler, directory=root)
http.server.SimpleHTTPRequestHandler.log_message = lambda *a, **k: None
srv = socketserver.TCPServer(('127.0.0.1', 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
base = 'http://127.0.0.1:%d/' % port
EMAIL, PW = sys.argv[1], sys.argv[2]
fails = []
def ok(c, m):
    print(('OK  ' if c else 'FAIL ') + m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in [(1024, 768), (768, 1024), (412, 800)]:
        ctx = b.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.goto(base); pg.wait_for_selector('#login', state='visible')
        ok(pg.is_hidden('#grid'), '%d: grid dold före login' % w)
        pg.fill('#epost', EMAIL); pg.fill('#losen', 'fel'); pg.click('#loginbtn')
        pg.wait_for_function("document.getElementById('loginmsg').innerText.indexOf('Fel')>=0", timeout=60000)
        ok(pg.is_hidden('#home'), '%d: fel lösen nekas' % w)
        pg.fill('#epost', EMAIL); pg.fill('#losen', PW); pg.click('#loginbtn')
        pg.wait_for_selector('#home', state='visible', timeout=60000)
        n = pg.locator('.tile a').count(); ok(n == 5, '%d: 5 knappar (%d)' % (w, n))
        ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth"), '%d: ingen sidled scroll' % w)
        hs = pg.evaluate("[].map.call(document.querySelectorAll('.tile a'),function(a){var r=a.getBoundingClientRect();return [r.width,r.height]})")
        ok(all(x >= 88 and y >= 88 for x, y in hs), '%d: knappar >=88px %s' % (w, hs[0]))
        hrefs = pg.evaluate("[].map.call(document.querySelectorAll('.tile a'),function(a){return a.href+'|'+a.target})")
        ok(hrefs[0] == 'https://medhop.vercel.app/|_self', '%d: href/target %s' % (w, hrefs[0]))
        pg.screenshot(path=os.path.join(root, 'test', 'shot-%d.png' % w))
        pg.reload(); pg.wait_for_selector('#home', state='visible'); ok(True, '%d: inloggning sparad efter reload' % w)
        # redigering
        pg.click('#editbtn'); ok(pg.locator('.ed').count() == 5, '%d: edit 5 rader' % w)
        pg.click('#addbtn'); pg.locator('.ed').last.locator('input').first.fill('Test'); 
        pg.locator('.ed').last.locator('.liten', has_text='Upp').click()
        pg.locator('.ed').nth(0).locator('.del').click()
        ok(pg.locator('.ed').count() == 5, '%d: lägg till/flytta/ta bort' % w)
        pg.click('#donebtn'); pg.reload(); pg.wait_for_selector('#home', state='visible')
        ok(pg.locator('.tile a').count() == 5 and 'Test' in pg.inner_text('#grid'), '%d: redigering sparad' % w)
        pg.click('#editbtn'); pg.click('#resetbtn'); pg.click('#donebtn')
        ok(pg.locator('.tile a').count() == 5 and 'Test' not in pg.inner_text('#grid'), '%d: återställ' % w)
        pg.click('#editbtn'); pg.click('#logoutbtn'); pg.wait_for_selector('#login', state='visible'); ok(True, '%d: logga ut' % w)
        ok(not errs, '%d: 0 JS-fel %s' % (w, errs))
        ctx.close()
    b.close()
print('FAILS:', fails); sys.exit(1 if fails else 0)
