# Журнал изменений

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

## [Не выпущено]

### Добавлено
- **Гибрид — основная версия, одна сборка** (`dist/el-sueno.html`). Улицы (callejón, plaza, pasaje, подход к puerta) — свободная ходьба; tienda, quiosco, cabina, banco Anselmo и pedestal — статичные кадры с активными точками. У сцен в `src/shared/scenes.js` есть `mode: 'walk' | 'frame'`; единый `Game` (`src/shared/game.js`) переключает ввод, камеру, HUD и точки.
  - Вход в кадр: `E`, клик или тап по объекту (сценарий объекта запускается уже в кадре — разговор с Anselmo стал постановочным кадром) либо дверь tienda; затемнение со звуком шагов. «→ Salir» возвращает на улицу в точку входа. Кадр pedestal закрывается сам, когда дверь открыта.
  - Ходьба к точке: клик или тап по земле ведёт героя к точке с простым обходом препятствий, клик/тап по дальнему объекту — к объекту с действием по прибытии. Джойстик на тач-устройствах — опция в паузе («Joystick: sí/no»), по умолчанию выключен.
  - Надписи на улице (pintada, palabras del pasaje, placa) при первом приближении сами открываются крупным документом.
  - Погоня в pasaje в обычном режиме — в реальном времени («no mires atrás»).
  - «Modo: normal / lectura» — настройка на титуле и в паузе. «Modo lectura»: все сцены — кадры, без ходьбы, погоня через выборы на время (бывшая квест-версия). Режим можно менять посреди партии.
  - Сохранение: одна партия, формат `v: 2` (`scr`, `pos`, `ret`), ключ `el_sueno_cap1_v2`; партии v1 квеста и ходьбы наследуются (квест → общий ключ → ходьба), старые ключи не удаляются.
  - Сайт: `/` — гибрид, `/walk/` → 301 на `/` (`deploy/cloudflare/_redirects`).
  - Тесты: `tests/e2e.py` — полное прохождение гибрида (81 проверка на десктопе, 88 на мобильном: тап по земле и объектам, джойстик, портрет), `tests/e2e_lectura.py` — «Modo lectura», `tests/e2e_saves.py` — v2 и миграция. `npm run test:lectura` вместо `test:walk`.
  - CI: e2e двумя параллельными наборами (`hibrido`, `lectura`), упавшие проверки — аннотациями прогона; preview-деплой и e2e также на push в `feature/**`.
- Общий код двух версий — `src/shared/` (`util`, `data`, `audio`, `textures`, `characters`, `world`, `player`, `systems`, `scripts`), различия — `src/modes/` (`frame/screens.js`, `quest/`, `walk/`). `versions/` удалён. Модели персонажей (герой, Anselmo, El Que Mira) вынесены в `src/shared/characters.js`. `SaveManager` и `UIManager` получили параметры режима (`key`, `legacy`, `validScr`; `help`, `badge`). В версии с ходьбой теперь тоже снимается фокус с кнопок после клика (раньше только в квесте), а у `DialogueSystem` есть выборы на время (используются только квестом).
- ES-модули и esbuild (`0.28.2`, точная версия): явные `import`/`export`, точки входа `src/main.js` и `versions/walk/src/main.js`, three.js через `import` (tree-shaking, минификация: ~570 KB вместо ~770 KB). По-прежнему один HTML на версию, работает через `file://`. `package.json`: `"type": "module"`. `SceneManager` использует `this.game` вместо глобального `game`. Тесты читают версию three из `__sueno.three`, ключи сохранений — литералами.
- Тег `v0.2-pre-hybrid` — состояние перед гибридом. Playwright MCP закреплён на `0.0.85`.
- Версия с ходьбой в репозитории: актуальные исходники (новый герой, фикс повторного срабатывания пробела, мягкая цветокоррекция страха) в `versions/walk/src/`; `src/data.js` и `src/audio.js` общие с квестом. `npm run build` собирает `dist/el-sueno.html` и `dist/el-sueno-walk.html`.
- `npm run build:site` (вместо `site`): `site/index.html`, `site/walk/index.html`, `_headers`, `404.html` (редирект на `/`).
- Тесты версии с ходьбой `tests/e2e_walk.py` (прохождение, 67 проверок) и `tests/e2e_walk_mobile.py` (тач, 14) — `npm run test:walk`; теперь возвращают код 1 при падении.
- `tests/e2e_saves.py`, `npm run test:saves`: сохранения квеста и ходьбы изолированы, миграция старого сохранения.
- Harness Claude Code: `.claude/` (агенты `spanish-editor`, `lore-keeper`, `playtester`, `code-reviewer`; скиллы `new-content`, `new-chapter`, `playtest`, `deploy`, `espanol-del-sueno`; хуки: запрет правки `dist/`, `node --check` и сборка после правки `src/`), `.mcp.json` (Playwright MCP).
- CI: деплой в production на каждый push в `main` без ожидания e2e; preview-деплой для PR (ветка Pages = ветка PR, ссылка в summary и комментарии PR); e2e — одна job, 40 минут, квест (десктоп, мобильный) и ходьба.
- Git-репозиторий, `package-lock.json`.
- Документация: `README.md`, `docs/ARCHITECTURE.md`, `docs/GAME_DESIGN.md`, `docs/LORE.md`, `docs/LANGUAGE_DESIGN.md`, `docs/CONTENT_GUIDE.md`, `docs/ROADMAP.md`, `docs/DEPLOY.md`.
- Деплой на Cloudflare Pages: `deploy/cloudflare/_headers` (CSP, security headers, `Cache-Control: no-cache`), `scripts/site.js`, npm-скрипты `site` и `deploy`.
- Тесты: `requirements.txt`, npm-скрипты `test:all` и `test:setup`, переменная `E2E_URL`.

### Изменено
- Отдельные сборки квеста и ходьбы (`dist/el-sueno-walk.html`, `src/modes/quest/`, классы `Game` двух версий) заменены гибридом; прежнее состояние — тег `v0.2-pre-hybrid`.
- Сохранения: у квеста и ходьбы свои ключи `localStorage` (`SAVE_KEYS`), раньше общий `el_sueno_cap1_v1` — версии на одном домене затирали партии друг друга. Старое сохранение при первом запуске переходит в квест, ходьба начинает с нуля. Формат `state` не менялся (`v: 1`).

### Решения
- Код режима с ходьбой (`Player.move`, коллайдеры, `CAMS.test`, тач-джойстик) не удаляется — задел под возможный гибридный режим (см. `docs/ROADMAP.md`).

### Исправлено
- `tests/e2e_walk.py`: 3 проверки падали и на исходной сборке — «colisión» упиралась в контейнер (управление относительно камеры уводит по диагонали), «pintada» и «cuaderno» не дожидались `inter.near` после смены камеры. Тест стартует из свободной точки и ждёт ближайший объект (до 5 с).
- `tests/e2e.py` возвращает код 1 при упавших проверках (раньше всегда 0).
- `tests/e2e.py`: проверки видимости активных точек и выходов ждут следующего кадра (до 5 с) — под нагрузкой SwiftShader тест изредка падал на первом кадре.

## [0.2.0] — 2026-11-14

Состояние, переданное предыдущим разработчиком (`HANDOFF.md`).

### Есть в версии
- Глава I «La Ciudad Vacía»: 5 зон, 11 кадров, 27 активных точек, погоня в пассаже, загадка с плитами, финал.
- Контент: 10 предметов, 10 документов, 76 слов в словаре, 12 фрагментов архива, 4 Eco.
- Процедурная графика (three.js r149, пост-шейдер) и процедурный звук (Web Audio), озвучка через `speechSynthesis`.
- Сохранение в `localStorage` с валидацией.
- Сборка в один HTML-файл (`build.js`), запуск через `file://`.
- Сквозной e2e-тест на Playwright (десктоп и мобильная эмуляция).
