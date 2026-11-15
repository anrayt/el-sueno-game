import { $, esc, clamp } from '../../shared/util.js';
import { SAVE_KEYS, ZONES, ITEMS, DOCS, LEX, ARCHIVE, ECOS } from '../../shared/data.js';
import { AudioManager } from '../../shared/audio.js';
import { SceneManager, CameraManager, Gfx } from '../../shared/world.js';
import { Player } from '../../shared/player.js';
import { SaveManager, LanguageSystem, Inventory, LoreArchive, DialogueSystem, PuzzleSystem, UIManager } from '../../shared/systems.js';
import { SCRIPTS } from '../../shared/scripts.js';
import { SCREENS, HotspotSystem } from '../frame/screens.js';
/* Ayuda de controles de este modo (pausa). */
const HELP = 'Toca o pulsa los <b>círculos</b> para mirar, leer y hablar.<br>Las <b>flechas →</b> de abajo cambian de lugar.<br><b>E</b> o <b>Espacio</b> seguir · <b>1–9</b> elegir · <b>Tab</b> inventario<br><b>J</b> cuaderno · <b>F</b> linterna · <b>M</b> silencio · <b>Esc</b> pausa<br>Toca una palabra subrayada para ver qué significa.';

/* =====================================================================
   Game — estado, bucle principal, entrada, eventos del capítulo.
   ===================================================================== */
export let game = null;
export class Game {
  constructor() {
    this.save = new SaveManager({ key: SAVE_KEYS.quest, legacy: true, validScr: id => !!SCREENS[id] }); this.audio = new AudioManager(); const s = this.save.settings(); this.audio.vol = s.vol; this.audio.muted = !!s.muted; this.audio.voz = s.voz !== false;
    this.state = this.save.fresh(); this.f = this.state.flags; this.mode = 'title'; this.busy = false; this.chase = null; this.time = 0; this.keys = {}; this.joy = { x: 0, y: 0 }; this.runT = false;
    this.dread = 0; this.hold = 0; this.going = false; this.scr = 'callejon1'; this.lastZone = null; this.blockT = 0; this.autoT = 0; this.rise = false; this.pendingFaint = false;
  }
  boot() {
    game = this;
    this.lang = new LanguageSystem(this); this.inv = new Inventory(this); this.lore = new LoreArchive(this); this.ui = new UIManager(this, { help: HELP }); this.dlg = new DialogueSystem(this); this.puzzle = new PuzzleSystem(this);
    this.gfx = new Gfx($('c')); this.world = new SceneManager(this); this.world.build(); this.player = new Player(this.world); this.cams = new CameraManager(); this.hs = new HotspotSystem(this);
    this.player.stepCb = run => this.audio.step(this.player.zone === 'tienda' ? 'wood' : (this.player.zone === 'pasaje' || this.player.zone === 'puerta') ? 'stone' : 'wet', run);
    this.world.sync(this.f); this.world.snap(); this.cams.resize(this.gfx.resize()); this.bindInput(); this.ui.syncSound();
    const has = !!this.save.load(); $('tCont').classList.toggle('hidden', !has);
    $('tNote').innerHTML = 'Usa auriculares.<br>Aquí no se corre: se mira, se lee y se elige.<br>Todo lo que oyes y lees está en español.<span id="gira">Gira el teléfono: el sueño es más ancho que alto.</span>' + (this.save.ok ? '' : '<br>Este navegador no guarda la partida.');
    $('tCont').addEventListener('click', () => this.start(false));
    $('tNew').addEventListener('click', e => { if (has && !this._conf) { this._conf = true; e.target.textContent = '¿Borrar la partida guardada? Pulsa otra vez'; return; } this.start(true); });
    $('tSnd').addEventListener('click', () => { this.setMuted(!this.audio.muted); this.ui.syncSound(); });
    $('endBack').addEventListener('click', () => location.reload());
    this.last = performance.now(); const loop = now => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; try { this.update(dt); } catch (e) { if (!this._err) { this._err = true; console.error(e); } } }; requestAnimationFrame(loop);
  }
  start(isNew) {
    this.audio.init(); let st = isNew ? null : this.save.load(); if (isNew) this.save.clear(); if (!st) { st = this.save.fresh(); isNew = true; }
    this.state = st; this.f = st.flags; this.setScreen(st.scr); this.sync(); this.world.snap(); this.lastZone = this.player.zone;
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden');
    this.mode = 'play'; this.gfx.u.dark.value = 0;
    if (isNew) this.run(async g => { g.player.lie = 1; g.player.sync(); await g.ui.fade(true, '', 0); await g.wait(500); await g.ui.fadeText('No recuerdas tu nombre.'); await g.wait(1600); await g.ui.fadeText('Abres los ojos.'); await g.wait(1400);
      await g.ui.fade(false, '', 2600); g.rise = true; await g.wait(2300); await g.think('Hace frío. Hay mucha niebla.', '¿Dónde estoy?'); g.ui.zone(ZONES.callejon); });
    else { this.ui.fade(true, '', 0).then(() => this.ui.fade(false, '', 1500)); this.ui.zone(ZONES[this.player.zone]); }
  }
  /* ---- estado ---- */
  set(flag, v = true) { this.f[flag] = v; this.sync(); this.saveSoon(); }
  sync() { this.world.sync(this.f); this.player.spot.intensity = this.f.luz && this.f.luzOn ? 1.9 : 0; }
  decide(t) { if (!this.state.decisions.includes(t)) this.state.decisions.push(t); }
  arch(id) { this.lore.unlock(id); }
  give(id) { if (this.inv.add(id)) return true; this.ui.toast('No tengo más espacio'); return false; }
  logLine(w, t) { this.state.log.push({ w, t }); if (this.state.log.length > 60) this.state.log.shift(); }
  addCordura(d) { this.state.cordura = clamp(this.state.cordura + d, 0, 100); if (d < 0) this.dread = Math.max(this.dread, 0.45); if (this.state.cordura <= 0) this.pendingFaint = true; }
  camShake(v) { this.cams.shake = Math.max(this.cams.shake, v); }
  ringing() { const f = this.f; return !!((f.plazaVisitada && !f.llamada1) || (f.puertaAbierta && !f.llamada2)); }
  ecoOn(id) { return !!ECOS[id].need(this.f) && !this.state.ecos.includes(id); }
  canAct() { return this.mode === 'play' && !this.busy && !this.going && !this.ui.modal && !this.dlg.active; }
  /** Cambia de plano sin transición. */
  setScreen(id) { const s = SCREENS[id] || SCREENS.callejon1; this.scr = SCREENS[id] ? id : 'callejon1'; this.state.scr = this.scr; this.player.place(s.at[0], s.at[1], s.ry); this.cams.base = s.cam; this.hs.build(); }
  /** Cambia de plano con fundido y pasos. */
  async goTo(id) { if (this.going) return; this.going = true; const surf = this.player.zone === 'tienda' ? 'wood' : (this.player.zone === 'pasaje' || this.player.zone === 'puerta') ? 'stone' : 'wet'; [0, 190, 380, 570].forEach(t => setTimeout(() => this.audio.step(surf, false), t));
    await this.ui.fade(true, '', 330); this.setScreen(id); await this.wait(240); await this.ui.fade(false, '', 480); this.going = false; this.saveSoon(); }
  saveNow() { if (this.mode === 'title') return; const p = this.player; this.state.pos = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), ry: +p.ry.toFixed(2) }; this.state.scr = this.scr; this.save.save(this.state); }
  saveSoon() { clearTimeout(this._st); this._st = setTimeout(() => this.saveNow(), 400); }
  saveSettings() { this.save.saveSettings({ vol: this.audio.vol, muted: this.audio.muted, voz: this.audio.voz }); }
  setMuted(m) { this.audio.setMuted(m); this.saveSettings(); this.ui.toast(m ? 'Sonido: no' : 'Sonido: sí'); }
  /* ---- ayudas para los guiones ---- */
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  async think(...l) { for (const t of l) await this.dlg.line('', t, 'pienso'); }
  async say(who, ...l) { for (const t of l) await this.dlg.line(who, t, ''); }
  async voz(...l) { for (const t of l) { this.audio.speak(t); await this.dlg.line('Voz', t, 'voz'); } this.audio.hush(); }
  choose(q, o, secs) { return this.dlg.choose(q, o, secs); }
  async doc(id) { const st = this.state; if (!st.docs.includes(id)) { st.docs.push(id); this.ui.toast(`Cuaderno: <i>${esc(DOCS[id].title)}</i>`); } const fresh = this.lang.learn(DOCS[id].text(this.f)); if (fresh.length) this.ui.toast(`Palabras nuevas: <i>${fresh.length}</i>`); this.set('doc_' + id); await this.ui.showDoc(id); }
  async run(fn, it) { if (this.busy) return; this.busy = true; try { await fn(this, it); } catch (e) { console.error('guion', e); } finally { this.busy = false; this.dlg.hide(); this.saveSoon(); } }
  interact(it) { const fn = SCRIPTS[it.id]; if (fn && this.canAct()) { const p = this.player; if (!it.far && !it.eco) p.ry = Math.atan2(it.hitbox.position.x - p.pos.x, it.hitbox.position.z - p.pos.z); this.run(fn, it); } }
  useItem(id) { if (!this.inv.has(id) || this.busy) return; const near = n => { const it = this.world.inter.find(i => i.id === n); return it && !it.hitbox.userData.off && SCREENS[this.scr].hs.includes(n) ? it : null; };
    this.run(async g => {
      if (id === 'linterna') await g.think('No funciona. Necesita pilas.'); else if (id === 'pilas') await g.think('Son para la linterna. Puedo combinar las dos cosas.');
      else if (id === 'linterna_ok') { g.set('luzOn', !g.f.luzOn); g.audio.ui(); g.ui.toast(g.f.luzOn ? 'Linterna: encendida' : 'Linterna: apagada'); }
      else if (id === 'moneda') { if (near('maquina')) await SCRIPTS.maquina(g); else await g.think('Aquí no sirve.'); }
      else if (id === 'llave') { if (near('cajon')) await SCRIPTS.cajon(g); else await g.think('Aquí no hay nada para abrir.'); }
      else if (id === 'foto') { if (near('anselmo')) await SCRIPTS.anselmo(g); else await g.think('Siete personas con los ojos cerrados. Y un médico.', '¿Quién hizo la foto?'); }
      else if (ITEMS[id].drink) { if (id === 'naranja' && g.f.anselmoSed && !g.f.tieneLlave) { if (near('anselmo')) await SCRIPTS.anselmo(g); else await g.think('No. Es para Anselmo.'); } else { g.inv.remove(id); g.audio.fizz(); g.addCordura(12); await g.think(id === 'cafe' ? 'Bebo el café. Está caliente. Estoy un poco mejor.' : 'Bebo. Está frío. Estoy un poco mejor.'); } }
    });
  }
  togglePause() { const u = this.ui; if (u.modal === 'pause') { u.modal = null; $('pause').classList.add('hidden'); return; } if (u.modal || (this.mode !== 'play')) return; u.modal = 'pause'; u.syncSound(); $('pause').classList.remove('hidden'); this.saveNow(); }

  /* ---- sucesos ---- */
  async openGate() { const g = this; g.cams.force = 'verja'; g.audio.gateOpen(); g.set('puertaAbierta'); g.camShake(0.3); g.decide('Abres la puerta del norte.'); await g.wait(5400);
    await g.think('La puerta se abre.', 'Detrás hay una calle. La niebla es roja.', 'Hay un edificio muy grande. En todas las ventanas hay luz.'); g.cams.force = null; g.arch('simbolos'); }
  /** La persecución del pasaje: tres momentos, cada uno con una elección contra el tiempo. */
  async chaseSeq() { const g = this, w = g.world.d.watcher, p = g.player, ui = g.ui;
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
  faint() { this.pendingFaint = false; this.decide('El miedo te duerme una vez.'); this.run(async g => { g.audio.sting(); await g.ui.fade(true, '', 900); await g.ui.fadeText('Todo está oscuro.'); await g.wait(1500); g.state.cordura = 60; g.hold = 0; g.cams.force = null; g.world.d.watcher.visible = false; g.setScreen('callejon1'); g.player.lie = 1; g.player.sync(); await g.ui.fadeText('Abres los ojos. Otra vez.'); await g.wait(1300); await g.ui.fade(false, '', 2200); g.rise = true; await g.wait(2000); await g.think('El callejón. Otra vez.'); }); }
  async ending() { this.mode = 'end'; this.dlg.hide(); const ui = this.ui; await ui.fade(true, '', 2600);
    for (const t of ['Cruzas la puerta.', 'Delante de ti hay un hospital.\nEn todas las ventanas hay luz.', 'En tu brazo hay una pulsera.\nAntes no estaba.', 'PACIENTE 7', 'Una voz dice:\n«Bienvenido a casa.»']) { this.lang.learn(t); await ui.fadeText(t); await this.wait(2500); }
    await ui.fadeText(''); this.arch('tu'); this.arch('ideas'); this.f.fin = true; this.setScreen('puerta'); this.saveNow(); const st = this.state, m = Math.floor(st.time / 60), s = Math.floor(st.time % 60);
    ui.showEnd([['Tiempo en el sueño', `${m} min ${s < 10 ? '0' : ''}${s} s`], ['Palabras que entiendes', `${st.words.length} / ${LEX.length}`], ['Documentos', `${st.docs.length} / ${Object.keys(DOCS).length}`], ['Fragmentos del archivo', `${st.archive.length} / ${Object.keys(ARCHIVE).length}`], ['Ecos', `${st.ecos.length} / ${Object.keys(ECOS).length}`], ['¿Miraste atrás?', this.f.miraste ? 'Sí' : 'No'], ['Intentos en la puerta', String(st.tries + 1)]]); }

  /* ---- bucle ---- */
  update(dt) {
    this.time += dt; const p = this.player, f = this.f, frozen = !!this.ui.modal || this.mode !== 'play';
    if (!frozen) {
      if (this.rise) { p.lie = Math.max(0, p.lie - dt / 2); if (p.lie === 0) this.rise = false; }
      p.update(dt, { x: 0, y: 0, run: false }, this.cams, false);
      this.state.time += dt; this.events();
      this.dread = Math.max(0, this.dread - dt * 0.22);
      if (!this.hold && this.state.cordura < 80) this.state.cordura = Math.min(80, this.state.cordura + dt * 0.7);
      if (this.pendingFaint && !this.busy) this.faint();
      this.autoT += dt; if (this.autoT > 15 && this.canAct()) { this.autoT = 0; this.saveNow(); }
      if (this.world.d.watcher.visible) { const w = this.world.d.watcher, u = w.userData; w.position.y = Math.abs(Math.sin(this.time * 7)) * 0.04; u.armL.rotation.x = Math.sin(this.time * 4) * 0.4; u.armR.rotation.x = -Math.sin(this.time * 4) * 0.4; u.head.rotation.z = Math.sin(this.time * 11) * 0.3; }
    }
    this.cams.update(dt, p, this.time); this.world.update(dt, this.time, p, f); this.hs.update();
    const threat = Math.max(this.dread, this.hold), z = p.zone, D = (a, b) => Math.hypot(p.pos.x - a, p.pos.z - b);
    const hum = Math.max(0, 1 - Math.min(D(-2, -14.5), D(0, -35), D(8.5, -43.5), D(18, -34), D(21.4, -38)) / 8);
    this.audio.update(dt, { zone: z, threat, hum, radio: z === 'tienda' ? clamp(1 - D(17.9, -37) / 11, 0.12, 1) : 0, ring: this.ringing() && this.mode === 'play' ? (z === 'tienda' ? 0.25 : clamp(1 - D(8.5, -43.5) / 45, 0.12, 1)) : 0, red: !!f.puertaAbierta });
    const u = this.gfx.u; u.fear.value += (Math.max(threat, (1 - this.state.cordura / 100) * 0.45) - u.fear.value) * Math.min(1, dt * 3); u.red.value = this.world.d.hospV || 0;
    this.ui.estado(this.state.cordura, threat); this.gfx.render(this.world.scene, this.cams.cam, this.time);
  }
  /** Sucesos al llegar a una zona por primera vez. */
  events() { const p = this.player, f = this.f, z = p.zone;
    if (z !== this.lastZone && !this.busy && !this.going) { this.lastZone = z; this.ui.zone(ZONES[z]); this.saveSoon();
      if (!f['v_' + z]) { this.set('v_' + z); const first = { plaza: ['Una plaza. No hay nadie.', 'Un teléfono suena.'], tienda: ['Una tienda pequeña. Hay luz.', 'La radio funciona. Nadie la escucha.'], pasaje: ['Hay dibujos rojos en las paredes.'], puerta: ['Una puerta de hierro muy grande.', 'En el centro hay un ojo cerrado.'] }[z];
        if (z === 'plaza') this.set('plazaVisitada'); if (first) this.run(g => g.think(...first)); } }
  }

  /* ---- entrada: teclado, ratón, táctil ---- */
  bindInput() { const c = $('c'), ui = this.ui, dlg = this.dlg; const ACT = { KeyE: 1, Enter: 1, Space: 1 };
    window.addEventListener('keydown', e => { if (e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); if (this.mode !== 'play' || e.repeat) return; this.audio.init();
      if (e.code === 'Escape') { if (ui.modal === 'book') ui.closeBook(); else if (ui.modal === 'doc') ui.closeDoc(); else if (ui.modal === 'puzzle') this.puzzle.close(false); else this.togglePause(); return; }
      if (ui.modal === 'doc') { if (ACT[e.code]) ui.closeDoc(); return; } if (ui.modal === 'book') { if (e.code === 'Tab' || e.code === 'KeyJ') ui.closeBook(); return; } if (ui.modal) return;
      if (dlg.choice) { if (e.code === 'ArrowUp' || e.code === 'KeyW') dlg.nav(-1); else if (e.code === 'ArrowDown' || e.code === 'KeyS') dlg.nav(1); else if (ACT[e.code]) dlg.advance(); else if (/^Digit[1-9]$/.test(e.code)) dlg.pick(+e.code.slice(5) - 1); return; }
      if (dlg.resolve) { if (ACT[e.code]) dlg.advance(); return; }
      if (e.code === 'KeyM') { this.setMuted(!this.audio.muted); return; }
      if (!this.canAct()) return;
      if (e.code === 'Tab') ui.openBook(0); else if (e.code === 'KeyJ') ui.openBook(1); else if (e.code === 'KeyF' && this.inv.has('linterna_ok')) this.useItem('linterna_ok'); });
    c.addEventListener('pointerdown', () => { this.audio.init(); if (this.mode === 'play' && dlg.resolve) dlg.advance(); });
    window.addEventListener('touchstart', () => document.body.classList.add('touch'), { passive: true });
    document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.pbody,#docBody,.scroll,input')) e.preventDefault(); }, { passive: false });
    ['gesturestart', 'dblclick', 'contextmenu'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
    const rs = () => this.cams.resize(this.gfx.resize()); window.addEventListener('resize', rs); window.addEventListener('orientationchange', () => setTimeout(rs, 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.saveNow(); this.audio.suspend(true); } else this.audio.suspend(false); });
    window.addEventListener('pagehide', () => this.saveNow());
  }
}
