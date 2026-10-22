# Core Dropdown menus cap their own height and scroll

- **Status:** Superseded by ADR:2026-10-22-dropdown-popover-scrolls-at-the-space-on-screen
- **Revisions:** v1 2026-10-21 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** #30031, ADR:2026-10-21-capped-autocomplete-stays-on-one-line

## Context
`Dropdown.Popover` sets `max-h-none!` to override react-aria's computed `max-height`. Without it,
a menu whose trigger sat near the bottom of the viewport shrank to one or two rows instead of
flipping above the trigger (#30031). The override also removed every height limit: a long menu,
such as Ontology Studio's glossary list, grew past the screen, and because the popover clips its
overflow, the rows below the fold could not be reached.

## Decision
`Dropdown.Menu` caps itself at `min(24rem, 40vh)` and scrolls (`max-h-[min(24rem,40vh)]
overflow-y-auto`). The popover keeps `max-h-none!`, so react-aria still flips it rather than
shrinking it. 40vh is about the space on the side react-aria opens toward, so a capped menu fits
wherever the trigger sits. A caller that needs another height passes its own `max-h-*` on
`Dropdown.Menu`; `twMerge` lets it replace the default.

## Consequences
Short menus look as before. A long menu now scrolls inside the cap instead of running off the
screen. Callers that set their own cap keep it. Revisit if a menu has to show more than about ten
rows without scrolling, or if the popover moves back to react-aria's computed height.
