# Журнал изменений

Формат — [Keep a Changelog](https://keepachangelog.com/ru/1.1.0/), версии — [SemVer](https://semver.org/lang/ru/).

## [Не выпущено]

### Добавлено
- Git-репозиторий, `package-lock.json`.
- Документация: `README.md`, `docs/ARCHITECTURE.md`, `docs/GAME_DESIGN.md`, `docs/LORE.md`, `docs/LANGUAGE_DESIGN.md`, `docs/CONTENT_GUIDE.md`, `docs/ROADMAP.md`, `docs/DEPLOY.md`.
- Деплой на Cloudflare Pages: `deploy/cloudflare/_headers` (CSP, security headers, `Cache-Control: no-cache`), `scripts/site.js`, npm-скрипты `site` и `deploy`.
- GitHub Actions (`.github/workflows/ci.yml`): сборка и e2e (десктоп + мобильный) на push и PR, деплой при push в `main` после зелёных тестов.
- Тесты: `requirements.txt`, npm-скрипты `test:all` и `test:setup`, переменная `E2E_URL`.

### Решения
- Код режима с ходьбой (`Player.move`, коллайдеры, `CAMS.test`, тач-джойстик) не удаляется — задел под возможный гибридный режим (см. `docs/ROADMAP.md`).

### Исправлено
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
