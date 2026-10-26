# Olden Era — Генератор шаблонов карт

Десктопный генератор случайных карт (`.rmg.json`) для **Heroes of Might and Magic: Olden Era**. Кроссплатформенный: **Windows, macOS, Linux** (Tauri 2 + TypeScript).

> Это переписанная с нуля версия бывшего C#-приложения (WPF + Blazor WASM). Форматы файлов полностью совместимы: `.oetgs`-настройки и сгенерированные `.rmg.json`-шаблоны открываются как старыми, так и новыми версиями.

## Возможности

- 6 топологий карты: Кольцо, Хаб, Цепочка, Случайная, Сбалансированная + турнирные сетки
- 2–8 игроков, настройки нейтральных зон, замков, плотности ресурсов и стражи
- Баны героев и заклинаний (по встроенному каталогу игры: 108 героев, 6 фракций)
- Условия победы: стандарт, потеря города, гладиаторская арена, удержание города, турнир
- Экспериментальные функции: стартовые бонусы, контроль контента зон, переопределения зон, ямы сражений и др.
- PNG-превью карты (Canvas2D, порт SkiaSharp-рендера)
- Встроенные и пользовательские пресеты, undo/redo, автосохранение
- **AI-ассистент**: чат с любой OpenAI-совместимой моделью — опиши карту словами, ассистент сам настроит поля, исправит ошибки валидации и соберёт превью
- Автодетект папки `map_templates` установленной игры через Steam
- Автообновления (GitHub Releases + подписанный updater)

## Установка

Скачайте сборку со страницы [Releases](https://github.com/Tozix/olden-era-templates/releases):

| ОС | Файл |
|---|---|
| Windows | `.msi` / `.exe` (NSIS) |
| macOS (Apple Silicon) | `.dmg` (aarch64) |
| macOS (Intel) | `.dmg` (x64) |
| Linux | `.AppImage` / `.deb` |

### Где игра ищет шаблоны

```
<папка игры Steam>\HeroesOldenEra_Data\StreamingAssets\map_templates
```

Приложение находит эту папку автоматически (реестр Windows / `libraryfolders.vdf`) и предлагает её при сохранении.

## AI-ассистент

Кнопка **🤖 AI** в тулбаре открывает чат. В настройках ассистента (⚙) указываются:

- **Base URL** — любой OpenAI-совместимый сервер: OpenAI (`https://api.openai.com/v1`), OpenRouter, DeepSeek, локальные LM Studio (`http://localhost:1234/v1`) / Ollama (`http://localhost:11434/v1`);
- **API-ключ** — хранится только на этом компьютере (`appData/OldenEraTemplates/ai-config.json`), никуда, кроме выбранного API, не отправляется;
- **Модель** — например `gpt-4o-mini`, `deepseek-chat`, `qwen2.5:7b`.

Ассистент работает через tool-calls: умеет применять любые поля настроек (каталог полей автоматически берётся из модели приложения), видит ошибки валидации и сам их исправляет, запускает генерацию и превью.

## Детерминизм seed

Одинаковый seed всегда даёт одинаковый шаблон **внутри TS-версии**. Портированный PRNG (xoshiro256\*\*) не побитово совместим с .NET `Random`: шаблон с тем же seed будет отличаться от C#-версии приложения (но останется валидным).

## Сборка из исходников

Требования: **Node.js ≥ 20**, **Rust** (rustup), системные вебкит-зависимости на Linux (`libwebkit2gtk-4.1-dev` и др.).

```bash
npm ci
npm run tauri dev      # запустить приложение в dev-режиме
npm run tauri build    # собрать релизные бандлы
```

### Тесты

```bash
npm test          # vitest: детерминизм, round-trip'ы, валидатор, каталоги
npm run build     # typecheck + production-сборка
npm run e2e       # Playwright против vite preview (сначала npm run build)
```

## Обновление каталога community-данных

Каталог героев/заклинаний/юнитов зеркалируется из датамайна [alcaras/homm-olden](https://github.com/alcaras/homm-olden) в `src/data/community/*.json`:

```bash
python3 scripts/fetch-from-alcaras.py
```

Запускается автоматически по понедельникам (workflow `refresh-community-data.yml`) — при изменениях открывается PR.

## Настройка автообновлений (для мейнтейнеров)

Подпись updater-артефактов требует секрета в настройках репозитория:

- `TAURI_SIGNING_PRIVATE_KEY` — содержимое приватного minisign-ключа
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — пароль ключа (можно пустой)

Публичный ключ уже вшит в `src-tauri/tauri.conf.json`. Локальная пара ключей лежит в `~/.tauri/olden-era-templates.key(.pub)` — не коммитьте приватный ключ.

## Благодарности

- [alcaras/homm-olden](https://github.com/alcaras/homm-olden) — датамайн каталога игры
- [KhanDevelopsGames/Olden-Era---Template-Generator](https://github.com/KhanDevelopsGames/Olden-Era---Template-Generator) — оригинальный C#-проект, с которого начался этот форк
