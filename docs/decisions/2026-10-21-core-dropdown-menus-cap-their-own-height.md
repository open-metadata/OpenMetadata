# Core Dropdown menus cap their own height and scroll

- **Status:** Accepted
- **Revisions:** v1 2026-10-21 (initial); v2 2026-10-22 (cap is the space react-aria measures, not a fixed height)
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
The core component does not pick a menu height. `Dropdown.Popover` drops `max-h-none!` and lets
react-aria set its `max-height` to the space on the side it opens toward. The popover is a flex
column and `Dropdown.Menu` is `min-h-0 overflow-y-auto`, so the menu shrinks to that space and
scrolls. A caller that wants a shorter menu passes its own `max-h-*` on `Dropdown.Menu`; the menu
then scrolls at whichever is smaller, the caller's height or the space on screen.

The shrinking in #30031 came from the popover's enter classes. `duration-150` sets
`transition-duration`, and the default `transition-property` is `all`, so `top` and `max-height`
animated while react-aria measured the popover. It read a half-animated height, decided the menu
fit, and capped it instead of flipping. The popover now sets `transition-none`; the enter and exit
effects are keyframe animations, so they still play.

v1 capped the menu at `min(24rem, 40vh)`, which put one product's height into a shared component.
Two alternatives were tried and rejected. A viewport-height cap with `max-h-none!` kept let a long
menu opened from mid-screen run off the top of the viewport. `max-h-[inherit]` on the menu ignored
the space on screen when a caller's `max-h-*` replaced it, so the popover clipped the menu's end.

## Consequences
Short menus look as before and still flip above a trigger near the bottom. A long menu grows to the
edge of the screen on its roomier side and scrolls. Callers that set their own cap keep it. A
popover with custom content (FilterSelect, TreeSelect) is now also bounded by the available space.
Revisit if a `transition-*` class comes back on `Dropdown.Popover`, or if a custom popover needs
block rather than flex layout.
