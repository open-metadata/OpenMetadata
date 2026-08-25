# Menu

## Metadata

| | |
| --- | --- |
| **Name** | Menu |
| **Category** | Navigation |
| **Status** | Legacy |
| **Styles** | [`src/styles/components/menu.less`](../../src/styles/components/menu.less) |
| **Component** | Ant Design `Menu` (legacy — `.custom-menu`, `.custom-menu-v1`, `.ant-dropdown-menu`). No `ui-core-components` equivalent yet. |

## Overview

**Use when** presenting a vertical list of navigable sections — left side
panels, settings groups, or a dropdown of actions.

**Don't use when** paginating results (use [Pagination](pagination.md)) or
picking a single value in a form (use `Select`).

## Anatomy

```
┌──────────────────────────────┐
│ GROUP TITLE                  │ ← group title: font-size-xs, padding 12 / 16
│ [icon]  Item                 │ ← item: height 30px, padding 0 / 16
│ [icon]  Item        selected │ ← selected: semibold + brand accent + right border
│ [icon]  Item                 │
└──────────────────────────────┘
```

Parts: **group title**, **item** (icon + label, gap `--om-space-8`),
**selected indicator** (right border + weight), optional **badge**.

## Tokens used

| Part | Token |
| --- | --- |
| Item padding | `0 var(--om-space-16)` |
| Group title | `var(--om-space-12) var(--om-space-16)`, `--om-font-size-xs` |
| Icon → label gap | `--om-space-8` |
| Item spacing | `--om-space-2` (default), `--om-space-4` (with description) |
| Selected label weight | `--om-font-weight-semibold` (`--om-font-weight-regular` in with-description) |
| v1 item label size | `--om-font-size-md` |
| Selected right border | `--om-color-gray-neutral-200` |
| Selected transition | `--om-duration-200` |
| Selected elevation (v1) | `--om-legacy-color-10-13-18-0-04`, `--om-legacy-color-0-0-0-0-06` |
| Icon color | `--om-legacy-color-515151` |
| Accent (selected/active) | LESS `@primary-color` (brand) |

## Props / API

Ant Design `Menu` — legacy. Configure via AntD props (`items`, `mode="inline"`,
`selectedKeys`, `onClick`); style hooks are the `.custom-menu*` class names
above. Do not build new menus on this; prefer composing `ui-core-components`.

## States

| State | Treatment |
| --- | --- |
| Default | label `@grey-500`, icon `@grey-400` (v1) |
| Hover | icon shifts to `@primary-color` accent |
| Selected | `--om-font-weight-semibold`, right border `--om-color-gray-neutral-200`, brand accent |
| Active (v1) | brand border-color + `--om-legacy-color-10-13-18-0-04` shadow, `--om-duration-200` |
| Focus | inherit AntD outline — never a `ring-*` (see [`docs/colors.md` §2.3.1](../../docs/colors.md)) |

## Code example

```less
/* Layer 3 — reference Layer 2 tokens only */
.custom-menu.ant-menu-root.ant-menu-inline {
  .ant-menu-item-group-title {
    font-size: var(--om-font-size-xs);
    padding: var(--om-space-12) var(--om-space-16);
  }
  .ant-menu-item {
    height: 30px;
    margin-top: var(--om-space-2);
    padding: 0 var(--om-space-16) !important;
  }
  .ant-menu-item-icon + span {
    margin-left: var(--om-space-8);
  }
  .ant-menu-item-selected .ant-menu-title-content {
    font-weight: var(--om-font-weight-semibold);
  }
}
```

## Cross-references

- [Drawer](drawer.md) · [Pagination](pagination.md) · [Button](button.md)
- Foundations: [Color](../foundations/color.md), [Spacing](../foundations/spacing.md), [Typography](../foundations/typography.md)
