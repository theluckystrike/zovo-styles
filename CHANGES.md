# CHANGES — Zovo Styles (fork of openstyles/stylus)

Zovo Styles is a fork of [Stylus](https://github.com/openstyles/stylus)
(upstream: `openstyles/stylus`, GPL-3.0-only). This file states the fork's
changes as required by the GPL. Upstream copyright and license headers are
retained in all upstream files; files added by the fork carry their own
GPL-3.0-only headers and live under `src/zvst/` (plus clearly commented
`Fork (Zovo Styles)` edits inside upstream files).

Forked from upstream `master` @ `12a4efd` (2026-08). Build tooling was
switched from npm to pnpm because upstream's `preinstall` enforces it.

## Branding
- Renamed the product to **Zovo Styles** (manifest name, action title,
  `default_locale` en messages, options title, links).
- Shipped `_locales` is **en-only** (upstream's other 34 locales removed to
  keep the reviewer surface clean; they can be re-added from upstream).
- Upstream's pinned extension `key` removed from the manifest (fork must not
  collide with upstream's extension identity).
- Upstream wiki/Transifex/GitHub links repointed to this repo.
- New icon set (violet brush mark), including toolbar (white) and disabled
  (gray) variants and the options-page icon choices.
- Global UI accent ramp recolored from upstream teal (hue 180) to brand
  violet (hue 255): `src/css/global.css`, `src/css/global-dark.css`,
  `src/css/onoffswitch.css`.

## Added features (all local, zero network except license activation)
1. **Curated starter theme pack** — `src/zvst/starter-themes.json` + manager
   UI (`src/manage/zvst-manage.js`, `src/manage.html`) and popup entry point.
   One-click install through the normal style pipeline (idempotent).
2. **Editor lint auto-fix (Pro)** — `src/zvst/css-fixer.js` is a
   deterministic safe-fix engine (upstream's bundled stylelint has its fix
   path compiled out — `fix:true` returns no output, so fixing is
   implemented directly). Wired into the editor lint panel
   (`src/edit/zvst-autofix.js`, button in `src/edit.html`).
3. **Per-site dark/light variant switcher** — popup tri-state
   (`src/popup/zvst-popup.js`, `src/popup.html`), background resolution in
   `src/background/color-scheme.js` (`siteSchemeOverride`, `isDarkFor`,
   `themeAllowsStyle(style, url)`), cache invalidation + tab requery on
   change (`src/background/zvst-api.js`, `src/content/apply.js` case
   `zlsRequery`). Pref key `zls.siteSchemes`.
4. **One-click full backup/restore** — single-file JSON envelope
   (`app: zovo-styles, kind: full-backup`) covering styles + non-default
   prefs + order + lz values; restore accepts the envelope AND upstream
   Stylus backups. `src/background/zvst-api.js` (`exportFullBackup` /
   `importFullBackup`), buttons in popup and manager, envelope accepted by
   the existing Import button (`src/manage/import-export.js`).

## Monetization (license layer 5.95)
- Optional Pro unlock for editor power tools (auto-fix). Everything upstream
  does remains free; the starter pack, variant switcher, and backup are free.
- `src/zvst/license.js` ports the frozen fleet license contract: key shape
  `ZOVO-XXXX-XXXX-XXXX-XXXX` shape-checked client-side; grant ONLY on a
  schema-validated `{valid:true}` server response (never `tier=='pro'`); a
  7-day offline grace cache that itself must come from a server-verified
  record bound to the same key; fail-closed with no build-time key.
- `SUPABASE_ANON_KEY` (publishable anon key) is injected ONLY at build time
  via `tools/webpack.vars.js` from the environment; it is never committed.
- License server: Supabase Edge Function `verify-extension-license`,
  extension key `zovostyles` (must be registered server-side before the paid
  tier works — noted on the ship card).
- Pro gate UI: `src/zvst/pro-ui.js` (shared dialog), options-page Pro
  section (`src/options/zvst-options.js`), popup Pro chip.

## Removed (MV3/CWS compliance)
- **LESS and Stylus-language preprocessors removed.** Both compiler bundles
  (`less.js`, `stylus-lang.js`) are eval/new Function-based, which is dead code
  under MV3's `script-src 'self'` CSP and trips the CWS remote/dynamic-code
  rule. `@preprocessor less|stylus` UserCSS styles now fail with a clear
  message. Plain CSS (sectioned and UserCSS) is unaffected.
- Backup file name is `zls-full-backup-<date>.json`; the backup envelope tag
  is `app: "zls-styles"` (fleet namespace rules).

## Privacy
- Zero telemetry, zero analytics, zero style-data collection. The only
  network calls are upstream's user-configured features (style update
  checks, sync, online style search) and the license-verify POST, which
  happens only when the user activates a key.

## UX polish
- Real empty states in popup and style manager (was: blank pane).
- Draft-recovery dialog is no longer alarm-red ("danger" class removed);
  retitled "Draft recovered from <time>".
- Inline color swatches got a hairline border (near-white swatches read as
  boxes before).
- Popup footer bar with site variant switcher, Themes, Backup, Pro.
