# TextArea

## Metadata

| | |
| --- | --- |
| **Name** | TextArea |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `TextArea` (also `TextAreaBase` for the bare control) |
| **Source** | [`components/base/textarea`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/textarea) |

## Overview

**Use when** collecting multi-line free text — descriptions, comments,
SQL/config snippets, anything that can wrap or grow past one line.

**Don't use when** the input is a single value (use `Input`), a choice from a
set (use `Select`), or a bounded number on a scale (use `Slider`).

## Anatomy

```
Label *  (?)                         ← Label + required mark + optional tooltip
┌──────────────────────────────┐
│ placeholder / value           │    ← textarea surface: outline border + shadow
│                             ◿ │    ← resize handle (::-webkit-resizer)
└──────────────────────────────┘
Hint text                            ← HintText, error-colored when invalid
```

Parts: **field wrapper** (`group`, vertical stack), **Label** (required `*`,
tooltip), **textarea surface**, **resize handle**, **HintText**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Surface / text / placeholder | `tw:bg-primary` · `tw:text-primary` · `tw:placeholder:text-placeholder` |
| Border (rest) | `tw:outline-1 tw:-outline-offset-1 tw:outline-primary` |
| Border (focus) | `tw:outline-2 tw:-outline-offset-2 tw:outline-brand` |
| Elevation / radius / padding | `tw:shadow-xs` · `tw:rounded-lg` · `tw:px-3.5 tw:py-3` |
| Disabled | `tw:bg-disabled_subtle tw:text-disabled tw:outline-disabled` |
| Error (rest → focus) | `tw:outline-error_subtle` → `tw:outline-2 tw:outline-error` |
| Wrapper spacing | `tw:flex tw:flex-col tw:gap-1.5` |

## Props / API

| Prop | Type / values |
| --- | --- |
| `label` | string |
| `hint` | ReactNode (below the control) |
| `tooltip` | string (after the label) |
| `placeholder` | string |
| `size` | `xs` · `sm` · `md` · `lg` · `xl` (font size) |
| `rows` / `cols` | number |
| `hideRequiredIndicator` | boolean |
| `textAreaClassName` / `textAreaRef` | class / ref for the inner `<textarea>` |
| Aria (`AriaTextFieldProps`) | `value`, `defaultValue`, `onChange`, `isDisabled`, `isRequired`, `isInvalid`, `isReadOnly`, `name` |

## States

| State | Treatment |
| --- | --- |
| Default | `tw:outline-primary` + `tw:shadow-xs` |
| Focus | `tw:outline-2 tw:outline-brand` (outline, never `tw:ring-*`) |
| Disabled | `tw:bg-disabled_subtle` + `tw:text-disabled`, `cursor-not-allowed` |
| Error | `tw:outline-error_subtle`, hint rendered in error color |
| Error + focus | `tw:outline-2 tw:outline-error` |

> Border/focus use `outline`, never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { TextArea } from '@openmetadata/ui-core-components';

<TextArea
  className="tw:max-w-md"
  hint={t('label.description')}
  label={t('label.description')}
  placeholder={t('label.description')}
  rows={4}
  size="md"
/>;
```

## Cross-references

- [Select](select.md) · [Slider](slider.md) · [Tooltip](tooltip.md)
- Foundations: [Tailwind](../foundations/tailwind.md) · [Utility reference](../tokens/tailwind-utility-reference.md)
