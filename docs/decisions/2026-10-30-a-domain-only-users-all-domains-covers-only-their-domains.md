# A domain-only user's "All Domains" covers only their domains

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `UserResourceIT.test_domainOnlyUserWithNoPickSeesWhatTheRoleAllows`,
  `EntityUtilTest.addNavbarDomainFilter_roleScopeKeepsItemsWithNoDomain`,
  `EntityUtilTest.navbarRoleSearchFilter_scopesADomainOnlyUserWithNoPick`,
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
  else what the role allows: their domains (with sub-domains) plus items with no domain. A
  domain-only user with no domains then sees only items with no domain.
- DB lists that enforce the role themselves (`EntityUtil.addDomainQueryParam`) are unchanged.
- `/search/query` does not enforce the role unless search access control is on (off by default),
  so with no pick of theirs the server adds the role scope to it
  (`EntityUtil.navbarRoleSearchFilter`): their domains and sub-domains, those Domain documents, and
  items with no domain. Picker searches (users, teams, tags) are left unscoped, as in the UI.

## Consequences
A new list that follows the pick must go through `navbarScope` (via the existing `EntityUtil`
helpers), or it can show a domain-only user other domains' items. The `/search/query` scope
covers that endpoint only; other search endpoints (e.g. aggregations, NLQ) still need search
access control on to limit a domain-only user to their domains.
