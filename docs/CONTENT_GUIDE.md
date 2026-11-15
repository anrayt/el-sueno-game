# Как добавлять контент

Пошаговые инструкции с примерами из текущего кода. После любого изменения: `npm run build`, затем `npm test` (и `npm run test:mobile`).

## Главное правило: язык

**Весь внутриигровой текст — только на кастильском испанском (Испания).** Никакого русского и английского: ни в репликах, ни в документах, ни в подсказках интерфейса, ни в определениях словаря.

- Уровень главы I — A1. Короткие предложения, настоящее время, частотная лексика.
- Испанские нормы Испании: `vosotros` (если понадобится множественное число на «ты»), `coger`, `móvil`, `zumo` и т. п.; кавычки «ёлочки»; `¿…?` и `¡…!`.
- Определения в `LEX` — на испанском, простыми словами того же уровня, с примером из игры.
- Комментарии в коде — на испанском (как в существующем коде); документация в `docs/` — на русском.

## Добавить документ

`DOCS` в `src/data.js`. `text` — функция от флагов: текст может меняться по ходу игры.

```js
// src/data.js — как сделан существующий документ
calendario: { title: 'Calendario', cls: '', where: 'La Tienda',
  text: () => 'NOVIEMBRE\n\nHoy es 7.\nAyer también.\nMañana también.\n\n(Todos los días del mes tienen el mismo número.)' },

// документ, зависящий от флагов
grafiti: { title: 'Pintada en la pared', cls: 'wall', where: 'El Callejón',
  text: f => f.puertaAbierta ? 'ÉL YA NO MIRA.\nAHORA MIRAS TÚ.' : f.chaseDone ? (f.miraste ? 'MIRASTE.' : 'NO MIRASTE.\nBIEN.') : 'NO MIRES ATRÁS' },
```

- `cls` — оформление бумаги: `''` (бумага), `news` (газета, поддерживает `<h5>`), `wall` (надпись на стене), `med` (медицинский бланк), `metal` (металлическая табличка). Стили — `.paper.*` в `src/shell.html`.
- `\n` — перенос строки (`white-space: pre-line`).
- Открыть документ из сценария: `await g.doc('calendario');` — это добавит его в Cuaderno, выучит слова и поставит флаг `doc_calendario`.
- Финальный экран считает `Documentos n / N` по `Object.keys(DOCS).length` автоматически.

## Добавить слово в словарь

`LEX` в `src/data.js`: `[ключ, 'формы через пробел', определение, пример]`.

```js
['tirar', 'tirar tira tiras', 'Mover algo hacia ti con las manos.', 'Tira de la puerta.'],
```

- **Формы обязательны:** движок ищет в тексте именно эти словоформы (без учёта регистра). Если в тексте есть `tiramos`, а в формах его нет — слово не подсветится.
- Ключ — словарная форма; составные ключи (`al revés`) ищутся по одной форме (`revés`).
- Форма не должна встречаться у двух разных ключей — победит последний.
- Проверка: открыть документ/реплику в игре — слово должно быть подчёркнуто, по клику — определение; в Diccionario счётчик `n / N` вырастет.

## Добавить запись в архив

`ARCHIVE` в `src/data.js`. `tipo`: `h` — hecho (видишь сам), `t` — testimonio (говорят), `i` — hipótesis (думаешь).

```js
venda: { cat: 'Los que no duermen', title: 'El banco vacío', tipo: 'h',
  text: 'Anselmo ya no está. En el banco solo hay una venda.\n\nSi ya no lleva la venda, ahora mira. Y si mira...' },
```

- `cat` — категория (группа в списке). Порядок в интерфейсе = порядок ключей в объекте.
- Абзацы разделяются `\n\n`.
- Открыть из сценария: `g.arch('venda');` (повторный вызов безопасен).
- Тип выбирайте честно: если это слова персонажа — `t`, даже если они звучат как факт.

## Добавить Eco

1. Запись в `ECOS` (`src/data.js`):

   ```js
   eco3: { zone: 'tienda', need: f => f.tieneLlave, pre: 'La radio dice, con la voz de Anselmo:',
     frase: '«Todos duermen. Yo no ___.»', ops: ['bebo', 'miro', 'duermo'], ok: 2, full: 'Todos duermen. Yo no duermo.' },
   ```

   `need` — когда Eco появляется; `ok` — индекс правильного варианта в `ops` (варианты перемешиваются при показе); `full` — фраза целиком (озвучивается и попадает в раздел Ecos). Фраза должна быть **уже встречавшейся** в игре.

2. Точка в мире (`SceneManager.build`, `src/world.js`):

   ```js
   this.addInter('eco3', 21.2, -34.6, { verb: 'Escuchar', y: 1.3, eco: true, on: () => game.ecoOn('eco3') });
   ```

3. Добавить id в `hs` нужного кадра в `SCREENS` (`src/screens.js`).

Сценарий писать не нужно: `game.js` автоматически регистрирует `SCRIPTS[id]` для каждого ключа `ECOS`.

## Добавить активную точку

1. **Объект и точка в мире** — `SceneManager.build` (`src/world.js`), в секции нужной зоны:

   ```js
   // существующий пример: пачка батареек на полке
   d.pilas = this.B(0.16, 0.1, 0.1, this.matc(0xa07a28), 17.1, 1.32, -32.55);
   this.addInter('pilas', 17.1, -32.0, { verb: 'Coger', y: 1.3, hz: -32.6, hit: [0.6, 0.5, 0.5], on: () => !game.f.got_pilas });
   ```

   Параметры `addInter(id, x, z, opts)`: `verb` — подсказка при наведении (`Mirar`, `Leer`, `Coger`, `Abrir`, `Usar`, `Hablar`, `Escuchar`); `y` — высота; `hx`/`hz` — смещение hitbox относительно `x`/`z`; `hit` — размеры hitbox; `on` — когда точка доступна; `far: true` — герой не поворачивается к точке; `noGlint: true` — без блика; `gy` — высота кружка на экране, если отличается от hitbox.

2. **Если объект должен меняться от флагов** — добавить строку в `SceneManager.sync(f)`:

   ```js
   d.pilas.visible = !f.got_pilas;
   ```

   `sync` должна оставаться идемпотентной: только выставлять состояние по флагам, никаких «переключений».

3. **Сценарий** — `SCRIPTS` (`src/game.js`):

   ```js
   async pilas(g) { if (!g.give('pilas')) return; g.set('got_pilas'); await g.think('Pilas. Son para la linterna.'); },
   ```

   Всегда проверяйте результат `g.give(...)`: инвентарь ограничен 6 слотами.

4. **Кадр** — добавить id в `hs` нужного кадра (`src/screens.js`). Кружок появится там, где hitbox проецируется на экран этой камеры.

5. **Предмет** (если точка что-то даёт) — запись в `ITEMS` (`src/data.js`) с SVG-путём иконки в квадрате 20×20; если предмет можно использовать — ветка в `Game.useItem`; если комбинировать — `Inventory.combine`.

## Добавить новую сцену (кадр)

1. **Камера** — запись в `CAMS` (`src/world.js`):

   ```js
   { id: 'quiosco', test: () => false, pos: [-2.4, 1.75, -26.2], fov: 50, fixed: [-6.3, 1.15, -28.6] },
   ```

   `pos` — положение камеры; `fixed` — точка, куда она смотрит. Без `fixed` камера следит за героем на высоте `yoff` (по умолчанию 1.25). `test` — наследие режима с ходьбой; для новых камер ставьте `() => false`.

2. **Кадр** — запись в `SCREENS` (`src/screens.js`):

   ```js
   quiosco: { cam: 'quiosco', at: [-5.3, -29.6], ry: -0.6, hs: ['periodico'], exits: [{ label: 'Volver a la plaza', to: 'plaza1' }] },
   ```

   `at` — где стоит герой (x, z), `ry` — поворот. Зона (для звука, тумана, названия на экране) вычисляется из `at` функцией `zoneAt` в `world.js`.

3. **Выходы** — добавить переход в обе стороны: в новый кадр и в соседний. Условный выход — `if`, выход со сценарием — `act`:

   ```js
   { label: 'La tienda', to: 'tienda', if: f => f.tiendaAbierta },
   { label: 'Entrar en el pasaje', act: async g => { if (!g.f.luz) { await g.think('El pasaje está muy oscuro. No veo nada.', 'Necesito luz.'); return; } /* … */ await g.goTo('pasajeA'); } },
   ```

4. **Новая зона** (если это новое место, а не ракурс существующего): запись в `ZONES` (`src/data.js`), границы в `zoneAt`, параметры звука в `AudioManager.update` (`Z`) и `_event` (`pool`), плотность тумана в `SceneManager.update`, вступительная мысль в `Game.events`, геометрия в `SceneManager.build`.

5. Обновить граф сцен в [GAME_DESIGN.md](GAME_DESIGN.md) и e2e-тест.

## Добавить диалог с выбором

Минимальный пример — дверь магазина (`SCRIPTS.puertaTienda`):

```js
const i = await g.choose('¿Qué haces?', ['Empujar la puerta.', 'Tirar de la puerta.', 'Nada.']);
if (i === 0) { g.audio.rattle(); g.addCordura(-6); await g.think('La puerta no se abre. Hace mucho ruido.'); g.decide('Empujas una puerta que dice «tira».'); }
else if (i === 1) { g.audio.creak(0.2); g.set('tiendaAbierta'); await g.think('La puerta se abre.'); }
```

Диалог-меню с повторяющимися вопросами — `SCRIPTS.anselmo`: варианты собираются в массив `[текст, ключ]` в цикле `for (;;)`, заданный вопрос помечается флагом (`q_quien` и т. п.) и пропадает из списка, «Adiós.» выходит из цикла.

```js
const A = (...l) => g.say('Anselmo', ...l);
const o = [];
if (!f.q_quien) o.push(['¿Quién eres?', 'quien']);
o.push(['Adiós.', 'bye']);
const k = o[await g.choose('', o.map(x => x[0]))][1];
if (k === 'quien') { g.set('q_quien'); await A('Me llamo Anselmo. Soy el farolero.'); }
```

**Выбор с таймером** — третий аргумент, секунды. Истечение времени возвращает `-1`; обработайте его явно — бездействие тоже ответ:

```js
const k = await g.choose('', ['Girar la cabeza.', 'Correr hacia la luz.', 'Cerrar los ojos y caminar.'], 15);
if (k < 0) { await g.think('No hago nada. Y eso también es una respuesta.'); return caught(false); }
```

Рекомендации:

- варианты ответа — короткие фразы A1, по возможности с глаголом, который игрок уже видел;
- значимые выборы фиксируйте через `g.decide('…')` — журнал решений пригодится в следующих главах;
- последствия ошибок — через `addCordura`, `dread`, `camShake`, звук, а не через конец игры.

## Флаги и сохранения

- Новые флаги просто начинайте использовать через `g.set('nombreFlag')`; описывайте их в таблице флагов в [GAME_DESIGN.md](GAME_DESIGN.md).
- Флаги сохраняются как есть; новые id `ITEMS`/`DOCS`/`ARCHIVE`/`ECOS` старые сохранения не ломают.
- Если меняется структура `state` или смысл существующих флагов — поднимите `v` в `SaveManager.fresh/load` или смените `SAVE_KEY`.

## Чек-лист перед коммитом

- [ ] Весь новый игровой текст — на кастильском испанском, без русского/английского.
- [ ] Новые слова добавлены в `LEX` со всеми встречающимися формами.
- [ ] Точки добавлены в `hs` нужного кадра; выходы — в обе стороны.
- [ ] `SceneManager.sync` по-прежнему идемпотентна.
- [ ] `npm run build`, `npm test`, `npm run test:mobile` — зелёные.
- [ ] Обновлены `docs/GAME_DESIGN.md` (карта, флаги) и `CHANGELOG.md`.
