import * as THREE from 'three';
import { rng } from './util.js';
/* Texturas procedurales (canvas): superficies, suciedad, texto pintado. */
export function canvasTex(w, h, draw, clamp) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); if (!clamp) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 2; return t;
}
/* manchas, suciedad y ruido comunes a todas las superficies */
export function grime(g, w, h, R, n, cols, rmin, rmax, a) {
  for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h, r = rmin + R() * (rmax - rmin); const gr = g.createRadialGradient(x, y, 0, x, y, r);
    const c = cols[Math.floor(R() * cols.length)]; gr.addColorStop(0, `rgba(${c},${a * (0.4 + R() * 0.6)})`); gr.addColorStop(1, `rgba(${c},0)`); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
}
export function speckle(g, w, h, R, n, lo, hi, a) { for (let i = 0; i < n; i++) { const v = Math.floor(lo + R() * (hi - lo)); g.fillStyle = `rgba(${v},${v},${v},${a})`; g.fillRect(R() * w, R() * h, 1 + R() * 2, 1 + R() * 2); } }
export function drips(g, w, h, R, n, col, a) { for (let i = 0; i < n; i++) { const x = R() * w, y = R() * h * 0.7, l = 30 + R() * h * 0.4, ww = 2 + R() * 9; const gr = g.createLinearGradient(0, y, 0, y + l); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`); g.fillStyle = gr; g.fillRect(x, y, ww, l); } }

export const TEX = {};
export function buildTextures() {
  TEX.asphalt = canvasTex(512, 512, (g, w, h) => { const R = rng(11); g.fillStyle = '#2b2b2c'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, 9000, 20, 90, 0.5);
    grime(g, w, h, R, 26, ['8,8,10', '14,13,12'], 30, 130, 0.75); g.strokeStyle = 'rgba(5,5,5,.8)'; g.lineWidth = 1.5;
    for (let i = 0; i < 9; i++) { g.beginPath(); let x = R() * w, y = R() * h; g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += (R() - 0.5) * 70; y += (R() - 0.5) * 70; g.lineTo(x, y); } g.stroke(); } });
  TEX.cobble = canvasTex(512, 512, (g, w, h) => { const R = rng(23); g.fillStyle = '#151514'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const ox = (y % 2) * 32, v = 44 + R() * 30; g.fillStyle = `rgb(${v + 4},${v},${v - 4})`; const px = x * 64 + ox + 3 + R() * 3, py = y * 64 + 3 + R() * 3; g.beginPath(); g.roundRect ? g.roundRect(px, py, 56 - R() * 4, 56 - R() * 4, 7) : g.rect(px, py, 56, 56); g.fill(); if (px + 56 > w) { g.beginPath(); g.rect(px - w, py, 56, 56); g.fill(); } }
    speckle(g, w, h, R, 6000, 10, 100, 0.35); grime(g, w, h, R, 22, ['6,6,7', '30,22,14'], 40, 150, 0.7); });
  const brick = (seed, base) => canvasTex(512, 512, (g, w, h) => { const R = rng(seed); g.fillStyle = '#1a1614'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = -1; x < 8; x++) { const ox = (y % 2) * 32, t = R(); g.fillStyle = `rgb(${base[0] + t * 34},${base[1] + t * 18},${base[2] + t * 12})`; g.fillRect(x * 64 + ox + 2, y * 32 + 2, 60, 28); }
    speckle(g, w, h, R, 7000, 0, 70, 0.35); grime(g, w, h, R, 30, ['8,7,6', '20,24,16'], 30, 140, 0.75); drips(g, w, h, R, 22, '6,5,4', 0.55); });
  TEX.brick = brick(31, [70, 38, 30]); TEX.brick2 = brick(47, [62, 50, 44]);
  TEX.stone = canvasTex(512, 512, (g, w, h) => { const R = rng(53); g.fillStyle = '#0f0f0e'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++) for (let x = -1; x < 3; x++) { const ox = (y % 2) * 96, v = 46 + R() * 22; g.fillStyle = `rgb(${v},${v - 2},${v - 7})`; g.fillRect(x * 192 + ox + 3, y * 128 + 3, 186, 122); }
    speckle(g, w, h, R, 9000, 10, 90, 0.4); grime(g, w, h, R, 30, ['5,6,5', '26,30,20', '40,20,12'], 30, 150, 0.7); drips(g, w, h, R, 26, '4,5,4', 0.6); });
  TEX.plaster = canvasTex(512, 512, (g, w, h) => { const R = rng(67); g.fillStyle = '#6b6658'; g.fillRect(0, 0, w, h); speckle(g, w, h, R, 6000, 40, 130, 0.25);
    grime(g, w, h, R, 28, ['30,26,20', '20,20,18', '70,40,24'], 30, 160, 0.6); drips(g, w, h, R, 16, '20,16,12', 0.5);
    g.fillStyle = 'rgba(60,70,50,.35)'; g.fillRect(0, h * 0.62, w, h * 0.38); g.fillStyle = 'rgba(15,12,10,.7)'; g.fillRect(0, h * 0.62, w, 5); });
  TEX.tile = canvasTex(256, 256, (g, w, h) => { const R = rng(71); for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { const d = (x + y) % 2, v = d ? 96 + R() * 14 : 36 + R() * 10; g.fillStyle = `rgb(${v},${v - 3},${v - 12})`; g.fillRect(x * 64, y * 64, 64, 64); }
    g.strokeStyle = '#0c0b0a'; g.lineWidth = 2; for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, h); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke(); }
    grime(g, w, h, R, 14, ['10,8,6', '50,30,16'], 20, 80, 0.7); speckle(g, w, h, R, 2000, 0, 60, 0.4); });
  TEX.rust = canvasTex(256, 256, (g, w, h) => { const R = rng(83); g.fillStyle = '#3b332c'; g.fillRect(0, 0, w, h); grime(g, w, h, R, 50, ['110,50,22', '70,30,14', '20,18,16'], 10, 60, 0.8); speckle(g, w, h, R, 3000, 10, 110, 0.4); drips(g, w, h, R, 10, '90,40,16', 0.5); });
  TEX.metal = canvasTex(256, 256, (g, w, h) => { const R = rng(89); g.fillStyle = '#23272a'; g.fillRect(0, 0, w, h); grime(g, w, h, R, 30, ['8,9,10', '70,36,20'], 10, 70, 0.6); speckle(g, w, h, R, 2500, 10, 90, 0.35);
    g.strokeStyle = 'rgba(0,0,0,.5)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.moveTo(0, i * 32); g.lineTo(w, i * 32); g.stroke(); } });
  TEX.wood = canvasTex(256, 256, (g, w, h) => { const R = rng(97); g.fillStyle = '#3a2c20'; g.fillRect(0, 0, w, h); for (let i = 0; i < 200; i++) { g.strokeStyle = `rgba(${R() < 0.5 ? '15,10,6' : '80,60,40'},${0.15 + R() * 0.2})`; g.beginPath(); const y = R() * h; g.moveTo(0, y); g.bezierCurveTo(80, y + R() * 8 - 4, 170, y + R() * 8 - 4, w, y); g.stroke(); }
    g.fillStyle = '#0d0906'; for (let i = 1; i < 4; i++) g.fillRect(0, i * 64, w, 2); grime(g, w, h, R, 14, ['10,8,6'], 20, 70, 0.6); });
  /* fachadas: 7 m de ancho × 14 m de alto por baldosa (planta baja + 3 pisos) */
  const facade = (seed, base, shop) => canvasTex(512, 1024, (g, w, h) => { const R = rng(seed); g.fillStyle = base; g.fillRect(0, 0, w, h); speckle(g, w, h, R, 14000, 20, 120, 0.22);
    grime(g, w, h, R, 40, ['20,18,16', '10,10,10', '60,40,26'], 40, 220, 0.55); drips(g, w, h, R, 40, '12,10,8', 0.5);
    const fy = h * (1 - 3.6 / 14);
    for (let fl = 0; fl < 3; fl++) { const top = 40 + fl * (fy - 40) / 3; g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, top + (fy - 40) / 3 - 14, w, 10);
      for (let i = 0; i < 2; i++) { const x = 70 + i * 250, ww = 120, hh = 170, y = top + 34; g.fillStyle = '#17140f'; g.fillRect(x - 10, y - 10, ww + 20, hh + 20);
        const lit = R() < 0.07; g.fillStyle = lit ? '#6a5a2c' : '#07080a'; g.fillRect(x, y, ww, hh);
        const st = R(); if (st < 0.55) { const ph = hh * (0.3 + R() * 0.7); g.fillStyle = '#2a2f27'; g.fillRect(x, y, ww, ph); g.strokeStyle = 'rgba(0,0,0,.6)'; for (let k = 0; k < ph; k += 7) { g.beginPath(); g.moveTo(x, y + k); g.lineTo(x + ww, y + k); g.stroke(); } }
        else if (st < 0.75) { g.strokeStyle = '#3c3a34'; g.lineWidth = 2; g.beginPath(); g.moveTo(x + R() * ww, y); g.lineTo(x + ww / 2, y + hh / 2); g.lineTo(x + R() * ww, y + hh); g.moveTo(x + ww / 2, y + hh / 2); g.lineTo(x + ww, y + R() * hh); g.stroke(); }
        g.strokeStyle = '#2b2620'; g.lineWidth = 3; g.strokeRect(x, y, ww, hh); g.beginPath(); g.moveTo(x + ww / 2, y); g.lineTo(x + ww / 2, y + hh); g.stroke();
        g.fillStyle = '#100e0c'; g.fillRect(x - 22, y + hh + 6, ww + 44, 9); g.strokeStyle = '#0a0908'; g.lineWidth = 2; for (let k = 0; k <= 10; k++) { g.beginPath(); g.moveTo(x - 20 + k * (ww + 40) / 10, y + hh - 34); g.lineTo(x - 20 + k * (ww + 40) / 10, y + hh + 6); g.stroke(); } g.strokeRect(x - 20, y + hh - 34, ww + 40, 2); } }
    g.fillStyle = '#1b1915'; g.fillRect(0, fy - 16, w, 16); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, fy, w, h - fy);
    if (shop) { g.fillStyle = '#31352f'; g.fillRect(40, fy + 30, 432, h - fy - 30); g.strokeStyle = 'rgba(0,0,0,.55)'; g.lineWidth = 2; for (let k = fy + 30; k < h; k += 9) { g.beginPath(); g.moveTo(40, k); g.lineTo(472, k); g.stroke(); }
      grime(g, w, h, R, 10, ['90,45,20'], 20, 70, 0.5); g.strokeStyle = 'rgba(120,30,20,.55)'; g.lineWidth = 5; g.beginPath(); let x = 80, y = fy + 120; g.moveTo(x, y); for (let k = 0; k < 9; k++) { x += 30 + R() * 20; y += (R() - 0.5) * 110; g.lineTo(x, y); } g.stroke(); }
    else { g.fillStyle = '#120f0c'; g.fillRect(190, fy + 50, 130, h - fy - 50); g.strokeStyle = '#2b2620'; g.lineWidth = 4; g.strokeRect(190, fy + 50, 130, h - fy - 50); g.fillStyle = '#07080a'; g.fillRect(40, fy + 70, 110, 120); g.fillRect(360, fy + 70, 110, 120); g.strokeRect(40, fy + 70, 110, 120); g.strokeRect(360, fy + 70, 110, 120);
      for (let k = 0; k < 6; k++) { g.fillStyle = '#0a0908'; g.fillRect(48 + k * 18, fy + 70, 3, 120); g.fillRect(368 + k * 18, fy + 70, 3, 120); } }
    g.fillStyle = 'rgba(8,8,8,.55)'; g.fillRect(0, h - 46, w, 46); });
  TEX.facA = facade(101, '#57503f', true); TEX.facB = facade(113, '#4a4a47', false); TEX.facC = facade(127, '#5b4a3c', true); TEX.facD = facade(139, '#454238', false);
  TEX.fog = canvasTex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, true);
}
/* textura con texto pintado (pintadas, carteles, rótulos) */
export function textTex(lines, o = {}) {
  const w = o.w || 512, h = o.h || 256;
  return canvasTex(w, h, g => paintText(g, w, h, lines, o), true);
}
export function paintText(g, w, h, lines, o) {
  g.clearRect(0, 0, w, h); if (o.bg) { g.fillStyle = o.bg; g.fillRect(0, 0, w, h); }
  const R = rng(o.seed || 7); const fs = o.size || 64; g.font = `${o.weight || 'bold'} ${fs}px ${o.font || 'Impact, "Arial Narrow Bold", "Helvetica Neue", Arial, sans-serif'}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((ln, i) => { const y = h / 2 + (i - (lines.length - 1) / 2) * fs * 1.15; g.fillStyle = o.color || '#8f2a18';
    if (o.rough) { for (let k = 0; k < 3; k++) { g.globalAlpha = 0.5; g.fillText(ln, w / 2 + (R() - 0.5) * 4, y + (R() - 0.5) * 4, w - 20); } g.globalAlpha = 1; const tw = Math.min(g.measureText(ln).width, w - 20); for (let k = 0; k < 7; k++) { const x = w / 2 - tw / 2 + R() * tw; g.fillRect(x, y, 2 + R() * 3, fs * (0.5 + R() * 1.4)); } }
    else g.fillText(ln, w / 2, y, w - 20); });
  if (o.after) o.after(g, w, h, R);
}

/* ---------- utilidades de geometría ---------- */
export function scaleBoxUV(geo, w, h, d, s) { const uv = geo.attributes.uv, dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) { const k = f * 4 + i; uv.setXY(k, uv.getX(k) * dims[f][0] / s[0], uv.getY(k) * dims[f][1] / s[1]); } }
export function paintTextRaw(g, txt, x, y, size, color) { g.font = `bold ${size}px Impact, "Arial Narrow Bold", "Helvetica Neue", Arial, sans-serif`; g.textAlign = 'center'; g.fillStyle = color; g.fillText(txt, x, y); g.globalAlpha = 0.5; g.fillText(txt, x + 1, y + 2); g.globalAlpha = 1; }
