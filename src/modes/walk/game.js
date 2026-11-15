import { $, esc, clamp } from '../../shared/util.js';
import { SAVE_KEYS, ZONES, ITEMS, DOCS, LEX, ARCHIVE, ECOS } from '../../shared/data.js';
import { AudioManager } from '../../shared/audio.js';
import { SceneManager, CameraManager, Gfx } from '../../shared/world.js';
import { Player } from '../../shared/player.js';
import { SaveManager, LanguageSystem, Inventory, LoreArchive, DialogueSystem, PuzzleSystem, UIManager } from '../../shared/systems.js';
import { SCRIPTS } from '../../shared/scripts.js';
import { InteractionSystem } from './interaction.js';
/* Ayuda de controles de este modo (pausa). */
const HELP = '<b>W A S D</b> o <b>← ↑ ↓ →</b> caminar · <b>Mayús</b> correr<br><b>E</b> acción · <b>Tab</b> inventario · <b>J</b> cuaderno<br><b>F</b> linterna · <b>M</b> silencio · <b>Esc</b> pausa<br>Toca una palabra subrayada para ver qué significa.';

/* =====================================================================
   Game — estado, bucle principal, entrada, eventos del capítulo.
   ===================================================================== */
export let game = null;
export class Game {
  constructor() {
    this.save = new SaveManager({ key: SAVE_KEYS.walk }); this.audio = new AudioManager(); const s = this.save.settings(); this.audio.vol = s.vol; this.audio.muted = !!s.muted; this.audio.voz = s.voz !== false;
    this.state = this.save.fresh(); this.f = this.state.flags; this.mode = 'title'; this.busy = false; this.chase = null; this.time = 0; this.keys = {}; this.joy = { x: 0, y: 0 }; this.runT = false;
    this.dread = 0; this.lastZone = null; this.blockT = 0; this.autoT = 0; this.rise = false; this.pendingFaint = false;
  }
  boot() {
    game = this;
    this.lang = new LanguageSystem(this); this.inv = new Inventory(this); this.lore = new LoreArchive(this); this.ui = new UIManager(this, { help: HELP, badge: true }); this.dlg = new DialogueSystem(this); this.puzzle = new PuzzleSystem(this);
    this.gfx = new Gfx($('c')); this.world = new SceneManager(this); this.world.build(); this.player = new Player(this.world); this.cams = new CameraManager(); this.inter = new InteractionSystem(this);
    this.player.stepCb = run => this.audio.step(this.player.zone === 'tienda' ? 'wood' : (this.player.zone === 'pasaje' || this.player.zone === 'puerta') ? 'stone' : 'wet', run);
    this.world.sync(this.f); this.world.snap(); this.cams.resize(this.gfx.resize()); this.bindInput(); this.ui.syncSound();
    const has = !!this.save.load(); $('tCont').classList.toggle('hidden', !has);
    $('tNote').innerHTML = 'Usa auriculares.<br>Todo lo que oyes y lees aquí está en español.<span id="gira">Gira el teléfono: el sueño es más ancho que alto.</span>' + (this.save.ok ? '' : '<br>Este navegador no guarda la partida.');
    $('tCont').addEventListener('click', () => this.start(false));
    $('tNew').addEventListener('click', e => { if (has && !this._conf) { this._conf = true; e.target.textContent = '¿Borrar la partida guardada? Pulsa otra vez'; return; } this.start(true); });
    $('tSnd').addEventListener('click', () => { this.setMuted(!this.audio.muted); this.ui.syncSound(); });
    $('endBack').addEventListener('click', () => location.reload());
    this.last = performance.now(); const loop = now => { requestAnimationFrame(loop); const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; try { this.update(dt); } catch (e) { if (!this._err) { this._err = true; console.error(e); } } }; requestAnimationFrame(loop);
  }
  start(isNew) {
    this.audio.init(); let st = isNew ? null : this.save.load(); if (isNew) this.save.clear(); if (!st) { st = this.save.fresh(); isNew = true; }
    this.state = st; this.f = st.flags; if (st.pos.z < -85.5) { st.pos.x = 0; st.pos.z = -80; }
    this.player.place(st.pos.x, st.pos.z, st.pos.ry); this.sync(); this.world.snap(); this.lastZone = this.player.zone;
    $('title').classList.add('hidden'); $('hud').classList.remove('hidden'); if (document.body.classList.contains('touch')) $('touch').classList.remove('hidden');
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
  canAct() { return this.mode === 'play' && !this.busy && !this.ui.modal && !this.chase && !this.dlg.active; }
  saveNow() { if (this.mode === 'title') return; const p = this.player; this.state.pos = { x: +p.pos.x.toFixed(2), z: +p.pos.z.toFixed(2), ry: +p.ry.toFixed(2) }; this.save.save(this.state); }
  saveSoon() { clearTimeout(this._st); this._st = setTimeout(() => this.saveNow(), 400); }
  saveSettings() { this.save.saveSettings({ vol: this.audio.vol, muted: this.audio.muted, voz: this.audio.voz }); }
  setMuted(m) { this.audio.setMuted(m); this.saveSettings(); this.ui.toast(m ? 'Sonido: no' : 'Sonido: sí'); }
  /* ---- ayudas para los guiones ---- */
  wait(ms) { return new Promise(r => setTimeout(r, ms)); }
  async think(...l) { for (const t of l) await this.dlg.line('', t, 'pienso'); }
  async say(who, ...l) { for (const t of l) await this.dlg.line(who, t, ''); }
  async voz(...l) { for (const t of l) { this.audio.speak(t); await this.dlg.line('Voz', t, 'voz'); } this.audio.hush(); }
  choose(q, o) { return this.dlg.choose(q, o); }
  async doc(id) { const st = this.state; if (!st.docs.includes(id)) { st.docs.push(id); this.ui.toast(`Cuaderno: <i>${esc(DOCS[id].title)}</i>`); } const fresh = this.lang.learn(DOCS[id].text(this.f)); if (fresh.length) this.ui.toast(`Palabras nuevas: <i>${fresh.length}</i>`); this.set('doc_' + id); await this.ui.showDoc(id); }
  async run(fn, it) { if (this.busy) return; this.busy = true; try { await fn(this, it); } catch (e) { console.error('guion', e); } finally { this.busy = false; this.dlg.hide(); this.saveSoon(); } }
  interact(it) { const fn = SCRIPTS[it.id]; if (fn && this.canAct()) { const p = this.player; if (!it.far) p.ry = Math.atan2(it.hitbox.position.x - p.pos.x, it.hitbox.position.z - p.pos.z); this.run(fn, it); } }
  useItem(id) { if (!this.inv.has(id) || this.busy) return; const near = n => { const it = this.world.inter.find(i => i.id === n); return it && !it.hitbox.userData.off && Math.hypot(this.player.pos.x - it.x, this.player.pos.z - it.z) < it.r + 0.8 ? it : null; };
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
  startChase() { const p = this.player, w = this.world.d.watcher; this.chase = { back: 0, looked: false, t: 0 }; w.visible = true; w.position.set(0, 0, Math.min(p.pos.z + 8.5, -50.5)); this.audio.sting(); this.cams.force = 'pasaje2'; this.camShake(0.2); this.dlg.hide(); }
  endChase() { this.chase = null; this.world.d.watcher.visible = false; this.cams.force = null; }
  updateChase(dt) { const c = this.chase, p = this.player, w = this.world.d.watcher; c.t += dt;
    if (p.moving && p.vel.z > 0.7) c.back += dt; else c.back = Math.max(0, c.back - dt * 2);
    if (c.back > 0.3 && !c.looked) { c.looked = true; this.f.miraste = true; this.decide('En el pasaje, miras atrás.'); this.audio.wrong(); this.camShake(0.25); }
    const sp = c.looked ? 6.2 : p.moving ? 1.7 : 2.6; const dx = p.pos.x - w.position.x, dz = p.pos.z - w.position.z, d = Math.hypot(dx, dz) || 1;
    w.position.x += dx / d * sp * dt; w.position.z += dz / d * sp * dt; w.rotation.y = Math.atan2(dx, dz); w.position.y = Math.abs(Math.sin(c.t * 9)) * 0.05; const u = w.userData; u.armL.rotation.x = Math.sin(c.t * 5) * 0.5; u.armR.rotation.x = -Math.sin(c.t * 5) * 0.5; u.head.rotation.z = Math.sin(c.t * 13) * 0.3;
    c.dist = d; if (c.looked) this.addCordura(-14 * dt);
    if (d < 0.95) { this.endChase(); this.run(async g => { g.audio.sting(); g.addCordura(-30); await g.ui.fade(true, '', 180); g.player.place(0, -50.2, Math.PI); await g.wait(1300); await g.ui.fade(false, '', 1600); await g.think('Estoy otra vez en la entrada del pasaje.', 'En el callejón había unas palabras en la pared...'); }); }
    else if (p.pos.z < -73.4) { this.endChase(); this.set('chaseDone'); this.audio.metal(0.6, 0.2); this.run(async g => { await g.wait(700); await g.think('Ya no oigo nada detrás de mí.', g.f.miraste ? 'Lo miré. Y él me miró.' : 'No miré atrás. No sé qué era.'); if (!g.f.miraste) g.decide('En el pasaje, no miras atrás.'); g.arch('mira'); }); }
  }
  faint() { this.pendingFaint = false; if (this.chase) this.endChase(); this.decide('El miedo te duerme una vez.'); this.run(async g => { g.audio.sting(); await g.ui.fade(true, '', 900); await g.ui.fadeText('Todo está oscuro.'); await g.wait(1500); g.state.cordura = 60; g.player.place(0, -1.6, Math.PI); g.player.lie = 1; g.player.sync(); await g.ui.fadeText('Abres los ojos. Otra vez.'); await g.wait(1300); await g.ui.fade(false, '', 2200); g.rise = true; await g.wait(2000); await g.think('El callejón. Otra vez.'); }); }
  async ending() { this.mode = 'end'; this.dlg.hide(); const ui = this.ui; await ui.fade(true, '', 2600);
    for (const t of ['Cruzas la puerta.', 'Delante de ti hay un hospital.\nEn todas las ventanas hay luz.', 'En tu brazo hay una pulsera.\nAntes no estaba.', 'PACIENTE 7', 'Una voz dice:\n«Bienvenido a casa.»']) { this.lang.learn(t); await ui.fadeText(t); await this.wait(2500); }
    await ui.fadeText(''); this.arch('tu'); this.arch('ideas'); this.f.fin = true; this.player.place(0, -80, 0); this.saveNow(); const st = this.state, m = Math.floor(st.time / 60), s = Math.floor(st.time % 60);
    ui.showEnd([['Tiempo en el sueño', `${m} min ${s < 10 ? '0' : ''}${s} s`], ['Palabras que entiendes', `${st.words.length} / ${LEX.length}`], ['Documentos', `${st.docs.length} / ${Object.keys(DOCS).length}`], ['Fragmentos del archivo', `${st.archive.length} / ${Object.keys(ARCHIVE).length}`], ['Ecos', `${st.ecos.length} / ${Object.keys(ECOS).length}`], ['¿Miraste atrás?', this.f.miraste ? 'Sí' : 'No'], ['Intentos en la puerta', String(st.tries + 1)]]); }

  /* ---- bucle ---- */
  update(dt) {
    this.time += dt; const p = this.player, f = this.f, frozen = !!this.ui.modal || this.mode !== 'play';
    if (!frozen) {
      const k = this.keys; let x = (k.KeyD || k.ArrowRight ? 1 : 0) - (k.KeyA || k.ArrowLeft ? 1 : 0) + this.joy.x, y = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) + this.joy.y;
      const run = k.ShiftLeft || k.ShiftRight || this.runT || Math.hypot(this.joy.x, this.joy.y) > 0.92 && this.runT;
      if (this.rise) { p.lie = Math.max(0, p.lie - dt / 2); if (p.lie === 0) this.rise = false; }
      p.update(dt, { x: clamp(x, -1, 1), y: clamp(y, -1, 1), run }, this.cams, !this.busy && !this.dlg.active && p.lie === 0);
      this.state.time += dt; this.events(dt);
      if (this.chase) this.updateChase(dt); else this.dread = Math.max(0, this.dread - dt * 0.22);
      if (!this.chase && this.state.cordura < 80) this.state.cordura = Math.min(80, this.state.cordura + dt * 0.7);
      if (this.pendingFaint && !this.busy) this.faint();
      this.autoT += dt; if (this.autoT > 15 && this.canAct()) { this.autoT = 0; this.saveNow(); }
    }
    this.cams.update(dt, p, this.time); this.world.update(dt, this.time, p, f); this.inter.update();
    const threat = this.chase ? clamp(1.15 - (this.chase.dist || 9) / 10, 0.35, 1) : this.dread, z = p.zone, D = (a, b) => Math.hypot(p.pos.x - a, p.pos.z - b);
    const hum = Math.max(0, 1 - Math.min(D(-2, -14.5), D(0, -35), D(8.5, -43.5), D(18, -34), D(21.4, -38)) / 8);
    this.audio.update(dt, { zone: z, threat, hum, radio: z === 'tienda' ? clamp(1 - D(17.9, -37) / 11, 0.12, 1) : 0, ring: this.ringing() && this.mode === 'play' ? (z === 'tienda' ? 0.25 : clamp(1 - D(8.5, -43.5) / 45, 0.12, 1)) : 0, red: !!f.puertaAbierta });
    const u = this.gfx.u; u.fear.value += (Math.max(threat, (1 - this.state.cordura / 100) * 0.45) - u.fear.value) * Math.min(1, dt * 3); u.red.value = this.world.d.hospV || 0;
    const tv = (this.dlg.active || this.ui.modal || this.mode !== 'play') ? 'hidden' : 'visible'; if (tv !== this._tv) { this._tv = tv; $('touch').style.visibility = tv; }
    this.ui.estado(this.state.cordura, threat); this.gfx.render(this.world.scene, this.cams.cam, this.time);
  }
  /** Disparadores ligados a la posición. */
  events(dt) { const p = this.player, f = this.f, z = p.zone;
    if (z !== this.lastZone) { this.lastZone = z; this.ui.zone(ZONES[z]); this.saveSoon();
      if (!f['v_' + z] && !this.busy) { this.set('v_' + z); const first = { plaza: ['Una plaza. No hay nadie.', 'Un teléfono suena.'], tienda: ['Una tienda pequeña. Hay luz.', 'La radio funciona. Nadie la escucha.'], pasaje: ['Hay dibujos rojos en las paredes.'], puerta: ['Una puerta de hierro muy grande.', 'En el centro hay un ojo cerrado.'] }[z];
        if (z === 'plaza') this.set('plazaVisitada'); if (first) this.run(g => g.think(...first)); } }
    if (!f.sombraVista && z === 'plaza' && p.pos.z < -40) { this.set('sombraVista'); this.audio.voices(0.12); this.dread = 0.4; }
    // el pasaje está oscuro: sin luz no se puede entrar
    if (p.pos.z < -48.9 && p.pos.z > -52 && Math.abs(p.pos.x) < 2.6 && !f.luz) { p.pos.z = -48.9; p.sync(); if (this.time > this.blockT && !this.busy) { this.blockT = this.time + 5; this.run(g => g.think('El pasaje está muy oscuro. No veo nada.', 'Necesito luz.')); } }
    if (z === 'pasaje' && f.luz && !f.luzOn) { this.set('luzOn'); this.ui.toast('Linterna: encendida'); }
    if (!f.chaseDone && !this.chase && !this.busy && z === 'pasaje' && p.pos.z < -57 && p.pos.z > -72) this.startChase();
    if (f.puertaAbierta && p.pos.z < -87.5 && !this.busy) this.ending();
  }

  /* ---- entrada: teclado, ratón, táctil ---- */
  bindInput() { const c = $('c'), ui = this.ui, dlg = this.dlg; const ACT = { KeyE: 1, Enter: 1, Space: 1 };
    window.addEventListener('keydown', e => { if (e.code === 'Tab' || e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault(); if (this.mode !== 'play') return; this.keys[e.code] = true; if (e.repeat) return; this.audio.init();
      if (e.code === 'Escape') { if (ui.modal === 'book') ui.closeBook(); else if (ui.modal === 'doc') ui.closeDoc(); else if (ui.modal === 'puzzle') this.puzzle.close(false); else this.togglePause(); return; }
      if (ui.modal === 'doc') { if (ACT[e.code]) ui.closeDoc(); return; } if (ui.modal === 'book') { if (e.code === 'Tab' || e.code === 'KeyJ') ui.closeBook(); return; } if (ui.modal) return;
      if (dlg.choice) { if (e.code === 'ArrowUp' || e.code === 'KeyW') dlg.nav(-1); else if (e.code === 'ArrowDown' || e.code === 'KeyS') dlg.nav(1); else if (ACT[e.code]) dlg.advance(); else if (/^Digit[1-9]$/.test(e.code)) dlg.pick(+e.code.slice(5) - 1); return; }
      if (dlg.resolve) { if (ACT[e.code]) dlg.advance(); return; }
      if (e.code === 'KeyM') { this.setMuted(!this.audio.muted); return; }
      if (!this.canAct()) return;
      if (ACT[e.code]) this.inter.act(); else if (e.code === 'Tab') ui.openBook(0); else if (e.code === 'KeyJ') ui.openBook(1); else if (e.code === 'KeyF' && this.inv.has('linterna_ok')) this.useItem('linterna_ok'); });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; }); window.addEventListener('blur', () => { this.keys = {}; });
    let mt = 0; c.addEventListener('pointermove', e => { if (e.pointerType !== 'mouse') return; const n = performance.now(); if (n - mt < 70) return; mt = n; this.inter.onMove(e.clientX, e.clientY); });
    c.addEventListener('pointerdown', e => { this.audio.init(); if (this.mode !== 'play') return; if (dlg.resolve) { dlg.advance(); return; } this.inter.onClick(e.clientX, e.clientY); });
    // táctil: se activa con el primer toque
    window.addEventListener('touchstart', () => { if (!document.body.classList.contains('touch')) { document.body.classList.add('touch'); if (this.mode === 'play') $('touch').classList.remove('hidden'); } }, { passive: true });
    document.addEventListener('touchmove', e => { if (!e.target.closest || !e.target.closest('.pbody,#docBody,.scroll,input')) e.preventDefault(); }, { passive: false });
    ['gesturestart', 'dblclick', 'contextmenu'].forEach(n => document.addEventListener(n, e => e.preventDefault()));
    const joy = $('joy'), knob = $('joyK'); let jid = null; const jmove = e => { const r = joy.getBoundingClientRect(); let dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2); const m = Math.hypot(dx, dy), R = r.width / 2 - 14; if (m > R) { dx *= R / m; dy *= R / m; } knob.style.transform = `translate(${dx}px,${dy}px)`; this.joy.x = dx / R; this.joy.y = -dy / R; };
    joy.addEventListener('pointerdown', e => { jid = e.pointerId; try { joy.setPointerCapture(jid); } catch (_) {} jmove(e); this.audio.init(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === jid) jmove(e); });
    const jend = e => { if (e.pointerId !== jid) return; jid = null; this.joy.x = this.joy.y = 0; knob.style.transform = ''; }; joy.addEventListener('pointerup', jend); joy.addEventListener('pointercancel', jend);
    $('btnA').addEventListener('pointerdown', e => { e.preventDefault(); this.audio.init(); if (ui.modal === 'doc') ui.closeDoc(); else if (dlg.active) dlg.advance(); else if (this.canAct()) this.inter.act(); });
    $('btnR').addEventListener('pointerdown', e => { e.preventDefault(); this.runT = !this.runT; $('btnR').classList.toggle('on', this.runT); });
    const rs = () => this.cams.resize(this.gfx.resize()); window.addEventListener('resize', rs); window.addEventListener('orientationchange', () => setTimeout(rs, 250));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.saveNow(); this.audio.suspend(true); this.keys = {}; } else this.audio.suspend(false); });
    window.addEventListener('pagehide', () => this.saveNow());
  }
}
