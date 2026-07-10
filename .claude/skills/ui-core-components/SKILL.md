---
name: ui-core-components
description: Use when writing or editing React/TSX in `openmetadata-ui/src/main/resources/ui/src/` or `openmetadata-ui-core-components/`, before reaching for a raw `<div>` + Tailwind utility classes to build layout (flex rows/columns, grids, bordered panels with header/body/footer, separators), and before writing any Tailwind color class (`tw:bg-*`, `tw:text-*`, `tw:border-*`) or hex color value. Applies whenever the change adds or restructures a layout container or touches color/dark-mode styling, not to every div.
user-invocable: true
argument-hint: "[component name to look up, e.g. Box, Grid, Card, Divider]"
allowed-tools:
  - Read
  - Grep
  - Glob
---

# UI Core Components

`@openmetadata/ui-core-components` ships layout primitives that replace common
`<div className="tw:flex ...">` / `<div className="tw:grid ...">` patterns.
383+ files in `openmetadata-ui` already import from this package. Baseline
testing shows agents default to raw `div` + Tailwind for layout unless told
these exist — check this table before writing layout markup.

## When to use a primitive vs. a raw div

Only **layout container** divs (the ones whose `className` is mostly
`flex`/`grid`/`gap`/`items-*`/`justify-*`/border-as-separator) go through a
primitive. Leave alone: single non-layout divs, text wrappers, spans, icon
wrappers, and anything built from antd/MUI form components — this is not a
"replace every div" rule.

## Quick reference

| Raw pattern | Use instead |
|---|---|
| `<div className="tw:flex ...">` (row) | `<Box>` |
| `<div className="tw:flex tw:flex-col ...">` | `<Box direction="col">` |
| `<div className="tw:grid ...">` with column spans | `<Grid>` + `<Grid.Item span={n} start={n}>` |
| Bordered container with a title/actions row, body, footer row | `<Card>` + `<Card.Header title=.. extra=..>` / `<Card.Content>` / `<Card.Footer>` |
| `<hr>` or `<div className="tw:h-px tw:bg-...">` separator, optionally with a centered label | `<Divider>` (`orientation`, `label`, `labelAlign`) |

Import from the package root:

```tsx
import { Box, Card, Divider, Grid } from '@openmetadata/ui-core-components';
```

## Box

`Box` renders a `flex` (or `inline-flex`) div. Layout goes through props, not
`className`:

- `direction`: `'row' | 'col' | 'row-reverse' | 'col-reverse'` (default row)
- `align`: `'start' | 'center' | 'end' | 'stretch' | 'baseline'`
- `justify`: `'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'`
- `wrap`: `'wrap' | 'nowrap' | 'wrap-reverse'`
- `gap` / `rowGap` / `colGap`: Tailwind spacing scale (`0`–`12`, `14`, `16`...`96`), not raw px
- `inline`: boolean — `inline-flex` instead of `flex`

`className` is still accepted for one-off overrides (margins, borders,
backgrounds) — use it for what isn't a layout-direction/gap concern, not to
re-add `tw:flex`.

Real usage, `openmetadata-ui/src/main/resources/ui/src/components/DomainListing/DomainListPage.tsx:310-342`:

```tsx
<Box direction="col" style={isTreeView ? { height: 'calc(100vh - 80px)' } : {}}>
  <HeaderBreadcrumb items={[...]} />
  {pageHeader}
  <Card style={{ marginBottom: 20 }} variant="elevated">
    <Box
      className="tw:px-6 tw:py-4 tw:border-b tw:border-secondary"
      direction="col"
      gap={4}>
      <Box align="center" direction="row" gap={5}>
        {titleAndCount}
        {search}
        {!isTreeView && quickFilters}
        <Box className="tw:ml-auto" />
        {viewToggle}
        {deleteIconButton}
      </Box>
      {!isTreeView && filterSelectionDisplay}
    </Box>
    {content}
  </Card>
</Box>
```

## Grid / Grid.Item

24-column grid. `Grid` takes `gap`/`rowGap`/`colGap` (scale `0`–`12`).
`Grid.Item` takes `span` (default 24 = full width) and optional `start`
(1-indexed column); both are clamped to the 24-column track.

```tsx
<Grid gap="4">
  <Grid.Item span={16}>{main}</Grid.Item>
  <Grid.Item span={8}>{sidebar}</Grid.Item>
</Grid>
```

## Card

`variant`: `default | elevated | outlined | ghost`. `color`:
`default | brand | brandOutlined | error | warning | success`. `size`:
`sm | md | lg` (controls `Card.Header`/`Card.Content`/`Card.Footer` padding).
`isClickable` / `isSelected` add interactive/selected styling.

```tsx
<Card isClickable variant="elevated">
  <Card.Header extra={<Button>Edit</Button>} subtitle="Updated 2h ago" title="orders" />
  <Card.Content>{body}</Card.Content>
  <Card.Footer>{footerActions}</Card.Footer>
</Card>
```

## Divider

`orientation`: `horizontal | vertical` (default horizontal). `label` +
`labelAlign` (`start | center | end`) render a labeled separator instead of a
plain line.

```tsx
<Divider label="or" labelAlign="center" />
<Divider orientation="vertical" />
```

## Color usage

Never write a raw Tailwind palette class (`tw:bg-gray-50`, `tw:text-red-600`,
`tw:border-blue-500`, ...) or a hardcoded hex value (`style={{ color:
'#1570ef' }}`). Use the semantic color tokens instead — they remap
automatically in dark mode via the `.dark-mode` class, raw palette classes do
not.

**REQUIRED REFERENCE:** read
`openmetadata-ui/src/main/resources/ui/docs/colors.md` before writing or
reviewing any color class — it has the full token table (backgrounds, text,
borders, foreground/icon, utility/badge colors) plus a `dark-gray-red-green`
→ semantic-token cheat sheet. Highlights:

| Raw pattern | Use instead |
|---|---|
| `tw:bg-white` / `tw:bg-gray-50` | `tw:bg-primary` / `tw:bg-secondary` |
| `tw:text-gray-900` / `tw:text-gray-500` | `tw:text-primary` / `tw:text-quaternary` |
| `tw:border-gray-300` | `tw:border-primary` |
| `tw:text-red-600` / `tw:border-red-500` | `tw:text-error-primary` / `tw:border-error` |
| `tw:bg-green-50 tw:text-green-700` (badge) | `tw:bg-utility-success-50 tw:text-utility-success-700` |
| `style={{ color: '#1570ef' }}` | `tw:text-fg-brand-primary` |

Icons use `tw:text-fg-*` tokens, not `tw:text-*` — foreground tokens are
tuned for icon contrast, text tokens aren't.

## Verify

After using these, run the `ui-checkstyle` skill on the changed files before
committing — it lints/formats both `openmetadata-ui` and
`openmetadata-ui-core-components` trees.
