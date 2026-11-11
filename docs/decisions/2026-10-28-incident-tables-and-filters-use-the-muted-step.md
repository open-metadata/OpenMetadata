# Incident tables and their filter band sit on the muted step

- **Status:** Accepted
- **Revisions:** v1 2026-10-28 (initial)
- **Deciders:** Harshit Shah
- **Guard:** reviewer; light and dark before/after screenshots in open-metadata/OpenMetadata#36426
- **Related:** open-metadata/OpenMetadata#36423, ADR:2026-10-27-settings-modal-surfaces-use-the-muted-step

## Context

Incident rows and the entity incident filter band need a darker surface than the surrounding
page cards in AI mode. Keeping the default card surface makes the table blend into its parent
panel. The existing muted table variant already provides the required surface, frame, hover,
and markdown fade behavior without call-site overrides.

## Decision

- `IncidentManager` uses `TableCard.Root variant="muted"` around both its filters and table.
- `IncidentGroupsView`, `IncidentGroupDetail`, and `IncidentGroupDrawer` use the same muted
  variant around their incident tables.
- This is a scoped exception to the modal-only restriction in
  ADR:2026-10-27-settings-modal-surfaces-use-the-muted-step. It does not change other page cards
  or the global default variant.
- Reuse the existing semantic tokens: muted surfaces are gray-900 in dark and white in light.
  Filter controls retain the core input styling so their boundaries remain visible.

## Consequences

Incident tables and their filter band remain visibly darker than adjacent cards in dark mode.
Light surfaces stay white. New incident-table containers follow this rule instead of reverting
to the page-card surface or adding local color overrides.
