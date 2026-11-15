import { ITEMS, DOCS, ECOS } from './data.js';
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
