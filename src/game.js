import { ZONES, ITEMS, DOCS, LEX, ARCHIVE, ECOS } from './data.js';
import { AudioManager } from './audio.js';
import { SceneManager, CameraManager, Player, Gfx } from './world.js';
import { $, esc, clamp, SaveManager, LanguageSystem, Inventory, LoreArchive, DialogueSystem, PuzzleSystem, UIManager } from './systems.js';
import { SCREENS, HotspotSystem } from './screens.js';
/* =====================================================================
   GUIONES de los objetos interactivos. Cada guion es una función async:
   la historia se lee de arriba abajo, como una escena.
   ===================================================================== */
export const DRINKS = ['naranja', 'agua', 'limon', 'cafe'];
export const SCRIPTS = {
  async nota(g) { await g.doc('nota'); await g.think('«El hombre que no duerme.» ¿Quién es?'); },
  async grafiti(g) { await g.doc('grafiti'); if (!g.f.chaseDone) await g.think('Alguien escribió esto con pintura roja.', '¿Por qué «atrás»? Detrás de mí no hay nada.'); else if (g.f.puertaAbierta) await g.think('Las palabras son nuevas. La pintura todavía está fresca.'); else await g.think('Antes había otras palabras aquí.', 'La pared sabe qué hice en el pasaje.'); },
  async linterna(g) { if (!g.give('linterna')) return; g.set('got_linterna'); await g.think('Una linterna. No funciona.', 'Necesita pilas.'); },
  async puertaCallejon(g) {
    if (g.f.puertaAbierta) { await g.think('Ahora la puerta está abierta.', 'Dentro hay una habitación blanca. Hay una cama de hospital.', 'La cama está vacía. Todavía está caliente.'); g.arch('cama'); return; }
    g.audio.rattle(); await g.think('Es una puerta de metal. Está cerrada.');
    if (!g.f.golpes) { g.set('golpes'); await g.wait(500); g.audio.knock(0.4); g.dread = 0.5; await g.wait(900); await g.think('Alguien llama desde dentro.', '¿Hola?', 'Nadie contesta.'); g.addCordura(-4); }
  },
  async periodico(g) { await g.doc('periodico'); g.arch('ciudad'); if (g.f.puertaAbierta) { g.set('doc_periodico2'); g.arch('ferran'); await g.think('El periódico es de hoy. Siempre es de hoy.', 'Pero ahora habla de mí.'); } else await g.think('Un periódico de hoy. O de ayer. La fecha es la misma.'); },
  async telefono(g) {
    const f = g.f;
    if (f.monedaPend) { if (g.give('moneda')) { g.set('monedaPend', false); await g.think('La moneda todavía está en el teléfono. La cojo.'); } return; }
    if (g.ringing() && !f.llamada1) {
      await g.think('Cojo el teléfono.'); await g.voz('...', 'Paciente siete.', '¿Está despierto?');
      const i = await g.choose('', ['Sí.', 'No.', '¿Quién es?']);
      await g.voz(...[['No. No está despierto. Pero es normal.'], ['Bien. Es verdad. Usted duerme.'], ['Soy su médico. Usted me conoce.']][i]);
      g.decide(['Al teléfono dices que estás despierto.', 'Al teléfono dices que no estás despierto.', 'Al teléfono preguntas quién habla.'][i]);
      await g.voz('Escuche. No abra la puerta del norte.', 'Y no hable con el hombre de la plaza. Él miente.', 'Vuelva a dormir.');
      g.set('llamada1'); g.audio.coin(); await g.think('La voz calla.', 'Una moneda cae del teléfono.'); g.arch('voz');
      if (!g.give('moneda')) g.set('monedaPend'); return;
    }
    if (g.ringing() && !f.llamada2) {
      await g.think('Cojo el teléfono.'); await g.voz('Paciente siete.', 'La puerta está abierta. Eso está mal.', 'Vuelva a su habitación. Ahora.');
      const i = await g.choose('', ['Sí, doctor.', 'No.']);
      if (i === 0) await g.voz('Bien. Habitación siete. Le esperamos.'); else await g.voz('...', 'Entonces, entre. Le esperamos también.');
      g.decide(i === 0 ? 'Dices «sí» al doctor.' : 'Dices «no» al doctor.'); g.set('llamada2'); g.arch('ferran'); return;
    }
    await g.think(f.llamada1 ? 'Nadie habla. Solo hay ruido.' : 'Un teléfono viejo. No funciona.');
  },
  async puertaTienda(g) {
    if (!g.f.doc_cartel) { await g.think('Hay un cartel en la puerta.'); await g.doc('cartel'); }
    await g.think('En la puerta hay otra palabra: «TIRA».');
    const i = await g.choose('¿Qué haces?', ['Empujar la puerta.', 'Tirar de la puerta.', 'Nada.']);
    if (i === 0) { g.audio.rattle(); g.camShake(0.08); g.dread = 0.6; await g.think('La puerta no se abre. Hace mucho ruido.', 'Algo se mueve en la niebla.'); g.addCordura(-6); g.decide('Empujas una puerta que dice «tira».'); }
    else if (i === 1) { g.audio.creak(0.2); g.set('tiendaAbierta'); await g.think('La puerta se abre.'); }
  },
  async radio(g) { g.audio.speak(DOCS.radio.text().replace(/\(.*?\)/, ''), { pitch: 1.1, rate: 0.78 }); await g.doc('radio'); g.audio.hush(); await g.think('La radio habla sola. Después, solo hay ruido.', '«No es la salida. Es la entrada.»'); },
  async calendario(g) { await g.doc('calendario'); await g.think('Aquí el tiempo no pasa.'); },
  async pilas(g) { if (!g.give('pilas')) return; g.set('got_pilas'); await g.think('Pilas. Son para la linterna.'); },
  async maquina(g) {
    await g.think('Una máquina de bebidas. Tiene luz: funciona.');
    if (!g.inv.has('moneda')) { await g.think('Necesito una moneda.'); return; }
    const ops = ['AGUA', 'CAFÉ', 'NARANJA', 'LIMÓN', 'Nada.'], ids = ['agua', 'cafe', 'naranja', 'limon'];
    const i = await g.choose('La máquina tiene cuatro botones.', ops); if (i === 4) return;
    g.inv.remove('moneda'); g.audio.coin(); await g.wait(500); g.audio.fizz(); await g.wait(600); g.give(ids[i]);
    await g.think(['La máquina da una botella de agua.', 'La máquina da un café. Huele mal.', 'La máquina da un refresco de naranja.', 'La máquina da un refresco de limón.'][i]);
  },
  async cajon(g) {
    const f = g.f;
    if (!f.cajonAbierto) {
      await g.think('Un cajón. Está cerrado con llave.'); if (!g.inv.has('llave')) return;
      const i = await g.choose('', ['Usar la llave pequeña.', 'Nada.']); if (i) return;
      g.audio.clunk(); g.inv.remove('llave'); g.set('cajonAbierto'); await g.think('La llave abre el cajón.', 'Dentro hay un papel y una fotografía.');
    }
    if (!f.doc_oracion) { await g.doc('oracion'); g.arch('orden'); }
    if (!g.inv.has('foto') && !f.got_foto) { if (!g.give('foto')) return; g.set('got_foto'); g.arch('vigilia'); }
    g.set('cajonVacio'); await g.think('Una oración. Pero no es para Dios.', 'Es para dormir.');
  },
  async anselmo(g) {
    const f = g.f, A = (...l) => g.say('Anselmo', ...l);
    if (!f.anselmo) { g.set('anselmo'); await A('Buenas noches.', '¿O buenos días? Aquí no hay días.'); g.arch('anselmo');
      await A('Tengo sed. Mucha sed.', 'Quiero un refresco de naranja. No quiero agua. Y el café no me gusta.', 'En la tienda hay una máquina. Pero yo no veo.'); g.set('anselmoSed'); }
    else await A(f.tieneLlave ? 'Eres tú. Conozco tus pasos.' : 'Tú otra vez. ¿Tienes mi refresco?');
    for (;;) {
      const o = [];
      if (!f.tieneLlave) { DRINKS.forEach(d => { if (g.inv.has(d)) o.push([`Toma. Es para ti. (${ITEMS[d].name})`, 'dar:' + d]); });
        if (!g.inv.has('moneda') && !DRINKS.some(d => g.inv.has(d))) o.push(['No tengo monedas.', 'moneda']); }
      if (!f.q_quien) o.push(['¿Quién eres?', 'quien']); if (!f.q_donde) o.push(['¿Dónde estoy?', 'donde']); if (!f.q_salir) o.push(['¿Cómo salgo de aquí?', 'salir']);
      if (f.tieneLlave && !f.q_ojos) o.push(['¿Por qué llevas una venda en los ojos?', 'ojos']);
      if (f.llamada1 && !f.q_tel) o.push(['¿Quién llama por teléfono?', 'tel']);
      if (f.doc_placa && !f.q_reves) o.push(['¿Qué es «al revés»?', 'reves']);
      if (g.inv.has('foto') && !f.q_foto) o.push(['Tengo una fotografía.', 'foto']);
      o.push(['Adiós.', 'bye']);
      const k = o[await g.choose('', o.map(x => x[0]))][1];
      if (k === 'bye') { await A(f.q_ojos ? 'Adiós. Y no mires atrás.' : 'Adiós.'); break; }
      if (k === 'quien') { g.set('q_quien'); await A('Me llamo Anselmo. Soy el farolero.', 'Enciendo las luces de la ciudad. Todas las noches.', 'Pero aquí siempre es de noche.'); }
      else if (k === 'donde') { g.set('q_donde'); await A('Estás en la ciudad.', 'La ciudad está vacía. Todos duermen.', 'Yo no. Yo no duermo.'); }
      else if (k === 'salir') { g.set('q_salir'); await A('Hay una puerta al norte, después del pasaje.', 'Pero la puerta está cerrada. Y el pasaje está muy oscuro.', 'Necesitas luz. Y necesitas las palabras.'); }
      else if (k === 'ojos') { g.set('q_ojos'); await A('Porque él mira.', 'Si yo no lo miro, él no me ve.', 'En el pasaje, camina. No mires atrás. Nunca.'); }
      else if (k === 'tel') { g.set('q_tel'); await A('El teléfono miente.', 'No es una persona. Es el hospital.', 'El hospital quiere una cosa: que duermas.'); g.decide('Anselmo dice que el teléfono miente.'); }
      else if (k === 'reves') { g.set('q_reves'); await A('Al revés es... del final al principio.', 'Uno, dos, tres. Al revés: tres, dos, uno.', 'Aquí todo es al revés. Tú duermes; por eso estás despierto aquí.'); }
      else if (k === 'foto') { g.set('q_foto'); await A('Yo no veo fotos, hijo.', '¿Hay siete personas? ¿Y un médico?', 'Entonces yo estoy en la foto. Soy el número tres.'); g.decide('Anselmo dice que es el paciente número tres.'); }
      else if (k === 'moneda') { if (!f.llamada1) await A('Yo no tengo monedas.', 'Pero el teléfono suena. Contesta. A veces da monedas.'); else { await A(f.monedaExtra ? 'Toma otra moneda. La última. Otra vez.' : 'Toma. Es mi última moneda.', 'Naranja. No agua. No café.'); if (g.give('moneda')) g.set('monedaExtra'); else await A('Tienes las manos llenas.'); } }
      else if (k === 'dar:naranja') { g.inv.remove('naranja'); g.audio.fizz(); await A('Naranja. Está fría.', 'Gracias.', 'Toma esta llave. Es pequeña. Es de la tienda: abre el cajón.', 'En el cajón hay palabras. Son las palabras de la puerta.'); g.give('llave'); g.set('tieneLlave'); g.decide('Das el refresco de naranja a Anselmo.'); }
      else { const d = k.slice(4); await A({ agua: 'Esto es agua. No quiero agua.', cafe: 'Esto es café. No me gusta el café.', limon: 'Esto es limón. Yo quiero naranja.' }[d], 'Na-ran-ja.'); if (!f.bebidaMal) { g.set('bebidaMal'); g.decide('Llevas a Anselmo una bebida que no quiere.'); } }
    }
  },
  async venda(g) { await g.think('La venda de Anselmo está en el banco.', 'Él no está.'); g.arch('venda'); },
  async sombra(g) { await g.think('Hay alguien allí, en la niebla. Es muy alto.', 'No se mueve.'); g.audio.voices(0.1); g.set('sombraVista'); await g.think('Ya no está.'); },
  async pared(g) { await g.doc('pared'); if (g.f.chaseDone) g.arch('mira'); },
  async informe(g) { await g.doc('informe'); g.arch('tu'); g.arch('ferran'); await g.think('1987.', '«Puerta.»'); },
  async placa(g) { await g.doc('placa'); await g.think(g.f.doc_oracion ? '«Reza.» Tengo una oración. Pero ¿qué es «al revés»?' : '«Reza.» No conozco ninguna oración.'); },
  async pedestal(g) {
    if (!g.f.pedestalVisto) { g.set('pedestalVisto'); await g.think('Un pedestal de piedra con cuatro placas.', 'Una luna, una boca, una mano y un ojo.'); }
    if (await g.puzzle.open()) await g.openGate();
  },
};
['mano', 'luna', 'ojo', 'boca'].forEach(s => { SCRIPTS['mural_' + s] = async g => { const cap = { mano: 'LA MANO', luna: 'LA LUNA', ojo: 'EL OJO', boca: 'LA BOCA' }[s];
  await g.think('Un dibujo rojo en la pared.', `Debajo hay unas palabras: «${cap}».`); g.set('mural_' + s); if (['mano', 'luna', 'ojo', 'boca'].every(x => g.f['mural_' + x])) g.arch('simbolos'); }; });
Object.keys(ECOS).forEach(id => { SCRIPTS[id] = async g => { const e = ECOS[id]; g.audio.whisper(); await g.think(e.pre);
  const order = e.ops.map((_, i) => i).sort(() => Math.random() - 0.5); const i = order[await g.choose(e.frase, order.map(k => e.ops[k]))];
  if (i === e.ok) { g.state.ecos.push(id); g.audio.ecoOk(); g.audio.speak(e.full, { pitch: 0.9 }); g.lang.learn(e.full); g.ui.toast('Eco recuperado'); g.addCordura(18); g.sync(); await g.think(`«${e.full}»`, 'Entiendo la voz. Tengo menos miedo.'); }
  else { g.audio.wrong(); g.dread = 0.5; g.addCordura(-7); await g.think('No. No es esa palabra.', 'La voz se va. Pero vuelve.'); } }; });

/* =====================================================================
   Game — estado, bucle principal, entrada, eventos del capítulo.
   ===================================================================== */
export let game = null;
export class Game {
  constructor() {
    this.save = new SaveManager(); this.audio = new AudioManager(); const s = this.save.settings(); this.audio.vol = s.vol; this.audio.muted = !!s.muted; this.audio.voz = s.voz !== false;
    this.state = this.save.fresh(); this.f = this.state.flags; this.mode = 'title'; this.busy = false; this.chase = null; this.time = 0; this.keys = {}; this.joy = { x: 0, y: 0 }; this.runT = false;
    this.dread = 0; this.hold = 0; this.going = false; this.scr = 'callejon1'; this.lastZone = null; this.blockT = 0; this.autoT = 0; this.rise = false; this.pendingFaint = false;
  }
  boot() {
    game = this;
    this.lang = new LanguageSystem(this); this.inv = new Inventory(this); this.lore = new LoreArchive(this); this.ui = new UIManager(this); this.dlg = new DialogueSystem(this); this.puzzle = new PuzzleSystem(this);
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
