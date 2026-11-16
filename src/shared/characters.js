import * as THREE from 'three';
import { mergeBufferGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { PI, rng, clamp } from './util.js';
import { canvasTex } from './textures.js';
/* =====================================================================
   PERSONAJES: cuerpos «de sueño» low-poly (estilo PS1/PS2).
   Cada parte del cuerpo es una sola malla: conos truncados y esferas
   fundidos (torno), extremidades que se estrechan, hombros redondos,
   cabeza ≈ 1/7.5 de la altura. Texturas pintadas en canvas (cara,
   sombras, pliegues) + sombreado horneado en los colores de vértice.
   makeBody(spec) es paramétrico: altura, complexión, ropa, colores,
   cara, pelo, sombrero, venda, postura. Para personajes de otros
   capítulos basta con un spec nuevo.
   Todas las mallas del personaje van a la capa 1: Gfx las dibuja aparte
   para el «efecto de sueño» (ver Gfx); g.userData.dream es su fuerza.
   ===================================================================== */
export const CHAR_LAYER = 1;
const PHI0 = PI / 2;   // costura en el costado derecho: en la textura u = 0.25 es la espalda, u = 0.75 el frente
const FU = 0.75;

/* ---------- geometría ---------- */
/** Superficie de revolución: prof = [[radio, y], …] de abajo arriba. En la textura v sigue el índice del perfil. */
function lathe(prof, n = 9) { return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(Math.max(r, 1e-4), y)), n, PHI0); }
/** Extremidad que cuelga del pivote: radio rt arriba, rb abajo, largo len, extremos redondeados; bulge — músculo en bpos (0 arriba … 1 abajo). */
function limb(rt, rb, len, n = 7, bulge = 0, bpos = 0.4) {
  const L = (a, b, t) => a + (b - a) * t, r = t => L(rt, rb, t) + bulge * Math.max(0, 1 - Math.abs(t - bpos) / 0.45);
  return lathe([[0, -len - rb * 0.8], [rb * 0.74, -len - rb * 0.55], [r(1), -len], [r(0.75), -len * 0.75], [r(0.5), -len * 0.5], [r(0.25), -len * 0.25], [rt, -rt * 0.1], [rt * 0.8, rt * 0.5], [rt * 0.4, rt * 0.86], [0, rt * 0.96]], n);
}
function ball(rx, ry, rz, n = 7) { const g = new THREE.SphereGeometry(1, n, Math.max(4, n - 2)); g.scale(rx, ry, rz); return g; }
/** Mueve y gira una geometría: [x, y, z], [rx, ry, rz]. */
function xf(g, p, r) { if (r) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(r[0] || 0, r[1] || 0, r[2] || 0))); if (p) g.translate(p[0], p[1], p[2]); return g; }
/** Reduce las coordenadas de textura a una franja [v0, v1] (y [u0, u1]). */
function uvRect(g, v0, v1, u0 = 0, u1 = 1) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0)); return g; }
/** Sombreado horneado en el color de vértice: luz de arriba, oscuro hacia los pies y en los huecos (occ: esferas que tapan). */
function bake(g, off, occ, H, tint) {
  const P = g.attributes.position, N = g.attributes.normal, n = P.count, c = new Float32Array(n * 3), v = new THREE.Vector3(), t = new THREE.Color(tint == null ? 0xffffff : tint);
  for (let i = 0; i < n; i++) { v.set(P.getX(i) + off.x, P.getY(i) + off.y, P.getZ(i) + off.z); const ny = N.getY(i), nz = N.getZ(i);
    let k = (0.58 + 0.3 * (ny * 0.5 + 0.5) + 0.12 * Math.max(0, nz)) * (0.7 + 0.3 * clamp(v.y / (H * 0.55), 0, 1));
    for (const o of occ) { const d = v.distanceTo(o.c); if (d < o.r) { const q = 1 - d / o.r; k *= 1 - o.s * q * q; } }
    c[i * 3] = t.r * k; c[i * 3 + 1] = t.g * k; c[i * 3 + 2] = t.b * k; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
const merge = gs => mergeBufferGeometries(gs.map(g => g.index ? g.toNonIndexed() : g));

/* ---------- material: la fuerza del sueño sale en el alfa (la lee Gfx) ---------- */
function dreamy(m, u) { m.onBeforeCompile = sh => { sh.uniforms.uDream = u; sh.fragmentShader = 'uniform float uDream;\n' + sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n\tgl_FragColor.a = uDream;'); }; return m; }

/* ---------- pintura (canvas) ---------- */
const rgba = (c, a) => { const k = new THREE.Color(c); return `rgba(${k.r * 255 | 0},${k.g * 255 | 0},${k.b * 255 | 0},${a})`; };
const Pnt = {
  fill(x, w, h, c) { x.fillStyle = c; x.fillRect(0, 0, w, h); },
  /** pliegues: trazos curvos más oscuros (dir 'v' verticales, 'h' horizontales) */
  folds(x, w, h, R, n, a, dir = 'v') { for (let i = 0; i < n; i++) { const x0 = R() * w, y0 = R() * h, l = 8 + R() * h * 0.28; x.strokeStyle = `rgba(0,0,0,${a * (0.35 + R() * 0.65)})`; x.lineWidth = 1 + R() * 2.2; x.beginPath();
    if (dir === 'v') { x.moveTo(x0, y0); x.quadraticCurveTo(x0 + (R() - 0.5) * 10, y0 + l / 2, x0 + (R() - 0.5) * 7, y0 + l); } else { x.moveTo(x0, y0); x.quadraticCurveTo(x0 + l / 2, y0 + (R() - 0.5) * 6, x0 + l, y0 + (R() - 0.5) * 4); } x.stroke(); } },
  specks(x, w, h, R, n, a, light) { for (let i = 0; i < n; i++) { x.fillStyle = light ? `rgba(255,250,235,${a * R()})` : `rgba(0,0,0,${a * R()})`; x.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } },
  /** oscurece costados y espalda (u = 0.5 costado izquierdo, 0/1 costado derecho, 0.25 espalda) */
  sides(x, w, h, a) { const g = x.createLinearGradient(0, 0, w, 0); [[0, a], [0.25, a * 0.45], [0.5, a], [0.62, a * 0.35], [FU, 0], [0.88, a * 0.35], [1, a]].forEach(([t, k]) => g.addColorStop(t, `rgba(0,0,0,${k})`)); x.fillStyle = g; x.fillRect(0, 0, w, h); },
  vgrad(x, w, h, y0, y1, c0, c1) { const g = x.createLinearGradient(0, y0, 0, y1); g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, Math.min(y0, y1), w, Math.abs(y1 - y0)); },
};
/** Cara y pelo pintados en la textura de la cabeza. o: { skin, hair, hairStyle: 'long'|'short'|'none', beard, stubble, eyes: 'open'|'none', age, brow } */
function paintHead(x, w, h, R, vOf, o) {
  const Y = yH => (1 - vOf(yH)) * h, cx = FU * w;
  Pnt.fill(x, w, h, o.skin); Pnt.sides(x, w, h, 0.32); Pnt.specks(x, w, h, R, 500, 0.06);
  // mejillas y sombra bajo la mandíbula
  x.fillStyle = rgba(0x000000, 0.22); x.fillRect(0, Y(0.036), w, Y(0) - Y(0.036));
  const cheek = (dx, a) => { const g = x.createRadialGradient(cx + dx, Y(0.072), 1, cx + dx, Y(0.072), 16); g.addColorStop(0, `rgba(150,60,50,${a})`); g.addColorStop(1, 'rgba(150,60,50,0)'); x.fillStyle = g; x.fillRect(cx + dx - 16, Y(0.072) - 16, 32, 32); };
  cheek(-20, 0.18); cheek(20, 0.18);
  // ojos: cuencas en sombra, blanco sucio, pupila
  if (o.eyes !== 'none') [-16, 16].forEach(dx => { const ey = Y(0.097);
    x.fillStyle = 'rgba(30,18,14,.45)'; x.beginPath(); x.ellipse(cx + dx, ey, 9, 6, 0, 0, 7); x.fill();
    x.fillStyle = '#cfc4ae'; x.beginPath(); x.ellipse(cx + dx, ey, 5.5, 2.8, 0, 0, 7); x.fill();
    x.fillStyle = '#1a120e'; x.beginPath(); x.arc(cx + dx + (dx > 0 ? -1 : 1), ey, 2.2, 0, 7); x.fill();
    x.strokeStyle = 'rgba(20,12,10,.8)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(cx + dx - 6, ey - 2); x.quadraticCurveTo(cx + dx, ey - 5, cx + dx + 6, ey - 2); x.stroke(); });
  // cejas, nariz, boca
  x.strokeStyle = o.brow || o.hair; x.lineWidth = 3; [-16, 16].forEach(dx => { x.beginPath(); x.moveTo(cx + dx - 8, Y(0.108) + (dx < 0 ? 1 : -1)); x.lineTo(cx + dx + 8, Y(0.108) + (dx < 0 ? -1 : 1)); x.stroke(); });
  x.strokeStyle = 'rgba(40,20,14,.55)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 2, Y(0.1)); x.lineTo(cx - 4, Y(0.079)); x.lineTo(cx + 3, Y(0.077)); x.stroke();
  x.fillStyle = 'rgba(50,20,16,.7)'; x.fillRect(cx - 9, Y(0.063), 18, 2.5);
  if (o.age) { x.strokeStyle = 'rgba(40,24,16,.35)'; x.lineWidth = 1; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(cx - 18, Y(0.121 + i * 0.004)); x.lineTo(cx + 18, Y(0.121 + i * 0.004)); x.stroke(); } }
  if (o.stubble) for (let i = 0; i < 900; i++) { const px = cx + (R() - 0.5) * 100, py = Y(0.04 + R() * 0.03); x.fillStyle = rgba(o.stubble, 0.5 * R()); x.fillRect(px, py, 1.5, 1.5); }
  if (o.beard) { // barba y bigote: cubren mandíbula y mentón
    x.fillStyle = o.beard; x.beginPath(); x.moveTo(cx - 50, Y(0.078)); x.lineTo(cx - 38, Y(0.058)); x.quadraticCurveTo(cx, Y(0.05), cx + 40, Y(0.064)); x.lineTo(cx + 52, Y(0.082)); x.lineTo(cx + 54, Y(0.03)); x.lineTo(cx - 54, Y(0.03)); x.fill();
    x.beginPath(); x.moveTo(cx - 14, Y(0.07)); x.quadraticCurveTo(cx, Y(0.075), cx + 14, Y(0.07)); x.lineTo(cx + 16, Y(0.062)); x.lineTo(cx - 16, Y(0.062)); x.fill();
    for (let i = 0; i < 160; i++) { x.strokeStyle = `rgba(0,0,0,${0.3 * R()})`; x.lineWidth = 1; const px = cx + (R() - 0.5) * 100, py = Y(0.03 + R() * 0.04); x.beginPath(); x.moveTo(px, py); x.lineTo(px + (R() - 0.5) * 3, py + 6); x.stroke(); } }
  if (o.hairStyle && o.hairStyle !== 'none') { // pelo: coronilla, raya al medio, y por detrás y a los lados
    x.fillStyle = o.hair; x.fillRect(0, 0, w, Y(0.134));
    x.beginPath(); x.moveTo(cx - 34, Y(0.134)); x.quadraticCurveTo(cx - 20, Y(0.124), cx, Y(0.131)); x.quadraticCurveTo(cx + 20, Y(0.124), cx + 34, Y(0.134)); x.lineTo(cx + 34, 0); x.lineTo(cx - 34, 0); x.fill();
    const low = o.hairStyle === 'long' ? h : Y(0.07); x.fillRect(0, 0, cx - 38, low); x.fillRect(cx + 38, 0, w - cx - 38, low);
    x.fillStyle = 'rgba(255,240,220,.08)'; x.fillRect(cx - 1, 0, 2, Y(0.13));
    for (let i = 0; i < 220; i++) { const px = R() * w; if (Math.abs(px - cx) < 36) continue; x.strokeStyle = `rgba(0,0,0,${0.35 * R()})`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, R() * low * 0.4); x.lineTo(px + (R() - 0.5) * 4, low * (0.5 + R() * 0.5)); x.stroke(); } }
}

/* ---------- el cuerpo ---------- */
/**
 * spec: { height, build (anchura), headK (cabeza = altura/headK), arms (largo relativo), legs, unlit, dream (fuerza del efecto),
 *   skin, head: {…paintHead}, torso(x,w,h,R), arm(x,w,h,R), leg(x,w,h,R), shoes, hair: { color, style }, beard, glasses,
 *   hat: { color }, band: { color } (venda en los ojos), scarf, eye (ojo que brilla: El Que Mira), pose: 'stand'|'sit' }
 * Devuelve { g, root, legL, legR, kneeL, kneeR, armL, armR, elbowL, elbowR, head, hairB, hairF, dream, H }.
 */
export function makeBody(spec) {
  const H = spec.height, b = spec.build || 1, hk = spec.headK || 7.5, R = rng(spec.seed || 7), body = { H };
  const dream = body.dream = { value: spec.dream == null ? 0.5 : spec.dream };
  const g = body.g = new THREE.Group(), root = body.root = new THREE.Group(); g.add(root); g.userData.dream = dream;
  const M = (map, o = {}) => { const m = spec.unlit ? new THREE.MeshBasicMaterial(Object.assign({ map, vertexColors: true }, o)) : new THREE.MeshLambertMaterial(Object.assign({ map, vertexColors: true }, o)); return dreamy(m, dream); };
  const mesh = (geo, mat, parent) => { const me = new THREE.Mesh(geo, mat); me.layers.set(CHAR_LAYER); parent.add(me); return me; };
  const piv = (x, y, z, parent) => { const o = new THREE.Group(); o.position.set(x, y, z); parent.add(o); return o; };
  // proporciones (fracciones de la altura)
  const hipY = 0.49 * H * (spec.legs || 1), kneeY = 0.27 * H * (spec.legs || 1), ankY = 0.045 * H, shY = 0.80 * H, neckY = 0.835 * H;
  const sw = 0.112 * H * b, hw = 0.053 * H * b, zf = 0.6, al = spec.arms || 1;
  const occ = [{ c: new THREE.Vector3(0, neckY - 0.01 * H, 0.02 * H), r: 0.07 * H, s: 0.5 }, { c: new THREE.Vector3(-sw * 0.85, shY - 0.07 * H, 0), r: 0.06 * H, s: 0.55 }, { c: new THREE.Vector3(sw * 0.85, shY - 0.07 * H, 0), r: 0.06 * H, s: 0.55 }, { c: new THREE.Vector3(0, hipY - 0.03 * H, 0), r: 0.07 * H, s: 0.5 }];
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  // texturas
  const T = (w, h, f) => { const t = canvasTex(w, h, (x, W, Hh) => f(x, W, Hh, rng((spec.seed || 7) + w + h)), false); t.magFilter = THREE.NearestFilter; return t; };
  const cloth = c => (x, w, h, R) => { Pnt.fill(x, w, h, c); Pnt.sides(x, w, h, 0.3); Pnt.folds(x, w, h, R, 26, 0.3); Pnt.specks(x, w, h, R, 300, 0.12); };
  const torsoT = T(256, 256, spec.torso || cloth(spec.top || '#333')), armT = T(64, 128, spec.arm || cloth(spec.top || '#333')), legT = T(64, 128, spec.leg || cloth(spec.pants || '#222'));
  const torsoM = M(torsoT), armM = M(armT), legM = M(legT), shoeM = M(null), hairM = M(spec.hair ? T(64, 64, (x, w, h, R) => { Pnt.fill(x, w, h, spec.hair.color); for (let i = 0; i < 90; i++) { x.strokeStyle = `rgba(0,0,0,${0.4 * R()})`; x.lineWidth = 1; const px = R() * w; x.beginPath(); x.moveTo(px, 0); x.lineTo(px + (R() - 0.5) * 6, h); x.stroke(); } Pnt.specks(x, w, h, R, 80, 0.15, true); }) : null);

  // torso: pelvis → cintura → pecho → hombros caídos → cuello
  const tp = [[0.06, 0.465], [0.088, 0.475], [0.096, 0.5], [0.089 * (spec.belly || 1), 0.56], [0.093 * (spec.belly || 1), 0.64], [0.1, 0.72], [0.104, 0.775], [0.092, 0.81], [0.058, 0.828], [0.032, 0.837]].map(([r, y]) => [r * H * (y > 0.6 ? b : Math.min(b, 1.05)), y * H]);
  tp[0][1] = hipY - 0.025 * H; tp[1][1] = hipY - 0.015 * H; tp[2][1] = hipY + 0.01 * H;
  const torso = xf(lathe(tp, 10), null); torso.scale(1, 1, zf); mesh(bake(torso, V(0, 0, 0), occ, H), torsoM, root);

  // piernas: muslo (pivote cadera) → rodilla → pantorrilla y zapato
  const legs = s => { const p = piv(s * hw, hipY, 0, root), k = piv(0, -(hipY - kneeY), 0, p);
    const th = uvRect(limb(0.052 * H * b, 0.034 * H, hipY - kneeY, 8, 0.004 * H, 0.2), 0.5, 1); th.scale(1, 1, 0.92); mesh(bake(th, V(s * hw, hipY, 0), occ, H), legM, p);
    const sh = uvRect(limb(0.036 * H, 0.022 * H, kneeY - ankY, 8, 0.007 * H, 0.3), 0, 0.5); mesh(bake(sh, V(s * hw, kneeY, 0), occ, H), legM, k);
    const fo = xf(ball(0.032 * H, 0.026 * H, 0.075 * H), [0, -(kneeY - ankY) - 0.012 * H, 0.03 * H]); mesh(bake(fo, V(s * hw, kneeY, 0), [], H, spec.shoes || 0x111111), shoeM, k);
    return [p, k]; };
  [body.legL, body.kneeL] = legs(-1); [body.legR, body.kneeR] = legs(1);

  // brazos: hombro redondo + brazo (pivote hombro) → codo → antebrazo y mano
  const ua = 0.175 * H * al, fa = 0.16 * H * al;
  const arms = s => { const p = piv(s * sw, shY, 0, root), e = piv(0, -ua, 0, p);
    const up = uvRect(limb(0.034 * H * b, 0.026 * H, ua, 7, 0.004 * H, 0.35), 0.5, 1); const del = uvRect(xf(ball(0.033 * H * b, 0.03 * H, 0.031 * H * b), [0, -0.016 * H, 0]), 0.92, 1);
    mesh(bake(merge([up, del]), V(s * sw, shY, 0), occ, H), armM, p);
    const fo = uvRect(limb(0.026 * H, 0.019 * H, fa, 7, 0.003 * H, 0.25), 0.06, 0.5), hand = uvRect(xf(ball(0.02 * H, 0.045 * H, 0.03 * H, 6), [0, -fa - 0.04 * H, 0.004 * H]), 0, 0.05);
    mesh(bake(merge([fo, hand]), V(s * sw, shY - ua, 0), occ, H), armM, e);
    p.rotation.z = s * 0.06; e.rotation.x = -0.12; return [p, e]; };
  [body.armL, body.elbowL] = arms(-1); [body.armR, body.elbowR] = arms(1);

  // cabeza (pivote en la base del cuello): cuello, mandíbula, cráneo; la nariz es una cuña.
  // Alturas «de referencia» (fracciones de H para una cabeza de 1/7.5): cuello 0…0.032, mentón 0.032, ojos 0.097, coronilla 0.165.
  const head = body.head = piv(0, neckY, 0, root), k = 7.5 / hk, c0 = 0.032 * H, hy = spec.headY || 1, hwk = spec.headW || 1;
  const yRef = yd => yd < 0.032 ? yd * H : c0 + (yd - 0.032) * H * k;   // altura de referencia → altura real (antes del estirado hy)
  const hp = [[0.026 * H, 0], [0.025 * H, 0.02 * H], ...[[0.03, 0], [0.04, 0.008], [0.047, 0.033], [0.05, 0.058], [0.051, 0.078], [0.046, 0.103], [0.034, 0.121], [0.016, 0.13], [0, 0.1333]].map(([r, y]) => [r * H * k, c0 + y * H * k])];
  const vOf = yd => { const y = yRef(yd); for (let j = 0; j < hp.length - 1; j++) if (y <= hp[j + 1][1]) return (j + clamp((y - hp[j][1]) / Math.max(1e-6, hp[j + 1][1] - hp[j][1]), 0, 1)) / (hp.length - 1); return 1; };
  const headT = T(256, 256, (x, w, h, R) => spec.paintHead ? spec.paintHead(x, w, h, R, vOf) : paintHead(x, w, h, R, vOf, Object.assign({ skin: spec.skin || '#8a7560', hair: spec.hair ? spec.hair.color : '#111', hairStyle: spec.hair && spec.hair.style }, spec.head || {})));
  const sk = lathe(hp, 10); sk.scale(0.9 * hwk, hy, 1.05);
  const Y = yd => yRef(yd) * hy, zFront = 0.05 * H * k * 1.05, eyeY = Y(0.097), topY = Y(0.165);
  const parts = [sk];
  if (!spec.noNose) { const nose = xf(new THREE.ConeGeometry(0.009 * H * k, 0.03 * H * k, 4), [0, Y(0.088), zFront + 0.004 * H * k], [PI / 2 - 0.25, PI / 4, 0]); parts.push(uvRect(nose, vOf(0.088) - 0.01, vOf(0.088), FU - 0.01, FU + 0.01)); }
  mesh(bake(merge(parts), V(0, neckY, 0), occ, H), M(headT), head);
  // pelo: casquete, melena por detrás (pivote, se mece) y mechones delante de los hombros
  if (spec.hair && spec.hair.style !== 'none') {
    const cap = lathe(hp.filter(q => q[1] >= yRef(0.122)).map(([r, y]) => [r + 0.004 * H * k, y + 0.003 * H * k]), 10); cap.scale(0.92 * hwk, hy, 1.08);
    mesh(bake(cap, V(0, neckY, 0), [], H), hairM, head);
    if (spec.hair.style === 'long') {
      body.hairB = piv(0, topY * 0.82, -0.035 * H, head); const mane = xf(limb(0.05 * H, 0.04 * H, 0.2 * H, 8), [0, 0, 0]); mane.scale(1.05, 1, 0.42); mesh(bake(mane, V(0, neckY + topY * 0.8, -0.04 * H), [], H), hairM, body.hairB);
      body.hairF = [-1, 1].map(s => { const o = piv(s * 0.05 * H, topY * 0.62, -0.006 * H, head); const st = limb(0.011 * H, 0.008 * H, 0.14 * H, 5); st.scale(0.8, 1, 0.6); mesh(bake(st, V(s * 0.046 * H, neckY + topY * 0.6, 0), [], H), hairM, o); o.rotation.z = s * 0.1; return o; });
    }
  }
  if (spec.beard) { const bd = xf(ball(0.031 * H * k, 0.034 * H * k, 0.024 * H * k, 7), [0, Y(0.036), 0.036 * H * k]); mesh(bake(bd, V(0, neckY, 0.03 * H), [], H, 0xbbbbbb), hairM, head); }
  if (spec.glasses) { // gafas redondas: aros de metal y cristales oscuros
    const metal = dreamy(new THREE.MeshPhongMaterial({ color: 0x9a9a9a, specular: 0xffffff, shininess: 90 }), dream), lens = dreamy(new THREE.MeshPhongMaterial({ color: 0x070707, specular: 0xa0b0c0, shininess: 120 }), dream);
    const zg = zFront + 0.003 * H * k;
    [-1, 1].forEach(s => { mesh(xf(new THREE.TorusGeometry(0.0115 * H, 0.002 * H, 4, 12), [s * 0.018 * H, eyeY, zg]), metal, head); mesh(xf(new THREE.CircleGeometry(0.0105 * H, 12), [s * 0.018 * H, eyeY, zg - 0.001 * H]), lens, head);
      mesh(xf(new THREE.CylinderGeometry(0.0016 * H, 0.0016 * H, 0.05 * H, 4), [s * 0.04 * H, eyeY, zg - 0.024 * H], [PI / 2, 0, 0]), metal, head); });
    mesh(xf(new THREE.CylinderGeometry(0.0016 * H, 0.0016 * H, 0.012 * H, 4), [0, eyeY + 0.002 * H, zg], [0, 0, PI / 2]), metal, head);
  }
  if (spec.band) { // venda sobre los ojos, con nudo detrás
    const bt = T(128, 32, (x, w, h, R) => { Pnt.fill(x, w, h, spec.band.color); Pnt.folds(x, w, h, R, 30, 0.25, 'h'); for (let i = 0; i < 5; i++) { const g2 = x.createRadialGradient(R() * w, R() * h, 1, R() * w, R() * h, 10 + R() * 10); g2.addColorStop(0, 'rgba(90,60,30,.35)'); g2.addColorStop(1, 'rgba(90,60,30,0)'); x.fillStyle = g2; x.fillRect(0, 0, w, h); } });
    const r0 = 0.053 * H * k, ring = lathe([[r0 * 0.98, eyeY - 0.02 * H], [r0 * 1.03, eyeY - 0.008 * H], [r0 * 1.04, eyeY + 0.008 * H], [r0 * 0.99, eyeY + 0.02 * H]], 12); ring.scale(0.92 * hwk, 1, 1.08);
    const knot = xf(ball(0.014 * H, 0.012 * H, 0.012 * H, 5), [0, eyeY, -r0 * 1.1]), tail = xf(limb(0.008 * H, 0.005 * H, 0.06 * H, 4), [0, eyeY, -r0 * 1.12], [0.3, 0, 0]);
    mesh(bake(merge([ring, uvRect(knot, 0, 1), uvRect(tail, 0, 1)]), V(0, neckY, 0), [], H), M(bt), head);
  }
  if (spec.hat) { // sombrero de ala ancha
    const hm = M(T(64, 64, (x, w, h, R) => { Pnt.fill(x, w, h, spec.hat.color); Pnt.specks(x, w, h, R, 200, 0.2); x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(0, h * 0.55, w, h * 0.12); }));
    const y0 = topY * 0.8, brim = lathe([[0.03 * H, y0 - 0.002 * H], [0.11 * H, y0 - 0.008 * H], [0.112 * H, y0 - 0.004 * H], [0.06 * H, y0 + 0.003 * H]], 12), crown = lathe([[0.055 * H, y0], [0.054 * H, y0 + 0.03 * H], [0.05 * H, y0 + 0.055 * H], [0.03 * H, y0 + 0.064 * H], [0, y0 + 0.062 * H]], 10);
    brim.scale(0.95, 1, 1.05); crown.scale(0.95, 1, 1.05); mesh(bake(merge([brim, crown]), V(0, neckY, 0), [], H), hm, head);
  }
  if (spec.scarf) { const sc = M(T(64, 32, (x, w, h, R) => { Pnt.fill(x, w, h, spec.scarf); Pnt.folds(x, w, h, R, 20, 0.35); }));
    const ring = lathe([[0.032 * H, -0.012 * H], [0.045 * H, -0.004 * H], [0.044 * H, 0.012 * H], [0.03 * H, 0.02 * H]], 9); ring.scale(1, 1, 0.9); mesh(bake(ring, V(0, neckY, 0), [], H), sc, root).position.set(0, neckY, 0.005 * H); }
  if (spec.eye) { // El Que Mira: un ojo claro delante y otro detrás; brillan en la niebla
    const em = dreamy(new THREE.MeshBasicMaterial({ color: 0xd8d2c0, fog: false }), dream), ez = zFront + 0.003 * H * k;
    [0, PI].forEach(a => { const e = mesh(new THREE.CircleGeometry(0.016 * H * k, 10), em, head); e.position.set(0, eyeY, a ? -ez : ez); e.rotation.y = a; });
  }
  return body;
}

/* ---------- el protagonista: un melenudo del doom, fan del ocultismo de los 70 ---------- */
const DENIM = '#3d4a5e', SHIRT = '#141316';
const HERO = { height: 1.78, build: 1.02, dream: 0.4, seed: 301, skin: '#8f7864', shoes: 0x16130f,
  hair: { color: '#19120d', style: 'long' }, beard: true, glasses: true, head: { beard: '#231912', brow: '#19120d' },
  torso(x, w, h, R) { // camiseta negra con estampado, chaleco vaquero abierto con parches, cinturón de balas
    Pnt.fill(x, w, h, SHIRT); const cx = FU * w, gap = 24, bx = 0.25 * w;
    x.fillStyle = DENIM; x.fillRect(0, 0, cx - gap, h * 0.8); x.fillRect(cx + gap, 0, w - cx - gap, h * 0.8);
    for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(${R() < 0.5 ? '20,26,36' : '120,135,150'},${0.12 + R() * 0.12})`; const px = R() * w; if (Math.abs(px - cx) < gap) continue; x.fillRect(px, R() * h * 0.8, 1, 8 + R() * 30); }
    x.strokeStyle = 'rgba(190,160,90,.6)'; x.setLineDash([4, 3]); x.lineWidth = 1.5; [cx - gap - 3, cx + gap + 3].forEach(px => { x.beginPath(); x.moveTo(px, 0); x.lineTo(px, h * 0.8); x.stroke(); }); x.setLineDash([]);
    // estampado de la camiseta (se ve por la abertura): planeta con anillo y «SATURNO» en vertical
    x.strokeStyle = '#9a6ac0'; x.lineWidth = 3; x.beginPath(); x.arc(cx, h * 0.36, 13, 0, 7); x.stroke(); x.strokeStyle = '#6f9a42'; x.beginPath(); x.ellipse(cx, h * 0.36, 22, 6, -0.3, 0, 7); x.stroke();
    x.save(); x.translate(cx + 3, h * 0.62); x.rotate(-PI / 2); x.font = 'bold 13px Georgia, serif'; x.fillStyle = '#9a6ac0'; x.textAlign = 'center'; x.fillText('SATURNO', 0, 0); x.restore();
    // parches delanteros: luna y «DOOM»; parche grande en la espalda
    const patch = (px, py, bg, fg, f) => { x.fillStyle = bg; x.fillRect(px - 15, py - 10, 30, 20); x.strokeStyle = fg; x.lineWidth = 2; x.strokeRect(px - 14, py - 9, 28, 18); x.fillStyle = fg; f(px, py); };
    patch(cx - gap - 22, h * 0.3, '#14121a', '#9a6ac0', (px, py) => { x.beginPath(); x.arc(px, py, 6, 0.4, 5.9); x.fill(); });
    patch(cx + gap + 22, h * 0.44, '#4a1812', '#d0a050', (px, py) => { x.font = 'bold 10px Georgia, serif'; x.textAlign = 'center'; x.fillText('DOOM', px, py + 4); });
    x.fillStyle = '#121016'; x.beginPath(); x.arc(bx, h * 0.38, 34, 0, 7); x.fill(); x.strokeStyle = '#9a6ac0'; x.lineWidth = 3; x.beginPath(); x.arc(bx, h * 0.38, 31, 0, 7); x.stroke();
    x.fillStyle = '#d8cfbb'; x.beginPath(); x.moveTo(bx - 14, h * 0.4); x.quadraticCurveTo(bx, h * 0.34, bx + 14, h * 0.4); x.quadraticCurveTo(bx, h * 0.46, bx - 14, h * 0.4); x.fill(); x.fillStyle = '#121016'; x.beginPath(); x.arc(bx, h * 0.4, 4, 0, 7); x.fill();
    x.font = 'bold 9px Georgia, serif'; x.fillStyle = '#9a6ac0'; x.textAlign = 'center'; x.fillText('SATURNO', bx, h * 0.38 + 22);
    // vaqueros y cinturón con balas
    x.fillStyle = '#1d1d23'; x.fillRect(0, h * 0.86, w, h * 0.14); x.fillStyle = '#0e0d0c'; x.fillRect(0, h * 0.8, w, h * 0.06);
    for (let i = 0; i < 16; i++) { const px = cx - 70 + i * 9; x.fillStyle = '#a08040'; x.fillRect(px, h * 0.795, 4, 12); x.fillStyle = '#d8b870'; x.fillRect(px + 1, h * 0.795, 2, 4); }
    Pnt.sides(x, w, h, 0.32); Pnt.folds(x, w, h, R, 30, 0.22); },
  arm(x, w, h, R) { Pnt.fill(x, w, h, HERO.skin); Pnt.vgrad(x, w, h, 0, h * 0.24, SHIRT, SHIRT);   // manga corta negra
    x.fillStyle = '#0e0d0c'; x.fillRect(0, h * 0.84, w, h * 0.08); for (let i = 0; i < 8; i++) { x.fillStyle = '#b0b0b0'; x.fillRect(i * 8 + 3, h * 0.865, 3, 3); }   // muñequera con tachuelas
    for (let i = 0; i < 160; i++) { x.fillStyle = `rgba(40,25,15,${0.25 * R()})`; x.fillRect(R() * w, h * 0.3 + R() * h * 0.5, 1, 2); }
    Pnt.sides(x, w, h, 0.28); },
  leg(x, w, h, R) { Pnt.fill(x, w, h, '#1d1d23'); Pnt.sides(x, w, h, 0.3); Pnt.folds(x, w, h, R, 14, 0.4, 'h'); Pnt.specks(x, w, h, R, 300, 0.1, true); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, h * 0.47, w, 4); },
};
/** Protagonista: llena p.g y los pivotes que anima Player (legL/legR, armL/armR) y animateHero (rodillas, codos, cabeza, melena). */
export function buildHero(p, world) {
  const b = makeBody(HERO); Object.assign(p, { g: b.g, body: b, legL: b.legL, legR: b.legR, kneeL: b.kneeL, kneeR: b.kneeR, armL: b.armL, armR: b.armR, elbowL: b.elbowL, elbowR: b.elbowR, head: b.head, hairB: b.hairB, hairF: b.hairF }); p.t = 0;
  // sombra en el suelo: es parte del escenario (capa 0), no del personaje
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.42, 12), new THREE.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.45, depthWrite: false })); sh.rotation.x = -PI / 2; sh.position.y = 0.02; p.g.add(sh);
}
/** Movimiento propio del modelo en cada fotograma: cabeza, melena; rodillas y codos siguen a la marcha. */
export function animateHero(p, dt) {
  p.t += dt; const t = p.t; p.head.rotation.x = 0.05 + Math.max(0, Math.sin(t * 1.15)) ** 3 * 0.09; p.head.rotation.y = Math.sin(t * 0.21) * 0.25;
  p.hairB.rotation.x = 0.12 + Math.sin(t * 0.9) * 0.04 - p.head.rotation.x * 0.6; p.hairF.forEach((o, i) => { o.rotation.x = -0.05 + Math.sin(t * 0.9 + i) * 0.04 - p.head.rotation.x * 0.5; });
  p.armL.rotation.z = -0.06; p.armR.rotation.z = 0.06;
  p.kneeL.rotation.x = Math.max(0, p.legL.rotation.x) * 1.3; p.kneeR.rotation.x = Math.max(0, p.legR.rotation.x) * 1.3;
  p.elbowL.rotation.x = -0.12 - Math.max(0, -p.armL.rotation.x) * 0.5; p.elbowR.rotation.x = p.armR.rotation.x < -0.6 ? -0.35 : -0.12 - Math.max(0, -p.armR.rotation.x) * 0.5;
}

/* ---------- Anselmo, el farolero ciego: abrigo largo, bufanda, sombrero, venda; sentado en su banco ---------- */
const COAT = '#3a3128';
const ANSELMO = { height: 1.7, build: 1.08, belly: 1.06, dream: 1.0, seed: 77, skin: '#8a7a68', shoes: 0x14110d, scarf: '#5f5a50',
  hat: { color: '#16130f' }, band: { color: '#cbbf9e' }, hair: { color: '#8a8478', style: 'short' }, head: { eyes: 'none', stubble: '#9a948a', age: true, brow: '#8a8478' },
  torso(x, w, h, R) { Pnt.fill(x, w, h, COAT); const cx = FU * w; x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(cx - 2, 0, 4, h);   // abrigo cruzado: botones y solapas
    for (let i = 0; i < 4; i++) { x.fillStyle = '#17120c'; x.beginPath(); x.arc(cx + 12, h * (0.2 + i * 0.17), 3, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.moveTo(cx - 30, 0); x.lineTo(cx, h * 0.3); x.lineTo(cx + 30, 0); x.fill();
    Pnt.sides(x, w, h, 0.35); Pnt.folds(x, w, h, R, 40, 0.35); Pnt.specks(x, w, h, R, 500, 0.12); Pnt.specks(x, w, h, R, 120, 0.08, true); },
  arm(x, w, h, R) { Pnt.fill(x, w, h, COAT); Pnt.folds(x, w, h, R, 20, 0.4, 'h'); Pnt.sides(x, w, h, 0.3); x.fillStyle = 'rgba(0,0,0,.4)'; x.fillRect(0, h * 0.86, w, 5); x.fillStyle = ANSELMO.skin; x.fillRect(0, h * 0.94, w, h * 0.06); },
  leg(x, w, h, R) { Pnt.fill(x, w, h, '#4a443a'); x.fillStyle = COAT; x.fillRect(0, 0, w, h * 0.5);   // el abrigo cae sobre los muslos
    Pnt.folds(x, w, h, R, 18, 0.4); Pnt.sides(x, w, h, 0.3); Pnt.specks(x, w, h, R, 200, 0.12); },
};
export function makeAnselmo(world) {
  const b = makeBody(ANSELMO), g = b.g;
  // sentado: la cadera a la altura del asiento, muslos hacia delante, manos sobre las rodillas
  b.root.position.y = 0.55 - 0.49 * ANSELMO.height; [b.legL, b.legR].forEach(l => { l.rotation.x = -PI / 2 + 0.06; }); [b.kneeL, b.kneeR].forEach(k => { k.rotation.x = PI / 2 - 0.1; });
  [b.armL, b.armR].forEach(a => { a.rotation.x = -0.55; }); [b.elbowL, b.elbowR].forEach(e => { e.rotation.x = -0.75; }); b.root.rotation.x = 0.06;
  // la pértiga del farolero
  const wood = dreamy(new THREE.MeshLambertMaterial({ color: 0x4a3520 }), b.dream), metal = dreamy(new THREE.MeshLambertMaterial({ color: 0x5a5650 }), b.dream);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 2.6, 6), wood); pole.position.set(0.55, 1.25, 0.1); pole.rotation.z = 0.12; pole.layers.set(CHAR_LAYER); g.add(pole);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 4, 8, PI * 1.3), metal); hook.position.set(0.41, 2.55, 0.1); hook.layers.set(CHAR_LAYER); g.add(hook);
  g.userData.head = b.head; return g;
}

/* ---------- El Que Mira: altísimo, delgado, brazos muy largos, sin cara; un ojo delante y otro detrás ---------- */
const WATCHER = { height: 2.9, build: 0.55, headK: 9.5, headY: 1.35, headW: 0.8, arms: 1.45, legs: 1.04, unlit: true, eye: true, seed: 13, dream: 1.0, shoes: 0x050505, noNose: true,
  paintHead(x, w, h, R) { Pnt.fill(x, w, h, '#060606'); Pnt.specks(x, w, h, R, 300, 0.05, true); },
  torso(x, w, h, R) { Pnt.fill(x, w, h, '#070707'); Pnt.folds(x, w, h, R, 50, 0.6); Pnt.specks(x, w, h, R, 200, 0.04, true); },
  arm(x, w, h, R) { Pnt.fill(x, w, h, '#070707'); Pnt.specks(x, w, h, R, 120, 0.04, true); },
  leg(x, w, h, R) { Pnt.fill(x, w, h, '#060606'); Pnt.folds(x, w, h, R, 20, 0.5); },
};
export function makeWatcher(world, s) {
  const b = makeBody(WATCHER), g = b.g; g.scale.setScalar(s);
  g.userData.armL = b.armL; g.userData.armR = b.armR; g.userData.head = b.head; g.userData.watcher = true; return g;
}

/* ---------- fuerza del efecto de sueño por fotograma ----------
   El Que Mira es al revés que los demás: cuanto más cerca de la cámara y del centro de la pantalla, más nítido. */
const _v = new THREE.Vector3();
export function dreamUpdate(d, cam) {
  for (const w of [d.watcher, d.sombra]) { if (!w || !w.visible) continue; w.userData.head.getWorldPosition(_v); const dist = _v.distanceTo(cam.position); _v.project(cam);
    const c = Math.hypot(_v.x, _v.y), sharp = (1 - THREE.MathUtils.smoothstep(dist, 2.5, 14)) * (1 - THREE.MathUtils.smoothstep(c, 0.15, 0.85)); w.userData.dream.value = 1 - 0.95 * sharp; }
}
