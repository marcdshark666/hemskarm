from playwright.sync_api import sync_playwright
import os
U='http://127.0.0.1:5204/hemskarm/'
PF=os.path.join(os.path.dirname(__file__),'..','data','prio.json')
if os.path.exists(PF): os.remove(PF)
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx=b.new_context(viewport={'width':768,'height':1024},has_touch=True,is_mobile=True)
    pg=ctx.new_page(); err=[]
    pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
    pg.goto(U); pg.wait_for_selector('.kort')
    box=pg.locator('.kort .pb').first.bounding_box(); print('stjarna',box['width'],box['height'])
    names=[]
    for i,val in enumerate([0,2,3]):   # 1=Platina,2=Guld,3=Silver -> index i+... menyknapp
        pg.locator('.kort .pb').nth(i).tap(); pg.wait_for_selector('.psheet')
        if i==0: pg.screenshot(path='test/prio-meny-768x1024.png')
        pg.locator('.psheet .pval').nth(i).tap()
        pg.wait_for_timeout(500)
    print('url efter tryck:',pg.url)
    print(open(PF,encoding='utf8').read().replace('\n',' '))
    pg.reload(); pg.wait_for_selector('.kort'); pg.wait_for_timeout(600)
    for n in (1,2,3):
        pg.locator('#pfilter button').nth(n).tap(); pg.wait_for_timeout(200)
        print('filter',n,sorted(set(pg.locator('.kort .nm').all_inner_texts())))
    pg.screenshot(path='test/prio-filter-768x1024.png')
    print('err',err)
    b.close()
