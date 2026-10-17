# Förhandsvisningar för Hemskärm. Kör: python tools/skarmbilder.py [id ...]   (kräver playwright + Pillow)
# Källor i ordning: 1) lokal port (127.0.0.1) för Tailscale-sidor, 2) publik adress (Vercel/Pages) som svarar,
# 3) projektmapp med index.html/dist/index.html serverad statiskt på temporär port.
# Loggar aldrig in, läser inga lösenordsfiler. Känsliga appar blurras hårt (hela bilden); känsligt = kategori/id nedan.
# Ut: img/preview/<id>.jpg (480x360, <=40 kB) + img/preview/_meta.json {id: {blur, login, kalla}}. Utan bild => platshållare i UI.
import io, json, os, sys, threading, functools, http.server, socketserver, re
from PIL import Image, ImageFilter
from playwright.sync_api import sync_playwright
HEM = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APPIDEER = os.path.dirname(HEM)
OUT = os.path.join(HEM, 'img', 'preview'); os.makedirs(OUT, exist_ok=True)
SKIP = {'gadget-drop', 'hemskarm', 'tornet', 'makerworld'}  # tornet=blank sida, makerworld=Cloudflare-spärr  # stoppnivå / sig själv
BLUR_KAT = {'Diabetes & hälsa', 'Ekonomi & affär', 'Medicin & utbildning', 'Kommunikation & vänner', 'Jobb & karriär'}
BLUR_OK = {'ward-rush', 'medicinskt-snurrhjul'}  # spel/verktyg utan personuppgifter
BLUR_ID = {'husvakten', 'marcs-halsoai', 'bt-start', 'radcore', 'medhop', 'cynergi-med-flow', 'vanner', 'botlabbet', 'boss', 'work-list-bots',
           'the-work-list', 'manadsavrakning', 'olasta-meddelanden', 'packing-road', 'vanskapsapp', 'gmail-improvement-sliding', 'spindelnatet',
           'spelkontroll', 'tailscale-hemsidor', 'marcs-resell', 'aaron-prints', 'etsy-butiker', 'plaud-kalender', 'plaud-syncthing', 'forelasningar',
           'cv-portal', 'cv-claude-dar', 'skrivbordet', 'session-tracker', 'print-planer', 'filer-privat', 'sugar-buddy-bot', 'dexcom-reklamations-assistent'}
# Externa sajter utan 'uppe'-status: bara publika butiker/sajter (inte Etsy/DataDome, inte inloggningssidor).
EXTRA_URL = {'makerworld': 'https://makerworld.com/', 'printify': 'https://drjonsson.printify.me'}
apps = json.load(open(os.path.join(HEM, 'apps.json'), encoding='utf-8'))['apps']
vilka = set(sys.argv[1:])
def kanslig(a):
    return a['id'] in BLUR_ID or (a['kategori'] in BLUR_KAT and a['id'] not in BLUR_OK)
def jpg(png, blur):
    im = Image.open(io.BytesIO(png)).convert('RGB').resize((480, 360), Image.LANCZOS)
    if blur: im = im.filter(ImageFilter.GaussianBlur(7))
    for q in (80, 70, 60, 50, 40, 30, 20):
        b = io.BytesIO(); im.save(b, 'JPEG', quality=q, optimize=True)
        if b.tell() <= 40000: break
    return b.getvalue()
def statisk(mapp):
    h = functools.partial(http.server.SimpleHTTPRequestHandler, directory=mapp)
    h.log_message = lambda *a, **k: None
    class Q(http.server.SimpleHTTPRequestHandler):
        def log_message(self, *a, **k): pass
    srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(Q, directory=mapp))
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv
metaf = os.path.join(OUT, '_meta.json')
meta = json.load(open(metaf, encoding='utf-8')) if os.path.exists(metaf) else {}
stat = {'riktig': 0, 'suddad': 0, 'ingen': 0}
with sync_playwright() as p:
    br = p.chromium.launch()
    for a in apps:
        i = a['id']
        if i in SKIP or (vilka and i not in vilka): continue
        kalla = None; url = None; srv = None
        lok = next((l['url'] for l in a['lankar'] if l['typ'] == 'lokal' and l.get('status') == 'uppe'), None)
        pub = next((l['url'] for l in a['lankar'] if l['typ'] in ('vercel', 'github') and l.get('status') == 'uppe' and 'github.com/' not in l['url'] and not l.get('kraver_login')), None)
        if i in EXTRA_URL: url, kalla = EXTRA_URL[i], 'publik'
        elif lok: url, kalla = lok, 'lokal'
        elif pub: url, kalla = pub, 'publik'
        else:
            for dirnamn in {a.get('mapp'), i}:
                if not dirnamn: continue
                for sub in ('', 'dist', 'public'):
                    d = os.path.join(APPIDEER, dirnamn, sub)
                    if os.path.isfile(os.path.join(d, 'index.html')):
                        srv = statisk(d); url = f'http://127.0.0.1:{srv.server_address[1]}/'; kalla = 'mapp'; break
                if url: break
        if not url:
            print('ingen', i); stat['ingen'] += 1
            f = os.path.join(OUT, i + '.jpg')
            if os.path.exists(f) and i not in meta: os.remove(f)
            meta.pop(i, None); continue
        blur = kanslig(a)
        try:
            pg = br.new_page(viewport={'width': 1024, 'height': 768})
            pg.goto(url, wait_until='load', timeout=15000); pg.wait_for_timeout(1200)
            login = bool(pg.locator('input[type=password]').count()) or 'logga-in' in pg.url
            data = jpg(pg.screenshot(), blur); pg.close()
            open(os.path.join(OUT, i + '.jpg'), 'wb').write(data)
            meta[i] = {'blur': blur, 'login': login, 'kalla': kalla}
            stat['suddad' if blur else 'riktig'] += 1
            print('ok', i, kalla, 'blur' if blur else '', 'login' if login else '', len(data))
        except Exception as e:
            print('fel', i, str(e)[:70]); stat['ingen'] += 1
        if srv: srv.shutdown(); srv.server_close()
    br.close()
json.dump(meta, open(metaf, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(stat)
