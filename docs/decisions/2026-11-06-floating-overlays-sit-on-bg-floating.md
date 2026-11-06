# Floating overlays sit on bg-floating with a visible overlay shadow; modals and drawers keep bg-overlay-surface

- **Status:** Accepted
- **Revisions:** v1 2026-11-06 (initial)
- **Deciders:** Harshit Shah, design review
- **Guard:** `theme-contract.test.js`, `popover.test.tsx`, `dropdown.theme.test.tsx`, `field-doc-popover.test.tsx`; reviewer
- **Related:** open-metadata/openmetadata-collate#7322, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only, ADR:2026-11-05-nested-cards-sit-one-step-off-their-panel

## Context

In AI-mode dark, core popovers, dropdown menus, select listboxes, date pickers and hover cards used
`bg-overlay-surface` (gray-800), the same surface as modals and slideouts. A menu opened from a drawer
(e.g. the Classification "Add Tag" drawer) blended into it. Their shadow (`shadow-lg`, 8% near-black)
is invisible on dark and barely shows on white. A first fix restyled the popover from the caller and
was reverted, since caller overrides of core drift from other usages. Lifting overlays to gray-700
(`bg-raised`) was tried and judged too large a visual shift in design review.

## Decision

- A dedicated `bg-floating` token: white in light, `#2b2f37` in dark (gray-800 mixed with 4% white),
  a subtle step above the gray-800 drawer/modal surface. It is separate from `bg-raised` because
  `bg-raised` is also the dark hover fill of secondary buttons and lineage nodes.
- Every floating core overlay uses `bg-floating` + `shadow-raised` + `outline-secondary_alt`:
  `Popover` (and its arrow), `Dropdown` menu, the select `Popover` (Select, ComboBox, MultiSelect,
  TagSelect, Autocomplete), `HoverCard`, `DatePicker`, `DateRangePicker`, `FieldDocPopover`,
  `ConfirmPopover`'s arrow. Date pickers keep no outline: it leaked past their rounded corners (#36707).
  `FieldDocPopover` keeps its `border-secondary` edge.
- `shadow-raised` is the overlay shadow in both themes, used only by floating overlays. Light:
  near-black at 14 / 8 / 6%. Dark: black at 50 / 30 / 30%, same geometry. Tailwind inlines shadow
  values into the utility, so the dark value is applied by `.dark-mode .tw\:shadow-raised` in
  `globals.css` rather than a token override.
- **Light-mode exception.** The styling rule freezes light mode. Design review deliberately changes
  one light value: the floating-overlay shadow (`shadow-raised`), because 8% near-black barely shows
  on white. Light surfaces, and every other light shadow, stay as they were.
  `theme-contract.test.js` pins the new values.
- Modals and slideouts keep `bg-overlay-surface` + `shadow-overlay`.
- `Popover` and `HoverCard` set `dark:text-primary`. They portal to `body`, which sets no text colour,
  so inherited copy (a `Typography` paragraph) was black on the dark surface. Light keeps inheriting.
- App menus that cannot be core components (quill-mention, tiptap/tippy) use the same surface by
  colour: `bg-floating` / `var(--tw-background-color-floating)`.

## Consequences

Light overlay surfaces are unchanged (white); light overlays get a slightly deeper shadow. Secondary
buttons inside an overlay hover to `bg-raised` (gray-700), which stays distinct from `bg-floating`, so
no overlay-specific hover rule is needed. The surface step in dark is small (~1.2:1 against
gray-800); the shadow carries most of the lift. Revisit if the dark surface ladder changes.
