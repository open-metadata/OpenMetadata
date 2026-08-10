# Tags

## Metadata

| | |
| --- | --- |
| **Name** | Tags |
| **Category** | Base / display |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `TagGroup`, `TagList`, `Tag` |
| **Source** | [`components/base/tags`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/tags) |

> Go-forward (UntitledUI + Tailwind `tw:` only). Built on `react-aria-components`
> `TagGroup`/`TagList`/`Tag`. No LESS `--om-*`.

## Overview

**Use when** rendering a set of selectable or removable chips — filters,
applied labels, multi-select values. Wrap `Tag`s in `TagList` inside a
`TagGroup` so keyboard selection/removal works.

**Don't use when** the chip is a static status label — use a [Badge](badge.md);
for actions use a [Button](button.md).

## Anatomy

```
TagGroup ▸ TagList
  ┌──────────────────────────────────────┐
  │ [☑] [avatar|dot]  label  [count] [×] │  ← checkbox · addon · label · count · close
  └──────────────────────────────────────┘
     └─ AriaTag root: rounded-md · bg-primary · ::after outline border · focus outline
```

Parts: **root** (`AriaTag`, `tw:bg-primary` surface), optional **checkbox**
(`selectionMode`), **leading addon** (`Avatar`/`Dot`), **label**, optional
**count** pill, optional **close X** (`onClose`/`allowsRemoving`).

## Tokens used

| Part | `tw:` utility (from tsx) |
| --- | --- |
| Root layout | `tw:relative tw:flex tw:items-center tw:cursor-default` |
| Radius / surface | `tw:rounded-md tw:bg-primary tw:text-secondary` |
| Border | `borderAfter` → `tw:after:outline-primary` (never `tw:border`/`tw:ring-*`) |
| Focus | `tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2 tw:focus-visible:outline-focus-ring` |
| Count pill | `tw:bg-tertiary tw:text-center` + `tw:font-medium` |
| Dot addon | `tw:text-fg-success-secondary` |
| Text size | `tw:text-xs` (sm) · `tw:text-sm` (md/lg) · `tw:font-medium` |
| Disabled | `tw:cursor-not-allowed` |

## Props / API

| Prop | Values |
| --- | --- |
| `TagGroup.selectionMode` | `none` (default), `single`, `multiple` |
| `TagGroup.size` / `Tag` size | `sm` (default), `md`, `lg` (via context) |
| `TagGroup.label` | accessible group label (string) |
| `Tag.id` | string identifier |
| `Tag.avatarSrc` / `avatarContrastBorder` | leading `Avatar` |
| `Tag.dot` / `dotClassName` | leading status `Dot` |
| `Tag.count` | number → count pill |
| `Tag.isDisabled` | boolean |
| `Tag.onClose` | `(id) => void` → renders close X |

## States

| State | Treatment |
| --- | --- |
| Default | `tw:bg-primary` + `::after` `tw:after:outline-primary` border |
| Selected | `selectionMode` checkbox checked (react-aria `isSelected`) |
| Focus-visible | `tw:focus-visible:outline-2 tw:outline-focus-ring` |
| Removable / disabled | close X shown when `onClose`/`allowsRemoving`; `tw:cursor-not-allowed` |

> Border on `::after` via `borderAfter`; focus is the element `outline` — never
> `tw:ring-*`. See [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Tag, TagGroup, TagList } from '@openmetadata/ui-core-components';

<TagGroup label={t('label.filter-plural')} selectionMode="multiple" size="md">
  <TagList>
    <Tag count={12} id="pii" onClose={onRemove}>
      {t('label.pii')}
    </Tag>
  </TagList>
</TagGroup>;
```

## Cross-references

- Siblings: [Badge](badge.md) · [Avatar](avatar.md) · [Button](button.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
