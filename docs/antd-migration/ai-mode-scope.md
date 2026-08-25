# Scoping the sweep to AI mode

The AI-mode pages under `collate-ui/.../plugins/ai-chat` are being moved into
OSS, with Classic and AI both shipping. This narrows the antd migration from
"the whole UI" to "everything AI mode can reach" — a smaller, shippable
boundary that maps to something demonstrable.

## Measured surface

The plugin is already almost entirely migrated. The debt is in the OSS
components it reaches through.

| | count |
|---|---|
| ai-chat files | 732 |
| …importing antd directly | **18** |
| …already importing `ui-core-components` | 361 |
| distinct OSS modules imported by ai-chat | 341 |
| OSS files reachable transitively | 941 |
| …importing antd | **138** |

**Total in scope: ~156 files** (18 plugin + 138 OSS), against ~1,600 sites for
the unscoped sweep.

### By import depth from the plugin

| depth | files | meaning |
|---|---|---|
| 1 | 30 | imported directly by ai-chat |
| 2 | 42 | one hop further |
| 3 | 24 | |
| 4 | 17 | |
| 5 | 15 | |
| 6 | 10 | deep shared internals |

### By area

`components/common` dominates at **46** files — the shared layer, reached from
almost every page. `BlockEditor` 10, `ActivityFeed` 8, `MyData` 6, then a tail.

### Components involved

The depth-1 tranche is led by `Space` (13), `Col` (13), `Row` (13),
`Tooltip` (10), `Card` (6) — the same layout and display primitives the
existing codemods already target. No new mapping work is needed to start.

## The caveat that matters

**"Selective by page" is not selective at the component level.**

`components/common` is 46 of the 138. Those files — `Table`, `ProfilePicture`,
`NextPrevious`, `EditIconButton`, `TagsViewer` — are reached from Classic too.
Migrating one for an AI page changes Classic in the same commit.

So the real boundary is *"components reachable from AI mode"*, not *"AI pages"*.
Anyone reviewing on the assumption that Classic is untouched will be wrong.
Classic needs the same visual verification as AI for anything under
`components/common`.

## Tranches

**Tranche A — plugin + depth 1 (48 files).** Self-contained and reviewable.
Clears the plugin's own 18 and its direct dependencies. Ships as one PR.

**Tranche B — depth 2–3 (66 files).** The next ring. Still mostly shared
components; same codemods.

**Tranche C — depth 4–6 (42 files).** Deep internals, lowest traffic. Best
handled opportunistically by whoever is already in that code.

## Per-page migration protocol

A developer moving a page (e.g. `myData`) also clears its antd. Three
requirements, because this migration has repeatedly produced changes that look
correct in review and are wrong on screen:

1. **Run the codemods; do not hand-edit.** `tooling/antd-codemods/` has tested
   transforms for `Typography`, `Button`, and `Row`/`Col`/`Space`, including the
   skip categories where conversion is not mechanical. Hand-rolling reinvents
   bugs that are already solved — see below.
2. **Capture a visual-regression baseline before and after.** This is the only
   check that catches layout drift. Baselines come from CI artifacts, never a
   local dev server (`docs/antd-migration/README.md`).
3. **Check the ledger.** `node tooling/antd-migration/ledger.mjs` makes "is this
   page antd-free" measurable rather than asserted.

### Why the guard rails exist

Every silent defect in this migration was invisible to both jest and code
review, and surfaced only through CI, a browser probe, or a bot comment:

- **`div.prose` block wrapper** — core `Typography` wrapped everything in a
  block `<div>`, turning inline text into block elements and producing invalid
  `<div>`-inside-`<span>` nesting.
- **`data-icon` zero-sized icons** — icons passed as elements got no sizing at
  all. Measured in Chrome: 36×36 with the fix, 16×16 with a 0×0 icon without.
  Would have shipped invisible edit buttons across the product.
- **`Space direction={expr}`** — a codemod that could not resolve the value fell
  through to the horizontal default, silently flipping a vertical layout.

jsdom computes no layout, so 13,642 passing tests said nothing about any of
them. Assume the same of any hand migration.

## Out of scope

- **`Form` and `Table`** — handed to individual teams. `Form` transitively
  blocks ~217 field usages (`Input`, `Select`, …) because `Form.Item` injects
  `value`/`onChange` and needs antd-compatible children.
- **QueryBuilder** — owned by #29849.
- **`.ant-*` CSS.** Component sweeps do not remove it. **2103** occurrences
  upstream. Until that is gone the antd package cannot be dropped, whatever the
  component counts say.
