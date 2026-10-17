from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(768,1024),(1024,768)]:
        pg=b.new_page(viewport={'width':w,'height':h}); err=[]
        pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
        pg.goto('http://127.0.0.1:5204/hemskarm/'); pg.wait_for_selector('.kort')
        pg.evaluate("localStorage.clear()"); pg.reload(); pg.wait_for_selector('.kort'); pg.wait_for_timeout(1500)
        pg.evaluate("window.scrollTo(0,1400)"); pg.wait_for_timeout(800)
        print(w,h,'pv',pg.locator('.pv').count(),'img',pg.locator('.pv img').count(),'suddad',pg.locator('.sud').count(),'sidled',pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth'),'?',pg.inner_text('body').count('?'),err)
        pg.screenshot(path=f'test/riktiga-preview-{w}x{h}.png'); pg.close()
    b.close()
