# Light featured icons and icon avatars stay tinted in dark mode

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** UI team
- **Guard:** `avatar.test.tsx` (core), `IconUtils.test.tsx`; `reviewer` for `featured-icon.tsx`
- **Related:** open-metadata/openmetadata-collate#7533, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
`FeaturedIcon` with `theme="light"` switched to a solid fill (`bg-*-solid`, white glyph) under
`.dark-mode`, inherited from the UntitledUI port (#29412). The AI-mode Home topic cards draw a
tinted tile instead (`bg-utility-<c>-50` + `text-utility-<c>-600`), so AI Automations, Data
Marketplace and other pages read as heavier, louder blocks next to Home. Callers patched it
locally (`CriticalAnnouncementBanner`, `StatCard`), and entity avatars forced a solid
`brand-600` fill from the caller through `getEntityAvatarProps`.

## Decision
- `FeaturedIcon` `theme="light"` keeps a tinted tile in dark: `tw:dark:bg-utility-<c>-50
  tw:dark:text-utility-<c>-600`. Light mode is unchanged.
- Core `Avatar` gains `placeholderIconColor` (`brand | gray | success | warning | error`), which
  tints the surface behind `placeholderIcon` with the same `utility-<c>-50 / -600` pair. Unset keeps
  the neutral `bg-tertiary` surface.
- `getEntityAvatarProps` passes `placeholderIconColor: 'brand'` when the entity has no color of its
  own, and keeps a user-picked `style.color` as a solid fill (that color is entity data).

## Consequences
Tinted icon tiles come from the core components, so callers stop overriding colors to match Home.
A page that wants a solid tile in dark must pick a solid theme (`dark`, `modern`) rather than
`light`. Revisit only if design moves Home itself back to solid tiles.
