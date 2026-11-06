# UntitledUI component specs (go-forward)

Specs for the **UntitledUI component library**
(`@openmetadata/ui-core-components`) — the go-forward component set, styled with
Tailwind (`tw:` prefix) from the design tokens in `globals.css`. Use these for
new UI work.

> These are distinct from [`../components/`](../components/), which documents the
> legacy Ant Design / Less app components (with `--om-*` tokens). For new work,
> prefer an UntitledUI component from here.

**Before building:** read [../foundations/tailwind.md](../foundations/tailwind.md)
and the [utility reference](../tokens/tailwind-utility-reference.md). Never
hardcode a value — `yarn tw-audit` enforces it.

## Components

| Component | Spec |
| --- | --- |
| Button | [button.md](button.md) |
| Badge | [badge.md](badge.md) |
| Tags | [tags.md](tags.md) |
| Avatar | [avatar.md](avatar.md) |
| Input | [input.md](input.md) |
| Textarea | [textarea.md](textarea.md) |
| Select | [select.md](select.md) |
| Checkbox | [checkbox.md](checkbox.md) |
| Radio | [radio.md](radio.md) |
| Toggle | [toggle.md](toggle.md) |
| Slider | [slider.md](slider.md) |
| Tooltip | [tooltip.md](tooltip.md) |
| Modal | [modal.md](modal.md) |
| Table | [table.md](table.md) |
| Tabs | [tabs.md](tabs.md) |
| Pagination | [pagination.md](pagination.md) |

## Conventions

- Style with `tw:` utility classes only — semantic first (`tw:bg-primary`,
  `tw:text-secondary`), palette (`tw:bg-brand-500`) when no semantic fits.
- No arbitrary values (`tw:bg-[#hex]`, `tw:p-[8px]`), no raw hex, no
  `style={{}}`, no `tw:ring-*`. See [../foundations/tailwind.md](../foundations/tailwind.md).
- Build on `react-aria-components` for accessibility; use `cx()`/`sortCx()`.
