# Select

## Metadata

| | |
| --- | --- |
| **Name** | Select |
| **Category** | Base / form |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Select` (with `Select.Item`, `Select.ComboBox`) |
| **Source** | [`components/base/select`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/select) |

## Overview

**Use when** the user picks one value from a known set — an owner, a service
type, a status. Pair with `Select.ComboBox` when the list is long enough to
need typeahead filtering.

**Don't use when** entering free text (use `TextArea`/`Input`) or toggling a
single boolean (use `Toggle`).

## Anatomy

```
Label *  (?)                         ← Label + required mark + optional tooltip
┌──────────────────────────────┐
│ [icon] Selected value      ⌄ │    ← trigger button + ChevronDown
└──────────────────────────────┘
  ┌────────────────────────────┐    ← Popover listbox (open)
  │ [icon] Item        ✓        │    ← SelectItem, ✓ on selected
  │ [av]   Item  supporting     │
  └────────────────────────────┘
Hint text
```

Parts: **Label**, **trigger** (`SelectValue` button + chevron), **Popover**,
**listbox** of `SelectItem` (avatar/icon, label, supporting text, check),
**empty state**, **HintText**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Trigger surface | `tw:bg-primary tw:shadow-xs` |
| Trigger border (rest → focus/open) | `tw:outline-1 tw:-outline-offset-1 tw:outline-primary` → `tw:outline-2 tw:outline-brand` |
| Trigger disabled | `tw:bg-disabled_subtle tw:text-disabled` |
| Placeholder / chevron | `tw:text-placeholder` · `tw:text-fg-quaternary` |
| Item selected / hover / focus-ring | `tw:bg-active` · `tw:bg-primary_hover` · `tw:outline-2 tw:outline-focus-ring` |
| Item check icon | `tw:text-fg-brand-primary` |
| Item label / supporting / empty | `tw:text-primary` · `tw:text-tertiary` · `tw:text-tertiary` |
| Radius (trigger / item) | `tw:rounded-lg` · `tw:rounded-md` |

## Props / API

| Prop | Type / values |
| --- | --- |
| `items` | `SelectItemType[]` (`id`, `label`, `avatarUrl`, `supportingText`, `icon`, `isDisabled`) |
| `children` | `ReactNode` \| `(item) => ReactNode` — renders `Select.Item`s |
| `label` / `hint` / `tooltip` | string |
| `placeholder` | string (default `Select`) |
| `size` | `sm` · `md` (control padding) |
| `fontSize` | `xs` · `sm` · `md` · `lg` · `xl` |
| `icon` | leading `FC` \| `ReactNode` |
| `emptyState` | ReactNode (no-results content) |
| `popoverClassName` | string |
| Aria (`AriaSelectProps`) | `selectedKey`, `defaultSelectedKey`, `onSelectionChange`, `isDisabled`, `isRequired`, `isInvalid`, `name` |

## States

| State | Treatment |
| --- | --- |
| Default | `tw:outline-primary` + `tw:shadow-xs` |
| Focus / Open | `tw:outline-2 tw:outline-brand`; Popover listbox visible |
| Selected option | `tw:bg-active` row + `tw:text-fg-brand-primary` check |
| Option hover | `tw:bg-primary_hover` |
| Disabled | `tw:bg-disabled_subtle` + `tw:text-disabled`, `cursor-not-allowed` |
| Invalid | hint rendered in error color |

> Border/focus use `outline`, never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Select } from '@openmetadata/ui-core-components';

<Select
  className="tw:max-w-xs"
  label={t('label.owner')}
  placeholder={t('label.owner')}
  size="md">
  <Select.Item id="admin" label={t('label.admin')} />
  <Select.Item id="bot" label={t('label.bot')} />
</Select>;
```

## Cross-references

- [TextArea](textarea.md) · [Slider](slider.md) · [Tooltip](tooltip.md)
- Foundations: [Tailwind](../foundations/tailwind.md) · [Utility reference](../tokens/tailwind-utility-reference.md)
