# Tooltip

## Metadata

| | |
| --- | --- |
| **Name** | Tooltip |
| **Category** | Base / overlay |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Tooltip` (with `TooltipTrigger`) |
| **Source** | [`components/base/tooltip`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/tooltip) |

## Overview

**Use when** a control needs a short, on-demand label or hint on hover/focus —
an icon-only button, a truncated value, a terse explanation.

**Don't use when** the content is essential, interactive, or long — use inline
text, a `Popover`, or a `Modal` instead. Tooltips are dismissible and
keyboard-transient.

## Anatomy

```
[ trigger ]                          ← children wrapped in TooltipTrigger (AriaButton)
     ▲
  ┌──────────────┐
  │ Title         │                  ← title: text-xs semibold, on bg-primary-solid
  │ Description   │                  ← optional description (supporting text)
  └──────▽───────┘                   ← optional arrow (fill-bg-primary-solid)
```

Parts: **trigger** (`TooltipTrigger`), **content container** (dark solid
surface), **title**, optional **description**, optional **arrow**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Container surface | `tw:bg-primary-solid tw:shadow-lg` |
| Container radius / padding | `tw:rounded-lg` · `tw:px-3` + `tw:py-2` / `tw:py-3` (with description) |
| Layering / width | `tw:z-50` · `tw:max-w-xs` |
| Title | `tw:text-xs tw:font-semibold tw:text-white` |
| Description | `tw:text-xs tw:font-medium tw:text-tooltip-supporting-text` |
| Arrow | `tw:size-2.5 tw:fill-bg-primary-solid` |
| Trigger | `tw:h-max tw:w-max tw:outline-hidden` |

## Props / API

| Prop | Type / values |
| --- | --- |
| `title` | ReactNode (required) |
| `description` | ReactNode |
| `arrow` | boolean (default `false`) |
| `delay` | number ms before show (default `300`) |
| `closeDelay` | number ms before hide (default `0`) |
| `placement` | `top` (default) · `bottom` · `left` · `right` · `*-start/end` |
| `offset` / `crossOffset` | number px from trigger |
| `containerClassName` | string (override the dark surface) |
| `children` | the trigger element (`TooltipTrigger`) |
| Aria (`AriaTooltipTriggerComponentProps`) | `trigger`, `isDisabled`, `isOpen`, `defaultOpen`, `onOpenChange` |

## States

| State | Treatment |
| --- | --- |
| Hidden | not rendered until `delay` elapses |
| Trigger hover / focus | tooltip shown; enters with `tw:animate-in tw:fade-in tw:zoom-in-95` |
| Exiting | `tw:animate-out tw:fade-out tw:zoom-out-95` |
| With description | container switches to `tw:py-3`, supporting text below title |
| Disabled | `isDisabled` on trigger suppresses the overlay entirely |

> Trigger uses `tw:outline-hidden`; never draw a border with `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Button, Tooltip, TooltipTrigger } from '@openmetadata/ui-core-components';

<Tooltip description={t('label.description')} title={t('label.run')}>
  <TooltipTrigger>
    <Button color="secondary">{t('label.run')}</Button>
  </TooltipTrigger>
</Tooltip>;
```

## Cross-references

- [TextArea](textarea.md) · [Select](select.md) · [Slider](slider.md)
- Foundations: [Tailwind](../foundations/tailwind.md) · [Utility reference](../tokens/tailwind-utility-reference.md)
