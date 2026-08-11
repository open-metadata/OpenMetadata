# Button

## Metadata

| | |
| --- | --- |
| **Name** | Button |
| **Category** | Base / action |
| **Status** | Stable |
| **Component** | `@openmetadata/ui-core-components` → `Button` |
| **Source** | [`components/base/buttons`](../../../../../../../openmetadata-ui-core-components/src/main/resources/ui/src/components/base/buttons) |

> Go-forward (UntitledUI + Tailwind `tw:` only). The Ant Design / LESS `--om-*`
> hybrid is the [legacy Button spec](../components/button.md).

## Overview

**Use when** the user triggers an action (submit, save, open a dialog, run a
pipeline). One `primary` per view; everything else `secondary`/`tertiary`.

**Don't use when** navigating to another page — use a `link-*` color or a link.
Never as a container or for pure layout.

## Anatomy

```
┌────────────────────────────────┐
│ [icon]  data-text label [icon] │  ← leading icon · text span · trailing icon
└────────────────────────────────┘
   └─ padding per size · radius tw:rounded-lg · fill/border per color
```

Parts: **container** (`AriaButton`/`AriaLink` root), **label** (`data-text`
span, `tw:font-medium`), optional **leading/trailing icon** (`data-icon`),
**focus outline**, per-color **`::after` border** + **`::before` gradient**
(loading swaps the leading icon for a spinner).

## Tokens used

| Part | `tw:` utility (from tsx) |
| --- | --- |
| Root layout | `tw:inline-flex tw:items-center tw:justify-center` |
| Radius | `tw:rounded-lg` (sm–xl), `tw:rounded-md` (xxs/xs) |
| Label weight / size | `tw:font-medium` · `tw:text-xs`/`tw:text-sm`/`tw:text-md` |
| Primary fill | `tw:bg-brand-solid tw:text-white tw:hover:bg-brand-solid_hover` |
| Secondary surface | `tw:bg-primary tw:text-secondary tw:hover:bg-primary_hover` |
| Tertiary | `tw:text-tertiary tw:hover:bg-primary_hover` |
| Destructive fill / text | `tw:bg-error-solid tw:text-white` · `tw:text-error-primary` |
| Link color / gray | `tw:text-brand-secondary` · `tw:text-tertiary` |
| Border (non-link) | `borderAfter` → `tw:after:outline-primary` (never `tw:border`/`tw:ring-*`) |
| Shadow | `tw:shadow-xs-skeuomorphic` (default), `tw:shadow-xs` (disabled) |
| Focus | `tw:outline-brand tw:focus-visible:outline-2 tw:focus-visible:outline-offset-2` |
| Disabled | `tw:disabled:bg-disabled tw:disabled:text-fg-disabled tw:disabled:cursor-not-allowed` |

## Props / API

| Prop | Values |
| --- | --- |
| `color` | `primary`, `secondary`, `tertiary`, `link-gray`, `link-color`, `primary-destructive`, `secondary-destructive`, `tertiary-destructive`, `link-destructive`, `secondary-success`, `secondary-warning`, `secondary-brand` (default `primary`) |
| `size` | `xxs`, `xs`, `sm`, `md`, `lg`, `xl` (default `sm`) |
| `isDisabled` / `isLoading` | boolean |
| `iconLeading` / `iconTrailing` | `@untitledui/icons` component or node |
| `noTextPadding` / `showTextWhileLoading` / `ellipsis` | boolean |
| `href`, `onPress`, `onClick` | renders `AriaLink` when `href` set, else `AriaButton` |

## States

| State | Treatment |
| --- | --- |
| Default | color fill + `tw:shadow-xs-skeuomorphic` |
| Hover / active | darker fill via `tw:hover:bg-*_hover` (react-aria press) |
| Focus | `tw:outline-brand` 2px, offset 2px — never `tw:ring-*` |
| Disabled | `tw:disabled:bg-disabled` + `tw:disabled:text-fg-disabled`, `cursor-not-allowed` |
| Loading | `data-loading` spinner replaces content unless `showTextWhileLoading` |

> Borders/focus use `outline` / `::after` (`borderAfter`), never `tw:ring-*` —
> see [`docs/colors.md` §2.3.1](../../docs/colors.md).

## Code example

```tsx
import { Button } from '@openmetadata/ui-core-components';
import { Play } from '@untitledui/icons';

<Button color="primary" iconLeading={Play} size="md" onPress={onRun}>
  {t('label.run')}
</Button>;
```

## Cross-references

- Siblings: [Badge](badge.md) · [Tags](tags.md) · [Avatar](avatar.md)
- Styling: [../foundations/tailwind.md](../foundations/tailwind.md) · [../tokens/tailwind-utility-reference.md](../tokens/tailwind-utility-reference.md)
- Legacy hybrid: [../components/button.md](../components/button.md)
