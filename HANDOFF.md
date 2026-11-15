# HANDOFF — состояние проекта на 15.11.2026

Короткая техническая записка. Подробности — в `README.md` и `docs/`. Правила работы — в `AGENTS.md`.

## Что это

EL SUEÑO, глава I «La Ciudad Vacía» — браузерный психологический хоррор в формате кинематографичного квеста (Telltale / Snatcher). Игрок не ходит: смотрит на фиксированные 3D-кадры, нажимает на активные точки, читает документы и выбирает реплики. Весь игровой текст на испанском (Испания, уровень A1). Цель — учить испанский через сюжет.

## Две версии игры

| Версия | Исходники | Сборка | Онлайн | Управление |
|---|---|---|---|---|
| **Основная — квест** | `src/modes/quest/` + `src/modes/frame/` | `dist/el-sueno.html` | `/` | Фиксированные кадры, активные точки, выборы. Тап/клик, без ходьбы |
| **Альтернативная — с ходьбой** | `src/modes/walk/` | `dist/el-sueno-walk.html` | `/walk/` | Свободная ходьба (WASD/стрелки, джойстик на телефоне), камеры меняются по зонам, погоня в реальном времени |

Сюжет (`SCRIPTS`), контент, мир, персонажи, звук и системы — общий код в `src/shared/`. Различаются только класс `Game`, разметка и ввод (`src/modes/`). Следующий шаг — гибрид в одной сборке: у каждой сцены `mode: 'walk' | 'frame'` (план согласован, см. `docs/ROADMAP.md`).

## Сборка и деплой

- `npm install` (ставит three@0.149.0), затем `npm run build` → обе версии в `dist/`. Каждая — **один** HTML без внешних зависимостей, открывается двойным кликом (`file://`).
- Код — ES-модули. `build.js` пакует esbuild'ом `main.js` версии вместе с three.js в IIFE и встраивает в `shell.html`. Глобальных объявлений нет; для тестов есть `window.__sueno`.
- `npm run build:site` → `site/` для Cloudflare Pages (`index.html`, `walk/index.html`, `_headers`, `404.html`).
- CI (`.github/workflows/ci.yml`): push в `main` → деплой на https://el-sueno.pages.dev (не ждёт e2e); PR → preview-деплой и ссылка в PR; e2e на push и PR. Подробно — `docs/DEPLOY.md`.

## Архитектура (`src/`)

Подробно — `docs/ARCHITECTURE.md`. Коротко:

| Модуль | Содержимое |
|---|---|
| `shared/data.js` | Контент: `ZONES`, `ITEMS`, `DOCS`, `LEX` (76 слов), `ARCHIVE`, `ECOS`, символы и решение загадки; ключи сохранений `SAVE_KEYS` |
| `shared/audio.js` | `AudioManager` — процедурный звук (Web Audio), озвучка `speechSynthesis` (es-ES) |
| `shared/textures.js`, `characters.js` | Процедурные текстуры; модели героя, Anselmo и El Que Mira |
| `shared/world.js`, `player.js` | `SceneManager` (5 зон, `addInter`, `sync`), `CAMS`/`CameraManager`, `Gfx`; `Player` (движение, коллизии, фонарь) |
| `shared/systems.js` | `SaveManager`, `LanguageSystem`, `Inventory`, `LoreArchive`, `DialogueSystem`, `PuzzleSystem`, `UIManager` |
| `shared/scripts.js` | `SCRIPTS` — сюжет: по async-функции на каждую активную точку |
| `modes/frame/screens.js` | `SCREENS` — 11 кадров и `HotspotSystem` |
| `modes/quest/`, `modes/walk/` | Класс `Game` режима, `main.js`, `shell.html`; у ходьбы ещё `interaction.js` |

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

`AGENTS.md`, `CLAUDE.md`, `.claude/` (агенты `spanish-editor`, `lore-keeper`, `playtester`, `code-reviewer`; скиллы `new-content`, `new-chapter`, `playtest`, `deploy`, `espanol-del-sueno`; хуки: правка `dist/` блокируется, после правки `src/` — `node --check` и сборка), `.mcp.json` (Playwright MCP).

## Технический долг

- **Главное:** гибрид в одной сборке — улицы с ходьбой, интерьеры и разговоры в кадрах, режимы «normal» и «lectura» как настройки (см. `docs/ROADMAP.md`).
- В квест-версии остался код ходьбы (`Player.move`, коллайдеры, `test` у `CAMS`, скрытые `#joy`/`#btnA`/`#btnR`, поля `keys`/`joy`/`runT`). **Не удалять**: при объединении он уйдёт в общий модуль.
- В реальном Safari (macOS/iOS) и на реальных Android-устройствах не проверялось.
- Уровни A2–B1 ещё не реализованы, это задача следующих глав (II — El Hospital).
