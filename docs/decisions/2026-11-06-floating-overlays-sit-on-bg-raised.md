# Floating overlays sit on bg-raised with a deepened dark shadow; modals and drawers keep bg-overlay-surface

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Harshit Shah
- **Guard:** `dropdown.theme.test.tsx`, `field-doc-popover.test.tsx`; reviewer
- **Related:** open-metadata/openmetadata-collate#7322, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only, ADR:2026-11-05-nested-cards-sit-one-step-off-their-panel

## Context

In AI-mode dark, core popovers, dropdown menus, select listboxes, date pickers and hover cards used
`bg-overlay-surface` (gray-800), the same surface as modals and slideouts. A menu opened from a drawer
(e.g. the Classification "Add Tag" drawer) blended into it. Their shadow (`shadow-lg` /
`shadow-raised`, 8% near-black) is invisible on dark surfaces. A first fix restyled the popover from
the caller and was reverted, since caller overrides of core drift from other usages.

## Decision

- Every floating core overlay uses `bg-raised` + `shadow-raised` + `outline-secondary_alt`:
  `Popover` (and its arrow), `Dropdown` menu, the select `Popover` (Select, ComboBox, MultiSelect,
  TagSelect, Autocomplete), `HoverCard`, `DatePicker`, `DateRangePicker`, `FieldDocPopover`,
  `ConfirmPopover`'s arrow. Date pickers keep no outline: it leaked past their rounded corners (#36707).
  `FieldDocPopover` keeps its `border-secondary` edge: an outline is layout-neutral and would shift
  its light-mode content by 1px (both are white 8% in dark).
- Modals and slideouts keep `bg-overlay-surface` + `shadow-overlay`, so an overlay opened from one sits
  one step above it (gray-700 on gray-800).
- In dark mode `shadow-raised` is deepened to black 50%/30%. Tailwind inlines shadow values into the
  utility, so a `--shadow-raised` token override cannot reach it; `globals.css` overrides
  `.dark-mode .tw\:shadow-raised` instead. Only floating overlays use `shadow-raised`.
- `Popover` and `HoverCard` set `dark:text-primary`. They portal to `body`, which sets no text colour,
  so inherited copy (a `Typography` paragraph) was black on the dark surface. Light keeps inheriting so
  light text is unchanged.
- Secondary `Button` / `ButtonUtility` hover to `bg-raised` in dark, which now equals the overlay.
  Inside a `shadow-raised` overlay their hover steps one lighter (`bg-raised` + 8% white). Swapping the
  hover to `bg-primary_hover` everywhere was rejected: white 6% over a gray-950 page is darker than the
  gray-800 rest fill, so page buttons would darken on hover.

## Consequences

Light mode is unchanged: `bg-raised` and `bg-overlay-surface` are both white, and `shadow-raised` is
`shadow-lg`. App code that paints its own floating menu should use a core overlay rather than
`bg-overlay-surface`. Revisit if the dark surface ladder (950 / 900 / 800 / 700) changes.
