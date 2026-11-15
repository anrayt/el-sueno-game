import { $, esc, clamp } from './util.js';
import { LEGACY_SAVE_KEY, SET_KEY, MAX_SLOTS, ZONES, ITEMS, DOCS, LEX, ARCHIVE, ECOS, SYMBOLS, PLATE_ORDER, PRAYER, SOLUTION } from './data.js';
/* =====================================================================
   SISTEMAS: guardado, idioma, inventario, archivo, diálogo, enigma,
   interacción e interfaz.
   ===================================================================== */
/* ---------- SaveManager: LocalStorage con validación y tolerancia a datos dañados ---------- */
export class SaveManager {
  /** key: clave de la partida; legacy: heredar el guardado común antiguo; validScr: id de plano válido (quest). */
  constructor({ key, legacy = false, validScr } = {}) { this.ok = true; try { const k = '__t'; localStorage.setItem(k, '1'); localStorage.removeItem(k); } catch (e) { this.ok = false; } this.mem = {};
    this.key = key; this.validScr = validScr || (() => false); if (legacy) this.migrate(); }
  /** El guardado común de antes (LEGACY_SAVE_KEY) pasa al quest y se borra: la versión de caminar empieza de cero. */
  migrate() { const old = this._get(LEGACY_SAVE_KEY); if (old === null) return; if (this._get(this.key) === null) this._set(this.key, old); try { this.ok ? localStorage.removeItem(LEGACY_SAVE_KEY) : delete this.mem[LEGACY_SAVE_KEY]; } catch (e) {} }
  _get(k) { try { return this.ok ? localStorage.getItem(k) : this.mem[k] || null; } catch (e) { return null; } }
  _set(k, v) { try { if (this.ok) localStorage.setItem(k, v); else this.mem[k] = v; return true; } catch (e) { return false; } }
  fresh() { return { v: 1, scr: 'callejon1', pos: { x: 0, z: -1.6, ry: Math.PI }, flags: {}, inv: [], docs: [], words: [], archive: [], ecos: [], decisions: [], log: [], cordura: 100, time: 0, tries: 0 }; }
  /** Devuelve un estado válido o null. Un guardado corrupto se descarta sin romper el juego. */
  load() {
    const raw = this._get(this.key); if (!raw) return null;
    try {
      const s = JSON.parse(raw), b = this.fresh(); if (!s || typeof s !== 'object' || s.v !== 1) throw new Error('versión');
      const arr = (a, ok) => Array.isArray(a) ? a.filter(ok) : [];
      b.flags = (s.flags && typeof s.flags === 'object' && !Array.isArray(s.flags)) ? s.flags : {};
      b.inv = arr(s.inv, x => ITEMS[x]).slice(0, MAX_SLOTS); b.docs = arr(s.docs, x => DOCS[x]); b.archive = arr(s.archive, x => ARCHIVE[x]); b.ecos = arr(s.ecos, x => ECOS[x]);
      b.words = arr(s.words, x => typeof x === 'string'); b.decisions = arr(s.decisions, x => typeof x === 'string'); b.log = arr(s.log, x => x && typeof x.t === 'string').slice(-60);
      if (s.pos && isFinite(s.pos.x) && isFinite(s.pos.z)) b.pos = { x: clamp(+s.pos.x, -13, 23), z: clamp(+s.pos.z, -100, 2), ry: isFinite(s.pos.ry) ? +s.pos.ry : 0 };
      if (typeof s.scr === 'string' && this.validScr(s.scr)) b.scr = s.scr; b.cordura = isFinite(s.cordura) ? clamp(+s.cordura, 10, 100) : 100; b.time = isFinite(s.time) ? +s.time : 0; b.tries = isFinite(s.tries) ? +s.tries : 0;
      return b;
    } catch (e) { console.warn('Guardado dañado: se ignora.', e); try { this.ok && localStorage.removeItem(this.key); } catch (_) {} return null; }
  }
  save(state) { return this._set(this.key, JSON.stringify(state)); }
  clear() { try { this.ok ? localStorage.removeItem(this.key) : delete this.mem[this.key]; } catch (e) {} }
  settings() { try { return Object.assign({ vol: 0.8, muted: false, voz: true }, JSON.parse(this._get(SET_KEY) || '{}')); } catch (e) { return { vol: 0.8, muted: false, voz: true }; } }
  saveSettings(o) { this._set(SET_KEY, JSON.stringify(o)); }
}

/* ---------- LanguageSystem: léxico, palabras aprendidas, marcado de textos ---------- */
export class LanguageSystem {
  constructor(game) { this.game = game; this.map = {}; this.byKey = {}; LEX.forEach(e => { this.byKey[e.k] = e; e.forms.forEach(f => { this.map[f] = e; }); }); }
  /** Envuelve las palabras del léxico en <span> para poder consultarlas. Respeta las etiquetas HTML. */
  markup(text) { const known = this.game.state.words;
    return String(text).split(/(<[^>]+>)/).map(part => part[0] === '<' ? part : part.replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, w => { const e = this.map[w.toLowerCase()]; return e ? `<span class="w${known.includes(e.k) ? '' : ' new'}" data-k="${e.k}">${w}</span>` : w; })).join(''); }
  /** Registra las palabras nuevas de un texto. Devuelve las claves nuevas. */
  learn(text) { const st = this.game.state, out = []; String(text).replace(/<[^>]+>/g, ' ').replace(/[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+/g, w => { const e = this.map[w.toLowerCase()]; if (e && !st.words.includes(e.k)) { st.words.push(e.k); out.push(e.k); } return w; }); return out; }
  entry(k) { return this.byKey[k]; }
}

/* ---------- Inventory ---------- */
export class Inventory {
  constructor(game) { this.game = game; }
  get items() { return this.game.state.inv; }
  has(id) { return this.items.includes(id); }
  full() { return this.items.length >= MAX_SLOTS; }
  add(id) { if (this.full()) return false; this.items.push(id); this.game.audio.pickup(); this.game.ui.toast(`Tienes: <i>${esc(ITEMS[id].name)}</i>`); this.game.lang.learn(ITEMS[id].name + ' ' + ITEMS[id].desc); this.game.saveSoon(); return true; }
  remove(id) { const i = this.items.indexOf(id); if (i >= 0) this.items.splice(i, 1); this.game.saveSoon(); }
  /** Combinar dos objetos. Solo existe una combinación con sentido: linterna + pilas. */
  combine(a, b) { const set = [a, b].sort().join('+'); if (set === 'linterna+pilas') { this.remove('linterna'); this.remove('pilas'); this.items.push('linterna_ok'); this.game.set('luz'); this.game.set('luzOn'); this.game.audio.clunk(); this.game.ui.toast('Tienes: <i>Linterna con pilas</i>'); return true; } return false; }
}

/* ---------- LoreArchive ---------- */
export class LoreArchive {
  constructor(game) { this.game = game; }
  unlock(id) { const st = this.game.state; if (!ARCHIVE[id] || st.archive.includes(id)) return; st.archive.push(id); this.game.ui.toast(`Archivo: <i>${esc(ARCHIVE[id].title)}</i>`); this.game.lang.learn(ARCHIVE[id].text); this.game.saveSoon(); }
}

/* ---------- DialogueSystem: subtítulos con máquina de escribir y elecciones ---------- */
export class DialogueSystem {
  constructor(game) { this.game = game; this.resolve = null; this.typing = null; this.choice = null; this.box = $('sub'); this.txt = $('subTxt'); this.who = $('subWho'); this.chs = $('choices');
    this.box.addEventListener('click', e => { if (e.target.closest('.w')) return; this.advance(); }); }
  get active() { return !!(this.resolve || this.choice); }
  /** Muestra una línea y espera a que el jugador avance. cls: '' | 'voz' | 'pienso' */
  line(who, text, cls = '') { const g = this.game; return new Promise(res => {
      this.box.classList.remove('hidden'); this.chs.classList.add('hidden'); this.who.textContent = who || ''; this.txt.className = cls; this.txt.textContent = ''; $('subNext').style.visibility = 'hidden';
      const fresh = g.lang.learn(text); let i = 0; const full = text;
      const done = () => { clearInterval(this.typing); this.typing = null; this.txt.innerHTML = g.lang.markup(esc(full)); $('subNext').style.visibility = 'visible'; if (fresh.length) { g.audio.word(); g.ui.toast(`Palabra nueva: <i>${esc(fresh.slice(0, 3).join(', '))}</i>`); } };
      this.typing = setInterval(() => { i += 2; this.txt.textContent = full.slice(0, i); if (i >= full.length) done(); }, 30);
      this.finish = done; this.resolve = () => { this.resolve = null; res(); };
      if (who && who !== 'Tú') g.logLine(who, text); }); }
  advance() { if (this.choice) { this.pick(this.choice.sel); return; } if (!this.resolve) return; if (this.typing) { this.finish(); return; } this.game.audio.ui(); const r = this.resolve; r(); if (!this.resolve && !this.choice) this.box.classList.add('hidden'); }
  /** Lista de opciones. Devuelve el índice elegido. */
  choose(q, opts, secs) { const g = this.game; return new Promise(res => { this.box.classList.add('hidden'); this.chs.classList.remove('hidden'); g.lang.learn(q + ' ' + opts.join(' '));
      this.chs.innerHTML = (secs ? `<div class="tbar"><b style="animation-duration:${secs}s"></b></div>` : '') + (q ? `<div class="q">${g.lang.markup(esc(q))}</div>` : '') + opts.map((o, i) => `<button class="ch" data-i="${i}"><span class="n">${i + 1}</span>${g.lang.markup(esc(o))}</button>`).join('');
      this.choice = { sel: 0, n: opts.length, res }; this.hl(); g.ui.guard(); clearTimeout(this.tmo); if (secs) this.tmo = setTimeout(() => { if (this.choice && this.choice.res === res) { this.choice = null; this.chs.classList.add('hidden'); res(-1); } }, secs * 1000);
      this.chs.querySelectorAll('.ch').forEach(b => b.addEventListener('click', e => { if (g.ui.guarded()) return; const w = e.target.closest('.w'); if (w && !w.dataset.seen) { w.dataset.seen = 1; return; } this.pick(+b.dataset.i); })); }); }
  hl() { this.chs.querySelectorAll('.ch').forEach((b, i) => b.classList.toggle('sel', i === this.choice.sel)); }
  nav(d) { if (!this.choice) return; this.choice.sel = (this.choice.sel + d + this.choice.n) % this.choice.n; this.hl(); this.game.audio.ui(); }
  pick(i) { if (!this.choice || i < 0 || i >= this.choice.n) return; const c = this.choice; this.choice = null; clearTimeout(this.tmo); this.chs.classList.add('hidden'); this.game.audio.ui(); c.res(i); }
  hide() { this.box.classList.add('hidden'); this.chs.classList.add('hidden'); }
}

/* ---------- PuzzleSystem: las cuatro placas de la puerta ---------- */
export class PuzzleSystem {
  constructor(game) { this.game = game; this.seq = []; this.res = null; this.lock = false;
    $('pzClose').addEventListener('click', () => { if (!this.game.ui.guarded()) this.close(false); }); }
  open() { const g = this.game; return new Promise(res => { this.res = res; this.seq = []; this.lock = false; g.ui.modal = 'puzzle'; g.ui.guard(); $('puzzle').classList.remove('hidden');
      $('pzTitle').textContent = 'Cuatro placas de piedra'; $('pzMsg').innerHTML = g.lang.markup('Las placas se mueven. Puedes pulsarlas.');
      $('plates').innerHTML = PLATE_ORDER.map(s => `<button class="plate" data-s="${s}" aria-label="placa"><svg viewBox="0 0 56 56"><path d="${SYMBOLS[s]}"/></svg></button>`).join('');
      $('plates').querySelectorAll('.plate').forEach(b => b.addEventListener('click', () => { if (!g.ui.guarded()) this.press(b); })); this.draw(); }); }
  draw() { $('pzSeq').textContent = '●'.repeat(this.seq.length) + '○'.repeat(4 - this.seq.length); }
  press(b) { if (this.lock || b.classList.contains('down')) return; const g = this.game; b.classList.add('down'); this.seq.push(b.dataset.s); g.audio.clunk(); this.draw(); if (this.seq.length === 4) { this.lock = true; setTimeout(() => this.check(), 700); } }
  check() { const g = this.game, s = this.seq.join(','), msg = $('pzMsg');
    if (s === SOLUTION.join(',')) { g.audio.metal(0.5, 0.25); msg.innerHTML = g.lang.markup('Algo muy grande se mueve dentro de la pared.'); setTimeout(() => this.close(true), 1300); return; }
    g.state.tries++; g.audio.wrong(); g.camShake(0.12);
    const t = s === PRAYER.join(',') ? 'Las placas suben otra vez. Esa es la oración para entrar. Tú no quieres entrar.' : (g.state.tries >= 3 && !g.f.doc_oracion) ? 'Nada. Necesitas las palabras de la oración. No están aquí.' : 'Nada. Las placas suben otra vez. Detrás de ti, algo respira.';
    msg.innerHTML = g.lang.markup(t); g.lang.learn(t); g.addCordura(-9); g.saveSoon();
    setTimeout(() => { this.seq = []; this.lock = false; $('plates').querySelectorAll('.plate').forEach(p => p.classList.remove('down')); this.draw(); }, 900); }
  close(ok) { if (!this.res) return; $('puzzle').classList.add('hidden'); this.game.ui.modal = null; const r = this.res; this.res = null; r(ok); }
}

/* ---------- UIManager ---------- */
export class UIManager {
  /** help: ayuda de controles (HTML) del modo; badge: tecla/botón de acción junto al verbo. */
  constructor(game, { help = '', badge = false } = {}) { this.game = game; this.help = help; this.badge = badge; this.modal = null; this.tab = 0; this.selItem = null; this.combine = false; this.selDoc = null; this.selArch = null; this.docRes = null; this.flashT = 0; this.bind(); }
  bind() { const g = this.game; document.addEventListener('pointerdown', () => { this.pdT = performance.now(); }, true);
    // un botón con foco se activaría con Espacio/Intro al avanzar el diálogo: se le quita el foco
    document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b) b.blur(); }, true);
    $('hbInv').addEventListener('click', () => g.canAct() && this.openBook(0)); $('hbCua').addEventListener('click', () => g.canAct() && this.openBook(1)); $('hbPau').addEventListener('click', () => g.togglePause());
    $('bookClose').addEventListener('click', () => this.closeBook());
    $('doc').addEventListener('click', e => { if (!e.target.closest('.w') && !this.guarded()) this.closeDoc(); });
    $('pause').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; const a = b.dataset.p; g.audio.ui();
      if (a === 'resume') g.togglePause(); else if (a === 'save') { g.saveNow(); this.toast('Partida guardada'); g.togglePause(); } else if (a === 'book') { this.modal = null; $('pause').classList.add('hidden'); this.openBook(1); }
      else if (a === 'mute') { g.setMuted(!g.audio.muted); this.syncSound(); } else if (a === 'voz') { g.audio.voz = !g.audio.voz; g.saveSettings(); this.syncSound(); } else if (a === 'title') { g.saveNow(); location.reload(); } });
    $('volR').addEventListener('input', e => { g.audio.setVolume(e.target.value / 100); g.saveSettings(); });
    // consulta de palabras: toque o clic sobre una palabra subrayada
    document.addEventListener('click', e => { const w = e.target.closest && e.target.closest('.w'); const tip = $('tip'); if (!w) { tip.classList.add('hidden'); return; }
      const en = g.lang.entry(w.dataset.k); if (!en) return; tip.innerHTML = `<b>${esc(en.k)}</b>${esc(en.d)}<em>«${esc(en.e)}»</em>`; tip.classList.remove('hidden'); w.classList.remove('new');
      const r = w.getBoundingClientRect(), tw = Math.min(290, window.innerWidth - 16); tip.style.left = clamp(r.left + r.width / 2 - tw / 2, 8, window.innerWidth - tw - 8) + 'px'; tip.style.top = ''; tip.style.bottom = (window.innerHeight - r.top + 8) + 'px';
      if (r.top < 150) { tip.style.bottom = ''; tip.style.top = (r.bottom + 8) + 'px'; } }, true);
    $('keysHelp').innerHTML = this.help;
  }
  /* Tras abrir un panel con un toque, el «click» sintético del mismo toque cae sobre el panel: se ignora un instante. */
  guard() { this.openT = performance.now(); }
  guarded() { return (this.pdT || 0) <= (this.openT || -1); }   // el «click» pertenece a un toque anterior a la apertura
  syncSound() { const a = this.game.audio; $('muteB').textContent = a.muted ? 'Sonido: no' : 'Sonido: sí'; $('tSnd').textContent = a.muted ? 'Sonido: no' : 'Sonido: sí'; $('vozB').textContent = a.voz ? 'Voces habladas: sí' : 'Voces habladas: no'; $('volR').value = Math.round(a.vol * 100); }
  toast(html) { const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = html; const t = $('toast'); t.appendChild(d); while (t.children.length > 4) t.removeChild(t.firstChild); setTimeout(() => d.remove(), 4300); }
  zone(z) { const el = $('zona'); el.innerHTML = `<small>${z.n}</small>${esc(z.name)}`; el.style.opacity = 1; clearTimeout(this.zt); this.zt = setTimeout(() => { el.style.opacity = 0; }, 3200); }
  flash(t) { this.flashTxt = t; this.flashT = performance.now() + 1400; }
  prompt(verb, near) { const el = $('prompt'), now = performance.now(); let html = null;
    if (this.flashT > now) html = esc(this.flashTxt); else if (verb) html = this.badge && near ? `<b>${document.body.classList.contains('touch') ? '◉' : 'E'}</b>${esc(verb)}` : esc(verb);
    if (html !== this._p) { this._p = html; if (html) el.innerHTML = html; el.style.opacity = html ? 1 : 0; } }
  estado(c, threat) { const lab = threat > 0.3 ? 'Pánico' : c > 70 ? 'Tranquilo' : c > 40 ? 'Nervioso' : c > 15 ? 'Miedo' : 'Pánico'; if (lab !== this._e) { this._e = lab; $('estadoTxt').textContent = lab; }
    const p = $('pupila'); p.setAttribute('r', (1.6 + 2.8 * c / 100 - threat).toFixed(2)); p.setAttribute('fill', c < 40 || threat > 0.3 ? '#a8351f' : '#8f8a80'); $('parpado').style.display = 'none'; }
  fade(on, txt, ms) { const f = $('fade'), t = $('fadeTxt'); f.style.transitionDuration = (ms == null ? 1200 : ms) + 'ms'; f.style.opacity = on ? 1 : 0; if (txt != null) { t.textContent = txt; t.style.opacity = txt ? 1 : 0; } else t.style.opacity = 0; return new Promise(r => setTimeout(r, (ms == null ? 1200 : ms) + 50)); }
  fadeText(txt) { const t = $('fadeTxt'); t.style.opacity = 0; return new Promise(r => setTimeout(() => { t.textContent = txt; t.style.opacity = txt ? 1 : 0; setTimeout(r, 1500); }, 700)); }

  /* --- documento a pantalla completa --- */
  showDoc(id) { const g = this.game, d = DOCS[id], text = d.text(g.f); return new Promise(res => { this.modal = 'doc'; this.docRes = res; this.guard(); g.audio.page();
      $('docBody').innerHTML = `<div class="paper ${d.cls}">${g.lang.markup(text)}</div>`; $('docHint').textContent = document.body.classList.contains('touch') ? 'Toca para cerrar' : 'E — cerrar'; $('doc').classList.remove('hidden'); $('docBody').scrollTop = 0; }); }
  closeDoc() { if (this.modal !== 'doc') return; $('doc').classList.add('hidden'); this.modal = null; this.game.audio.page(); const r = this.docRes; this.docRes = null; if (r) r(); }

  /* --- libro: inventario, cuaderno, diccionario, archivo, ecos --- */
  openBook(tab) { if (this.modal && this.modal !== 'book') return; this.modal = 'book'; this.tab = tab; this.combine = false; $('book').classList.remove('hidden'); this.game.audio.page(); this.renderBook(); }
  closeBook() { if (this.modal !== 'book') return; $('book').classList.add('hidden'); this.modal = null; $('tip').classList.add('hidden'); this.game.audio.page(); }
  renderBook() { const g = this.game, st = g.state, names = ['Inventario', 'Cuaderno', 'Diccionario', 'Archivo', 'Ecos'];
    $('bookTabs').innerHTML = names.map((n, i) => `<button class="tab${i === this.tab ? ' on' : ''}" data-t="${i}">${n}</button>`).join('');
    $('bookTabs').querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => { this.tab = +b.dataset.t; this.combine = false; g.audio.ui(); this.renderBook(); }));
    const body = $('bookBody'); let h = '', foot = '';
    if (this.tab === 0) { if (!st.inv.includes(this.selItem)) this.selItem = st.inv[0] || null;
      h = '<div class="slots">' + Array.from({ length: MAX_SLOTS }, (_, i) => { const id = st.inv[i]; return id ? `<button class="slot full${id === this.selItem ? (this.combine ? ' comb' : ' sel') : ''}" data-i="${id}"><svg viewBox="0 0 20 20"><path d="${ITEMS[id].icon}"/></svg><small>${esc(ITEMS[id].name)}</small></button>` : '<div class="slot"></div>'; }).join('') + '</div>';
      const it = this.selItem && ITEMS[this.selItem];
      h += '<div class="idesc">' + (it ? `<h4>${esc(it.name)}</h4><p>${g.lang.markup(esc(it.desc))}</p>` + (this.combine ? `<p style="color:#c9694c">¿Con qué objeto? Elige otro objeto.</p><button class="btn" data-a="cancel">Cancelar</button>` : `<button class="btn" data-a="use">${it.drink ? 'Beber' : 'Usar'}</button><button class="btn" data-a="comb">Combinar</button>`) : '<p class="empty">No tienes nada.</p>') + '</div>';
      foot = `${st.inv.length} / ${MAX_SLOTS} objetos`; }
    else if (this.tab === 1) { const docs = st.docs; if (!docs.includes(this.selDoc) && this.selDoc !== '_voces') this.selDoc = docs[docs.length - 1] || (st.log.length ? '_voces' : null);
      if (!docs.length && !st.log.length) h = '<p class="empty">El cuaderno está vacío. Aquí guardas las notas, los documentos y las voces.</p>';
      else { h = '<div class="two"><div class="list"><div class="cat">Documentos</div>' + docs.map(id => `<button data-d="${id}" class="${id === this.selDoc ? 'on' : ''}">${esc(DOCS[id].title)}</button>`).join('') + (st.log.length ? `<div class="cat">Voces</div><button data-d="_voces" class="${this.selDoc === '_voces' ? 'on' : ''}">Lo que dicen</button>` : '') + '</div><div>';
        if (this.selDoc === '_voces') h += st.log.map(l => `<p style="margin:0 0 9px;line-height:1.45"><span style="color:#8a3a22;letter-spacing:.14em;font-size:12px;text-transform:uppercase">${esc(l.w)}</span><br>${g.lang.markup(esc(l.t))}</p>`).join('');
        else if (this.selDoc) { const d = DOCS[this.selDoc]; h += `<div class="tag">${esc(d.where)}</div><div class="paper ${d.cls}">${g.lang.markup(d.text(g.f))}</div>`; }
        h += '</div></div>'; }
      foot = `${docs.length} / ${Object.keys(DOCS).length} documentos`; }
    else if (this.tab === 2) { const ws = st.words.slice().sort((a, b) => a.localeCompare(b, 'es')); h = ws.length ? '<div class="dic">' + ws.map(k => { const e = g.lang.entry(k); return e ? `<div class="dw"><b>${esc(e.k)}</b><p>${esc(e.d)}</p><em>«${esc(e.e)}»</em></div>` : ''; }).join('') + '</div>' : '<p class="empty">Todavía no conoces ninguna palabra de este lugar.</p>'; foot = `${ws.length} / ${LEX.length} palabras`; }
    else if (this.tab === 3) { const ar = st.archive; if (!ar.includes(this.selArch)) this.selArch = ar[ar.length - 1] || null;
      if (!ar.length) h = '<p class="empty">El archivo está vacío. Aquí unes las piezas: qué es verdad, quién lo dice y qué piensas tú.</p>';
      else { const cats = []; Object.keys(ARCHIVE).forEach(id => { if (ar.includes(id) && !cats.includes(ARCHIVE[id].cat)) cats.push(ARCHIVE[id].cat); });
        h = '<div class="two"><div class="list">' + cats.map(c => `<div class="cat">${esc(c)}</div>` + Object.keys(ARCHIVE).filter(id => ar.includes(id) && ARCHIVE[id].cat === c).map(id => `<button data-r="${id}" class="${id === this.selArch ? 'on' : ''}">${esc(ARCHIVE[id].title)}</button>`).join('')).join('') + '</div><div class="arch">';
        const a = ARCHIVE[this.selArch]; if (a) h += `<span class="tag ${a.tipo}">${{ h: 'Hecho: lo que ves', t: 'Testimonio: lo que dicen', i: 'Hipótesis: lo que piensas' }[a.tipo]}</span><h4 style="margin:0 0 10px;font-weight:normal;font-size:21px;color:#e8dfca">${esc(a.title)}</h4>` + a.text.split('\n\n').map(p => `<p>${g.lang.markup(esc(p))}</p>`).join('');
        h += '</div></div>'; }
      foot = `${ar.length} / ${Object.keys(ARCHIVE).length} fragmentos`; }
    else { h = '<p style="color:#8f8a80;line-height:1.5;margin-top:0">En la niebla hay voces. Repiten palabras que ya conoces. Si las entiendes, tienes menos miedo.</p>' + (st.ecos.length ? st.ecos.map(id => `<div class="dw"><b>${g.lang.markup(esc(ECOS[id].full))}</b><p>${esc(ZONES[ECOS[id].zone].name)}</p></div>`).join('') : '<p class="empty">Todavía no tienes ningún eco.</p>'); foot = `${st.ecos.length} / ${Object.keys(ECOS).length} ecos`; }
    body.innerHTML = h; $('bookFoot').textContent = foot;
    body.querySelectorAll('[data-i]').forEach(b => b.addEventListener('click', () => { const id = b.dataset.i; g.audio.ui();
      if (this.combine && id !== this.selItem) { const ok = g.inv.combine(this.selItem, id); this.combine = false; if (ok) { this.selItem = 'linterna_ok'; g.sync(); } else this.toast('No puedo combinar estas cosas'); } else this.selItem = id; this.renderBook(); }));
    body.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => { const a = b.dataset.a; g.audio.ui(); if (a === 'comb') { this.combine = true; this.renderBook(); } else if (a === 'cancel') { this.combine = false; this.renderBook(); } else { const id = this.selItem; this.closeBook(); g.useItem(id); } }));
    body.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', () => { this.selDoc = b.dataset.d; g.audio.page(); this.renderBook(); }));
    body.querySelectorAll('[data-r]').forEach(b => b.addEventListener('click', () => { this.selArch = b.dataset.r; g.audio.page(); this.renderBook(); }));
  }
  showEnd(stats) { $('endStats').innerHTML = stats.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join(''); $('end').classList.remove('hidden'); $('hud').classList.add('hidden'); $('touch').classList.add('hidden'); }
}
