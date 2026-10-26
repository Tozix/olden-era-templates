# Полный переезд: Tauri 2 + TypeScript (React 19 + zustand), без C#

**Решения зафиксированы:** React 19 + zustand; полный Canvas2D-порт рендера; коммиты сразу в `main`; веб-версия, GitHub Pages и весь C# удаляются. UI полностью на русском.

## Ключевое архитектурное решение — детерминизм

C#-генератор детерминирован от seed (один `System.Random` на всё). В TS делаем **свой seeded PRNG (xoshiro256\*\*)** — та же семантика (int?-seed, «Reseed» = случайный int), но байт-в-байт совпадения с .NET при том же seed **не гарантируем и не обещаем** (фиксируем в README). Проверка корректности порта — структурная: golden-инварианты, валидатор, паритет формы с 57 эталонными шаблонами игры. Форматы сохраняем совместимыми: `.rmg.json` (camelCase), `.oetgs` (SettingsFile) читает файлы существующих пользователей, share-код (gzip+base64url) сохраняет формат.

## Целевой layout репозитория

```
/                            package.json, vite.config.ts, tsconfig.json, index.html
  src/
    main.tsx, App.tsx        оболочка: 3 колонки (навигация | панели | превью)
    i18n/ru.ts               ВСЕ русские строки UI (единый модуль)
    generator/               порт ядра C# (см. ниже)
    renderer/                Canvas2D-порт TemplatePreviewRenderer (700×700)
    components/panels/       панели (порт Blazor-компонентов)
    data/
      community/*.json       9 файлов (~840 КБ) из CommunityData
      presets/               манифест + встроенные пресеты (.oetgs/.json)
      field-help.yaml        переведён на русский
    assets/fonts/Cinzel.ttf
  src-tauri/                 Rust: main.rs, commands/steam_detect.rs, tauri.conf.json, icons/
  tests/                     vitest (порты xUnit-тестов), fixtures/examples/ (57 .rmg.json), fixtures/gamedata/
  e2e/                       Playwright (smoke + mobile, webServer = vite preview :5230)
  scripts/fetch-from-alcaras.py  (остаётся, пути обновить)
```

## Этапы (вертикальный срез: работающее приложение как можно раньше)

**P0. Окружение и каркас.** Проверить/поставить node≥20, rustup/cargo (macOS, Xcode CLT), `@tauri-apps/cli` через npm. Vite + React-TS + Tauri 2 scaffold: окно 1280×800, заголовок «Olden Era — Генератор шаблонов», productName `OldenEraTemplates`, version 0.8.0, plugins: dialog, fs, opener, updater, process. Gate: `cargo tauri dev` открывает пустое окно.

**P1. Миграция данных (git mv).** CommunityData → src/data/community; пресеты → src/data/presets; GameData/GeneratorData + ExampleTemplates (57 шт.) → tests/fixtures; Cinzel.ttf → src/assets; field-help.yaml → перевод RU. Обновить пути в fetch-скрипте.

**P2. Типы и статические каталоги.** Порт: GeneratorSettings (дерево настроек с дефолтами), SettingsFile (.oetgs), модели Unfrozen/* (RmgTemplate и др. — интерфейсы сразу с JSON-именами), KnownValues, KnownIds, HeroCatalog, ZoneContentSidCatalog, ContentListCatalog, ZoneContentPresets, CommunityCatalog (типы записей + лоадеры статических импортов), FieldHelpCatalog, ExperimentalFeatures, SidCsv, PickerFilter.

**P3. Порт генератора (~3.8k строк → модули).** neutral-zone plan, tuning/content scale, топологии (Default/HubAndSpoke/Chain/SharedWeb/Random/Balanced + турнирные кластеры, Delaunay-рёбра, деранджемент порталов, гарантии связности), билдеры зон, пост-проход ApplyExperimentalSettings, ZoneRoadDecorationEmitter. PRNG: xoshiro256** + Next/NextDouble-семантика, один поток на генерацию. Gate: smoke-тест — дефолтные настройки дают валидный RmgTemplate с ожидаемыми топ-ключами.

**P4. Сервисы.** SettingsMapper (To/FromFile), SettingsValidator (+ValidationFieldKeys/IssueCodes/Fixes), SettingsShareCodec (CompressionStream gzip; fallback pako; lenient decode), EditHistory (undo/redo + hotkeys Ctrl/Cmd-Z), UserPresetStore (+ интерфейс хранилища: Tauri-fs impl в appData, memory/localStorage для тестов), PresetCatalog, PreviewSidecar.

**P5. Рендер (полный порт).** Layout: кольцевые топологии, GeneratorPosition, Fruchterman–Reingold, ring-snap Balanced; Draw: пергамент (градиент+8 пятен+виньетка), роза ветров, рамка, связи (портал — кривые, gap-cut под монетами), монетки зон (ободок по роли: игрок/тип нейтрала/hub/hold-city, цифры игроков, значки замков), подписи, Cinzel через FontFace. Экспорт PNG: canvas.toBlob → байты для sidecar и превью.

**P6. UI (React), приоритет по секциям.** Оболочка + zustand-стор настроек → секции: Map, Topology, Zones (+Advanced), Heroes (баны героев/заклинаний чипами), Win Conditions (включая турнир/гладиатор), затем карточки Experimental (game mode, бонусы+per-player, terrain, guards, connection defaults, neutral cities, content control, zone overrides, encounter holes, per-tier, ZoneContentEditor с 7 табами). Компоненты: SliderRow, SectionNav, PresetPickerModal, PreviewPanel (reseed, zoom), валидация с кнопками-фиксами, тосты. Тёмная тема CSS (порт ModernDarkTheme). Всё из `i18n/ru.ts`; имена героев/заклинаний — из datamine (английские, помечаем TODO: сверить с русской локализацией игры), фракции и школы магии — русский.

**P7. Десктоп-интеграция (Rust/плагины).** `detect_game_templates_dir`: реестр (`reg query`, win-only) + парсинг `libraryfolders.vdf` + известные пути (mac/linux) — начальный каталог диалогов + предупреждение о чужой папке; открыть/сохранить `.oetgs`, сохранить `.rmg.json`(+png sidecar); пресеты на диске; автосохранение настроек (JSON в appData); tauri-plugin-updater (эндпоинт GitHub latest, чекбокс «проверять обновления»; подпишу release-артефакты, если пользователь добавит TAURI_SIGNING_PRIVATE_KEY secret — иначе updater сконфигурирован и ждёт ключ). **Выпиливаем из фич:** installer-zip, кастомный тайтлбар (нативный), batch-самоустановка.

**P8. Тесты (vitest).** Порт по приоритету: round-trip SettingsFile/Mapper/ShareCodec (+enum-строки, seed, zone-content), SeedDeterminism (тот же seed → байт-идентично в TS), Validator + content-pool warnings, PresetCatalog (≥14 id, валидатор-чистые), CommunityCatalog (108 героев, 6 фракций), EditHistory, ZoneContent resolver/emitter/cloning/warnings, ReferenceTemplateParity (структурно против эталонов: имена зон, счётчики связей, ключевые поля), EmittedIdValidation против GeneratorData, layout-тесты рендера. Playwright smoke/mobile против vite preview. Gate: весь vitest зелёный.

**P9. CI.** tests.yml → node20+npm ci+tsc+vitest+(опц. playwright); release.yml → tauri-action матрицей windows/macos/ubuntu (nsis, dmg, appimage/deb) с updater-артефактами; e2e.yml → vite preview; deploy-web.yml удалить; refresh-community-data.yml — обновить пути/текст PR.

**P10. Удаление старого.** `git rm -r` src/OldenEra.{Web,TemplateEditor,Generator}, tests/OldenEra.*, OldenEra.slnx, Directory.Build.props, UPSTREAM.md, docs/COMPLETENESS-TODO.md, docs/plans/, старый tests/e2e webServer. .gitignore почистить от VS-блоков.

**P11. Документация и финал.** README на русском (установка через Releases на 3 ОС, сборка из исходников, community-data refresh), AGENTS.md под новый стек, финальный gate: `npm run build`, vitest, e2e smoke, `cargo tauri build` (macOS) + ручной прогон: сгенерировать, посмотреть превью, пересидировать, сохранить .rmg.json, открыть/сохранить .oetgs, пресеты. Коммит(ы) в main.

## Риски и честные оговорки

- **Объём**: это ~25k+ строк порта+нового кода. Порядок этапов гарантирует, что после P5 приложение уже работает end-to-end; широкие экспериментальные карточки (P6-хвост) — первые кандидаты на «доделать следующей сессией», если сессия кончится.
- **Steam-детект на Windows** локально (macOS) не проверить — vdf-парсер покрывается юнит-тестами, registry-ветка за `#[cfg(windows)]`.
- **Updater** требует секрет подписи в GitHub — сконфигурирую всё, кроме секрета; шаг для тебя опишу.
- Имена героев/юнитов/заклинаний остаются английскими из datamine (нет проверенного русского источника) — помечу TODO по правилам репо.