# Drawer

## Metadata

| | |
| --- | --- |
| **Name** | Drawer |
| **Category** | Application / overlay |
| **Status** | Stable |
| **Styles** | [`src/styles/components/drawer.less`](../../src/styles/components/drawer.less) |
| **Component** | `@openmetadata/ui-core-components` → `SlideoutMenu` (new work); Ant Design `Drawer` (legacy, `.feed-drawer` / `.custom-drawer-style`) |

## Overview

**Use when** a task or detail needs a focused side surface without leaving the
page — entity previews, activity feeds, filters, create/edit forms.

**Don't use when** the interaction blocks the whole flow and demands a decision
— use a modal. Don't use for passing tooltips or menus.

## Anatomy

```
   scrim (--om-color-bg-overlay @ --om-z-overlay)
   ┌─────────────────────────────┐
   │ Title                  [✕]  │ ← header: title + close icon, bottom shadow
   ├─────────────────────────────┤
   │ body — padding space-16     │ ← scrollable content (overflow-x hidden)
   │ …                           │
   ├─────────────────────────────┤
   │            [Cancel] [Save]  │ ← footer: sticky, top shadow
   └─────────────────────────────┘
     ↑ panel slides in from the right edge
```

Parts: **scrim/overlay**, **panel** (surface), **header** (title + close icon),
**body**, **footer**.

## Tokens used

| Part | Token |
| --- | --- |
| Body padding | `--om-space-16` |
| Header / footer elevation | `--om-legacy-color-10-13-18-0-04` (layered box-shadow; migration debt) |
| Header / footer stacking | `--om-z-1` |
| Scrim / overlay | `--om-color-bg-overlay`, `--om-z-overlay` |
| Panel surface | `--om-color-bg-primary` (semantic default) |
| Title (legacy) | LESS `.text-sm()` (14px) `@font-regular`; footer `.text-xl()` (20px) `@font-semibold` |

## Props / API (core-components `SlideoutMenu`)

| Prop | Values |
| --- | --- |
| `isOpen` / `onOpenChange` | boolean / `(open) => void` (from AriaModalOverlayProps) |
| `isDismissable` | boolean — click scrim to close |
| `width` | `number \| string` — panel max-width |
| `children` | `ReactNode` or `({ close }) => ReactNode` |
| `dialogClassName` | string |
| Slots | `SlideoutMenu.Trigger`, `.Content`, `.Header` (`onClose`), `.Footer` |

## States

| State | Treatment |
| --- | --- |
| Closed | panel off-canvas (translated past right edge), scrim hidden |
| Open | panel at rest; scrim `--om-color-bg-overlay` at `--om-z-overlay` |
| Enter / exit | slide + fade — see [Motion](../foundations/motion.md) |
| Header shadow | drops on scroll via `--om-legacy-color-10-13-18-0-04` |
| Footer sticky | top shadow separates actions from scrolled body |
| Dismiss | scrim click / Esc when `isDismissable` |

## Code example

```less
/* Layer 3 — reference Layer 2 tokens only */
.custom-drawer-style {
  .ant-drawer-body {
    padding: var(--om-space-16);
    overflow-x: hidden;
  }
  .ant-drawer-header {
    box-shadow: 0px 9px 16px -4px var(--om-legacy-color-10-13-18-0-04);
    z-index: var(--om-z-1);
  }
  .ant-drawer-footer {
    box-shadow: 0px -13px 16px -4px var(--om-legacy-color-10-13-18-0-04);
    z-index: var(--om-z-1);
  }
}
```

```tsx
import { SlideoutMenu } from '@openmetadata/ui-core-components';
<SlideoutMenu isOpen={isOpen} width={480} onOpenChange={setIsOpen}>
  <SlideoutMenu.Header onClose={onClose}>{t('label.detail-plural')}</SlideoutMenu.Header>
  <SlideoutMenu.Content>{children}</SlideoutMenu.Content>
</SlideoutMenu>;
```

## Cross-references

- [Menu](menu.md) · [Pagination](pagination.md) · [Button](button.md)
- Foundations: [Elevation](../foundations/elevation.md), [Motion](../foundations/motion.md), [Color](../foundations/color.md)
