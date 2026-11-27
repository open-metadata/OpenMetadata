# The Lineage page opens a domain or data product as its own card, and its search follows the level

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial)
- **Deciders:** Chirag Madlani
- **Guard:** `LineageMap.utils.test.ts` (`getSceneRequestFromSearch`, lone container cards in
  `isSceneEmpty`); `PlatformLineage.test.tsx` (search scope per level, clear);
  `PlatformLineage.spec.ts` (a domain opens as its own card and clearing returns to all domains)
- **Related:** #37678, #37685

## Context
In 2.0, picking a domain on the Lineage page showed that domain's card among its peers. The 2.1
map opened it drilled into its Data Assets instead. Its search always looked for data assets, so
at the Domain level it offered tables, and a picked result stayed as a chip that hid the input and
could not be cleared back to the whole platform.

## Decision
- `/lineage/domain/<fqn>` and `/lineage/dataProduct/<fqn>` open on that entity's lens at the Layer
  band, focused on it, when the URL carries no band. Once the map writes a band, the usual rules
  apply, so the root breadcrumb still leaves the domain.
- A lone service, domain or data product card is not an empty scene: its lineage is one drill away.
- At the Domain and Data Product levels the search looks only for domains or data products,
  without the data-asset exclusion filter. The Service level and the Data Assets and Field levels
  search data assets, so a table can still be found from the Lineage page.
- Switching lens keeps an asset in focus, seen through the new lens; a service, domain or data
  product exists only in its own lens, so switching from one opens the new lens's root.
- A pick leaves no chip; the placeholder names what the map is focused on, and a clear button
  returns to the whole platform in the current lens.

## Consequences
Domain and data product pages behave as in 2.0 and their links need no query string. A service
page still opens drilled into its databases; opening it as its own card would extend the first
rule to service entity types.
