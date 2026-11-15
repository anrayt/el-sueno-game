import * as THREE from 'three';
import { $, clamp, PI } from '../../shared/util.js';
/* ---------- WalkInput: entrada de la calle ----------
   Teclado (WASD/flechas), joystick en pantalla (opcional) e «ir a un punto»:
   un toque o clic en el suelo o en un objeto lleva al protagonista hasta allí,
   rodeando los obstáculos de forma sencilla. */
export class WalkInput {
  constructor(game) { this.game = game; this.keys = {}; this.joy = { x: 0, y: 0 }; this.runT = false; this.dest = null;
    const m = this.mark = new THREE.Mesh(new THREE.RingGeometry(0.15, 0.22, 20), new THREE.MeshBasicMaterial({ color: 0xd8c890, transparent: true, opacity: 0.75, depthWrite: false, fog: false })); m.rotation.x = -PI / 2; m.visible = false; game.world.scene.add(m); }
  /** Ir andando al punto (x, z); si hay objeto (it), usarlo al llegar. */
  goTo(x, z, it) { const p = this.game.player.pos; this.dest = { x, z, it, t: 0, chk: 0, px: p.x, pz: p.z, stuck: 0, det: 0, side: 1 }; this.mark.position.set(x, 0.03, z); this.mark.visible = !it; }
  stop() { this.dest = null; this.mark.visible = false; }
  /** Entrada de este fotograma para Player.update. */
  read(dt) { const g = this.game, k = this.keys, zero = { x: 0, y: 0, run: false };
    const x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + this.joy.x, y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + this.joy.y;
    if (Math.hypot(x, y) > 0.12) { this.stop(); return { x: clamp(x, -1, 1), y: clamp(y, -1, 1), run: !!(k.ShiftLeft || k.ShiftRight || this.runT) }; }
    const d = this.dest; if (!d) return zero; if (!g.canMove()) { this.stop(); return zero; }
    const p = g.player.pos, dx = d.x - p.x, dz = d.z - p.z, dist = Math.hypot(dx, dz);
    if (dist < (d.it ? Math.max(0.5, d.it.r * 0.8) : 0.22)) { const it = d.it; this.stop(); if (it && g.canAct() && !it.hitbox.userData.off) g.interact(it); return zero; }
    // ¿avanza? Si no, rodea: gira a un lado un momento, luego al otro, cada vez más tiempo
    d.t += dt; d.chk += dt; if (d.chk > 0.35) { const moved = Math.hypot(p.x - d.px, p.z - d.pz); d.chk = 0; d.px = p.x; d.pz = p.z; if (moved < 0.2 && d.det <= 0) { d.stuck++; d.side = d.stuck % 2 ? 1 : -1; d.det = 0.5 + 0.35 * d.stuck; } }
    if (d.stuck > 6 || d.t > 30) { this.stop(); return zero; }
    let a = Math.atan2(dx, dz); if (d.det > 0) { d.det -= dt; a += d.side * 1.25; }
    this.mark.scale.setScalar(1 + Math.sin(g.time * 6) * 0.12);
    return { world: true, wx: Math.sin(a), wz: Math.cos(a), run: this.runT }; }
  bind() { const g = this.game;
    window.addEventListener('keyup', e => { this.keys[e.code] = false; }); window.addEventListener('blur', () => { this.keys = {}; });
    const joy = $('joy'), knob = $('joyK'); let jid = null; const jmove = e => { const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), R = r.width / 2 - 14; if (m > R) { dx *= R / m; dy *= R / m; } knob.style.transform = `translate(${dx}px,${dy}px)`; this.joy.x = dx / R; this.joy.y = -dy / R; };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (_) {} jmove(e); g.audio.init(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jend = e => { if (e.pointerId !== jid) return; jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; }; joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    $('btnA').addEventListener('pointerdown', e => { e.preventDefault(); g.audio.init(); if (g.ui.modal === 'doc') g.ui.closeDoc(); else if (g.dlg.active) g.dlg.advance(); else if (g.canAct() && !g.scr) g.inter.act(); });
    $('btnR').addEventListener('pointerdown', e => { e.preventDefault(); this.runT = !this.runT; $('btnR').classList.toggle('on', this.runT); });
  }
}
