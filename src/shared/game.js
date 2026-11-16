import { $, esc, clamp } from './util.js';
import { SAVE_KEYS, LEGACY_SAVE_KEY, ZONES, ITEMS, DOCS, LEX, ARCHIVE, ECOS } from './data.js';
import { AudioManager } from './audio.js';
import { SceneManager, CameraManager, Gfx } from './world.js';
import { Player } from './player.js';
import { SaveManager, LanguageSystem, Inventory, LoreArchive, DialogueSystem, PuzzleSystem, UIManager } from './systems.js';
import { SCRIPTS } from './scripts.js';
import { SCREENS, frameOf, screenAt } from './scenes.js';
import { HotspotSystem } from '../modes/frame/hotspots.js';
import { chaseSeq } from '../modes/frame/chase.js';
import { InteractionSystem } from '../modes/walk/interaction.js';
import { dreamUpdate } from './characters.js';
import { WalkInput } from '../modes/walk/input.js';
import { startChase, endChase, updateChase } from '../modes/walk/chase.js';

/* Ayuda de controles (pausa): depende del modo. */
const HELP_WALK = '<b>W A S D</b> o <b>← ↑ ↓ →</b> caminar · <b>Mayús</b> correr<br>Toca el suelo o haz clic en él para ir a un lugar.<br>Dentro de un lugar, toca los <b>círculos</b> o haz clic en ellos. <b>→ Salir</b> vuelve a la calle.<br>';
const HELP_FRAME = 'Toca los <b>círculos</b> o haz clic en ellos para mirar, leer y hablar.<br>Las <b>flechas →</b> de abajo te llevan a otro lugar.<br>';
const HELP_COMMON = '<b>E</b> o <b>Espacio</b> acción y seguir · <b>1–9</b> elegir · <b>Tab</b> inventario<br><b>J</b> cuaderno · <b>F</b> linterna · <b>M</b> silencio · <b>Esc</b> pausa<br>Toca una palabra subrayada para ver qué significa.';

/* =====================================================================
   Game — estado, bucle principal, entrada, eventos del capítulo.
   Un solo juego con dos formas de estar en una escena:
     · en la calle se camina (this.scr === null): WalkInput + InteractionSystem;
     · en un plano fijo (this.scr = id de SCREENS): HotspotSystem.
   Modo normal: calles andando, interiores y conversaciones en planos fijos.
   Modo lectura: todo en planos fijos, sin caminar (ajuste del jugador).
   ===================================================================== */
export let game = null;
export class Game {
  constructor() {
    this.save = new SaveManager({ key: SAVE_KEYS.hybrid, from: [SAVE_KEYS.quest, LEGACY_SAVE_KEY, SAVE_KEYS.walk], validScr: id => !!SCREENS[id] }); this.audio = new AudioManager();
    const s = this.save.settings(); this.audio.vol = s.vol; this.audio.muted = !!s.muted; this.audio.voz = s.voz !== false; this.modo = s.modo === 'lectura' ? 'lectura' : 'normal'; this.joyOn = !!s.joy; this.sueno = s.sueno !== false;
    this.state = this.save.fresh(); this.f = this.state.flags; this.mode = 'title'; this.busy = false; this.chase = null; this.time = 0;
    this.dread = 0; this.hold = 0; this.going = false; this.scr = null; this.lastZone = null; this.blockT = 0; this.autoT = 0; this.rise = false; this.pendingFaint = false;
  }
  boot() {
    game = this;
    this.lang = new LanguageSystem(this); this.inv = new Inventory(this); this.lore = new LoreArchive(this); this.ui = new UIManager(this, { badge: true }); this.dlg = new DialogueSystem(this); this.puzzle = new PuzzleSystem(this);
    this.gfx = new Gfx($('c')); this.gfx.dream = this.sueno; this.world = new SceneManager(this); this.world.build(); this.player = new Player(this.world); this.cams = new CameraManager();
    this.hs = new HotspotSystem(this); this.inter = new InteractionSystem(this); this.input = new WalkInput(this);
    this.gfx.chars = [this.player.g, this.world.d.anselmo, this.world.d.watcher, this.world.d.sombra];   // para el efecto de sueño
    this.player.stepCb = run => this.audio.step(this.surface(), run);
    this.world.sync(this.f); this.world.snap(); this.cams.resize(this.gfx.resize()); this.bindInput(); this.ui.syncSound(); this.syncOptions();
    const has = !!this.save.load(); $('tCont').classList.toggle('hidden', !has);
    $('tNote').innerHTML = 'Usa auriculares.<br>Todo lo que oyes y lees aquí está en español.<span id="gira">Gira el móvil: el sueño es más ancho que alto.</span>' + (this.save.ok ? '' : '<br>Este navegador no guarda la partida.');
    $('tCont').addEventListener('click', () => this.start(false));
    $('tNew').addEventListener('click', e => { if (has && !this._conf) { this._conf = true; e.target.textContent = '¿Borrar la partida guardada? Pulsa otra vez'; return; } this.start(true); });
    $('tSnd').addEventListener('click', () => { this.setMuted(!this.audio.muted); this.ui.syncSound(); });
    $('tModo').addEventListener('click', () => this.toggleModo());
    $('endBack').addEventListener('click', () => location.reload());
    this.last = performance.now(); const loop = now => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; try { this.update(dt); } catch (e) { if (!this._err) { this._err = true; console.error(e); } } }; requestAnimationFrame(loop);
  }
  start(isNew) {
    this.audio.init(); let st = isNew ? null : this.save.load(); if (isNew) this.save.clear(); if (!st) { st = this.save.fresh(); isNew = true; }
    this.state = st; this.f = st.flags; if (st.pos.z < -85.5) { st.pos.x = 0; st.pos.z = -80; }
    // partida guardada en mitad de la persecución: se vuelve a la entrada del pasaje (la persecución no se puede saltar)
    if (!st.scr && !st.flags.chaseDone && st.pos.x < 13 && st.pos.z < -57) st.pos = { x: 0, z: -50.2, ry: Math.PI };
    this.mode = 'play'; if (st.scr) this.setScreen(st.scr); else this.toStreet(st.pos);
    this.applyModo(); this.sync(); this.world.snap(); this.lastZone = this.player.zone;
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); this.syncHud(); this.gfx.u.dark.value = 0; if (isNew) this.saveNow();
    if (isNew) this.run(async g => { g.player.lie = 1; g.player.sync(); await g.ui.fade(true, '', 0); await g.wait(500); await g.ui.fadeText('No recuerdas tu nombre.'); await g.wait(1600); await g.ui.fadeText('Abres los ojos.'); await g.wait(1400);
      await g.ui.fade(false, '', 2600); g.rise = true; await g.wait(2300); await g.think('Hace frío. Hay mucha niebla.', '¿Dónde estoy?'); g.ui.zone(ZONES.callejon); });
    else { this.going = true; this.ui.fade(true, '', 0).then(() => this.ui.fade(false, '', 1500)).then(() => { this.going = false; }); this.ui.zone(ZONES[this.player.zone]); }
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
  /** Se puede actuar (usar objetos, abrir el cuaderno). */
  canAct() { return this.canMove() && !this.chase; }
  /** Se puede caminar: también durante la persecución. */
  canMove() { return this.mode === 'play' && !this.busy && !this.going && !this.ui.modal && !this.dlg.active; }
  surface() { const z = this.player.zone; return z === 'tienda' ? 'wood' : (z === 'pasaje' || z === 'puerta') ? 'stone' : 'wet'; }

  /* ---- escenas: calle (se camina) y planos fijos ---- */
  /** Pone un plano fijo sin transición. */
  setScreen(id) { if (!SCREENS[id]) id = 'callejon1'; const s = SCREENS[id]; this.scr = id; this.state.scr = id; this.player.place(s.at[0], s.at[1], s.ry); this.cams.base = s.cam; this.hs.build(); this.syncHud(); }
  /** Pone al protagonista en la calle, sin transición. pt: {x, z, ry}. */
  toStreet(pt) { this.scr = null; this.state.scr = null; this.state.ret = null; this.cams.base = null; this.player.place(pt.x, pt.z, pt.ry); this.hs.build(); this.syncHud(); }
  /** Cambia de plano con fundido y pasos. */
  async goTo(id) { if (this.going) return; this.going = true; this.steps(); await this.ui.fade(true, '', 330); this.setScreen(id); await this.wait(240); await this.ui.fade(false, '', 480); this.going = false; this.saveSoon(); }
  steps() { const surf = this.surface(); [0, 190, 380, 570].forEach(t => setTimeout(() => this.audio.step(surf, false), t)); }
  /** Modo normal: de la calle a un plano fijo. Se recuerda el punto de la calle para volver. ret: punto de vuelta distinto del actual. */
  async enterFrame(id, ret) { if (this.scr === id) return; const p = this.player; ret = ret || { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), ry: +p.ry.toFixed(2) }; this.state.ret = ret; await this.goTo(id); }
  /** Modo normal: «Salir» — del plano fijo a la calle, al punto desde donde se entró. */
  async exitFrame() { if (!this.scr || this.going) return; this.going = true; const s = SCREENS[this.scr], r = this.state.ret || { x: s.out[0], z: s.out[1], ry: s.out[2] }; this.steps();
    await this.ui.fade(true, '', 330); this.toStreet(r); await this.wait(240); await this.ui.fade(false, '', 480); this.going = false; this.saveSoon(); }
  /** Pone la partida de acuerdo con el modo elegido (al empezar, al cargar y al cambiar el ajuste). */
  applyModo() { const p = this.player, s = SCREENS[this.scr];
    if (this.modo === 'lectura') { if (!this.scr) { let id = screenAt(p.pos.x, p.pos.z); if (!this.f.chaseDone && (id === 'pasajeB' || id === 'puerta')) id = 'pasajeA'; this.setScreen(id); } else if (s.soloNormal) this.setScreen('puerta'); this.state.ret = null; }
    else if (this.scr) { if (s.mode === 'walk') this.toStreet({ x: s.at[0], z: s.at[1], ry: s.ry }); else if (!this.state.ret) this.state.ret = { x: s.out[0], z: s.out[1], ry: s.out[2] }; }
    this.lastZone = this.player.zone; this.syncHud(); }
  toggleModo() { if (this.mode === 'play' && (this.busy || this.going || this.chase)) { this.ui.toast('Ahora no puedes cambiar el modo.'); return; }
    this.modo = this.modo === 'lectura' ? 'normal' : 'lectura'; this.saveSettings(); this.syncOptions(); if (this.mode === 'play') { this.applyModo(); this.saveNow(); }
    this.ui.toast(this.modo === 'lectura' ? 'Modo lectura: no caminas. Miras, lees y eliges.' : 'Modo normal: caminas por las calles.'); }
  /** Efecto de sueño en los personajes (ajuste; por defecto sí). */
  setSueno(on) { this.sueno = !!on; this.gfx.dream = this.sueno; this.saveSettings(); this.syncOptions(); }
  toggleJoy() { this.joyOn = !this.joyOn; this.saveSettings(); this.syncOptions(); this.syncHud(); }
  /** Textos de los ajustes (pausa y título). */
  syncOptions() { const m = this.modo === 'lectura' ? 'Modo: lectura' : 'Modo: normal'; $('modoB').textContent = m; $('tModo').textContent = m; $('joyB').textContent = this.joyOn ? 'Mando en pantalla: sí' : 'Mando en pantalla: no'; $('suenoB').textContent = this.sueno ? 'Efecto de sueño: sí' : 'Efecto de sueño: no';
    $('keysHelp').innerHTML = (this.modo === 'lectura' ? HELP_FRAME : HELP_WALK) + HELP_COMMON; }
  /** Controles en pantalla según la escena: el joystick solo en la calle, en táctil y si está activado. */
  syncHud() { const walk = !this.scr; $('touch').classList.toggle('hidden', !(walk && this.joyOn && this.mode === 'play' && document.body.classList.contains('touch')));
    document.body.classList.toggle('joy', walk && this.joyOn); if (!walk && this.input) { this.input.release(); this.inter.clear(); } }
  saveNow() { if (this.mode === 'title') return; const p = this.player; this.state.pos = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), ry: +p.ry.toFixed(2) }; this.state.scr = this.scr; this.save.save(this.state); }
  saveSoon() { clearTimeout(this._st); this._st = setTimeout(() => this.saveNow(), 400); }
  saveSettings() { this.save.saveSettings({ vol: this.audio.vol, muted: this.audio.muted, voz: this.audio.voz, modo: this.modo, joy: this.joyOn, sueno: this.sueno }); }
  setMuted(m) { this.audio.setMuted(m); this.saveSettings(); this.ui.toast(m ? 'Sonido: no' : 'Sonido: sí'); }
  /* ---- ayudas para los guiones ---- */
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  async think(...l) { for (const t of l) await this.dlg.line('', t, 'pienso'); }
  async say(who, ...l) { for (const t of l) await this.dlg.line(who, t, ''); }
  async voz(...l) { for (const t of l) { this.audio.speak(t); await this.dlg.line('Voz', t, 'voz'); } this.audio.hush(); }
  choose(q, o, secs) { return this.dlg.choose(q, o, secs); }
  async doc(id) { const st = this.state; if (!st.docs.includes(id)) { st.docs.push(id); this.ui.toast(`Cuaderno: <i>${esc(DOCS[id].title)}</i>`); } const fresh = this.lang.learn(DOCS[id].text(this.f)); if (fresh.length) this.ui.toast(`Palabras nuevas: <i>${fresh.length}</i>`); this.set('doc_' + id); await this.ui.showDoc(id); }
  async run(fn, it) { if (this.busy) return; this.busy = true; try { await fn(this, it); } catch (e) { console.error('guion', e); } finally { this.busy = false; this.dlg.hide(); this.saveSoon(); } }
  /** Ejecuta el guion de un objeto. En la calle (modo normal), si el objeto tiene su plano fijo, primero se entra en él. */
  async play(id, it) { it = it || this.world.inter.find(i => i.id === id); const fr = !this.scr && this.modo === 'normal' ? frameOf(id) : null; if (fr) await this.enterFrame(fr);
    await SCRIPTS[id](this, it); const s = SCREENS[this.scr]; if (this.modo === 'normal' && s && s.leaveIf && s.leaveIf(this.f)) await this.exitFrame(); }
  interact(it) { if (!SCRIPTS[it.id] || !this.canAct()) return; const p = this.player; this.input.stop(); if (!it.far && !it.eco) p.ry = Math.atan2(it.hitbox.position.x - p.pos.x, it.hitbox.position.z - p.pos.z); this.run(g => g.play(it.id, it)); }
  useItem(id) { if (!this.inv.has(id) || this.busy) return;
    const near = n => { const it = this.world.inter.find(i => i.id === n); if (!it || it.hitbox.userData.off) return null; return (this.scr ? SCREENS[this.scr].hs.includes(n) : Math.hypot(this.player.pos.x - it.x, this.player.pos.z - it.z) < it.r + 0.8) ? it : null; };
    this.run(async g => {
      if (id === 'linterna') await g.think('No funciona. Necesita pilas.'); else if (id === 'pilas') await g.think('Son para la linterna. Puedo combinar las dos cosas.');
      else if (id === 'linterna_ok') { g.set('luzOn', !g.f.luzOn); g.audio.ui(); g.ui.toast(g.f.luzOn ? 'Linterna: encendida' : 'Linterna: apagada'); }
      else if (id === 'moneda') { if (near('maquina')) await g.play('maquina'); else await g.think('Aquí no sirve.'); }
      else if (id === 'llave') { if (near('cajon')) await g.play('cajon'); else await g.think('Aquí no hay nada para abrir.'); }
      else if (id === 'foto') { if (near('anselmo')) await g.play('anselmo'); else await g.think('Siete personas con los ojos cerrados. Y un médico.', '¿Quién hizo la foto?'); }
      else if (ITEMS[id].drink) { if (id === 'naranja' && g.f.anselmoSed && !g.f.tieneLlave) { if (near('anselmo')) await g.play('anselmo'); else await g.think('No. Es para Anselmo.'); } else { g.inv.remove(id); g.audio.fizz(); g.addCordura(12); await g.think(id === 'cafe' ? 'Bebo el café. Está caliente. Estoy un poco mejor.' : 'Bebo. Está frío. Estoy un poco mejor.'); } }
    });
  }
  togglePause() { const u = this.ui; if (u.modal === 'pause') { u.modal = null; $('pause').classList.add('hidden'); return; } if (u.modal || (this.mode !== 'play')) return; u.modal = 'pause'; u.syncSound(); $('pause').classList.remove('hidden'); this.saveNow(); }


  /* ---- sucesos ---- */
  async openGate() { const g = this; g.cams.force = 'verja'; g.audio.gateOpen(); g.set('puertaAbierta'); g.camShake(0.3); g.decide('Abres la puerta del norte.'); await g.wait(5400);
    await g.think('La puerta se abre.', 'Detrás hay una calle. La niebla es roja.', 'Hay un edificio muy grande. En todas las ventanas hay luz.'); g.cams.force = null; g.arch('simbolos'); }
  /** Persecución del modo lectura (elecciones contra el tiempo). La del modo normal es en tiempo real: modes/walk/chase.js. */
  chaseSeq() { return chaseSeq(this); }
  faint() { this.pendingFaint = false; if (this.chase) endChase(this); this.decide('El miedo te duerme una vez.'); this.run(async g => { g.audio.sting(); await g.ui.fade(true, '', 900); await g.ui.fadeText('Todo está oscuro.'); await g.wait(1500); g.state.cordura = 60; g.hold = 0; g.cams.force = null; g.world.d.watcher.visible = false;
    if (g.modo === 'lectura') g.setScreen('callejon1'); else g.toStreet({ x: 0, z: -1.6, ry: Math.PI }); g.player.lie = 1; g.player.sync(); await g.ui.fadeText('Abres los ojos. Otra vez.'); await g.wait(1300); await g.ui.fade(false, '', 2200); g.rise = true; await g.wait(2000); await g.think('El callejón. Otra vez.'); }); }
  async ending() { this.mode = 'end'; this.dlg.hide(); const ui = this.ui; await ui.fade(true, '', 2600);
    for (const t of ['Cruzas la puerta.', 'Delante de ti hay un hospital.\nEn todas las ventanas hay luz.', 'En tu brazo hay una pulsera.\nAntes no estaba.', 'PACIENTE 7', 'Una voz dice:\n«Bienvenido a casa.»']) { this.lang.learn(t); await ui.fadeText(t); await this.wait(2500); }
    await ui.fadeText(''); this.arch('tu'); this.arch('ideas'); this.f.fin = true; if (this.scr) this.setScreen('puerta'); else this.player.place(0, -80, 0); this.saveNow(); const st = this.state, m = Math.floor(st.time / 60), s = Math.floor(st.time % 60);
    ui.showEnd([['Tiempo en el sueño', `${m} min ${s < 10 ? '0' : ''}${s} s`], ['Palabras que entiendes', `${st.words.length} / ${LEX.length}`], ['Documentos', `${st.docs.length} / ${Object.keys(DOCS).length}`], ['Fragmentos del archivo', `${st.archive.length} / ${Object.keys(ARCHIVE).length}`], ['Ecos', `${st.ecos.length} / ${Object.keys(ECOS).length}`], ['¿Miraste atrás?', this.f.miraste ? 'Sí' : 'No'], ['Intentos en la puerta', String(st.tries + 1)]]); }

  /* ---- bucle ---- */
  update(dt) {
    this.time += dt; const p = this.player, f = this.f, walk = !this.scr, frozen = !!this.ui.modal || this.mode !== 'play';
    if (!frozen) {
      if (this.rise) { p.lie = Math.max(0, p.lie - dt / 2); if (p.lie === 0) this.rise = false; }
      if (walk) p.update(dt, this.input.read(dt), this.cams, !this.busy && !this.going && !this.dlg.active && p.lie === 0); else p.update(dt, { x: 0, y: 0, run: false }, this.cams, false);
      this.state.time += dt; this.events();
      if (this.chase) updateChase(this, dt); else this.dread = Math.max(0, this.dread - dt * 0.22);
      if (!this.chase && !this.hold && this.state.cordura < 80) this.state.cordura = Math.min(80, this.state.cordura + dt * 0.7);
      if (this.pendingFaint && !this.busy) this.faint();
      this.autoT += dt; if (this.autoT > 15 && this.canAct()) { this.autoT = 0; this.saveNow(); }
      if (!this.chase && this.world.d.watcher.visible) { const w = this.world.d.watcher, u = w.userData; w.position.y = Math.abs(Math.sin(this.time * 7)) * 0.04; u.armL.rotation.x = Math.sin(this.time * 4) * 0.4; u.armR.rotation.x = -Math.sin(this.time * 4) * 0.4; u.head.rotation.z = Math.sin(this.time * 11) * 0.3; }
    }
    this.cams.update(dt, p, this.time); this.world.update(dt, this.time, p, f); if (walk) this.inter.update(); else this.hs.update();
    const threat = this.chase ? clamp(1.15 - (this.chase.dist || 9) / 10, 0.35, 1) : Math.max(this.dread, this.hold), z = p.zone, D = (a, b) => Math.hypot(p.pos.x - a, p.pos.z - b);
    const hum = Math.max(0, 1 - Math.min(D(-2, -14.5), D(0, -35), D(8.5, -43.5), D(18, -34), D(21.4, -38)) / 8);
    this.audio.update(dt, { zone: z, threat, hum, radio: z === 'tienda' ? clamp(1 - D(17.9, -37) / 11, 0.12, 1) : 0, ring: this.ringing() && this.mode === 'play' ? (z === 'tienda' ? 0.25 : clamp(1 - D(8.5, -43.5) / 45, 0.12, 1)) : 0, red: !!f.puertaAbierta });
    const u = this.gfx.u; u.fear.value += (Math.max(threat, (1 - this.state.cordura / 100) * 0.45) - u.fear.value) * Math.min(1, dt * 3); u.red.value = this.world.d.hospV || 0;
    const tv = (this.dlg.active || this.ui.modal || this.mode !== 'play') ? 'hidden' : 'visible'; if (tv !== this._tv) { this._tv = tv; $('touch').style.visibility = tv; }
    this.ui.estado(this.state.cordura, threat); dreamUpdate(this.world.d, this.cams.cam); this.gfx.render(this.world.scene, this.cams.cam, this.time);
  }
  /** Sucesos al llegar a una zona por primera vez y disparadores ligados a la posición (solo en la calle). */
  events() { const p = this.player, f = this.f, z = p.zone;
    if (z !== this.lastZone && !this.busy && !this.going) { this.lastZone = z; this.ui.zone(ZONES[z]); this.saveSoon();
      if (!f['v_' + z]) { this.set('v_' + z); const first = { plaza: ['Una plaza. No hay nadie.', 'Un teléfono suena.'], tienda: ['Una tienda pequeña. Hay luz.', 'La radio funciona. Nadie la escucha.'], pasaje: ['Hay dibujos rojos en las paredes.'], puerta: ['Una puerta de hierro muy grande.', 'En el centro hay un ojo cerrado.'] }[z];
        if (z === 'plaza') this.set('plazaVisitada'); if (first) this.run(g => g.think(...first)); } }
    if (this.scr) return;
    if (!f.sombraVista && z === 'plaza' && p.pos.z < -40) { this.set('sombraVista'); this.audio.voices(0.12); this.dread = 0.4; }
    // el pasaje está oscuro: sin luz no se puede entrar
    if (p.pos.z < -48.9 && p.pos.z > -52 && Math.abs(p.pos.x) < 2.6 && !f.luz) { p.pos.z = -48.9; p.sync(); this.input.stop(); if (this.time > this.blockT && !this.busy) { this.blockT = this.time + 5; this.run(g => g.think('El pasaje está muy oscuro. No veo nada.', 'Necesito luz.')); } }
    if (z === 'pasaje' && f.luz && !f.luzOn) { this.set('luzOn'); this.ui.toast('Linterna: encendida'); }
    if (!f.chaseDone && !this.chase && !this.busy && !this.going && z === 'pasaje' && p.pos.z < -57 && p.pos.z > -72) startChase(this);
    if (f.puertaAbierta && p.pos.z < -87.5 && !this.busy) { this.ending(); return; }
    // la puerta abierta de la tienda: al cruzarla se entra en el plano de la tienda
    if (f.tiendaAbierta && p.pos.x > 12.7 && Math.abs(p.pos.z + 34) < 1.2 && this.canAct()) this.run(g => g.enterFrame('tienda', { x: 11.7, z: clamp(p.pos.z, -34.6, -33.4), ry: -Math.PI / 2 }));
    // los rótulos de la calle se abren solos la primera vez que pasas cerca
    const n = this.inter.near; if (n && n.auto && !f['doc_' + n.id] && this.canAct() && !this.input.dest) this.interact(n);
  }

  /* ---- entrada: teclado, ratón, táctil ---- */
  bindInput() { const c = $('c'), ui = this.ui, dlg = this.dlg; const ACT = { KeyE: 1, Enter: 1, Space: 1 }; this.input.bind();
    window.addEventListener('keydown', e => { if (e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); if (this.mode !== 'play') return; this.input.keys[e.code] = true; if (e.repeat) return; this.audio.init();
      if (e.code === 'Escape') { if (ui.modal === 'book') ui.closeBook(); else if (ui.modal === 'doc') ui.closeDoc(); else if (ui.modal === 'puzzle') this.puzzle.close(false); else this.togglePause(); return; }
      if (ui.modal === 'doc') { if (ACT[e.code]) ui.closeDoc(); return; } if (ui.modal === 'book') { if (e.code === 'Tab' || e.code === 'KeyJ') ui.closeBook(); return; } if (ui.modal) return;
      if (dlg.choice) { if (e.code === 'ArrowUp' || e.code === 'KeyW') dlg.nav(-1); else if (e.code === 'ArrowDown' || e.code === 'KeyS') dlg.nav(1); else if (ACT[e.code]) dlg.advance(); else if (/^Digit[1-9]$/.test(e.code)) dlg.pick(+e.code.slice(5) - 1); return; }
      if (dlg.resolve) { if (ACT[e.code]) dlg.advance(); return; }
      if (e.code === 'KeyM') { this.setMuted(!this.audio.muted); return; }
      if (!this.canAct()) return;
      if (ACT[e.code]) { if (!this.scr) this.inter.act(); } else if (e.code === 'Tab') ui.openBook(0); else if (e.code === 'KeyJ') ui.openBook(1); else if (e.code === 'KeyF' && this.inv.has('linterna_ok')) this.useItem('linterna_ok'); });
    let mt = 0; c.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse' || this.scr) return; const n = performance.now(); if (n - mt < 70) return; mt = n; this.inter.onMove(e.clientX, e.clientY); });
    c.addEventListener('pointerdown', e => { this.audio.init(); if (this.mode !== 'play') return; if (dlg.resolve) { dlg.advance(); return; } if (!this.scr) this.inter.onClick(e.clientX, e.clientY); });
    // táctil: se activa con el primer toque
    window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); this.syncHud(); } }, { passive: true });
    document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.pbody,#docBody,.scroll,input')) e.preventDefault(); }, { passive: false });
    ['gesturestart', 'dblclick', 'contextmenu'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
    const rs = () => this.cams.resize(this.gfx.resize()); window.addEventListener('resize', rs); window.addEventListener('orientationchange', () => setTimeout(rs, 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.saveNow(); this.audio.suspend(true); this.input.keys = {}; } else this.audio.suspend(false); });
    window.addEventListener('pagehide', () => this.saveNow());
  }
}
