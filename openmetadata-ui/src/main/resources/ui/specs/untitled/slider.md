# Slider

## Metadata

| | |
| --- | --- |
| **Name** | Slider |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Slider` |
| **Source** | [`components/base/slider`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/slider) |

## Overview

**Use when** picking a number on a bounded, continuous scale — a threshold, a
sample percentage, an opacity. Two thumbs give a min/max range.

**Don't use when** the value needs precise entry (use `Input type=number`) or
the choice is a discrete named set (use `Select`).

## Anatomy

```
Label
────●━━━━━━━━━━━━━━━━━━━━━━━━━●────   ← rail (bg-quaternary) + fill (bg-brand-solid)
    ▲ thumb           ▲ thumb          thumb: size-6, ::after border, shadow-md
 0    25    50    75   100            ← range ticks (showRange), active tick bolded
        ┌──────┐
        │  42  │                      ← floating value tooltip (portal, on hover/drag)
        └──────┘
```

Parts: **Label**, **track** (rail + fill), one or two **thumbs**, per-thumb
**value output**, optional **range ticks**, optional **hover-preview ghost +
tooltip**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Rail (unfilled) | `tw:h-2 tw:rounded-full tw:bg-quaternary` |
| Fill (active / disabled) | `tw:bg-brand-solid` · `tw:bg-disabled` |
| Thumb | `tw:size-6 tw:rounded-full tw:bg-slider-handle-bg tw:shadow-md` |
| Thumb border | `borderAfter2` + `tw:after:outline-slider-handle-border` |
| Thumb focus ring | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Hover ghost | `tw:size-5 tw:border-2 tw:border-brand-solid tw:bg-slider-handle-bg tw:opacity-60` |
| Floating tooltip | `tw:bg-primary tw:text-secondary tw:shadow-lg tw:outline-1 tw:outline-secondary_alt` |
| Range ticks (rest / active) | `tw:text-tertiary` · `tw:text-brand-secondary tw:font-medium` |

## Props / API

| Prop | Type / values |
| --- | --- |
| `label` | ReactNode |
| `labelPosition` | `default` · `top` · `bottom` · `top-floating` · `bottom-floating` |
| `labelFormatter` | `(value: number) => string` |
| `showRange` | boolean — render min…max ticks |
| `showHoverPreview` | boolean — ghost + tooltip on track hover |
| `rangeCount` | number of ticks (min 2) |
| `minValue` / `maxValue` | number (default `0` / `100`) |
| `step` | number (snap increment) |
| Aria (`AriaSliderProps`) | `value`, `defaultValue`, `onChange`, `formatOptions`, `isDisabled`, `orientation`, `name` |

## States

| State | Treatment |
| --- | --- |
| Default | `tw:bg-brand-solid` fill, thumb `tw:cursor-grab` |
| Focus | thumb `tw:outline-2 tw:outline-focus-ring` (outline, not `tw:ring-*`) |
| Dragging | thumb `tw:cursor-grabbing`; hover ghost suppressed |
| Disabled | fill `tw:bg-disabled`, thumb `tw:opacity-50 tw:cursor-not-allowed` |
| Hover preview | ghost `tw:opacity-60` + portalled value tooltip |

> Thumb border/focus use `::after` + `outline`, never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Slider } from '@openmetadata/ui-core-components';

<Slider
  className="tw:max-w-md"
  defaultValue={40}
  label={t('label.threshold')}
  maxValue={100}
  minValue={0}
  showRange
  step={5}
/>;
```

## Cross-references

- [TextArea](textarea.md) · [Select](select.md) · [Tooltip](tooltip.md)
- Foundations: [Tailwind](../foundations/tailwind.md) · [Utility reference](../tokens/tailwind-utility-reference.md)
