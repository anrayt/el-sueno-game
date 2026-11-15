# HANDOFF — состояние проекта на 15.11.2026

Короткая техническая записка. Подробности — в `README.md` и `docs/`. Правила работы — в `AGENTS.md`.

## Что это

EL SUEÑO, глава I «La Ciudad Vacía» — браузерный психологический хоррор в формате кинематографичного квеста (Telltale / Snatcher). Игрок не ходит: смотрит на фиксированные 3D-кадры, нажимает на активные точки, читает документы и выбирает реплики. Весь игровой текст на испанском (Испания, уровень A1). Цель — учить испанский через сюжет.

## Две версии игры

| Версия | Исходники | Сборка | Онлайн | Управление |
|---|---|---|---|---|
| **Основная — квест** | `src/` | `dist/el-sueno.html` | `/` | Фиксированные кадры, активные точки, выборы. Тап/клик, без ходьбы |
| **Альтернативная — с ходьбой** | `versions/walk/src/` + общие `src/data.js`, `src/audio.js` | `dist/el-sueno-walk.html` | `/walk/` | Свободная ходьба (WASD/стрелки, джойстик на телефоне), камеры меняются по зонам, погоня в реальном времени |

Сюжет, контент, мир и звук общие. `data.js` и `audio.js` у версий один и тот же файл (`src/`). `world.js` и `systems.js` почти совпадают, но скопированы. `game.js` и `shell.html` отличаются сильно: в версии с ходьбой ввод джойстиком, `InteractionSystem` и погоня в реальном времени, в квесте `screens.js` и погоня через выборы. Правка в `world.js`/`systems.js`/`SCRIPTS` пока делается в двух местах — см. техдолг.

## Сборка и деплой

- `npm install` (ставит three@0.149.0), затем `npm run build` → обе версии в `dist/`. Каждая — **один** HTML без внешних зависимостей, открывается двойным кликом (`file://`).
- Код — ES-модули. `build.js` пакует esbuild'ом `main.js` версии вместе с three.js в IIFE и встраивает в `shell.html`. Глобальных объявлений нет; для тестов есть `window.__sueno`.
- `npm run build:site` → `site/` для Cloudflare Pages (`index.html`, `walk/index.html`, `_headers`, `404.html`).
- CI (`.github/workflows/ci.yml`): push в `main` → деплой на https://el-sueno.pages.dev (не ждёт e2e); PR → preview-деплой и ссылка в PR; e2e на push и PR. Подробно — `docs/DEPLOY.md`.

## Архитектура (`src/`)

| Файл | Содержимое |
|---|---|
| `shell.html` | HTML-разметка, весь CSS, плейсхолдеры `/*__THREE__*/` и `/*__GAME__*/` |
| `data.js` | Контент: `ZONES`, `ITEMS`, `DOCS`, `LEX` (76 слов с определениями на простом испанском), `ARCHIVE`, `ECOS`, символы и решение загадки; ключи сохранений `SAVE_KEYS` |
| `audio.js` | `AudioManager` — весь звук процедурный (Web Audio); озвучка через `speechSynthesis` (es-ES) |
| `world.js` | Процедурные текстуры, `SceneManager` (5 зон, свет, `addInter`), `CAMS` и `CameraManager`, `Player` (модель героя), `Gfx` (низкое разрешение + пост-шейдер) |
| `systems.js` | `SaveManager`, `LanguageSystem`, `Inventory`, `LoreArchive`, `DialogueSystem`, `PuzzleSystem`, `UIManager` |
| `screens.js` | Только квест: `SCREENS` — 11 кадров и `HotspotSystem` |
| `game.js` | `SCRIPTS` — сюжет; класс `Game` (состояние, флаги, переходы, погоня, обморок, финал, цикл, ввод) |

Состояние = `state.flags` + инвентарь, документы, слова, архив, эхо, решения, кадр (квест) или позиция (ходьба). `SceneManager.sync(flags)` идемпотентно приводит мир в соответствие с флагами — так восстанавливается сохранение.

**Сохранения.** Версии на одном домене делят `localStorage`, поэтому у каждой свой ключ: `el_sueno_cap1_quest_v1` и `el_sueno_cap1_walk_v1`. Старое общее `el_sueno_cap1_v1` при первом запуске квеста переносится в квест и удаляется; ходьба начинает с нуля.

## Тесты

| Команда | Что проверяет |
|---|---|
| `npm test` / `npm run test:mobile` | `tests/e2e.py` — прохождение квеста: 52 проверки на десктопе, 54 в мобильной эмуляции (~10 мин каждый, таймеры в реальном времени) |
| `npm run test:walk` | `tests/e2e_walk.py` (прохождение, 67) и `tests/e2e_walk_mobile.py` (джойстик и тач, 14) |
| `npm run test:saves` | `tests/e2e_saves.py` — сохранения двух версий изолированы, миграция старого сохранения (16) |
| `npm run test:all` | всё подряд |

Скриншоты — в `tests/screenshots/` (ходьба — в `tests/screenshots/walk/`). Все тесты возвращают код 1 при упавшей проверке или ошибке в консоли.

## Harness Claude Code

`AGENTS.md`, `CLAUDE.md`, `.claude/` (агенты `spanish-editor`, `lore-keeper`, `playtester`, `code-reviewer`; скиллы `new-content`, `new-chapter`, `playtest`, `deploy`, `espanol-del-sueno`; хуки: правка `dist/` блокируется, после правки `src/`/`versions/` — `node --check` и сборка), `.mcp.json` (Playwright MCP).

## Технический долг

- **Главное:** вынести общий код двух версий (`world.js`, большую часть `systems.js` и `SCRIPTS`) в `src/shared/`, а различия (ввод, камеры, погоня, HUD) — в `src/modes/quest/` и `src/modes/walk/`; модели персонажей — в `src/shared/characters.js`. Тогда контент новых глав пишется один раз.
- В квест-версии остался код ходьбы (`Player.move`, коллайдеры, `test` у `CAMS`, скрытые `#joy`/`#btnA`/`#btnR`, поля `keys`/`joy`/`runT`). **Не удалять**: при объединении он уйдёт в общий модуль.
- В реальном Safari (macOS/iOS) и на реальных Android-устройствах не проверялось.
- Уровни A2–B1 ещё не реализованы, это задача следующих глав (II — El Hospital).
