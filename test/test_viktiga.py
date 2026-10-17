from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(viewport={'width':768,'height':1024}); err=[]
    pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
    pg.goto('http://127.0.0.1:5204/hemskarm/'); pg.wait_for_selector('.kort')
    h=[x.split(chr(10))[0] for x in pg.locator('h2').all_inner_texts()]; print(h[:4])
    print(pg.locator('a.hu[target=_blank]').count(), pg.locator('.chip small:has-text("egen inloggning")').count(),'? ',pg.inner_text('body').count('?'),err)
    pg.click('#pfilter button >> nth=0'); pg.locator('#filter button:has-text("Viktiga")').click(); pg.screenshot(path='test/viktiga-768x1024.png'); b.close()
