# Form

## Metadata

| | |
| --- | --- |
| **Name** | Form |
| **Category** | Data entry |
| **Status** | Stable |
| **Styles** | [`src/styles/components/form.less`](../../src/styles/components/form.less) |
| **Component** | `@openmetadata/ui-core-components` → `HookForm` / `Form` (new work); Ant Design `Form` (legacy) |

## Overview

**Use when** collecting structured input the user submits — service
connections, entity metadata, settings. New forms use the react-hook-form +
react-aria `HookForm` stack (see [`docs/formutils.md`](../../docs/formutils.md)).

**Don't use when** a single inline control (search box, filter) suffices — a
full form implies a validated, submittable payload.

## Anatomy

```
┌─────────────────────────────────────────┐
│  Name *                                  │  ← label + required mark (right side)
│  ┌─────────────────────────────────────┐ │
│  │ input                               │ │  ← field control
│  └─────────────────────────────────────┘ │
│  Helper / error text                     │
│                          [Cancel] [Save] │  ← footer actions
└─────────────────────────────────────────┘
```

Parts: **form container** (surface, padding, radius, shadow), **field**
(label + required mark + control), **helper / error text**, **footer actions**.

## Tokens used

| Part | Token |
| --- | --- |
| Container vertical / horizontal padding | `--om-space-28`, `--om-space-20` |
| Container radius | `--om-radius-lg` |
| Container shadow | `--om-legacy-color-0-0-0-0-04` (soft drop) |
| Required-mark left margin | `--om-space-4` |
| Required-mark font size | `--om-font-size-sm` |
| Block-editor bottom padding | `--om-space-75` |
| Field border (semantic) | `--om-color-border` |
| Focus / hover border (semantic) | `--om-color-border-brand` |
| Required mark / error text (semantic) | `--om-color-text-error` |

> Legacy `@`-vars (`@grey-300`, `@primary-5`, `@red-14`, `@highlight-color`)
> carry color in the `.less`; new work should reference the semantic tokens.

## Props / API (core-components `HookForm`)

| Prop | Purpose |
| --- | --- |
| `form` | `UseFormReturn` from `react-hook-form` |
| `onSubmit` | submit handler (react-aria `Form`) |
| `showFieldDocs` | render per-field documentation |
| `fieldDocDisplay` | `popover` (default), `panel` |
| `formClassName` | classes for the scrolling form column |

Fields are composed with `getField` / `FieldProp` / `FormFields`.

## States

| State | Treatment |
| --- | --- |
| Default | border `--om-color-border`, radius `--om-radius-sm` |
| Focus / hover | border `--om-color-border-brand` |
| Error | border `--om-color-border-error`, message `--om-color-text-error` |
| Disabled | `--om-color-bg-disabled` + `--om-color-text-disabled`, `cursor: not-allowed` |

## Code example

```less
.custom-form {
  .form-container {
    padding: var(--om-space-28) var(--om-space-20);
    border-radius: var(--om-radius-lg);
    box-shadow: 2px 4px 10px var(--om-legacy-color-0-0-0-0-04);
  }
  .ant-input {
    border-color: var(--om-color-border);
    &:hover,
    &:focus {
      border-color: var(--om-color-border-brand);
    }
  }
  .ant-form-item-required::after {
    margin-left: var(--om-space-4);
    font-size: var(--om-font-size-sm);
    color: var(--om-color-text-error);
    content: '*';
  }
}
```

```tsx
import { HookForm } from '@openmetadata/ui-core-components';
<HookForm form={form} onSubmit={onSubmit}>
  {/* getField(...) fields */}
  <Button color="primary" type="submit">{t('label.save')}</Button>
</HookForm>;
```

## Cross-references

- [Table](table.md) · [Tabs](tabs.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Radius](../foundations/radius.md)
