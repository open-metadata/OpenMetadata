# Card

## Metadata

| | |
| --- | --- |
| **Name** | Card |
| **Category** | Base / container |
| **Status** | Stable |
| **Styles** | [`src/styles/components/card.less`](../../src/styles/components/card.less) |
| **Component** | `@openmetadata/ui-core-components` → `Card` (`Card.Header` / `Card.Content` / `Card.Footer`) for new work; Ant Design `Card` (legacy) |

## Overview

**Use when** grouping related content into a bordered surface with an optional
header, body, and footer — a panel, a summary tile, a form section.

**Don't use when** the content is a single inline chip ([Badge](badge.md) /
[Tags](tags.md)) or needs no visual container — prefer plain layout.

## Anatomy

```
┌─────────────────────────────────────┐
│ Title / subtitle          [extra]   │ ← Card.Header (border-bottom)
├─────────────────────────────────────┤
│ body content …                      │ ← Card.Content (size padding)
├─────────────────────────────────────┤
│ actions                             │ ← Card.Footer (border-top)
└─────────────────────────────────────┘
```

Parts: **root** (surface, border, radius, optional shadow), **header**
(title + subtitle + extra slot), **content**, **footer**.

## Tokens used

Real `--om-*` tokens in `card.less` are the medium weight and the expand
transition; surface/border/radius map through the modern core-components Card.

| Part | Token |
| --- | --- |
| Header weight | `--om-font-weight-medium` |
| Expand/collapse transition | `--om-duration-200` |
| Root surface | `--om-color-bg-primary` |
| Root / divider border | `--om-color-border-secondary` |
| Corner radius | `--om-radius-xl` |
| Elevated variant shadow | `--om-shadow-md` |
| Selected border | `--om-color-border-brand` |

## Props / API (core-components `Card`)

| Prop | Values |
| --- | --- |
| `variant` | `default`, `elevated`, `outlined`, `ghost` |
| `color` | `default`, `brand`, `brandOutlined`, `error`, `warning`, `success` |
| `size` | `sm`, `md`, `lg` (drives padding) |
| `isClickable` | boolean |
| `isSelected` | boolean |
| Sub-components | `Card.Header` (`title`, `subtitle`, `extra`), `Card.Content`, `Card.Footer` |

## States

| State | Treatment |
| --- | --- |
| Default | `--om-color-bg-primary` + `--om-color-border-secondary`, `--om-radius-xl` |
| Hover | only when `isClickable` — surface → `--om-color-interactive-hover`, border strengthens |
| Selected | 2px `--om-color-border-brand` |
| Focus | `--om-color-focus-ring` outline (offset 2px) on clickable cards |

> Borders/focus use `border`/`outline`, never `tw:ring-*` — see
> [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-card {
  background: var(--om-color-bg-primary);
  border: 1px solid var(--om-color-border-secondary);
  border-radius: var(--om-radius-xl);
  transition: all var(--om-duration-200) ease;

  .card-head {
    font-weight: var(--om-font-weight-medium);
    border-bottom: 1px solid var(--om-color-border-secondary);
  }
  &.is-elevated {
    box-shadow: var(--om-shadow-md);
  }
}
```

```tsx
import { Card } from '@openmetadata/ui-core-components';
<Card variant="elevated" size="md">
  <Card.Header title={t('label.summary')} />
  <Card.Content>{t('label.description')}</Card.Content>
</Card>;
```

## Cross-references

- [Badge](badge.md) · [Tags](tags.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Radius](../foundations/radius.md), [Elevation](../foundations/elevation.md), [Motion](../foundations/motion.md)
