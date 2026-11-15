# Лор главы I

Источник — только тексты из `src/shared/data.js` (`ITEMS`, `DOCS`, `ARCHIVE`, `ECOS`) `src/shared/scripts.js` (реплики в `SCRIPTS`) и `src/modes/*/game.js` (погоня, финал). Ничего сверх этого здесь нет. Цитаты приводятся на испанском, как в игре; перевод — в скобках.

Игра сама размечает свои фрагменты в разделе Archivo тремя типами (`tipo` в `ARCHIVE`):

- **Hecho** — «lo que ves» (что видишь сам),
- **Testimonio** — «lo que dicen» (что говорят другие),
- **Hipótesis** — «lo que piensas» (что думаешь ты).

Этот документ следует той же логике, но разделяет утверждения строже, чем игра (см. раздел «Факт, свидетельство, гипотеза»).

## Мир: пустой город

- У города нет названия: «La ciudad no tiene nombre.» (архив `ciudad`).
- Всегда 7 ноября. Газета: «7 de noviembre.»; календарь: «Hoy es 7. Ayer también. Mañana también.»; в календаре у всех дней одно и то же число.
- Всегда ночь, всегда три часа: радио — «son las tres de la mañana. Siempre son las tres de la mañana.»; Anselmo — «Aquí no hay días», «aquí siempre es de noche».
- Магазин закрыт «на пять минут» на табличке, которая давно пожелтела.
- Жители не мертвы — они спят и не просыпаются: «Los vecinos de la calle del Hospital no se despiertan.» Но «en las casas no hay camas. ¿Dónde duermen?» (архив `ciudad`).
- Погода: «niebla. Mañana: niebla.»
- Анонимная записка «— M.» встречает героя: «Si lees esto, estás dormido. No tengas miedo. La ciudad está vacía, pero no estás solo. Busca la luz. Busca al hombre que no duerme.» Кто такой M., в главе I не раскрывается.
- Радио (женский голос): «Si oyes esto, no estás en casa. Estás en el sueño. Hay una puerta al norte. No es la salida. Es la entrada...»

## Орден Закрытого Глаза (La Orden del Ojo Cerrado)

- Газета: «La Orden del Ojo Cerrado reza en la plaza todas las noches. Sus miembros dicen: «Quien duerme no sufre.»»
- Символ — закрытый глаз. Он есть на монете («En un lado hay un ojo cerrado. En el otro lado no hay nada.»), на северной двери («En el centro hay un ojo cerrado.») и в молитве.
- **Молитва** «Oración para entrar en el sueño» (в ящике магазина):
  > Primero, la mano apaga la luz. / Después, la luna sube. / Luego, el ojo se cierra. / Al final, la boca calla. / Quien duerme no sufre.
- Архив `orden` (testimonio): для Ордена «dormir es sagrado y despertar es un pecado. Su oración no es para Dios. Es para entrar en el sueño.»
- Мысль героя: «Una oración. Pero no es para Dios. Es para dormir.»
- Табличка у двери: «PARA ENTRAR, REZA. PARA SALIR, REZA AL REVÉS.»

## Проект Vigilia, 1987

- Фотография из ящика: «Hay siete personas delante de un hospital. Todas tienen los ojos cerrados. Detrás hay un hombre con una bata blanca. Él tiene los ojos abiertos. Detrás de la foto: «Proyecto Vigilia, 1987».»
- Архив `vigilia` (hecho): «1987. Siete pacientes y un médico delante del hospital Santa Vigilia… ¿Duermen de pie?» и замечание: «Vigilia» значит «estar despierto por la noche» — «un nombre extraño para un proyecto con gente dormida».
- Больница называется **Santa Vigilia** (газета, справка, архив `vigilia`).
- Медицинская справка: «PLANTA 3 — HABITACIÓN 7. Paciente n.º 7. Nombre: ————. Edad: ————. El paciente duerme desde 1987. No come. No bebe. No habla. A veces dice una palabra: «puerta». Dr. A. Ferrán».

## Доктор Ferrán

- Газета (до открытия двери): «El doctor Ferrán, del hospital Santa Vigilia, dice: «No están enfermos. Solo sueñan.»»
- Газета (после): «El doctor Ferrán dice: «No pasa nada. Vuelvan a dormir.»»
- Подписывает справку о пациенте № 7: «Dr. A. Ferrán».
- Архив `ferran` (hipótesis): «En la foto es el único con los ojos abiertos. ¿Cuida a los dormidos? ¿O no quiere que despierten?» Важно: игра не называет человека в халате на фото по имени — отождествление с Ferrán сделано в гипотезе героя.
- **Голос в телефоне** обращается к герою «Paciente siete», на «usted», говорит «Soy su médico. Usted me conoce.» (если спросить, кто это). Требует: «No abra la puerta del norte», «no hable con el hombre de la plaza. Él miente», «Vuelva a dormir». После открытия двери: «La puerta está abierta. Eso está mal. Vuelva a su habitación. Ahora.» На «Sí, doctor» — «Bien. Habitación siete. Le esperamos.»; на «No» — «Entonces, entre. Le esperamos también.» По второму звонку открывается архив `ferran`, но имя Ferrán голос сам не называет.
- Архив `voz` (testimonio): «Habla como un médico… No quiere que abra la puerta. Dice que el hombre de la plaza miente. ¿La voz me protege o me encierra?»

## Anselmo, el farolero

- Сидит на своей скамейке на площади («Anselmo está en su banco»), носит повязку на глазах (`venda`).
- О себе: «Me llamo Anselmo. Soy el farolero. Enciendo las luces de la ciudad. Todas las noches. Pero aquí siempre es de noche.» «La ciudad está vacía. Todos duermen. Yo no. Yo no duermo.» — то есть он и есть «el hombre que no duerme» из записки.
- Хочет пить и точно знает что: «Quiero un refresco de naranja. No quiero agua. Y el café no me gusta.» Сам купить не может: «yo no veo».
- За апельсиновую газировку отдаёт ключ от ящика: «En el cajón hay palabras. Son las palabras de la puerta.»
- Про выход: «Hay una puerta al norte, después del pasaje… Necesitas luz. Y necesitas las palabras.»
- Про повязку: «Porque él mira. Si yo no lo miro, él no me ve. En el pasaje, camina. No mires atrás. Nunca.»
- Про телефон: «El teléfono miente. No es una persona. Es el hospital. El hospital quiere una cosa: que duermas.»
- Про «al revés»: «Aquí todo es al revés. Tú duermes; por eso estás despierto aquí.»
- Про фотографию: «¿Hay siete personas? ¿Y un médico? Entonces yo estoy en la foto. Soy el número tres.»
- После открытия двери Anselmo исчезает; на скамейке лежит только повязка. Архив `venda`: «Si ya no lleva la venda, ahora mira. Y si mira...» Граффити меняется на «ÉL YA NO MIRA. AHORA MIRAS TÚ.», газета: «El farolero no está en la plaza.»
- В Eco магазина радио говорит голосом Anselmo: «Todos duermen. Yo no duermo.»

## El Que Mira

- «No tiene cara: solo un ojo abierto. Es alto y muy delgado.» (архив `mira`). Силуэт мелькает в тумане у входа в пассаж: «Hay alguien allí, en la niebla. Es muy alto. No se mueve… Ya no está.»
- Граффити в переулке: «NO MIRES ATRÁS». Надпись в пассаже: «ÉL TE MIRA / SI TÚ LO MIRAS».
- В погоне он идёт следом, подражает голосу Anselmo («Espera. Soy yo, Anselmo. Mira aquí.») и смеётся, если откликнуться: «La voz ríe. No es Anselmo.» Касается шеи и спины. Если оглянуться — ловит.
- Архив `mira` (hipótesis): «Vive detrás. No tiene cara: solo un ojo abierto. Es alto y muy delgado. La pared dice: «Él te mira si tú lo miras». Anselmo dice lo mismo. Si nadie lo mira, quizá no existe. Quizá lo hacemos nosotros, cuando miramos atrás.»
- После побега, если оглядывался: «Antes lo miré. Y él me miró.»; если нет: «No miré atrás. No sé qué era.»

## Пациент 7 (герой)

- Не помнит имени: «No recuerdas tu nombre.»
- Телефон зовёт его «Paciente siete».
- Справка: пациент № 7 спит с 1987 года и иногда говорит одно слово — «puerta». Архив `tu` (hecho): «Yo no recuerdo mi nombre. Y busco una puerta.»
- Газета после открытия двери: «El paciente siete abre la puerta… Nadie sabe su nombre. Los vecinos de la ciudad se mueven en sus camas. Algunos hablan. Uno llora.»
- Дверь в переулке после открытия северной двери: «Dentro no hay una casa. Hay una habitación blanca y una cama de hospital. La cama está vacía y todavía está caliente. Creo que es mi cama.» (архив `cama`)
- Финал: за дверью больница, на руке появляется браслет («En tu brazo hay una pulsera. Antes no estaba.»), титр «PACIENTE 7» и голос: «Bienvenido a casa.»

## Три интерпретации

Архив `ideas` («Tres ideas», hipótesis), открывается в финале:

1. «Estoy en una cama del hospital, y la ciudad es mi sueño.» — город — сон пациента № 7.
2. «La ciudad es el sueño de todos los pacientes juntos, y por eso está «vacía»: todos estamos aquí, pero no nos vemos.» — общий сон семи пациентов.
3. «No hay hospital. El hospital también es parte del sueño, y la radio tiene razón: la puerta no es la salida. Es la entrada.» — больница — ещё один слой сна.

Игра не выбирает между ними.

## Факт, свидетельство, гипотеза

Разметка игры (`tipo` в `ARCHIVE`):

| Фрагмент | Тип в игре | Источник |
|---|---|---|
| La ciudad vacía | hecho | газета |
| La puerta del callejón | hecho | дверь переулка после финала двери |
| Proyecto Vigilia | hecho | фотография |
| El banco vacío | hecho | повязка на скамейке |
| El paciente siete | hecho | справка |
| La Orden del Ojo Cerrado | testimonio | молитва |
| La voz del teléfono | testimonio | первый звонок |
| Anselmo, el farolero | testimonio | знакомство |
| Mano, luna, ojo, boca | hipótesis | фрески |
| El doctor Ferrán | hipótesis | газета / справка / второй звонок |
| El Que Mira | hipótesis | погоня, надпись |
| Tres ideas | hipótesis | финал |

Строгая разбивка утверждений (в рамках игрового мира):

**Факты — герой видит сам или это написано в документах:**
- Город без названия, туман, на всех днях календаря — 7.
- Жители не просыпаются (газета), в домах нет кроватей (наблюдение героя в архиве `ciudad`).
- Фото 1987 года: семь человек с закрытыми глазами перед больницей, человек в белом халате с открытыми глазами, подпись «Proyecto Vigilia, 1987».
- Справка: пациент № 7 спит с 1987 года, говорит «puerta»; подпись «Dr. A. Ferrán».
- Молитва и табличка у двери; дверь открывается молитвой наоборот.
- После открытия двери Anselmo исчезает, остаётся повязка; за дверью переулка — больничная палата с тёплой пустой кроватью; за северной дверью — больница Santa Vigilia.
- В финале на руке героя браслет, титр «PACIENTE 7».

**Свидетельства — так говорят другие, и они могут лгать:**
- Голос в телефоне: он «врач» героя; Anselmo лжёт; не открывать дверь; вернуться в палату.
- Anselmo: он не спит; телефон лжёт и это «больница»; он — пациент номер три на фото; если не смотреть на «него», он не видит.
- Орден (через газету и молитву): «Quien duerme no sufre»; молитва — чтобы войти в сон.
- Доктор Ferrán (через газету): «No están enfermos. Solo sueñan.» / «Vuelvan a dormir.»
- Радио: дверь на севере — не выход, а вход.
- Записка «M.»: ты спишь, ты не один.

**Гипотезы — выводы героя, игра их не подтверждает:**
- Человек в халате на фото — Ferrán; он, возможно, не хочет, чтобы спящие проснулись.
- Четыре символа — четыре стадии засыпания; чтобы увидеть их «наоборот», нужно оглянуться.
- El Que Mira, может быть, не существует, пока на него не смотрят.
- Пустая кровать за дверью переулка — кровать героя.
- Три интерпретации из архива `ideas`.

## Чего в главе I нет

Ниже — открытые вопросы, на которые тексты главы I **не отвечают**; это не лор, а список пробелов для следующих глав: кто такой «M.»; как зовут героя; что именно делал Проект Vigilia; кто остальные пять пациентов на фото; кто говорит женским голосом по радио; кто сказал «Bienvenido a casa».
