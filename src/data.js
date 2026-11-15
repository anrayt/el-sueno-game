'use strict';
/* =====================================================================
   EL SUEÑO — Capítulo I: La Ciudad Vacía
   DATOS DEL JUEGO: todo el contenido (objetos, documentos, léxico,
   archivo, ecos) vive aquí como datos; la lógica está en los sistemas.
   ===================================================================== */
const SAVE_KEY = 'el_sueno_cap1_v1';
const SET_KEY = 'el_sueno_ajustes_v1';
const MAX_SLOTS = 6;

const ZONES = {
  callejon: { name: 'El Callejón', n: 'I' },
  plaza:    { name: 'La Plaza', n: 'II' },
  tienda:   { name: 'La Tienda', n: 'III' },
  pasaje:   { name: 'El Pasaje', n: 'IV' },
  puerta:   { name: 'La Puerta', n: 'V' },
};

/* ---------- Objetos del inventario ---------- */
const ITEMS = {
  linterna:    { name: 'Linterna', icon: 'M3 8h7l4-3h4v10h-4l-4-3H3zM10 8v4', desc: 'Una linterna vieja. No funciona: no tiene pilas.' },
  pilas:       { name: 'Pilas', icon: 'M4 6h5v10H4zM11 6h5v10h-5zM6 4h1v2H6zM13 4h1v2h-1z', desc: 'Dos pilas pequeñas. Son nuevas. Están en una caja con polvo.' },
  linterna_ok: { name: 'Linterna con pilas', icon: 'M2 8h6l4-3h3v10h-3l-4-3H2zM17 7l2-1M17 10h2.5M17 13l2 1', desc: 'La linterna funciona. Da una luz amarilla y débil, pero es luz.' },
  moneda:      { name: 'Moneda', icon: 'M10 3a7 7 0 100 14 7 7 0 000-14zM6 10q4-3 8 0', desc: 'Una moneda vieja. En un lado hay un ojo cerrado. En el otro lado no hay nada.' },
  naranja:     { name: 'Refresco de naranja', icon: 'M6 4h8l1 2v10l-1 1H6l-1-1V6zM5 8h10M8 11a2 2 0 104 0 2 2 0 00-4 0', desc: 'Una lata de refresco de naranja. Está muy fría.', drink: true },
  limon:       { name: 'Refresco de limón', icon: 'M6 4h8l1 2v10l-1 1H6l-1-1V6zM5 8h10M8 12h4', desc: 'Una lata de refresco de limón. Es amarilla y está fría.', drink: true },
  agua:        { name: 'Botella de agua', icon: 'M8 2h4v3l2 3v9H6V8l2-3zM6 11h8', desc: 'Una botella de agua pequeña. El agua está fría.', drink: true },
  cafe:        { name: 'Café', icon: 'M5 7h9v7a3 3 0 01-3 3H8a3 3 0 01-3-3zM14 9h2v4h-2M7 2v3M10 2v3', desc: 'Un café de máquina. Está caliente y huele mal.', drink: true },
  llave:       { name: 'Llave pequeña', icon: 'M7 6a3.5 3.5 0 100 7 3.5 3.5 0 000-7zM10.5 9.5H18M15 9.5v3M17.5 9.5v2', desc: 'Una llave pequeña de metal. Tiene una etiqueta: «TIENDA — CAJÓN».' },
  foto:        { name: 'Fotografía', icon: 'M3 4h14v12H3zM3 13l4-4 3 3 3-2 4 3M13 7.5a1 1 0 102 0 1 1 0 00-2 0', desc: 'Una foto vieja en blanco y negro. Hay siete personas delante de un hospital. Todas tienen los ojos cerrados. Detrás hay un hombre con una bata blanca. Él tiene los ojos abiertos. Detrás de la foto hay unas palabras: «Proyecto Vigilia, 1987».' },
};

/* ---------- Documentos (van al Cuaderno) ---------- */
const DOCS = {
  nota: { title: 'Nota mojada', cls: '', where: 'El Callejón',
    text: () => 'Si lees esto, estás dormido.\n\nNo tengas miedo. La ciudad está vacía, pero no estás solo.\n\nBusca la luz.\nBusca al hombre que no duerme.\n\n— M.' },
  grafiti: { title: 'Pintada en la pared', cls: 'wall', where: 'El Callejón',
    text: f => f.puertaAbierta ? 'ÉL YA NO MIRA.\nAHORA MIRAS TÚ.' : f.chaseDone ? (f.miraste ? 'MIRASTE.' : 'NO MIRASTE.\nBIEN.') : 'NO MIRES ATRÁS' },
  periodico: { title: 'El Diario de la Ciudad', cls: 'news', where: 'La Plaza',
    text: f => f.puertaAbierta
      ? '<h5>El paciente siete abre la puerta</h5>7 de noviembre.\n\nEsta noche alguien abre la puerta del norte. Nadie sabe su nombre.\n\nLos vecinos de la ciudad se mueven en sus camas. Algunos hablan. Uno llora.\n\nEl doctor Ferrán dice: «No pasa nada. Vuelvan a dormir.»\n\nEl farolero no está en la plaza.'
      : '<h5>Toda la ciudad duerme</h5>7 de noviembre.\n\nLos vecinos de la calle del Hospital no se despiertan. Los médicos no saben por qué.\n\nEl doctor Ferrán, del hospital Santa Vigilia, dice: «No están enfermos. Solo sueñan.»\n\nLa Orden del Ojo Cerrado reza en la plaza todas las noches. Sus miembros dicen: «Quien duerme no sufre.»\n\nEl tiempo: niebla. Mañana: niebla.' },
  cartel: { title: 'Cartel de la tienda', cls: '', where: 'La Plaza',
    text: () => 'CERRADO\n\nVuelvo en cinco minutos.\n\n\n(El papel es muy viejo. Está amarillo.)' },
  calendario: { title: 'Calendario', cls: '', where: 'La Tienda',
    text: () => 'NOVIEMBRE\n\nHoy es 7.\nAyer también.\nMañana también.\n\n(Todos los días del mes tienen el mismo número.)' },
  oracion: { title: 'Oración del Ojo Cerrado', cls: '', where: 'La Tienda',
    text: () => 'ORACIÓN PARA ENTRAR EN EL SUEÑO\n\nPrimero, la mano apaga la luz.\nDespués, la luna sube.\nLuego, el ojo se cierra.\nAl final, la boca calla.\n\nQuien duerme no sufre.' },
  pared: { title: 'Palabras en el pasaje', cls: 'wall', where: 'El Pasaje',
    text: () => 'ÉL TE MIRA\nSI TÚ LO MIRAS' },
  informe: { title: 'Informe médico', cls: 'med', where: 'El Pasaje',
    text: () => 'HOSPITAL SANTA VIGILIA\nPLANTA 3 — HABITACIÓN 7\n\nPaciente n.º 7\nNombre: ————\nEdad: ————\n\nEl paciente duerme desde 1987.\nNo come. No bebe. No habla.\n\nA veces dice una palabra:\n«puerta».\n\nDr. A. Ferrán' },
  placa: { title: 'Placa de la puerta', cls: 'metal', where: 'La Puerta',
    text: () => 'PARA ENTRAR, REZA.\n\nPARA SALIR,\nREZA AL REVÉS.' },
  radio: { title: 'Voz de la radio', cls: '', where: 'La Tienda',
    text: () => '(Una voz de mujer, entre el ruido.)\n\n«...son las tres de la mañana. Siempre son las tres de la mañana.\n\nSi oyes esto, no estás en casa. Estás en el sueño.\n\nHay una puerta al norte. No es la salida. Es la entrada...»' },
};

/* ---------- Léxico: definiciones en español sencillo ---------- */
// f: formas que aparecen en los textos; d: definición; e: ejemplo
const LEX = [
  ['mirar', 'mirar miras mira mires miro miraste mirando miran', 'Usar los ojos para ver algo.', 'No mires atrás.'],
  ['atrás', 'atrás', 'El lugar que está detrás de ti.', 'No mires atrás.'],
  ['ciudad', 'ciudad', 'Lugar grande con muchas calles, casas y personas.', 'La ciudad está vacía.'],
  ['vacío', 'vacío vacía vacías vacíos', 'Sin personas o sin cosas dentro.', 'La calle está vacía.'],
  ['dormir', 'dormir duermo duermes duerme duermen dormido dormida', 'Cerrar los ojos y descansar, normalmente por la noche.', 'Todos duermen. Yo no duermo.'],
  ['sueño', 'sueño sueños', '1. Lo que ves cuando duermes. 2. Ganas de dormir.', '¿Tienes sueño?'],
  ['soñar', 'soñar sueñan sueñas sueña', 'Ver cosas mientras duermes.', 'No están enfermos. Solo sueñan.'],
  ['despierto', 'despierto despierta despiertan despertar', 'Con los ojos abiertos; no dormido.', '¿Está despierto?'],
  ['luz', 'luz luces', 'Lo que da el sol o una lámpara. Con luz puedes ver.', 'Busca la luz.'],
  ['oscuro', 'oscuro oscura', 'Sin luz.', 'El pasaje está oscuro.'],
  ['puerta', 'puerta puertas', 'Por aquí entras o sales de un lugar.', 'La puerta está cerrada.'],
  ['llave', 'llave llaves', 'Objeto pequeño de metal. Abre y cierra puertas.', 'Toma esta llave.'],
  ['cerrado', 'cerrado cerrada cerrados cerradas', 'No está abierto. No puedes entrar.', 'La tienda está cerrada.'],
  ['cerrar', 'cerrar cierra cierras cierro', 'Lo contrario de abrir.', 'El ojo se cierra.'],
  ['abrir', 'abrir abre abres abro abra abierto abierta abiertos', 'Lo contrario de cerrar.', 'La llave abre el cajón.'],
  ['miedo', 'miedo', 'Lo que sientes cuando hay peligro.', 'No tengas miedo.'],
  ['solo', 'solo sola', '1. Sin otras personas. 2. Únicamente.', 'No estás solo.'],
  ['buscar', 'buscar busca busco buscas', 'Intentar encontrar algo o a alguien.', 'Busca al hombre que no duerme.'],
  ['hombre', 'hombre', 'Persona adulta, señor.', 'El hombre de la plaza.'],
  ['sed', 'sed', 'Ganas de beber.', 'Tengo sed.'],
  ['beber', 'beber bebe bebes bebo', 'Tomar agua u otro líquido.', '¿Tienes algo de beber?'],
  ['moneda', 'moneda monedas', 'Dinero pequeño, redondo y de metal.', 'Necesito una moneda.'],
  ['máquina', 'máquina', 'Aparato que hace un trabajo. Aquí: vende bebidas.', 'La máquina funciona.'],
  ['refresco', 'refresco refrescos', 'Bebida fría y dulce, con gas.', 'Un refresco de naranja.'],
  ['naranja', 'naranja', 'Fruta redonda. También es un color.', 'Quiero un refresco de naranja.'],
  ['limón', 'limón', 'Fruta amarilla y ácida.', 'Un refresco de limón.'],
  ['agua', 'agua', 'Líquido sin color. Lo bebes cuando tienes sed.', 'No quiero agua.'],
  ['tienda', 'tienda', 'Lugar donde compras cosas.', 'La llave es de la tienda.'],
  ['cajón', 'cajón', 'Caja dentro de una mesa. Lo abres hacia ti.', 'La llave abre el cajón.'],
  ['empujar', 'empujar empuja empujas', 'Mover algo hacia delante con las manos.', 'Empuja la puerta.'],
  ['tirar', 'tirar tira tiras', 'Mover algo hacia ti con las manos.', 'Tira de la puerta.'],
  ['entrar', 'entrar entra entras entro entrada', 'Ir dentro de un lugar.', 'Para entrar, reza.'],
  ['salir', 'salir sale sales salgo salida', 'Ir fuera de un lugar.', '¿Cómo salgo de aquí?'],
  ['rezar', 'rezar reza rezan rezo', 'Hablar con Dios.', 'La Orden reza en la plaza.'],
  ['oración', 'oración', 'Las palabras que dices cuando rezas.', 'La oración tiene cuatro partes.'],
  ['al revés', 'revés', 'En el orden contrario: del final al principio. Uno, dos, tres; al revés: tres, dos, uno.', 'Aquí todo es al revés.'],
  ['primero', 'primero', 'Antes de todo; en el lugar número uno.', 'Primero, la mano apaga la luz.'],
  ['después', 'después', 'Más tarde; no ahora.', 'Después, la luna sube.'],
  ['luego', 'luego', 'Después.', 'Luego, el ojo se cierra.'],
  ['al final', 'final', 'En el último lugar; cuando todo termina.', 'Al final, la boca calla.'],
  ['mano', 'mano manos', 'Parte del cuerpo. Tiene cinco dedos.', 'La mano apaga la luz.'],
  ['luna', 'luna', 'La luz redonda y blanca del cielo, por la noche.', 'La luna sube.'],
  ['ojo', 'ojo ojos', 'Parte de la cara. Con los ojos ves.', 'Un ojo cerrado.'],
  ['boca', 'boca', 'Parte de la cara. Con la boca hablas y comes.', 'La boca calla.'],
  ['apagar', 'apagar apaga apagas', 'Quitar la luz. Lo contrario de encender.', 'La mano apaga la luz.'],
  ['encender', 'encender enciendo enciende', 'Dar luz o fuego. Lo contrario de apagar.', 'Enciendo las luces.'],
  ['callar', 'callar calla callas', 'No hablar.', 'La boca calla.'],
  ['subir', 'subir sube subes', 'Ir hacia arriba.', 'La luna sube.'],
  ['mentir', 'mentir miente mientes mienten', 'Decir cosas que no son verdad.', 'El teléfono miente.'],
  ['verdad', 'verdad', 'Lo que es real; lo contrario de la mentira.', '¿Es verdad?'],
  ['paciente', 'paciente pacientes', 'Persona enferma que está en un hospital.', 'El paciente siete.'],
  ['hospital', 'hospital', 'Edificio donde los médicos cuidan a los enfermos.', 'El hospital Santa Vigilia.'],
  ['médico', 'médico médicos doctor', 'Persona que cura a los enfermos.', 'Los médicos no saben por qué.'],
  ['enfermo', 'enfermo enfermos enferma', 'Persona que no está bien de salud.', 'No están enfermos.'],
  ['niebla', 'niebla', 'Nube que baja a la calle. Con niebla no ves bien.', 'Mañana: niebla.'],
  ['calle', 'calle calles', 'Camino entre las casas de una ciudad.', 'La calle del Hospital.'],
  ['plaza', 'plaza', 'Lugar abierto de la ciudad, entre calles.', 'La Orden reza en la plaza.'],
  ['pasaje', 'pasaje', 'Calle pequeña y estrecha, a veces con techo.', 'El pasaje está oscuro.'],
  ['farolero', 'farolero', 'Persona que enciende las luces de la calle.', 'Soy el farolero.'],
  ['pilas', 'pilas', 'Objetos pequeños que dan electricidad a un aparato.', 'La linterna no tiene pilas.'],
  ['linterna', 'linterna', 'Lámpara pequeña que llevas en la mano.', 'La linterna funciona.'],
  ['teléfono', 'teléfono', 'Aparato para hablar con una persona que está lejos.', 'El teléfono suena.'],
  ['noche', 'noche noches', 'La parte oscura del día.', 'Buenas noches.'],
  ['nadie', 'nadie', 'Ninguna persona.', 'Aquí no hay nadie.'],
  ['alguien', 'alguien', 'Una persona, pero no sabes quién.', 'Hay alguien ahí.'],
  ['vecino', 'vecino vecinos', 'Persona que vive cerca de ti.', 'Los vecinos no se despiertan.'],
  ['frío', 'frío fría', 'Con poca temperatura. Lo contrario de caliente.', 'La lata está fría.'],
  ['viejo', 'viejo vieja viejos', 'Con muchos años. Lo contrario de nuevo.', 'Una foto vieja.'],
  ['venda', 'venda', 'Tela larga que pones sobre una herida o sobre los ojos.', 'Lleva una venda en los ojos.'],
  ['norte', 'norte', 'Una dirección: arriba en los mapas.', 'Hay una puerta al norte.'],
  ['habitación', 'habitación', 'Cuarto de una casa o de un hospital. Normalmente tiene una cama.', 'Vuelva a su habitación.'],
  ['sufrir', 'sufrir sufre sufren', 'Sentir dolor.', 'Quien duerme no sufre.'],
  ['necesitar', 'necesitar necesito necesitas necesita', 'Tener que usar o tener algo.', 'Necesito luz.'],
  ['querer', 'querer quiero quieres quiere', 'Desear algo.', 'No quiero agua.'],
  ['cama', 'cama camas', 'Mueble para dormir.', 'Una cama de hospital.'],
  ['pulsera', 'pulsera', 'Objeto que llevas alrededor de la mano. En los hospitales tiene tu nombre.', 'En tu brazo hay una pulsera.'],
].map(a => ({ k: a[0], forms: a[1].split(' '), d: a[2], e: a[3] }));

/* ---------- Archivo: lore profundo. tipo: h = hecho, t = testimonio, i = hipótesis ---------- */
const ARCHIVE = {
  ciudad:   { cat: 'La ciudad', title: 'La ciudad vacía', tipo: 'h', text: 'La ciudad no tiene nombre. En el periódico siempre es 7 de noviembre. En el calendario también.\n\nLas tiendas están cerradas «cinco minutos». Los vecinos no están muertos: duermen. Pero en las casas no hay camas. ¿Dónde duermen?' },
  cama:     { cat: 'La ciudad', title: 'La puerta del callejón', tipo: 'h', text: 'La puerta oxidada del callejón ahora está abierta. Dentro no hay una casa. Hay una habitación blanca y una cama de hospital. La cama está vacía y todavía está caliente.\n\nCreo que es mi cama.' },
  orden:    { cat: 'La Orden', title: 'La Orden del Ojo Cerrado', tipo: 't', text: 'Un ojo cerrado: está en la moneda, en la puerta y en la oración.\n\nLa Orden dice: «Quien duerme no sufre». Para ellos, dormir es sagrado y despertar es un pecado. Su oración no es para Dios. Es para entrar en el sueño.' },
  simbolos: { cat: 'La Orden', title: 'Mano, luna, ojo, boca', tipo: 'i', text: 'Cuatro dibujos en el pasaje. Son las cuatro partes de dormir: apagas la luz, llega la noche, cierras los ojos, callas.\n\nCuando entras al pasaje, los ves en ese orden. Cuando sales, los ves al revés. Pero para verlos al revés, tienes que mirar atrás.' },
  vigilia:  { cat: 'El hospital', title: 'Proyecto Vigilia', tipo: 'h', text: '1987. Siete pacientes y un médico delante del hospital Santa Vigilia. Los siete tienen los ojos cerrados. ¿Duermen de pie?\n\n«Vigilia» significa «estar despierto por la noche». Es un nombre extraño para un proyecto con gente dormida.' },
  ferran:   { cat: 'El hospital', title: 'El doctor Ferrán', tipo: 'i', text: 'Su nombre está en el periódico y en el informe. Dice que los vecinos «solo sueñan».\n\nEn la foto es el único con los ojos abiertos. ¿Cuida a los dormidos? ¿O no quiere que despierten?' },
  voz:      { cat: 'El hospital', title: 'La voz del teléfono', tipo: 't', text: 'Me llama «paciente siete». Habla como un médico: me dice «usted». No quiere que abra la puerta. Dice que el hombre de la plaza miente.\n\n¿La voz me protege o me encierra?' },
  anselmo:  { cat: 'Los que no duermen', title: 'Anselmo, el farolero', tipo: 't', text: 'Dice que no duerme. Lleva una venda en los ojos. Enciende las luces de una ciudad donde nadie las ve.\n\nSi no duerme y no mira, ¿qué hace toda la noche? Él dice que el teléfono miente. El teléfono dice que él miente.' },
  venda:    { cat: 'Los que no duermen', title: 'El banco vacío', tipo: 'h', text: 'Anselmo ya no está. En el banco solo hay una venda.\n\nSi ya no lleva la venda, ahora mira. Y si mira...' },
  mira:     { cat: 'Las criaturas', title: 'El Que Mira', tipo: 'i', text: 'Vive detrás. No tiene cara: solo un ojo abierto. Es alto y muy delgado.\n\nLa pared dice: «Él te mira si tú lo miras». Anselmo dice lo mismo. Si nadie lo mira, quizá no existe. Quizá lo hacemos nosotros, cuando miramos atrás.' },
  tu:       { cat: 'Tú', title: 'El paciente siete', tipo: 'h', text: 'El informe dice: el paciente siete duerme desde 1987. No habla. A veces dice una palabra: «puerta».\n\nYo no recuerdo mi nombre. Y busco una puerta.' },
  ideas:    { cat: 'Tú', title: 'Tres ideas', tipo: 'i', text: 'Uno: estoy en una cama del hospital, y la ciudad es mi sueño.\n\nDos: la ciudad es el sueño de todos los pacientes juntos, y por eso está «vacía»: todos estamos aquí, pero no nos vemos.\n\nTres: no hay hospital. El hospital también es parte del sueño, y la radio tiene razón: la puerta no es la salida. Es la entrada.' },
};

/* ---------- Ecos: repetición de palabras ya vistas, en situaciones nuevas ---------- */
const ECOS = {
  eco1: { zone: 'callejon', need: f => f.doc_periodico, pre: 'Una voz en la niebla, muy lejos:', frase: '«La ciudad está ___.»', ops: ['vacía', 'cerrada', 'fría'], ok: 0, full: 'La ciudad está vacía.' },
  eco2: { zone: 'plaza', need: f => f.chaseDone, pre: 'Algo habla debajo del agua de la fuente:', frase: '«No mires ___.»', ops: ['arriba', 'atrás', 'aquí'], ok: 1, full: 'No mires atrás.' },
  eco3: { zone: 'tienda', need: f => f.tieneLlave, pre: 'La radio dice, con la voz de Anselmo:', frase: '«Todos duermen. Yo no ___.»', ops: ['bebo', 'miro', 'duermo'], ok: 2, full: 'Todos duermen. Yo no duermo.' },
  eco4: { zone: 'puerta', need: f => f.doc_oracion, pre: 'Muchas voces rezan detrás de la puerta:', frase: '«Primero, la mano apaga la ___.»', ops: ['luna', 'puerta', 'luz'], ok: 2, full: 'Primero, la mano apaga la luz.' },
};

/* ---------- Símbolos del enigma ---------- */
const SYMBOLS = {
  mano: 'M12 44V20M12 26V12M20 24V8M28 24V10M36 26V14M36 30l8-6M12 44h20l12-20',
  luna: 'M34 8a20 20 0 100 40A16 16 0 0134 8z',
  ojo:  'M4 28Q28 6 52 28Q28 50 4 28ZM28 20a8 8 0 100 16 8 8 0 000-16z',
  boca: 'M6 28Q28 14 50 28Q28 46 6 28ZM6 28h44',
};
const PLATE_ORDER = ['luna', 'boca', 'mano', 'ojo'];       // disposición en el pedestal
const PRAYER = ['mano', 'luna', 'ojo', 'boca'];            // oración «para entrar»
const SOLUTION = ['boca', 'ojo', 'luna', 'mano'];          // «para salir»: al revés
