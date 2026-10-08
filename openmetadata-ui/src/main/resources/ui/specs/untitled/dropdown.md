# Dropdown

## Metadata

| | |
| --- | --- |
| **Name** | Dropdown |
| **Category** | Base / menu |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Dropdown` (`Root`, `Popover`, `Menu`, `Item`, `SubmenuTrigger`, `Section`, `SectionHeader`, `Separator`, `DotsButton`) |
| **Source** | [`components/base/dropdown`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/dropdown) |
| **Storybook** | `Components/Dropdown` (Default, WithSections, WithAddon, WithDisabledItem, WithSelection, WithCheckboxes, NestedSubmenus) |

## Overview

**Use when** a trigger opens a list of actions (row "⋮" menu, toolbar
overflow), or a short list the user picks one or more entries from without a
form field: a filter or a sort order.

**Don't use when** the value is part of a form with a label and validation:
use [Select](select.md). For a filter chip with search, counts and Apply/Clear,
use `FilterSelect`, which is built on `Dropdown`.

## Anatomy

```
[⋮] / [Button]                     ← trigger: Dropdown.DotsButton or any Button
  ┌──────────────────────────────┐ ← Dropdown.Popover (overlay surface, raised)
  │ SECTION HEADER               │ ← Dropdown.SectionHeader (optional)
  │ [☐] [icon] Label     [addon] │ ← Dropdown.Item
  │ [☑] [icon] Label     [addon] │ ← selected: brand bg, icon, label, addon
  │      [icon] Label          › │ ← opens a submenu (Dropdown.SubmenuTrigger)
  │ ──────────────────────────── │ ← Dropdown.Separator
  │      [icon] Label (disabled) │
  └──────────────────────────────┘
```

Parts: **trigger**, **popover**, **menu**, **item** (optional checkbox, icon,
label, addon, submenu chevron), **submenu**, **section** + **header**,
**separator**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Popover surface | `tw:bg-overlay-surface tw:shadow-raised tw:outline-1 tw:outline-secondary_alt tw:rounded-lg` |
| Popover width | `tw:w-62` (override via `className`) |
| Item hover / focus | `tw:bg-primary_hover` |
| Item focus-visible | `tw:outline-2 tw:-outline-offset-2 tw:outline-focus-ring` |
| Item selected | `tw:bg-brand-primary` |
| Label (rest / focus / selected / disabled) | `tw:text-secondary` · `tw:text-secondary_hover` · `tw:text-brand-secondary` · `tw:text-disabled` |
| Icon (rest / selected / disabled) | `tw:text-fg-quaternary` · `tw:text-fg-brand-secondary_alt` · `tw:text-fg-disabled` |
| Addon (rest / selected / disabled) | `tw:text-quaternary tw:outline-secondary` · `tw:text-brand-secondary tw:outline-utility-brand-200` · `tw:text-disabled` |
| Submenu chevron | `tw:text-fg-quaternary` |
| Separator | `tw:border-t tw:border-subtle` |

## Props / API

**`Dropdown.Item`** (extends react-aria `MenuItemProps`)

| Prop | Type / values |
| --- | --- |
| `label` | string (or pass `children`) |
| `icon` | `FC<{ className?: string }>`, a leading icon |
| `addon` | string, a trailing badge: keyboard shortcut or count |
| `showCheckbox` | boolean, a leading checkbox that reflects selection |
| `checkboxSize` | `xs` · `sm` (default `sm`) |
| `unstyled` | boolean, renders a bare `MenuItem` for fully custom content |
| Aria | `id`, `isDisabled`, `onAction`, `href`, `textValue` |

**`Dropdown.Menu`** (react-aria `MenuProps`)

| Prop | Type / values |
| --- | --- |
| `selectionMode` | `single` (default) · `multiple` · `none` |
| `selectedKeys` / `defaultSelectedKeys` | `Iterable<Key>`, drives the selected state |
| `onSelectionChange` / `onAction` | callbacks |
| `disallowEmptySelection` | default `true`; pass `false` for clearable multi-select |

**`Dropdown.Popover`**: `placement` (default `bottom right`; any react-aria
placement, e.g. `right bottom` to open beside a sidebar trigger, `end bottom`
to mirror under RTL; flips automatically when it does not fit), `offset`
(default `4`), `crossOffset`, `className` (override the `tw:w-62` width). Its
children are free-form, so a header can sit above `Dropdown.Menu`.

**`Dropdown.SubmenuTrigger`** (react-aria `SubmenuTrigger`): wrap a
`Dropdown.Item` followed by a `Dropdown.Popover` holding its own
`Dropdown.Menu`. Nest it inside that menu for further levels. The item gets a
trailing chevron automatically. Give submenu popovers `placement="end top"`,
since the `Dropdown.Popover` default (`bottom right`) is meant for the root.

```tsx
<Dropdown.SubmenuTrigger>
  <Dropdown.Item id="appearance" label={t('label.appearance')} />
  <Dropdown.Popover placement="end top">
    <Dropdown.Menu selectedKeys={theme} onSelectionChange={setTheme}>
      <Dropdown.Item id="light" label={t('label.light')} />
      <Dropdown.Item id="dark" label={t('label.dark')} />
    </Dropdown.Menu>
  </Dropdown.Popover>
</Dropdown.SubmenuTrigger>
```

## States

| State | Treatment |
| --- | --- |
| Default | label `tw:text-secondary`, icon `tw:text-fg-quaternary` |
| Hover / Focus | row `tw:bg-primary_hover` |
| Focus-visible | `tw:outline-2 tw:outline-focus-ring` inside the row |
| Selected | row `tw:bg-brand-primary`; icon, label and addon go brand; the tint holds under hover |
| Selected + checkbox | checkbox checked; the row also tints, so suppress the background via `className` if the checkbox should carry selection alone (as `FilterSelect` does) |
| Disabled | `tw:text-disabled` / `tw:text-fg-disabled`, `cursor-not-allowed` |

> Borders use `outline`, never `tw:ring-*`. See [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Button, Dropdown } from '@openmetadata/ui-core-components';

<Dropdown.Root>
  <Button color="secondary">{t('label.option')}</Button>
  <Dropdown.Popover>
    <Dropdown.Menu
      aria-label={t('label.option')}
      selectedKeys={selected}
      onSelectionChange={setSelected}>
      {options.map((option) => (
        <Dropdown.Item
          addon={option.count.toLocaleString()}
          icon={Folder}
          id={option.id}
          key={option.id}
          label={option.name}
        />
      ))}
    </Dropdown.Menu>
  </Dropdown.Popover>
</Dropdown.Root>;
```

## Cross-references

- [Select](select.md) · [Checkbox](checkbox.md) · [Button](button.md)
- Legacy: [Menu](../components/menu.md)
- Foundations: [Tailwind](../foundations/tailwind.md) · [Utility reference](../tokens/tailwind-utility-reference.md)
