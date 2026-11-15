import * as THREE from 'three';
import { $ } from './shared/util.js';
import { game, Game } from './shared/game.js';
/* Punto de entrada: esbuild empaqueta desde aquí todo el juego (y three.js) en un IIFE dentro del HTML. */

/* ---------- arranque con comprobación de requisitos ---------- */
(function () {
  const fail = msg => { const e = $('err'); e.innerHTML = msg; e.classList.remove('hidden'); $('title').classList.add('hidden'); };
  try {
    const t = document.createElement('canvas'); if (!(window.WebGLRenderingContext && (t.getContext('webgl2') || t.getContext('webgl') || t.getContext('experimental-webgl')))) return fail('El sueño no puede empezar.<br>Este navegador no tiene WebGL. Prueba con otro navegador.');
    new Game().boot();
    // para los tests e2e: el juego y la versión de three.js (ya no hay THREE global)
    window.__sueno = game; window.__sueno.three = THREE.REVISION;
  } catch (e) { console.error(e); fail('El sueño no puede empezar.<br>Hay un error en este navegador.'); }
})();
