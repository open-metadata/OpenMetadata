# Button

## Metadata

| | |
| --- | --- |
| **Name** | Button |
| **Category** | Base / action |
| **Status** | Stable |
| **Styles** | [`src/styles/components/button.less`](../../src/styles/components/button.less) |
| **Component** | `@openmetadata/ui-core-components` → `Button` (new work); Ant Design `Button` (legacy) |

## Overview

**Use when** the user triggers an action (submit, save, open a dialog, run a
pipeline). One primary action per view; everything else is secondary/tertiary.

**Don't use when** navigating to another page — use a link
(`--om-color-link`). Don't use a button as a container or for pure layout.

## Anatomy

```
┌──────────────────────────────┐
│ [icon]  Label  [icon]        │   ← content: optional leading/trailing icon + label
└──────────────────────────────┘
   │        │
   │        └─ label: font-weight semibold
   └─ padding (x = space-16, y from height), radius, border/background per variant
```

Parts: **container** (background, border, radius, shadow), **label**,
optional **leading/trailing icon**, **focus ring**.

## Tokens used

| Part | Token |
| --- | --- |
| Label weight | `--om-font-weight-semibold` |
| Corner radius | `--om-radius-lg` |
| Horizontal padding | `--om-space-16` (lg), `--om-space-12`, `--om-space-10` |
| Height sizes | LESS `@btn-height-sm/base/lg` (36 / 40 / 44px) |
| Primary fill | `--om-color-bg-brand-solid`, text `--om-color-white` |
| Secondary surface/border | `--om-color-bg-primary` / `--om-color-border` |
| Shadow | `--om-shadow-xs` (subtle), legacy skeuomorphic stops for depth |
| Focus ring | `--om-color-focus-ring` |
| Disabled | `--om-color-bg-disabled`, `--om-color-text-disabled` |

## Props / API (core-components `Button`)

| Prop | Values |
| --- | --- |
| `color` | `primary`, `secondary`, `tertiary`, `link-gray`, `link-color`, `primary-destructive`, `secondary-destructive`, `tertiary-destructive`, `link-destructive` |
| `size` | `sm`, `md`, `lg` |
| `isDisabled` | boolean |
| `isLoading` | boolean |
| leading / trailing icon | `@untitledui/icons` component |

## States

| State | Treatment |
| --- | --- |
| Default | variant fill + `--om-shadow-xs` |
| Hover | darker fill (`--om-color-bg-brand-solid` → brand-700) / surface `--om-color-interactive-hover` |
| Active | pressed fill; no elevation change |
| Focus | `--om-color-focus-ring` outline (2px, offset 2px) — never a `ring-*` |
| Disabled | `--om-color-bg-disabled` + `--om-color-text-disabled`, no shadow, `cursor: not-allowed` |
| Loading | spinner replaces leading icon; label dimmed |

> Borders/focus use `outline` (or `::after`), never `tw:ring-*` — see
> [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-button {
  padding: var(--om-space-10) var(--om-space-16);
  border-radius: var(--om-radius-lg);
  font-weight: var(--om-font-weight-semibold);
  background: var(--om-color-bg-brand-solid);
  color: var(--om-color-white);
  box-shadow: var(--om-shadow-xs);

  &:hover {
    background: var(--om-color-bg-brand-solid); /* brand-700 hover via token */
  }
  &:disabled {
    background: var(--om-color-bg-disabled);
    color: var(--om-color-text-disabled);
  }
}
```

```tsx
import { Button } from '@openmetadata/ui-core-components';
<Button color="primary" size="md" onClick={onRun}>{t('label.run')}</Button>;
```

## Cross-references

- [Badge](badge.md) · [Tags](tags.md) · [Toggle switch](toggle-switch.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Radius](../foundations/radius.md), [Elevation](../foundations/elevation.md)
