# Mostly global lists keep items with no domain under a domain pick

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial)
- **Deciders:** Sonika Shah
- **Guard:** `DomainNavFilterTest` (`apply_sharedConfigurationKeepsItemsWithNoDomain`,
  `apply_registeredExtensionTypeKeepsItemsWithNoDomain`), `SearchListFilterTest`
  (`testNavbarDomainCanKeepItemsWithNoDomain`), `UserResourceIT`
  (`test_pickKeepsArticlesAndAiPoliciesWithNoDomain`)
- **Related:** #33908

## Context
The navbar domain pick narrows every list of a type that supports domains to the picked domain and
its sub-domains. For data assets that is the point. Some types are mostly global, though: the
built-in AI governance frameworks, policies and controls ship with no domain, and most Context
Center articles never get one. Under any pick those lists came back empty, and an item created
under a pick without a domain disappeared from the list it was created in.

## Decision
- `DomainFilterExclusions.keepsUnassigned` names the types whose lists, under a pick, keep items
  with no domain and still drop items that belong to another domain: `aiGovernanceFramework`,
  `aiGovernancePolicy`, `aiFrameworkControl` and `page`.
- The rule is the same on the database list path (`domainAccessControl`) and the search list path
  (`SearchListFilter`, `navDomainKeepsUnassigned`), so a list does not change when it is sorted.
- A distribution adds its own types with `DomainFilterExclusions.registerKeepsUnassigned` when its
  repository is constructed (e.g. Collate's governance automations). It is a set of type names
  fixed at startup, not a cache.
- Types that must ignore the pick entirely (users, teams, tags, classifications, and types that
  inherit their domain from a table) stay in the existing exclusion list.

## Consequences
Every other type that supports domains keeps the strict rule: under a pick, items with no domain
are hidden. Moving a type between the strict rule and this one changes what its list shows under a
pick, and needs a new revision here.
