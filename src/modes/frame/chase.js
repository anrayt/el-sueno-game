/* ---------- Persecución del pasaje en el modo lectura ----------
   Tres momentos, cada uno con una elección contra el tiempo. */
export async function chaseSeq(g) { const w = g.world.d.watcher, p = g.player, ui = g.ui;
  const put = (pz, wz) => { p.place(0.25, pz, Math.PI); w.visible = true; w.position.set(-0.25, 0, wz); w.rotation.y = Math.PI; };
  const caught = async looked => { if (looked) { g.f.miraste = true; g.decide('En el pasaje, miras atrás.'); } g.audio.sting(); g.audio.wrong(); g.camShake(0.3); g.hold = 1; g.addCordura(-30); await ui.fade(true, '', 200); w.visible = false; g.cams.force = null; g.hold = 0; g.setScreen('boca'); await g.wait(1300); await ui.fade(false, '', 1500);
    await g.think('Estoy otra vez en la entrada del pasaje.', 'En el callejón había unas palabras en la pared...'); };
  await ui.fade(true, '', 260); put(-59, -52.6); g.cams.force = 'pasaje2'; g.hold = 0.6; g.audio.sting(); g.camShake(0.2); await ui.fade(false, '', 600);
  await g.think('Algo camina detrás de mí.', 'Oigo sus pasos. Son lentos.');
  for (let n = 0; ; n++) { const i = await g.choose('', ['Mirar atrás.', 'Seguir adelante.', 'Parar.'], 20); if (i === 1) break; if (i === 0) return caught(true);
    if (n) { await g.think('Una mano fría toca mi cuello.'); return caught(false); } w.position.z = -55.6; g.hold = 0.75; g.addCordura(-8); await g.think('Paro. Los pasos también paran.', 'Luego suenan otra vez. Más cerca.'); }
  put(-63.5, -59.4); g.hold = 0.8; g.audio.voices(0.16); await g.say('Una voz', 'Espera.', 'Soy yo, Anselmo. Mira aquí.');
  for (let n = 0; ; n++) { const i = await g.choose('', n ? ['Mirar.', 'No mirar. Seguir adelante.'] : ['Mirar.', 'No mirar. Seguir adelante.', '¿Anselmo?'], 20); if (i === 1) break; if (i === 0) return caught(true);
    if (n) { await g.think('No puedo moverme. Está detrás de mí.'); return caught(false); } w.position.z = -61.2; g.addCordura(-6); g.audio.voices(0.2); await g.think(i === 2 ? 'La voz ríe. No es Anselmo.' : 'No contesto. La voz está más cerca.', 'Anselmo no camina. Anselmo está en su banco.'); }
  put(-68.4, -66.3); g.hold = 1; g.camShake(0.15); await g.think('La luz roja está cerca.', 'Algo frío toca mi espalda.');
  const k = await g.choose('', ['Girar la cabeza.', 'Correr hacia la luz.', 'Cerrar los ojos y caminar.'], 15); if (k === 0) return caught(true); if (k < 0) { await g.think('No hago nada. Y eso también es una respuesta.'); return caught(false); }
  if (k === 2) { g.decide('En el pasaje, cierras los ojos, como Anselmo.'); await g.think('Cierro los ojos. Como Anselmo.', 'Si yo no lo miro, él no me ve.'); }
  w.visible = false; g.hold = 0; g.cams.force = null; g.set('chaseDone'); g.audio.metal(0.6, 0.2); g.setScreen('pasajeB'); await g.wait(700);
  await g.think('Ya no oigo nada detrás de mí.', g.f.miraste ? 'Antes lo miré. Y él me miró.' : 'No miré atrás. No sé qué era.'); if (!g.f.miraste) g.decide('En el pasaje, no miras atrás.'); g.arch('mira'); }
