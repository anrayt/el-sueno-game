/* =====================================================================
   AudioManager — todo el sonido es procedural (Web Audio API).
   Capas: drone doom (sierras saturadas), viento, zumbido eléctrico,
   radio, eventos aleatorios (metal, voces, campanas FM, glitch),
   bus de amenaza (sub + clúster disonante + latido) y efectos.
   ===================================================================== */
export class AudioManager {
  constructor() {
    this.ctx = null; this.vol = 0.8; this.muted = false; this.voz = true;
    this.ready = false; this.nextEvent = 4; this.nextRing = 0; this.nextBeat = 0; this.nextRiff = 6;
    this.threat = 0; this.zone = 'callejon'; this.riffI = 0;
  }
  /** Debe llamarse dentro de un gesto del usuario (Safari/iOS). */
  init() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = this.muted ? 0 : this.vol;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 5;
      this.master.connect(comp); comp.connect(c.destination);
      this.amb = c.createGain(); this.amb.connect(this.master);
      this.sfx = c.createGain(); this.sfx.connect(this.master);
      this.thr = c.createGain(); this.thr.gain.value = 0; this.thr.connect(this.master);
      // reverberación: respuesta al impulso generada (ruido con caída exponencial)
      const len = c.sampleRate * 2.8, ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
      this.rev = c.createConvolver(); this.rev.buffer = ir;
      const rg = c.createGain(); rg.gain.value = 0.5; this.rev.connect(rg); rg.connect(this.master);
      // eco con realimentación filtrada
      this.dly = c.createDelay(1.5); this.dly.delayTime.value = 0.43;
      const fb = c.createGain(); fb.gain.value = 0.5; const fl = c.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400;
      this.dly.connect(fl); fl.connect(fb); fb.connect(this.dly); fl.connect(this.rev); fl.connect(this.amb);
      // ruido blanco/rosa reutilizable
      const nb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), nd = nb.getChannelData(0);
      let b0 = 0, b1 = 0, b2 = 0;
      for (let i = 0; i < nd.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.997 * b0 + 0.03 * w; b1 = 0.985 * b1 + 0.03 * w; b2 = 0.95 * b2 + 0.05 * w; nd[i] = (b0 + b1 + b2 + w * 0.12) * 1.6; }
      this.noiseBuf = nb;
      this._drone(); this._wind(); this._hum(); this._radio(); this._threat();
      this.ready = true;
    } catch (e) { console.warn('audio', e); this.ctx = null; }
  }
  _noise() { const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true; s.start(0, Math.random() * 2); return s; }
  _curve(k) { const n = 512, a = new Float32Array(n); for (let i = 0; i < n; i++) { const x = i / (n - 1) * 2 - 1; a[i] = Math.tanh(x * k); } return a; }
  _drone() {
    const c = this.ctx; this.droneOsc = [];
    const pre = c.createGain(); pre.gain.value = 0.9;
    const ws = c.createWaveShaper(); ws.curve = this._curve(4.5);
    const lp = this.droneLP = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 170; lp.Q.value = 3;
    const g = this.droneG = c.createGain(); g.gain.value = 0.0;
    [[1, 'sawtooth', .5], [1.007, 'sawtooth', .4], [0.5, 'square', .35], [1.498, 'sawtooth', .16]].forEach(([m, t, v]) => {
      const o = c.createOscillator(); o.type = t; o.frequency.value = 41.2 * m; const og = c.createGain(); og.gain.value = v;
      o.connect(og); og.connect(pre); o.start(); this.droneOsc.push([o, m]);
    });
    pre.connect(ws); ws.connect(lp); lp.connect(g); g.connect(this.amb); g.connect(this.rev);
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07; const lg = c.createGain(); lg.gain.value = 70; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
  }
  _wind() {
    const c = this.ctx, n = this._noise();
    const bp = this.windBP = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.9;
    const g = this.windG = c.createGain(); g.gain.value = 0;
    n.connect(bp); bp.connect(g); g.connect(this.amb);
    const l = c.createOscillator(); l.frequency.value = 0.11; const lg = c.createGain(); lg.gain.value = 190; l.connect(lg); lg.connect(bp.frequency); l.start();
    const l2 = c.createOscillator(); l2.frequency.value = 0.043; const l2g = c.createGain(); l2g.gain.value = 0.04; l2.connect(l2g); l2g.connect(g.gain); l2.start();
  }
  _hum() {
    const c = this.ctx, g = this.humG = c.createGain(); g.gain.value = 0;
    [[50, .5], [100, .3], [150, .22], [250, .08]].forEach(([f, v]) => { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; const og = c.createGain(); og.gain.value = v; o.connect(og); og.connect(g); o.start(); });
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; g.connect(lp); lp.connect(this.amb);
  }
  _radio() {
    const c = this.ctx, n = this._noise(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 1.6;
    const g = this.radioG = c.createGain(); g.gain.value = 0;
    const am = c.createGain(); am.gain.value = 0.6; const l = c.createOscillator(); l.type = 'square'; l.frequency.value = 0.9; const lg = c.createGain(); lg.gain.value = 0.35; l.connect(lg); lg.connect(am.gain); l.start();
    n.connect(bp); bp.connect(am); am.connect(g);
    // portadora que «silba» entre emisoras
    const o = c.createOscillator(); o.frequency.value = 880; const og = c.createGain(); og.gain.value = 0.05; const l3 = c.createOscillator(); l3.frequency.value = 0.19; const l3g = c.createGain(); l3g.gain.value = 300; l3.connect(l3g); l3g.connect(o.frequency); l3.start(); o.start(); o.connect(og); og.connect(g);
    g.connect(this.amb);
  }
  _threat() {
    const c = this.ctx;
    const sub = c.createOscillator(); sub.frequency.value = 31; const sg = c.createGain(); sg.gain.value = 0.9; sub.connect(sg); sg.connect(this.thr); sub.start();
    const n = this._noise(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 90; const ng = c.createGain(); ng.gain.value = 1.3; n.connect(lp); lp.connect(ng); ng.connect(this.thr);
    const hg = this.thrHi = c.createGain(); hg.gain.value = 0.035;
    [1870, 1981, 2096, 2794].forEach((f, i) => { const o = c.createOscillator(); o.frequency.value = f; const v = c.createOscillator(); v.frequency.value = 4 + i; const vg = c.createGain(); vg.gain.value = 9; v.connect(vg); vg.connect(o.frequency); v.start(); o.connect(hg); o.start(); });
    hg.connect(this.thr); hg.connect(this.rev);
  }
  setVolume(v) { this.vol = v; this._applyVol(); }
  setMuted(m) { this.muted = m; this._applyVol(); if (m && window.speechSynthesis) speechSynthesis.cancel(); }
  _applyVol() { if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : this.vol, this.ctx.currentTime, 0.05); }
  suspend(on) { if (!this.ctx) return; (on ? this.ctx.suspend() : this.ctx.resume()).catch(() => {}); }

  /** Mezcla dinámica. s: {zone, threat 0..1, hum 0..1, radio 0..1, ring 0..1 (0 = no suena), red:boolean} */
  update(dt, s) {
    if (!this.ready) return;
    const c = this.ctx, t = c.currentTime, T = (p, v, k = 0.6) => p.setTargetAtTime(v, t, k);
    this.zone = s.zone; this.threat = s.threat;
    const Z = { callejon: [.20, .16, 300], plaza: [.24, .15, 420], tienda: [.05, .11, 200], pasaje: [.03, .26, 140], puerta: [.12, .24, 260] }[s.zone] || [.2, .15, 300];
    T(this.windG.gain, Z[0]); T(this.droneG.gain, Z[1] * (s.red ? 1.35 : 1)); T(this.windBP.frequency, Z[2], 2);
    T(this.humG.gain, 0.045 * s.hum, 0.3); T(this.radioG.gain, 0.11 * s.radio, 0.3);
    // amenaza: sube el sub, se apaga el mundo
    T(this.thr.gain, s.threat * 0.8, 0.4); T(this.amb.gain, 1 - 0.8 * s.threat, 0.5); T(this.thrHi.gain, 0.02 + 0.07 * s.threat, 0.4);
    // riff lento: la raíz del drone se desliza entre notas (mi-fa-si♭: segunda menor y tritono)
    if (t > this.nextRiff) {
      const notes = [41.2, 41.2, 43.65, 41.2, 58.27, 55, 36.71, 41.2, 49, 46.25];
      const f = notes[this.riffI++ % notes.length]; this.droneOsc.forEach(([o, m]) => o.frequency.setTargetAtTime(f * m, t, 1.2));
      this.nextRiff = t + 7 + Math.random() * 8;
    }
    if (s.ring > 0 && t > this.nextRing) { this._ring(s.ring); this.nextRing = t + 3.2; }
    if (s.threat > 0.15 && t > this.nextBeat) { this._beat(s.threat); this.nextBeat = t + 1.0 - 0.5 * s.threat; }
    if (t > this.nextEvent && s.threat < 0.2) { this._event(s.zone); this.nextEvent = t + 5 + Math.random() * 11; }
  }
  /* ---- envolvente utilitaria ---- */
  _env(g, t, a, d, peak) { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  _tone(f, type, a, d, peak, dest, when = 0, bend = 0) {
    const c = this.ctx, t = c.currentTime + when, o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.setValueAtTime(f, t);
    if (bend) o.frequency.exponentialRampToValueAtTime(Math.max(20, f * bend), t + a + d);
    this._env(g, t, a, d, peak); o.connect(g); g.connect(dest || this.sfx); o.start(t); o.stop(t + a + d + 0.05); return g;
  }
  _burst(freq, q, a, d, peak, dest, when = 0, type = 'bandpass') {
    const c = this.ctx, t = c.currentTime + when, s = c.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = c.createGain();
    this._env(g, t, a, d, peak); s.connect(f); f.connect(g); g.connect(dest || this.sfx); s.start(t, Math.random() * 2); s.stop(t + a + d + 0.05); return f;
  }
  _ring(v) { [0, 0.5].forEach(w => { [425, 480].forEach(f => { const g = this._tone(f, 'sine', 0.02, 0.36, 0.09 * v, this.sfx, w); g.connect(this.rev); }); this._tone(25, 'square', 0.01, 0.36, 0.02 * v, this.sfx, w); }); }
  _beat(v) { this._tone(52, 'sine', 0.01, 0.16, 0.5 * v, this.sfx, 0, 0.6); this._tone(46, 'sine', 0.01, 0.2, 0.35 * v, this.sfx, 0.19, 0.6); }
  /** Eventos ambientales aleatorios: nunca el mismo sonido dos veces seguidas. */
  _event(zone) {
    const pool = { callejon: ['metal', 'drip', 'knock', 'voz', 'fm'], plaza: ['metal', 'voz', 'fm', 'glitch', 'bell', 'knock'], tienda: ['glitch', 'fm', 'creak', 'drip'], pasaje: ['metal', 'voz', 'breath', 'drip'], puerta: ['bell', 'metal', 'voz', 'fm'] }[zone] || ['metal'];
    let e; do { e = pool[Math.floor(Math.random() * pool.length)]; } while (e === this.lastEv && pool.length > 1); this.lastEv = e;
    const send = this.dly;
    if (e === 'metal') this.metal(0.5 + Math.random(), 0.08, send);
    else if (e === 'drip') { for (let i = 0; i < 3; i++) this._tone(900 + Math.random() * 900, 'sine', 0.002, 0.07, 0.04, send, i * (0.3 + Math.random() * 0.5), 1.8); }
    else if (e === 'knock') this.knock(0.12);
    else if (e === 'voz') this.voices(0.06);
    else if (e === 'fm') { // campanas FM desafinadas, sueltas
      const base = [220, 246.9, 261.6, 311.1, 370][Math.floor(Math.random() * 5)] * (Math.random() < 0.5 ? 1 : 2);
      for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) this._fm(base * [1, 1.189, 1.498, 0.943][Math.floor(Math.random() * 4)], 0.045, i * (0.4 + Math.random() * 0.9), send);
    } else if (e === 'glitch') { for (let i = 0; i < 9; i++) this._burst(800 + Math.random() * 5000, 6, 0.002, 0.03, 0.05, send, i * 0.06 + Math.random() * 0.03); }
    else if (e === 'bell') this.bell(0.06);
    else if (e === 'creak') this.creak(0.05);
    else if (e === 'breath') { this._burst(700, 1, 0.9, 1.1, 0.05, this.rev); }
  }
  _fm(f, v, when, dest) {
    const c = this.ctx, t = c.currentTime + when, car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain(), g = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.51; mg.gain.setValueAtTime(f * 2.4, t); mg.gain.exponentialRampToValueAtTime(1, t + 2.2);
    mod.connect(mg); mg.connect(car.frequency); this._env(g, t, 0.005, 3, v); car.connect(g); g.connect(dest); g.connect(this.rev);
    car.start(t); mod.start(t); car.stop(t + 3.2); mod.stop(t + 3.2);
  }
  /* ---- efectos públicos ---- */
  metal(pitch = 1, v = 0.15, dest) { if (!this.ready) return; [211, 347, 523, 811, 1307, 1723].forEach((f, i) => { const g = this._tone(f * pitch * (1 + Math.random() * 0.01), 'sine', 0.003, 2.6 - i * 0.3, v / (i + 1), dest || this.sfx); g.connect(this.rev); }); this._burst(3000, 1, 0.001, 0.05, v, dest || this.sfx); }
  knock(v = 0.2) { if (!this.ready) return; [0, 0.22, 0.44].forEach(w => { this._tone(95, 'sine', 0.002, 0.12, v, this.rev, w, 0.5); this._burst(300, 2, 0.001, 0.05, v * 0.7, this.rev, w); }); }
  voices(v = 0.08) { // «voces lejanas»: sierra a través de formantes vocales que se mueven
    if (!this.ready) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(110 + Math.random() * 60, t); o.frequency.linearRampToValueAtTime(95 + Math.random() * 70, t + 2.2);
    const g = c.createGain(); this._env(g, t, 0.5, 2, v);
    [[700, 1100], [300, 2300], [450, 800]].forEach(([a, b]) => { const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 9; f.frequency.setValueAtTime(a, t); f.frequency.linearRampToValueAtTime(b, t + 1.2); f.frequency.linearRampToValueAtTime(a, t + 2.4); o.connect(f); f.connect(g); });
    g.connect(this.rev); g.connect(this.dly); o.start(t); o.stop(t + 2.7);
  }
  bell(v = 0.12) { if (!this.ready) return; [0, 2.4].forEach(w => [130.8, 196.5, 262.9, 329, 392.9, 553].forEach((f, i) => { const g = this._tone(f, 'sine', 0.005, 5 - i * 0.5, v / (1 + i * 0.6), this.rev, w); g.connect(this.sfx); })); }
  creak(v = 0.12) { if (!this.ready) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(140, t + 0.5); o.frequency.linearRampToValueAtTime(92, t + 1.1);
    f.type = 'bandpass'; f.frequency.setValueAtTime(900, t); f.frequency.linearRampToValueAtTime(1900, t + 0.6); f.Q.value = 12; this._env(g, t, 0.15, 1.0, v * 3);
    o.connect(f); f.connect(g); g.connect(this.sfx); g.connect(this.rev); o.start(t); o.stop(t + 1.3); }
  step(surface, run) { if (!this.ready) return; const v = (run ? 0.11 : 0.07) * (0.8 + Math.random() * 0.4);
    if (surface === 'wood') { this._tone(120 + Math.random() * 30, 'sine', 0.002, 0.07, v * 1.4, this.sfx, 0, 0.6); this._burst(700, 1.5, 0.001, 0.04, v * 0.6); }
    else if (surface === 'stone') { this._burst(1500 + Math.random() * 400, 1.2, 0.001, 0.06, v, this.sfx); this._burst(1500, 1.2, 0.001, 0.2, v * 0.5, this.rev); }
    else { this._burst(900 + Math.random() * 500, 0.8, 0.002, 0.07, v); this._burst(3500, 2, 0.004, 0.09, v * 0.35); } }
  ui() { if (this.ready) this._tone(660, 'sine', 0.002, 0.05, 0.035); }
  page() { if (this.ready) this._burst(2400, 0.7, 0.01, 0.16, 0.06); }
  pickup() { if (!this.ready) return; this._tone(392, 'triangle', 0.005, 0.25, 0.07, this.dly); this._tone(587, 'triangle', 0.005, 0.4, 0.06, this.dly, 0.09); }
  word() { if (this.ready) this._fm(880, 0.02, 0, this.dly); }
  clunk() { if (!this.ready) return; this._tone(70, 'sine', 0.002, 0.2, 0.3, this.sfx, 0, 0.5); this._burst(500, 1, 0.001, 0.08, 0.2); }
  coin() { if (!this.ready) return; [2400, 3150, 4100].forEach((f, i) => this._tone(f, 'sine', 0.001, 0.5, 0.05, this.sfx, i * 0.07)); }
  fizz() { if (this.ready) { this.clunk(); this._burst(5000, 0.7, 0.05, 0.9, 0.05, this.sfx, 0.25, 'highpass'); } }
  rattle() { if (!this.ready) return; for (let i = 0; i < 6; i++) { this._burst(600 + Math.random() * 600, 2, 0.001, 0.05, 0.22, this.sfx, i * 0.07); } this.metal(0.7, 0.1); }
  sting() { if (!this.ready) return; [61, 64.6, 91.4].forEach(f => this._tone(f, 'sawtooth', 0.01, 2.6, 0.22, this.rev)); this._burst(2500, 0.5, 0.005, 1.4, 0.2, this.rev); this._tone(2960, 'sine', 0.3, 2, 0.05, this.rev, 0, 0.94); }
  wrong() { if (!this.ready) return; this._tone(58, 'sawtooth', 0.01, 1.3, 0.25, this.rev, 0, 0.8); this.metal(0.4, 0.14); }
  whisper() { if (!this.ready) return; const f = this._burst(1800, 3, 0.4, 1.6, 0.09, this.rev); f.frequency.linearRampToValueAtTime(900, this.ctx.currentTime + 2); this._fm(523, 0.03, 0.2, this.dly); }
  ecoOk() { if (!this.ready) return; [392, 493.9, 587.3].forEach((f, i) => this._fm(f, 0.035, i * 0.22, this.dly)); }
  gateOpen() { if (!this.ready) return; this.clunk(); const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 26; i++) this._burst(160 + Math.random() * 240, 3, 0.01, 0.16, 0.16, this.rev, 0.5 + i * 0.14);
    const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(48, t + 0.5); o.frequency.linearRampToValueAtTime(74, t + 4.4);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 7; g.gain.setValueAtTime(0.0001, t + 0.5); g.gain.linearRampToValueAtTime(0.5, t + 1.6); g.gain.linearRampToValueAtTime(0.0001, t + 4.6);
    o.connect(f); f.connect(g); g.connect(this.rev); g.connect(this.sfx); o.start(t + 0.5); o.stop(t + 4.8);
    setTimeout(() => { this.metal(0.35, 0.3); this.bell(0.14); }, 4400); }
  /** Voz hablada (frases para escuchar). Usa la síntesis del navegador si hay voz española. */
  speak(text, o = {}) {
    try {
      if (!this.voz || this.muted || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
      const u = new SpeechSynthesisUtterance(text.replace(/[«»()…]/g, ' ')); u.lang = 'es-ES';
      const v = speechSynthesis.getVoices().filter(x => /^es([-_]ES)?/i.test(x.lang)); const es = v.find(x => /es[-_]ES/i.test(x.lang)) || v[0]; if (es) u.voice = es;
      u.rate = o.rate || 0.82; u.pitch = o.pitch == null ? 0.5 : o.pitch; u.volume = Math.min(1, this.vol * (o.vol || 0.9));
      speechSynthesis.cancel(); speechSynthesis.speak(u);
    } catch (e) { /* sin voz: el texto siempre está en pantalla */ }
  }
  hush() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} }
}
