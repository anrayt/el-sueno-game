"""Сквозное прохождение главы в основном режиме (гибрид): на улицах — ходьба, в интерьерах и разговорах — кадры.
Запуск: python3 tests/e2e.py      (десктоп: клавиатура и мышь)
        python3 tests/e2e.py m    (мобильная эмуляция: тап по земле и объектам, джойстик как опция)
Нужно: pip install -r requirements.txt && python3 -m playwright install chromium
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import json, os, pathlib, sys
from playwright.sync_api import sync_playwright
URL=os.environ.get('E2E_URL') or (pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno.html').as_uri()  # E2E_URL: проверить по http
CHROME=os.environ.get('CHROME_PATH')
SHOTS=os.path.join(os.path.dirname(__file__),'screenshots'); os.makedirs(SHOTS,exist_ok=True)
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
MOBILE=len(sys.argv)>1
PRE='h_m_' if MOBILE else 'h_'
KEY='el_sueno_cap1_v2'   # SAVE_KEYS.hybrid в src/shared/data.js
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
errs=[]; res=[]
if os.environ.get('GITHUB_ACTIONS'):   # исключение в тесте (таймаут ожидания и т. п.) — тоже аннотацией прогона
    import traceback
    def _hook(t,e,tb,F=__file__,traceback=traceback,sys=sys):
        fr=[f for f in traceback.extract_tb(tb) if f.filename==F]; where=', '.join(f'{f.lineno}:{f.name}' for f in fr[-3:])
        print(f'::error title=e2e hibrido excepción::{t.__name__} en {where} — {str(e)[:700]}'.replace('\n',' | ')); sys.__excepthook__(t,e,tb)
    sys.excepthook=_hook
def ok(name,cond,extra=''):
    res.append((name,bool(cond))); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra)[:500] if not cond else ''))
    if not cond and os.environ.get('GITHUB_ACTIONS'): print(f'::error title=e2e {"mobile" if MOBILE else "desktop"}::{name} — {str(extra)[:900]}')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=ARGS) if CHROME else p.chromium.launch(args=ARGS)
    ctx=b.new_context(viewport={'width':667,'height':375},has_touch=True,is_mobile=True,device_scale_factor=1,user_agent=UA) if MOBILE else b.new_context(viewport={'width':640,'height':360})
    pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg)
    if os.environ.get('E2E_SLOW'): cdp.send('Emulation.setCPUThrottlingRate',{'rate':float(os.environ['E2E_SLOW'])})   # имитация медленного раннера CI
    pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERROR: '+str(e)))
    ev=pg.evaluate
    shot=lambda n: pg.screenshot(path=os.path.join(SHOTS,PRE+n+'.png'))
    tap=(lambda sel: pg.tap(sel)) if MOBILE else (lambda sel: pg.click(sel))
    point=(lambda x,y: pg.touchscreen.tap(x,y)) if MOBILE else (lambda x,y: pg.mouse.click(x,y))
    def st(): return json.loads(ev("()=>{const g=__sueno;const d=g.input.dest,w=g.world.d.watcher;return JSON.stringify({x:+g.player.pos.x.toFixed(2),z:+g.player.pos.z.toFixed(2),zone:g.player.zone,scr:g.scr,ret:g.state.ret,cor:Math.round(g.state.cordura),busy:g.busy,going:g.going,modal:g.ui.modal,dlg:!!g.dlg.resolve,choice:!!g.dlg.choice,chase:!!g.chase,dist:g.chase&&+(g.chase.dist||0).toFixed(1),wz:w.visible?+w.position.z.toFixed(1):null,mode:g.mode,modo:g.modo,cam:g.cams.cur&&g.cams.cur.id,near:g.inter.near&&g.inter.near.id,dest:!!d,destXZ:d&&[+d.x.toFixed(1),+d.z.toFixed(1)],keys:Object.keys(g.input.keys).filter(k=>g.input.keys[k]),lie:g.player.lie,gt:+g.time.toFixed(1),tries:g.state.tries,inv:g.state.inv,docs:g.state.docs,words:g.state.words.length,arch:g.state.archive,ecos:g.state.ecos,f:g.f})}"))
    def flush(maxn=120):
        for i in range(maxn):
            s=st()
            if s['choice']: return 'choice'
            if s['modal']=='doc':
                if MOBILE: pg.tap('#docHint')
                else: pg.keyboard.press('KeyE')
                pg.wait_for_timeout(220); continue
            if s['dlg']:
                if MOBILE: pg.tap('#sub',position={'x':6,'y':6})
                else: pg.keyboard.press('KeyE')
                pg.wait_for_timeout(110); continue
            if s['modal']=='puzzle': return 'puzzle'
            if s['busy'] or s['going']: pg.wait_for_timeout(250); continue
            return 'idle'
        return 'timeout'
    def opts(): return ev("()=>[...document.querySelectorAll('#choices .ch')].map(b=>b.textContent.replace(/^\\d+/,''))")
    def pick(label):
        o=opts(); i=[k for k,t in enumerate(o) if label in t]; assert i,(label,o)
        if MOBILE: ev(f"()=>__sueno.dlg.pick({i[0]})")   # el toque real en una opción se prueba aparte
        else: pg.keyboard.press(f'Digit{i[0]+1}')
        pg.wait_for_timeout(150)
    def xy(x,y,z):   # punto del mundo → píxeles (o None si queda fuera de la pantalla)
        v=ev(f"()=>{{const g=__sueno,v=new g.player.pos.constructor({x},{y},{z}).project(g.cams.cam);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight,v.z]}}")
        W,H=ev("[innerWidth,innerHeight]"); return (v[0],v[1]) if v[2]<1 and 12<v[0]<W-12 and 60<v[1]<H-12 else None
    def until(js,ms=25000):   # espera una condición del juego; en máquinas lentas (CI, SwiftShader) el juego va más despacio que el reloj
        try: pg.wait_for_function(js,timeout=ms); return True
        except Exception: return False
    def salir():   # del plano fijo a la calle
        if not st()['scr']: return
        flush(); pg.wait_for_selector('#nav .nv',timeout=5000); tap('#nav .nv:has-text("Salir")'); pg.wait_for_function("!__sueno.scr && !__sueno.going",timeout=25000); pg.wait_for_timeout(250); flush()
    def tp(x,z):
        salir(); ev(f"()=>__sueno.player.place({x},{z})"); pg.wait_for_timeout(250)
    def act(x,z):   # ir a un punto de la calle y usar el objeto cercano (E, o un toque sobre el objeto)
        tp(x,z); pg.wait_for_timeout(200)
        # tras un corte de cámara SwiftShader compila materiales: el objeto cercano puede tardar en aparecer
        try: pg.wait_for_function("!!__sueno.inter.near || __sueno.busy",timeout=5000)
        except Exception: pass
        if not st()['busy']:   # los rótulos se abren solos
            if MOBILE:
                c=ev("()=>{const g=__sueno,it=g.inter.near;if(!it)return null;const v=it.hitbox.position.clone().project(g.cams.cam);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight,v.z]}")
                W,H=ev("[innerWidth,innerHeight]")
                if c and c[2]<1 and 12<c[0]<W-12 and 60<c[1]<H-12 and ev(f"()=>{{const g=__sueno,it=g.inter.pickAt({c[0]},{c[1]});return !!it&&it===g.inter.near}}"): point(c[0],c[1])
                else: ev("()=>__sueno.inter.act()")   # tapado por otro objeto o fuera de la pantalla
            else: pg.keyboard.press('KeyE')
        pg.wait_for_timeout(250); return flush()
    def hs(id):   # punto activo de un plano fijo
        flush(); pg.wait_for_timeout(300); flush()
        try: pg.wait_for_selector(f'.hs.on[data-id="{id}"]',timeout=5000)
        except Exception: raise AssertionError(('hotspot no visible',id,st()['scr']))
        tap(f'.hs[data-id="{id}"]'); pg.wait_for_timeout(250); return flush()
    def anselmo():   # hablar con Anselmo: desde la calle (entra en el plano) o dentro del plano
        return hs('anselmo') if st()['scr']=='plaza2' else act(-5.5,-42)
    def tienda():   # cruzar la puerta abierta de la tienda
        if st()['scr']=='tienda': return
        tp(12.9,-34); pg.wait_for_function("__sueno.scr==='tienda' && !__sueno.going",timeout=25000); pg.wait_for_timeout(300); flush()
    def book(tab):
        if MOBILE: tap('#hbInv' if tab==0 else '#hbCua')
        else: pg.keyboard.press('Tab' if tab==0 else 'KeyJ')
        pg.wait_for_timeout(300)
    def close_book():
        if MOBILE: tap('#bookClose')
        else: pg.keyboard.press('Escape')
        pg.wait_for_timeout(200)
    def pause(on=True):
        if (st()['modal']=='pause')!=on:
            if MOBILE: tap('#hbPau')
            else: pg.keyboard.press('Escape')
            pg.wait_for_timeout(300)
    def touch(t,x,y): cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y,'id':1}]})
    def joy(dy):   # mueve el joystick: dy<0 arriba (adelante), dy>0 abajo (atrás); devuelve la función que lo suelta
        r=ev("()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
        touch('touchStart',r[0],r[1]); pg.wait_for_timeout(100); touch('touchMove',r[0],r[1]+dy*0.5); touch('touchMove',r[0],r[1]+dy)
        return lambda: (touch('touchEnd',0,0), pg.wait_for_timeout(200))

    # ---- título y comienzo ----
    pg.goto(URL); pg.wait_for_timeout(1200)
    ok('carga: three r149 + juego', ev('__sueno.three')=='149' and ev('!!window.__sueno'))
    fps=ev("new Promise(r=>{let n=0;const t0=performance.now();const f=()=>{n++;performance.now()-t0<2000?requestAnimationFrame(f):r(n/2)};requestAnimationFrame(f)})"); print('FPS',fps)
    if os.environ.get('GITHUB_ACTIONS'): print(f'::notice title=e2e {"mobile" if MOBILE else "desktop"}::FPS {fps}')
    ok('título: sin «Continuar», modo normal', ev("document.getElementById('tCont').classList.contains('hidden')") and 'normal' in ev("document.getElementById('tModo').textContent"))
    if MOBILE: shot('title')
    tap('#tNew'); pg.wait_for_timeout(11500); r=flush()
    s=st(); ok('intro termina: en la calle, andando (sin plano fijo)', r=='idle' and s['zone']=='callejon' and s['mode']=='play' and s['scr'] is None and ev("document.getElementById('nav').classList.contains('hidden')") and ev("document.querySelectorAll('.hs.on').length")==0, s)
    ok('audio iniciado tras el primer gesto', ev("__sueno.audio.ready && __sueno.audio.ctx.state")=='running')
    if MOBILE:
        ok('táctil: por defecto sin joystick en pantalla', ev("document.body.classList.contains('touch') && document.getElementById('touch').classList.contains('hidden')"))
        # ir a un punto: toque en el suelo
        c=xy(0.3,0,-4.6); z0=st()['z']; point(*c); until("!__sueno.input.dest"); s=st(); ok('toque en el suelo: el protagonista va a ese punto', abs(s['x']-0.3)<0.4 and abs(s['z']+4.6)<0.4 and s['z']<z0-1, (s['x'],s['z']))
    else:
        until("__sueno.player.lie===0"); z0=st()['z']; pg.keyboard.down('KeyW'); until(f"__sueno.player.pos.z<{z0-0.6}",15000); pg.keyboard.up('KeyW'); s=st(); ok('teclado: W avanza (norte)', s['z']<z0-0.4,(z0,s['z']))
        # desde un punto libre: el control es relativo a la cámara y en diagonal se choca con el contenedor (x 1.35–2.5, z −7…−5)
        tp(0,-2); pg.keyboard.down('ArrowRight'); pg.keyboard.down('ShiftLeft'); until("__sueno.player.pos.x>2.1",15000); pg.wait_for_timeout(600); pg.keyboard.up('ArrowRight'); pg.keyboard.up('ShiftLeft'); s=st(); ok('colisión con la pared del callejón', 1.9<s['x']<=2.17, s['x'])
        # clic en el suelo: ir a un punto
        tp(0,-3); c=xy(0.4,0,-5.2); pg.mouse.click(*c); until("!__sueno.input.dest"); s=st(); ok('clic en el suelo: el protagonista va a ese punto', abs(s['x']-0.4)<0.4 and abs(s['z']+5.2)<0.4, (s['x'],s['z']))
    shot('callejon')
    # ---- callejón: nota, linterna, pintada (se abre sola), puerta ----
    act(-0.9,-3.5); s=st(); ok('nota → cuaderno', 'nota' in s['docs'] and s['f'].get('doc_nota'))
    # tocar o pulsar un objeto lejano: el protagonista va hasta él y lo coge
    tp(0.6,-3.2); pg.wait_for_timeout(700)
    c=ev("()=>{const g=__sueno,it=g.world.inter.find(i=>i.id==='linterna');const v=it.hitbox.position.clone().project(g.cams.cam);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]}")
    cur=None
    if not MOBILE: pg.mouse.move(c[0],c[1]); pg.wait_for_timeout(300); cur=ev("document.getElementById('c').style.cursor")
    point(c[0],c[1]); until("__sueno.state.inv.includes('linterna')"); flush()
    ok('objeto lejano: toque o clic → camina hasta él y lo coge', 'linterna' in st()['inv'] and (MOBILE or cur=='pointer'),(cur,st()['inv']))
    tp(-0.6,-14.5); until("__sueno.ui.modal==='doc'",20000); shot('pintada'); flush()
    ok('pintada: al pasar cerca se abre sola como documento', 'grafiti' in st()['docs'])
    pg.wait_for_timeout(600); ok('pintada ya leída: no se abre otra vez sola', st()['modal'] is None and not st()['busy'])
    act(-1.8,-9); ok('puerta del callejón (golpes)', st()['f'].get('golpes'))
    book(0); ok('inventario se abre', st()['modal']=='book'); close_book(); ok('inventario se cierra', st()['modal'] is None)
    book(1); ok('cuaderno con 2 documentos', st()['modal']=='book' and ev("document.querySelectorAll('#bookBody [data-d]').length")>=2); close_book()
    # ---- plaza ----
    tp(0,-23.5); pg.wait_for_timeout(600); flush(); s=st(); ok('plaza: primera visita, teléfono suena', s['f'].get('plazaVisitada') and ev('__sueno.ringing()'))
    tp(0,-47.6); flush(); pg.wait_for_timeout(1000); c=xy(0,0,-51); point(*c) if c else ev("()=>__sueno.input.goTo(0,-51)"); until("__sueno.busy || !!__sueno.dlg.resolve"); s=st(); ok('pasaje bloqueado sin luz', s['z']>=-48.95 and (s['dlg'] or s['busy']), s['z']); flush()
    # quiosco: de la calle al plano fijo y vuelta
    act(-5.2,-29.2); s=st(); ok('quiosco: el periódico abre el plano fijo y se lee', s['scr']=='quiosco' and s['cam']=='quiosco' and 'periodico' in s['docs'] and 'ciudad' in s['arch'], s)
    pg.wait_for_timeout(400); ok('plano fijo: puntos activos y solo la salida «Salir»', ev("document.querySelectorAll('.hs.on').length")==1 and ev("[...document.querySelectorAll('#nav .nv')].map(b=>b.textContent)")==['Salir'], ev("[...document.querySelectorAll('#nav .nv')].map(b=>b.textContent)"))
    shot('quiosco'); salir(); s=st(); ok('«Salir» vuelve a la calle, al punto de entrada', s['scr'] is None and abs(s['x']+5.2)<0.15 and abs(s['z']+29.2)<0.15 and s['ret'] is None, s)
    # cabina
    r=act(7.75,-43.5); ok('cabina: plano fijo y elección', r=='choice' and len(opts())==3 and st()['scr']=='plaza3', (r,opts(),st()['scr'])); pick('Quién'); flush()
    s=st(); ok('llamada → moneda', 'moneda' in s['inv'] and s['f'].get('llamada1') and not ev('__sueno.ringing()'))
    # Anselmo: conversación en plano fijo, todas las preguntas
    r=act(-5.5,-42); ok('Anselmo: la conversación es un plano fijo', st()['scr']=='plaza2' and r=='choice', (r,st()['scr'])); shot('anselmo')
    for q in ['Quién eres','Dónde estoy','Cómo salgo','Quién llama']:
        assert r=='choice', r; pick(q); r=flush()
    pick('Adiós'); flush(); s=st(); ok('Anselmo: 4 ramas de diálogo + adiós', all(s['f'].get(k) for k in ['q_quien','q_donde','q_salir','q_tel','anselmoSed']) and not s['busy'])
    # tienda: empujar / tirar (en la calle), cruzar la puerta → plano fijo
    r=act(12.3,-34); pick('Empujar'); flush(); s=st(); ok('puerta «TIRA»: empujar no abre y tiene consecuencia', not s['f'].get('tiendaAbierta') and s['cor']<100 and s['scr'] is None, s['cor'])
    act(12.3,-34); pick('Tirar'); flush(); ok('puerta «TIRA»: tirar abre', st()['f'].get('tiendaAbierta'))
    tp(10.6,-34); flush(); pg.wait_for_timeout(1200); flush()   # la cámara termina de girar hacia el protagonista: el punto del suelo se proyecta bien
    c=xy(13.0,0,-34); point(*c) if c else ev("()=>__sueno.input.goTo(13,-34)"); pg.wait_for_timeout(300)
    if not st()['dest'] and st()['scr'] is None: ev("()=>__sueno.input.goTo(13,-34)")   # el toque cayó sobre otra cosa
    until("__sueno.scr==='tienda' && !__sueno.going",30000)
    pg.wait_for_timeout(300); flush(); s=st(); ok('tienda: al cruzar la puerta andando se entra en el plano fijo', s['scr']=='tienda' and s['cam']=='tienda' and s['f'].get('v_tienda') and abs(s['ret']['x']-11.7)<0.1, s)
    if MOBILE: ok('en un plano fijo no hay controles de movimiento', ev("document.getElementById('touch').classList.contains('hidden')"))
    shot('tienda'); hs('pilas'); ok('pilas recogidas', 'pilas' in st()['inv'])
    book(0); tap('#bookBody [data-i="linterna"]'); tap('#bookBody [data-a="comb"]'); tap('#bookBody [data-i="pilas"]'); pg.wait_for_timeout(200)
    s=st(); ok('combinar linterna + pilas', 'linterna_ok' in s['inv'] and 'pilas' not in s['inv'] and s['f'].get('luz')); close_book()
    hs('maquina'); pick('AGUA'); flush(); s=st(); ok('máquina: agua (moneda gastada)', 'agua' in s['inv'] and 'moneda' not in s['inv'])
    salir(); s=st(); ok('salir de la tienda: en la plaza, delante de la puerta', s['scr'] is None and abs(s['x']-11.7)<0.15 and s['zone']=='plaza', (s['x'],s['z']))
    pg.wait_for_timeout(700); ok('delante de la puerta no se vuelve a entrar solo', st()['scr'] is None)
    anselmo(); pick('Botella de agua'); r=flush(); ok('Anselmo rechaza el agua', 'agua' in st()['inv'] and not st()['f'].get('tieneLlave')); pick('Adiós'); flush()
    book(0); tap('#bookBody [data-i="agua"]'); tap('#bookBody [data-a="use"]'); pg.wait_for_timeout(300); flush(); ok('usar objeto: beber agua', 'agua' not in st()['inv'])
    anselmo(); pick('No tengo monedas'); flush(); ok('Anselmo da otra moneda', 'moneda' in st()['inv']); pick('Adiós'); flush()
    tienda(); book(0); tap('#bookBody [data-i="moneda"]'); tap('#bookBody [data-a="use"]'); pg.wait_for_timeout(300); flush(); pick('NARANJA'); flush(); ok('usar moneda en la tienda → naranja', 'naranja' in st()['inv'])
    hs('radio'); ok('radio', 'radio' in st()['docs']); hs('calendario'); ok('calendario', 'calendario' in st()['docs'])
    anselmo(); pick('Refresco de naranja'); r=flush(); s=st(); ok('Anselmo da la llave', 'llave' in s['inv'] and s['f'].get('tieneLlave'))
    pick('venda'); flush(); pick('Adiós'); flush()
    tienda(); hs('cajon'); pick('Usar la llave'); flush(); s=st(); ok('cajón: llave → oración + fotografía', 'oracion' in s['docs'] and 'foto' in s['inv'] and 'llave' not in s['inv'] and s['f'].get('cajonVacio'))
    hs('eco3'); pick('miro'); flush(); ok('eco: respuesta equivocada no lo recupera', 'eco3' not in st()['ecos'])
    hs('eco3'); pick('duermo'); flush(); ok('eco: respuesta correcta', 'eco3' in st()['ecos'])
    anselmo(); pick('fotografía'); flush(); pick('Adiós'); flush(); ok('Anselmo: rama de la fotografía', st()['f'].get('q_foto'))
    # ---- pasaje con luz, murales, persecución en tiempo real ----
    if MOBILE:   # el joystick es una opción de la pausa
        salir(); pause(); tap('[data-p="joy"]'); pg.wait_for_timeout(200); ok('opción «Mando en pantalla: sí»', 'sí' in ev("document.getElementById('joyB').textContent")); tap('[data-p="resume"]'); pg.wait_for_timeout(300)
        ok('joystick visible en la calle', ev("!document.getElementById('touch').classList.contains('hidden') && getComputedStyle(document.getElementById('touch')).display!=='none'"))
        tp(0,-48.3); z0=st()['z']; up=joy(-46); pg.wait_for_timeout(400); j=ev("__sueno.input.joy"); until("__sueno.player.zone==='pasaje' && __sueno.player.pos.z<-50.5",20000); up(); pg.wait_for_timeout(300); flush(); s=st()
        ok('joystick: arriba → entra en el pasaje con linterna', s['zone']=='pasaje' and s['f'].get('luzOn') and j['y']>0.8, (s['z'],j))
        ok('joystick: soltar → parar', ev("__sueno.input.joy")=={'x':0,'y':0})
    else:
        tp(0,-48.3); pg.keyboard.down('KeyW'); until("__sueno.player.zone==='pasaje' && __sueno.player.pos.z<-50.5",20000); pg.keyboard.up('KeyW'); pg.wait_for_timeout(300); flush(); s=st(); ok('pasaje: con linterna se entra', s['zone']=='pasaje' and s['f'].get('luzOn'), s['z'])
    for m,(x,z) in {'mano':(-1.2,-52.6),'luna':(1.2,-56.4)}.items(): act(x,z)
    ok('murales', st()['f'].get('mural_mano') and st()['f'].get('mural_luna'))
    tp(0,-57.5); pg.wait_for_timeout(700); s=st(); ok('amenaza: empieza la persecución y la cámara corta', s['chase'] and s['cam']=='pasaje2' and s['scr'] is None, s)
    shot('chase')
    def hold(back,ms):   # back=True: caminar hacia él (mirar atrás); False: huir corriendo
        if MOBILE:
            if not back: tap('#btnR')
            up=joy(-46 if back else 46)
        else:
            pg.keyboard.down('KeyW' if back else 'KeyS')
            if not back: pg.keyboard.down('ShiftLeft')
        for i in range(ms//500):
            pg.wait_for_timeout(500)
            if not st()['chase']: break
        if MOBILE:
            up()
            if not back: tap('#btnR')
        else:
            pg.keyboard.up('KeyW' if back else 'KeyS'); pg.keyboard.up('ShiftLeft')
    hold(True,40000); until('!!__sueno.dlg.resolve',20000); flush(); s=st()
    ok('«NO MIRES ATRÁS»: mirar atrás → atrapado, vuelve a la entrada', s['f'].get('miraste') and not s['chase'] and s['z']>-52 and s['cor']<80, s)
    tp(0,-57.5); pg.wait_for_timeout(600); hold(False,90000); pg.wait_for_timeout(1500); flush(); s=st()
    ok('persecución: correr sin volver → escapar', s['f'].get('chaseDone') and not s['chase'] and 'mira' in s['arch'], s)
    act(0.9,-70.2); ok('informe médico', 'informe' in st()['docs'])
    tp(-0.9,-68.2); until("__sueno.ui.modal==='doc'",20000); flush(); ok('palabras del pasaje: se abren solas', 'pared' in st()['docs'])
    act(-1.2,-60.2); act(1.2,-64); ok('murales completos → archivo', 'simbolos' in st()['arch'])
    # ---- la puerta: placa, pedestal (plano fijo), enigma ----
    tp(0,-75.5); pg.wait_for_timeout(600); flush(); tp(-2.3,-82.4); until("__sueno.ui.modal==='doc'",20000); flush(); ok('placa: se abre sola', 'placa' in st()['docs'])
    r=act(0,-80.4); ok('pedestal: plano fijo y enigma', r=='puzzle' and st()['scr']=='pedestal' and st()['cam']=='pedestal', (r,st()['scr']))
    cor=st()['cor']
    for s_ in ['mano','luna','ojo','boca']: tap(f'#plates [data-s="{s_}"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1900); s=st(); msg=ev("document.getElementById('pzMsg').textContent")
    ok('oración en orden directo: falla con consecuencia y pista', not s['f'].get('puertaAbierta') and s['cor']<cor and 'para entrar' in msg and s['tries']==1,(msg,s['cor'],cor))
    shot('puzzle')
    for s_ in ['boca','ojo','luna','mano']: tap(f'#plates [data-s="{s_}"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(2600); shot('gate1'); pg.wait_for_timeout(5500); shot('gate2'); flush(); pg.wait_for_function("!__sueno.scr && !__sueno.going && !__sueno.busy",timeout=15000); s=st()
    ok('oración al revés: la puerta se abre y el plano del pedestal se cierra solo', s['f'].get('puertaAbierta') and s['scr'] is None and ev("!__sueno.world.d.gateCol.on()") and ev("__sueno.world.d.gateL.rotation.y")>1.0, (s['scr'],ev("__sueno.world.d.gateL.rotation.y")))
    # ---- el mundo recuerda ----
    ok('mundo: pintada cambiada', 'MIRAS TÚ' in ev("__sueno.world.d.grafTxt")); ok('mundo: Anselmo ya no está', ev("!__sueno.world.d.anselmo.visible && __sueno.world.d.vendaObj.visible"))
    act(-5.6,-42); ok('venda en el banco (plano fijo)', 'venda' in st()['arch'] and st()['scr']=='plaza2')
    act(-5.2,-29.2); ok('periódico cambiado', st()['f'].get('doc_periodico2'))
    act(7.75,-43.5); pick('No.'); flush(); ok('segunda llamada', st()['f'].get('llamada2'))
    act(-1.8,-9); ok('puerta del callejón abierta → cama', 'cama' in st()['arch'])
    for eid,(x,z),w in [('eco1',(-1.3,-18),'vacía'),('eco2',(4.1,-31.6),'atrás'),('eco4',(2.6,-77),'luz')]:
        act(x,z); pick(w); flush()
    ok('ecos: 4/4', len(st()['ecos'])==4, st()['ecos'])
    # ---- cuaderno, diccionario, archivo ----
    book(1)
    for t in [2,3,4,0,1]:
        tap(f'#bookTabs [data-t="{t}"]'); pg.wait_for_timeout(150)
        if t==2: nd=ev("document.querySelectorAll('#bookBody .dw').length")
        if t==3: na=ev("document.querySelectorAll('#bookBody [data-r]').length")
    tap('#bookTabs [data-t="3"]'); pg.wait_for_timeout(200); shot('archivo'); tap('#bookTabs [data-t="0"]'); pg.wait_for_timeout(200); shot('inv')
    s=st(); ok('diccionario y archivo se llenan', nd==s['words'] and nd>50 and na==len(s['arch']) and na>=9,(nd,s['words'],na))
    tap('#bookTabs [data-t="1"]'); pg.wait_for_timeout(200); tap('#bookBody .paper .w'); pg.wait_for_timeout(200); ok('toque en palabra → definición en español', ev("!document.getElementById('tip').classList.contains('hidden') && document.getElementById('tip').textContent.length>10")); close_book()
    # ---- pausa: sonido, modo lectura ----
    pg.wait_for_timeout(200); pause(); ok('pausa', st()['modal']=='pause'); shot('pause')
    fits=ev("()=>{const p=document.querySelector('#pause .panel');return p.scrollHeight>p.clientHeight ? getComputedStyle(p).overflowY : 'fits'}"); ok('pausa cabe o se desplaza', fits in('fits','auto'),fits)
    tap('[data-p="mute"]'); pg.wait_for_timeout(400); ok('silencio: ganancia maestra → 0', ev("__sueno.audio.muted && __sueno.audio.master.gain.value<0.02"), ev("__sueno.audio.master.gain.value"))
    tap('[data-p="mute"]'); ev("()=>{const r=document.getElementById('volR'); r.value=30; r.dispatchEvent(new Event('input'))}"); pg.wait_for_timeout(500); ok('volumen 30 %', abs(ev("__sueno.audio.master.gain.value")-0.3)<0.05, ev("__sueno.audio.master.gain.value"))
    tap('[data-p="resume"]'); pg.wait_for_timeout(200)
    tp(2,-30); pg.wait_for_timeout(500); flush(); pause(); tap('[data-p="modo"]'); pg.wait_for_timeout(300); tap('[data-p="resume"]'); pg.wait_for_timeout(500); s=st()
    ok('modo lectura: la calle pasa a ser un plano fijo con salidas', s['modo']=='lectura' and s['scr']=='plaza1' and ev("document.querySelectorAll('#nav .nv').length")>=5 and ev("document.getElementById('touch').classList.contains('hidden')"), (s['scr'],ev("document.querySelectorAll('#nav .nv').length")))
    shot('lectura'); tap('#nav .nv:has-text("El quiosco")'); pg.wait_for_timeout(1600); flush(); ok('modo lectura: se cambia de plano con las flechas', st()['scr']=='quiosco')
    pause(); tap('[data-p="modo"]'); pg.wait_for_timeout(300); tap('[data-p="resume"]'); pg.wait_for_timeout(500); s=st()
    ok('vuelta al modo normal dentro de un plano fijo: se sigue en él', s['modo']=='normal' and s['scr']=='quiosco' and ev("[...document.querySelectorAll('#nav .nv')].map(b=>b.textContent)")==['Salir'], s['scr'])
    salir(); s=st(); ok('y «Salir» lleva a la calle', s['scr'] is None and s['zone']=='plaza', (s['x'],s['z']))
    # ---- guardado → recarga → continuar: en la calle y dentro de un plano fijo ----
    tp(3,-78); pause(); tap('[data-p="save"]'); pg.wait_for_timeout(300); before=st()
    pg.reload(); pg.wait_for_timeout(1500); ok('tras recargar hay «Continuar»', ev("!document.getElementById('tCont').classList.contains('hidden')"))
    tap('#tCont'); pg.wait_for_timeout(2500); a=st()
    ok('estado restaurado (posición, objetos, documentos, banderas, palabras, ecos)', a['scr'] is None and abs(a['x']-3)<0.1 and abs(a['z']+78)<0.1 and a['inv']==before['inv'] and a['docs']==before['docs'] and a['words']==before['words'] and a['ecos']==before['ecos'] and a['f'].get('puertaAbierta') and a['tries']==before['tries'], (a['x'],a['z'],a['inv']))
    ok('mundo restaurado (verja abierta, sin colisión)', ev("__sueno.world.d.gateL.rotation.y")>1.3 and ev("!__sueno.world.d.gateCol.on()"))
    act(-5.2,-29.2); ev("()=>__sueno.saveNow()"); pg.reload(); pg.wait_for_timeout(1500); tap('#tCont'); pg.wait_for_timeout(2500); a=st()
    ok('guardado dentro de un plano fijo: se continúa en él', a['scr']=='quiosco' and a['ret'] and abs(a['ret']['x']+5.2)<0.15, (a['scr'],a['ret']))
    salir(); a=st(); ok('y la salida recuerda el punto de la calle', a['scr'] is None and abs(a['x']+5.2)<0.15 and abs(a['z']+29.2)<0.15, (a['x'],a['z']))
    # ---- final ----
    tp(0,-83)
    if MOBILE: up=joy(-46)
    else: pg.keyboard.down('KeyW'); pg.wait_for_timeout(100)
    until("__sueno.mode==='end'",60000)
    if MOBILE: up()
    else: pg.keyboard.up('KeyW')
    ok('final: cruzar la verja andando dispara el final', st()['mode']=='end', st()['z'])
    pg.wait_for_timeout(33000); ok('final: pantalla de fin con estadísticas', ev("!document.getElementById('end').classList.contains('hidden') && document.querySelectorAll('#endStats dd').length")==7)
    shot('end')
    # ---- guardado dañado ----
    pg.reload(); pg.wait_for_timeout(1200); ev(f"()=>localStorage.setItem('{KEY}','{{esto no es json')"); pg.reload(); pg.wait_for_timeout(1500)
    ok('guardado dañado: se ignora sin errores', ev("document.getElementById('tCont').classList.contains('hidden')") and ev('!!window.__sueno'))
    ev(f"()=>localStorage.setItem('{KEY}',JSON.stringify({{v:2,inv:['x','moneda'],flags:null,pos:{{x:'a'}},docs:7,scr:'nada',ret:5}}))"); pg.reload(); pg.wait_for_timeout(1500); tap('#tCont'); pg.wait_for_timeout(2500); s=st()
    ok('guardado parcial/raro: se sanea', s['inv']==['moneda'] and s['zone']=='callejon' and s['mode']=='play' and s['scr'] is None, s)
    if MOBILE:
        # toque real en una opción, página sin desplazamiento, pantalla vertical
        ev("()=>{const g=__sueno;g.f.v_plaza=true}"); r=act(12.3,-34); shot('choice'); pg.tap('#choices .ch:nth-of-type(2)'); pg.wait_for_timeout(300)
        if st()['choice']: pg.tap('#choices .ch:nth-of-type(2)'); pg.wait_for_timeout(300)   # el primer toque puede abrir la definición de una palabra
        flush(); ok('toque real en una opción: «Tirar» abre la tienda', ev("__sueno.f.tiendaAbierta")==True)
        touch('touchStart',330,200); touch('touchMove',330,120); touch('touchMove',330,40); touch('touchEnd',0,0); pg.wait_for_timeout(200); ev("()=>__sueno.input.stop()")
        ok('sin desplazamiento de página', ev("window.scrollY===0 && document.documentElement.scrollTop===0 && document.documentElement.scrollHeight<=innerHeight"))
        flush(); pg.set_viewport_size({'width':390,'height':760}); pg.wait_for_timeout(1200); tp(2,-30); pg.wait_for_timeout(800); flush(); shot('port')
        ok('vertical: lienzo ocupa la pantalla', ev("document.getElementById('c').width===390 && document.getElementById('c').height===760"), ev("[document.getElementById('c').width,document.getElementById('c').height]"))
        tienda(); pg.wait_for_timeout(400); shot('port_tienda'); ok('vertical: puntos activos dentro de la pantalla', ev("[...document.querySelectorAll('.hs.on')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight})"))
    b.close()
print('\nERRORES DE CONSOLA:', errs or 'ninguno')
print('TOTAL', sum(1 for _,c in res if c), '/', len(res))
sys.exit(0 if all(c for _,c in res) and not errs else 1)
