/* ---------- Persecución del pasaje en tiempo real (modo normal) ----------
   «No mires atrás»: caminar hacia el sur (hacia él) es mirarlo. Hay que llegar al final del pasaje. */
export function startChase(g) { const p = g.player, w = g.world.d.watcher; g.chase = { back: 0, looked: false, t: 0 }; g.input.stop(); w.visible = true; w.position.set(0, 0, Math.min(p.pos.z + 8.5, -50.5)); g.audio.sting(); g.cams.force = 'pasaje2'; g.camShake(0.2); g.dlg.hide(); }
export function endChase(g) { g.chase = null; g.world.d.watcher.visible = false; g.cams.force = null; }
export function updateChase(g, dt) { const c = g.chase, p = g.player, w = g.world.d.watcher; c.t += dt;
  if (p.moving && p.vel.z > 0.7) c.back += dt; else c.back = Math.max(0, c.back - dt * 2);
  if (c.back > 0.3 && !c.looked) { c.looked = true; g.f.miraste = true; g.decide('En el pasaje, miras atrás.'); g.audio.wrong(); g.camShake(0.25); }
  const sp = c.looked ? 6.2 : p.moving ? 1.7 : 2.6; const dx = p.pos.x - w.position.x, dz = p.pos.z - w.position.z, d = Math.hypot(dx, dz) || 1;
  w.position.x += dx / d * sp * dt; w.position.z += dz / d * sp * dt; w.rotation.y = Math.atan2(dx, dz); w.position.y = Math.abs(Math.sin(c.t * 9)) * 0.05; const u = w.userData; u.armL.rotation.x = Math.sin(c.t * 5) * 0.5; u.armR.rotation.x = -Math.sin(c.t * 5) * 0.5; u.head.rotation.z = Math.sin(c.t * 13) * 0.3;
  c.dist = d; if (c.looked) g.addCordura(-14 * dt);
  if (d < 0.95) { endChase(g); g.run(async g => { g.audio.sting(); g.addCordura(-30); await g.ui.fade(true, '', 180); g.player.place(0, -50.2, Math.PI); await g.wait(1300); await g.ui.fade(false, '', 1600); await g.think('Estoy otra vez en la entrada del pasaje.', 'En el callejón había unas palabras en la pared...'); }); }
  else if (p.pos.z < -73.4) { endChase(g); g.set('chaseDone'); g.audio.metal(0.6, 0.2); g.run(async g => { await g.wait(700); await g.think('Ya no oigo nada detrás de mí.', g.f.miraste ? 'Antes lo miré. Y él me miró.' : 'No miré atrás. No sé qué era.'); if (!g.f.miraste) g.decide('En el pasaje, no miras atrás.'); g.arch('mira'); }); }
}
