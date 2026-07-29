# Tabs

## Metadata

| | |
| --- | --- |
| **Name** | Tabs |
| **Category** | Navigation |
| **Status** | Stable |
| **Styles** | [`src/styles/components/tabs.less`](../../src/styles/components/tabs.less) |
| **Component** | `@openmetadata/ui-core-components` → `Tabs` (new work); Ant Design `Tabs` (legacy) |

## Overview

**Use when** one region swaps between peer views of the same context — entity
detail sections (Schema, Lineage, Profiler), settings panes.

**Don't use when** the panels are independent destinations (use nav links) or
there is only one panel (drop the tab strip entirely).

## Anatomy

```
┌──────────────────────────────────────────────┐
│  Schema   Lineage   Profiler [3]   Queries    │  ← tab list (nav strip)
│  ───────                                       │  ← ink bar under active tab
├──────────────────────────────────────────────┤
│  panel content                                 │  ← Tabs.Panel
└──────────────────────────────────────────────┘
```

Parts: **tab list** (`Tabs.List`), **tab** (`Tabs.Item` — label + optional
count `badge`), **ink bar / active indicator**, **panel** (`Tabs.Panel`).

## Tokens used

| Part | Token |
| --- | --- |
| Active-tab weight | `--om-font-weight-semibold`, inactive `--om-font-weight-medium` |
| Gap between tabs | `--om-space-24` |
| Nav strip padding | `--om-space-20`, `--om-space-24` |
| Tab vertical padding | `--om-space-8` |
| Nav strip radius (`tabs-new`) | `--om-radius-xl` |
| Expand-icon font size | `--om-font-size-xl` |
| Active tab / ink bar (semantic) | `--om-color-fg-brand` |
| Inactive tab text (semantic) | `--om-color-text-tertiary` |

> Legacy `@`-vars (`@primary-color`, `@text-color-tertiary`, `@grey-15`) carry
> color in the `.less`; new work should reference the semantic tokens.

## Props / API (core-components `Tabs`)

| Member / prop | Purpose |
| --- | --- |
| `Tabs.List` | Tab strip; `type`, `orientation`, `size`, `fullWidth`, `items` |
| `Tabs.Item` | Single tab; `label`, `badge`, `isDisabled` |
| `Tabs.Panel` | Panel body for a tab key |
| `type` | `button-brand`, `button-gray`, `button-border`, `button-minimal`, `underline` / `line` |
| `orientation` | `horizontal`, `vertical` |
| `size` | `sm`, `md` |

## States

| State | Treatment |
| --- | --- |
| Active | `--om-font-weight-semibold`, brand text/ink bar `--om-color-fg-brand` |
| Inactive | `--om-color-text-tertiary`, `--om-font-weight-medium` |
| Hover | brand-tinted surface / text per `type` |
| Focus | `--om-color-focus-ring` outline (2px, offset 2px) — never a `ring-*` |
| Disabled | dimmed text, `cursor: not-allowed`, not selectable |

## Code example

```less
.custom-tabs {
  .ant-tabs-tab {
    color: var(--om-color-text-tertiary);
    padding: var(--om-space-8) 0;
  }
  .ant-tabs-tab + .ant-tabs-tab {
    margin-left: var(--om-space-24);
  }
  .ant-tabs-tab.ant-tabs-tab-active {
    color: var(--om-color-fg-brand);
    font-weight: var(--om-font-weight-semibold);
  }
}
```

```tsx
import { Tabs } from '@openmetadata/ui-core-components';
<Tabs>
  <Tabs.List type="underline">
    <Tabs.Item id="schema" label={t('label.schema')} />
    <Tabs.Item badge={3} id="profiler" label={t('label.profiler')} />
  </Tabs.List>
  <Tabs.Panel id="schema">{/* content */}</Tabs.Panel>
</Tabs>;
```

## Cross-references

- [Table](table.md) · [Step](step.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Radius](../foundations/radius.md)
