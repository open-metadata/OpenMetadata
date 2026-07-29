# Table

## Metadata

| | |
| --- | --- |
| **Name** | Table |
| **Category** | Data display |
| **Status** | Stable |
| **Styles** | [`src/styles/components/table.less`](../../src/styles/components/table.less) |
| **Component** | `@openmetadata/ui-core-components` → `Table` (new work); Ant Design `Table` (legacy) |

## Overview

**Use when** presenting rows of structured records the user scans, sorts, or
selects — entity lists, columns, test results, ingestion runs.

**Don't use when** showing a handful of key/value pairs (use a description
list) or free-form content — a table implies columnar, comparable data.

## Anatomy

```
┌─────────────────────────────────────────────┐
│ [✓] Name ▲   Type      Owner        ⋯        │  ← header row: sortable cells
├─────────────────────────────────────────────┤
│ [✓] orders   table     data-eng     ⋯        │  ← body row (hover / selected)
│ [ ] customers table    analytics    ⋯        │
└─────────────────────────────────────────────┘
```

Parts: **header** (`Table.Header` + `Table.Head`), **sortable cell** (sort
arrow), **body** (`Table.Body` + `Table.Row` + `Table.Cell`), optional
**selection column** (checkbox), **row actions** (dropdown), **card wrapper**.

## Tokens used

| Part | Token |
| --- | --- |
| Header cell weight | `--om-font-weight-medium` |
| First-cell left padding (small) | `--om-space-16` |
| Filter gap, expand/drag-icon margin | `--om-space-8` |
| Expand-icon size | `--om-font-size-xs` |
| Header text (semantic) | `--om-color-text-secondary` |
| Cell / row borders (semantic) | `--om-color-border` |
| Row hover / selected (semantic) | `--om-color-interactive-hover`, `--om-color-interactive-selected` |

> Legacy `@`-vars (`@grey-600`, `@border-color-1`, `@primary-color`) still
> carry color in the `.less`; new work should reference the semantic tokens.

## Props / API (core-components `Table`)

| Member | Purpose |
| --- | --- |
| `Table.Card.Root` / `Table.Card.Header` | Card surface, title, `badge`, `contentTrailing` |
| `Table.Header` / `Table.Head` | Header row; `Head` takes `label`, `tooltip`, `allowsSorting` |
| `Table.Body` / `Table.Row` / `Table.Cell` | Body rows and cells |
| `size` | `sm`, `md` |
| `selectionMode` | `single`, `multiple` (adds checkbox column) |

## States

| State | Treatment |
| --- | --- |
| Row hover | surface `--om-color-interactive-hover`; drag-icon becomes visible |
| Row selected | surface `--om-color-interactive-selected` |
| Sortable header | sort arrow shown; cell is a focusable button |
| Empty | render an empty-state slot in place of `Table.Body` rows |

## Code example

```less
.custom-table {
  .ant-table-thead tr > th {
    font-weight: var(--om-font-weight-medium);
    color: var(--om-color-text-secondary);
    border-color: var(--om-color-border);
  }
  .ant-table-tbody > tr:hover > td {
    background: var(--om-color-interactive-hover);
  }
  .table-expand-icon {
    margin-right: var(--om-space-8);
    font-size: var(--om-font-size-xs);
  }
}
```

```tsx
import { Table } from '@openmetadata/ui-core-components';
<Table aria-label={t('label.table')} selectionMode="multiple" size="md">
  <Table.Header>
    <Table.Head allowsSorting label={t('label.name')} />
  </Table.Header>
  <Table.Body>{/* rows */}</Table.Body>
</Table>;
```

## Cross-references

- [Tabs](tabs.md) · [Form](form.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Typography](../foundations/typography.md)
