"""Сохранения квеста и версии с ходьбой не мешают друг другу.
Обе версии на одном домене (/ и /walk/) и через file:// делят localStorage, поэтому у каждой свой ключ:
квест — SAVE_KEYS.quest, ходьба — SAVE_KEYS.walk; старое общее сохранение (LEGACY_SAVE_KEY) переходит в квест.
Запуск: python3 tests/e2e_saves.py
        E2E_URL=https://el-sueno.pages.dev python3 tests/e2e_saves.py   (по http: квест — /, ходьба — /walk/)
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import json, os, pathlib, sys
from playwright.sync_api import sync_playwright
BASE=os.environ.get('E2E_URL')
DIST=pathlib.Path(__file__).resolve().parent.parent/'dist'
QUEST=BASE.rstrip('/')+'/' if BASE else (DIST/'el-sueno.html').as_uri()
WALK=BASE.rstrip('/')+'/walk/' if BASE else (DIST/'el-sueno-walk.html').as_uri()
CHROME=os.environ.get('CHROME_PATH')
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
# ключи сохранений — как в src/data.js (SAVE_KEYS, LEGACY_SAVE_KEY); в странице глобальных констант нет
KQ, KW, KL = 'el_sueno_cap1_quest_v1', 'el_sueno_cap1_walk_v1', 'el_sueno_cap1_v1'
errs=[]; res=[]
def ok(name,cond,extra=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra)[:400] if not cond else ''))
# guardado común antiguo (v1), tal como lo escribía el quest antes de separar las claves
LEGACY={'v':1,'scr':'plaza1','pos':{'x':0,'z':-23.5,'ry':3.14},'flags':{'plazaVisitada':True,'golpes':True},'inv':['linterna','moneda'],'docs':['nota'],
        'words':['frío'],'archive':[],'ecos':[],'decisions':[],'log':[],'cordura':90,'time':120,'tries':0}
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=ARGS) if CHROME else p.chromium.launch(args=ARGS)
    pg=b.new_context(viewport={'width':640,'height':360}).new_page(); ev=pg.evaluate
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append('PE '+str(e)))
    def open_(url): pg.goto(url); pg.wait_for_timeout(1200)
    def keys(): return ev("([q,w,l])=>({quest:localStorage.getItem(q),walk:localStorage.getItem(w),legacy:localStorage.getItem(l)})",[KQ,KW,KL])
    # la partida en sí, sin «time»: cada versión guarda también al salir de la página
    def core(raw): d=json.loads(raw); return [d.get('scr'),d['pos'],d['flags'],d['inv'],d['docs']]
    def has_cont(): return ev("!document.getElementById('tCont').classList.contains('hidden')")
    def cont():
        pg.click('#tCont'); pg.wait_for_function("__sueno.mode==='play'",timeout=15000); pg.wait_for_timeout(800)
    def advance():   # pasa las frases de la intro hasta que se puede jugar
        for i in range(150):
            if ev("__sueno.mode==='play' && __sueno.canAct()"): return True
            if ev("!!__sueno.dlg.resolve"): pg.keyboard.press('Space')
            pg.wait_for_timeout(200)
        return False

    # 1. el guardado común antiguo pasa al quest
    open_(QUEST); ev("()=>localStorage.clear()"); ev("([k,v])=>localStorage.setItem(k,v)",[KL,json.dumps(LEGACY)])
    open_(QUEST); k=keys()
    ok('quest: el guardado antiguo pasa a su clave y se borra', k['legacy'] is None and k['quest'] and json.loads(k['quest'])['inv']==LEGACY['inv'], k)
    ok('quest: hay «Continuar»', has_cont())
    cont(); s=ev("({scr:__sueno.scr,inv:__sueno.state.inv,golpes:!!__sueno.f.golpes})")
    ok('quest: continúa la partida antigua', s['scr']=='plaza1' and s['inv']==LEGACY['inv'] and s['golpes'], s)
    ev("__sueno.saveNow()"); quest_saved=keys()['quest']

    # 2. la versión de caminar no hereda nada y su partida no toca la del quest
    open_(WALK); k=keys()
    ok('walk: comparte localStorage con el quest (la prueba tiene sentido)', k['quest'] and core(k['quest'])==core(quest_saved), k)
    ok('walk: sin guardado propio, sin «Continuar»', k['walk'] is None and not has_cont())
    pg.click('#tNew'); pg.wait_for_timeout(11500); ok('walk: partida nueva desde cero', advance() and ev("__sueno.state.inv.length")==0 and not ev("__sueno.f.golpes"))
    ev("()=>{__sueno.player.place(0.5,-6.6);__sueno.state.inv.push('pilas');__sueno.saveNow()}"); k=keys()
    ok('walk: guarda en su clave', k['walk'] and json.loads(k['walk'])['inv']==['pilas'], k['walk'])
    ok('walk: el guardado del quest sigue igual', core(k['quest'])==core(quest_saved)); walk_saved=k['walk']

    # 3. de vuelta al quest: su partida intacta, y al guardar no toca la de caminar
    open_(QUEST); ok('quest: «Continuar» tras jugar a la otra versión', has_cont()); cont()
    ok('quest: objetos intactos', ev("__sueno.state.inv")==LEGACY['inv'], ev("__sueno.state.inv"))
    ev("__sueno.saveNow()"); k=keys(); ok('quest: guardar no toca la partida de caminar', core(k['walk'])==core(walk_saved) and k['quest'])

    # 4. un guardado dañado en una versión no afecta a la otra
    ev("([k])=>localStorage.setItem(k,'{roto')",[KQ]); open_(WALK); ok('walk: el quest dañado no le afecta', has_cont())
    cont(); ok('walk: continúa su partida', ev("__sueno.state.inv")==['pilas'] and abs(ev("__sueno.player.pos.z")+6.6)<0.1)
    ev("([kq,kw,q])=>{localStorage.setItem(kq,q);localStorage.setItem(kw,'{roto')}",[KQ,KW,quest_saved])
    open_(QUEST); ok('quest: la partida de caminar dañada no le afecta', has_cont()); cont(); ok('quest: continúa su partida', ev("__sueno.state.inv")==LEGACY['inv'])

    # 5. si ya hay partida del quest, el guardado antiguo no la pisa
    ev("([k,v])=>localStorage.setItem(k,v)",[KL,json.dumps(dict(LEGACY,inv=['agua']))]); 
    open_(QUEST); k=keys(); ok('quest: el guardado antiguo no pisa uno nuevo y se borra', json.loads(k['quest'])['inv']==LEGACY['inv'] and k['legacy'] is None, k)
    b.close()
print('ERRORES DE CONSOLA:', errs or 'ninguno')
print(f'TOTAL {sum(res)} / {len(res)}')
sys.exit(0 if all(res) and not errs else 1)
