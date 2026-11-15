/* Utilidades comunes: DOM, texto, números, aleatorio con semilla. */
export const $ = id => document.getElementById(id);
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const PI = Math.PI;
export function rng(seed) { return () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296; }
