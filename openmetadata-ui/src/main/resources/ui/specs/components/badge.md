# Badge

## Metadata

| | |
| --- | --- |
| **Name** | Badge |
| **Category** | Base / status |
| **Status** | Stable |
| **Styles** | [`src/styles/components/badge.less`](../../src/styles/components/badge.less) |
| **Component** | `@openmetadata/ui-core-components` → `Badge`, `BadgeGroup` (new work); Ant Design `Badge` count (legacy) |

## Overview

**Use when** labelling a non-interactive status, count, or category inline —
e.g. an entity tier, a pipeline state, an item count next to a title.

**Don't use when** the chip is clickable, removable, or selectable — use
[Tags](tags.md). Don't use for a primary action — use [Button](button.md).

## Anatomy

```
┌───────────────────────────┐
│ ● Label            [addon] │   ← optional leading dot/icon + label + optional addon/×
└───────────────────────────┘
   │     │
   │     └─ label: font-weight medium, size xs/sm
   └─ pill: color-tinted surface, full radius, hairline outline
```

Parts: **pill container** (tinted surface + outline), **label**, optional
**leading dot/icon**, optional **trailing addon text or close button**.

## Tokens used

The legacy `.less` still uses `@grey-*` LESS variables (no `--om-*` yet); the
modern core-components Badge maps to these semantic tokens.

| Part | Token |
| --- | --- |
| Label weight | `--om-font-weight-medium` |
| Label size | `--om-font-size-xs`, `--om-font-size-sm` |
| Pill radius | `--om-radius-full` |
| Gray surface / text (legacy `@grey-bg-with-alpha` / `@grey-3`) | `--om-color-bg-tertiary` / `--om-color-text-tertiary` |
| Hairline outline | `--om-color-border` |
| Semantic tints | `--om-color-bg-success`, `--om-color-bg-warning`, `--om-color-bg-error`, `--om-color-bg-brand` |

## Props / API (core-components `Badge` / `BadgeGroup`)

| Prop | Values |
| --- | --- |
| `type` | `pill-color`, `color`, `modern` |
| `color` | `gray`, `brand`, `error`, `warning`, `success`, `gray-blue`, `blue-light`, `blue`, `indigo`, `purple`, `pink`, `orange`, `blue-dark` |
| `size` | `xs`, `sm`, `md`, `lg` |
| `bordered` | boolean (default `true`) |
| `BadgeGroup` extras | `addonText`, `theme` (`light`/`modern`), `align`, `iconTrailing` |

## States

| State | Treatment |
| --- | --- |
| Default | tinted surface + `--om-color-border` outline |
| Hover | static — only `BadgeWithButton` addon reacts (tint darkens) |
| Focus | `--om-color-focus-ring` outline on interactive `BadgeGroup`/close only |
| Disabled | dimmed tint, `cursor: not-allowed` |

> Borders/focus use `outline`, never `tw:ring-*` — see
> [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-badge {
  border-radius: var(--om-radius-full);
  font-weight: var(--om-font-weight-medium);
  font-size: var(--om-font-size-xs);
  background: var(--om-color-bg-tertiary);
  color: var(--om-color-text-tertiary);
  outline: 1px solid var(--om-color-border);
  outline-offset: -1px;

  &.badge-success {
    background: var(--om-color-bg-success);
    color: var(--om-color-text-success);
  }
}
```

```tsx
import { Badge } from '@openmetadata/ui-core-components';
<Badge color="success" size="md">{t('label.active')}</Badge>;
```

## Cross-references

- [Tags](tags.md) · [Card](card.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Radius](../foundations/radius.md), [Typography](../foundations/typography.md)
