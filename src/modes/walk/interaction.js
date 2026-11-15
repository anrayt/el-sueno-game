import * as THREE from 'three';
import { $ } from '../../shared/util.js';
/* ---------- InteractionSystem (calle): objeto más cercano, ratón y toque ----------
   Tocar o pulsar un objeto lejano lleva al protagonista hasta él; tocar el suelo, a ese punto. */
export class InteractionSystem {
  constructor(game) { this.game = game; this.near = null; this.ray = new THREE.Raycaster(); this.v = new THREE.Vector2(); this.hover = null; this.ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); this.pt = new THREE.Vector3(); }
  boxes() { return this.game.world.inter.map(i => i.hitbox); }
  clear() { this.near = null; this.hover = null; $('c').style.cursor = 'default'; }
  update() { const g = this.game, p = g.player.pos; let best = null, bd = 1e9;
    if (g.canAct()) for (const it of g.world.inter) { if (it.hitbox.userData.off || it.far) continue; const d = Math.hypot(p.x - it.x, p.z - it.z); if (d < it.r && d < bd) { bd = d; best = it; } }
    this.near = best; const show = best || (g.canAct() ? this.hover : null); g.ui.prompt(show ? show.verb : null, !!best); }
  pickAt(cx, cy) { const g = this.game; this.v.set(cx / window.innerWidth * 2 - 1, -(cy / window.innerHeight) * 2 + 1); this.ray.setFromCamera(this.v, g.cams.cam);
    const hits = this.ray.intersectObjects(this.boxes(), false); for (const h of hits) { if (!h.object.userData.off) return h.object.userData.inter; }
    // tolerancia para dedos: el objeto activo más cercano al toque (en píxeles)
    let best = null, bd = document.body.classList.contains('touch') ? 46 : 22; const v = this.v3 || (this.v3 = new THREE.Vector3());
    for (const it of g.world.inter) { if (it.hitbox.userData.off) continue; v.copy(it.hitbox.position).project(g.cams.cam); if (v.z > 1) continue; const d = Math.hypot((v.x + 1) / 2 * window.innerWidth - cx, (1 - v.y) / 2 * window.innerHeight - cy); if (d < bd) { bd = d; best = it; } }
    return best; }
  /** Punto del suelo bajo el puntero (pickAt deja el rayo preparado), o null si se toca el cielo o muy lejos. */
  groundAt() { const g = this.game, p = this.ray.ray.intersectPlane(this.ground, this.pt); if (!p) return null; const o = g.player.pos; return Math.hypot(p.x - o.x, p.z - o.z) < 45 ? p : null; }
  onMove(cx, cy) { const it = this.game.canAct() ? this.pickAt(cx, cy) : null; this.hover = it; $('c').style.cursor = it ? 'pointer' : 'default'; }
  onClick(cx, cy) { const g = this.game; if (!g.canMove()) return; const it = this.pickAt(cx, cy), p = g.player.pos;
    if (it && g.canAct()) { if (it.far || Math.hypot(p.x - it.x, p.z - it.z) < it.r) g.interact(it); else g.input.goTo(it.x, it.z, it); return; }
    const pt = this.groundAt(); if (pt) g.input.goTo(pt.x, pt.z, null); }
  act() { if (this.near) this.game.interact(this.near); }
}
