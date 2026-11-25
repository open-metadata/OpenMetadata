# Light featured icons stay tinted in dark mode

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial)
- **Deciders:** UI team, design
- **Guard:** `reviewer` for `featured-icon.tsx`
- **Related:** open-metadata/openmetadata-collate#7533, ADR:2026-10-12-dark-mode-targets-ai-mode-core-surfaces-only

## Context
`FeaturedIcon` with `theme="light"` switched to a solid fill (`bg-*-solid`, white glyph) under
`.dark-mode`, inherited from the UntitledUI port (#29412). The AI-mode Home topic cards draw a
tinted tile instead (`bg-utility-<c>-50` + `text-utility-<c>-600`), so AI Automations and other
pages read as heavier, louder blocks next to Home, and callers patched it locally
(`CriticalAnnouncementBanner`, `StatCard`, Collate `agentIconMap`).

## Decision
- `FeaturedIcon` `theme="light"` keeps a tinted tile in dark: `tw:dark:bg-utility-<c>-50
  tw:dark:text-utility-<c>-600`. Light mode is unchanged.
- Domain and data product avatars (`getEntityAvatarProps`) are out of scope: users pick their
  color, so they stay a solid fill in both themes until custom colors are revisited.

## Consequences
Tinted icon tiles come from the core component, so callers stop overriding colors to match Home.
A page that wants a solid tile in dark must pick a solid theme (`dark`, `modern`) rather than
`light`. Revisit only if design moves Home itself back to solid tiles, or when entity custom
colors are reworked.
