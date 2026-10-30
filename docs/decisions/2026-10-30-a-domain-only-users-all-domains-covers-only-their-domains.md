# A domain-only user's "All Domains" covers only their domains

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `UserResourceIT.test_domainOnlyUserWithNoPickSeesOnlyTheirDomains`,
  `SearchListFilterTest.testNavbarScopeMatchesEachOfSeveralDomains`, `NavBar.test.tsx`
- **Related:** #36483, ADR:2026-10-29-mostly-global-lists-keep-unassigned-items-under-a-domain-pick

## Context
A user with `DomainOnlyAccessRole` and several domains had no "All Domains" in the navbar. Lists
that follow only the navbar pick (search-backed entity lists, glossary terms, the column grid, the
metrics hierarchy, Data Insights charts) apply no role check of their own, so with no pick, or a
pick outside the user's domains, they listed other domains' items.

## Decision
- The navbar offers "All Domains" to every user with more than one domain, restricted or not.
- `EntityUtil.navbarScope` is the one place that decides what a pick-following list narrows to:
  the pick for an unrestricted user; for a domain-only user the pick when it is one of theirs,
  else all of their domains (with sub-domains). A domain-only user with no domains matches none.
- Lists that enforce the role themselves (`EntityUtil.addDomainQueryParam`, `/search/query`) are
  unchanged.

## Consequences
A new list that follows the pick must go through `navbarScope` (via the existing `EntityUtil`
helpers), or it can show a domain-only user other domains' items.
