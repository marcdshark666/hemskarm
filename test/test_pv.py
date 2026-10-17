from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(768,1024),(1024,768),(412,900)]:
        pg=b.new_page(viewport={'width':w,'height':h}); err=[]
        pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
        pg.goto('http://127.0.0.1:5204/hemskarm/'); pg.wait_for_selector('.kort')
        pg.locator('#filter button:has-text("Spel")').click(); pg.wait_for_timeout(800)
        imgs=pg.evaluate("Array.from(document.querySelectorAll('.pv img')).map(i=>[i.complete,i.naturalWidth])")
        print(w,h,'pv',pg.locator('.pv').count(),'img',len(imgs),'sidled',pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth'),'?',pg.inner_text('body').count('?'),err)
        if w==768: pg.screenshot(path='test/forhandsvisning-768x1024.png')
        pg.click('#pvbtn'); print('av ->',pg.locator('.pv').count()); pg.close()
    b.close()
