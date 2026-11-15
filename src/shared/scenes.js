/* =====================================================================
   ESCENAS del capítulo. Cada escena es un plano con cámara, puntos
   activos (hs) y salidas (exits).
     mode: 'walk'  — en el modo normal aquí se camina libremente (calles);
     mode: 'frame' — plano fijo con puntos activos (interiores, primeros
                     planos, conversaciones) también en el modo normal.
   En el «modo lectura» todas las escenas son planos fijos y se usan las
   salidas (exits). En el modo normal, de un plano fijo se sale con
   «Salir» y se vuelve al punto de la calle desde donde se entró.
     at/ry: dónde está el protagonista en el plano;
     out:   punto de la calle por defecto al salir [x, z, ry];
     leaveIf(f): el plano se cierra solo después de un guion (modo normal).
   ===================================================================== */
export const SCREENS = {
  callejon1: { mode: 'walk', cam: 'callA', at: [0.2, -3.2], ry: Math.PI, hs: ['nota', 'linterna', 'puertaCallejon'],
    exits: [{ label: 'Seguir por el callejón', to: 'callejon2' }] },
  callejon2: { mode: 'walk', cam: 'callB', at: [0.2, -15.6], ry: -1.2, hs: ['grafiti', 'eco1'],
    exits: [{ label: 'Salir a la plaza', to: 'plaza1' }, { label: 'Volver al fondo del callejón', to: 'callejon1' }] },
  plaza1: { mode: 'walk', cam: 'plazaS', at: [2.5, -29.5], ry: Math.PI, hs: ['puertaTienda', 'eco2'],
    exits: [{ label: 'El quiosco', to: 'quiosco' }, { label: 'El banco', to: 'plaza2' }, { label: 'La cabina', to: 'plaza3' }, { label: 'La tienda', to: 'tienda', if: f => f.tiendaAbierta }, { label: 'El pasaje', to: 'boca' }, { label: 'El callejón', to: 'callejon2' }] },
  quiosco: { mode: 'frame', cam: 'quiosco', at: [-5.3, -29.6], ry: -0.6, out: [-4.4, -29.8, -0.6], hs: ['periodico'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
  plaza2: { mode: 'frame', cam: 'plazaNW', at: [-4.6, -41.2], ry: -1.9, out: [-4.2, -40.8, -1.9], hs: ['anselmo', 'venda'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
  plaza3: { mode: 'frame', cam: 'plazaNE', at: [6.6, -42.5], ry: 1.2, out: [6.4, -42.2, 1.2], hs: ['telefono'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
  boca: { mode: 'walk', cam: 'pasaje1', at: [-0.5, -46.6], ry: Math.PI, hs: ['sombra'],
    exits: [{ label: 'Entrar en el pasaje', act: async g => { if (!g.f.luz) { await g.think('El pasaje está muy oscuro. No veo nada.', 'Necesito luz.'); return; } if (!g.f.luzOn) { g.set('luzOn'); g.ui.toast('Linterna: encendida'); } if (!g.f.sombraVista) { g.set('sombraVista'); g.audio.voices(0.12); } await g.goTo('pasajeA'); } }, { label: 'Volver a la plaza', to: 'plaza1' }] },
  tienda: { mode: 'frame', cam: 'tienda', at: [16.6, -35.1], ry: 2.4, out: [11.7, -34, -Math.PI / 2], hs: ['radio', 'cajon', 'pilas', 'maquina', 'calendario', 'eco3'], exits: [{ label: 'Salir a la plaza', to: 'plaza1' }] },
  pasajeA: { mode: 'walk', cam: 'pasajeA', at: [-0.4, -54.2], ry: Math.PI, hs: ['mural_mano', 'mural_luna', 'mural_ojo', 'mural_boca'],
    exits: [{ label: 'Seguir adelante', act: async g => { if (g.f.chaseDone) await g.goTo('pasajeB'); else await g.chaseSeq(); } }, { label: 'Salir a la plaza', to: 'boca' }] },
  pasajeB: { mode: 'walk', cam: 'pasaje2', at: [0.2, -68.6], ry: Math.PI, hs: ['pared', 'informe'],
    exits: [{ label: 'Ir a la puerta', to: 'puerta' }, { label: 'Volver por el pasaje', to: 'pasajeA' }] },
  puerta: { mode: 'walk', cam: 'puerta', at: [1.3, -79.4], ry: Math.PI, hs: ['pedestal', 'placa', 'eco4'],
    exits: [{ label: 'Cruzar la puerta', if: f => f.puertaAbierta, act: async g => { g.ending(); } }, { label: 'Volver al pasaje', to: 'pasajeB' }] },
  // solo en el modo normal: primer plano del pedestal (en el modo lectura el pedestal está en «puerta»)
  pedestal: { mode: 'frame', soloNormal: true, cam: 'pedestal', at: [-0.9, -79.7], ry: 2.6, out: [0, -79.4, Math.PI], hs: ['pedestal'], leaveIf: f => !!f.puertaAbierta, exits: [] },
};
/** Plano fijo que abre un objeto de la calle en el modo normal (o null). La tienda se abre por su puerta, no por un objeto. */
const FRAME_OF = {}; Object.keys(SCREENS).forEach(id => { const s = SCREENS[id]; if (s.mode === 'frame' && id !== 'tienda') s.hs.forEach(h => { FRAME_OF[h] = id; }); });
export function frameOf(objId) { return FRAME_OF[objId] || null; }
/** Escena del modo lectura que corresponde a un punto de la calle. */
export function screenAt(x, z) { return x > 13.15 ? 'tienda' : z > -11 ? 'callejon1' : z > -22 ? 'callejon2' : z > -45.5 ? 'plaza1' : z > -50.5 ? 'boca' : z > -62 ? 'pasajeA' : z > -74 ? 'pasajeB' : 'puerta'; }
