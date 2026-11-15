import * as THREE from 'three';
import { PI, rng } from './util.js';
import { canvasTex, grime } from './textures.js';
/* =====================================================================
   PERSONAJES: modelos 3D (protagonista, Anselmo, El Que Mira).
   Solo geometría y animación del modelo; la lógica está en Player y en los guiones.
   ===================================================================== */
/** Modelo del protagonista: llena p.g (grupo), p.legL/legR/armL/armR (pivotes de la marcha), p.head, p.hairB, p.hairF. */
export function buildHero(p, world) {
  const g = p.g = new THREE.Group(), M = world.M; p.t = 0;
  const L = (c, map, o) => new THREE.MeshLambertMaterial(Object.assign({ color: c, map: map || null }, o || {}));
  /* --- texturas del personaje: un melenudo del doom, fan del ocultismo de los 70 --- */
  const shirtTex = canvasTex(256, 300, (x, w, h) => { const R = rng(301); x.fillStyle = '#0c0b0d'; x.fillRect(0, 0, w, h);
    x.textAlign = 'center'; x.font = 'bold 26px Georgia, "Times New Roman", serif'; x.fillStyle = '#5f8a3a'; x.fillText('HIJOS DE', 129, 42); x.fillStyle = '#9a6ac0'; x.fillText('HIJOS DE', 127, 40);
    x.font = 'bold italic 52px Georgia, "Times New Roman", serif'; x.fillStyle = '#5f8a3a'; x.fillText('SATURNO', 131, 96); x.fillStyle = '#9a6ac0'; x.fillText('SATURNO', 128, 92);
    x.strokeStyle = '#9a6ac0'; x.lineWidth = 6; x.beginPath(); x.arc(128, 188, 62, 0, 7); x.stroke();
    x.fillStyle = '#6f9a42'; x.beginPath(); x.arc(128, 188, 48, 0.2 * PI, 0.8 * PI, true); x.arc(128, 168, 42, 0.8 * PI, 0.2 * PI, false); x.fill();
    x.strokeStyle = '#d8cfbb'; x.lineWidth = 4; x.beginPath(); x.moveTo(96, 196); x.quadraticCurveTo(128, 172, 160, 196); x.quadraticCurveTo(128, 220, 96, 196); x.stroke(); x.fillStyle = '#d8cfbb'; x.beginPath(); x.arc(128, 196, 8, 0, 7); x.fill();
    x.font = '15px Georgia, serif'; x.fillStyle = '#7a6a8a'; x.fillText('NIEBLA · DOOM · SUEÑO', 128, 278);
    for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(12,11,13,${R() * 0.6})`; x.fillRect(R() * w, R() * h, 2, 2); } }, true);
  const denimBase = (x, w, h, R) => { x.fillStyle = '#3d4a5e'; x.fillRect(0, 0, w, h); for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '20,26,36' : '120,135,150'},${0.12 + R() * 0.12})`; x.fillRect(R() * w, R() * h, 1, 10 + R() * 40); } grime(x, w, h, R, 10, ['140,150,160', '20,22,26'], 10, 40, 0.35); };
  const plainTex = canvasTex(128, 128, (x, w, h) => denimBase(x, w, h, rng(305)));
  const denimTex = canvasTex(128, 256, (x, w, h) => { const R = rng(303); denimBase(x, w, h, R);
    x.strokeStyle = 'rgba(190,160,90,.6)'; x.setLineDash([4, 3]); x.lineWidth = 1.5; x.strokeRect(6, 6, w - 12, h - 12);
    [['#14121a', '#9a6ac0', 40], ['#4a1812', '#d0a050', 150], ['#101010', '#6f9a42', 210]].forEach(([bg, fg, y], i) => { x.setLineDash([]); x.fillStyle = bg; x.fillRect(20 + i * 6, y, 74, 38); x.strokeStyle = fg; x.lineWidth = 2; x.strokeRect(22 + i * 6, y + 2, 70, 34);
      x.fillStyle = fg; if (i === 0) { x.beginPath(); x.arc(57, y + 19, 11, 0.3, 5.9); x.fill(); } else if (i === 1) { x.font = 'bold 16px Georgia, serif'; x.textAlign = 'center'; x.fillText('DOOM', 63, y + 25); } else { x.beginPath(); x.moveTo(69, y + 6); x.lineTo(82, y + 32); x.lineTo(56, y + 32); x.closePath(); x.fill(); } }); }, true);
  const backTex = canvasTex(256, 256, (x, w, h) => { x.clearRect(0, 0, w, h); x.fillStyle = '#121016'; x.beginPath(); x.arc(128, 128, 122, 0, 7); x.fill(); x.strokeStyle = '#9a6ac0'; x.lineWidth = 8; x.beginPath(); x.arc(128, 128, 112, 0, 7); x.stroke();
    x.fillStyle = '#6f9a42'; x.beginPath(); x.arc(128, 142, 58, 0.15 * PI, 0.85 * PI, true); x.arc(128, 112, 52, 0.85 * PI, 0.15 * PI, false); x.fill();
    x.fillStyle = '#d8cfbb'; x.beginPath(); x.moveTo(84, 150); x.quadraticCurveTo(128, 118, 172, 150); x.quadraticCurveTo(128, 182, 84, 150); x.fill(); x.fillStyle = '#121016'; x.beginPath(); x.arc(128, 150, 12, 0, 7); x.fill();
    x.font = 'bold 26px Georgia, serif'; x.textAlign = 'center'; x.fillStyle = '#9a6ac0'; x.fillText('SATURNO', 128, 222); }, true);
  const skin = L(0x8a7560), hair = L(0x17110c), beard = L(0x231912), shirt = L(0x131215), jeans = L(0x1d1d23), leather = new THREE.MeshPhongMaterial({ color: 0x0e0d0c, specular: 0x3a3a3a, shininess: 40 }),
    denim = L(0xffffff, denimTex), denimP = L(0xffffff, plainTex), brass = new THREE.MeshPhongMaterial({ color: 0xa08040, specular: 0xffe0a0, shininess: 70 }), silver = new THREE.MeshPhongMaterial({ color: 0x9a9a9a, specular: 0xffffff, shininess: 90 }),
    lens = new THREE.MeshPhongMaterial({ color: 0x050505, specular: 0xa0b0c0, shininess: 120 });
  const piv = (x, y, z, p) => { const o = new THREE.Group(); o.position.set(x, y, z); (p || g).add(o); return o; };
  p.legL = piv(-0.1, 0.86, 0); p.legR = piv(0.1, 0.86, 0); p.armL = piv(-0.265, 1.41, 0); p.armR = piv(0.265, 1.41, 0);
  // piernas: vaqueros negros pitillo y botas pesadas
  [p.legL, p.legR].forEach(p => { world.B(0.15, 0.74, 0.16, jeans, 0, -0.37, 0, { p }); world.B(0.17, 0.2, 0.2, leather, 0, -0.74, 0.01, { p }); world.B(0.17, 0.1, 0.12, leather, 0, -0.8, 0.13, { p }); world.B(0.19, 0.04, 0.33, M.black, 0, -0.85, 0.05, { p }); });
  // brazos: manga corta negra, antebrazo desnudo, muñequera con tachuelas
  [[p.armL, -1], [p.armR, 1]].forEach(([p, s]) => { world.B(0.135, 0.2, 0.15, shirt, 0, -0.08, 0, { p }); world.B(0.095, 0.2, 0.1, skin, 0, -0.27, 0, { p }); world.B(0.09, 0.2, 0.095, skin, 0, -0.46, 0.01, { p });
    world.B(0.11, 0.07, 0.11, leather, 0, -0.52, 0.01, { p }); for (let k = 0; k < 3; k++) world.B(0.02, 0.02, 0.02, silver, s * 0.056, -0.52, -0.03 + k * 0.03, { p }); world.B(0.08, 0.1, 0.09, skin, 0, -0.61, 0.015, { p }); });
  // torso: camiseta con estampado, chaleco vaquero abierto con parches, cinturón de balas
  world.B(0.4, 0.52, 0.21, shirt, 0, 1.17, 0, { p: g });
  world.P(0.22, 0.26, L(0xffffff, shirtTex), 0, 1.21, 0.106, 0, 0, g);
  world.B(0.42, 0.5, 0.025, denimP, 0, 1.19, -0.118, { p: g }); world.B(0.025, 0.42, 0.22, denimP, -0.21, 1.2, 0, { p: g }); world.B(0.025, 0.42, 0.22, denimP, 0.21, 1.2, 0, { p: g });
  world.B(0.1, 0.48, 0.025, denim, -0.16, 1.19, 0.117, { p: g }); world.B(0.1, 0.48, 0.025, denim, 0.16, 1.19, 0.117, { p: g });
  world.B(0.44, 0.05, 0.25, denimP, 0, 1.44, 0, { p: g });
  world.P(0.3, 0.3, L(0xffffff, backTex, { transparent: true }), 0, 1.13, -0.133, PI, 0, g);
  world.B(0.4, 0.2, 0.23, jeans, 0, 0.86, 0, { p: g }); world.B(0.43, 0.055, 0.25, leather, 0, 0.95, 0, { p: g });
  for (let k = -4; k <= 4; k++) { world.C(0.011, 0.011, 0.05, brass, k * 0.042, 0.955, 0.13, { p: g, seg: 5 }); world.C(0, 0.011, 0.02, brass, k * 0.042, 0.99, 0.13, { p: g, seg: 5 }); }
  for (let k = 0; k < 5; k++) world.B(0.012, 0.012, 0.012, silver, 0.19 + k * 0.01, 0.88 - k * 0.035, 0.1 - k * 0.012, { p: g });
  world.B(0.085, 0.09, 0.085, skin, 0, 1.47, 0, { p: g }); world.B(0.025, 0.035, 0.008, silver, 0, 1.36, 0.108, { p: g, rz: PI / 4 });
  // cabeza: melena larga con raya al medio, barba, gafas redondas de los 70
  const head = p.head = piv(0, 1.6, 0.01);
  const face = new THREE.Mesh(new THREE.SphereGeometry(0.112, 10, 8), skin); face.scale.set(0.95, 1.18, 1); head.add(face);
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.128, 10, 8, 0, PI * 2, 0, PI * 0.58), hair); scalp.position.set(0, 0.022, -0.012); scalp.scale.set(1.02, 1.08, 1.08); head.add(scalp);
  world.B(0.05, 0.3, 0.2, hair, -0.11, -0.08, -0.01, { p: head, rz: 0.06 }); world.B(0.05, 0.3, 0.2, hair, 0.11, -0.08, -0.01, { p: head, rz: -0.06 });
  world.B(0.17, 0.12, 0.09, beard, 0, -0.105, 0.05, { p: head }); world.B(0.12, 0.08, 0.07, beard, 0, -0.18, 0.045, { p: head }); world.B(0.1, 0.02, 0.03, beard, 0, -0.04, 0.105, { p: head });
  [-0.043, 0.043].forEach(x => { const c = new THREE.Mesh(new THREE.CircleGeometry(0.03, 12), lens); c.position.set(x, 0.012, 0.109); head.add(c); });
  world.B(0.03, 0.006, 0.006, silver, 0, 0.016, 0.11, { p: head }); world.B(0.006, 0.006, 0.1, silver, -0.075, 0.016, 0.06, { p: head }); world.B(0.006, 0.006, 0.1, silver, 0.075, 0.016, 0.06, { p: head });
  // la melena cuelga por la espalda y por delante de los hombros; se mece un poco
  p.hairB = piv(0, 0.04, -0.08, head); const mane = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.09, 0.56, 7), hair); mane.scale.z = 0.32; mane.position.set(0, -0.27, -0.01); p.hairB.add(mane);
  p.hairF = [-1, 1].map(s => { const o = piv(s * 0.12, -0.12, 0.02, head); world.B(0.065, 0.3, 0.05, hair, s * 0.025, -0.15, 0.02, { p: o, rz: s * -0.12 }); return o; });
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false })); sh.rotation.x = -PI / 2; sh.position.y = 0.02; g.add(sh);
}
/** Movimiento propio del modelo en cada fotograma (cabeza, melena). */
export function animateHero(p, dt) {
  p.t += dt; const t = p.t; p.head.rotation.x = 0.05 + Math.max(0, Math.sin(t * 1.15)) ** 3 * 0.09; p.head.rotation.y = Math.sin(t * 0.21) * 0.25;
  p.hairB.rotation.x = 0.12 + Math.sin(t * 0.9) * 0.04 - p.head.rotation.x * 0.6; p.hairF.forEach((o, i) => { o.rotation.x = -0.05 + Math.sin(t * 0.9 + i) * 0.04 - p.head.rotation.x * 0.5; });
  p.armL.rotation.z = -0.06; p.armR.rotation.z = 0.06;
}

export function makeWatcher(world, s) { const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0x040404 }), eye = new THREE.MeshBasicMaterial({ color: 0xd8d2c0, fog: false });
    const part = (w, h, dd, x, y, z, rz = 0) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, dd), m); me.position.set(x, y, z); me.rotation.z = rz; g.add(me); return me; };
    part(0.13, 1.5, 0.13, -0.14, 0.75, 0); part(0.13, 1.5, 0.13, 0.14, 0.75, 0); part(0.42, 0.85, 0.2, 0, 1.9, 0); part(0.2, 0.3, 0.16, 0, 2.42, 0);
    g.userData.armL = part(0.09, 1.6, 0.09, -0.3, 1.5, 0, 0.06); g.userData.armR = part(0.09, 1.6, 0.09, 0.3, 1.5, 0, -0.06);
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.2, 7, 6), m); hd.position.set(0, 2.68, 0); hd.scale.set(1, 1.25, 1); g.add(hd); g.userData.head = hd;
    const e = new THREE.Mesh(new THREE.CircleGeometry(0.075, 10), eye); e.position.set(0, 2.7, 0.2); g.add(e); const e2 = e.clone(); e2.rotation.y = PI; e2.position.z = -0.2; g.add(e2);
    g.scale.setScalar(s); return g; }

export function makeAnselmo(world) { const g = new THREE.Group(), M = world.M, coat = world.mat(null, 0x2e2a24), hat = world.mat(null, 0x16130f);
    world.B(0.5, 0.66, 0.3, coat, 0, 0.95, -0.06, { p: g }); world.B(0.2, 0.16, 0.5, M.cloth, -0.13, 0.55, 0.2, { p: g }); world.B(0.2, 0.16, 0.5, M.cloth, 0.13, 0.55, 0.2, { p: g });
    world.B(0.16, 0.5, 0.16, M.cloth, -0.13, 0.25, 0.42, { p: g }); world.B(0.16, 0.5, 0.16, M.cloth, 0.13, 0.25, 0.42, { p: g }); world.B(0.18, 0.08, 0.3, M.dark, -0.13, 0.04, 0.48, { p: g }); world.B(0.18, 0.08, 0.3, M.dark, 0.13, 0.04, 0.48, { p: g });
    world.B(0.13, 0.5, 0.13, coat, -0.32, 0.92, 0.04, { p: g, rx: -0.5 }); world.B(0.13, 0.5, 0.13, coat, 0.32, 0.92, 0.04, { p: g, rx: -0.5 }); world.B(0.1, 0.1, 0.14, M.skin, -0.32, 0.68, 0.22, { p: g }); world.B(0.1, 0.1, 0.14, M.skin, 0.32, 0.68, 0.22, { p: g });
    const head = new THREE.Group(); head.position.set(0, 1.44, -0.02); g.add(head); g.userData.head = head;
    const hd = new THREE.Mesh(new THREE.SphereGeometry(0.155, 8, 6), M.skin); hd.scale.y = 1.15; head.add(hd); world.B(0.33, 0.07, 0.33, M.venda, 0, 0.04, 0, { p: head }); world.B(0.3, 0.1, 0.2, world.mat(null, 0x6a6458), 0, -0.12, 0.05, { p: head });
    world.C(0.3, 0.3, 0.025, hat, 0, 0.15, 0, { p: head, seg: 10 }); world.C(0.15, 0.17, 0.17, hat, 0, 0.24, 0, { p: head, seg: 10 });
    world.C(0.02, 0.02, 2.6, M.wood, 0.55, 1.25, 0.1, { p: g, rz: 0.12 }); world.B(0.12, 0.03, 0.03, M.metal, 0.44, 2.52, 0.1, { p: g }); return g; }
