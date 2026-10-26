# AGENTS.md

Guidance for agents working on this repository.

## Project Overview

Desktop random-map-template generator (`.rmg.json`) for Heroes of Might and Magic: Olden Era. **Tauri 2 + TypeScript (React 19 + zustand), all UI in Russian.** This is a full rewrite of the former C# (WPF + Blazor WASM) app; file formats stay compatible.

```text
index.html, vite.config.ts, tsconfig.json     Vite + React + TS strict (also vitest + Playwright)
src/
  generator/            Ported core (pure TS, no DOM): settings models, .rmg.json schema,
    templateGenerator/    6-topology generator + experimental post-pass (port of TemplateGenerator.cs)
    zoneContent/          zone-content subsystem (emit/resolve/cloning/validator/warnings/catalogs)
    renderer/             layout.ts = pure layout math (node-testable); draw.ts = Canvas2D, browser-only
    rng.ts                xoshiro256** — same-seed determinism; NOT bit-compatible with .NET
    settingsMapper.ts     SettingsFile ↔ GeneratorSettings (legacy migrations preserved)
    settingsValidator.ts  validation + machine field keys + one-click fixes (RU messages)
    settingsShareCodec.ts gzip+base64url share code (fflate), lenient decode
    communityCatalog.ts   static imports of src/data/community/*.json (game datamine)
  data/                 community JSON, built-in presets (.oetgs), field-help.yaml (RU)
  state/settingsStore.ts  zustand store — canonical UI state is SettingsFile (.oetgs 1:1)
  components/panels/      all panels; RU strings co-located per file (`const T = {...}`)
  desktop/bridge.ts       every native call (dialogs, fs, steam detect, updater) — degrades in browser
src-tauri/              Rust: window, plugins (dialog/fs/opener/updater/process), steam_detect.rs
tests/                  vitest (fixtures/examples = 57 shipped templates, fixtures/gamedata)
e2e/specs/              Playwright against `vite preview` on port 5230
scripts/fetch-from-alcaras.py   community-data refresh (stdlib Python)
```

## Commands

```bash
npm ci                 # install (Node ≥ 20; Rust via rustup for src-tauri)
npm run dev            # vite dev server at http://localhost:5230
npm run build          # tsc --noEmit && vite build  ← the gate; keep it green
npm test               # vitest
npm run e2e            # Playwright (needs npm run build first; auto-starts vite preview)
npm run tauri dev      # full desktop app in dev mode
npm run tauri build    # release bundles (slow first run — crates download)
cargo check --manifest-path src-tauri/Cargo.toml
```

CI: `tests.yml` (build+vitest on every push), `e2e.yml` (Playwright), `release.yml` (tag `v*` → tauri-action builds Windows/macOS-ARM/macOS-Intel/Linux bundles and publishes a GitHub Release with signed `latest.json`).

## Hard invariants — do not break

1. **`.oetgs` field names are frozen.** `src/generator/settingsFile.ts` mirrors the C# `SettingsFile` JSON names byte-for-byte; users have existing files, presets and share codes depend on them. Same for `settingsMapper`'s legacy migrations (experimentalEnabled, contentDensity, balancedZonePlacement).
2. **`.rmg.json` emission order matters.** Templates serialize via `toJsonIndented` (strips null/undefined and the `generatorPosition` render hint, 2-space indent). Keep object key insertion order mirroring the C# model property order.
3. **Same seed ⇒ byte-identical template** (within TS, all platforms). The single `Rng` instance threads through generation exactly like C#; preserve draw order when editing `templateGenerator/`. Do not introduce `Math.random()` anywhere in `src/generator/`.
4. **Store canonical state is `SettingsFile`.** Panels patch it; `GeneratorSettings` is derived via `fromFile()` at generate/validate time. Note: the mapper intentionally does NOT map `seed` (C# parity) — hosts handle it (`components/panels/seedPatch.ts`).
5. **`src/generator/` has no DOM/Tauri imports** (renderer `draw.ts` and `desktop/` are the exceptions, by design). `tests/helpers/gameDataCatalog.ts` is node-fs and test-only — keep it out of the app bundle.

## UI rules (Russian)

- All user-facing text is Russian, co-located in each panel file as `const T = {...}`. `src/i18n/ru.ts` holds shell strings only.
- Player-facing terms (factions, victory conditions, spell schools) live in `knownValues.ts` / `heroCatalog.ts` with `// TODO: verify wording against in-game Russian localization` — verify against the game's RU localization before removing the marker.
- Hero/unit/spell names come from the datamine (English) by design.

## Community data

`src/data/community/*.json` mirrors alcaras/homm-olden. Refresh: `python3 scripts/fetch-from-alcaras.py` (paths of the JSON sink are inside the script). A weekly workflow opens a PR; `npm test` gates it (catalog invariants: 108 heroes, 6 factions, SID regex).

## Release process

1. Sync versions in `package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml` (and `Cargo.lock` will follow).
2. Commit on `main`, tag `vX.Y.Z`, push.
3. `release.yml` (tauri-action) builds all four targets and publishes the release. Updater signing needs repo secrets `TAURI_SIGNING_PRIVATE_KEY` (+`_PASSWORD`); the public key is embedded in `tauri.conf.json`. Local keypair lives in `~/.tauri/olden-era-templates.key` — never commit it.
4. Never re-tag an existing version; bump the patch instead.

## Gotchas

- macOS/Linux cannot run Windows-only code paths; `steam_detect.rs` registry branch is `#[cfg(windows)]` — the `libraryfolders.vdf` parser is the tested path.
- e2e tests target the **vite preview** (production bundle), not `tauri dev`; browser build degrades gracefully without Tauri (`src/platform.ts`).
- First `cargo build` downloads ~500 crates; use `cargo check` for quick validation.
- The repo previously contained a C# solution (deleted in the TS rewrite); do not resurrect `.csproj`/`.slnx` references in docs or CI.
