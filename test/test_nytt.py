from playwright.sync_api import sync_playwright
import sys
U='http://127.0.0.1:5204/hemskarm/'
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(768,1024),(1024,768),(412,900)]:
        pg=b.new_page(viewport={'width':w,'height':h}); err=[]
        pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
        pg.goto(U); pg.wait_for_selector('.kort')
        t=pg.inner_text('body')
        n=pg.locator('.kort').count(); h2=pg.locator('h2').all_inner_texts()
        links=pg.locator('a.chip').count(); hu=pg.locator('a.hu').count()
        small=pg.evaluate("Array.from(document.querySelectorAll('a.hu')).filter(a=>a.getBoundingClientRect().height<88).length")
        print(w,h,'kort',n,'chips',links,'hu',hu,'<88px',small,'? namn:',t.count('?'),'err',err,'first h2',h2[:2])
        pg.screenshot(path=f'test/ny-{w}x{h}.png')
        pg.close()
    pg=b.new_page(viewport={'width':1024,'height':768}); pg.goto(U); pg.wait_for_selector('.kort')
    pg.click('#editbtn'); print('edit rows',pg.locator('.ed').count()); pg.fill('.ed input >> nth=0','Test'); pg.click('#donebtn')
    print('override ok', 'Test' in pg.inner_text('body'))
    pg.fill('#sok','medhop'); print('sök',pg.locator('.kort').count())
    b.close()
