# Avatar

## Metadata

| | |
| --- | --- |
| **Name** | Avatar |
| **Category** | Base / display |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Avatar` (+ `AvatarLabelGroup`, `AvatarProfilePhoto`) |
| **Source** | [`components/base/avatar`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/avatar) |

> Go-forward (UntitledUI + Tailwind `tw:` only). No LESS `--om-*`.

## Overview

**Use when** representing a user, team, or service by photo, initials, or icon —
owner columns, member lists, comment authors.

**Don't use when** you need an entity/status label — use a [Badge](badge.md); to
show an avatar inside a removable chip, use [Tags](tags.md) `avatarSrc`.

## Anatomy

```
   ┌─────────┐
   │  image  │● ← status / verified / badge overlay (bottom-right)
   │ initials│
   └─────────┘
      └─ div root: rounded-full · bg-tertiary · contrast outline border · size box
```

Parts: **root** (`div`, `tw:rounded-full` surface), **main content** (`img` →
`initials` → `placeholderIcon` → `User01` fallback), optional **overlay**
(`status` dot / `verified` tick / `badge`).

## Tokens used

| Part | `tw:` utility (from tsx) |
| --- | --- |
| Root layout | `tw:relative tw:inline-flex tw:items-center tw:justify-center tw:shrink-0` |
| Surface / shape | `tw:rounded-full tw:bg-tertiary` |
| Size box | `tw:size-4` (xxs) … `tw:size-10` (md) … `tw:size-16` (2xl) |
| Contrast border | `tw:outline tw:outline-avatar-contrast-border` + `tw:outline-1 tw:-outline-offset-1` |
| Image | `tw:size-full tw:rounded-full tw:object-cover` |
| Initials | `tw:text-quaternary tw:font-semibold` |
| Icon fallback | `tw:text-fg-quaternary` |
| Focus (focusable) | `tw:group-focus-visible:outline-2 tw:group-focus-visible:outline-offset-2` |

## Props / API

| Prop | Values |
| --- | --- |
| `size` | `xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `2xl` (default `md`) |
| `src` / `alt` | image URL (falls back on error) / alt text |
| `initials` | string shown when no image |
| `placeholderIcon` / `placeholder` | icon component / node fallback (else `User01`) |
| `badge` | node overlay (e.g. company logo) |
| `status` | `online`, `offline` (indicator dot) |
| `verified` | boolean (verified tick overlay) |
| `contrastBorder` | boolean (default `true`) |
| `focusable` | boolean (default `false`) — shows ring when parent group focused |

## States

| State | Treatment |
| --- | --- |
| Image | `<img>` rendered when `src` set and not failed |
| Initials fallback | `tw:text-quaternary` initials when no/failed image |
| Icon fallback | `User01` `tw:text-fg-quaternary` when no image/initials |
| Contrast border | `tw:outline-avatar-contrast-border` (default on) |
| Status / verified | overlay dot or tick, bottom-right |
| Focusable | `tw:group-focus-visible:outline-2` when parent group focused |

> Border/focus use `outline`, never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Avatar } from '@openmetadata/ui-core-components';

<Avatar
  alt={t('label.owner')}
  initials="TC"
  size="md"
  src={ownerImageUrl}
  status="online"
/>;
```

## Cross-references

- Siblings: [Tags](tags.md) · [Badge](badge.md) · [Button](button.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
