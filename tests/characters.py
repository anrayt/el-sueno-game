"""Персонажи «из сна»: скриншоты крупно (спереди, сбоку, сзади; с эффектом сна и без) и в игровых сценах
→ tests/screenshots/characters/. Плюс проверки: модели на своём слое, сила эффекта по персонажам,
правило El Que Mira (ближе к камере и центру — резче), переключатель «Efecto de sueño».
Запуск: python3 tests/characters.py
Код возврата: 0 — все проверки прошли и нет ошибок в консоли, иначе 1.
"""
import os, pathlib, sys
from playwright.sync_api import sync_playwright
URL=os.environ.get('E2E_URL') or (pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno.html').as_uri()
OUT=os.path.join(os.path.dirname(__file__),'screenshots','characters'); os.makedirs(OUT,exist_ok=True)
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
errs=[]; res=[]
def ok(name,cond,extra=''):
    res.append(bool(cond)); print(('PASS ' if cond else 'FAIL ')+name+(' — '+str(extra)[:400] if not cond else ''))
    if not cond and os.environ.get('GITHUB_ACTIONS'): print(f'::error title=characters::{name} — {str(extra)[:300]}')
with sync_playwright() as p:
    b=p.chromium.launch(args=ARGS); pg=b.new_context(viewport={'width':960,'height':540}).new_page(); ev=pg.evaluate
    pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append('PE '+str(e)))
    shot=lambda n: pg.screenshot(path=os.path.join(OUT,n+'.png'))
    pg.goto(URL); pg.wait_for_timeout(1200); pg.click('#tNew'); pg.wait_for_timeout(11500)
    pg.wait_for_function("__sueno.mode==='play'",timeout=30000)
    for i in range(80):   # la intro
        if ev("!!__sueno.dlg.resolve"): pg.keyboard.press('KeyE'); pg.wait_for_timeout(120)
        elif ev("__sueno.busy"): pg.wait_for_timeout(250)
        else: break
    ok('efecto de sueño: activado por defecto', ev("__sueno.sueno===true && __sueno.gfx.dream===true"))
    lay=ev("""(()=>{const g=__sueno,d=g.world.d,n=o=>{let a=0,b=0;o.traverse(m=>{if(m.isMesh){if(m.layers.mask===2)a++;else b++;}});return [a,b]};return {hero:n(g.player.g),anselmo:n(d.anselmo),watcher:n(d.watcher),sombra:n(d.sombra)}})()""")
    ok('modelos en la capa de personajes (la sombra del protagonista queda en el escenario)', lay['hero'][1]==1 and lay['anselmo'][1]==0 and lay['watcher'][1]==0 and min(v[0] for v in lay.values())>=10, lay)
    ok('fuerza del efecto: Anselmo 1.0, protagonista 0.4', ev("__sueno.world.d.anselmo.userData.dream.value")==1.0 and abs(ev("__sueno.player.g.userData.dream.value")-0.4)<1e-6)
    ok('luces visibles para las dos capas', ev("(()=>{let k=0,t=0;__sueno.world.scene.traverse(o=>{if(o.isLight){t++;if(o.layers.mask&2)k++;}});return k===t&&t>0})()"))
    # ---- retratos: cámara fija, el personaje gira ----
    ev("""()=>{const g=__sueno;g.mode='frozen';g.cams._upd=g.cams.update;g.cams.update=function(){};g.cams.cam.fov=42;g.cams.cam.updateProjectionMatrix();g.gfx.u.dark.value=0;
      window.__look=(px,py,pz,tx,ty,tz)=>{const c=g.cams.cam;c.position.set(px,py,pz);c.lookAt(tx,ty,tz);};
      window.__frame=()=>{g.update(0.016);};
      const st=document.createElement('style');st.id='rig';st.textContent='#hud,#zona,#toast,#prompt{visibility:hidden!important}';document.head.appendChild(st);}""")
    def portrait(name, setup, cam, views):
        ev(f"()=>{{const g=__sueno,d=g.world.d;{setup}}}")
        for v,ry in views:
            for on in (True,False):
                ev(f"()=>{{const g=__sueno;g.gfx.dream={'true' if on else 'false'};{ry};__look(...{cam});for(let i=0;i<12;i++){{g.time+=0.05;__frame();}}}}")
                pg.wait_for_timeout(150); shot(f"{name}_{v}{'' if on else '_sin'}")
    # el protagonista en la tienda (hay luz)
    portrait('protagonista', "g.player.place(20.8,-35.4,0);g.player.lie=0;g.player.sync();d.anselmo.visible=false",
             [20.8,1.0,-31.9,20.8,0.92,-35.4], [('frente',"g.player.ry=0;g.player.sync()"),('lado',"g.player.ry=Math.PI/2;g.player.sync()"),('espalda',"g.player.ry=Math.PI;g.player.sync()")])
    # Anselmo sentado (sin banco: es la hoja del modelo)
    portrait('anselmo', "g.player.place(14.5,-31,0);d.anselmo.visible=true;d.anselmo.position.set(20.8,0,-35.6)",
             [20.8,0.85,-32.6,20.8,0.72,-35.6], [('frente',"g.world.d.anselmo.rotation.y=0"),('lado',"g.world.d.anselmo.rotation.y=Math.PI/2"),('espalda',"g.world.d.anselmo.rotation.y=Math.PI")])
    # El Que Mira en la plaza: silueta contra la niebla
    portrait('el_que_mira', "g.player.place(10,-27,0);d.anselmo.visible=false;const w=d.watcher;w.visible=true;w.position.set(-3,0,-37);w.userData.armL.rotation.x=0;w.userData.armR.rotation.x=0",
             [-3,1.6,-31.6,-3,1.55,-37], [('frente',"g.world.d.watcher.rotation.y=0"),('lado',"g.world.d.watcher.rotation.y=Math.PI/2"),('espalda',"g.world.d.watcher.rotation.y=Math.PI")])
    # caras de cerca
    ev("()=>{const g=__sueno,d=g.world.d;d.watcher.visible=false;d.anselmo.visible=false;g.player.place(20.8,-35.4,0);g.player.sync()}")
    for on in (True,False):
        ev(f"()=>{{const g=__sueno;g.gfx.dream={'true' if on else 'false'};__look(20.8,1.62,-34.35,20.8,1.6,-35.4);for(let i=0;i<12;i++){{g.time+=0.05;__frame();}}}}"); pg.wait_for_timeout(120); shot('protagonista_cara'+('' if on else '_sin'))
    ev("()=>{const g=__sueno,d=g.world.d;g.player.place(14.5,-31,0);d.anselmo.visible=true;d.anselmo.position.set(20.8,0,-35.6);d.anselmo.rotation.y=0}")
    for on in (True,False):
        ev(f"()=>{{const g=__sueno;g.gfx.dream={'true' if on else 'false'};__look(20.8,1.3,-34.55,20.8,1.25,-35.6);for(let i=0;i<12;i++){{g.time+=0.05;__frame();}}}}"); pg.wait_for_timeout(120); shot('anselmo_cara'+('' if on else '_sin'))
    ev("()=>{const g=__sueno,d=g.world.d;d.anselmo.visible=false;d.watcher.visible=true}")
    # regla de El Que Mira: cerca y en el centro → nítido; lejos o al borde → difuso
    near=ev("()=>{const g=__sueno,w=g.world.d.watcher;w.rotation.y=0;__look(-3,2.2,-34.4,-3,2.4,-37);g.cams.cam.updateMatrixWorld();__frame();return __sueno.world.d.watcher.userData.dream.value}")
    far=ev("()=>{const g=__sueno;__look(-3,1.6,-22,-3,1.5,-37);g.cams.cam.updateMatrixWorld();__frame();return __sueno.world.d.watcher.userData.dream.value}")
    side=ev("()=>{const g=__sueno;__look(-3,2.2,-34.4,0.5,2.4,-37);g.cams.cam.updateMatrixWorld();__frame();return __sueno.world.d.watcher.userData.dream.value}")
    ok('El Que Mira: cerca y en el centro es nítido; lejos o al borde, difuso', near<0.35 and far>0.8 and side>0.7, (near,far,side))
    ev("()=>{const g=__sueno;__look(-3,2.2,-34.4,-3,2.4,-37);for(let i=0;i<10;i++){g.time+=0.05;__frame();}}"); pg.wait_for_timeout(100); shot('el_que_mira_cerca')
    # ---- en escena: vuelve la cámara del juego ----
    ev("()=>{const g=__sueno,d=g.world.d;document.getElementById('rig').remove();g.cams.update=g.cams._upd;g.mode='play';d.watcher.visible=false;d.watcher.rotation.y=Math.PI;d.anselmo.position.set(-6.5,0,-42);d.anselmo.rotation.y=Math.PI/2;d.anselmo.visible=true;g.gfx.dream=true}")
    def scene(name, js, wait=2200):   # los sucesos de zona abren frases: se pasan antes de la foto
        ev(f"()=>{{const g=__sueno;{js}}}"); pg.wait_for_timeout(600)
        for i in range(40):
            if ev("!!__sueno.dlg.resolve"): pg.keyboard.press('KeyE'); pg.wait_for_timeout(150)
            else: break
        pg.wait_for_timeout(wait); shot(name)
    scene('escena_callejon', "g.toStreet({x:0.2,z:-4.5,ry:Math.PI})")
    scene('escena_plaza_anselmo', "g.toStreet({x:-3.4,z:-40.6,ry:-1.6})")
    scene('escena_banco', "g.setScreen('plaza2')")
    scene('escena_boca_sombra', "g.toStreet({x:-0.4,z:-46,ry:Math.PI});g.world.d.sombra.visible=true")
    scene('escena_persecucion', "g.f.luz=g.f.luzOn=true;g.sync();g.toStreet({x:0,z:-63.5,ry:Math.PI});const w=g.world.d.watcher;w.visible=true;w.position.set(-0.2,0,-59.8);w.rotation.y=Math.PI;g.cams.force='pasaje2'")
    scene('escena_persecucion_cerca', "const w=g.world.d.watcher;w.position.set(-0.2,0,-66.6);g.player.place(0,-68.8,Math.PI)", 1500)
    s1=ev("__sueno.world.d.watcher.userData.dream.value")
    # el ajuste: Efecto de sueño sí/no (pausa), se guarda
    ev("()=>{const g=__sueno;g.world.d.watcher.visible=false;g.cams.force=null;g.toStreet({x:-3.4,z:-40.6,ry:-1.6})}"); pg.wait_for_timeout(800)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); ok('pausa: botón «Efecto de sueño: sí»', ev("document.getElementById('suenoB').textContent")=='Efecto de sueño: sí')
    pg.click('[data-p="sueno"]'); pg.wait_for_timeout(300)
    ok('se apaga y se guarda en los ajustes', not ev("__sueno.gfx.dream") and ev("JSON.parse(localStorage.getItem('el_sueno_ajustes_v1')).sueno")==False and ev("document.getElementById('suenoB').textContent")=='Efecto de sueño: no')
    pg.click('[data-p="resume"]'); pg.wait_for_timeout(1200); shot('escena_plaza_anselmo_sin')
    pg.reload(); pg.wait_for_timeout(1500); ok('tras recargar sigue apagado', ev("__sueno.sueno===false && __sueno.gfx.dream===false"))
    ev("()=>__sueno.setSueno(true)"); ok('y se vuelve a encender', ev("__sueno.gfx.dream===true"))
    b.close()
print('ERRORES DE CONSOLA:', errs or 'ninguno')
print(f'TOTAL {sum(res)} / {len(res)}')
sys.exit(0 if all(res) and not errs else 1)
