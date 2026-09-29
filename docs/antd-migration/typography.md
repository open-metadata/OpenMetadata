# antd `Typography` → `Typography` mapping guide

**Sweep status:** ledger row `Typography` (openmetadata-ui 422, collate-ui 67,
collate-local-webserver 22 — per `docs/antd-migration/LEDGER.md`)
**Core component:** `@openmetadata/ui-core-components` →
`components/foundations/typography` (single flat export, no `.Text`/`.Title`/
`.Paragraph`/`.Link` namespace)
**Codemod:** `tooling/antd-codemods/transforms/antd-typography-to-core.js`

## Import

| Before | After |
|---|---|
| `import { Typography } from 'antd';` | `import { Typography } from '@openmetadata/ui-core-components';` |
| `const { Text, Title } = Typography;` (destructured, incl. inside jest mocks) | rewritten in place to the member-expression form, then removed once every covered usage converts |
| `import { ParagraphProps } from 'antd/lib/typography/Paragraph';` (type-only subpath, 2 files total) | out of scope for this codemod — handle by hand or with `move-named-imports.js` |

## Prop mapping

| antd prop (as used in repo) | core equivalent | notes |
|---|---|---|
| `<Typography.Text>` | `<Typography>` (`as="span"` is the default) | mechanical |
| `<Typography.Paragraph>` | `<Typography as="p">` | mechanical |
| `<Typography.Link>` | `<Typography as="a">` | mechanical; verify `href`/`target` passthrough at each site |
| `<Typography.Title level={N}>` | `<Typography as="hN" size={LEVEL_SIZE_MAP[N]}>` | **see LEVEL_SIZE_MAP below — approved 2026-07-30** |
| `type="secondary"` / `"success"` / `"warning"` / `"danger"` | `color="secondary"` / `"success"` / `"warning"` / `"danger"` | core `color` prop landed in main — safe to run the bulk sweep against `type="..."` sites |
| `strong` | `weight="bold"` | codemod applies this only for literal `strong`/`strong={true}`; dynamic `strong={expr}` is a skip |
| `underline` | `className` gets `tw:underline` appended (creates `className` if absent) | mechanical workaround, only when `className` is absent or a plain string literal |
| `ellipsis` (boolean) | `ellipsis` (boolean) | 1:1, identical shape |
| `ellipsis={{ rows, tooltip }}` | `ellipsis={{ rows, tooltip }}` | 1:1, identical shape |
| `className` / `style` / `onClick` / `title` / `data-testid` / any other prop | unchanged | passthrough |

### `LEVEL_SIZE_MAP` — approved 2026-07-30

Antd's `Title` `level` (1–5) has no size concept of its own. This is the
convention baked into the codemod (see
`transforms/antd-typography-to-core.js`), **approved as proposed on
2026-07-30**:

| level | `as` | `size` |
|---|---|---|
| 1 | `h1` | `display-sm` |
| 2 | `h2` | `display-xs` |
| 3 | `h3` | `text-xl` |
| 4 | `h4` | `text-lg` |
| 5 | `h5` | `text-md` |

Level 5 dominates real usage (>70% across all three repos — R1: 45/55, R2:
11/14, R3: 5/8) and maps to `text-md`, the closest visual match to antd's
smallest heading variant. A `<Typography.Title>` with no `level` attribute
uses antd's own default, level 1. `level={expr}` (dynamic, non-literal) is
always a skip — the size lookup needs a known level at codemod time.

## No direct equivalent — do this instead

| antd usage | replacement pattern |
|---|---|
| `copyable` (boolean or object) | HARD GAP — no copy-to-clipboard affordance on core `Typography`. Pair with a `CopyButton`/`ButtonUtility` (clipboard icon) at the call site, or leave as antd pending a feature addition. 2 sites, both `AppLogsViewer/ReindexFailures.component.tsx` (lines 108, 134) |
| `ellipsis={{ expandable, symbol, onExpand }}` | HARD GAP — show-more/less UX not supported. Hand-migrate with local expand/collapse state, or defer. 1 site: `AppLogsViewer/ReindexFailures.component.tsx:136` |
| `code` | `as="code"` plus manual styling (no semantic prop). 1 site: `components/Settings/Alerts/AlertsDetails/AlertDetails.component.tsx:109` |
| `keyboard` | custom `<kbd>` element with manual styling. 1 site: `collate-local-webserver/ui/src/pages/DownloadPage.tsx:163` |
| dynamic `Title level={expr}` | hand-pick the `as`/`size` pair once the runtime value is known, using the `LEVEL_SIZE_MAP` table above as the starting point |
| bare `<Typography>` (no sub-component) | codemod deliberately leaves this untouched — antd's bare form renders an `<article>` wrapper with different semantics than core's default `span`; verify the intended element and convert by hand |
| `mark` / `disabled` / `editable` / `italic` / `delete` | zero real usage across all three repos — out of scope, do not build a mapping |

## Before / after examples

**1. `type="secondary"` → `color` (mechanical, `color` prop landed in main)**
`utils/EntityVersionUtils.tsx:235`

```tsx
// Before
<Typography.Text type="secondary">
  {t('label.no-parameter-available')}
</Typography.Text>

// After
<Typography color="secondary">
  {t('label.no-parameter-available')}
</Typography>
```

**2. `Title level={5}` → `as`/`size` lookup (mechanical, uses `LEVEL_SIZE_MAP`)**
`collate-local-webserver/ui/src/pages/DownloadPage.tsx:157`

```tsx
// Before
<Typography.Title level={5}>Next steps</Typography.Title>

// After
<Typography as="h5" size="text-md">
  Next steps
</Typography>
```

**3. `strong` + `className` (mechanical)**
`components/AppBar/Suggestions.tsx:415`

```tsx
// Before
<Typography.Text strong className="m-b-sm d-block">
  {t('label.ai-queries')}
</Typography.Text>

// After
<Typography weight="bold" className="m-b-sm d-block">
  {t('label.ai-queries')}
</Typography>
```

**4. Hand-finish / partial-conversion file: `copyable` + `ellipsis.expandable` (hard gaps, `CoreTypography` alias)**
`components/AppLogsViewer/ReindexFailures.component.tsx:100-140` mixes
convertible and non-convertible `Typography` usages in the same file. The
codemod converts what it can and keeps the antd import alive for what it
can't, aliasing the core import to avoid a name collision:

```tsx
// Before
import { Tooltip, Typography } from 'antd';
...
<Typography.Text className="font-medium">{text}</Typography.Text>
...
<Typography.Text copyable={Boolean(text)}>{text || '-'}</Typography.Text>
...
<Typography.Paragraph
  copyable
  className="m-b-0"
  ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
  {text}
</Typography.Paragraph>

// After (partial conversion)
import { Tooltip, Typography } from 'antd';
import { Typography as CoreTypography } from '@openmetadata/ui-core-components';
...
<CoreTypography className="font-medium">{text}</CoreTypography>
...
{/* copyable has no core equivalent — left on antd Typography, hand-finish: pair with a CopyButton */}
<Typography.Text copyable={Boolean(text)}>{text || '-'}</Typography.Text>
...
{/* ellipsis.expandable has no core equivalent — left on antd Typography, hand-finish */}
<Typography.Paragraph
  copyable
  className="m-b-0"
  ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
  {text}
</Typography.Paragraph>
```

Once every skipped/bare usage in a file is eventually hand-finished (or
removed), drop the antd `Typography` import and rename `CoreTypography` back
to plain `Typography`.

## DOM-wrapper visual-QA warning

Core `Typography` **always renders content inside `div.prose`** (or
`Tooltip` + `div.prose`, when `ellipsis.tooltip` is set) around the `as`
element — a structural difference from antd's single-element render. CSS
selectors and flex/grid layouts that expect a single inline element (e.g.
`.parent > span`, flex children relying on `display: inline`) may break at
any converted call site. **Every converted call site carries layout-regression
risk** — run the visual-QA harness (baselines under the collate visual-
regression project) on the affected pages before merging each sweep PR, not
just spot-checking a sample.

## Hand-finish punch list (do not block the bulk codemod run on these)

- **`copyable`** — 2 sites (`ReindexFailures.component.tsx:108`, `:134`)
- **`ellipsis.expandable`** — 1 site (`ReindexFailures.component.tsx:136`)
- **`code`** — 1 site (`AlertDetails.component.tsx:109`)
- **`keyboard`** — 1 site (`DownloadPage.tsx:163`)
- **Dynamic `Title level={expr}`** — flagged by the codemod at runtime via
  `console.warn(... dynamic-title-level)`; triage per-file, no fixed count
  captured in the gap-check survey
- **`strong={expr}` / `underline={expr}` with non-literal values** — codemod
  skips these (`dynamic-strong` / `dynamic-underline`); resolve the runtime
  value and hand-convert
- **`type={expr}`, or `type="..."` outside `secondary`/`success`/`warning`/`danger`** — skipped as `unsupported-type`

## CSS to delete with this sweep

Once a directory's `Typography` usages are fully converted, grep for
orphaned `.ant-typography` overrides before deleting:

```bash
grep -rn "\.ant-typography" --include="*.less" --include="*.css" src/
```

Also check for component-scoped `.less` files whose only purpose was
overriding antd Typography chrome (e.g. link-color or heading-margin
resets) — delete once knip/grep confirms no remaining `.ant-typography`
consumers in that directory. Only delete CSS proven dead by grep/knip, not
by inspection alone.

**Sweep-PR checklist line:** after each chunked PR, regenerate the ledger
(`tooling/antd-migration/ledger.mjs`) so the `Typography` row in
`docs/antd-migration/LEDGER.md` reflects the reduced antd usage count.

## Styling rules (apply in every PR of this sweep)

- Semantic Tailwind tokens only (`tw:text-tertiary`, `tw:bg-primary`) — never
  raw palette classes or hex, including for the `color`-prop-adjacent
  `tw:underline`/className workarounds above.
- No `tw:ring-*` — this component doesn't render a border, but any wrapper
  `className` added during migration must still follow `border`/`outline`,
  not `ring` (see upstream `docs/colors.md` §2.3.1).
- No string literals — use `t('label.…')` / `t('message.…')`, checking both
  `collate-ui/src/main/resources/ui/src/locale/languages/en-us.json` and the
  OpenMetadata submodule's `en-us.json` for an existing key before adding a
  new one.
