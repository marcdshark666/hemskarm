# Förhandsvisningar för Hemskärm. Kör: python tools/skarmbilder.py   (kräver playwright + Pillow)
# Tar bara skärmbild av PUBLIKA sidor som inte är känsliga (vitlista SAFE). Allt annat får genererad platshållare i UI.
# Loggar aldrig in, läser inga lösenordsfiler. Ut: img/preview/<id>.jpg (480x360, <=40 kB).
import io, json, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright
HEM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(HEM, 'img', 'preview'); os.makedirs(OUT, exist_ok=True)
SAFE = ['quiz-runner', 'ward-rush', 'medicinskt-snurrhjul', 'svenska-ord', 'stockholm-dag', 'kalender-bradet',
        'allinclusive-finder', 'inbox-zero-hero', 'live-oversattare-samtal', 'tangentbordsapp-dar-skriva',
        'session-tracker', 'us-proxy-browser', 'jobbans-kandrswe']
apps = {a['id']: a for a in json.load(open(os.path.join(HEM, 'apps.json'), encoding='utf-8'))['apps']}
def jpg(png):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((480, 360), Image.LANCZOS)
    for q in (80, 70, 60, 50, 40, 30):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
        if b.tell() <= 40000: return b.getvalue()
    return b.getvalue()
ok = []
with sync_playwright() as p:
    br = p.chromium.launch()
    for i in SAFE:
        a = apps.get(i)
        if not a: continue
        url = next((l['url'] for l in a['lankar'] if l['typ'] in ('vercel', 'github') and l.get('status') == 'uppe' and 'github.com/' not in l['url']), None)
        if not url: print('hoppar', i, '(ingen publik uppe-adress)'); continue
        try:
            pg = br.new_page(viewport={'width': 1024, 'height': 768})
            pg.goto(url, wait_until='load', timeout=20000); pg.wait_for_timeout(1500)
            data = jpg(pg.screenshot()); pg.close()
            open(os.path.join(OUT, i + '.jpg'), 'wb').write(data); ok.append(i); print('ok', i, len(data))
        except Exception as e:
            print('fel', i, str(e)[:80])
    br.close()
print(len(ok), 'bilder')
