# Select

## Metadata

| | |
| --- | --- |
| **Name** | Select |
| **Category** | Base / input |
| **Status** | Stable |
| **Styles** | [`src/styles/components/select.less`](../../src/styles/components/select.less) |
| **Component** | `@openmetadata/ui-core-components` → `Select`, `Select.ComboBox`, `MultiSelect` (new work); Ant Design `Select` (legacy) |

## Overview

**Use when** the user picks one value (`Select`), types to filter one value
(`Select.ComboBox`), or picks several as removable tags (`MultiSelect`) from a
known set of options.

**Don't use when** the set is binary — use a [Toggle](toggle-switch.md); or
free text with no fixed options — use an input.

## Anatomy

```
┌─────────────────────────────┐
│ [icon] Selected value    ⌄  │  ← trigger: surface, border(outline), chevron
└─────────────────────────────┘
┌─────────────────────────────┐
│ ○ Option a                  │  ← popover listbox
│ ● Option b   (selected)     │
└─────────────────────────────┘
```

Parts: **trigger** (surface, outline border, leading icon, value/placeholder,
chevron), **popover** listbox, **option** (label + supporting text + selected
state), **label / hint**, **focus ring** (outline).

## Tokens used

| Part | Token |
| --- | --- |
| Trigger margin / value gap | `--om-space-8` |
| Corner radius | `--om-radius-lg` |
| Surface | `--om-color-bg-primary` |
| Rest border (outline) | `--om-color-border` |
| Focus / open border | `--om-color-border-brand`, `--om-color-focus-ring` |
| Shadow | `--om-shadow-xs` (trigger), `--om-shadow-lg` (popover) |
| Value / supporting text | `--om-color-text-primary` / `--om-color-text-tertiary` |
| Placeholder | `--om-color-text-placeholder` |
| Selected option | `--om-color-interactive-selected` |
| Disabled | `--om-color-bg-disabled`, `--om-color-text-disabled` |
| Transition | `--om-duration-instant` |

## Props / API (core-components `Select`)

| Prop | Values |
| --- | --- |
| `items` | `SelectItemType[]` (`id`, `label`, `icon`, `avatarUrl`, `supportingText`, `isDisabled`) |
| `size` | `sm`, `md` |
| `fontSize` | `xs`, `sm`, `md`, `lg`, `xl` |
| `label` / `hint` / `tooltip` | string |
| `placeholder` | string (default `Select`) |
| `icon` | `FC` \| `ReactNode` |
| `emptyState` | `ReactNode` |
| `isDisabled` / `isRequired` / `isInvalid` | boolean (via `AriaSelectProps`) |
| subcomponents | `Select.Item`, `Select.ComboBox` |
| ComboBox extras | `shortcut`, `showSearchIcon` |
| MultiSelect extras | `selectedItems` (`ListData`), `onItemInserted`, `onItemCleared` |

## States

| State | Treatment |
| --- | --- |
| Default | `--om-color-bg-primary` + `--om-color-border` outline + `--om-shadow-xs` |
| Hover | border → `--om-color-border-brand` |
| Focus / open | `--om-color-border-brand` 2px outline; popover open with `--om-shadow-lg` |
| Selected option | row background `--om-color-interactive-selected` |
| Disabled | `--om-color-bg-disabled` + `--om-color-text-disabled`, `cursor: not-allowed` |
| Error | border `--om-color-border-error`, hint `--om-color-text-error` |

> Border/focus use `outline` (1px rest → 2px focus), never `tw:ring-*` — see
> [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-select {
  margin: var(--om-space-8) 0;
  border-radius: var(--om-radius-lg);
  background: var(--om-color-bg-primary);
  outline: 1px solid var(--om-color-border);
  box-shadow: var(--om-shadow-xs);
  transition: outline-color var(--om-duration-instant) ease;

  &:focus-within {
    outline: 2px solid var(--om-color-border-brand);
  }
}
```

```tsx
import { Select } from '@openmetadata/ui-core-components';
<Select
  items={owners}
  label={t('label.owner')}
  placeholder={t('label.select-field')}>
  {(item) => <Select.Item>{item.label}</Select.Item>}
</Select>;
```

## Cross-references

- [Toggle switch](toggle-switch.md) · [Slider](slider.md) · [Badge](badge.md)
- Foundations: [Color](../foundations/color.md), [Radius](../foundations/radius.md), [Elevation](../foundations/elevation.md), [Motion](../foundations/motion.md)
