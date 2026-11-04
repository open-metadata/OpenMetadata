# The conversation drawers are 40% of the screen wide, never narrower than 480px

- **Status:** Accepted
- **Revisions:** v1 2026-10-24 (initial)
- **Deciders:** UI team
- **Guard:** reviewer
- **Related:** open-metadata/OpenMetadata#36152, open-metadata/OpenMetadata#36162

## Context

The conversation drawer opened from an entity's description (`ActivityThreadPanel`) and the one
its Reply opens (`ActivityFeedDrawer`) were each a fixed 576px. That is cramped on wide screens,
where long entity, column and author names truncate early beside the header, the ⋮ menu and the
reply composer, and it is a large share of a narrow one.

## Decision

- Both drawers take `FEED_DRAWER_WIDTH` = **`max(40vw, 480px)`** (`constants/Feeds.constants.ts`),
  one shared constant passed as the `SlideoutMenu` width (applied as its `maxWidth`).
- 40vw equals the old 576px at a 1440px viewport and grows with the screen; 480px is the floor at
  which a card's header row (avatar, truncated name, time, ⋮) and the composer still fit.

## Consequences

- The two drawers stay the same width; change the constant, not a call site.
- On viewports narrower than 480px the drawer is capped by the slideout's full-width layout, not by
  this floor.
- Revisit if the drawers move onto a shared drawer shell (open-metadata/OpenMetadata#35316), which
  would own the width instead.
