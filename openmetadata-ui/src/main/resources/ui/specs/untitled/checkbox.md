# Checkbox

## Metadata

| | |
| --- | --- |
| **Name** | Checkbox |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Checkbox` (also `CheckboxBase`) |
| **Source** | [`components/base/checkbox`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/checkbox) |

## Overview

**Use when** toggling an independent boolean or selecting any number of items
from a list (multi-select). Supports an indeterminate (mixed) state for
parent/child group headers.

**Don't use when** the choice is one-of-many mutually exclusive options (use
`RadioGroup`) or a single on/off setting where a switch reads better (`Toggle`).

## Anatomy

```
┌─┐
│✓│  Label            ← box: surface + ::after border + check / indeterminate svg
└─┘  Hint text        ← optional secondary text under the label
```

Parts: **box** (`CheckboxBase`: surface, `::after` border, check + dash SVGs),
**label**, **hint**. Wrapped by a react-aria `Checkbox` label element.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Box surface | `tw:bg-primary` `tw:rounded` (md `tw:rounded-md`) |
| Box border | `borderAfter` → `tw:after:outline-primary` |
| Checked / indeterminate | `tw:bg-brand-solid` `tw:after:outline-brand-solid` |
| Check glyph | `tw:text-fg-white` |
| Focus ring | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Disabled | `tw:bg-disabled_subtle` `tw:after:outline-disabled`, glyph `tw:text-fg-disabled_subtle` |
| Size sm / md | `tw:size-4` / `tw:size-5`, gap `tw:gap-2` / `tw:gap-3` |
| Label / hint | `tw:text-secondary` / `tw:text-tertiary` |

## Props / API (`Checkbox`)

| Prop | Type / values | Purpose |
| --- | --- | --- |
| `label` | ReactNode | Text beside the box |
| `hint` | ReactNode | Secondary text under the label |
| `size` | `sm` \| `md` (default `sm`) | Box + text scale |
| `isSelected` / `defaultSelected` | boolean (react-aria) | Checked state (controlled / uncontrolled) |
| `isIndeterminate` | boolean | Dash (mixed) state |
| `isDisabled` / `isReadOnly` / `isRequired` / `isInvalid` | boolean | Field state |
| `onChange` | `(isSelected: boolean) => void` | Change handler |
| `value` / `name` | string | Form value / group name |

## States

| State | Treatment |
| --- | --- |
| Default | empty box, `tw:bg-primary` + `tw:after:outline-primary`, `cursor-pointer` |
| Focus | `tw:outline-2 tw:outline-offset-2 tw:outline-focus-ring` |
| Checked | `tw:bg-brand-solid` + `tw:after:outline-brand-solid`, check SVG shown |
| Indeterminate | brand fill, dash SVG shown instead of check |
| Disabled | `tw:bg-disabled_subtle` + `tw:after:outline-disabled`, `cursor-not-allowed` |

> Border is drawn on `::after` (via `borderAfter`), never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Checkbox } from '@openmetadata/ui-core-components';

<Checkbox
  hint={t('message.terms-hint')}
  label={t('label.accept-term-plural')}
  size="md"
  onChange={setAccepted}
/>;
```

## Cross-references

- [Radio](radio.md) · [Toggle](toggle.md) · [Input](input.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md) · [../../docs/colors.md](../../docs/colors.md)
