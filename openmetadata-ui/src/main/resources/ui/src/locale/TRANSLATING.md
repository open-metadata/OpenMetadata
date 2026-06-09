<!--
  Copyright 2025 Collate.
  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at
  http://www.apache.org/licenses/LICENSE-2.0
-->

# Translating the OpenMetadata UI

The UI is internationalized with **i18next**. Each language is one flat-ish
JSON file under [`src/locale/languages/`](./languages), keyed identically to the
primary **`en-us.json`**. Anything not translated falls back to `en-US` at
runtime, so a locale is always usable even when partially translated.

This document describes how to add/maintain a locale and the tooling that
supports it. See also the upstream guide:
<https://docs.open-metadata.org/developers/how-to-add-language-support>.

## TL;DR

```bash
cd openmetadata-ui/src/main/resources/ui

# 1. create the file (copy the primary as a complete, in-sync starting point)
cp src/locale/languages/en-us.json src/locale/languages/<code>.json

# 2. register the locale in 3 places (see "Registering a locale" below)

# 3. translate values (by hand, via a TMS, or via PO — see options below)

# 4. keep keys in sync with the primary, then validate
yarn i18n                                  # sync keys/order with en-us
yarn i18n:validate <code>                  # structural + token + format checks
```

`<code>` is lowercase `lang-country`, e.g. `sv-se`.

## Registering a locale

Three edits make the locale selectable and lazily loaded:

| File | Change |
| --- | --- |
| `src/utils/i18next/LocalUtil.interface.ts` | add `<Native> = '<lang>-<COUNTRY>'` to `SupportedLocales` |
| `src/utils/i18next/LocalUtilClassBase.ts` | add `'<lang>-<COUNTRY>': () => import('../../locale/languages/<code>.json')` |
| `src/utils/i18next/i18nextUtil.ts` | add `<lang>: SupportedLocales.<Native>` to `languageMap` (browser auto-detect) |

## The rules that keep i18next happy

1. **Keys never change.** Only translate values. Keep the key set **and order**
   identical to `en-us.json` — `yarn i18n` (`sync-i18n`) enforces this.
2. **Preserve every placeholder verbatim:** `{{interpolation}}` tokens and the
   numbered `<0>…</0>` / `<1>` tags used by `<Trans>`. Same set, same names,
   same order. Never translate text *inside* `{{ }}`. This is the #1 way machine
   translation silently breaks the UI.
3. **Leave proper nouns / acronyms / product names in English** (API, SQL, JWT,
   FQN, Webhook, dbt, Elasticsearch, Snowflake, OpenMetadata, …).
4. **Formatting is fixed**: 2-space JSON + trailing newline (what `yarn i18n`
   and Prettier produce). `yarn i18n:validate` fails on any drift.

## Validation (`scripts/i18n-validate.mts`)

Dependency-free structural check used after any locale edit (and a candidate CI
gate). It runs on Node's native TypeScript type-stripping (Node ≥ 22.6) — no
transpiler or runtime dependency. For each locale it verifies, against `en-us`:

- **key parity** — identical keys, identical order;
- **token parity** — every `{{x}}` / `<n>` tag matches the primary string;
- **formatting** — bytes equal `JSON.stringify(obj, null, 2) + "\n"`;

and prints coverage. Exits non-zero on failure.

```bash
yarn i18n:validate                  # all locales
yarn i18n:validate sv-se            # one locale
# under the hood (Node >= 22.6, native TS, no transpiler):
#   node --experimental-strip-types scripts/i18n-validate.mts sv-se
```

## Ways to produce the translations

### A. Translation Management System (recommended for ongoing work)

**Crowdin** and **Weblate** read the i18next JSON **directly** — no conversion —
and protect placeholders, offer glossaries, translation memory, and machine
pre-translation, with native-speaker review in their UI. A starter
[`crowdin.yml`](../../../../../../../crowdin.yml) is included (inert until a
maintainer connects a project). Round-trip is: push `en-us.json` → translate in
the TMS → pull `<code>.json` → `yarn i18n` → `i18n:validate`.

### B. gettext PO (Poedit / translate-toolkit / DeepL)

If your toolchain prefers PO, bridge JSON ⇄ PO with
[`scripts/i18n-po.mts`](../../scripts/i18n-po.mts) (uses `i18next-conv` via
`npx`):

```bash
yarn i18n:to-po   sv-se     # src/locale/languages/sv-se.json -> i18n-po/sv-se.po
# …translate i18n-po/sv-se.po in Poedit / Weblate / via DeepL…
yarn i18n:from-po sv-se     # i18n-po/sv-se.po -> sv-se.json
yarn i18n && yarn i18n:validate sv-se
```

### C. Machine pre-translation + human review

Whatever the engine (LLM or MT), treat machine output as a **pre-translation**:
apply a fixed domain glossary, **preserve the tokens**, run `i18n:validate`, and
have a **native speaker review** before merge — that review is the one quality
gate no tool replaces. Swedish (`sv-se`) was bootstrapped this way.

## Connector docs (Markdown)

The per-connector requirement docs under
[`public/locales/`](../../public/locales) are separate from the UI strings.
Most languages ship none and fall back to `en-US` automatically
(`ServiceDocPanel`). To localize a doc, copy the English Markdown to
`public/locales/<lang-COUNTRY>/…` and translate the prose, keeping every
`$$section … $$`, `$$note … $$`, `$(id="…")` directive, code fence and URL
**byte-for-byte** (those drive the form-field mapping). For bulk doc
translation, [`public/locales/po4a.cfg`](../../public/locales/po4a.cfg) is an
opt-in **po4a** template that extracts prose to PO and regenerates the localized
Markdown.
