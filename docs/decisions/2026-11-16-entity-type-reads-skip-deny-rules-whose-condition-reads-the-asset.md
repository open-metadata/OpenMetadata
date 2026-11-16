# Entity-type reads skip deny rules whose condition reads the asset

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
  `isEntityTypeLevel() == true`.
- On such a request, a **deny** rule's condition is evaluated against an `AssetReadRecorder`, which
  notes any read of the resource context other than its type name (`getResource`). If the outcome
  read the asset (owners, domains, tags, entity, service), the deny is skipped.
- Detection follows what the condition actually read, not a list of function names, so a new
  `RuleEvaluator` function needs no registration. A condition decided before any asset read, such
  as `!isImpersonated() || !matchTeam()` when not impersonated, still denies.
- Unconditional denies and all allow rules are evaluated as before. Other requests without an
  asset (lists, creates) do not use this context and are unchanged.

## Consequences

- Asset-scoped denies keep protecting asset data: reading an asset's `extension` still evaluates
  them against its real owners.
- A deny whose outcome needed the asset is skipped at type level; it still applies per asset.
- A user with no matching allow still gets 403, because allow evaluation is unchanged.
