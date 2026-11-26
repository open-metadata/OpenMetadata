# Mostly global lists keep items with no domain under a domain pick

- **Status:** Accepted
- **Revisions:** v1 2026-10-29 (initial) · v2 2026-10-30 (tasks ignore the pick; article search keeps unassigned) · v3 2026-11-15 (task lists follow the pick, except on an asset) · v4 2026-11-15 (explicit domain filters include sub-domains; classifications and tags follow the pick) · v5 2026-11-16 (an asset's own activity ignores the pick; domain-only users keep their full scope on lists the pick never narrows)
- **Deciders:** Sonika Shah
- **Guard:** `DomainNavFilterTest` (`apply_sharedConfigurationKeepsItemsWithNoDomain`,
  `apply_registeredExtensionTypeKeepsItemsWithNoDomain`), `SearchListFilterTest`
  (`testNavbarDomainCanKeepItemsWithNoDomain`), `UserResourceIT`
  (`test_pickKeepsArticlesAndAiPoliciesWithNoDomain`, `test_pickDoesNotHideAssignedTasks`),
  `DomainNavFilterTest.shouldNotApply_forExcludedType`, `withDomainFilter.test.tsx`
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
- Types that must ignore the pick entirely (users, teams, and types that inherit their domain from
  a table) stay in the existing exclusion list. Tags and classifications left it in v4.

## Consequences
Every other type that supports domains keeps the strict rule: under a pick, items with no domain
are hidden. Moving a type between the strict rule and this one changes what its list shows under a
pick, and needs a new revision here.

## Amendment
v2 2026-10-30:
- Tasks and approvals are a user's work queue, so a navbar pick never narrows them. The backend
  excludes `task` in `DomainFilterExclusions`, and the UI interceptor (`withDomainFilter`) adds no
  `domain=` to `/tasks` requests unless the caller sets it (e.g. a domain page's tasks).
- The UI's article search (`/search/query` on the `page` index, used for text search, quick filters
  and search-only sorts) keeps items with no domain too, so searching or sorting the Articles list
  does not drop the global articles its list endpoint shows.

v3 2026-11-15 (replaces the tasks rule of v2):
- In the UI, task lists follow the pick like any other list: Home "My Tasks", the inbox, the
  notification bell and a user's Tasks tab show only tasks in the picked domain and its
  sub-domains. v2 left them unscoped on some screens and scoped on others, so the same task showed
  on Home and was missing from the profile.
- A task list about given assets (`aboutEntity`, `aboutEntityIds` or `dataset`, e.g. an asset's
  Tasks tab or a glossary's approvals) is not narrowed: an opened asset shows all its tasks, as the
  rest of its page does, and its count matches its list.
- `withDomainFilter` applies both rules; callers no longer add `domain=` to task requests
  themselves. The backend still excludes `task` from the server-side pick, so API clients see all
  their tasks and the endpoints narrow only on an explicit `domain`.
- Tasks with no domain are hidden under a pick, as on other strict lists.

v4 2026-11-15:
- An explicit `domain` filter on task and incident lists, and `domains` on the Data Quality search
  lists, matches the named domain and all its sub-domains, as the navbar pick does. Guards:
  `ListFilterTest.incidentDomainFilterMatchesEveryGivenDomainId`,
  `SearchListFilterTest.testDomainFilterMatchesTheDomainAndItsSubDomains`.
- Classifications and tags follow the pick like the other mostly global lists: under a pick they
  show the picked domain's items and items with no domain, and hide other domains' items.
  System-provided ones (e.g. Tier, PII, Certification) always stay listed, even when given a
  domain, so every asset can still be tiered and classified. Tag pickers search the tag index,
  which the UI leaves unscoped, so they still offer every tag. A tag whose domain is only
  inherited from its classification counts as having no domain in a flat tag list. Guards:
  `DomainNavFilterTest.classificationsAndTagsFollowThePickButKeepSystemProvidedOnes`,
  `ListFilterTest.getDomainCondition_keepsSystemProvidedItemsWhenAsked`.

v5 2026-11-16:
- An asset's own activity (`/activity/entity/{type}/{id}` and `/activity/entity/{type}/name/{fqn}`:
  its Activity tab and its count) is not narrowed by the pick, like its Tasks tab. Viewing it still
  needs permission to view the asset. The activity feed across assets (`/activity`) follows the
  pick. `withDomainFilter` applies the rule. Guard: `withDomainFilter.test.tsx`.
- For a domain-only user, the role limits every list to their domains, and the pick narrows within
  that scope, except on lists the pick never narrows (`DomainFilterExclusions`, e.g. a task list
  about an asset). Those keep the role's full scope, so an asset in another of the user's domains
  shows its tasks and its count matches its list. Guard:
  `EntityUtilTest.addDomainQueryParam_restrictedUserKeepsTheFullScopeForTypesThePickNeverNarrows`.
- An asset page whose data request returns 403 (e.g. a domain-only user opening another domain's
  asset) shows the permission message in place on the table, service and data product pages,
  naming the requested asset. The other asset pages still redirect to `/403` and are to move to
  the in-place message. Guard: `TableDetailsPageV1.test.tsx`, `ServiceDetailsPage.test.tsx`,
  `DataProductsPage.component.test.tsx`.
- A classification's tag count follows the pick like its tag list, on both the single and the batch
  path. Guard: `UserResourceIT.test_pickNarrowsClassificationTagsAndTheirCount`.
