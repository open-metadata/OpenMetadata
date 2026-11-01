# Estate-wide AI governance reads count only the assets the caller may view

- **Status:** Accepted
- **Revisions:** v1 2026-10-31 (initial)
- **Deciders:** harshach
- **Guard:** `AIGovernanceEstateVisibilityIT` (REST-level), `AIGovernanceResourceTest` (unit)
- **Related:** issue #36761, PR #36765, ADR:2026-10-31-audit-pack-artifacts-belong-to-the-requester

## Context

The AI governance endpoints that span the whole AI estate (dashboard, activity feed, policy
violations, framework coverage) authorize the caller with `VIEW_ALL` against a type-only
`ResourceContext`. `RuleEvaluator.hasDomain()` deliberately returns true for such contexts —
"list operation, returning true for post-filtering" — so the entity list endpoints narrow with
`EntityUtil.addDomainQueryParam`. The estate-wide walkers had no `ListFilter` to push the
condition into, so they paged every row and computed over the whole estate: a user confined to a
domain by `DomainOnlyAccessRole` (or any asset-level deny rule) saw other domains' AI assets
named and counted in every governance view while the by-id reads returned 403.

## Decision

Every estate-wide AI governance read narrows each listed page to the caller's viewable assets
*before* anything is aggregated — counts, top-N cuts, events and breach rows alike. Narrowing
uses the same per-asset `ViewBasic` decision a direct read gets (`ViewPermissionFilter` on
request threads; `DefaultAuthorizer.authorizeUser` as the recorded user on workers), failing
closed, with admins unrestricted. The type-level `VIEW_ALL` checks stay: they gate whether the
caller may ask estate-wide questions at all; the per-asset filter decides which assets answer.

## Consequences

A governance view can never disagree with the by-id endpoint about an asset. Callers pay one
authorization pass per listed page; the walkers page in memory, so estates large enough to feel
that cost must move to search aggregations (already noted on `DashboardRollup`). The
`addDomainQueryParam`-style SQL narrowing is not an alternative here: it covers only the literal
domain-only role, not other deny rules, and cannot run where there is no `SecurityContext`.
