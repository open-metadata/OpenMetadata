# Profiler settings item routes belong to the downstream Spark agent form

- **Status:** Accepted
- **Revisions:** v1 2026-10-26 (initial)
- **Deciders:** Rohit Jain
- **Guard:** `ProfilerSettings.test.tsx` (item id delegates to the contributed Spark form; no item id stays the profiler form)
- **Related:** open-metadata/openmetadata-collate#7860, ADR:2026-10-12-platform-settings-pages-extension-point

## Context
In the AI-mode settings modal, every add/edit form replaces the panel content (Add Team, Add
Dimension). The Spark agent list on the built-in Profiler Configuration page is contributed by
Collate through `ProfilerConfigurationClassBase` and opened its form in a drawer, because the page
had no route a downstream form could own.

## Decision
- `#platform-settings/profiler-configuration/edit` with no item id is the profiler configuration
  form. With an item id (`.../edit/<itemId>`) it renders
  `profilerConfigurationClassBase.getSparkAgentConfigForm()` with `PlatformSettingsFormProps`, and
  the header title comes from `getSparkAgentConfigFormTitle(t, itemId)`.
- OpenMetadata does not interpret the item id; its format belongs to the implementer. Collate uses
  `spark` to add and `spark/<runner FQN>` to edit. The FQN, not the name: a name containing `.` or
  `"` is stored quoted, so a get-by-name on the raw name misses.
- `getSparkAgentConfigComponent()` receives the page's `PlatformSettingsPageProps` in the modal so
  it can navigate to those routes; on the classic settings page it gets none and keeps its drawer.
- `SettingsFormLayout` takes an optional `contentClassName` so a form can set its column width;
  the default stays `tw:max-w-240`.

## Consequences
The Spark form gets the modal's header, breadcrumbs and pinned footer, and a deep link to an
edit page survives refresh. The profiler page can no longer give its own `/edit` an item id for
anything else without moving the Spark form to a different segment. This is not the
`platform-settings.pages` contribution contract; contributed pages stay view-only.
