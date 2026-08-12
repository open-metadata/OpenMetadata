# Pagination

## Metadata

| | |
| --- | --- |
| **Name** | Pagination |
| **Category** | Application |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `PaginationPageDefault` (+ `Pagination` primitives) |
| **Source** | [`components/application/pagination`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/application/pagination) |

Go-forward (UntitledUI + Tailwind, `tw:` only). Legacy spec: [../components/pagination.md](../components/pagination.md).

## Overview

**Use when** a list or table exceeds one page and the user needs to move
between pages or change page size.

**Don't use when** the full set fits on screen, or content should stream — use
infinite scroll / "load more".

## Anatomy

```
[← Previous]   [1] [2] (3) [4] … [10]   [Next →]     ← PaginationPageDefault
     │           │        └ current: tw:bg-primary_hover
     │           └ Pagination.Item (tw:size-10)  … Pagination.Ellipsis
     └ Pagination.PrevTrigger / NextTrigger (Button)
```

Parts: **`Pagination.Root`** (nav + top border), **`Pagination.PrevTrigger`** /
**`NextTrigger`** (Button), **`Pagination.Item`**, **`Pagination.Ellipsis`**,
**`Pagination.Context`** (render prop over `pages`), optional records `Select`.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Root divider | `tw:border-t tw:border-secondary` `tw:pt-4` |
| Page item | `tw:size-10` `tw:p-3` `tw:text-sm tw:font-medium tw:text-quaternary` |
| Item radius | `tw:rounded-lg` (`tw:rounded-full` when `rounded`) |
| Hover / current | `tw:hover:bg-primary_hover tw:hover:text-secondary` |
| Current fill | `tw:bg-primary_hover tw:text-secondary` (`isSelected`) |
| Ellipsis | `tw:text-tertiary` |
| Indicator text | `tw:text-sm tw:text-fg-secondary` |
| Focus ring | `tw:outline-focus-ring tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2` |

## Props / API

| Member / prop | Purpose |
| --- | --- |
| `page` / `total` | number — current active page · total page count |
| `onPageChange` | `(page: number) => void` |
| `siblingCount` | pages shown each side of current (default 1) |
| `rounded` | pill vs. `tw:rounded-lg` items |
| `Pagination.Root` / `.Context` | primitive shell + `pages` render prop |
| `Pagination.PrevTrigger` / `.NextTrigger` / `.Item` / `.Ellipsis` | controls |
| variants | `PaginationPageDefault`, `PaginationPageMinimalCenter`, `PaginationCardWithControls` (`pageSize`, `pageSizeOptions`, `onPageSizeChange`) |

## States

| State | Treatment |
| --- | --- |
| Default page | borderless, `tw:rounded-lg`, `tw:text-quaternary` |
| Hover | `tw:hover:bg-primary_hover tw:hover:text-secondary` |
| Current page | `tw:bg-primary_hover tw:text-secondary`, `aria-current="page"` |
| Disabled prev/next | `Button isDisabled` at `page <= 1` / `page >= total`; `tw:disabled:cursor-not-allowed` |
| Ellipsis | non-interactive gap marker (`aria-hidden`) |
| Focus | `tw:focus-visible:outline-2 tw:outline-focus-ring` — never `tw:ring-*` (see [../../docs/colors.md §2.3.1](../../docs/colors.md)) |

## Code example

```tsx
import { PaginationPageDefault } from '@openmetadata/ui-core-components';

<PaginationPageDefault
  aria-label={t('label.pagination')}
  page={page}
  total={totalPages}
  onPageChange={setPage}
/>;
```

## Cross-references

- [Table](table.md) · [Tabs](tabs.md) · [Modal](modal.md)
- [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
