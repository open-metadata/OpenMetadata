# Profiler settings item routes belong to a downstream form

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `ProfilerSettings.test.tsx` (an item id delegates to the contributed form; no item id stays the profiler form)
- **Related:** ADR:2026-10-12-platform-settings-pages-extension-point

## Context
In the AI-mode settings modal, every add/edit form replaces the panel content (Add Team, Add
Dimension). A downstream build can contribute a section to the built-in Profiler Configuration
page through `ProfilerConfigurationClassBase`, but the page had no route that section's add/edit
form could own, so the form had to open in a drawer.

## Decision
- `#platform-settings/profiler-configuration/edit` with no item id is the profiler configuration
  form. With an item id (`.../edit/<itemId>`) it renders
  `profilerConfigurationClassBase.getSettingsItemForm()` with `PlatformSettingsFormProps`, and the
  header title comes from `getSettingsItemFormTitle(t, itemId)`.
- OpenMetadata does not interpret the item id; its format belongs to the implementer.
- The contributed section (`getSparkAgentConfigComponent()`) receives the page's
  `PlatformSettingsPageProps` in the modal so it can navigate to those routes; on the classic
  settings page it gets none.

## Consequences
A downstream form gets the modal's header, breadcrumbs and pinned footer, and a deep link to it
survives refresh. The profiler page can no longer give its own `/edit` an item id for anything
else without moving the downstream form to a different segment. This is not the
`platform-settings.pages` contribution contract; contributed pages stay view-only.
