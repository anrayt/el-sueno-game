import * as THREE from 'three';
import { PI } from './util.js';
import { buildHero, animateHero } from './characters.js';
import { zoneAt } from './world.js';
/* Player: posición, colisiones, marcha y linterna. El modelo está en characters.js. */
export class Player {
  constructor(world) {
    this.world = world; this.pos = new THREE.Vector3(0, 0, -1.6); this.ry = PI; this.zone = 'callejon'; this.phase = 0; this.moving = false; this.lie = 0;
    this.fwd = new THREE.Vector3(0, 0, -1); this.right = new THREE.Vector3(1, 0, 0); this.vel = new THREE.Vector3(); this.stepCb = null;
    buildHero(this, world); const g = this.g;
    // linterna: foco sujeto a la mano
    this.spot = new THREE.SpotLight(0xe8d090, 0, 17, 0.5, 0.6, 1.2); this.spot.position.set(0.25, 1.1, 0.2); this.spot.target.position.set(0.1, 0.6, 7); g.add(this.spot, this.spot.target); this.spot.layers.enableAll();
    world.scene.add(g);
  }
  place(x, z, ry) { this.pos.set(x, 0, z); if (ry != null) this.ry = ry; this.zone = zoneAt(x, z); this.sync(); }
  sync() { this.g.position.copy(this.pos); this.g.rotation.set(-this.lie * PI / 2, this.ry, 0, 'YXZ'); this.g.position.y = this.lie * 0.2; }
  /** inp: {x,y,run} relativo a la cámara, o {world:true,wx,wz,run} en coordenadas del mundo (ir a un punto).
      cm: CameraManager. La base de movimiento se congela al cambiar de cámara hasta soltar el control. */
  update(dt, inp, cm, canMove) {
    const mag = inp.world ? 1 : Math.hypot(inp.x, inp.y);
    if (mag < 0.12 || !canMove) cm.switched = false;
    if (!cm.switched) { cm.cam.getWorldDirection(this.fwd); this.fwd.y = 0; if (this.fwd.lengthSq() < 1e-4) this.fwd.set(0, 0, -1); this.fwd.normalize(); this.right.set(-this.fwd.z, 0, this.fwd.x); }
    this.moving = canMove && mag > 0.12; this.vel.set(0, 0, 0);
    if (this.moving) {
      const sp = (inp.run ? 4.4 : 2.1) * Math.min(1, mag); if (inp.world) this.vel.set(inp.wx, 0, inp.wz).normalize().multiplyScalar(sp); else this.vel.copy(this.right).multiplyScalar(inp.x / mag).addScaledVector(this.fwd, inp.y / mag).normalize().multiplyScalar(sp);
      this.move(this.vel.x * dt, this.vel.z * dt);
      const tr = Math.atan2(this.vel.x, this.vel.z); let da = tr - this.ry; da = Math.atan2(Math.sin(da), Math.cos(da)); this.ry += da * Math.min(1, dt * 11);
      const prev = this.phase; this.phase += dt * sp * 2.5; if (Math.floor(prev / PI) !== Math.floor(this.phase / PI) && this.stepCb) this.stepCb(inp.run);
    } else this.phase += (Math.round(this.phase / PI) * PI - this.phase) * Math.min(1, dt * 8);
    const a = Math.sin(this.phase) * (this.moving ? (inp.run ? 0.95 : 0.55) : 0.0); this.legL.rotation.x = a; this.legR.rotation.x = -a; this.armL.rotation.x = -a * 0.7; this.armR.rotation.x = this.spot.intensity > 0 ? -0.9 : a * 0.7;
    this.zone = zoneAt(this.pos.x, this.pos.z); this.sync(); this.g.position.y += Math.abs(Math.sin(this.phase)) * (this.moving ? 0.035 : 0);
    animateHero(this, dt);
  }
  move(dx, dz) { const r = 0.34, w = this.world; const hit = (x, z) => { for (const c of w.colliders) { if (c.on && !c.on()) continue; if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return true; } for (const c of w.circles) { if ((x - c.x) ** 2 + (z - c.z) ** 2 < (c.r + r) ** 2) return true; } return false; };
    if (!hit(this.pos.x + dx, this.pos.z)) this.pos.x += dx; if (!hit(this.pos.x, this.pos.z + dz)) this.pos.z += dz; }
}

