from playwright.sync_api import sync_playwright
import urllib.request, urllib.error, os
U='http://127.0.0.1:5204/hemskarm/'
SF=os.path.join(os.path.dirname(__file__),'..','data','state.json')
class NoRedir(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*a,**k): return None
rq=urllib.request.Request(U+'api/state',data=b'{}',headers={'Content-Type':'application/json','X-Forwarded-For':'1.2.3.4'},method='POST')
try: urllib.request.build_opener(NoRedir).open(rq); print('POST state utan session OK?!')
except urllib.error.HTTPError as e: print('POST state utan session ->',e.code)
with sync_playwright() as p:
    b=p.chromium.launch(); err=[]
    c1=b.new_context(viewport={'width':768,'height':1024},has_touch=True,is_mobile=True); pg=c1.new_page()
    pg.on('pageerror',lambda e:err.append(str(e))); pg.on('console',lambda m:err.append(m.text) if m.type=='error' else None)
    pg.goto(U); pg.wait_for_selector('.kort')
    for i in (1,2,3,4): pg.locator('#pfilter button').nth(i).tap()
    pg.wait_for_timeout(300)
    print('rubriker',[x.split(chr(10))[0] for x in pg.locator('h2').all_inner_texts()])
    pg.screenshot(path='test/multival-768x1024.png')
    pg.reload(); pg.wait_for_selector('.kort'); pg.wait_for_timeout(500)
    print('efter reload pa:',pg.locator('#pfilter button.pa').all_inner_texts())
    pg.locator('#pfilter button').nth(0).tap()
    pg.tap('#editbtn'); pg.fill('.ed input >> nth=0','Testnamn XYZ'); pg.wait_for_timeout(1200)
    print('state.json finns',os.path.exists(SF))
    # nytt fonster utan localStorage
    c2=b.new_context(viewport={'width':768,'height':1024}); p2=c2.new_page(); e2=[]
    p2.on('pageerror',lambda e:e2.append(str(e)))
    p2.goto(U); p2.wait_for_selector('.ed, .kort'); p2.wait_for_timeout(1200)
    print('vy kvar (edit):',p2.locator('#edit').is_visible(),'namn via server:', 'Testnamn XYZ' in p2.inner_text('body') or 'Testnamn XYZ' in str(p2.eval_on_selector_all('.ed input','els=>els.map(e=>e.value)')))
    print('err',err,e2)
    b.close()
os.remove(SF) if os.path.exists(SF) else None
