"""Сквозное прохождение версии с ходьбой (десктоп).
Запуск: python3 tests/e2e_walk.py
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import json, sys
from playwright.sync_api import sync_playwright
import os, pathlib
URL=(pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno-walk.html').as_uri()
CHROME=os.environ.get('CHROME_PATH')
SHOTS=os.path.join(os.path.dirname(__file__),'screenshots','walk'); os.makedirs(SHOTS,exist_ok=True)
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
errs=[]; res=[]
def ok(name,cond,extra=''):
    res.append((name,bool(cond))); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra) if extra and not cond else ''))
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=ARGS) if CHROME else p.chromium.launch(args=ARGS)
    ctx=b.new_context(viewport={'width':640,'height':360})
    pg=ctx.new_page()
    pg.on('console',lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
    pg.on('pageerror',lambda e: errs.append('PAGEERROR: '+str(e)))
    ev=pg.evaluate
    def st(): return json.loads(ev("()=>{const g=__sueno;return JSON.stringify({f:g.f,inv:g.state.inv,docs:g.state.docs,words:g.state.words.length,arch:g.state.archive,ecos:g.state.ecos,cor:g.state.cordura,x:g.player.pos.x,z:g.player.pos.z,zone:g.player.zone,busy:g.busy,modal:g.ui.modal,dlg:!!g.dlg.resolve,choice:!!g.dlg.choice,chase:!!g.chase,mode:g.mode,cam:g.cams.cur&&g.cams.cur.id,tries:g.state.tries,dec:g.state.decisions,log:g.state.log.length})}"))
    def tp(x,z): ev(f"()=>__sueno.player.place({x},{z})"); pg.wait_for_timeout(250)
    def flush(maxn=80):
        for i in range(maxn):
            s=st()
            if s['choice']: return 'choice'
            if s['modal']=='doc' or s['dlg']: pg.keyboard.press('KeyE'); pg.wait_for_timeout(110); continue
            if s['modal']=='puzzle': return 'puzzle'
            if s['busy']: pg.wait_for_timeout(250); continue
            return 'idle'
        return 'timeout'
    def opts(): return ev("()=>[...document.querySelectorAll('#choices .ch')].map(b=>b.textContent.replace(/^\\d+/,''))")
    def pick(label):
        o=opts(); i=[k for k,t in enumerate(o) if label in t]
        assert i, (label,o); pg.keyboard.press(f'Digit{i[0]+1}'); pg.wait_for_timeout(150)
    def act(x,z):
        tp(x,z); pg.wait_for_timeout(200)
        # tras un corte de cámara SwiftShader compila materiales: el objeto cercano puede tardar en aparecer
        try: pg.wait_for_function("!!__sueno.inter.near",timeout=5000)
        except Exception: pass
        pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); return flush()

    pg.goto(URL); pg.wait_for_timeout(1200)
    ok('1 carga: THREE r149 + juego', ev('THREE.REVISION')=='149' and ev('!!window.__sueno'))
    ok('1 título sin «Continuar» (sin guardado)', ev("document.getElementById('tCont').classList.contains('hidden')"))
    pg.click('#tNew'); pg.wait_for_timeout(11500); r=flush()
    s=st(); ok('2 intro termina, jugador en el callejón', r=='idle' and s['zone']=='callejon' and s['mode']=='play', s)
    ok('2 audio iniciado tras el primer gesto', ev("__sueno.audio.ready && __sueno.audio.ctx.state")=='running')
    # movimiento con teclado + colisiones
    z0=st()['z']; pg.keyboard.down('KeyW'); pg.wait_for_timeout(1500); pg.keyboard.up('KeyW'); s=st(); ok('9 teclado: W avanza (norte)', s['z']<z0-0.4,(z0,s['z']))
    # desde un punto libre: el control es relativo a la cámara y en diagonal se choca con el contenedor (x 1.35–2.5, z −7…−5)
    tp(0,-2); pg.keyboard.down('ArrowRight'); pg.keyboard.down('ShiftLeft'); pg.wait_for_timeout(2500); pg.keyboard.up('ArrowRight'); pg.keyboard.up('ShiftLeft'); s=st(); ok('9 colisión con la pared del callejón', 1.9<s['x']<=2.17, s['x'])
    # nota (E), grafiti, linterna (clic de ratón), puerta del callejón
    act(-0.9,-3.5); s=st(); ok('4 nota → cuaderno', 'nota' in s['docs'] and s['f'].get('doc_nota'))
    act(-1.4,-14.5); ok('4 pintada leída', 'grafiti' in st()['docs'])
    tp(0.5,-6.6); pg.wait_for_timeout(500)
    xy=ev("()=>{const g=__sueno,it=g.world.inter.find(i=>i.id==='linterna');const v=it.hitbox.position.clone().project(g.cams.cam);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]}")
    pg.mouse.move(xy[0],xy[1]); pg.wait_for_timeout(300); cur=ev("document.getElementById('c').style.cursor")
    pg.mouse.click(xy[0],xy[1]); pg.wait_for_timeout(300); flush(); ok('9 ratón: cursor sobre objeto + clic recoge la linterna', cur=='pointer' and 'linterna' in st()['inv'],(cur,st()['inv']))
    act(-1.8,-9); ok('4 puerta del callejón (golpes)', st()['f'].get('golpes'))
    # inventario: linterna sin pilas
    pg.keyboard.press('Tab'); pg.wait_for_timeout(300); ok('7 Tab abre inventario', st()['modal']=='book'); pg.keyboard.press('Tab'); pg.wait_for_timeout(200); ok('7 Tab cierra', st()['modal'] is None)
    pg.keyboard.press('KeyJ'); pg.wait_for_timeout(300); ok('7 J abre cuaderno con 2 documentos', st()['modal']=='book' and ev("document.querySelectorAll('#bookBody [data-d]').length")>=2); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # plaza
    tp(0,-23.5); pg.wait_for_timeout(600); flush(); s=st(); ok('plaza: primera visita, teléfono suena', s['f'].get('plazaVisitada') and ev('__sueno.ringing()'))
    tp(0,-48.3); pg.keyboard.down('KeyW'); pg.wait_for_timeout(1800); pg.keyboard.up('KeyW'); pg.wait_for_timeout(300); s=st(); ok('pasaje bloqueado sin luz', s['z']>=-48.95 and (s['dlg'] or s['busy']), s['z']); flush()
    act(-5.6,-28.3); ok('4 periódico', 'periodico' in st()['docs'] and 'ciudad' in st()['arch'])
    tp(7.75,-43.5); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); r=flush(); ok('5 teléfono: llega a elección', r=='choice' and len(opts())==3, opts()); pick('Quién'); flush()
    s=st(); ok('5 llamada → moneda', 'moneda' in s['inv'] and s['f'].get('llamada1') and not ev('__sueno.ringing()'))
    # Anselmo: todas las preguntas
    tp(-5.5,-42); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); r=flush(); seen=set()
    for q in ['Quién eres','Dónde estoy','Cómo salgo','Quién llama']:
        assert r=='choice', r; pick(q); r=flush(); seen.add(q)
    pick('Adiós'); flush(); s=st(); ok('5 Anselmo: 4 ramas de diálogo + adiós', all(s['f'].get(k) for k in ['q_quien','q_donde','q_salir','q_tel','anselmoSed']) and not s['busy'])
    # tienda: empujar / tirar
    tp(12.3,-34); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); r=flush(); pick('Empujar'); flush(); s=st(); ok('puerta «TIRA»: empujar no abre y tiene consecuencia', not s['f'].get('tiendaAbierta') and s['cor']<100, s['cor'])
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('Tirar'); flush(); ok('puerta «TIRA»: tirar abre', st()['f'].get('tiendaAbierta'))
    tp(12.5,-34); pg.keyboard.down('KeyD'); pg.wait_for_timeout(2500); pg.keyboard.up('KeyD'); pg.wait_for_timeout(300)
    s=st(); 
    if s['zone']!='tienda': tp(14.5,-34); pg.wait_for_timeout(400)
    flush(); ok('tienda: entrar', st()['zone']=='tienda', (s['x'],s['z']))
    act(17.1,-32.0); ok('7 pilas recogidas', 'pilas' in st()['inv'])
    # combinar
    pg.keyboard.press('Tab'); pg.wait_for_timeout(300); pg.click('#bookBody [data-i="linterna"]'); pg.click('#bookBody [data-a="comb"]'); pg.click('#bookBody [data-i="pilas"]'); pg.wait_for_timeout(200)
    s=st(); ok('7 combinar linterna + pilas', 'linterna_ok' in s['inv'] and 'pilas' not in s['inv'] and s['f'].get('luz')); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # máquina: bebida equivocada
    tp(21.4,-37.4); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('AGUA'); flush(); s=st(); ok('máquina: agua (moneda gastada)', 'agua' in s['inv'] and 'moneda' not in s['inv'])
    tp(-5.5,-42); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('Botella de agua'); r=flush(); ok('Anselmo rechaza el agua', 'agua' in st()['inv'] and not st()['f'].get('tieneLlave'))
    pick('Adiós'); flush()
    # beber el agua desde el inventario
    pg.keyboard.press('Tab'); pg.wait_for_timeout(300); pg.click('#bookBody [data-i="agua"]'); pg.click('#bookBody [data-a="use"]'); pg.wait_for_timeout(300); flush(); ok('7 usar objeto: beber agua', 'agua' not in st()['inv'])
    tp(-5.5,-42); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('No tengo monedas'); flush(); ok('Anselmo da otra moneda', 'moneda' in st()['inv']); pick('Adiós'); flush()
    # usar moneda desde el inventario junto a la máquina
    tp(21.4,-37.4); pg.keyboard.press('Tab'); pg.wait_for_timeout(300); pg.click('#bookBody [data-i="moneda"]'); pg.click('#bookBody [data-a="use"]'); pg.wait_for_timeout(300); flush(); pick('NARANJA'); flush(); ok('7 usar moneda en la máquina → naranja', 'naranja' in st()['inv'])
    tp(-5.5,-42); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('Refresco de naranja'); r=flush(); s=st(); ok('Anselmo da la llave', 'llave' in s['inv'] and s['f'].get('tieneLlave'))
    pick('venda'); flush(); pick('Adiós'); flush()
    act(17.9,-36.1); ok('4 radio', 'radio' in st()['docs']); act(19.6,-38.2); ok('4 calendario', 'calendario' in st()['docs'])
    tp(16.4,-36.1); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('Usar la llave'); flush(); s=st(); ok('cajón: llave → oración + fotografía', 'oracion' in s['docs'] and 'foto' in s['inv'] and 'llave' not in s['inv'] and s['f'].get('cajonVacio'))
    tp(21.2,-34.6); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('miro'); flush(); ok('eco: respuesta equivocada no lo recupera', 'eco3' not in st()['ecos'])
    pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('duermo'); flush(); ok('eco: respuesta correcta', 'eco3' in st()['ecos'])
    tp(-5.5,-42); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('fotografía'); flush(); pick('Adiós'); flush(); ok('5 Anselmo: rama de la fotografía', st()['f'].get('q_foto'))
    # pasaje con luz, murales, persecución (mirar atrás)
    tp(0,-48.3); pg.keyboard.down('KeyW'); pg.wait_for_timeout(3000); pg.keyboard.up('KeyW'); pg.wait_for_timeout(300); flush(); s=st(); ok('pasaje: con linterna se entra', s['zone']=='pasaje' and s['f'].get('luzOn'), s['z'])
    for m,(x,z) in {'mano':(-1.2,-52.6),'luna':(1.2,-56.4)}.items(): act(x,z)
    ok('4 murales', st()['f'].get('mural_mano') and st()['f'].get('mural_luna'))
    tp(0,-57.5); pg.wait_for_timeout(700); s=st(); ok('amenaza: empieza la persecución y la cámara corta', s['chase'] and s['cam']=='pasaje2', s)
    pg.screenshot(path=os.path.join(SHOTS,'p_chase.png'))
    pg.keyboard.down('KeyW'); pg.wait_for_timeout(6000); pg.keyboard.up('KeyW'); pg.wait_for_timeout(2500); flush(); s=st()
    ok('«NO MIRES ATRÁS»: mirar atrás → atrapado, vuelve a la entrada', s['f'].get('miraste') and not s['chase'] and s['z']>-52 and s['cor']<80, s)
    tp(0,-57.5); pg.wait_for_timeout(600); pg.keyboard.down('KeyS'); pg.keyboard.down('ShiftLeft')
    for i in range(60):
        pg.wait_for_timeout(500)
        if not st()['chase']: break
    pg.keyboard.up('KeyS'); pg.keyboard.up('ShiftLeft'); pg.wait_for_timeout(1500); flush(); s=st()
    ok('persecución: correr sin volver → escapar', s['f'].get('chaseDone') and not s['chase'] and 'mira' in s['arch'], s)
    act(0.9,-70.2); ok('4 informe médico', 'informe' in st()['docs']); act(-1.2,-68.2); ok('4 palabras del pasaje', 'pared' in st()['docs'])
    act(-1.2,-60.2); act(1.2,-64); ok('murales completos → archivo', 'simbolos' in st()['arch'])
    # la puerta
    tp(0,-75.5); pg.wait_for_timeout(600); flush(); act(-2.5,-82.9); ok('4 placa', 'placa' in st()['docs'])
    tp(0,-80.4); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); r=flush(); ok('6 pedestal abre el enigma', r=='puzzle')
    cor=st()['cor']
    for s_ in ['mano','luna','ojo','boca']: pg.click(f'#plates [data-s="{s_}"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(1900); s=st(); msg=ev("document.getElementById('pzMsg').textContent")
    ok('6 oración en orden directo: falla con consecuencia y pista', not s['f'].get('puertaAbierta') and s['cor']<cor and 'para entrar' in msg and s['tries']==1,(msg,s['cor'],cor))
    pg.screenshot(path=os.path.join(SHOTS,'p_puzzle.png'))
    for s_ in ['boca','ojo','luna','mano']: pg.click(f'#plates [data-s="{s_}"]'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(2600); pg.screenshot(path=os.path.join(SHOTS,'p_gate1.png')); pg.wait_for_timeout(5500); pg.screenshot(path=os.path.join(SHOTS,'p_gate2.png')); flush(); s=st()
    ok('6 oración al revés: la puerta se abre (cambio del mundo)', s['f'].get('puertaAbierta') and ev("!__sueno.world.d.gateCol.on()") and ev("__sueno.world.d.gateL.rotation.y")>1.0, ev("__sueno.world.d.gateL.rotation.y"))
    # el mundo recuerda
    ok('mundo: pintada cambiada', 'MIRAS TÚ' in ev("__sueno.world.d.grafTxt")); ok('mundo: Anselmo ya no está', ev("!__sueno.world.d.anselmo.visible && __sueno.world.d.vendaObj.visible"))
    act(-5.6,-42); ok('venda en el banco', 'venda' in st()['arch'])
    act(-5.6,-28.3); ok('periódico cambiado', st()['f'].get('doc_periodico2'))
    tp(7.75,-43.5); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick('No.'); flush(); ok('5 segunda llamada', st()['f'].get('llamada2'))
    act(-1.8,-9); ok('puerta del callejón abierta → cama', 'cama' in st()['arch'])
    for eid,(x,z),w in [('eco1',(-1.3,-18),'vacía'),('eco2',(4.1,-31.6),'atrás'),('eco4',(2.6,-77),'luz')]:
        tp(x,z); pg.keyboard.press('KeyE'); pg.wait_for_timeout(200); flush(); pick(w); flush()
    ok('ecos: 4/4', len(st()['ecos'])==4, st()['ecos'])
    # diccionario / archivo
    pg.keyboard.press('KeyJ'); pg.wait_for_timeout(200)
    for t in [2,3,4,0,1]:
        pg.click(f'#bookTabs [data-t="{t}"]'); pg.wait_for_timeout(150)
        if t==2: nd=ev("document.querySelectorAll('#bookBody .dw').length")
        if t==3: na=ev("document.querySelectorAll('#bookBody [data-r]').length")
    pg.click('#bookTabs [data-t="3"]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS,'p_archivo.png')); pg.click('#bookTabs [data-t="0"]'); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(SHOTS,'p_inv.png'))
    s=st(); ok('diccionario y archivo se llenan', nd==s['words'] and nd>50 and na==len(s['arch']) and na>=9,(nd,s['words'],na))
    # palabra subrayada → definición
    pg.click('#bookTabs [data-t="1"]'); pg.wait_for_timeout(200); pg.click('#bookBody .paper .w'); pg.wait_for_timeout(200); ok('toque en palabra → definición en español', ev("!document.getElementById('tip').classList.contains('hidden') && document.getElementById('tip').textContent.length>10")); pg.keyboard.press('Escape')
    # pausa, volumen, silencio
    pg.wait_for_timeout(200); pg.keyboard.press('Escape'); pg.wait_for_timeout(300); ok('Esc → pausa', st()['modal']=='pause'); pg.screenshot(path=os.path.join(SHOTS,'p_pause.png'))
    pg.click('[data-p="mute"]'); pg.wait_for_timeout(400); ok('11 silencio: ganancia maestra → 0', ev("__sueno.audio.muted && __sueno.audio.master.gain.value<0.02"), ev("__sueno.audio.master.gain.value"))
    pg.click('[data-p="mute"]'); ev("()=>{const r=document.getElementById('volR'); r.value=30; r.dispatchEvent(new Event('input'))}"); pg.wait_for_timeout(500); ok('11 volumen 30 %', abs(ev("__sueno.audio.master.gain.value")-0.3)<0.05, ev("__sueno.audio.master.gain.value"))
    pg.click('[data-p="save"]'); pg.wait_for_timeout(300)
    # guardado → recarga → continuar
    tp(3,-78); pg.keyboard.press('Escape'); pg.wait_for_timeout(200); pg.click('[data-p="save"]'); pg.wait_for_timeout(300); before=st()
    pg.reload(); pg.wait_for_timeout(1500); ok('8 tras recargar hay «Continuar»', ev("!document.getElementById('tCont').classList.contains('hidden')"))
    pg.click('#tCont'); pg.wait_for_timeout(2500); a=st()
    ok('8 estado restaurado (posición, objetos, documentos, banderas, palabras, ecos)', abs(a['x']-3)<0.1 and abs(a['z']+78)<0.1 and a['inv']==before['inv'] and a['docs']==before['docs'] and a['words']==before['words'] and a['ecos']==before['ecos'] and a['f'].get('puertaAbierta') and a['tries']==before['tries'], (a['x'],a['z'],a['inv']))
    ok('8 mundo restaurado (verja abierta, sin colisión)', ev("__sueno.world.d.gateL.rotation.y")>1.3 and ev("!__sueno.world.d.gateCol.on()"))
    # final
    tp(0,-83); pg.keyboard.down('KeyW'); pg.wait_for_timeout(100)
    for i in range(40):
        pg.wait_for_timeout(500)
        if st()['mode']=='end': break
    pg.keyboard.up('KeyW'); ok('final: cruzar la verja andando dispara el final', st()['mode']=='end', st()['z'])
    pg.wait_for_timeout(33000); ok('final: pantalla de fin con estadísticas', ev("!document.getElementById('end').classList.contains('hidden') && document.querySelectorAll('#endStats dd').length")==7)
    pg.screenshot(path=os.path.join(SHOTS,'p_end.png'))
    # guardado dañado
    pg.reload(); pg.wait_for_timeout(1200); ev("()=>localStorage.setItem(__sueno.save.key,'{esto no es json')"); pg.reload(); pg.wait_for_timeout(1500)
    ok('8 guardado dañado: se ignora sin errores', ev("document.getElementById('tCont').classList.contains('hidden')") and ev('!!window.__sueno'))
    ev("()=>localStorage.setItem(__sueno.save.key,JSON.stringify({v:1,inv:['x','moneda'],flags:null,pos:{x:'a'},docs:7}))"); pg.reload(); pg.wait_for_timeout(1500); pg.click('#tCont'); pg.wait_for_timeout(2500); s=st()
    ok('8 guardado parcial/raro: se sanea', s['inv']==['moneda'] and s['zone']=='callejon' and s['mode']=='play', s)
    b.close()
print('\nERRORES DE CONSOLA:', errs or 'ninguno')
print('TOTAL', sum(1 for _,c in res if c), '/', len(res))
sys.exit(0 if all(c for _,c in res) and not errs else 1)
