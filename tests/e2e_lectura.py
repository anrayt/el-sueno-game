"""Сквозное прохождение главы в «Modo lectura»: все сцены — кадры с активными точками и выходами, без ходьбы;
погоня — выборы на время. Режим включается кнопкой на титульном экране.
Запуск: python3 tests/e2e_lectura.py      (десктоп, мышь+клавиатура)
        python3 tests/e2e_lectura.py m    (мобильная эмуляция, тач)
Нужно: pip install -r requirements.txt && python3 -m playwright install chromium
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import json, sys
from playwright.sync_api import sync_playwright
import os, pathlib
URL=os.environ.get('E2E_URL') or (pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno.html').as_uri()  # E2E_URL: проверить по http
CHROME=os.environ.get('CHROME_PATH')  # необязательно: путь к Chrome; иначе Chromium из Playwright
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
MOBILE = len(sys.argv)>1
errs=[]; res=[]
SHOTS=os.path.join(os.path.dirname(__file__),'screenshots'); os.makedirs(SHOTS,exist_ok=True)
def ok(name,cond,extra=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra)[:400] if not cond else ''))
    if not cond and os.environ.get('GITHUB_ACTIONS'): print(f'::error title=e2e lectura::{name} — {str(extra)[:300]}')
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=ARGS) if CHROME else p.chromium.launch(args=ARGS)
    ctx=b.new_context(viewport={'width':667,'height':375},has_touch=True,is_mobile=True) if MOBILE else b.new_context(viewport={'width':640,'height':360})
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append('PE '+str(e)))
    ev=pg.evaluate
    tap=(lambda sel: pg.tap(sel)) if MOBILE else (lambda sel: pg.click(sel))
    def st(): return json.loads(ev("()=>{const g=__sueno;return JSON.stringify({f:g.f,inv:g.state.inv,docs:g.state.docs,words:g.state.words.length,arch:g.state.archive,ecos:g.state.ecos,cor:g.state.cordura,scr:g.scr,zone:g.player.zone,busy:g.busy,going:g.going,modal:g.ui.modal,dlg:!!g.dlg.resolve,choice:!!g.dlg.choice,mode:g.mode,cam:g.cams.cur&&g.cams.cur.id,tries:g.state.tries,can:g.canAct()})}"))
    def flush(maxn=120):
        for i in range(maxn):
            s=st()
            if s['choice']: return 'choice'
            if s['modal']=='doc':
                if MOBILE: pg.tap('#docHint')
                else: pg.keyboard.press('KeyE')
                pg.wait_for_timeout(200); continue
            if s['dlg']:
                if MOBILE: pg.tap('#sub',position={'x':6,'y':6})
                else: pg.keyboard.press('Space')
                pg.wait_for_timeout(110); continue
            if s['modal']=='puzzle': return 'puzzle'
            if s['busy'] or s['going']: pg.wait_for_timeout(250); continue
            return 'idle'
        return 'timeout'
    def opts(): return ev("()=>[...document.querySelectorAll('#choices .ch')].map(b=>b.textContent.replace(/^\\d+/,''))")
    def pick(label):
        o=opts(); i=[k for k,t in enumerate(o) if label in t]; assert i,(label,o)
        if MOBILE: ev(f"()=>__sueno.dlg.pick({i[0]})")   # el toque real en opciones se prueba aparte
        else: pg.keyboard.press(f'Digit{i[0]+1}')
        pg.wait_for_timeout(150)
    def hs(id):
        flush(); pg.wait_for_timeout(450); flush(); pg.wait_for_timeout(150)
        # el punto se muestra en el siguiente fotograma: con SwiftShader cargado puede tardar
        try: pg.wait_for_selector(f'.hs.on[data-id="{id}"]',timeout=5000)
        except Exception: raise AssertionError(('hotspot no visible',id,st()['scr']))
        tap(f'.hs[data-id="{id}"]'); pg.wait_for_timeout(250); return flush()
    def go(label):
        flush()
        try: pg.wait_for_function(f"[...document.querySelectorAll('#nav .nv')].some(b=>b.textContent.includes('{label}'))",timeout=5000)
        except Exception: raise AssertionError((label, ev("document.getElementById('nav').textContent")))
        tap(f'#nav .nv:has-text("{label}")'); pg.wait_for_timeout(1600); flush(); pg.wait_for_timeout(300); return flush()
    pg.goto(URL); pg.wait_for_timeout(1200)
    ok('carga sin errores, THREE r149', ev('__sueno.three')=='149' and ev('!!window.__sueno'))
    tap('#tModo'); pg.wait_for_timeout(300); ok('título: se elige «Modo: lectura» y el ajuste se guarda', 'lectura' in ev("document.getElementById('tModo').textContent") and ev("__sueno.modo")=='lectura' and 'lectura' in ev("localStorage.getItem('el_sueno_ajustes_v1')"))
    tap('#tNew'); pg.wait_for_timeout(11500); r=flush()
    try: pg.wait_for_function("document.querySelectorAll('.hs.on').length==3 && document.querySelectorAll('#nav .nv').length==1",timeout=5000)
    except Exception: pass
    s=st()
    ok('intro → primer plano con puntos activos y salidas', r=='idle' and s['scr']=='callejon1' and ev("document.querySelectorAll('.hs.on').length")==3 and ev("document.querySelectorAll('#nav .nv').length")==1, s)
    ok('audio iniciado', ev("__sueno.audio.ready && __sueno.audio.ctx.state")=='running')
    ok('sin controles de movimiento en pantalla', ev("getComputedStyle(document.getElementById('touch')).display")=='none')
    pg.screenshot(path=os.path.join(SHOTS,'q_callejon.png'))
    if not MOBILE:
        pg.hover('.hs[data-id="nota"]'); pg.wait_for_timeout(400); ok('ratón: al pasar por un punto aparece la acción', 'Coger' in ev("document.getElementById('prompt').textContent") and ev("document.getElementById('prompt').style.opacity")=='1')
    hs('nota'); ok('nota → cuaderno', 'nota' in st()['docs']); hs('linterna'); ok('linterna al inventario', 'linterna' in st()['inv'])
    hs('puertaCallejon'); ok('puerta del callejón (golpes)', st()['f'].get('golpes'))
    go('Seguir por el callejón'); ok('cambio de plano', st()['scr']=='callejon2' and st()['cam']=='callB'); hs('grafiti'); ok('pintada', 'grafiti' in st()['docs'])
    go('Salir a la plaza'); s=st(); ok('plaza: primera visita, teléfono suena', s['scr']=='plaza1' and s['f'].get('plazaVisitada') and ev('__sueno.ringing()'))
    ok('la tienda no es salida hasta abrirla', not ev("[...document.querySelectorAll('#nav .nv')].some(b=>b.textContent.includes('La tienda'))"))
    pg.screenshot(path=os.path.join(SHOTS,'q_plaza.png'))
    go('El pasaje'); go('Entrar en el pasaje'); ok('pasaje bloqueado sin luz', st()['scr']=='boca'); hs('sombra'); ok('sombra lejana', st()['f'].get('sombraVista'))
    go('Volver a la plaza'); go('El quiosco'); pg.screenshot(path=os.path.join(SHOTS,'q_quiosco.png')); hs('periodico'); ok('periódico', 'periodico' in st()['docs']); go('Volver a la plaza')
    go('La cabina'); r=hs('telefono'); ok('teléfono: elección', r=='choice' and len(opts())==3); pick('Quién'); flush(); ok('llamada → moneda', 'moneda' in st()['inv'] and st()['f'].get('llamada1')); go('Volver a la plaza')
    go('El banco'); r=hs('anselmo'); pg.screenshot(path=os.path.join(SHOTS,'q_anselmo.png'))
    for q in ['Quién eres','Dónde estoy','Cómo salgo','Quién llama']: pick(q); flush()
    pick('Adiós'); flush(); s=st(); ok('Anselmo: ramas de diálogo', all(s['f'].get(k) for k in ['q_quien','q_donde','q_salir','q_tel','anselmoSed'])); go('Volver a la plaza')
    hs('puertaTienda'); pick('Empujar'); flush(); ok('«TIRA»: empujar no abre, baja la cordura', not st()['f'].get('tiendaAbierta') and st()['cor']<100)
    hs('puertaTienda'); pick('Tirar'); flush(); ok('«TIRA»: tirar abre y aparece la salida', st()['f'].get('tiendaAbierta'))
    go('La tienda'); ok('tienda', st()['scr']=='tienda'); pg.screenshot(path=os.path.join(SHOTS,'q_tienda.png')); hs('pilas')
    if MOBILE: tap('#hbInv')
    else: pg.keyboard.press('Tab')
    pg.wait_for_timeout(300); tap('#bookBody [data-i="linterna"]'); tap('#bookBody [data-a="comb"]'); tap('#bookBody [data-i="pilas"]'); pg.wait_for_timeout(200); ok('combinar linterna + pilas', 'linterna_ok' in st()['inv'] and st()['f'].get('luz')); tap('#bookClose'); pg.wait_for_timeout(200)
    hs('maquina'); pick('AGUA'); flush(); ok('máquina: agua', 'agua' in st()['inv'])
    go('Salir a la plaza'); go('El banco'); hs('anselmo'); pick('Botella de agua'); flush(); ok('Anselmo rechaza el agua', not st()['f'].get('tieneLlave')); pick('Adiós'); flush()
    if MOBILE: tap('#hbInv')
    else: pg.keyboard.press('Tab')
    pg.wait_for_timeout(300); tap('#bookBody [data-i="agua"]'); tap('#bookBody [data-a="use"]'); pg.wait_for_timeout(300); flush(); ok('usar objeto: beber', 'agua' not in st()['inv'])
    hs('anselmo'); pick('No tengo monedas'); flush(); pick('Adiós'); flush(); ok('otra moneda', 'moneda' in st()['inv'])
    go('Volver a la plaza'); go('La tienda')
    if MOBILE: tap('#hbInv')
    else: pg.keyboard.press('Tab')
    pg.wait_for_timeout(300); tap('#bookBody [data-i="moneda"]'); tap('#bookBody [data-a="use"]'); pg.wait_for_timeout(300); flush(); pick('NARANJA'); flush(); ok('usar moneda en la máquina', 'naranja' in st()['inv'])
    hs('radio'); hs('calendario'); ok('radio y calendario', 'radio' in st()['docs'] and 'calendario' in st()['docs'])
    go('Salir a la plaza'); go('El banco'); hs('anselmo'); pick('Refresco de naranja'); flush(); pick('venda'); flush(); pick('Adiós'); flush(); ok('llave de Anselmo', 'llave' in st()['inv'])
    go('Volver a la plaza'); go('La tienda'); hs('cajon'); pick('Usar la llave'); flush(); s=st(); ok('cajón: oración + fotografía', 'oracion' in s['docs'] and 'foto' in s['inv'] and ev("!document.querySelector('.hs.on[data-id=\"cajon\"]')"))
    hs('eco3'); pick('miro'); flush(); ok('eco: error', 'eco3' not in st()['ecos']); hs('eco3'); pick('duermo'); flush(); ok('eco: acierto', 'eco3' in st()['ecos'])
    go('Salir a la plaza'); go('El pasaje'); go('Entrar en el pasaje'); s=st(); ok('con linterna se entra', s['scr']=='pasajeA' and s['f'].get('luzOn')); pg.screenshot(path=os.path.join(SHOTS,'q_pasaje.png'))
    for m in ['mano','luna','ojo','boca']: hs('mural_'+m)
    ok('murales → archivo', 'simbolos' in st()['arch'])
    # persecución: mirar atrás
    tap('#nav .nv:has-text("Seguir adelante")'); pg.wait_for_timeout(1500); r=flush(); s=st(); ok('persecución: corte de cámara, criatura, elección con tiempo', r=='choice' and s['cam']=='pasaje2' and ev("__sueno.world.d.watcher.visible && !!document.querySelector('#choices .tbar')"), s)
    pg.screenshot(path=os.path.join(SHOTS,'q_chase.png')); pick('Mirar atrás'); pg.wait_for_timeout(3500); flush(); s=st(); ok('mirar atrás → atrapado, vuelve a la entrada', s['f'].get('miraste') and s['scr']=='boca' and s['cor']<75 and not ev("__sueno.world.d.watcher.visible"), s)
    # tiempo agotado
    go('Entrar en el pasaje'); tap('#nav .nv:has-text("Seguir adelante")'); pg.wait_for_timeout(1500); flush(); cor=st()['cor']; pg.wait_for_timeout(21000); flush(); ok('tiempo agotado = «parar»: consecuencia y nueva elección', st()['cor']<cor and st()['choice'], (cor,st()['cor']))
    pick('Seguir adelante'); flush(); pick('Anselmo?'); flush(); pick('No mirar'); flush(); pick('Correr'); pg.wait_for_timeout(1500); flush(); s=st(); ok('escapar', s['f'].get('chaseDone') and s['scr']=='pasajeB' and 'mira' in s['arch'], s)
    hs('informe'); hs('pared'); ok('informe y pared', 'informe' in st()['docs'] and 'pared' in st()['docs'])
    go('Ir a la puerta'); hs('placa'); ok('sin «Cruzar la puerta» antes de abrir', not ev("[...document.querySelectorAll('#nav .nv')].some(b=>b.textContent.includes('Cruzar'))"))
    r=hs('pedestal'); ok('enigma abierto', r=='puzzle'); cor=st()['cor']
    for x in ['mano','luna','ojo','boca']: tap(f'#plates [data-s="{x}"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1900); ok('orden directo: falla, pista', not st()['f'].get('puertaAbierta') and st()['cor']<cor and 'para entrar' in ev("document.getElementById('pzMsg').textContent"))
    for x in ['boca','ojo','luna','mano']: tap(f'#plates [data-s="{x}"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(8500); flush(); ok('al revés: la puerta se abre', st()['f'].get('puertaAbierta') and ev("__sueno.world.d.gateL.rotation.y")>1.0)
    go('Volver al pasaje'); go('Volver por el pasaje'); go('Salir a la plaza'); go('Volver a la plaza'); go('El banco'); hs('venda'); ok('mundo: Anselmo no está, venda', 'venda' in st()['arch'])
    go('Volver a la plaza'); go('La cabina'); hs('telefono'); pick('No.'); flush(); ok('segunda llamada', st()['f'].get('llamada2'))
    go('Volver a la plaza'); hs('eco2'); pick('atrás'); flush(); go('El callejón'); hs('eco1'); pick('vacía'); flush(); ok('pintada cambiada', 'MIRAS TÚ' in ev("__sueno.world.d.grafTxt"))
    go('Volver al fondo'); hs('puertaCallejon'); ok('puerta del callejón → cama', 'cama' in st()['arch'])
    # guardar / recargar
    tap('#hbPau'); pg.wait_for_timeout(300); tap('[data-p="mute"]'); pg.wait_for_timeout(400); ok('silencio', ev("__sueno.audio.master.gain.value<0.02")); tap('[data-p="mute"]'); tap('[data-p="save"]'); pg.wait_for_timeout(300); before=st()
    pg.reload(); pg.wait_for_timeout(1500); tap('#tCont'); pg.wait_for_timeout(2600); flush(); a=st()
    ok('guardado: plano, objetos, documentos, palabras, ecos, banderas', a['scr']==before['scr']=='callejon1' and a['inv']==before['inv'] and a['docs']==before['docs'] and a['words']==before['words'] and a['ecos']==before['ecos'] and a['f'].get('puertaAbierta'), (a['scr'],before['scr']))
    for l in ['Seguir por','Salir a la plaza','El pasaje','Entrar en el pasaje','Seguir adelante','Ir a la puerta']: go(l)
    hs('eco4'); pick('luz'); flush(); ok('ecos 4/4', len(st()['ecos'])==4)
    tap('#nav .nv:has-text("Cruzar la puerta")'); pg.wait_for_timeout(34000); ok('final con estadísticas', ev("!document.getElementById('end').classList.contains('hidden') && document.querySelectorAll('#endStats dd').length")==7); pg.screenshot(path=os.path.join(SHOTS,'q_end.png'))
    pg.reload(); pg.wait_for_timeout(1200); ev("()=>localStorage.setItem(__sueno.save.key,'{roto')"); pg.reload(); pg.wait_for_timeout(1500); ok('guardado dañado se ignora', ev("document.getElementById('tCont').classList.contains('hidden')") and ev('!!window.__sueno'))
    if MOBILE:
        tap('#tNew'); pg.wait_for_timeout(11500); flush(); ev("()=>{const g=__sueno;g.f.v_plaza=true;g.setScreen('plaza1')}"); pg.wait_for_timeout(500); hs('puertaTienda'); pg.screenshot(path=os.path.join(SHOTS,'q_m_choice.png'))
        pg.tap('#choices .ch:nth-of-type(3)'); pg.wait_for_timeout(300); ok('toque real en una opción', not st()['choice'])
        ok('página sin desplazamiento', ev("window.scrollY===0 && document.documentElement.scrollHeight<=innerHeight"))
        pg.set_viewport_size({'width':390,'height':760}); pg.wait_for_timeout(1500); flush(); pg.screenshot(path=os.path.join(SHOTS,'q_m_port.png')); ok('vertical: puntos y salidas dentro de la pantalla', ev("()=>[...document.querySelectorAll('.hs.on, #nav .nv')].every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.bottom<=innerHeight})"))
    b.close()
print('ERRORES:',errs or 'ninguno'); print('TOTAL',sum(res),'/',len(res))
sys.exit(0 if res and all(res) and not errs else 1)
