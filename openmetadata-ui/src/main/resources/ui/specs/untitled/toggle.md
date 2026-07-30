# Toggle

## Metadata

| | |
| --- | --- |
| **Name** | Toggle |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Toggle` (also `ToggleBase`) |
| **Source** | [`components/base/toggle`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/toggle) |

## Overview

**Use when** flipping a single setting that takes effect immediately — enable a
feature, mute notifications, turn a service on/off. Reads as a physical switch.

**Don't use when** the value is only committed on form submit or is part of a
multi-select list (use `Checkbox`), or for one-of-many choices (`RadioGroup`).

## Anatomy

```
┌────────●┐  Label      ← track (rounded-full) + knob; knob translate-x when on
└─────────┘  Hint text  ← optional secondary text under the label
```

Parts: **track** (`ToggleBase`: pill surface, focus outline), **knob** (white
circle, shadow, slides via `translate-x`), **label**, **hint**. `slim` renders a
thinner track with an outlined knob.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Track (off) | `tw:bg-tertiary` `tw:rounded-full` |
| Track (on) | `tw:bg-brand-solid`, hover `tw:bg-brand-solid_hover` |
| Knob | `tw:bg-fg-white` `tw:shadow-sm` `tw:rounded-full` |
| Focus ring | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Disabled | track `tw:bg-disabled`, knob `tw:bg-toggle-button-fg_disabled` |
| Slim border | `borderAfter` → `tw:after:outline-secondary` |
| Size sm / md | track `tw:h-5 tw:w-9` / `tw:h-6 tw:w-11`, gap `tw:gap-2` / `tw:gap-3` |
| Label / hint | `tw:text-secondary` / `tw:text-tertiary` |

## Props / API (`Toggle`)

| Prop | Type / values | Purpose |
| --- | --- | --- |
| `label` | string | Text beside the switch |
| `hint` | ReactNode | Secondary text under the label |
| `size` | `sm` \| `md` (default `sm`) | Track + text scale |
| `slim` | boolean | Thinner track with an outlined knob |
| `isSelected` / `defaultSelected` | boolean (react-aria) | On/off (controlled / uncontrolled) |
| `isDisabled` / `isReadOnly` | boolean | Field state |
| `onChange` | `(isSelected: boolean) => void` | Change handler |
| `value` / `name` | string | Form value / field name |

## States

| State | Treatment |
| --- | --- |
| Off (default) | `tw:bg-tertiary` track, knob left |
| On (selected) | `tw:bg-brand-solid` track, knob slid right via `translate-x` |
| Hover (on) | `tw:bg-brand-solid_hover` |
| Focus | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Disabled | `tw:bg-disabled` track + `tw:bg-toggle-button-fg_disabled` knob, `cursor-not-allowed` |

> Focus and slim border use `outline` (via `borderAfter`), never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Toggle } from '@openmetadata/ui-core-components';

<Toggle
  hint={t('message.notify-hint')}
  label={t('label.enable-notification-plural')}
  size="md"
  onChange={setEnabled}
/>;
```

## Cross-references

- [Checkbox](checkbox.md) · [Radio](radio.md) · [Input](input.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md) · [../../docs/colors.md](../../docs/colors.md)
