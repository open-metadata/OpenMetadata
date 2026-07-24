# Tags

## Metadata

| | |
| --- | --- |
| **Name** | Tags |
| **Category** | Base / metadata |
| **Status** | Stable |
| **Styles** | [`src/styles/components/tags.less`](../../src/styles/components/tags.less) |
| **Component** | `@openmetadata/ui-core-components` → `Tag`, `TagGroup`, `TagList` (new work); Ant Design `Tag` / legacy `tier-tag` (legacy) |

## Overview

**Use when** representing interactive metadata labels — classification tags,
glossary terms, tiers — that can be selected, counted, or removed.

**Don't use when** the chip is a read-only status or count — use
[Badge](badge.md). Don't use as a button — use [Button](button.md).

## Anatomy

```
┌──────────────────────────────────────┐
│ [☑] ●/avatar  Label   [count]   [×]  │
└──────────────────────────────────────┘
   │      │        │        │       │
   │      │        │        │       └─ close X (removable)
   │      │        │        └─ count chip (bg-tertiary)
   │      │        └─ label: font-weight medium
   │      └─ optional avatar or status dot
   └─ optional selection checkbox
```

Parts: **pill container** (surface + `::after` outline), optional
**checkbox / avatar / dot**, **label**, optional **count chip**, optional
**close X**.

## Tokens used

The only real `--om-*` token in `tags.less` is the corner radius (on
`tier-tag`); the modern core-components Tag maps to the remaining semantics.
Legacy `tier-tag` still uses `@purple-*` LESS variables.

| Part | Token |
| --- | --- |
| Corner radius | `--om-radius-md` |
| Surface | `--om-color-bg-primary` |
| Label text | `--om-color-text-secondary` |
| Count chip surface | `--om-color-bg-tertiary` |
| Hairline outline | `--om-color-border` |
| Focus ring | `--om-color-focus-ring` |
| Tier tint (legacy `@purple-1` / `@purple-5`) | `--om-color-purple-50` / `--om-color-purple-700` |

## Props / API (core-components `Tag` / `TagGroup`)

| Prop | Values |
| --- | --- |
| `TagGroup.label` | string (aria-label, required) |
| `TagGroup.selectionMode` | `none`, `single`, `multiple` |
| `TagGroup.size` | `sm`, `md`, `lg` |
| `Tag.id` | string (required for selection / close) |
| `Tag.count` | number (renders count chip) |
| `Tag.avatarSrc` / `Tag.dot` | leading avatar or status dot |
| `Tag.isDisabled` | boolean |
| `Tag.onClose` | `(id: string) => void` (renders close X) |

## States

| State | Treatment |
| --- | --- |
| Default | `--om-color-bg-primary` + `::after` `--om-color-border` outline |
| Hover | close X surface tints; selectable rows highlight |
| Selected | checkbox checked; `--om-color-interactive-selected` surface |
| Focus | `--om-color-focus-ring` outline (2px, offset 2px) |
| Disabled | dimmed, `cursor: not-allowed` |

> Border on `::after`, focus on `outline` — never `tw:ring-*` — see
> [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```less
/* Layer 3 — component styles reference Layer 2 tokens only */
.custom-tag {
  border-radius: var(--om-radius-md);
  font-weight: var(--om-font-weight-medium);
  background: var(--om-color-bg-primary);
  color: var(--om-color-text-secondary);
  outline: 1px solid var(--om-color-border);
  outline-offset: -1px;

  .tag-count {
    background: var(--om-color-bg-tertiary);
    border-radius: var(--om-radius-sm);
  }
  &.tier-tag {
    background: var(--om-color-purple-50);
    color: var(--om-color-purple-700);
  }
}
```

```tsx
import { Tag, TagGroup, TagList } from '@openmetadata/ui-core-components';
<TagGroup label={t('label.tag-plural')} selectionMode="multiple">
  <TagList>
    <Tag count={3} id="pii" onClose={onRemove}>{t('label.pii')}</Tag>
  </TagList>
</TagGroup>;
```

## Cross-references

- [Badge](badge.md) · [Card](card.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Radius](../foundations/radius.md), [Typography](../foundations/typography.md)
