import * as THREE from 'three';
import { clamp, PI, rng } from './util.js';
import { DOCS, SYMBOLS } from './data.js';
import { canvasTex, TEX, buildTextures, textTex, paintText, scaleBoxUV, paintTextRaw } from './textures.js';
import { makeWatcher, makeAnselmo } from './characters.js';
/* =====================================================================
   MUNDO: geometría de las zonas, luces, objetos interactivos, cámaras fijas,
   postproceso. Texturas en textures.js, personajes en characters.js, jugador en player.js.
   Mapa (metros, -Z = norte):
     Callejón  x[-2.5,2.5]  z[-22,2]
     Plaza     x[-13,13]    z[-48,-22]
     Tienda    x[13.3,23]   z[-39,-29]   (puerta en x=13, z[-35,-33])
     Pasaje    x[-2,2]      z[-74,-48]
     Puerta    x[-5,5]      z[-84,-74]   (verja en z=-84)
   ===================================================================== */
export class SceneManager {
  constructor(game) {
    this.game = game; this.scene = new THREE.Scene(); this.colliders = []; this.circles = []; this.inter = []; this.d = {}; this.flick = []; this.motes = [];
    this.fogBase = new THREE.Color(0x1b1d1e); this.fogRed = new THREE.Color(0x2a1512);
    this.scene.fog = new THREE.FogExp2(this.fogBase.getHex(), 0.045); this.scene.background = this.fogBase.clone();
  }
  /* --- constructores cortos --- */
  mat(tex, color, o = {}) { return new THREE.MeshLambertMaterial(Object.assign({ map: tex || null, color: color == null ? 0xffffff : color }, o)); }
  B(w, h, d, m, x, y, z, o = {}) { const g = new THREE.BoxGeometry(w, h, d); if (o.uv) scaleBoxUV(g, w, h, d, o.uv); const me = new THREE.Mesh(g, m); me.position.set(x, y, z); if (o.ry) me.rotation.y = o.ry; if (o.rx) me.rotation.x = o.rx; if (o.rz) me.rotation.z = o.rz; (o.p || this.scene).add(me); return me; }
  C(rt, rb, h, m, x, y, z, o = {}) { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, o.seg || 8), m); me.position.set(x, y, z); if (o.rx) me.rotation.x = o.rx; if (o.rz) me.rotation.z = o.rz; if (o.ry) me.rotation.y = o.ry; (o.p || this.scene).add(me); return me; }
  P(w, h, m, x, y, z, ry = 0, rx = 0, p) { const me = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m); me.position.set(x, y, z); me.rotation.set(rx, ry, 0, 'YXZ'); (p || this.scene).add(me); return me; }
  col(x1, z1, x2, z2, on) { const c = { x1: Math.min(x1, x2), x2: Math.max(x1, x2), z1: Math.min(z1, z2), z2: Math.max(z1, z2), on }; this.colliders.push(c); return c; }
  wall(x1, z1, x2, z2, h, m, uv) { const w = Math.abs(x2 - x1), d = Math.abs(z2 - z1); this.col(x1, z1, x2, z2); return this.B(w, h, d, m, (x1 + x2) / 2, h / 2, (z1 + z2) / 2, { uv: uv || [4, 4] }); }
  light(color, int, dist, x, y, z, flicker) { const l = new THREE.PointLight(color, int, dist, 1.6); l.position.set(x, y, z); this.scene.add(l); l.userData.base = int; if (flicker) this.flick.push({ l, mode: flicker, t: Math.random() * 9 }); return l; }
  addInter(id, x, z, o = {}) { const it = Object.assign({ id, x, z, y: 1, r: 1.7, verb: 'Mirar', hit: [0.9, 1.2, 0.9], on: () => true }, o);
    const hb = new THREE.Mesh(new THREE.BoxGeometry(it.hit[0], it.hit[1], it.hit[2]), new THREE.MeshBasicMaterial()); hb.position.set(o.hx == null ? x : o.hx, it.y, o.hz == null ? z : o.hz); hb.visible = false; hb.userData.inter = it; this.scene.add(hb); it.hitbox = hb;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.fog, color: 0xd8c890, transparent: true, opacity: 0, depthWrite: false, fog: false })); sp.scale.set(0.3, 0.3, 1); sp.position.set(hb.position.x, it.gy == null ? it.y + 0.15 : it.gy, hb.position.z); this.scene.add(sp); it.glint = sp;
    this.inter.push(it); return it; }

  build() {
    buildTextures(); const S = this.scene, d = this.d;
    S.add(new THREE.AmbientLight(0x4a5058, 0.85)); S.add(new THREE.HemisphereLight(0x5a6068, 0x18140f, 0.5));
    const M = this.M = {
      asphalt: new THREE.MeshPhongMaterial({ map: TEX.asphalt, color: 0x9a9a9a, specular: 0x30363a, shininess: 38 }),
      cobble: new THREE.MeshPhongMaterial({ map: TEX.cobble, color: 0xaaaaaa, specular: 0x2a2e30, shininess: 34 }),
      stoneF: new THREE.MeshPhongMaterial({ map: TEX.stone, color: 0x777777, specular: 0x20262a, shininess: 30 }),
      puddle: new THREE.MeshPhongMaterial({ color: 0x050607, specular: 0x8a8f96, shininess: 120, transparent: true, opacity: 0.55, depthWrite: false }),
      brick: this.mat(TEX.brick), brick2: this.mat(TEX.brick2), stone: this.mat(TEX.stone, 0xb0b0b0), plaster: this.mat(TEX.plaster), tile: this.mat(TEX.tile),
      rust: this.mat(TEX.rust), metal: this.mat(TEX.metal), wood: this.mat(TEX.wood), dark: this.mat(null, 0x0b0b0c), black: new THREE.MeshBasicMaterial({ color: 0x030303 }),
      facA: this.mat(TEX.facA), facB: this.mat(TEX.facB), facC: this.mat(TEX.facC), facD: this.mat(TEX.facD),
      glass: new THREE.MeshPhongMaterial({ color: 0x23302f, specular: 0x778888, shininess: 90, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide }),
      bulb: new THREE.MeshBasicMaterial({ color: 0xe8c878, fog: false }), bulbCold: new THREE.MeshBasicMaterial({ color: 0xa8c8c0, fog: false }), bulbRed: new THREE.MeshBasicMaterial({ color: 0xb02818, fog: false }),
      cloth: this.mat(null, 0x24242a), cloth2: this.mat(null, 0x34302a), skin: this.mat(null, 0x8f7c68), paper: this.mat(null, 0xb8ad90), bag: this.mat(null, 0x121314), green: this.mat(TEX.rust, 0x4a6a4a), venda: this.mat(null, 0xa09a88),
    };
    const ground = (w, dd, m, x, z, s, y = 0) => { const g = new THREE.PlaneGeometry(w, dd); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / s, uv.getY(i) * dd / s); const me = new THREE.Mesh(g, m); me.rotation.x = -PI / 2; me.position.set(x, y, z); S.add(me); return me; };
    const puddle = (x, z, w, dd) => { const me = new THREE.Mesh(new THREE.CircleGeometry(1, 10), M.puddle); me.rotation.x = -PI / 2; me.scale.set(w, dd, 1); me.position.set(x, 0.012, z); S.add(me); };
    const decal = (tex, w, h, x, y, z, ry, o = {}) => this.P(w, h, new THREE.MeshLambertMaterial(Object.assign({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }, o)), x, y, z, ry);

    /* ================= EL CALLEJÓN ================= */
    ground(5, 24, M.asphalt, 0, -10, 4);
    this.wall(-3.5, -22, -2.5, 3, 15, M.brick); this.wall(2.5, -22, 3.5, 3, 15, M.brick2); this.wall(-3.5, 2, 3.5, 3, 15, M.brick);
    // tuberías, ventanas con rejas, cables, aparatos
    [[-2.38, -3], [-2.38, -17.5], [2.38, -9.5], [2.38, -19]].forEach(([x, z]) => { this.C(0.07, 0.07, 12, M.rust, x, 6, z); this.B(0.2, 0.08, 0.2, M.rust, x, 2.2, z); this.B(0.2, 0.08, 0.2, M.rust, x, 5.6, z); });
    [[-2.46, 4.4, -6], [-2.46, 4.4, -16], [2.46, 4.6, -4], [2.46, 4.6, -13], [-2.46, 8, -11], [2.46, 8.2, -18]].forEach(([x, y, z]) => { const s = x < 0 ? 1 : -1; this.B(0.1, 1.5, 1.2, M.dark, x, y, z); this.B(0.14, 0.1, 1.4, M.rust, x + s * 0.02, y - 0.8, z); for (let k = -2; k <= 2; k++) this.B(0.04, 1.5, 0.04, M.rust, x + s * 0.08, y, z + k * 0.25); });
    this.B(0.6, 0.5, 0.9, M.metal, 2.2, 3.2, -16.5); this.B(0.6, 0.5, 0.9, M.metal, -2.2, 6.5, -4.5);
    for (let i = 0; i < 5; i++) this.B(5, 0.02, 0.02, M.black, 0, 5.2 + i * 1.3, -3 - i * 4.1, { rz: (i % 2 ? 1 : -1) * 0.05 });
    // contenedor, bolsas, cajas
    this.B(1.0, 1.1, 1.9, M.green, 1.85, 0.6, -6, { uv: [1, 1] }); this.B(1.06, 0.08, 1.96, M.rust, 1.85, 1.2, -6, { rz: 0.06 }); this.col(1.35, -7, 2.5, -5);
    [[1.3, -4.6, 0.36], [1.9, -4.3, 0.3], [-1.9, -19.4, 0.34], [-2.0, -1.2, 0.3], [1.8, -0.4, 0.38]].forEach(([x, z, r]) => { const b = new THREE.Mesh(new THREE.DodecahedronGeometry(r, 0), M.bag); b.position.set(x, r * 0.7, z); b.scale.y = 0.75; b.rotation.y = x * 7; S.add(b); });
    this.B(0.6, 0.45, 0.5, M.cloth2, -1.95, 0.23, -8.2, { ry: 0.3 }); this.B(0.5, 0.35, 0.5, M.cloth2, -1.9, 0.62, -8.15, { ry: -0.2 }); this.col(-2.5, -8.6, -1.6, -7.8);
    puddle(-0.6, -12.5, 1.2, 0.8); puddle(0.9, -18.4, 0.9, 1.3); puddle(0.3, -2.8, 0.7, 0.5);
    // puerta oxidada (izquierda) — se abre al final del capítulo
    this.B(0.14, 2.5, 1.4, M.dark, -2.48, 1.25, -9); d.doorAlley = new THREE.Group(); d.doorAlley.position.set(-2.4, 0, -9.6); S.add(d.doorAlley);
    this.B(0.07, 2.3, 1.2, M.rust, 0, 1.15, 0.6, { p: d.doorAlley, uv: [1.2, 2.3] }); this.B(0.05, 0.05, 0.16, M.metal, 0.06, 1.1, 1.05, { p: d.doorAlley });
    this.addInter('puertaCallejon', -1.9, -9, { verb: 'Abrir', hx: -2.3, hit: [0.5, 2.2, 1.3] });
    // farol de pared + pintada
    this.B(0.3, 0.06, 0.06, M.rust, -2.32, 4.0, -14.5); this.B(0.22, 0.28, 0.22, M.bulb, -2.12, 3.86, -14.5); d.lAlley = this.light(0xd9a050, 1.25, 15, -1.9, 3.8, -14.5, 'buzz');
    d.grafCanvas = document.createElement('canvas'); d.grafCanvas.width = 512; d.grafCanvas.height = 256; d.grafTex = new THREE.CanvasTexture(d.grafCanvas);
    decal(d.grafTex, 3.4, 1.7, -2.485, 1.75, -14.5, PI / 2);
    this.addInter('grafiti', -1.7, -14.5, { auto: true, verb: 'Leer', hx: -2.35, hit: [0.3, 1.6, 3.2], y: 1.7 });
    // nota y linterna
    d.nota = this.P(0.3, 0.22, this.mat(null, 0xb0a888), -0.9, 0.02, -4.2, 0.5, -PI / 2);
    this.addInter('nota', -0.9, -4.2, { verb: 'Coger', y: 0.3, hit: [0.7, 0.6, 0.7], on: () => !this.game.f.doc_nota });
    d.linterna = new THREE.Group(); d.linterna.position.set(0.95, 0.06, -7.3); d.linterna.rotation.y = 0.7; S.add(d.linterna);
    this.C(0.045, 0.045, 0.26, M.metal, 0, 0, 0, { p: d.linterna, rz: PI / 2 }); this.C(0.07, 0.05, 0.08, M.rust, 0.16, 0, 0, { p: d.linterna, rz: -PI / 2 });
    this.addInter('linterna', 0.95, -7.3, { verb: 'Coger', y: 0.3, hit: [0.7, 0.6, 0.7], on: () => !this.game.f.got_linterna });
    this.addInter('eco1', -1.3, -18, { verb: 'Escuchar', y: 1.3, eco: true, on: () => this.game.ecoOn('eco1') });

    /* ================= LA PLAZA ================= */
    ground(26, 26, M.cobble, 0, -35, 5);
    const F = [7, 14];
    this.wall(-13.5, -22, -3.5, -21, 15, M.facB, F); this.wall(3.5, -22, 13.5, -21, 15, M.facA, F);
    this.wall(-14, -48, -13, -22, 15, M.facC, F);
    this.wall(13, -33, 13.3, -22, 15, M.facD, F); this.wall(13, -48, 13.3, -35, 15, M.facA, F); this.B(0.3, 12.5, 2, M.facD, 13.15, 8.75, -34, { uv: F });
    this.wall(-13, -49, -2.6, -48, 15, M.facD, F); this.wall(2.6, -49, 13, -48, 15, M.facB, F); this.B(5.2, 11, 1, M.stone, 0, 9.5, -48.5, { uv: [3, 3] });
    this.B(0.7, 4.2, 1.1, M.stone, -2.3, 2.1, -48.45, { uv: [2, 2] }); this.B(0.7, 4.2, 1.1, M.stone, 2.3, 2.1, -48.45, { uv: [2, 2] }); this.B(5.4, 0.5, 1.2, M.stone, 0, 4.2, -48.45, { uv: [2, 2] }); this.col(-2.65, -49, -1.95, -47.9); this.col(1.95, -49, 2.65, -47.9);
    // balcones en relieve
    [[-12.9, 5.2, -29, 1], [-12.9, 5.2, -41, 1], [12.9, 5.3, -27, -1], [12.9, 5.3, -42, -1]].forEach(([x, y, z, s]) => { this.B(0.9, 0.12, 2.6, M.dark, x + s * 0.4, y, z); for (let k = 0; k <= 8; k++) this.B(0.03, 0.9, 0.03, M.rust, x + s * 0.82, y + 0.45, z - 1.25 + k * 0.31); this.B(0.04, 0.04, 2.6, M.rust, x + s * 0.82, y + 0.9, z); });
    [[-8, 5.3, -21.9], [8, 5.3, -21.9], [-8, 5.3, -47.9], [8, 5.2, -47.9]].forEach(([x, y, z]) => { const s = z > -30 ? -1 : 1; this.B(2.6, 0.12, 0.9, M.dark, x, y, z + s * 0.4); for (let k = 0; k <= 8; k++) this.B(0.03, 0.9, 0.03, M.rust, x - 1.25 + k * 0.31, y + 0.45, z + s * 0.82); this.B(2.6, 0.04, 0.04, M.rust, x, y + 0.9, z + s * 0.82); });
    // farola central
    this.C(0.32, 0.42, 0.7, M.metal, 0, 0.35, -35); this.C(0.09, 0.13, 5.2, M.metal, 0, 3.2, -35); this.B(2.2, 0.08, 0.08, M.metal, 0, 5.6, -35);
    [-1.05, 1.05].forEach(x => { this.B(0.34, 0.44, 0.34, M.bulb, x, 5.3, -35); this.B(0.44, 0.06, 0.44, M.metal, x, 5.56, -35); });
    this.circles.push({ x: 0, z: -35, r: 0.5 }); d.lFarola = this.light(0xd8a858, 1.5, 26, 0, 5.1, -35, 'slow');
    // quiosco
    this.B(2.4, 2.5, 2.4, M.green, -7.5, 1.25, -28.5, { uv: [1.2, 1.2] }); this.B(3.0, 0.14, 3.0, M.rust, -7.5, 2.58, -28.5); this.C(0.2, 1.5, 0.5, M.rust, -7.5, 2.9, -28.5, { seg: 6 });
    this.B(0.06, 1.1, 1.8, M.dark, -6.28, 1.5, -28.5); this.B(0.34, 0.06, 1.9, M.metal, -6.14, 0.95, -28.5); this.col(-8.7, -29.7, -6.3, -27.3);
    decal(textTex(['PRENSA'], { w: 256, h: 64, size: 46, color: '#b8ad90' }), 1.6, 0.4, -6.27, 2.25, -28.5, PI / 2);
    for (let i = 0; i < 4; i++) this.B(0.24, 0.03, 0.34, M.paper, -6.12, 1.0 + i * 0.03, -29.1 + i * 0.06, { ry: i * 0.1 });
    d.diario = this.B(0.26, 0.04, 0.38, this.mat(null, 0xc8c2b0), -6.1, 1.0, -28.2, { ry: 0.2 });
    this.addInter('periodico', -5.6, -28.3, { verb: 'Leer', y: 1.1, hx: -6.1, hz: -28.2, hit: [0.6, 0.7, 0.9] });
    [[-4.6, -27.2, 0.4], [-3.8, -29.6, 1.3], [3.2, -41.2, 2.2], [-9.5, -44.6, 0.9], [9.6, -25.5, 2.9]].forEach(([x, z, r]) => this.P(0.5, 0.36, M.paper, x, 0.015, z, r, -PI / 2));
    // cabina telefónica
    const cb = d.cabina = new THREE.Group(); cb.position.set(8.5, 0, -43.5); S.add(cb);
    [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]].forEach(([x, z]) => this.B(0.07, 2.4, 0.07, M.rust, x, 1.2, z, { p: cb }));
    this.B(1.2, 0.22, 1.2, M.rust, 0, 2.5, 0, { p: cb }); this.B(1.0, 0.04, 1.0, M.dark, 0, 0.02, 0, { p: cb });
    this.P(1, 2.2, M.glass, 0, 1.2, -0.5, 0, 0, cb); this.P(1, 2.2, M.glass, 0, 1.2, 0.5, 0, 0, cb); this.P(1, 2.2, M.glass, 0.5, 1.2, 0, PI / 2, 0, cb);
    this.B(0.14, 0.5, 0.36, M.metal, 0.38, 1.35, 0, { p: cb }); this.B(0.07, 0.3, 0.08, M.dark, 0.28, 1.4, -0.12, { p: cb }); this.B(0.1, 0.07, 0.12, M.metal, 0.36, 1.02, 0.1, { p: cb });
    d.cabBulb = this.B(0.5, 0.05, 0.5, M.bulbCold, 0, 2.37, 0, { p: cb }); decal(textTex(['TELÉFONO'], { w: 256, h: 48, size: 34, color: '#b8ad90' }), 1.0, 0.19, 7.89, 2.5, -43.5, -PI / 2);
    this.col(8.4, -44.05, 9.05, -42.95); this.col(7.95, -44.05, 9.05, -43.95); this.col(7.95, -43.05, 9.05, -42.95);
    d.lCabina = this.light(0x9fc4bc, 0.7, 9, 8.4, 2.2, -43.5, 'buzz');
    this.addInter('telefono', 7.75, -43.5, { verb: 'Usar', y: 1.3, hx: 8.6, hit: [0.9, 1.6, 0.9] });
    // bancos
    const bench = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g); this.B(1.9, 0.07, 0.5, M.wood, 0, 0.46, 0, { p: g }); this.B(1.9, 0.5, 0.06, M.wood, 0, 0.82, -0.25, { p: g, rx: -0.12 }); [-0.8, 0.8].forEach(k => { this.B(0.06, 0.46, 0.5, M.rust, k, 0.23, 0, { p: g }); }); return g; };
    bench(-6.6, -42, PI / 2); this.col(-6.95, -43, -6.25, -41); bench(4.5, -39.4, -0.4); this.col(3.6, -39.9, 5.4, -38.9); bench(-10.5, -33, PI / 2); this.col(-10.85, -34, -10.15, -32);
    // fuente seca
    this.C(1.7, 1.8, 0.55, M.stone, 6, 0.28, -30, { seg: 10 }); this.C(1.45, 1.45, 0.1, M.dark, 6, 0.5, -30, { seg: 10 }); this.C(0.22, 0.32, 1.5, M.stone, 6, 1.0, -30); this.C(0.7, 0.2, 0.2, M.stone, 6, 1.8, -30, { seg: 10 });
    this.circles.push({ x: 6, z: -30, r: 1.95 }); this.addInter('eco2', 4.1, -31.6, { verb: 'Escuchar', y: 1.3, eco: true, on: () => this.game.ecoOn('eco2') });
    // árboles muertos
    const tree = (x, z, s) => { const g = new THREE.Group(); g.position.set(x, 0, z); S.add(g); this.C(0.09 * s, 0.2 * s, 3.4 * s, M.dark, 0, 1.7 * s, 0, { p: g, seg: 6 }); const R = rng(Math.floor(x * 31 + z * 7 + 99));
      for (let i = 0; i < 7; i++) { const l = (0.8 + R() * 1.4) * s, b = this.C(0.015, 0.06 * s, l, M.dark, 0, (2 + R() * 1.5) * s, 0, { p: g, seg: 5 }); b.rotation.set((R() - 0.5) * 1.8, R() * 6.3, (R() - 0.5) * 1.8); b.translateY(l / 2); }
      this.B(1.3, 0.06, 1.3, M.dark, 0, 0.03, 0, { p: g }); this.circles.push({ x, z, r: 0.3 }); };
    tree(-9.2, -37.6, 1); tree(9.4, -36, 1.15); tree(-4, -24.6, 0.9);
    puddle(-2.5, -31, 1.6, 1.1); puddle(3.5, -44.5, 1.4, 0.8); puddle(-8, -45.6, 1.0, 1.4); puddle(8.8, -33.4, 1.2, 0.9); puddle(0.4, -39.5, 0.9, 0.6);
    this.C(0.45, 0.45, 0.02, M.rust, -2.4, 0.012, -36.8, { seg: 12 });
    // tienda: rótulo y puerta
    decal(textTex(['ALIMENTACIÓN · BEBIDAS'], { w: 512, h: 64, size: 40, color: '#b8ad90', bg: '#23201a', font: 'Georgia, "Times New Roman", serif' }), 5.2, 0.65, 12.97, 3.2, -34, -PI / 2);
    d.shopDoor = new THREE.Group(); d.shopDoor.position.set(13.12, 0, -35); S.add(d.shopDoor);
    this.B(0.07, 2.4, 2.0, M.wood, 0, 1.2, 1.0, { p: d.shopDoor, uv: [1, 2.4] }); this.B(0.09, 1.0, 1.5, M.dark, 0, 1.6, 1.0, { p: d.shopDoor });
    this.P(0.5, 0.36, this.mat(null, 0xa89c74), -0.06, 1.55, 1.0, -PI / 2, 0, d.shopDoor);
    this.P(0.44, 0.16, new THREE.MeshLambertMaterial({ map: textTex(['TIRA'], { w: 128, h: 48, size: 38, color: '#1a1612', bg: '#b0a078' }) }), -0.06, 1.06, 1.62, -PI / 2, 0, d.shopDoor);
    this.B(0.04, 0.22, 0.05, M.metal, -0.07, 1.06, 1.85, { p: d.shopDoor });
    d.shopDoorCol = this.col(12.9, -35, 13.4, -33, () => !this.game.f.tiendaAbierta);
    this.addInter('puertaTienda', 12.3, -34, { verb: 'Abrir', hx: 13.0, hit: [0.5, 2.2, 2.0], on: () => !this.game.f.tiendaAbierta });
    // sombra lejana en la boca del pasaje
    d.sombra = makeWatcher(this, 0.75); d.sombra.position.set(0.3, 0, -49.6); S.add(d.sombra);
    this.addInter('sombra', 0.3, -49.6, { verb: 'Mirar', r: 0, hit: [1.2, 2.4, 1.2], y: 1.2, far: true, noGlint: true, on: () => !this.game.f.sombraVista });
    // Anselmo, el farolero
    d.anselmo = makeAnselmo(this); d.anselmo.position.set(-6.5, 0, -42); d.anselmo.rotation.y = PI / 2; S.add(d.anselmo);
    d.vendaObj = this.B(0.5, 0.03, 0.1, M.venda, -6.5, 0.51, -42, { ry: 0.5 });
    this.addInter('anselmo', -5.5, -42, { verb: 'Hablar', y: 1.1, hx: -6.4, hit: [0.9, 1.6, 0.9], on: () => !this.game.f.puertaAbierta });
    this.addInter('venda', -5.6, -42, { verb: 'Mirar', y: 0.6, hx: -6.4, hit: [0.8, 0.7, 0.8], on: () => !!this.game.f.puertaAbierta });

    /* ================= LA TIENDA ================= */
    ground(9.7, 10, M.tile, 18.15, -34, 2, 0.005); const ceil = this.P(9.7, 10, this.mat(TEX.plaster, 0x555555), 18.15, 3.2, -34, 0, PI / 2);
    this.wall(13.3, -39.3, 23, -39, 3.2, M.plaster, [4, 3.2]); this.wall(13.3, -29, 23, -28.7, 3.2, M.plaster, [4, 3.2]); this.wall(23, -39.3, 23.3, -28.7, 3.2, M.plaster, [4, 3.2]);
    this.B(0.04, 3.2, 4, M.plaster, 13.33, 1.6, -37, { uv: [4, 3.2] }); this.B(0.04, 3.2, 4, M.plaster, 13.33, 1.6, -31, { uv: [4, 3.2] }); this.B(0.04, 0.8, 2, M.plaster, 13.33, 2.8, -34);
    this.B(1.4, 0.06, 0.14, M.bulbCold, 18, 3.14, -34); d.lTienda = this.light(0x9ab8a4, 1.25, 13, 18, 2.8, -34, 'tube');
    // mostrador, caja registradora, radio, cajón
    this.B(4.0, 1.0, 0.8, M.wood, 16.5, 0.5, -37, { uv: [1, 1] }); this.B(4.1, 0.05, 0.9, M.dark, 16.5, 1.02, -37); this.col(14.5, -37.4, 18.5, -36.6);
    this.B(0.5, 0.36, 0.42, M.metal, 15.2, 1.23, -37); this.B(0.4, 0.2, 0.1, M.dark, 15.2, 1.5, -37.1, { rx: -0.3 });
    this.B(0.42, 0.24, 0.16, M.cloth2, 17.9, 1.17, -37); this.C(0.07, 0.07, 0.02, M.dark, 17.78, 1.17, -36.91, { rx: PI / 2 }); this.C(0.006, 0.006, 0.5, M.metal, 18.06, 1.5, -37.02, { rz: -0.3 });
    d.radioLed = this.B(0.03, 0.03, 0.02, M.bulbRed, 18.05, 1.22, -36.91);
    this.addInter('radio', 17.9, -36.1, { verb: 'Escuchar', y: 1.2, hz: -37, hit: [0.7, 0.6, 0.6] });
    d.cajon = this.B(0.9, 0.24, 0.7, M.wood, 16.4, 0.72, -36.93); d.cajonKnob = this.B(0.2, 0.03, 0.03, M.metal, 16.4, 0.72, -36.56);
    this.addInter('cajon', 16.4, -36.1, { verb: 'Abrir', y: 0.75, hz: -36.75, hit: [1.0, 0.5, 0.6], on: () => !this.game.f.cajonVacio });
    // estanterías con productos
    const shelf = (x, z, w, ry, seed) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g); const R = rng(seed);
      this.B(w, 1.9, 0.05, M.metal, 0, 0.95, -0.2, { p: g }); [0.25, 0.75, 1.25, 1.75].forEach(y => { this.B(w, 0.04, 0.42, M.metal, 0, y, 0, { p: g });
        for (let k = -w / 2 + 0.15; k < w / 2 - 0.1; k += 0.16 + R() * 0.2) { if (R() < 0.45) continue; const hh = 0.12 + R() * 0.2, c = [0x4a3a2a, 0x3a4440, 0x5a4a30, 0x402824, 0x505048][Math.floor(R() * 5)];
          R() < 0.5 ? this.B(0.12, hh, 0.12, this.matc(c), k, y + 0.02 + hh / 2, (R() - 0.5) * 0.2, { p: g, ry: R() }) : this.C(0.05, 0.05, hh, this.matc(c), k, y + 0.02 + hh / 2, (R() - 0.5) * 0.2, { p: g }); } }); };
    shelf(15.4, -29.35, 3.2, PI, 5); shelf(19.6, -29.35, 3.2, PI, 9); this.col(13.8, -29.6, 21.2, -29);
    shelf(17.5, -32.75, 3.6, 0, 13); shelf(17.5, -33.05, 3.6, PI, 17); this.col(15.7, -33.3, 19.3, -32.5);
    shelf(22.72, -31.4, 3.0, -PI / 2, 21); this.col(22.4, -32.9, 23, -29.9);
    d.pilas = this.B(0.16, 0.1, 0.1, this.matc(0xa07a28), 17.1, 1.32, -32.55);
    this.addInter('pilas', 17.1, -32.0, { verb: 'Coger', y: 1.3, hz: -32.6, hit: [0.6, 0.5, 0.5], on: () => !this.game.f.got_pilas });
    // máquina de bebidas
    const mq = new THREE.Group(); mq.position.set(21.4, 0, -38.45); S.add(mq); this.B(1.1, 2.0, 0.8, M.metal, 0, 1.0, 0, { p: mq });
    const mt = canvasTex(256, 512, (g, w, h) => { g.fillStyle = '#0c1210'; g.fillRect(0, 0, w, h); const cs = ['#3a6a7a', '#5a3a22', '#b8641e', '#b0a030'], ns = ['AGUA', 'CAFÉ', 'NARANJA', 'LIMÓN'];
      ns.forEach((n, i) => { const y = 30 + i * 96; g.fillStyle = cs[i]; g.fillRect(24, y, 70, 76); g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(24, y + 50, 70, 26); g.fillStyle = '#c9c2a8'; g.font = 'bold 26px Arial, Helvetica, sans-serif'; g.fillText(n, 108, y + 34); g.fillStyle = '#6a2a18'; g.beginPath(); g.arc(214, y + 54, 12, 0, 7); g.fill(); });
      g.fillStyle = '#050505'; g.fillRect(40, 430, 176, 56); g.fillStyle = '#8a8470'; g.font = '18px Arial, Helvetica, sans-serif'; g.fillText('1 MONEDA', 78, 420); }, true);
    this.P(0.96, 1.86, new THREE.MeshBasicMaterial({ map: mt, color: 0x9a9a9a }), 0, 1.02, 0.405, 0, 0, mq); this.col(20.8, -38.9, 22, -38);
    d.lMaq = this.light(0x7a9a8a, 0.55, 5, 21.4, 1.4, -37.6, 'buzz');
    this.addInter('maquina', 21.4, -37.4, { verb: 'Usar', y: 1.2, hz: -38.2, hit: [1.1, 1.9, 0.8] });
    decal(textTex(['NOVIEMBRE', '7  7  7  7  7  7  7', '7  7  7  7  7  7  7', '7  7  7  7  7  7  7'], { w: 256, h: 256, size: 30, color: '#2a221a', bg: '#b8ad90', font: 'Georgia, serif' }), 0.6, 0.6, 19.6, 1.75, -38.98, 0);
    this.addInter('calendario', 19.6, -38.2, { verb: 'Leer', y: 1.75, hz: -38.8, hit: [0.8, 0.8, 0.4] });
    this.B(0.45, 0.9, 0.45, M.wood, 20.2, 0.2, -31.2, { rz: PI / 2, ry: 0.5 }); this.B(0.7, 0.5, 0.6, M.cloth2, 14.4, 0.25, -38.3, { ry: 0.2 }); this.B(0.5, 0.4, 0.5, M.cloth2, 14.3, 0.7, -38.35, { ry: -0.3 }); this.col(13.9, -38.9, 14.9, -37.8);
    this.addInter('eco3', 21.2, -34.6, { verb: 'Escuchar', y: 1.3, eco: true, on: () => this.game.ecoOn('eco3') });

    /* ================= EL PASAJE ================= */
    ground(4, 26, M.stoneF, 0, -61, 3);
    this.wall(-2.6, -74, -2, -49, 4.6, M.stone, [3, 3]); this.wall(2, -74, 2.6, -49, 4.6, M.stone, [3, 3]); this.B(5.2, 0.5, 25, M.stone, 0, 4.4, -61.5, { uv: [3, 3] });
    for (let z = -51; z > -74; z -= 4.5) { this.B(4, 0.45, 0.5, M.stone, 0, 3.95, z, { uv: [2, 2] }); this.B(0.3, 4.2, 0.5, M.stone, -1.86, 2.1, z, { uv: [2, 2] }); this.B(0.3, 4.2, 0.5, M.stone, 1.86, 2.1, z, { uv: [2, 2] }); }
    this.C(0.06, 0.06, 25, M.rust, -1.6, 3.6, -61.5, { rx: PI / 2 }); this.C(0.04, 0.04, 25, M.rust, 1.7, 3.3, -61.5, { rx: PI / 2 }); puddle(0.5, -57, 0.9, 1.5); puddle(-0.7, -66, 0.8, 1.1);
    const mural = (sym, cap, z, left) => { const t = canvasTex(256, 320, (g, w, h) => { g.lineWidth = 9; g.lineCap = 'round'; g.strokeStyle = 'rgba(140,44,24,.9)'; g.save(); g.translate(44, 20); g.scale(3, 3); g.lineWidth = 3; const p = new Path2D(SYMBOLS[sym]); g.stroke(p); g.restore();
        paintTextRaw(g, cap, 128, 262, 40, 'rgba(160,150,130,.85)'); const R = rng(z * -13); g.fillStyle = 'rgba(140,44,24,.8)'; for (let k = 0; k < 6; k++) g.fillRect(60 + R() * 140, 150 + R() * 40, 3, 20 + R() * 60); }, true);
      decal(t, 1.5, 1.9, left ? -1.985 : 1.985, 1.7, z, left ? PI / 2 : -PI / 2);
      this.addInter('mural_' + sym, left ? -1.2 : 1.2, z, { verb: 'Mirar', y: 1.6, hx: left ? -1.85 : 1.85, hit: [0.3, 1.8, 1.4], r: 1.5 }); };
    mural('mano', 'LA MANO', -52.6, true); mural('luna', 'LA LUNA', -56.4, false); mural('ojo', 'EL OJO', -60.2, true); mural('boca', 'LA BOCA', -64, false);
    decal(textTex(['ÉL TE MIRA', 'SI TÚ LO MIRAS'], { w: 512, h: 200, size: 60, rough: true, seed: 5 }), 3.0, 1.2, -1.985, 1.6, -68.2, PI / 2);
    this.addInter('pared', -1.2, -68.2, { auto: true, verb: 'Leer', y: 1.6, hx: -1.85, hit: [0.3, 1.4, 2.8], r: 1.6 });
    d.informe = this.P(0.3, 0.42, this.mat(null, 0xc4c0b0), 0.9, 0.02, -70.6, -0.4, -PI / 2);
    this.addInter('informe', 0.9, -70.6, { verb: 'Coger', y: 0.3, hit: [0.7, 0.6, 0.7], on: () => !this.game.f.doc_informe });
    this.B(0.14, 0.14, 0.14, M.bulbRed, 0, 3.6, -73.6); d.lPasaje = this.light(0x8a2414, 0.9, 11, 0, 3.3, -73.2, 'slow');
    d.watcher = makeWatcher(this, 1); d.watcher.visible = false; S.add(d.watcher);

    /* ================= LA PUERTA ================= */
    ground(10, 10, M.stoneF, 0, -79, 3); ground(6.8, 18, M.asphalt, 0, -93, 4);
    this.wall(-5.6, -84, -5, -74, 15, M.stone, [3, 3]); this.wall(5, -84, 5.6, -74, 15, M.stone, [3, 3]);
    this.wall(-5, -74.6, -2.6, -74, 15, M.stone, [3, 3]); this.wall(2.6, -74.6, 5, -74, 15, M.stone, [3, 3]); this.B(5.2, 10.4, 0.6, M.stone, 0, 9.8, -74.3, { uv: [3, 3] });
    this.wall(-5, -84.7, -1.8, -84, 15, M.stone, [3, 3]); this.wall(1.8, -84.7, 5, -84, 15, M.stone, [3, 3]); this.B(3.6, 10.2, 0.7, M.stone, 0, 9.9, -84.35, { uv: [3, 3] });
    this.B(4.2, 0.5, 0.9, M.stone, 0, 4.75, -84.3); this.wall(-4, -102, -3.4, -84.7, 15, M.brick, [4, 4]); this.wall(3.4, -102, 4, -84.7, 15, M.brick2, [4, 4]);
    // verja de hierro, dos hojas con el ojo cerrado
    d.gateL = new THREE.Group(); d.gateL.position.set(-1.8, 0, -84.1); d.gateR = new THREE.Group(); d.gateR.position.set(1.8, 0, -84.1); S.add(d.gateL, d.gateR);
    [[d.gateL, 1], [d.gateR, -1]].forEach(([g, s]) => { this.B(1.8, 0.12, 0.1, M.metal, s * 0.9, 0.2, 0, { p: g }); this.B(1.8, 0.12, 0.1, M.metal, s * 0.9, 4.3, 0, { p: g }); this.B(1.8, 0.1, 0.08, M.metal, s * 0.9, 2.9, 0, { p: g });
      for (let k = 0; k < 8; k++) { this.C(0.035, 0.035, 4.3, M.metal, s * (0.1 + k * 0.235), 2.2, 0, { p: g, seg: 5 }); this.C(0.0, 0.06, 0.3, M.rust, s * (0.1 + k * 0.235), 4.5, 0, { p: g, seg: 4 }); }
      const e = this.C(0.62, 0.62, 0.07, M.rust, s * 1.8, 2.0, 0.05, { p: g, rx: PI / 2, seg: 14 }); e.geometry = new THREE.CylinderGeometry(0.62, 0.62, 0.07, 14, 1, false, s > 0 ? PI : 0, PI);
      this.B(0.55, 0.05, 0.1, M.dark, s * 1.5, 2.0, 0.09, { p: g, rz: s * -0.22 }); });
    d.gateCol = this.col(-1.8, -84.4, 1.8, -83.8, () => !this.game.f.puertaAbierta);
    this.B(0.3, 0.06, 0.06, M.rust, 0, 5.3, -83.9); this.B(0.2, 0.26, 0.2, M.bulbCold, 0, 5.1, -83.8); d.lPuerta = this.light(0x8fa8b0, 1.0, 14, 0, 4.9, -82.6, 'slow');
    // pedestal con cuatro placas
    this.C(0.5, 0.62, 1.0, M.stone, 0, 0.5, -81.4, { seg: 8 }); this.C(0.62, 0.62, 0.1, M.stone, 0, 1.03, -81.4, { seg: 8, rx: 0.3 }); this.circles.push({ x: 0, z: -81.4, r: 0.7 });
    [-0.3, -0.1, 0.1, 0.3].forEach(x => this.C(0.085, 0.085, 0.04, M.rust, x, 1.1, -81.36 + 0, { seg: 8, rx: 0.3 }));
    this.addInter('pedestal', 0, -80.4, { verb: 'Usar', y: 1.1, hz: -81.3, hit: [1.2, 0.8, 1.1], on: () => !this.game.f.puertaAbierta });
    [[-0.9, -81.0], [0.85, -81.7], [-0.5, -82.1]].forEach(([x, z]) => { this.C(0.03, 0.035, 0.16, M.paper, x, 0.08, z); this.B(0.03, 0.05, 0.03, M.bulb, x, 0.19, z); });
    d.lVelas = this.light(0xc88a40, 0.5, 5, 0, 0.6, -81, 'candle');
    decal(textTex(['PARA ENTRAR, REZA.', 'PARA SALIR,', 'REZA AL REVÉS.'], { w: 256, h: 160, size: 26, color: '#c9b98a', bg: '#2a261f', font: 'Georgia, "Times New Roman", serif' }), 1.0, 0.62, -2.7, 1.6, -83.985, 0);
    this.addInter('placa', -2.5, -82.9, { auto: true, hx: -2.7, verb: 'Leer', y: 1.6, hz: -83.8, hit: [1.1, 0.8, 0.4] });
    // estatuas encapuchadas que se tapan los ojos
    const statue = (x, z, ry) => { const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; S.add(g); this.B(0.9, 0.5, 0.9, M.stone, 0, 0.25, 0, { p: g }); this.C(0.22, 0.48, 2.0, M.stone, 0, 1.5, 0, { p: g, seg: 7 });
      const hd = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 5), M.stone); hd.position.set(0, 2.62, 0.02); g.add(hd); this.C(0.0, 0.32, 0.5, M.stone, 0, 2.86, -0.06, { p: g, seg: 7, rx: -0.25 });
      this.B(0.1, 0.55, 0.12, M.stone, -0.2, 2.35, 0.2, { p: g, rz: -0.5, rx: -0.5 }); this.B(0.1, 0.55, 0.12, M.stone, 0.2, 2.35, 0.2, { p: g, rz: 0.5, rx: -0.5 }); this.B(0.42, 0.14, 0.1, M.stone, 0, 2.62, 0.24, { p: g }); this.circles.push({ x, z, r: 0.6 }); };
    statue(-4.0, -82.3, 0.5); statue(4.0, -82.3, -0.5); statue(-3.9, -76.2, 1.6); statue(3.9, -78.2, -1.6);
    this.addInter('eco4', 2.6, -77, { verb: 'Escuchar', y: 1.3, eco: true, on: () => this.game.ecoOn('eco4') });
    // el hospital, al otro lado
    const ht = canvasTex(512, 512, (g, w, h) => { g.fillStyle = '#0a0a0b'; g.fillRect(0, 0, w, h); const R = rng(77); for (let y = 0; y < 9; y++) for (let x = 0; x < 12; x++) { g.fillStyle = R() < 0.82 ? `rgb(${190 + R() * 40},${170 + R() * 30},${110 + R() * 30})` : '#141416'; g.fillRect(18 + x * 41, 26 + y * 52, 24, 34); } }, true);
    d.hospital = this.P(34, 30, new THREE.MeshBasicMaterial({ map: ht, color: 0x443830, fog: true }), 0, 15, -106); d.hospital.material.color.setHex(0x000000);
    d.hospSign = this.P(9, 1.6, new THREE.MeshBasicMaterial({ map: textTex(['HOSPITAL SANTA VIGILIA'], { w: 512, h: 96, size: 44, color: '#ff4a30', font: 'Georgia, "Times New Roman", serif' }), transparent: true, fog: false, opacity: 0 }), 0, 7.2, -100);
    d.lHosp = this.light(0xa02814, 0, 30, 0, 4, -89);

    /* niebla volumétrica: velos que derivan alrededor del jugador */
    for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: TEX.fog, color: 0x8a8f90, transparent: true, opacity: 0.05 + Math.random() * 0.05, depthWrite: false })); const s = 5 + Math.random() * 7; sp.scale.set(s, s * 0.6, 1); sp.userData = { ox: (Math.random() - 0.5) * 26, oz: (Math.random() - 0.5) * 26, y: 0.6 + Math.random() * 3, sp: 0.1 + Math.random() * 0.25, ph: Math.random() * 6 }; S.add(sp); this.motes.push(sp); }
    this.paintGraffiti('NO MIRES ATRÁS');
  }
  matc(c) { this._mc = this._mc || {}; return this._mc[c] || (this._mc[c] = this.mat(null, c)); }
  paintGraffiti(txt) { if (this.d.grafTxt === txt) return; this.d.grafTxt = txt; const c = this.d.grafCanvas; paintText(c.getContext('2d'), c.width, c.height, txt.split('\n'), { size: txt.length > 16 ? 58 : 76, rough: true, seed: txt.length * 3 }); this.d.grafTex.needsUpdate = true; }

  /* El Que Mira: silueta alta y delgada, un solo ojo */

  /** Aplica el estado del juego al mundo (idempotente): así se restaura un guardado. */
  sync(f) { const d = this.d;
    d.nota.visible = !f.doc_nota; d.linterna.visible = !f.got_linterna; d.pilas.visible = !f.got_pilas; d.informe.visible = !f.doc_informe;
    d.anselmo.visible = !f.puertaAbierta; d.vendaObj.visible = !!f.puertaAbierta; d.sombra.visible = !f.sombraVista;
    d.cajon.position.z = f.cajonAbierto ? -36.6 : -36.93; d.cajonKnob.position.z = f.cajonAbierto ? -36.23 : -36.56;
    d.tgt = { shop: f.tiendaAbierta ? -1.75 : 0, gate: f.puertaAbierta ? 1.45 : 0, alley: f.puertaAbierta ? -0.9 : 0, hosp: f.puertaAbierta ? 1 : 0 };
    this.paintGraffiti(DOCS.grafiti.text(f));
    this.inter.forEach(it => { it.hitbox.userData.off = !it.on(); });
  }
  snap() { const d = this.d, t = d.tgt; d.shopDoor.rotation.y = t.shop; d.gateL.rotation.y = t.gate; d.gateR.rotation.y = -t.gate; d.doorAlley.rotation.y = t.alley; d.hospV = t.hosp; }

  update(dt, time, player, f) { const d = this.d, t = d.tgt, k = Math.min(1, dt * 1.2);
    d.shopDoor.rotation.y += (t.shop - d.shopDoor.rotation.y) * Math.min(1, dt * 3); d.gateL.rotation.y += (t.gate - d.gateL.rotation.y) * k * 0.45; d.gateR.rotation.y = -d.gateL.rotation.y; d.doorAlley.rotation.y += (t.alley - d.doorAlley.rotation.y) * k;
    d.hospV = (d.hospV || 0) + (t.hosp - (d.hospV || 0)) * k * 0.4; d.lHosp.intensity = 2.2 * d.hospV; d.hospSign.material.opacity = d.hospV * (0.8 + 0.2 * Math.sin(time * 9) * (Math.sin(time * 1.7) > 0.6 ? 1 : 0)); d.hospital.material.color.setScalar(0.4 * d.hospV);
    const fog = this.scene.fog; fog.color.lerpColors(this.fogBase, this.fogRed, d.hospV * 0.8); this.scene.background.copy(fog.color);
    const dens = player.zone === 'tienda' ? 0.028 : player.zone === 'pasaje' ? 0.062 : 0.045; fog.density += (dens - fog.density) * Math.min(1, dt);
    // luces: parpadeo según el tipo
    this.flick.forEach(o => { o.t += dt; const b = o.l.userData.base; let v = 1;
      if (o.mode === 'buzz') v = 0.86 + 0.14 * Math.sin(o.t * 37) * Math.sin(o.t * 3.1) - (Math.sin(o.t * 0.7) > 0.985 ? 0.8 : 0);
      else if (o.mode === 'tube') v = (Math.sin(o.t * 1.3) > 0.93 || Math.sin(o.t * 0.37) > 0.99) ? 0.25 + 0.5 * Math.random() : 0.95 + 0.05 * Math.sin(o.t * 50);
      else if (o.mode === 'candle') v = 0.8 + 0.2 * Math.sin(o.t * 11) * Math.sin(o.t * 4.3);
      else v = 0.92 + 0.08 * Math.sin(o.t * 0.9);
      o.l.intensity = b * Math.max(0, v) * (o.dim == null ? 1 : o.dim); });
    const ring = this.game.ringing(); d.cabBulb.visible = !ring || Math.sin(time * 14) > 0;
    d.radioLed.visible = Math.sin(time * 3) > -0.3;
    // Anselmo gira la cabeza hacia el jugador (aunque no ve)
    if (d.anselmo.visible) { const a = Math.atan2(player.pos.x - d.anselmo.position.x, player.pos.z - d.anselmo.position.z) - d.anselmo.rotation.y; const h = d.anselmo.userData.head; let ta = Math.atan2(Math.sin(a), Math.cos(a)); ta = Math.max(-1.1, Math.min(1.1, ta)); h.rotation.y += (ta - h.rotation.y) * Math.min(1, dt * 1.5); d.anselmo.position.y = Math.sin(time * 0.9) * 0.006; }
    if (d.sombra.visible) { d.sombra.rotation.y = Math.atan2(player.pos.x - 0.3, player.pos.z + 49.6); d.sombra.userData.head.rotation.z = Math.sin(time * 0.5) * 0.25; }
    this.motes.forEach(m => { const u = m.userData; u.ox += u.sp * dt; if (u.ox > 13) u.ox -= 26; m.position.set(player.pos.x + u.ox, u.y + Math.sin(time * 0.2 + u.ph) * 0.3, player.pos.z + u.oz + Math.sin(time * 0.1 + u.ph) * 2); m.visible = player.zone !== 'tienda'; });
    // destellos de los objetos interactivos cercanos
    this.inter.forEach(it => { const off = it.hitbox.userData.off || it.noGlint; const dd = Math.hypot(player.pos.x - it.x, player.pos.z - it.z); const target = off ? 0 : (dd < 7 ? (it.eco ? 0.75 : 0.5) * (0.55 + 0.45 * Math.sin(time * 2.6 + it.x)) : 0); it.glint.material.opacity += (target - it.glint.material.opacity) * Math.min(1, dt * 4);
      if (it.eco) { it.glint.scale.setScalar(0.7 + 0.2 * Math.sin(time * 1.3)); it.glint.position.y = it.y + Math.sin(time * 0.8) * 0.15; it.glint.material.color.setHex(0x9ab0c0); } });
  }
}
export function zoneAt(x, z) { return x > 13.15 ? 'tienda' : z > -22 ? 'callejon' : z > -48.5 ? 'plaza' : z > -74 ? 'pasaje' : 'puerta'; }

/* =====================================================================
   CameraManager — cámaras fijas por zonas; siguen al jugador con la mirada.
   ===================================================================== */
export const CAMS = [
  { id: 'tienda', test: (x, z) => x > 13.15, pos: [22.5, 2.95, -29.5], fov: 62 },
  { id: 'callA', test: (x, z) => z > -11, pos: [1.95, 6.4, 1.4], fov: 50 },
  { id: 'callB', test: (x, z) => z > -22, pos: [1.9, 0.45, -21.4], fov: 58, yoff: 1.5 },
  { id: 'pasaje1', test: (x, z) => z < -47.3 && z > -57.5 && Math.abs(x) < 2.7, pos: [1.3, 2.7, -44.2], fov: 42 },
  { id: 'plazaS', test: (x, z) => z > -35, pos: [-11.8, 7.6, -23.3], fov: 46 },
  { id: 'plazaNW', test: (x, z) => z > -49.8 && x < 1, pos: [-12.3, 1.0, -47.3], fov: 52, yoff: 1.5 },
  { id: 'plazaNE', test: (x, z) => z > -49.8, pos: [12.3, 2.5, -47.4], fov: 50 },
  { id: 'pasaje2', test: (x, z) => z > -74, pos: [1.3, 0.42, -73.5], fov: 62, yoff: 1.5 },
  { id: 'puerta', test: () => true, pos: [4.3, 6.6, -74.9], fov: 50 },
  { id: 'quiosco', test: () => false, pos: [-2.4, 1.75, -26.2], fov: 50, fixed: [-6.3, 1.15, -28.6] },
  { id: 'pasajeA', test: () => false, pos: [0.15, 1.95, -49.6], fov: 60, fixed: [0, 1.5, -62] },
  { id: 'pedestal', test: () => false, pos: [2.3, 2.5, -77.2], fov: 48, fixed: [0, 1.15, -82.4] },
  { id: 'verja', test: () => false, pos: [-2.9, 1.0, -76.4], fov: 55, fixed: [0.9, 2.7, -90] },
];
export class CameraManager {
  constructor() { this.cam = new THREE.PerspectiveCamera(50, 1, 0.1, 140); this.cur = null; this.target = new THREE.Vector3(); this.force = null; this.switched = false; this.shake = 0; }
  byId(id) { return CAMS.find(c => c.id === id); }
  update(dt, player, time) {
    const c = this.byId(this.force || this.base) || CAMS.find(c => c.test(player.pos.x, player.pos.z));
    const want = c.fixed ? new THREE.Vector3(...c.fixed) : new THREE.Vector3(player.pos.x, c.yoff || 1.25, player.pos.z);
    if (c !== this.cur) { this.cur = c; this.cam.position.set(...c.pos); this.applyFov(); this.target.copy(want); this.switched = true; }
    else this.target.lerp(want, Math.min(1, dt * 3.2));
    this.cam.position.set(c.pos[0] + Math.sin(time * 0.4) * 0.03 + (Math.random() - 0.5) * this.shake, c.pos[1] + Math.sin(time * 0.53) * 0.02 + (Math.random() - 0.5) * this.shake, c.pos[2]);
    this.cam.lookAt(this.target); this.shake *= Math.pow(0.02, dt);
  }
  /* en vertical (móvil) se abre el campo de visión para no perder la escena */
  applyFov() { const a = this.cam.aspect; this.cam.fov = this.cur ? Math.min(92, this.cur.fov * (a < 1 ? 1.25 + (1 - a) * 0.6 : 1)) : 50; this.cam.updateProjectionMatrix(); }
  resize(a) { this.cam.aspect = a; this.applyFov(); }
}

/* =====================================================================
   Gfx — render a baja resolución + pasada de postproceso (grano, viñeta,
   aberración cromática, etalonaje). Escrito a mano: sin dependencias.
   ===================================================================== */
export class Gfx {
  constructor(canvas) {
    this.r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }); this.r.setPixelRatio(1); this.r.autoClear = true;
    this.u = { tD: { value: null }, time: { value: 0 }, fear: { value: 0 }, dark: { value: 1 }, red: { value: 0 }, res: { value: new THREE.Vector2(640, 480) } };
    this.ps = new THREE.Scene(); this.pc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.ps.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({ uniforms: this.u, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.,1.); }',
      fragmentShader: `precision highp float; uniform sampler2D tD; uniform float time,fear,dark,red; uniform vec2 res; varying vec2 vUv;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec2 uv=vUv; vec2 d=uv-.5; float r2=dot(d,d);
          uv.x += sin(time*11.+uv.y*38.)*.0035*fear;
          float ca=(.0014+.007*fear)*(.35+r2*4.5);
          vec3 c=vec3(texture2D(tD,uv+d*ca).r, texture2D(tD,uv).g, texture2D(tD,uv-d*ca).b);
          float l=dot(c,vec3(.3,.59,.11)); c=mix(vec3(l),c,.8); c*=vec3(1.05,1.,.93);
          c=mix(c,vec3(l*1.5,l*.62,l*.5),clamp(red*.5+fear*.22,0.,.8));
          c=pow(max(c,0.),vec3(.82))*1.22;
          c+=(h(uv*res+fract(time)*71.3)-.5)*(.065+.06*fear);
          c*=mix(1.,.3,smoothstep(.08,.55,r2)); c*=.97+.03*sin(uv.y*res.y*3.14159);
          gl_FragColor=vec4(c*(1.-dark),1.); }` })));
    this.resize();
  }
  resize() { const w = window.innerWidth, h = window.innerHeight; this.r.setSize(w, h, false); const lh = Math.min(Math.round(h * Math.min(window.devicePixelRatio || 1, 2)), 540), lw = Math.max(2, Math.round(lh * w / h));
    if (this.rt) this.rt.dispose(); this.rt = new THREE.WebGLRenderTarget(lw, lh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true }); this.u.tD.value = this.rt.texture; this.u.res.value.set(lw, lh); return w / h; }
  render(scene, cam, time) { this.u.time.value = time; this.r.setRenderTarget(this.rt); this.r.render(scene, cam); this.r.setRenderTarget(null); this.r.render(this.ps, this.pc); }
}
