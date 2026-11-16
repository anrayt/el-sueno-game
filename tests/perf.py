"""Замер FPS в нескольких сценах с персонажами (headless Chromium, SwiftShader — абсолютные числа ниже, чем на GPU;
важно сравнение «до/после» и «эффект сна: да/нет» на одной машине).
Запуск: python3 tests/perf.py [ширина высота]   (по умолчанию 1280×720: рендер в 540 строк, как на обычном экране)
"""
import json, os, pathlib, sys
from playwright.sync_api import sync_playwright
URL=os.environ.get('E2E_URL') or (pathlib.Path(__file__).resolve().parent.parent/'dist'/'el-sueno.html').as_uri()
W,H=(int(sys.argv[1]),int(sys.argv[2])) if len(sys.argv)>2 else (1280,720)
ARGS=['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--no-sandbox','--autoplay-policy=no-user-gesture-required']
SCENES={   # nombre → preparación (JS)
  'callejon': "g.toStreet({x:0,z:-3,ry:Math.PI})",
  'anselmo':  "g.setScreen('plaza2')",
  'plaza':    "g.toStreet({x:-3,z:-38,ry:-1.6})",
  'pasaje':   "g.f.luz=g.f.luzOn=true;g.sync();g.toStreet({x:0,z:-63.5,ry:Math.PI});const w=g.world.d.watcher;w.visible=true;w.position.set(-0.2,0,-59.5);g.cams.force='pasaje2'",
}
def fps(ev,ms=3000): return ev(f"new Promise(r=>{{let n=0;const t0=performance.now();const f=()=>{{n++;performance.now()-t0<{ms}?requestAnimationFrame(f):r(+(n*1000/(performance.now()-t0)).toFixed(1))}};requestAnimationFrame(f)}})")
with sync_playwright() as p:
    b=p.chromium.launch(args=ARGS); pg=b.new_context(viewport={'width':W,'height':H}).new_page(); ev=pg.evaluate
    pg.goto(URL); pg.wait_for_timeout(1200); pg.click('#tNew'); pg.wait_for_timeout(1500)
    ev("()=>{const g=__sueno;g.busy=false;g.dlg.hide&&g.dlg.hide();g.ui.fade(false,'',0);g.player.lie=0;g.player.sync();g.mode='play'}"); pg.wait_for_timeout(9000)
    ev("()=>{const g=__sueno;g.dlg.resolve&&g.dlg.advance();}")
    has=ev("'sueno' in __sueno")
    out={}
    for name,js in SCENES.items():
        ev(f"()=>{{const g=__sueno;{js}}}"); pg.wait_for_timeout(1500)
        row={}
        for on in ([True,False] if has else [None]):
            if on is not None: ev(f"()=>__sueno.setSueno({'true' if on else 'false'})"); pg.wait_for_timeout(600)
            row['sí' if on else ('no' if on is False else 'fps')]=fps(ev)
        out[name]=row; print(name,row,flush=True)
        os.makedirs(os.path.join(os.path.dirname(__file__),'screenshots','characters'),exist_ok=True)
    b.close()
print(json.dumps({'viewport':[W,H],'fps':out},ensure_ascii=False))
