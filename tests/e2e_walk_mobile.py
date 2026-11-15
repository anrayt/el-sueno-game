"""Тач-управление версии с ходьбой (мобильная эмуляция).
Запуск: python3 tests/e2e_walk_mobile.py
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import json, sys
from playwright.sync_api import sync_playwright
import os, pathlib
URL=(pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno-walk.html').as_uri()
CHROME=os.environ.get('CHROME_PATH')
SHOTS=os.path.join(os.path.dirname(__file__),'screenshots','walk'); os.makedirs(SHOTS,exist_ok=True)
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
errs=[]; n=[0,0]
def ok(name,cond,extra=''):
    n[1]+=1; n[0]+=bool(cond); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra) if not cond else ''))
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
with sync_playwright() as p:
    b=p.chromium.launch(executable_path=CHROME,args=ARGS) if CHROME else p.chromium.launch(args=ARGS)
    ctx=b.new_context(viewport={'width':667,'height':375},has_touch=True,is_mobile=True,device_scale_factor=1,user_agent=UA)
    pg=ctx.new_page(); cdp=ctx.new_cdp_session(pg)
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append('PE '+str(e)))
    ev=pg.evaluate
    def st(): return json.loads(ev("()=>{const g=__sueno;return JSON.stringify({inv:g.state.inv,docs:g.state.docs,x:g.player.pos.x,z:g.player.pos.z,busy:g.busy,modal:g.ui.modal,dlg:!!g.dlg.resolve,choice:!!g.dlg.choice,mode:g.mode,joy:g.joy,run:g.runT})}"))
    def flush():
        for i in range(60):
            s=st()
            if s['choice']: return 'choice'
            if s['modal']=='doc': pg.tap('#docBody'); pg.wait_for_timeout(450); continue
            if s['dlg']: pg.tap('#sub'); pg.wait_for_timeout(150); continue
            if s['busy']: pg.wait_for_timeout(250); continue
            return 'idle'
    def touch(t,x,y): cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[] if t=='touchEnd' else [{'x':x,'y':y,'id':1}]})
    pg.goto(URL); pg.wait_for_timeout(1200); pg.screenshot(path=os.path.join(SHOTS,'m_title.png'))
    pg.tap('#tNew'); pg.wait_for_timeout(11500)
    ok('táctil detectado: controles visibles', ev("document.body.classList.contains('touch') && !document.getElementById('touch').classList.contains('hidden')"))
    ok('audio iniciado con el toque', ev("__sueno.audio.ready"))
    flush(); pg.screenshot(path=os.path.join(SHOTS,'m_land.png'))
    r=ev("()=>{const r=document.getElementById('joy').getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2]}")
    z0=st()['z']; touch('touchStart',r[0],r[1]); pg.wait_for_timeout(100); touch('touchMove',r[0],r[1]-25); touch('touchMove',r[0],r[1]-46); pg.wait_for_timeout(2500); s=st()
    ok('joystick: arriba → avanza', s['z']<z0-0.4 and s['joy']['y']>0.8,(z0,s['z'],s['joy']))
    touch('touchEnd',0,0); pg.wait_for_timeout(200); ok('joystick: soltar → parar', st()['joy']=={'x':0,'y':0})
    pg.tap('#btnR'); ok('botón correr (alternar)', st()['run']); pg.tap('#btnR')
    # botón de acción junto a la nota
    ev("()=>{window.__ev=[];['pointerdown','pointerup','pointercancel','click','touchstart','touchend','mousedown'].forEach(n=>document.addEventListener(n,e=>__ev.push(n+':'+(e.pointerType||'')+':'+(e.target.id||e.target.className||e.target.tagName)),true)); __sueno.player.place(-0.9,-3.5)}"); pg.wait_for_timeout(500); pr=ev("document.getElementById('prompt').textContent"); pg.tap('#btnA'); pg.wait_for_timeout(400)
    ok('botón de acción: abre la nota', st()['modal']=='doc' and 'Coger' in pr,(pr,st()['modal'])); pg.screenshot(path=os.path.join(SHOTS,'m_doc.png'))
    pg.tap('#doc'); pg.wait_for_timeout(300); flush(); ok('toque cierra el documento', 'nota' in st()['docs'] and st()['modal'] is None)
    # tocar un objeto en la escena
    ev("()=>__sueno.player.place(0.5,-6.6)"); pg.wait_for_timeout(2500)
    xy=ev("()=>{const g=__sueno,it=g.world.inter.find(i=>i.id==='linterna');const v=it.hitbox.position.clone().project(g.cams.cam);return [(v.x+1)/2*innerWidth,(1-v.y)/2*innerHeight]}")
    pg.touchscreen.tap(xy[0],xy[1]); pg.wait_for_timeout(400); flush(); ok('tocar objeto en la escena: linterna', 'linterna' in st()['inv'])
    pg.tap('#hbInv'); pg.wait_for_timeout(300); ok('botón inventario', st()['modal']=='book'); pg.screenshot(path=os.path.join(SHOTS,'m_inv.png')); pg.tap('#bookClose'); pg.wait_for_timeout(200)
    pg.tap('#hbPau'); pg.wait_for_timeout(300); ok('botón pausa', st()['modal']=='pause'); pg.screenshot(path=os.path.join(SHOTS,'m_pause.png'))
    fits=ev("()=>{const p=document.querySelector('#pause .panel');return p.scrollHeight>p.clientHeight ? getComputedStyle(p).overflowY : 'fits'}"); ok('pausa cabe o se desplaza', fits in('fits','auto'),fits)
    pg.tap('[data-p="resume"]'); pg.wait_for_timeout(200)
    # elección táctil: puerta de la tienda
    ev("()=>{const g=__sueno;g.f.v_plaza=true;g.player.place(12.3,-34)}"); pg.wait_for_timeout(600); pg.tap('#btnA'); pg.wait_for_timeout(300); r=flush()
    pg.screenshot(path=os.path.join(SHOTS,'m_choice.png')); pg.tap('#choices .ch:nth-of-type(2)'); pg.wait_for_timeout(300)
    s2=ev("__sueno.f.tiendaAbierta"); 
    if not s2: pg.tap('#choices .ch:nth-of-type(2)'); pg.wait_for_timeout(300)   # primer toque puede abrir la definición de una palabra
    flush(); ok('elección táctil: «Tirar» abre la tienda', ev("__sueno.f.tiendaAbierta")==True)
    # arrastre sobre el lienzo: la página no se desplaza
    touch('touchStart',330,200); touch('touchMove',330,120); touch('touchMove',330,40); touch('touchEnd',0,0); pg.wait_for_timeout(200)
    ok('sin desplazamiento de página', ev("window.scrollY===0 && document.documentElement.scrollTop===0 && document.documentElement.scrollHeight<=innerHeight"))
    flush()
    # vertical
    pg.set_viewport_size({'width':390,'height':760}); pg.wait_for_timeout(1200); ev("()=>__sueno.player.place(2,-30)"); pg.wait_for_timeout(800); flush(); pg.screenshot(path=os.path.join(SHOTS,'m_port.png'))
    ok('vertical: lienzo ocupa la pantalla', ev("document.getElementById('c').width===390 && document.getElementById('c').height===760"), ev("[document.getElementById('c').width,document.getElementById('c').height]"))
    b.close()
print('ERRORES:',errs or 'ninguno'); print('TOTAL',n[0],'/',n[1])
sys.exit(0 if n[0]==n[1] and not errs else 1)
