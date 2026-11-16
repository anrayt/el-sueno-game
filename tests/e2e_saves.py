"""Сохранения: одна партия на игру (формат v2) и наследование старых сохранений v1.
До гибрида было две версии с отдельными партиями (квест, ходьба) и ещё раньше — общий ключ. Игра берёт первую
найденную по порядку: квест → старый общий ключ → ходьба; старые ключи не трогает.
Запуск: python3 tests/e2e_saves.py
        E2E_URL=https://el-sueno.pages.dev python3 tests/e2e_saves.py
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import json, os, pathlib, sys
from playwright.sync_api import sync_playwright
BASE=os.environ.get('E2E_URL')
URL=BASE.rstrip('/')+'/' if BASE else (pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno.html').as_uri()
CHROME=os.environ.get('CHROME_PATH')
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
# ключи — как в src/shared/data.js (SAVE_KEYS, LEGACY_SAVE_KEY, SET_KEY)
K2, KQ, KW, KL, KS = 'el_sueno_cap1_v2', 'el_sueno_cap1_quest_v1', 'el_sueno_cap1_walk_v1', 'el_sueno_cap1_v1', 'el_sueno_ajustes_v1'
errs=[]; res=[]
if os.environ.get('GITHUB_ACTIONS'):   # исключение в тесте (таймаут ожидания и т. п.) — тоже аннотацией прогона
    import traceback
    def _hook(t,e,tb):
        fr=[f for f in traceback.extract_tb(tb) if f.filename==__file__]; where=', '.join(f'{f.lineno}:{f.name}' for f in fr[-3:])
        print(f'::error title=e2e saves excepción::{t.__name__} en {where} — {str(e)[:700]}'.replace('\n',' | ')); sys.__excepthook__(t,e,tb)
    sys.excepthook=_hook
def ok(name,cond,extra=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra)[:400] if not cond else ''))
    if not cond and os.environ.get('GITHUB_ACTIONS'): print(f'::error title=e2e saves::{name} — {str(extra)[:300]}')
BASE_ST={'flags':{'plazaVisitada':True,'golpes':True,'v_plaza':True},'docs':['nota'],'words':['frío'],'archive':[],'ecos':[],'decisions':[],'log':[],'cordura':90,'time':120,'tries':0}
QUEST=dict(BASE_ST,v=1,scr='plaza1',pos={'x':2.5,'z':-29.5,'ry':3.14},inv=['linterna','moneda'])     # квест: кадр-улица
QUEST_F=dict(BASE_ST,v=1,scr='plaza2',pos={'x':-4.6,'z':-41.2,'ry':-1.9},inv=['linterna'])           # квест: кадр, который и в гибриде кадр
WALK=dict(BASE_ST,v=1,pos={'x':-3.0,'z':-36.0,'ry':1.0},inv=['pilas'])                                # ходьба: только позиция
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=ARGS) if CHROME else p.chromium.launch(args=ARGS)
    pg=b.new_context(viewport={'width':640,'height':360}).new_page(); ev=pg.evaluate
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append('PE '+str(e)))
    def boot(store):   # чистый localStorage + заданные ключи, затем загрузка игры
        pg.goto(URL); pg.wait_for_timeout(600); ev("([s])=>{localStorage.clear();for(const k in s)localStorage.setItem(k,s[k])}",[{k:(v if isinstance(v,str) else json.dumps(v)) for k,v in store.items()}]); pg.goto(URL); pg.wait_for_timeout(1200)
    def get(k): return ev("([k])=>localStorage.getItem(k)",[k])
    def has_cont(): return ev("!document.getElementById('tCont').classList.contains('hidden')")
    def cont(): pg.click('#tCont'); pg.wait_for_function("__sueno.mode==='play'",timeout=15000); pg.wait_for_timeout(900)
    def g(): return ev("(()=>{const g=__sueno;return {scr:g.scr,x:g.player.pos.x,z:g.player.pos.z,inv:g.state.inv,golpes:!!g.f.golpes,ret:g.state.ret,v:g.state.v,modo:g.modo}})()")

    # 1. партия квеста: кадр-улица → в гибриде герой стоит на улице в этой точке
    boot({KQ:QUEST}); s2=get(K2)
    ok('quest v1 → v2: se hereda al arrancar; la partida antigua no se borra', s2 and json.loads(s2)['v']==2 and json.loads(s2)['inv']==QUEST['inv'] and get(KQ)==json.dumps(QUEST), s2)
    ok('hay «Continuar»', has_cont()); cont(); s=g()
    ok('quest (plano de calle): se continúa andando en ese lugar', s['scr'] is None and abs(s['x']-2.5)<0.1 and abs(s['z']+29.5)<0.1 and s['inv']==QUEST['inv'] and s['golpes'] and s['v']==2, s)
    # 2. партия квеста в кадре, который остаётся кадром: продолжаем в нём, выход ведёт на улицу
    boot({KQ:QUEST_F}); cont(); s=g()
    ok('quest (plano fijo): se continúa en el plano, con punto de vuelta a la calle', s['scr']=='plaza2' and s['ret'] and s['inv']==['linterna'], s)
    pg.wait_for_selector('#nav .nv'); pg.click('#nav .nv:has-text("Salir")'); pg.wait_for_function("!__sueno.scr && !__sueno.going",timeout=8000); s=g()
    ok('«Salir» lleva a la calle junto al banco', s['scr'] is None and abs(s['x']+4.2)<0.2 and abs(s['z']+40.8)<0.2, s)
    # 3. партия ходьбы: позиция
    boot({KW:WALK}); ok('walk v1 → v2: hay «Continuar»', has_cont() and get(KW)==json.dumps(WALK)); cont(); s=g()
    ok('walk: se continúa en la misma posición', s['scr'] is None and abs(s['x']+3.0)<0.1 and abs(s['z']+36.0)<0.1 and s['inv']==['pilas'], s)
    # 4. приоритет: квест, затем старый общий ключ, затем ходьба
    boot({KQ:QUEST,KL:dict(QUEST,inv=['agua']),KW:WALK}); cont(); ok('con varias partidas antiguas gana la del quest', g()['inv']==QUEST['inv'])
    boot({KL:dict(QUEST,inv=['agua']),KW:WALK}); cont(); ok('sin quest: la clave común antigua', g()['inv']==['agua'])
    # 5. уже есть партия v2: старые её не затирают
    V2=dict(BASE_ST,v=2,scr=None,ret=None,pos={'x':0.0,'z':-30.0,'ry':0},inv=['foto'])
    boot({K2:V2,KQ:QUEST,KW:WALK}); cont(); s=g(); ok('una partida v2 no se pisa con las antiguas', s['inv']==['foto'] and abs(s['z']+30)<0.1, s)
    # 6. испорченные старые сохранения
    boot({KQ:'{roto',KW:WALK}); ok('quest dañado: se salta y se hereda la de caminar', has_cont()); cont(); ok('y se continúa con ella', g()['inv']==['pilas'])
    boot({KQ:'{roto',KL:'null',KW:'[1,2'}); ok('todo dañado: partida nueva, sin errores', not has_cont() and get(K2) is None and ev('!!window.__sueno'))
    # 7. режим чтения: партия ходьбы открывается кадром этого места и наоборот
    boot({KW:WALK,KS:{'modo':'lectura'}}); cont(); s=g(); ok('modo lectura + partida de caminar: plano del lugar', s['modo']=='lectura' and s['scr']=='plaza1', s)
    ev("()=>__sueno.saveNow()"); sv=json.loads(get(K2)); ok('se guarda el plano', sv['scr']=='plaza1' and sv['v']==2, sv.get('scr'))
    ev("([k])=>localStorage.setItem(k,JSON.stringify({modo:'normal'}))",[KS]); pg.goto(URL); pg.wait_for_timeout(1200); cont(); s=g()
    ok('la misma partida en modo normal: en la calle', s['modo']=='normal' and s['scr'] is None and s['inv']==['pilas'], s)
    # 8. партия, сохранённая посреди погони: погоню нельзя пропустить ни в одном режиме
    MID=dict(BASE_ST,v=2,scr=None,ret=None,pos={'x':0.0,'z':-65.0,'ry':3.14},inv=['linterna_ok'],flags=dict(BASE_ST['flags'],luz=True,luzOn=True,v_pasaje=True))
    boot({K2:MID,KS:{'modo':'lectura'}}); cont(); s=g(); ok('guardado en mitad de la persecución + modo lectura: plano anterior a la persecución', s['scr'] in ('boca','pasajeA') and not ev("!!__sueno.f.chaseDone"), s)
    boot({K2:MID}); cont(); pg.wait_for_timeout(2500); s=g(); ok('lo mismo en modo normal: vuelve a la entrada del pasaje, sin persecución en marcha', s['scr'] is None and s['z']>-52 and not ev("!!__sueno.chase") and not ev("!!__sueno.f.chaseDone"), s)
    # 9. «Nueva partida» se guarda enseguida: una partida antigua no vuelve si el navegador se cierra durante la intro
    boot({KQ:QUEST}); pg.click('#tNew'); pg.wait_for_timeout(300); pg.click('#tNew'); pg.wait_for_timeout(800); sv=json.loads(get(K2)); ok('partida nueva: guardada desde el primer momento', sv['v']==2 and sv['inv']==[] and not sv['flags'].get('golpes'), sv)
    b.close()
print('ERRORES DE CONSOLA:', errs or 'ninguno')
print(f'TOTAL {sum(res)} / {len(res)}')
sys.exit(0 if all(res) and not errs else 1)
