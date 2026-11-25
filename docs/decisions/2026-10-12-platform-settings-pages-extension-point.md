# Downstream builds add view-only Platform Settings pages through `platform-settings.pages`

- **Status:** Accepted
- **Revisions:** v1 2026-10-12 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `PlatformSettingsPanel.test.tsx` (contributed pages describe block)
- **Related:** #35210, #35211, open-metadata/openmetadata-collate#7291

## Context
Platform Settings in the AI-mode settings modal lists a fixed set of pages. Collate has settings
OSS does not ship (Ingestion Runners), and they need a place in the same modal without OSS
importing Collate code. Members and Notification already accept contributed sections the same way.

## Decision
- The extension point id is `platform-settings.pages` (`EXTENSION_POINTS.PLATFORM_SETTINGS_PAGES`).
- A contribution is a `PlatformSettingsPageContribution`: `id`, `icon`, `titleKey`,
  `descriptionKey`, optional `isBeta` and `isVisible`, and a required `component` that receives
  `PlatformSettingsPageProps`.
- Contributions are listed after the built-in cards, filtered by `isVisible` like built-in pages,
  and render at `#platform-settings/<id>`. The header takes their title, description and icon.
- A contribution's `id` must differ from every built-in `PlatformSettingsPageId`.
- Contributions are view-only: no `/edit` form or item sub-routes. A page that needs them manages
  its own state inside `component`.

## Consequences
Downstream pages ride the modal's routing, header and breadcrumbs for free. Renaming the id or
the hash format breaks downstream builds silently, so change it only with the consumers. Adding
edit or item routes for contributions means extending this contract (e.g. a `formComponent`) and
amending this record.
