from playwright.sync_api import sync_playwright
import json, urllib.request, os
U='http://127.0.0.1:5204/hemskarm/'
PF=os.path.join(os.path.dirname(__file__),'..','data','prio.json')
if os.path.exists(PF): os.remove(PF)
# POST utan session (via proxyhuvud) ska nekas
rq=urllib.request.Request(U+'api/prio',data=b'{"id":"medhop","prio":1}',headers={'Content-Type':'application/json','X-Forwarded-For':'1.2.3.4'},method='POST')
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
try: urllib.request.build_opener(NoRedir).open(rq); print('POST utan session: OK?!')
except urllib.error.HTTPError as e: print('POST utan session ->',e.code)
with sync_playwright() as p:
    b=p.chromium.launch()
    for w,h in [(1024,768),(768,1024)]:
        pg=b.new_page(viewport={'width':w,'height':h}); err=[]
        pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
        pg.goto(U); pg.wait_for_selector('.kort')
        pg.click('#priobtn'); pg.wait_for_selector('.prad')
        names=pg.locator('.prad .pn').all_inner_texts()
        for i in (0,1,2):
            pg.locator('.prad').nth(i).locator('.pb').nth(i if i<3 else 0).click()
        pg.wait_for_timeout(500)
        print(w,h,'counts',pg.inner_text('#pcount').replace('\n',' '))
        pg.screenshot(path=f'test/prioritera-{w}x{h}.png')
        pg.click('#pdonebtn'); pg.reload(); pg.wait_for_selector('.kort'); pg.wait_for_timeout(500)
        pg.click('#pfilter button >> nth=1'); pg.wait_for_timeout(200)
        print('filter 1 ->',pg.locator('.kort .nm').all_inner_texts()[:4], 'h2',[x.split(chr(10))[0] for x in pg.locator('h2').all_inner_texts()][:3])
        pg.screenshot(path=f'test/prio-filter-{w}x{h}.png')
        t=pg.inner_text('body'); hs=pg.evaluate('document.documentElement.scrollWidth>document.documentElement.clientWidth')
        print('? ',t.count('?'),'sidled',hs,'err',err)
        # redigering: dubbletter, ordning, lankar
        pg.click('#editbtn'); n=pg.locator('.ed').count(); pg.locator('.ed >> a:has-text("↓")').first.click()
        pg.locator('.ed >> a:has-text("+ länk")').first.click(); print('edit rader',n,'lankinputs',pg.locator('.ed input[type=url]').count()>n)
        pg.close()
    b.close()
print(open(PF,encoding='utf8').read())
