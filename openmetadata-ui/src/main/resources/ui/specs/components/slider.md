# Slider

## Metadata

| | |
| --- | --- |
| **Name** | Slider |
| **Category** | Base / input |
| **Status** | Stable |
| **Styles** | [`src/styles/components/slider.less`](../../src/styles/components/slider.less) |
| **Component** | `@openmetadata/ui-core-components` → `Slider` (new work); Ant Design `Slider` (legacy) |

## Overview

**Use when** the user chooses a number from a continuous or stepped range where
approximate position matters (sampling %, thresholds), single value or a
two-thumb range.

**Don't use when** an exact figure is required — use a number input; or the
choice is a small discrete set — use a [Select](select.md).

## Anatomy

```
        ●───────────────                 ← handle (thumb)
  ══════╪═════════════════════════════   ← filled track ═ / rail ─
  0        25        50        75    100  ← range labels (showRange)
```

Parts: **rail** (unfilled track), **fill** (filled portion), **handle**
(draggable thumb + focus ring), optional **value tooltip** / **hover ghost**,
optional **range labels**.

## Tokens used

| Part | Token |
| --- | --- |
| Rail | `--om-color-bg-quaternary` |
| Fill | `--om-color-bg-brand-solid` |
| Fill (disabled) | `--om-color-bg-disabled` |
| Handle surface / border | `--om-color-bg-primary` / `--om-color-border` |
| Handle shadow | `--om-shadow-md` |
| Rail & handle radius | `--om-radius-full` |
| Focus ring | `--om-color-focus-ring` |
| Tooltip surface / shadow | `--om-color-bg-primary` / `--om-shadow-lg` |
| Range label / active label | `--om-color-text-tertiary` / `--om-color-text-brand` |
| Transition | `--om-duration-fast` |

## Props / API (core-components `Slider`)

| Prop | Values |
| --- | --- |
| `minValue` / `maxValue` | number (default `0` / `100`) |
| `step` | number |
| `value` / `defaultValue` | `number` \| `number[]` (2 values → range) |
| `label` | `ReactNode` |
| `labelPosition` | `default`, `top`, `bottom`, `top-floating`, `bottom-floating` |
| `labelFormatter` | `(value) => string` |
| `formatOptions` | `Intl.NumberFormatOptions` |
| `showRange` | boolean (tick labels) |
| `showHoverPreview` | boolean (hover ghost + tooltip) |
| `rangeCount` | number (tick count, min 2) |
| `isDisabled` | boolean (via `AriaSliderProps`) |
| `onChange` | `(value) => void` |

## States

| State | Treatment |
| --- | --- |
| Track rail | `--om-color-bg-quaternary` |
| Track fill | `--om-color-bg-brand-solid` (disabled → `--om-color-bg-disabled`) |
| Handle | `--om-color-bg-primary` + `--om-color-border` + `--om-shadow-md`, `cursor: grab` |
| Dragging | `cursor: grabbing`; floating tooltip on `--om-color-bg-primary` |
| Focus | handle `--om-color-focus-ring` outline (2px, offset 2px) |
| Disabled | fill `--om-color-bg-disabled`, handle dimmed, `cursor: not-allowed` |

> Focus uses `outline`, never `tw:ring-*`; the handle border is drawn on
> `::after` (`borderAfter2`) — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-slider {
  &__rail {
    background: var(--om-color-bg-quaternary);
    border-radius: var(--om-radius-full);
  }
  &__fill {
    background: var(--om-color-bg-brand-solid);
  }
  &__handle {
    background: var(--om-color-bg-primary);
    outline: 1px solid var(--om-color-border);
    box-shadow: var(--om-shadow-md);
    transition: outline-color var(--om-duration-fast) ease;

    &:focus-visible {
      outline: 2px solid var(--om-color-focus-ring);
      outline-offset: 2px;
    }
  }
}
```

```tsx
import { Slider } from '@openmetadata/ui-core-components';
<Slider
  showRange
  aria-label={t('label.percentage')}
  defaultValue={30}
  maxValue={100}
  minValue={0}
  step={5}
/>;
```

## Cross-references

- [Select](select.md) · [Toggle switch](toggle-switch.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Radius](../foundations/radius.md), [Elevation](../foundations/elevation.md), [Motion](../foundations/motion.md)
