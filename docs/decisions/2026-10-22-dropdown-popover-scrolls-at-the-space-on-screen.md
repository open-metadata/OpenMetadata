# Dropdown popovers scroll at the space on screen; callers own the menu height

- **Status:** Accepted
- **Revisions:** v1 2026-10-22 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** #35841, #30031, ADR:2026-10-21-core-dropdown-menus-cap-their-own-height (superseded)

## Context
ADR:2026-10-21-core-dropdown-menus-cap-their-own-height capped every `Dropdown.Menu` at
`min(24rem, 40vh)`. That put one product's height into a shared component: callers that wanted a
taller menu got a short one, and content that was not a direct `Dropdown.Menu` (a menu inside a
wrapper, a form) still had no limit and ran off the screen, because the popover set `max-h-none!`
and clipped its overflow.

`max-h-none!` existed because a popover near the bottom of the screen shrank to one or two rows
instead of flipping (#30031). The cause was the popover's enter classes: `duration-150` sets
`transition-duration`, and the default `transition-property` is `all`, so `top` and `max-height`
animated while react-aria measured the popover. It read a half-animated height, decided the content
fit, and capped it instead of flipping.

## Decision
The core component does not pick a content height. `Dropdown.Popover` lets react-aria set its
`max-height` to the space on the side it opens toward, and is `overflow-y-auto`, so whatever it
holds scrolls once it reaches that height. It sets `transition-none` so react-aria measures the
settled popover and flips; the enter and exit effects are keyframe animations and still play.
`Dropdown.Menu` sets no `max-height`. A caller that wants a shorter menu passes its own `max-h-*`
on `Dropdown.Menu`, and the menu scrolls at that height.

A viewport-height cap with `max-h-none!` kept was tried and rejected: a long menu opened from
mid-screen ran off the top of the viewport.

## Consequences
Short menus look as before and still flip above a trigger near the bottom. Long content grows to the
edge of the screen on its roomier side and scrolls, whether it is a menu, a wrapped menu or a form.
Nothing inside the popover changes layout. If a caller's `max-h-*` is taller than the space on
screen, the popover and the menu both scroll. Revisit if a `transition-*` class comes back on
`Dropdown.Popover`.
