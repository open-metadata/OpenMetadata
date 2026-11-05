# A domain-only user's "All Domains" removes the filter, not the role

- **Status:** Accepted
- **Revisions:** v1 2026-10-30 (initial); v2 2026-11-03 (the navbar filter no longer enforces the
  role)
- **Deciders:** Sonika Shah, Karan Hotchandani
- **Guard:** `NavBar.test.tsx`, `DomainScopeControl.test.tsx`,
  `SearchAggregateRbacIT.test_aggregate_accessControlOffShowsBothDomains`
- **Related:** #36483, #35148,
  ADR:2026-10-29-mostly-global-lists-keep-unassigned-items-under-a-domain-pick

## Context
A user with `DomainOnlyAccessRole` and several domains had no "All Domains" in the navbar, so once
they picked a domain they could not go back to all of theirs. v1 offered it and made every list that
follows the pick narrow such a user to their own domains, which made the navbar filter enforce the
role: it limited search even with search access control off, against the behaviour #35148 tests.

## Decision
- The navbar offers "All Domains" to every user with more than one domain, restricted or not.
- The navbar filter only narrows lists to the domain picked; with no pick it changes nothing. It
  never enforces access.
- Who sees what stays with the existing policies: DB lists enforce the role themselves
  (`EntityUtil.addDomainQueryParam`, where a pick narrows within the role), opening an entity is
  checked by `DomainOnlyAccessPolicy`, and search applies the role only when search access control
  (`enableAccessControl`) is on.

## Consequences
With search access control off (the default), a domain-only user on "All Domains" sees other
domains' assets in search results, as on main without a pick, and is denied when opening them. To
keep such users to their domains in search, turn search access control on.
