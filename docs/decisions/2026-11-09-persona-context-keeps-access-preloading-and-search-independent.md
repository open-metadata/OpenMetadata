# Persona context keeps access, preloading and search independent

- **Status:** Accepted
- **Revisions:** v1 2026-11-09 (initial) · v2 2026-11-09 (shared source caching and review corrections) · v3 2026-11-10 (skip invalid saved search scopes) · v4 2026-11-10 (bound candidate scans)
- **Deciders:** Pere Miquel Brull
- **Guard:** `PersonaContextBuilderTest`, `PersonaContextSourceCacheTest`, `PersonaContextVisibilityTest`, `PersonaRepositoryTest`, `PersonaAIContextIT`
- **Related:** [AI persona Context release feedback](https://app.notion.com/p/3d0b4572302480f182a5f2ea4ee3572b)

## Context

A preloaded Table rule added an unrestricted Table clause to the persona's search filter.
The shared context document also exposed selected assets to members denied access to them.
The AI Context Users column excluded people who inherited the persona through a team.

## Decision

Preloading and search rules operate independently. A persona may preload domain B while its
default searches select domain A. Preloaded asset types add no search clauses. Enabled search
rules still combine with OR, and knowledge types retain their existing search passthrough.

Persona membership permits use of the configured context; it does not grant asset access.
REST and MCP share the same materialization boundary. Member documents check the canonical
asset-context `ViewAll` permission and knowledge `ViewBasic` permission before rendering.
Caller-specific documents bypass the persona-wide cache. Admin and bot documents retain that
cache; member documents must never be stored in it.
Materialization version 2 participates in the definition hash so documents compiled under the old
scope-composition rules are rebuilt after upgrade. Invalid saved search scopes are logged and
skipped when compiling context; working rules and preloaded context remain available.

Rule filters are validated by the configured search engine before a new or changed filter is
persisted, including search-scoped rules. Re-enabling a rule or its context validates active
filters. Unchanged filters are not revalidated when disabling a rule or changing unrelated
settings. Invalid input returns 400; unavailable search returns 503.
The visual editor preserves saved query DSL until the user edits the filter itself. A filter may
use server-supported fields that the builder cannot represent; opening it or disabling its rule
must not replace it with the builder's sanitized output.

The requested `Persona.userCount` is a derived, read-only count of distinct active users with
direct assignments, team inheritance or an effective default persona. Team inheritance excludes
bots, matching `UserRepository`. `Persona.users` continues to mean direct assignments only.

## Consequences

Member requests incur materialization and authorization work rather than reusing an admin's
document. Any future member cache must account for both identity and permission changes.
Counting inherited users does not change assignment forms or persist inherited assignments.

## Amendment: share source data and authorize every read

Cache search pages, unfiltered enrichment for a selected set, explicit knowledge and data-product
membership per pod. Keys include persona, definition hash and an invalidation generation captured
once at the start of each build. Concurrent requests share loads. A persona edit or refresh,
including a remote invalidation, advances the generation; an older load cannot populate its
successor. Materialization version 3 invalidates documents produced before these corrections.

The four source caches have serialized-character weight budgets of 16 million, 16 million,
8 million and 8 million respectively, with a minimum entry weight of 32,000. This bounds source
retention to at most 1,500 entries and keeps large enrichment payloads from crowding out the pod.
Sources expire after 60 seconds, matching the existing cap for referenced-metadata drift.
Successful scope validations have a separate 1,000-entry cache with the same expiration.
Generation tokens and compilation diagnostics each retain at most 1,000 personas; eviction
requires a reload or drops an old diagnostic, and never grants access.

Every read performs canonical permission checks and filters a copy, including attached knowledge,
column definitions, related assets and lineage nodes. Its permission memo is bounded to 1,000
entries and lives only for that read. Neither permission decisions nor rendered member documents
enter a shared cache. Selection-dependent enrichment is keyed by typed rule/asset lists; caller
match counts are supplied separately and cannot leak through a shared snapshot.

Data-product expansion retains lightweight member contexts. It does not run per-member lineage
or data-quality builds; direct asset rules still load those sections when requested.

Apply `maxAssets` after checking candidate visibility, continuing through search pages until the
visible selection is full, candidates are exhausted or the rule's scan budget is spent. If selection stops before every candidate
was checked, omit the optional `matched` total, mark the document truncated and say the total is
unavailable in markdown. A selected count must never masquerade as the complete visible total.
Continuation cursors and short or empty pages determine exhaustion. Search totals can be capped
lower bounds, so reaching the reported total must never stop pagination.

Bots count only through explicit persona assignments or explicit user defaults. Team inheritance
and the implicit system-default branch exclude them. Generic PUT may match an unchanged rule by
its unique case-insensitive name when IDs were omitted and regenerated; entity type, filter and
activation comparisons still determine whether validation is required.

Explore retains its existing all-assets index for links without search text. Persona links carry
an explicit entity-type quick filter rather than changing the shared Explore default.

## Amendment: skip invalid saved search scopes

An invalid saved search scope must not block the persona's context. Log a warning with the persona
and rule name, omit that rule from the returned search defaults, and continue with the remaining
rules. If no valid scopes remain, use the existing unscoped search behavior. Do not change the
saved definition or asset permissions. New or changed filters still validate on save; unavailable
search still reports a service error during save validation or context generation.
Active-persona MCP searches use the same validated scopes and source-validation cache, retaining
their existing logged fallback when scope resolution is unavailable.

## Amendment: bound candidate scans

Each preloaded rule checks at most 1,000 candidates per build, including its root search results
and all expanded data-product members. This matches the maximum allowed `maxAssets`, permits
filling the largest selection when candidates are visible, and bounds work independently of
catalog size. Product pages request only the remaining budget, and their source-cache key includes
that limit. Permission checks remain fresh on each read. Materialization version 4 invalidates
documents cached before these scan and truncation semantics.

When the budget stops a scan before exhaustion, keep the visible selection, leave `matched`
unknown and mark the document truncated. A fully exhausted scan retains its exact visible count,
including zero. Engine totals remain hints rather than pagination stop conditions.
