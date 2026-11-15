/* =====================================================================
   ESCENAS: la partida es una serie de planos fijos. En cada plano hay
   puntos activos (objetos) y salidas (otros planos). No se camina:
   se mira, se lee y se elige.
   ===================================================================== */
const SCREENS = {
  callejon1: { cam: 'callA', at: [0.2, -3.2], ry: Math.PI, hs: ['nota', 'linterna', 'puertaCallejon'],
    exits: [{ label: 'Seguir por el callejón', to: 'callejon2' }] },
  callejon2: { cam: 'callB', at: [0.2, -15.6], ry: -1.2, hs: ['grafiti', 'eco1'],
    exits: [{ label: 'Salir a la plaza', to: 'plaza1' }, { label: 'Volver al fondo del callejón', to: 'callejon1' }] },
  plaza1: { cam: 'plazaS', at: [2.5, -29.5], ry: Math.PI, hs: ['puertaTienda', 'eco2'],
    exits: [{ label: 'El quiosco', to: 'quiosco' }, { label: 'El banco', to: 'plaza2' }, { label: 'La cabina', to: 'plaza3' }, { label: 'La tienda', to: 'tienda', if: f => f.tiendaAbierta }, { label: 'El pasaje', to: 'boca' }, { label: 'El callejón', to: 'callejon2' }] },
  quiosco: { cam: 'quiosco', at: [-5.3, -29.6], ry: -0.6, hs: ['periodico'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
  plaza2: { cam: 'plazaNW', at: [-4.6, -41.2], ry: -1.9, hs: ['anselmo', 'venda'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
  plaza3: { cam: 'plazaNE', at: [6.6, -42.5], ry: 1.2, hs: ['telefono'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
  boca: { cam: 'pasaje1', at: [-0.5, -46.6], ry: Math.PI, hs: ['sombra'],
    exits: [{ label: 'Entrar en el pasaje', act: async g => { if (!g.f.luz) { await g.think('El pasaje está muy oscuro. No veo nada.', 'Necesito luz.'); return; } if (!g.f.luzOn) { g.set('luzOn'); g.ui.toast('Linterna: encendida'); } if (!g.f.sombraVista) { g.set('sombraVista'); g.audio.voices(0.12); } await g.goTo('pasajeA'); } }, { label: 'Volver a la plaza', to: 'plaza1' }] },
  tienda: { cam: 'tienda', at: [16.6, -35.1], ry: 2.4, hs: ['radio', 'cajon', 'pilas', 'maquina', 'calendario', 'eco3'], exits: [{ label: 'Salir a la plaza', to: 'plaza1' }] },
  pasajeA: { cam: 'pasajeA', at: [-0.4, -54.2], ry: Math.PI, hs: ['mural_mano', 'mural_luna', 'mural_ojo', 'mural_boca'],
    exits: [{ label: 'Seguir adelante', act: async g => { if (g.f.chaseDone) await g.goTo('pasajeB'); else await g.chaseSeq(); } }, { label: 'Salir a la plaza', to: 'boca' }] },
  pasajeB: { cam: 'pasaje2', at: [0.2, -68.6], ry: Math.PI, hs: ['pared', 'informe'],
    exits: [{ label: 'Ir a la puerta', to: 'puerta' }, { label: 'Volver por el pasaje', to: 'pasajeA' }] },
  puerta: { cam: 'puerta', at: [1.3, -79.4], ry: Math.PI, hs: ['pedestal', 'placa', 'eco4'],
    exits: [{ label: 'Cruzar la puerta', if: f => f.puertaAbierta, act: async g => { g.ending(); } }, { label: 'Volver al pasaje', to: 'pasajeB' }] },
};

/* ---------- HotspotSystem: puntos activos sobre la imagen + barra de salidas ---------- */
class HotspotSystem {
  constructor(game) { this.game = game; this.layer = $('hs'); this.nav = $('nav'); this.items = []; this.hover = null; this.v = new THREE.Vector3(); this.sig = ''; }
  /** Crea los puntos del plano actual. */
  build() { const g = this.game, s = SCREENS[g.scr]; this.layer.innerHTML = ''; this.hover = null;
    this.items = s.hs.map(id => { const it = g.world.inter.find(i => i.id === id); const el = document.createElement('button'); el.className = 'hs' + (it.eco ? ' eco' : ''); el.dataset.id = id; el.setAttribute('aria-label', it.verb); el.innerHTML = '<i></i>';
      el.addEventListener('click', e => { e.stopPropagation(); if (g.canAct()) g.interact(it); }); el.addEventListener('pointerenter', () => { this.hover = it; }); el.addEventListener('pointerleave', () => { if (this.hover === it) this.hover = null; });
      this.layer.appendChild(el); return { it, el }; }); this.sig = ''; }
  exits() { const g = this.game; return SCREENS[g.scr].exits.filter(e => !e.if || e.if(g.f)); }
  update() { const g = this.game, on = g.canAct(), cam = g.cams.cam, W = window.innerWidth, H = window.innerHeight;
    for (const o of this.items) { const off = !on || o.it.hitbox.userData.off; this.v.copy(o.it.hitbox.position); if (o.it.gy != null) this.v.y = o.it.gy; this.v.project(cam);
      const vis = !off && this.v.z < 1; /* fuera del encuadre (pantalla vertical): se pega al borde */ if (vis) o.el.style.transform = `translate(${clamp((this.v.x + 1) / 2 * W, 28, W - 28).toFixed(1)}px,${clamp((1 - this.v.y) / 2 * H, 70, H - 130).toFixed(1)}px)`;
      if (o.vis !== vis) { o.vis = vis; o.el.classList.toggle('on', vis); } }
    const ex = this.exits(), sig = (on ? '1' : '0') + g.scr + ex.map(e => e.label).join('|');
    if (sig !== this.sig) { this.sig = sig; this.nav.classList.toggle('hidden', !on); this.nav.innerHTML = ex.map((e, i) => `<button class="nv" data-i="${i}">${esc(e.label)}</button>`).join('');
      this.nav.querySelectorAll('.nv').forEach(b => b.addEventListener('click', () => { const e = ex[+b.dataset.i]; if (!g.canAct()) return; g.audio.ui(); if (e.act) g.run(e.act); else g.goTo(e.to); })); }
    g.ui.prompt(on && this.hover && !this.hover.hitbox.userData.off ? this.hover.verb : null, false); }
}
