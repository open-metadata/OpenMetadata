# Entity-type reads skip conditional deny rules

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Platform team
- **Guard:** `TypeCustomPropertiesPermissionIT`, `CompiledRuleTest` (`entityTypeRequest*`)
- **Related:** open-metadata/OpenMetadata#37759, #17152, ADR:2026-11-03-read-handlers-authorize-like-the-entity-reads-they-mirror

## Context

`GET /metadata/types/name/{entityType}?fields=customProperties` authorizes `ViewCustomFields` on the
entity type (#17152). There is no asset, so no owners, domains or tags. A deny conditioned on the
asset, such as `!matchTeam()`, evaluated `matchTeam()` to false and became an unconditional deny,
breaking the Custom Properties tab for users who can read the asset's values.

## Decision

- A request about an entity type uses `ResourceContext.forEntityType(type)`, which reports
  `isEntityTypeLevel() == true`. Only the type definitions read above uses it.
- On such a request only **unconditional** deny rules apply; a deny with a condition is skipped.
- Allow rules, and every other request (asset reads and writes, lists, creates), are evaluated as
  before.

## Alternatives considered

- **Skip only the parts of a condition that read the asset** (record asset reads per operand and
  combine them with three-valued logic). It keeps caller-only denies such as `inAnyTeam('X')`
  enforced here, but adds two classes and reflection to guard field definitions that
  `GET /metadata/types/name/{entityType}/customProperties` already returns to any user who can view
  types. Rejected as not worth the complexity.

## Consequences

- Conditional denies keep protecting asset data: reading an asset's `extension` still evaluates
  them against its real owners.
- A caller-only conditional deny (e.g. `inAnyTeam('Contractors')`) no longer blocks the type
  definitions read; the same definitions are already readable through the `/customProperties`
  sub-resource.
- A user with no matching allow still gets 403, because allow evaluation is unchanged.
- `forEntityType` must never be used for a request that returns asset data.
