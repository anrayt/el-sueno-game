# HANDOFF — состояние проекта на 15.11.2026

Короткая техническая записка. Подробности — в `README.md` и `docs/`. Правила работы — в `AGENTS.md`.

## Что это

EL SUEÑO, глава I «La Ciudad Vacía» — браузерный психологический хоррор с фиксированными камерами. Весь игровой текст на испанском (Испания, уровень A1). Цель — учить испанский через сюжет.

## Одна игра — два режима

Одна сборка `dist/el-sueno.html`, онлайн — `/` (старый адрес `/walk/` перенаправляет на `/`).

| Режим | Что это |
|---|---|
| **Modo: normal** (по умолчанию) | Гибрид. Улицы (callejón, plaza, pasaje, подход к puerta) — свободная ходьба: WASD/стрелки, клик или тап по земле (герой идёт к точке), джойстик — опция в паузе. Интерьеры, осмотр вблизи и разговоры (tienda, quiosco, cabina, banco Anselmo, pedestal) — статичные кадры с активными точками; «→ Salir» возвращает на улицу в точку входа. Погоня в pasaje — в реальном времени. |
| **Modo: lectura** | Все сцены — кадры, без ходьбы: активные точки и стрелки-выходы; погоня — три выбора на время. Это бывшая квест-версия. |

Режим — настройка (титульный экран, пауза). Сюжет, флаги, предметы и сохранение общие; режим можно менять посреди партии. До гибрида были две отдельные сборки (квест и ходьба) — они остались в истории под тегом `v0.2-pre-hybrid`.

## Сборка и деплой

- `npm install` (three@0.149.0, esbuild — точные версии), затем `npm run build` → `dist/el-sueno.html`: **один** HTML без внешних зависимостей, открывается двойным кликом (`file://`).
- Код — ES-модули. `build.js` пакует esbuild'ом `src/main.js` вместе с three.js в IIFE и встраивает в `src/shell.html`. Глобальных объявлений нет; для тестов есть `window.__sueno`.
- `npm run build:site` → `site/` для Cloudflare Pages (`index.html`, `_headers`, `_redirects`, `404.html`).
- CI (`.github/workflows/ci.yml`): push в `main` → деплой на https://el-sueno.pages.dev (не ждёт e2e); PR и push в `feature/**` → preview-деплой; e2e на всё это. Подробно — `docs/DEPLOY.md`.

## Архитектура (`src/`)

Подробно — `docs/ARCHITECTURE.md`. Коротко:

| Модуль | Содержимое |
|---|---|
| `shared/game.js` | `Game`: состояние, цикл, переходы улица ↔ кадр (`enterFrame`, `exitFrame`, `goTo`), режимы (`applyModo`), события зон, ввод |
| `shared/scenes.js` | `SCREENS` — сцены с `mode: 'walk' \| 'frame'`, камерой, точками и выходами; `frameOf`, `screenAt` |
| `shared/scripts.js` | `SCRIPTS` — сюжет: по async-функции на каждый интерактивный объект |
| `shared/data.js` | Контент: `ZONES`, `ITEMS`, `DOCS`, `LEX` (76 слов), `ARCHIVE`, `ECOS`, символы и решение загадки; ключи сохранений |
| `shared/world.js`, `player.js` | `SceneManager` (5 зон, `addInter`, `sync`), `CAMS`/`CameraManager`, `Gfx`; `Player` (движение, коллизии, фонарь) |
| `shared/characters.js`, `textures.js` | Параметрические low-poly персонажи (`makeBody(spec)`: протагонист, Anselmo, El Que Mira), сила «эффекта сна»; процедурные текстуры |
| `shared/systems.js`, `audio.js` | `SaveManager`, `LanguageSystem`, `Inventory`, `LoreArchive`, `DialogueSystem`, `PuzzleSystem`, `UIManager`; `AudioManager` |
| `modes/walk/` | улица: `WalkInput` (клавиши, джойстик, ходьба к точке), `InteractionSystem`, погоня в реальном времени |
| `modes/frame/` | кадр: `HotspotSystem` (точки и выходы), `chaseSeq` (погоня через выборы) |

Состояние = `state.flags` + инвентарь, документы, слова, архив, эхо, решения + где герой: `scr` (кадр или `null` — улица), `pos`, `ret` (куда вернёт «Salir»). `SceneManager.sync(flags)` идемпотентно приводит мир в соответствие с флагами — так восстанавливается сохранение.

**Сохранения.** Одна партия, формат `v: 2`, ключ `el_sueno_cap1_v2`. Партии v1 наследуются при первом запуске: квест → старый общий ключ → ходьба (старые ключи не удаляются). Режим и джойстик хранятся в настройках (`el_sueno_ajustes_v1`).

**Персонажи и «эффект сна».** Люди собраны из параметрических low-poly тел (`makeBody`). `Gfx` рисует их отдельным проходом в пониженном разрешении (3/4) и накладывает поверх сцены: фильтр Кувахары, ореол, контур, растворяющийся по шуму, эхо при движении; эффект усиливается со страхом. Сила: Anselmo 1.0, протагонист 0.4; El Que Mira тем резче, чем ближе и чем ближе к центру экрана. В паузе есть «Efecto de sueño: sí/no». Подробно — `docs/ARCHITECTURE.md`, раздел «Персонажи и эффект сна».

## Тесты

| Команда | Что проверяет |
|---|---|
| `npm test` / `npm run test:mobile` | `tests/e2e.py` — прохождение в основном режиме: ходьба, тап и клик по земле, входы в кадры и выходы, обе ветки погони, загадка, переключение режима, сохранение на улице и в кадре, финал (81 проверка на десктопе; мобильный — тач, джойстик как опция, портрет) |
| `npm run test:lectura` | `tests/e2e_lectura.py` — прохождение в «Modo lectura» (десктоп и мобильный) |
| `npm run test:saves` | `tests/e2e_saves.py` — формат v2, миграция партий квеста и ходьбы, приоритет, испорченные сохранения, режим × партия |
| `npm run test:characters` | `tests/characters.py` — скриншоты персонажей (спереди, сбоку, сзади, лица, в сценах) в `tests/screenshots/characters/`, слой и сила эффекта, правило El Que Mira, настройка «Efecto de sueño» |
| `npm run perf` | `tests/perf.py` — FPS в четырёх сценах с эффектом и без (справочно, не тест) |
| `npm run test:all` | всё подряд (~35 мин) |

Скриншоты — в `tests/screenshots/` (`h_*` — основной режим, `h_m_*` — мобильный, `q_*` — lectura). Все тесты возвращают код 1 при упавшей проверке или ошибке в консоли; в CI упавшие проверки видны как аннотации.

## Harness Claude Code

`AGENTS.md`, `CLAUDE.md`, `.claude/` (агенты `spanish-editor`, `lore-keeper`, `playtester`, `code-reviewer`; скиллы `new-content`, `new-chapter`, `playtest`, `deploy`, `espanol-del-sueno`; хуки: правка `dist/` блокируется, после правки `src/` — `node --check` и сборка), `.mcp.json` (Playwright MCP).

## Технический долг

- В реальном Safari (macOS/iOS) и на реальных Android-устройствах не проверялось.
- Уровни A2–B1 ещё не реализованы, это задача следующих глав (II — El Hospital).
