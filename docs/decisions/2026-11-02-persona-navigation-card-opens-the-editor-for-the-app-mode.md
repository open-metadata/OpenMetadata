# One persona Navigation card opens the sidebar editor for the current app mode

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `PersonaUtils.test.ts` (`getCustomizePageCategoryCards` drops the AI sidebar card),
  `PersonaCustomizeView.test.tsx` (`navigation` opens `navigation-editor` in classic mode and
  `ai-sidebar-editor` in AI mode), `PersonaCustomizeGrid.test.tsx`
- **Related:** ADR:2026-10-21-settings-pages-are-classic-only, open-metadata/OpenMetadata#36862

## Context
A persona's Customize UI showed two cards for one concept: **Navigation** (the classic left sidebar,
`navigation`) and **AI sidebar** (`askCollateSidebar`). Each shell has exactly one sidebar, and
which one a user customizes follows the shell they are in. The settings modal exists only in AI mode
and the classic `/settings/persona` page only in classic mode
(ADR:2026-10-21-settings-pages-are-classic-only).

## Decision
- **Both card grids show one Navigation card.** `PersonaCustomizeGrid` (the modal) and `CustomizeUI`
  (the classic page) render `getCustomizePageCategoryCards()`, which is
  `getCustomizePageCategories()` without `APP_MODE_SIDEBAR_CUSTOMIZATION_KEY` (`askCollateSidebar`).
- **The Navigation card opens the editor for the mode.** In `PersonaCustomizeView`, `navigation`
  opens `AiSidebarEditor` when `useIsAiMode()` is true and `NavigationEditor` otherwise. On the
  classic page it opens the classic Customize Navigation page, as before.
- **`askCollateSidebar` stays a category, just not a card.** It remains in
  `getCustomizePageCategories()` so breadcrumbs and the `/customize-page/<persona>/askCollateSidebar`
  route keep resolving its label, and `PersonaCustomizeView` still maps it to `AiSidebarEditor` for
  existing links.
- **Each editor writes only its own key.** `NavigationEditor` saves `data.navigation` and
  `AiSidebarEditor` saves `data.askCollateSidebar`, so switching modes never moves one sidebar's
  visibility onto the other.
- **A downstream category with the same key is hidden too.** Collate's `PersonaClassCollate` replaces
  the OSS `askCollateSidebar` entry with its own under the same key; the card filter matches the key,
  so Collate shows one Navigation card without a change. That holds only while both use the key
  `askCollateSidebar`.

## Consequences
A classic-mode admin no longer reaches the AI sidebar editor from a card; it is edited from the
settings modal in AI mode, or through the `/customize-page/<persona>/askCollateSidebar` route.
Renaming `APP_MODE_SIDEBAR_CUSTOMIZATION_KEY` in OSS or Collate brings the second card back in
whichever distribution kept the old key. Revisit if one shell ever shows both sidebars.
