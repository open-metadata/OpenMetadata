# Tabs

## Metadata

| | |
| --- | --- |
| **Name** | Tabs |
| **Category** | Application |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Tabs` (+ `Tab` / `TabList` / `TabPanel`) |
| **Source** | [`components/application/tabs`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/application/tabs) |

Go-forward (UntitledUI + Tailwind, `tw:` only). Legacy spec: [../components/tabs.md](../components/tabs.md).

## Overview

**Use when** one region swaps between peer views of the same context — entity
detail sections (Schema, Lineage, Profiler), settings panes.

**Don't use when** the panels are independent destinations (use nav links) or
there is only one panel (drop the tab strip).

## Anatomy

```
┌──────────────────────────────────────────────┐
│  Schema   Lineage   Profiler [3]   Queries    │ ← Tabs.List → Tabs.Item (+ badge)
│  ───────                                       │ ← active indicator (underline)
├──────────────────────────────────────────────┤
│  Tabs.Panel content                            │
└──────────────────────────────────────────────┘
```

Parts: **`Tabs.List`** (strip), **`Tabs.Item`** (label + optional count `badge`),
active indicator (underline border / brand-tinted surface), **`Tabs.Panel`**.

## Tokens used

| Part | `tw:` utility |
| --- | --- |
| Tab base | `tw:rounded-md` `tw:text-quaternary` `tw:gap-2` `tw:transition` |
| Active / inactive weight | `tw:font-semibold` / `tw:font-medium` |
| Active text (brand types) | `tw:text-brand-secondary` |
| Underline ink bar (active) | `tw:border-fg-brand-primary_alt` (`tw:border-b-2`) |
| Underline strip base line | `tw:before:bg-border-secondary` |
| `button-brand` surface | `tw:bg-brand-primary_alt` |
| Hover text (`button-gray`) | `tw:text-secondary` |
| Focus ring | `tw:outline-focus-ring tw:outline-2 tw:-outline-offset-2` |

## Props / API

| Member / prop | Purpose |
| --- | --- |
| `Tabs` | Root; `keyboardActivation` (default `manual`) |
| `Tabs.List` | Strip; `type`, `orientation`, `size`, `fullWidth`, `items` |
| `Tabs.Item` | Tab; `label`, `badge`, `id`, `isDisabled` |
| `Tabs.Panel` | Panel body for a tab `id` |
| `type` | `button-brand`, `button-gray`, `button-border`, `button-minimal`, `underline` / `line` |
| `orientation` / `size` | `horizontal`/`vertical` · `sm`/`md` |

## States

| State | Treatment |
| --- | --- |
| Active | `tw:font-semibold`, `tw:text-brand-secondary` / underline `tw:border-fg-brand-primary_alt` |
| Inactive | `tw:text-quaternary` `tw:font-medium` |
| Hover | brand-tinted surface / text per `type` (`tw:bg-brand-primary_alt`, `tw:text-secondary`) |
| Focus | `tw:outline-2 tw:-outline-offset-2 tw:outline-focus-ring` — never `tw:ring-*` |
| Disabled | `isDisabled` — dimmed, not selectable |

> Focus + `button-minimal` selected border use `outline` / `borderAfter`, never
> `tw:ring-*` — see [../../docs/colors.md §2.3.1](../../docs/colors.md).

## Code example

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

- [Table](table.md) · [Pagination](pagination.md) · [Modal](modal.md)
- [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
