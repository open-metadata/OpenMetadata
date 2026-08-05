# Input

## Metadata

| | |
| --- | --- |
| **Name** | Input |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Input` (also `InputBase`, `TextField`) |
| **Source** | [`components/base/input`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/input) |

## Overview

**Use when** collecting a single line of free text — name, email, search term,
numeric value. Pair `label` + `hint` for form context; add a leading `icon`,
`tooltip`, or `shortcut` for affordances.

**Don't use when** editing multi-line text (use `Textarea`), choosing from a
fixed set (`Select` / `RadioGroup`), or toggling a boolean (`Checkbox` / `Toggle`).

## Anatomy

```
 Label *                          ← <Label>, * shown when isRequired
┌───────────────────────────────┐
│ [icon]  placeholder      (i)  │  ← group: leading icon · <input> · trailing tooltip/invalid icon
└───────────────────────────────┘
 Hint / error text                ← <HintText>, red when isInvalid
```

Parts: **label**, **group** (outline border + radius + surface), **leading
icon**, **input**, **trailing slot** (tooltip / invalid icon / shortcut),
**hint text**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Group surface | `tw:bg-primary` `tw:shadow-xs` `tw:rounded-lg` |
| Group border | `tw:outline-1 tw:-outline-offset-1 tw:outline-primary` |
| Focus border | `tw:outline-2 tw:-outline-offset-2 tw:outline-brand` |
| Input text / placeholder | `tw:text-primary` / `tw:placeholder:text-tertiary` |
| Leading icon | `tw:text-fg-quaternary` (disabled `tw:text-fg-disabled`) |
| Padding (sm / md) | `tw:px-3 tw:py-2` / `tw:px-3.5 tw:py-2.5` |
| Disabled | `tw:bg-disabled_subtle` `tw:outline-disabled` `tw:text-disabled` |
| Invalid | `tw:outline-error_subtle` → focus `tw:outline-error`, icon `tw:text-fg-error-secondary` |
| Hint / error text | `tw:text-tertiary` / `tw:text-error-primary` |

## Props / API (`Input`)

| Prop | Type / values | Purpose |
| --- | --- | --- |
| `label` | string | Field label above the input |
| `hint` | ReactNode | Helper / error text below |
| `size` | `sm` \| `md` (default `sm`) | Control padding |
| `fontSize` | `xs` \| `sm` \| `md` \| `lg` \| `xl` (default `sm`) | Input text size |
| `placeholder` | string | Empty-state text |
| `icon` | `ComponentType` | Leading `@untitledui/icons` glyph |
| `tooltip` | string | Trailing help tooltip |
| `shortcut` | string \| boolean | Trailing keyboard hint (`⌘K`) |
| `trailingSlot` | ReactNode | Custom trailing content |
| `hideRequiredIndicator` | boolean | Suppress the `*` on the label |
| `inputDataTestId` | string | `data-testid` on the inner `<input>` |
| `isDisabled` / `isInvalid` / `isRequired` / `isReadOnly` | boolean (react-aria) | Field state |
| `value` / `defaultValue` / `onChange` | react-aria `TextField` | Controlled / uncontrolled value |

## States

| State | Treatment |
| --- | --- |
| Default | `tw:outline-primary` border, `tw:bg-primary`, `tw:shadow-xs` |
| Focus | `tw:outline-2 tw:-outline-offset-2 tw:outline-brand` (outline, never a ring) |
| Disabled | `tw:bg-disabled_subtle` + `tw:outline-disabled` + `tw:text-disabled`, `cursor-not-allowed` |
| Invalid | `tw:outline-error_subtle`, trailing `InfoCircle`, hint turns `tw:text-error-primary` |
| Invalid + focus | `tw:outline-error` |

> Borders/focus use `outline`, never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Input } from '@openmetadata/ui-core-components';
import { SearchLg } from '@untitledui/icons';

<Input
  hint={t('message.name-help')}
  icon={SearchLg}
  isRequired
  label={t('label.name')}
  placeholder={t('label.search')}
  size="md"
/>;
```

## Cross-references

- [Checkbox](checkbox.md) · [Toggle](toggle.md) · [Radio](radio.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md) · [../../docs/colors.md](../../docs/colors.md)
