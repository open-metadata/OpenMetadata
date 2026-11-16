# Entity-type reads skip deny rules whose condition reads the asset

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** Platform team
- **Guard:** `TypeCustomPropertiesPermissionIT`, `CompiledRuleTest` (`entityTypeRequest*`, `everyConditionFunctionIsClassifiedAsResourceDependentOrSubjectOnly`)
- **Related:** open-metadata/OpenMetadata#37759, #17152, ADR:2026-11-03-read-handlers-authorize-like-the-entity-reads-they-mirror

## Context

`GET /metadata/types/name/{entityType}?fields=customProperties` authorizes `ViewCustomFields` on the
entity type (#17152). There is no asset, so no owners, domains or tags. A deny conditioned on the
asset, such as `!matchTeam()`, evaluated `matchTeam()` to false and became an unconditional deny,
breaking the Custom Properties tab for users who can read the asset's values.

## Decision

- A request about an entity type uses `ResourceContext.forEntityType(type)`, which reports
  `isEntityTypeLevel() == true`.
- On such a request, a **deny** rule whose condition calls any function in
  `CompiledRule.RESOURCE_DEPENDENT_FUNCTIONS` is skipped.
- Unconditional denies, denies whose condition reads only the subject (`inAnyTeam`, `hasAnyRole`,
  `isImpersonated`, `impersonatedBy`), and all allow rules are evaluated as before.
- Every `@Function` in `RuleEvaluator` must be classified as resource-dependent or subject-only.
  `CompiledRuleTest` fails on an unclassified one.

## Consequences

- Asset-scoped denies keep protecting asset data: reading an asset's `extension` still evaluates
  them against its real owners.
- A deny that mixes subject and asset functions is skipped at type level; it still applies per asset.
- A user with no matching allow still gets 403, because allow evaluation is unchanged.
