# antd → ui-core-components: plan

Supersedes the wave-based plan. Scope is now **AI-mode-first**, across **OSS**
and **Collate** only.

## Out of scope

| | owner |
|---|---|
| `Table` family | separate team |
| `Form` family | separate team |
| `local-webserver` | separate track |
| QueryBuilder | #29849 |

`Form` matters more than its own count: `Form.Item` injects `value`/`onChange`
into its child and needs an antd-compatible component, which transitively blocks
**~217** field usages (`Input`, `Select`, `Checkbox`, `Radio`, `Switch`,
`InputNumber`, `DatePicker`). Those move with `Form`, not with this plan.

## Where things stand

**Done and merged to `antd-migration/wave-1`:**

| | before | after |
|---|---|---|
| OSS `Typography` | 442 | **0** |
| OSS `Button` | 310 | **0** |

**Current surface:**

| | files w/ antd | `.ant-*` in CSS |
|---|---|---|
| OSS (post wave-1) | 770 | 2025 |
| collate-ui | 157 | 348 |

Collate's 157 still includes `Typography` 67 and `Button` 43 — its sweeps exist
but are unmerged (#5428 draft; Button is WIP on `antd-migration/collate-button`).

## Why AI-mode-first

The revamped pages under `collate-ui/.../plugins/ai-chat` are moving to OSS,
with Classic and AI both shipping. Scoping to what AI mode can reach gives a
boundary that is smaller, shippable, and demonstrable — instead of a
1,600-site sweep with no natural stopping point.

The plugin is already ~97% migrated: **18 of 732** files import antd, 361
already use core. The debt is in the OSS components it reaches through:
**138** of the 941 reachable files.

**Total AI-mode scope: ~156 files.**

By depth from the plugin: 30 / 42 / 24 / 17 / 15 / 10.

### The caveat

`components/common` is **46 of the 138** — `Table`, `ProfilePicture`,
`NextPrevious`, `EditIconButton`, `TagsViewer`. These are reached from Classic
too, so migrating one for an AI page changes Classic in the same commit.

The boundary is *"components reachable from AI mode"*, not *"AI pages"*.
Classic needs the same visual verification for anything under
`components/common`. Reviewers assuming otherwise will be wrong.

## Sequence

**1 — Tranche A: plugin + depth 1 (48 files).** Self-contained, one PR.
**2 — Tranche B: depth 2–3 (66 files).** Next ring, same codemods.
**3 — Tranche C: depth 4–6 (42 files).** Deep internals, opportunistic.
**4 — Collate** follows the same tranching once its Typography/Button land.
**5 — CSS.** Separate and last; see below.

## Per-page migration protocol

A developer moving a page also clears its antd, subject to three requirements:

1. **Run the codemods, don't hand-edit.** `tooling/antd-codemods/` has tested
   transforms for `Typography`, `Button`, `Row`/`Col`/`Space`, plus
   `core-mock-require-actual` for test mocks. They encode skip categories where
   conversion is not mechanical.
2. **Visual-regression baseline before and after.** The only check that catches
   layout drift. Baselines come from CI artifacts, never a local dev server.
3. **Check the ledger.** `node tooling/antd-migration/ledger.mjs` makes
   "antd-free" measurable rather than asserted.

### Why these are not optional

Every silent defect so far was invisible to jest *and* to code review, and
surfaced only via CI, a browser probe, or a bot comment:

- **`div.prose` block wrapper** — core `Typography` wrapped output in a block
  `<div>`, turning inline text into block elements and producing invalid
  `<div>`-in-`<span>` nesting.
- **`data-icon` zero-sized icons** — icons passed as elements got no sizing.
  Measured in Chrome: 36×36 fixed, 16×16 with a 0×0 icon. Would have shipped
  invisible edit buttons product-wide.
- **`Space direction={expr}`** — a codemod that could not resolve the value fell
  through to horizontal, silently flipping a vertical layout.
- **`InlineEdit` precedence** — converted props emitted after the spread,
  clobbering caller overrides.

jsdom computes no layout; 13,642 passing tests said nothing about any of them.

## Known blockers

- **#30941** — bulk edit silently drops tags. Real data loss, from the Button
  sweep. Must close before wave-1 reaches main.
- **`add-team-form` visual baseline** — the harness fix is on wave-1 but the CI
  actual was never adopted, so wave-1 and its children are red.
- **Layout codemod** — parked. Core `Box` is always a flex container, so
  mapping `Col` → `Box` makes every column a flex container when antd's `Col`
  is a flex *item*. Needs rework before re-sweeping.

## Component usage

In-scope counts, `Table`/`Form` families excluded.

### OSS (post wave-1, 770 files)

| component | count | codemod |
|---|---|---|
| `Col` | 281 | built, needs `Box` rework |
| `Row` | 279 | built, needs `Box` rework |
| `Space` | 241 | built, needs `Box` rework |
| `Tooltip` | 149 | — |
| `Card` | 114 | — |
| `Input` | 80 | blocked by `Form` |
| `Select` | 71 | blocked by `Form` |
| `Tabs` | 68 | — |
| `Modal` | 60 | — |
| `Divider` | 54 | — |
| `Skeleton` | 51 | — |
| `Dropdown` | 41 | — |
| `Switch` | 36 | blocked by `Form` |
| `Tag` | 32 | — |

Excluded: Table-family 15, Form-family 146.

### collate-ui (157 files)

| component | count |
|---|---|
| `Typography` | 67 (sweep unmerged, #5428) |
| `Button` | 43 (WIP branch) |
| `Col` | 40 |
| `Row` | 38 |
| `Form` | 37 (out of scope) |
| `Card` | 29 |
| `Space` | 24 |
| `Input` | 13 |
| `Divider` | 13 |
| `Select` | 12 |

### AI-mode depth-1 tranche (30 OSS files)

`Space` 13, `Col` 13, `Row` 13, `Tooltip` 10, `Card` 6, `Dropdown` 5,
`Popover` 4, `Divider` 4.

Entirely layout and display primitives — the codemods already target these, so
Tranche A needs no new mapping work.

## The number that actually gates removal

**`.ant-*` selectors: 2025 in OSS, 348 in collate-ui.**

Component sweeps do not touch them. Until they are gone the antd package cannot
be dropped, regardless of what the component counts say. This is the largest
single remaining piece of work and it has not started.
