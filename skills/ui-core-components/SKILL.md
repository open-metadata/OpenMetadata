---
name: ui-core-components
description: Use when writing or editing React/TSX in `openmetadata-ui/src/main/resources/ui/src/` or `openmetadata-ui-core-components/`, before creating any new UI component (it lists every core component by job), before reaching for a raw `<div>` + Tailwind utility classes to build layout (flex rows/columns, grids, bordered panels with header/body/footer, separators), and before writing any Tailwind color class (`tw:bg-*`, `tw:text-*`, `tw:border-*`) or hex color value. Applies whenever the change adds or restructures a layout container or touches color/dark-mode styling, not to every div.
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
wrappers, and anything built from antd/other external library form components — this is not a
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

## Components by job — check here before creating any component

Everything below is exported from `@openmetadata/ui-core-components`; the full list is
`openmetadata-ui-core-components/src/main/resources/ui/src/components/index.ts` and each has a
story under `src/stories/`. If one fits, use it with its own props. If it almost fits, add the
prop in core (own PR) — never a feature-local copy or a wrapper that only forwards props.

**Layout and text**
- `Box` — flex row/column (`direction`, `align`, `justify`, `gap`, `wrap`); layout only.
- `Grid` + `Grid.Item` — grid (`gap`/`rowGap`/`colGap`, `span`, `start`); layout only.
- `Card` (`.Header` `title`/`extra`, `.Content`, `.Footer`) — any bordered or coloured panel; inside a
  `bg-surface` panel, modal or drawer use `variant="muted"`/`"tile"` (ADR:2026-11-05-nested-cards-sit-one-step-off-their-panel).
- `Typography` — all text; `as="h1"…"h6"|"p"` for semantics, `size`, `weight`, `color`, `ellipsis`.
- `Divider` — separator line. `ScrollShadow` — horizontal scroller with edge shadows.
- `PageLayout` (`.Header`, `.PageHeader`, `.Content`, side panels) — every page's shell;
  `PageLayout.PageHeader` is the page title + breadcrumb + actions. `Breadcrumbs` — trail.
- `FeaturedIcon` — icon in a coloured circle/square. `Dot` — small status dot.

**Actions**
- `Button` — every text button and link button (`color`, `size`, `iconLeading`, `isLoading`, `href`).
- `ButtonUtility` — icon-only action (carries its tooltip). `CloseButton` — the X.
- `ButtonGroup` + `ButtonGroupItem` — segmented choice between a few options.
- `Dropdown` (`.Root`, `.Popover`, `.Menu`, `.Item`, `.Section`, `.DotsButton`) — action / ⋯ menus.
- `ConfirmPopover` — inline "are you sure?" anchored to its trigger.
- `FileTrigger` — opens the file picker from any pressable.

**Inputs and forms**
- `Input`, `TextArea`, `NumberInput`, `PasswordInput` — text entry with `label`, `hint`, `tooltip`,
  validation; `InputGroup` adds prefix/suffix add-ons; `Label`/`HintText` for custom fields.
- Choosing: `Select` (one; `Select.ComboBox` when the list needs search), `MultiSelect` (several,
  as tags), `Autocomplete` (type-ahead that inserts items), `TagSelect` (options as tags),
  `TreeSelect` (hierarchy), `NativeSelect` (native `<select>`, e.g. short fixed lists).
- `Checkbox`, `RadioGroup` + `RadioButton`, `Toggle` (on/off; `label`, `hint`, `isReadOnly`), `Slider`.
- `DatePicker`, `DateRangePicker` (with presets), `TimePicker`.
- `Form` (react-aria validation), `HookForm` + `FormField` (react-hook-form), `FormFields`/`Field`
  (render `FieldProp` definitions); `FieldDocPanel`/`FieldDocPopover` show a field's docs;
  `CredentialFileInput`, `FileUploadDropZone` for files.

**Overlays**
- `Dialog` (`.Header`, `.Content`, `.Footer`; `dividers="scroll"`) inside `Modal`/`ModalOverlay`,
  opened by `DialogTrigger` — any modal. `SimpleModal` — title + body + OK/Cancel only.
- `SlideoutMenu` (`.Header`, `.Content`, `.Footer`) — side drawer.
- `Popover` — floating panel on a trigger. `HoverCard` — rich preview on hover.
- `Tooltip` — hover/focus hint on anything (never a raw `title=`).
- `showToast` / `toast` + one `ToastProvider` — notifications.

**Data display and navigation**
- `Tabs` (`.List`, `.Item`, `.Panel`). `Table` (`.Header`, `.Head`, `.Body`, `.Row`, `.Cell`); `TableCard`.
- `Tree` — hierarchy with expand, drag and load-more. `Accordion` — expandable sections.
- `Pagination*` variants — page navigation. `ProgressSteps` — multi-step flow.
- `FilterBar` (`.Root`, `.FilterRow`, `.Content`, `.Actions`) + `FilterSelect` — filter toolbars.

**Status and feedback**
- `Alert` — inline info/warning/error/success banner.
- `Badge` (`type`, `color`, `size`), `BadgeWithDot`, `BadgeWithIcon`, `BadgeGroup` — status/label chips.
- `Tag`/`TagGroup` — removable or selectable tags. Entity chips: `ClassificationTag`, `GlossaryTag`,
  `DomainTag`, `DataProductTag`, `MetricTag`, `AutoClassificationTag`.
- `Avatar`, `AvatarStack`, `AvatarLabelGroup`; `Owner`, `OwnerChip`, `OwnerAvatarStack` — people/owners.
- `Skeleton`/`SkeletonParagraph` — loading that keeps layout. `ProgressBar`, `ProgressBarCircle`,
  `RunHistoryBar` — progress and run status.
- `EmptyPlaceholder` — empty/error/no-access state; in `openmetadata-ui` use the
  `src/components/common/EmptyPlaceholder/` wrappers.

Adding a component to core? Add its line here in the same PR.

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

`variant`: `default | elevated | outlined | ghost | muted`. `color`:
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

## Dialog dividers

New modals pass `dividers="scroll"`: no divider under the title, and a footer divider only while
`Dialog.Content` overflows (it appears when the form scrolls, never on a short confirmation).
Never add your own border or `<Divider>` around a dialog's header or footer.

```tsx
<Dialog dividers="scroll" title={t('label.add-entity', { entity })} onClose={onClose}>
  <Dialog.Content>{form}</Dialog.Content>
  <Dialog.Footer>{actions}</Dialog.Footer>
</Dialog>
```

## Empty states

Use the prefilled variants from `src/components/common/EmptyPlaceholder/`, not the core
`EmptyPlaceholder`: `NoDataPlaceholder`, `CreatePlaceholder` (falls back to
`PermissionPlaceholder` when `permission={false}`), `PermissionPlaceholder`,
`NoSearchResultsPlaceholder`, `NoFilteredResultsPlaceholder` (`onClearFilters`),
`SomethingWentWrongPlaceholder` (`onReload`) carry a default icon and copy. `FeaturesPlaceholder`
(onboarding) has no defaults: pass `title`, `description` and `features`. The placeholder is
absolutely positioned, so give the host `tw:relative` and a height. Keep the default icon, and pass plain copy
(a `Transi18next` link is fine) — a `Tooltip` around `title`/`description` pins it to `w-max` and
the text overflows instead of wrapping.

```tsx
<div className="tw:relative tw:min-h-60">
  <NoDataPlaceholder title={t('message.no-data-available')} />
</div>
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
| `tw:bg-white` on a card/panel on the page | `<Card>` or `tw:bg-surface` — never `tw:bg-primary`, the page colour in dark mode (the card disappears) |
| `tw:bg-white` on a card inside a `bg-surface` panel, modal or drawer | `<Card variant="muted">`/`"tile"` — a default card is the same colour as its container in dark (ADR:2026-11-05-nested-cards-sit-one-step-off-their-panel) |
| `tw:bg-white` on the page / a modal or drawer / a popover or menu | `tw:bg-page` / `tw:bg-overlay-surface` / `tw:bg-floating` |
| `tw:bg-gray-50` (subtle fill) | `tw:bg-secondary` |
| `tw:text-gray-900` / `tw:text-gray-500` | `tw:text-primary` / `tw:text-tertiary` (`quaternary` only for de-emphasised text) |
| `tw:border-gray-300` | `tw:border-primary` |
| `tw:text-red-600` / `tw:border-red-500` | `tw:text-error-primary` / `tw:border-error` |
| `tw:bg-green-50 tw:text-green-700` (badge) | `tw:bg-utility-success-50 tw:text-utility-success-700` |
| `style={{ color: '#1570ef' }}` | `tw:text-fg-brand-primary` |

Icons use `tw:text-fg-*` tokens, not `tw:text-*` — foreground tokens are
tuned for icon contrast, text tokens aren't. Text colour on `Typography` is its
`color` prop, not a class: `color="secondary"` renders `tw:text-tertiary`, and
`quaternary`/`success`/`warning`/`danger`/`brand` map the same way. `Box` and
`Grid` are layout only — never give them a background or border. The surface
rules are in `.claude/rules/frontend-styling.md` (Dark mode section).

## Verify

After using these, run the `ui-checkstyle` skill on the changed files before
committing — it lints/formats both `openmetadata-ui` and
`openmetadata-ui-core-components` trees.
