# Pagination

## Metadata

| | |
| --- | --- |
| **Name** | Pagination |
| **Category** | Application / navigation |
| **Status** | Stable |
| **Styles** | [`src/styles/components/pagination.less`](../../src/styles/components/pagination.less) |
| **Component** | `@openmetadata/ui-core-components` → `PaginationPageDefault` / `PaginationPageMinimalCenter` (new work); Ant Design `Pagination` (legacy, `.pagination-container`) |

## Overview

**Use when** a list or table exceeds one page and the user needs to move
between pages or change page size.

**Don't use when** the full set fits on screen, or content should stream — use
infinite scroll / "load more" instead.

## Anatomy

```
[‹ Previous]  [1] [2] (3) [4] … [10]  [Next ›]    Rows: [ 15 ▾ ]
     │          │    └ active page: brand fill, radius-lg
     │          └ page item: padding space-4, margin-right space-4
     └ prev / next button (disabled → 25% ink)
```

Parts: **prev/next button**, **page item**, **active item**, **ellipsis**,
**page-size select**, **indicator** (e.g. "1–15 of 240").

## Tokens used

| Part | Token |
| --- | --- |
| Item padding | `--om-space-4` |
| Item gap | `--om-space-4` (margin-right) |
| Item radius | `--om-radius-lg` |
| Active item fill | LESS `@primary-button-background` (brand solid) |
| Button / indicator size | `--om-font-size-sm` |
| Button / select weight | `--om-font-weight-semibold` |
| Disabled prev/next ink | `--om-legacy-color-0-0-0-0-25` (transparent bg; migration debt) |
| Indicator / label ink | LESS `@grey-700` / `@grey-500` |

## Props / API (core-components `PaginationPageDefault`)

| Prop | Values |
| --- | --- |
| `page` | number — current active page |
| `total` | number — total page count |
| `onPageChange` | `(page: number) => void` |
| `siblingCount` | number — pages shown each side of current |
| `rounded` | boolean — pill vs. `--om-radius-lg` items |
| `className` | string |

## States

| State | Treatment |
| --- | --- |
| Default page | borderless item, `--om-radius-lg` corners |
| Hover | interactive surface highlight (borderless) |
| Current page | `@primary-button-background` fill, no border |
| Disabled prev/next | `--om-legacy-color-0-0-0-0-25` ink, transparent bg, no border |
| Ellipsis | non-interactive gap marker between page ranges |
| Focus | outline focus ring — never a `ring-*` (see [`docs/colors.md` §2.3.1](../../docs/colors.md)) |

## Code example

```less
/* Layer 3 — reference Layer 2 tokens only */
.pagination-container {
  .ant-pagination-item {
    padding: var(--om-space-4);
    margin-right: var(--om-space-4);
    border: none;
    border-radius: var(--om-radius-lg);
  }
  .pagination-button {
    font-size: var(--om-font-size-sm);
    font-weight: var(--om-font-weight-semibold);
  }
  .ant-pagination-disabled .ant-btn-text[disabled] {
    background-color: transparent;
    color: var(--om-legacy-color-0-0-0-0-25);
  }
}
```

```tsx
import { PaginationPageDefault } from '@openmetadata/ui-core-components';
<PaginationPageDefault page={page} total={totalPages} onPageChange={setPage} />;
```

## Cross-references

- [Menu](menu.md) · [Drawer](drawer.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Radius](../foundations/radius.md)
