# Radio

## Metadata

| | |
| --- | --- |
| **Name** | Radio |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `RadioGroup` + `RadioButton` (also `RadioButtonBase`) |
| **Source** | [`components/base/radio-buttons`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/radio-buttons) |

## Overview

**Use when** the user picks exactly one option from a small, mutually exclusive
set (2–5 visible choices). Always render `RadioButton`s inside a `RadioGroup`,
which owns the selected value and propagates `size` via context.

**Don't use when** multiple selections are allowed (use `Checkbox`), for a
binary on/off setting (`Toggle`), or when the list is long (use `Select`).

## Anatomy

```
( ) Option A            ← RadioButton: circle + ::after border + inner dot when selected
(•) Option B  Hint      ← selected shows the brand-filled dot
```

Parts: **group** (`RadioGroup`: vertical `flex` column), **circle**
(`RadioButtonBase`: surface, `::after` border, inner dot), **label**, **hint**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Circle surface | `tw:bg-primary` `tw:rounded-full` |
| Circle border | `borderAfter` → `tw:after:outline-primary` |
| Selected | `tw:bg-brand-solid` `tw:after:outline-brand-solid` |
| Inner dot | `tw:bg-fg-white` (`tw:size-1.5`, md `tw:size-2`) |
| Focus ring | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Disabled | `tw:border-disabled` `tw:bg-disabled_subtle`, dot `tw:bg-fg-disabled_subtle` |
| Group layout | `tw:flex tw:flex-col tw:gap-4` |
| Label / hint | `tw:text-secondary` / `tw:text-tertiary` |

## Props / API

### `RadioGroup`

| Prop | Type / values | Purpose |
| --- | --- | --- |
| `size` | `sm` \| `md` (default `sm`) | Applied to every button via context |
| `value` / `defaultValue` | string | Selected radio value (controlled / uncontrolled) |
| `onChange` | `(value: string) => void` | Selection handler |
| `isDisabled` / `isRequired` / `isInvalid` | boolean (react-aria) | Group state |
| `orientation` | `horizontal` \| `vertical` | Layout direction |
| `children` | ReactNode | The `RadioButton`s |

### `RadioButton`

| Prop | Type / values | Purpose |
| --- | --- | --- |
| `value` | string (required) | Value emitted when this option is chosen |
| `label` | ReactNode | Text beside the circle |
| `hint` | ReactNode | Secondary text under the label |
| `size` | `sm` \| `md` | Overridden by the group's context size |
| `isDisabled` | boolean | Disable this single option |

## States

| State | Treatment |
| --- | --- |
| Default | empty circle, `tw:bg-primary` + `tw:after:outline-primary`, `cursor-pointer` |
| Focus | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Selected | `tw:bg-brand-solid` + `tw:after:outline-brand-solid`, inner dot visible |
| Disabled | `tw:border-disabled` + `tw:bg-disabled_subtle`, `cursor-not-allowed` |

> Border is drawn on `::after` (via `borderAfter`), never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { RadioButton, RadioGroup } from '@openmetadata/ui-core-components';

<RadioGroup aria-label={t('label.visibility')} size="md" onChange={setScope}>
  <RadioButton label={t('label.public')} value="public" />
  <RadioButton label={t('label.private')} value="private" />
</RadioGroup>;
```

## Cross-references

- [Checkbox](checkbox.md) · [Toggle](toggle.md) · [Input](input.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md) · [../../docs/colors.md](../../docs/colors.md)
