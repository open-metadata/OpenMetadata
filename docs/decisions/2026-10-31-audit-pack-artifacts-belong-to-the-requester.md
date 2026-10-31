# An audit pack's artifacts belong to its requester

- **Status:** Accepted
- **Revisions:** v1 2026-10-31 (initial)
- **Deciders:** harshach
- **Guard:** `AIGovernanceEstateVisibilityIT` (REST-level), `AuditReportResourceTest` (unit)
- **Related:** issue #36761, PR #36765, ADR:2026-10-31-ai-governance-estate-reads-count-only-viewable-assets

## Context

Audit packs are generated on a worker thread that has no `SecurityContext`, and the generated
JSON embeds every in-scope asset's `governanceMetadata` — risk assessments, classifications,
evidence. Before this rule the worker paged the whole AI estate and the finished pack was
downloadable by anyone who could read the (domain-less) report entity, including users whose own
policies denied them the assets inside it. The report row also had no recorded requester to scope
generation to.

## Decision

- `AuditReport.requestedBy` is set from the authenticated principal at creation, never from the
  request body. It cannot be changed by PATCH (`/requestedBy` is rejected with 400) nor re-homed
  by PUT (an update keeps the original requester).
- Generation assembles the pack with the requester's view: one `ViewBasic` check per in-scope
  asset as that user, failing closed. A report with no `requestedBy` (rows written before the
  field existed) fails generation instead of falling back to `updatedBy`, which completion and
  recovery stamp with `"admin"`.
- `artifacts[]` — the pack bytes — are returned only to the requester or an admin on every read:
  by id, by name, the list endpoint, and the write responses (PATCH, PUT, cancel). Everyone else
  gets the report shell with `artifacts` withheld.
- The pack bytes never enter stored versions (`getFieldsHiddenFromHistory`) and are not recorded
  as a change (`AuditReportUpdater` skips `artifacts`), so version history, `/v1/events` and
  alert sinks cannot carry them to non-requesters.

## Consequences

The pack content is coupled to one user's policy view: if that user's access shrinks after
generation, older packs they requested still contain what they legitimately saw — the same
property as any export. Admins remain unrestricted: their packs cover the estate and any admin
can download them. Masking the bytes from history means a restored old version of a report never
resurrects a pack; the live row's `artifacts` remain the only copy.
