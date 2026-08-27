# Toggle switch

## Metadata

| | |
| --- | --- |
| **Name** | Toggle switch |
| **Category** | Base / input |
| **Status** | Stable |
| **Styles** | [`src/styles/components/toggle-switch.less`](../../src/styles/components/toggle-switch.less) |
| **Component** | `@openmetadata/ui-core-components` → `Toggle` (new work); Ant Design `Switch` (legacy) |

## Overview

**Use when** a single setting flips between two states and the change applies
immediately (enable/disable, on/off). One label per toggle.

**Don't use when** the user picks from more than two options — use a
[Select](select.md); or the change needs an explicit submit — use a checkbox.

## Anatomy

```
┌──────────┐
│ ○        │  off  ← track (unchecked) + knob at left
└──────────┘
┌──────────┐
│        ● │  on   ← track fills brand + knob slides right
└──────────┘
  Label   hint     ← optional label + supporting hint
```

Parts: **track** (fills on selection), **knob** (translates on toggle),
optional **label** + **hint**, **focus ring** (outline).

## Tokens used

| Part | Token |
| --- | --- |
| Track off (legacy override) | `--om-legacy-color-107-114-128-0-15` → prefer `--om-color-bg-tertiary` |
| Track / knob border (legacy) | `--om-legacy-color-6b7280` → prefer `--om-color-border` |
| Track on | `--om-color-bg-brand-solid` |
| Knob | `--om-color-white` |
| Knob shadow | `--om-shadow-sm` |
| Track & knob radius | `--om-radius-full` |
| Focus ring | `--om-color-focus-ring` |
| Disabled track | `--om-color-bg-disabled` |
| Label / hint | `--om-color-text-secondary` / `--om-color-text-tertiary` |
| Transition | `--om-duration-fast` |

## Props / API (core-components `Toggle`)

| Prop | Values |
| --- | --- |
| `size` | `sm`, `md` |
| `slim` | boolean (thinner track, bordered knob) |
| `label` | string |
| `hint` | `ReactNode` |
| `isSelected` / `defaultSelected` | boolean (via `AriaSwitchProps`) |
| `isDisabled` | boolean |
| `onChange` | `(isSelected) => void` |

## States

| State | Treatment |
| --- | --- |
| Off | track `--om-color-bg-tertiary`, knob left |
| On | track `--om-color-bg-brand-solid`, knob translated right |
| On + hover | track brand hover (`--om-color-bg-brand-solid`) |
| Focus | `--om-color-focus-ring` outline (2px, offset 2px) — never a `ring-*` |
| Disabled | track `--om-color-bg-disabled`, `cursor: not-allowed` |

> The unchecked track/border still use `--om-legacy-color-*` migration values in
> the Ant `.less` override; re-express with semantic tokens in new work. Focus
> uses `outline`, never `tw:ring-*` — see
> [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-toggle {
  border-radius: var(--om-radius-full);
  background: var(--om-color-bg-tertiary);
  transition: background-color var(--om-duration-fast) ease;

  &__knob {
    background: var(--om-color-white);
    box-shadow: var(--om-shadow-sm);
    border-radius: var(--om-radius-full);
  }
  &.is-on {
    background: var(--om-color-bg-brand-solid);
  }
  &:focus-visible {
    outline: 2px solid var(--om-color-focus-ring);
    outline-offset: 2px;
  }
  &.is-disabled {
    background: var(--om-color-bg-disabled);
    cursor: not-allowed;
  }
}
```

```tsx
import { Toggle } from '@openmetadata/ui-core-components';
<Toggle
  label={t('label.enabled')}
  size="md"
  onChange={onToggle}
/>;
```

## Cross-references

- [Select](select.md) · [Slider](slider.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Radius](../foundations/radius.md), [Elevation](../foundations/elevation.md), [Motion](../foundations/motion.md)
