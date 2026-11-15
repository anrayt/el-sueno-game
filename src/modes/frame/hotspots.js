import * as THREE from 'three';
import { $, esc, clamp } from '../../shared/util.js';
import { SCREENS } from '../../shared/scenes.js';
/* ---------- HotspotSystem: puntos activos sobre la imagen + barra de salidas ---------- */
export class HotspotSystem {
  constructor(game) { this.game = game; this.layer = $('hs'); this.nav = $('nav'); this.items = []; this.hover = null; this.v = new THREE.Vector3(); this.sig = ''; }
  /** Crea los puntos del plano actual. */
  build() { const g = this.game, s = SCREENS[g.scr]; this.layer.innerHTML = ''; this.hover = null; this.sig = '';
    if (!s) { this.items = []; this.nav.classList.add('hidden'); this.nav.innerHTML = ''; return; }   // en la calle (modo normal) no hay puntos ni salidas
    this.items = s.hs.map(id => { const it = g.world.inter.find(i => i.id === id); const el = document.createElement('button'); el.className = 'hs' + (it.eco ? ' eco' : ''); el.dataset.id = id; el.setAttribute('aria-label', it.verb); el.innerHTML = '<i></i>';
      el.addEventListener('click', e => { e.stopPropagation(); if (g.canAct()) g.interact(it); }); el.addEventListener('pointerenter', () => { this.hover = it; }); el.addEventListener('pointerleave', () => { if (this.hover === it) this.hover = null; });
      this.layer.appendChild(el); return { it, el }; }); this.sig = ''; }
  /** Modo lectura: las salidas del plano. Modo normal: solo «Salir», que vuelve a la calle. */
  exits() { const g = this.game; return g.modo === 'lectura' ? SCREENS[g.scr].exits.filter(e => !e.if || e.if(g.f)) : [{ label: 'Salir', act: gg => gg.exitFrame() }]; }
  update() { const g = this.game; if (!g.scr) return; const on = g.canAct(), cam = g.cams.cam, W = window.innerWidth, H = window.innerHeight;
    for (const o of this.items) { const off = !on || o.it.hitbox.userData.off; this.v.copy(o.it.hitbox.position); if (o.it.gy != null) this.v.y = o.it.gy; this.v.project(cam);
      const vis = !off && this.v.z < 1; /* fuera del encuadre (pantalla vertical): se pega al borde */ if (vis) o.el.style.transform = `translate(${clamp((this.v.x + 1) / 2 * W, 28, W - 28).toFixed(1)}px,${clamp((1 - this.v.y) / 2 * H, 70, H - 130).toFixed(1)}px)`;
      if (o.vis !== vis) { o.vis = vis; o.el.classList.toggle('on', vis); } }
    const ex = this.exits(), sig = (on ? '1' : '0') + g.scr + ex.map(e => e.label).join('|');
    if (sig !== this.sig) { this.sig = sig; this.nav.classList.toggle('hidden', !on); this.nav.innerHTML = ex.map((e, i) => `<button class="nv" data-i="${i}">${esc(e.label)}</button>`).join('');
      this.nav.querySelectorAll('.nv').forEach(b => b.addEventListener('click', () => { const e = ex[+b.dataset.i]; if (!g.canAct()) return; g.audio.ui(); if (e.act) g.run(e.act); else g.run(gg => gg.goTo(e.to)); })); }
    g.ui.prompt(on && this.hover && !this.hover.hitbox.userData.off ? this.hover.verb : null, false); }
}
