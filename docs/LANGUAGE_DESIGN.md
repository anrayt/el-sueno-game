# Языковой дизайн

Игра учит испанскому не упражнениями, а тем, что **без понимания фразы нельзя пройти дальше**. Весь внутриигровой текст — кастильский испанский (Испания), уровень A1. Русского и английского в игре нет: значения слов объясняются на простом испанском.

## Принципы

1. **Фраза — это ключ.** Препятствие формулируется на испанском, и решение лежит в самой фразе. Ошибка понимания имеет игровое последствие (шум, потеря рассудка, погоня), а не красный крестик.
2. **Повторение в новых ситуациях.** Одни и те же слова (`mirar`, `atrás`, `dormir`, `puerta`) встречаются на стене, в диалоге, в документе, в погоне и в Eco — каждый раз с новой ставкой.
3. **Определение, а не перевод.** Каждое слово из словаря (`LEX`) объясняется на испанском A1 и даётся с примером из игры.
4. **Понимание = страх.** Чем лучше игрок понимает тексты, тем яснее, что происходит, — и тем страшнее (см. [GAME_DESIGN.md](GAME_DESIGN.md)).

## Как испанский встроен в механики

### «NO MIRES ATRÁS» — погоня

- **Где:** граффити в переулке (`DOCS.grafiti`), совет Anselmo («En el pasaje, camina. No mires atrás. Nunca.»), надпись в пассаже «ÉL TE MIRA SI TÚ LO MIRAS».
- **Механика:** в погоне варианты — «Mirar atrás.», «Seguir adelante.», «Parar.», затем «Mirar.» / «No mirar. Seguir adelante.», затем «Girar la cabeza.» / «Correr hacia la luz.» / «Cerrar los ojos y caminar.» На каждый выбор — таймер 15–20 секунд.
- **Язык:** отрицательный императив (`no mires`), глагол `mirar` в разных формах, наречие `atrás`. Ловушка второго момента: голос говорит «Mira aquí» — тот же глагол, но в утвердительной форме, и это приказ врага.
- **Последствие ошибки:** −30 рассудка, возврат ко входу и подсказка: «En el callejón había unas palabras en la pared...»
- **Отголоски:** граффити меняется на «MIRASTE.» / «NO MIRASTE. BIEN.»; Eco у фонтана: «No mires ___.» → `atrás`.

### Дверь «TIRA» — магазин

- **Где:** `SCRIPTS.puertaTienda`, табличка на двери в 3D (`textTex(['TIRA'])`).
- **Механика:** выбор «Empujar la puerta.» / «Tirar de la puerta.» / «Nada.»
- **Язык:** пара `empujar` (от себя) / `tirar` (на себя). Обе в словаре: «Mover algo hacia delante con las manos.» / «Mover algo hacia ti con las manos.» Для англо- и русскоязычных игроков `tira` не похоже ни на «толкать», ни на «тянуть», поэтому нужно действительно прочитать слово.
- **Последствие ошибки:** «La puerta no se abre. Hace mucho ruido. Algo se mueve en la niebla.», −6, запись в решения «Empujas una puerta que dice «tira».»

### Напиток для Anselmo

- **Где:** `SCRIPTS.anselmo`, `SCRIPTS.maquina`.
- **Задание:** «Tengo sed. Mucha sed. Quiero un refresco de naranja. No quiero agua. Y el café no me gusta.»
- **Механика:** автомат в магазине с кнопками **AGUA / CAFÉ / NARANJA / LIMÓN**, одна монета = одна попытка. Монета — из телефона; если её потратить неправильно, Anselmo даст ещё («Toma. Es mi última moneda. Naranja. No agua. No café.»).
- **Язык:** `tener sed`, `querer` / `no querer`, `gustar` (`no me gusta`), названия напитков и цветов. Неправильный напиток Anselmo отвергает с объяснением: «Esto es agua. No quiero agua.» / «Esto es café. No me gusta el café.» / «Esto es limón. Yo quiero naranja.» — и по слогам: «Na-ran-ja.»
- **Награда:** ключ от ящика, где лежит молитва.

### «REZA AL REVÉS» — загадка с плитами

- **Где:** табличка у двери (`DOCS.placa`), молитва из ящика (`DOCS.oracion`), фрески в пассаже, пьедестал (`PuzzleSystem`).
- **Язык:**
  - связки порядка: `primero`, `después`, `luego`, `al final` — все в словаре;
  - лексика тела и ночи: `mano`, `luna`, `ojo`, `boca`; глаголы `apagar`, `subir`, `cerrarse`, `callar`;
  - выражение `al revés`: «En el orden contrario: del final al principio. Uno, dos, tres; al revés: tres, dos, uno.»
- **Механика:** нужно восстановить порядок символов по молитве и нажать его в обратном порядке: boca → ojo → luna → mano.
- **Подсказки:** вопрос Anselmo «¿Qué es «al revés»?» (появляется после чтения таблички); при вводе молитвы в прямом порядке — «Esa es la oración para entrar. Tú no quieres entrar.»; архив «Mano, luna, ojo, boca».

### Другие места, где язык — механика

| Место | Что нужно понять |
|---|---|
| Пассаж без света | «El pasaje está muy oscuro. No veo nada. Necesito luz.» → найти батарейки (`pilas`) и собрать фонарь |
| Ящик в магазине | «Un cajón. Está cerrado con llave.»; на ключе этикетка «TIENDA — CAJÓN» |
| Телефон | «¿Está despierto?» — три ответа (`Sí.` / `No.` / `¿Quién es?`); голос говорит на «usted» |
| Радио | «No es la salida. Es la entrada.» — ключ к смыслу финала; озвучивается через `speechSynthesis` |
| Eco | вставить пропущенное слово в уже встречавшуюся фразу |

## Уровень A1: что используется в главе I

- **Время:** настоящее время индикатива почти везде. Единичные формы претерито — `miraste`, `escribió`, `hice`, `miré` — встречаются в ключевых местах, но их понимание для прохождения не требуется.
- **Императив:** отрицательный (`no mires`, `no tengas miedo`, `no abra`, `no hable`) и утвердительный (`busca`, `toma`, `mira`, `escuche`, `vuelva`).
- **Tú / usted:** Anselmo говорит на «tú», голос-«врач» — на «usted» («Vuelva a dormir», «Usted me conoce»). Это и языковой, и сюжетный маркер дистанции.
- **Конструкции:** `hay`, `estar` + состояние (`está cerrada`, `está vacía`), `tener` + `sed` / `miedo` / `pilas`, `necesitar`, `querer`, `no me gusta`, `para` + инфинитив (`para entrar`, `para salir`).
- **Лексика:** город, дом, тело, свет и темнота, напитки, больница, порядок действий.

## Словарь (LEX)

76 статей в `src/shared/data.js`. Формат: `[ключ, 'формы через пробел', определение, пример]`. Формы — это словоформы, как они встречаются в текстах; по ним `LanguageSystem` находит слово в любой строке.

mirar, atrás, ciudad, vacío, dormir, sueño, soñar, despierto, luz, oscuro, puerta, llave, cerrado, cerrar, abrir, miedo, solo, buscar, hombre, sed, beber, moneda, máquina, refresco, naranja, limón, agua, tienda, cajón, empujar, tirar, entrar, salir, rezar, oración, al revés, primero, después, luego, al final, mano, luna, ojo, boca, apagar, encender, callar, subir, mentir, verdad, paciente, hospital, médico, enfermo, niebla, calle, plaza, pasaje, farolero, pilas, linterna, teléfono, noche, nadie, alguien, vecino, frío, viejo, venda, norte, habitación, sufrir, necesitar, querer, cama, pulsera.

Примеры статей:

| Ключ | Определение | Пример |
|---|---|---|
| mirar | Usar los ojos para ver algo. | No mires atrás. |
| tirar | Mover algo hacia ti con las manos. | Tira de la puerta. |
| al revés | En el orden contrario: del final al principio. Uno, dos, tres; al revés: tres, dos, uno. | Aquí todo es al revés. |
| sed | Ganas de beber. | Tengo sed. |
| pulsera | Objeto que llevas alrededor de la mano. En los hospitales tiene tu nombre. | En tu brazo hay una pulsera. |

Ограничение текущей реализации: поиск идёт по отдельным словам, поэтому составные ключи (`al revés`, `al final`) находятся по одной форме (`revés`, `final`).

## Системы: Diccionario, Cuaderno, Archivo, Ecos

Все пять разделов «книги» (`UIManager.renderBook`) открываются по Tab / J или кнопками HUD.

### Подсветка слов и Diccionario

- `LanguageSystem.markup(text)` оборачивает каждое слово из словаря в `<span class="w">`; ещё не изученные получают класс `new` (ярче подчёркнуты).
- `LanguageSystem.learn(text)` добавляет новые ключи в `state.words`. Вызывается для каждой реплики, документа, описания предмета, вариантов выбора, фрагмента архива и титров финала.
- При появлении новых слов — звук и тост «Palabra nueva: …» / «Palabras nuevas: N».
- Нажатие на подчёркнутое слово показывает подсказку: ключ, определение, пример.
- **Diccionario** — все изученные слова по алфавиту (`localeCompare(…, 'es')`), счётчик `n / 76`.

### Cuaderno

- **Documentos:** каждый прочитанный документ (`DOCS`) с местом находки. Текст документа может зависеть от флагов (газета и граффити меняются после событий) — в Cuaderno всегда показывается текущая версия.
- **Voces («Lo que dicen»):** журнал реплик персонажей и голосов (`state.log`, последние 60). Мысли героя туда не попадают.

### Archivo

- 12 фрагментов лора, сгруппированных по категориям (La ciudad, La Orden, El hospital, Los que no duermen, Las criaturas, Tú).
- У каждого — метка типа: **Hecho: lo que ves**, **Testimonio: lo que dicen**, **Hipótesis: lo que piensas**. Это одновременно сюжетный инструмент и языковой: игрок учится различать «вижу», «говорят», «думаю».

### Ecos

- Голоса в тумане повторяют уже встречавшиеся фразы с пропуском. Игрок выбирает слово из трёх (варианты перемешиваются).
- Верно: фраза озвучивается, +18 рассудка, тост «Eco recuperado», мысль «Entiendo la voz. Tengo menos miedo.» Неверно: −7, «No. No es esa palabra. La voz se va. Pero vuelve.» — можно попробовать снова.

| Eco | Где | Условие | Фраза | Варианты |
|---|---|---|---|---|
| eco1 | callejon2 | прочитана газета | La ciudad está ___. | **vacía**, cerrada, fría |
| eco2 | plaza1 (фонтан) | пережита погоня | No mires ___. | arriba, **atrás**, aquí |
| eco3 | tienda (радио) | получен ключ | Todos duermen. Yo no ___. | bebo, miro, **duermo** |
| eco4 | puerta | прочитана молитва | Primero, la mano apaga la ___. | luna, puerta, **luz** |

### Озвучка

`AudioManager.speak` использует `speechSynthesis` браузера с голосом `es-ES` (если он есть). Озвучиваются реплики голоса в телефоне, радио и верные Eco. Текст всегда остаётся на экране — озвучка необязательна и отключается в паузе («Voces habladas»).

## План прогрессии A2 → B1 (предложение для следующих глав)

> Это проектное предложение, а не описание реализованного: в главе I есть только A1.

| Глава | Уровень | Грамматика как механика | Идеи |
|---|---|---|---|
| II — El Hospital | A2 | **Pretérito indefinido vs. imperfecto:** восстановить, что произошло в 1987 году, по записям персонала («Los pacientes dormían. Un día, el doctor cerró la puerta.»). Порядок событий — загадка. **Perífrasis** `ir a` + инф. — планы врачей в документах. **Сравнения** (`más… que`). | Медкарты остальных пациентов; голос в телефоне становится персонажем; Anselmo как пациент № 3. Ecos — уже не слово, а форма глагола. |
| III | A2+ / B1 | **Subjuntivo** в желаниях и запретах: «No quiero que despiertes», «Es necesario que…» — те же запреты, что в главе I («no mires»), но в косвенной речи; понимание того, *кто кого* хочет остановить. **Pretérito perfecto** («Has mirado atrás»). | Документы Ордена; противоречивые свидетельства, где важна модальность. |
| IV | B1 | **Condicional и si-clauses:** «Si abres la puerta, despertarás» vs «Si abrieras…» — выбор концовки зависит от понимания условия. Косвенная речь, связки аргументации (`sin embargo`, `por eso`, `aunque`). | Три интерпретации из архива `ideas` становятся тремя путями. |

Сквозные правила для всех глав:

- словарь растёт по главам, слова главы I повторяются в новых контекстах;
- определения в `LEX` пишутся только с использованием лексики того же или более низкого уровня;
- каждая новая грамматическая тема получает хотя бы одну механику, где ошибка понимания имеет последствие;
- тип фрагмента архива (hecho / testimonio / hipótesis) остаётся главным инструментом «чтения между строк».
