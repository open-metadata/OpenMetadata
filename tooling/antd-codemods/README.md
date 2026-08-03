# antd-codemods

jscodeshift transforms for the antd → ui-core-components migration.
Guides live in `docs/antd-migration/`; each guide names its transform.

## Run a transform

    cd tooling/antd-codemods && yarn install
    npx jscodeshift -t transforms/move-named-imports.js \
      ../../openmetadata-ui/src/main/resources/ui/src/components/SomeArea \
      --parser=tsx --names=Divider --from=antd --to=@openmetadata/ui-core-components

The same transforms run against collate-ui and collate-local-webserver/ui by
pointing the path argument at those repos' `src` folders.

Files a transform cannot fully convert are left untouched; collect them per
sweep with the ledger (`tooling/antd-migration/`) and hand-finish.

## `antd-typography-to-core`

Converts antd `Typography` sub-components (`Text`/`Title`/`Paragraph`/`Link`,
including destructured usages) to the flat core `Typography` component. See
`docs/antd-migration/typography.md` for the full mapping table.

    npx jscodeshift -t transforms/antd-typography-to-core.js \
      <path-to-src> --parser=tsx

Only touches files that import `Typography` from `'antd'`. Elements it can't
mechanically convert (`copyable`, `ellipsis.expandable`, dynamic
`level`/`strong`/`underline`/`type` expressions, bare `<Typography>`, …) are
left untouched and reported via `console.warn`; partially-converted files get
a `CoreTypography`-aliased import alongside the surviving antd one. The
`Typography.Title` `level` → `size` convention (`LEVEL_SIZE_MAP` in the
transform) was approved 2026-07-30.

## `antd-button-to-core.js`

In any file that imports `Button` from `'antd'` (single or double quotes;
sibling named imports like `import { Button, Modal } from 'antd'` are
preserved), and/or imports the legacy default `ButtonGroup` from the antd
subpath (`antd/es/button/button-group` or `antd/lib/button/button-group`).
Mapping rules approved 2026-07-30 — see
`.context/wave1-prep/button-gap-check.md` and the mapping guide
(`docs/antd-migration/button.md`) for the full survey data behind them.

| antd | Core | Notes |
|---|---|---|
| `type="primary"` | `color="primary"` | direct |
| `type="default"` | `color="secondary"` | direct |
| `type="text"` | `color="tertiary"` | direct |
| `type="link"` | `color="link-gray"` | direct |
| no `type` prop at all | `color="secondary"` | antd's implicit default type is `"default"`, which maps to `secondary` — core's own default is `"primary"`, so this must be made explicit rather than omitted |
| `danger` + a base type | folds into `color`: `primary`→`primary-destructive`, `default`→`secondary-destructive`, `text`→`tertiary-destructive`, `link`→`link-destructive` | not a rename — `danger` is dropped, `type` is dropped, `color` carries both |
| bare `danger` (no `type`) | `color="secondary-destructive"` | antd's implicit default type is `"default"` |
| `ghost` (boolean) or `type="ghost"` | `color="tertiary"` | approved 2026-07-30; **always reported via a `converted-with-warnings -> ghost-remap` console.warn** even though the element still converts, so sweep reviewers eyeball every site |
| `size="small"` / `"middle"` / `"large"` | `size="xs"` / `"sm"` / `"md"` | approved 2026-07-30 |
| `size={expr}` (dynamic) | — | skipped, see below |
| `disabled` (bare or `={expr}`) | `isDisabled` | rename, same form |
| `loading` (bare or `={expr}`) | `isLoading` | rename, same form |
| `loading={{ delay }}` (object) | — | skipped, see below |
| `icon={...}` (any value form) | `iconLeading={...}` | rename |
| `htmlType="X"` | native `type="X"` | processed **after** the visual `type`→`color` rewrite on the same element so the two never collide (core's `type` is the native HTML type, the inverse of antd's meaning) |
| `block` | merged into `className` as `tw:w-full` (creates `className` if absent) | needs visual QA per the mapping guide |
| `shape="circle"` / `"round"` | — | skipped, see below |
| `Button.Group` | — | skipped, see below |
| `ButtonGroup` (subpath import) | — | skipped, see below; the subpath import itself is never touched |
| `ref={...}` | unchanged | kept as-is — core `Button` is `forwardRef`-wrapped |
| `href` / `target` / `onClick` / `className` / `data-testid` / `style` / `autoFocus` / `title` | unchanged | native passthrough |

### Deliberate skips (left as antd, reported via `console.warn`)

Same convention as the Typography transform: when an element is skipped,
the **whole element** is left completely untouched — still antd — and a
single line is printed per file listing every skip, e.g.:

    [antd-button-to-core] src/components/Foo.tsx: needs hand-finish -> Button(shape-unsupported), Button.Group(button-group)

Skip categories:

- **`shape="circle"` / `shape="round"`** — `shape-unsupported`. Core's
  icon-only auto-detection gives a rounded square, never a true circle or
  pill — no mechanical equivalent for either value.
- **`type={expr}`** (dynamic, non-literal) — `dynamic-type`.
- **`type="..."` with a value outside `primary`/`default`/`text`/`link`/`ghost`**
  (e.g. the unused `dashed`) — `unsupported-type`.
- **`ghost={expr}`** where `expr` isn't a literal boolean — `dynamic-ghost`.
- **`danger={expr}`** where `expr` isn't a literal boolean —
  `dynamic-danger`.
- **`size={expr}`** (dynamic, non-literal) — `dynamic-size`. 48 combined
  occurrences across repos per the gap-check survey — the single largest
  hand-finish category.
- **`size="..."` with a value outside `small`/`middle`/`large`** —
  `unsupported-size`.
- **`loading={{ delay }}`** (object/debounce form) — `loading-object`.
  Unused in practice, but no core equivalent, so hand-finish rather than
  guess.
- **`block` combined with a non-literal `className`** (e.g.
  `className={someVar}`) — `dynamic-classname`. The transform can only
  safely merge `tw:w-full` into a string literal.
- **`Button.Group`** (member expression off the antd `Button` import) —
  `button-group`. Core `ButtonGroup` is a single-select toggle group;
  antd's legacy usage groups independent action buttons — semantic
  mismatch, redesign per site as a flex row of `Button`s.
- **`ButtonGroup` from the `antd/{es,lib}/button/button-group` subpath
  default import** — `button-group-subpath`. Reported the same way; the
  subpath import declaration itself is never modified, only warned about.

A **`ghost`/`type="ghost"` element is not a skip** — it converts to
`color="tertiary"` and is separately flagged via a
`converted-with-warnings -> ghost-remap` warning, distinct from the
hand-finish skip line, since the mapping is approved and mechanical but
still worth a reviewer's eyes per site.

### Partial-conversion files

If a file has at least one skipped `Button`/`Button.Group` element, the
antd `Button` import **stays**, and the transform adds a second import
aliasing the core component to avoid a name collision:

    import { Button } from 'antd';
    import { Button as CoreButton } from '@openmetadata/ui-core-components';

Converted elements in that file use `<CoreButton>`; skipped elements keep
using `<Button>` (antd). Only when **every** `Button`/`Button.Group` usage
in the file converts does the transform remove `Button` from the antd
import (dropping the import entirely if it becomes empty, or merging into
an existing `@openmetadata/ui-core-components` import if one is already
present) and emit plain `<Button>` / `import { Button } from
'@openmetadata/ui-core-components'`.

Skipped `ButtonGroup`-subpath elements do **not** affect this decision —
that subpath import is entirely independent of the antd `Button` import
and is never touched either way.

Leading file comments (license headers) are preserved when the antd import
is fully removed, following the same comment re-homing logic as
`move-named-imports.js`.

### Known limitations / follow-ups

- `icon={<Icon component={Svg} />}` is renamed to `iconLeading={<Icon
  component={Svg} />}` verbatim — the transform does **not** unwrap the
  antd `Icon`/`component` wrapper down to the bare `Svg`, even though core
  accepts the bare `FC<{className}>` form directly. Left as a manual
  simplification per the mapping guide.
- `shape="circle"`/`"round"`, `Button.Group`, and the `ButtonGroup` subpath
  are permanent gaps (no mechanical core equivalent), not pending
  ui-core-components work — see the mapping guide's "No direct
  equivalent" table for the by-hand replacement pattern for each.
- Border-override `className` drift (any carried-over class targeting
  border/shadow/ring color) is **not** detected or rewritten by this
  transform — per the mapping guide, those must be re-pointed at
  `tw:after:outline-*` by hand during the sweep review, since a
  `tw:ring-*`/`tw:outline-*` string is indistinguishable from any other
  className token at the AST level.

## Tests

    yarn test
