# Table

## Metadata

| | |
| --- | --- |
| **Name** | Table |
| **Category** | Application |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Table` (+ `TableCard`) |
| **Source** | [`components/application/table`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/application/table) |

Go-forward (UntitledUI + Tailwind, `tw:` only). Legacy spec: [../components/table.md](../components/table.md).

## Overview

**Use when** presenting rows of structured records the user scans, sorts, or
selects — entity lists, columns, test results, ingestion runs.

**Don't use when** showing a handful of key/value pairs (use a description
list) — a table implies columnar, comparable data.

## Anatomy

```
┌─ TableCard.Root ──────────────────────────────┐
│ Title [badge]                    contentTrailing│ ← TableCard.Header
├───────────────────────────────────────────────┤
│ [✓] Name ▲    Type      Owner            ⋯     │ ← Table.Header / Table.Head
│ [✓] orders    table     data-eng         ⋯     │ ← Table.Row / Table.Cell
│ [ ] customers table     analytics        ⋯     │
└───────────────────────────────────────────────┘
```

Parts: **`TableCard.Root`** / **`TableCard.Header`** wrapper, **`Table.Header`**
+ sortable **`Table.Head`**, **`Table.Body`** + **`Table.Row`** + **`Table.Cell`**,
optional selection checkbox column, **`TableRowActionsDropdown`**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Card surface | `tw:bg-primary` `tw:rounded-xl` `tw:shadow-xs` `tw:outline-1 tw:outline-secondary` |
| Header row | `tw:bg-secondary` `tw:h-9`(sm)/`tw:h-11`(md) |
| Header label | `tw:text-xs` `tw:font-semibold` `tw:text-quaternary` |
| Row / cell divider | `tw:after:bg-border-secondary` (pseudo, no layout) |
| Row hover / selected | `tw:hover:bg-secondary` / `tw:selected:bg-secondary` |
| Cell text | `tw:text-sm` `tw:text-tertiary` `tw:px-6 tw:py-4`(md) |
| Sort icon | `tw:text-fg-quaternary` |
| Focus ring | `tw:focus-visible:outline-2 tw:-outline-offset-2 tw:outline-focus-ring` |

## Props / API

| Member / prop | Purpose |
| --- | --- |
| `Table` | Root; `size` `sm`/`md`, `stickyHeader`, `selectionMode`, `sortDescriptor`, `onSortChange` |
| `Table.Header` | Header row; `columns`, `bordered` (default `true`) |
| `Table.Head` | Column; `label`, `tooltip`, `allowsSorting`, `id` |
| `Table.Body` / `Table.Row` / `Table.Cell` | Body rows/cells; `Row` has `highlightSelectedRow` (default `true`) |
| `TableCard.Root` / `TableCard.Header` | Card surface; `title`, `badge`, `description`, `contentTrailing` |
| `TableRowActionsDropdown` | Per-row actions (Edit / Copy / Delete) |

## States

| State | Treatment |
| --- | --- |
| Row hover | `tw:hover:bg-secondary` |
| Row selected | `tw:selected:bg-secondary` (checkbox `slot="selection"`) |
| Sortable header | arrow shown, `tw:cursor-pointer`, focusable column |
| Focus | `tw:focus-visible:outline-2 tw:-outline-offset-2 tw:outline-focus-ring` — never `tw:ring-*` |
| Empty | render an empty-state slot in place of `Table.Body` rows |

## Code example

```tsx
import { Table } from '@openmetadata/ui-core-components';

<Table aria-label={t('label.table')} selectionMode="multiple" size="md">
  <Table.Header>
    <Table.Head allowsSorting id="name" label={t('label.name')} />
    <Table.Head id="type" label={t('label.type')} tooltip={t('message.type')} />
  </Table.Header>
  <Table.Body>{/* Table.Row + Table.Cell */}</Table.Body>
</Table>;
```

## Cross-references

- [Tabs](tabs.md) · [Pagination](pagination.md) · [Modal](modal.md)
- [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
