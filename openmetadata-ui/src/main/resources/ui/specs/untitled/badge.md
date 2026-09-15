# Badge

## Metadata

| | |
| --- | --- |
| **Name** | Badge |
| **Category** | Base / display |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Badge` (+ `BadgeWithDot`, `BadgeWithIcon`, `BadgeWithButton`, `BadgeWithFlag`, `BadgeWithImage`, `BadgeIcon`) |
| **Source** | [`components/base/badges`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/badges) |

> Go-forward (UntitledUI + Tailwind `tw:` only). No LESS `--om-*`.

## Overview

**Use when** labelling status, category, or a small count inline (entity type,
test status, tag count). Non-interactive except `BadgeWithButton` (dismiss).

**Don't use when** the element triggers navigation or a primary action — use a
[Button](button.md); for selectable/removable chips use [Tags](tags.md).

## Anatomy

```
┌───────────────────────────┐
│ [dot|icon|img]  label  [×]│  ← optional leading addon · text · optional addon/close
└───────────────────────────┘
   └─ span root: rounded (full=pill / md=color·modern) · outline border · size padding
```

Parts: **root** (`span`, color surface + `tw:outline-1 tw:-outline-offset-1`
border), **label**, optional **addon** (`Dot`/icon/flag/image), optional
**addonButton** (dismiss `button`).

## Tokens used

| Part | `tw:` utility (from tsx) |
| --- | --- |
| Root layout | `tw:flex tw:items-center tw:whitespace-nowrap tw:size-max` |
| Radius | `tw:rounded-full` (pill), `tw:rounded-md` (color / modern) |
| Filled surface (gray) | `tw:bg-utility-gray-50 tw:text-utility-gray-700 tw:outline-utility-gray-200` |
| Modern surface | `tw:bg-primary tw:text-secondary tw:outline-primary tw:shadow-xs` |
| Border | `tw:outline-1 tw:-outline-offset-1` (when `bordered`) — never `tw:ring-*` |
| Addon (dot/icon) | `tw:text-utility-gray-500` (per color) |
| Dismiss button hover | `tw:hover:bg-utility-gray-100 tw:hover:text-utility-gray-500` |
| Text size | `tw:text-xs` (sm) · `tw:text-sm` (md/lg) |

## Props / API

| Prop | Values |
| --- | --- |
| `type` | `pill-color` (default), `color`, `modern` |
| `size` | `xs`, `sm`, `md`, `lg` (default `md`) |
| `color` | `gray`, `brand`, `error`, `warning`, `success`, `gray-blue`, `blue-light`, `blue`, `indigo`, `purple`, `pink`, `orange`, `blue-dark` (default `gray`) |
| `bordered` | boolean (default `true`) |
| `iconLeading` / `iconTrailing` | `@untitledui/icons` (`BadgeWithIcon`) |
| `flag` / `imgSrc` | flag code / image URL (flag & image variants) |
| `buttonLabel` / `onButtonClick` / `isDisabled` | dismiss button (`BadgeWithButton`) |

## States

| State | Treatment |
| --- | --- |
| Default | color surface + `tw:outline-1 tw:-outline-offset-1` border |
| No border | `bordered={false}` drops the outline |
| Dismiss hover | addonButton `tw:hover:bg-utility-*-100` |
| Dismiss focus | `tw:focus-visible:outline-2 tw:outline-focus-ring` |
| Dismiss disabled | `tw:cursor-not-allowed tw:opacity-50` |

> Borders are `outline`, never `tw:ring-*` — see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Badge } from '@openmetadata/ui-core-components';

<Badge color="success" size="md" type="pill-color">
  {t('label.active')}
</Badge>;
```

## Cross-references

- Siblings: [Tags](tags.md) · [Button](button.md) · [Avatar](avatar.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
