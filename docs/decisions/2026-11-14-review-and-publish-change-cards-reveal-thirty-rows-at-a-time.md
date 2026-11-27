# The Review & publish change cards reveal thirty rows at a time

- **Status:** Accepted
- **Revisions:** v1 2026-11-14 (initial) · v2 2026-11-15 (UI guards moved to Collate)
- **Deciders:** UI team
- **Guard:** `OntologyReleaseChangeCards.test.tsx` *(openmetadata-collate)* — "shows 30 rows and loads 30 more on each Load more"
- **Related:** open-metadata/OpenMetadata#37814, ADR:2026-11-13-concept-drawer-reveals-relationships-ten-at-a-time, ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48

## Context

The Review & publish dialog groups a draft's changes into one card per kind (Concepts, Properties,
Rules…). A large import such as FIBO puts 1000 concepts on a single server page, and each card
rendered every row, so the dialog opened on a list thousands of rows long. Design review asked for
a short first view with Load more.

The rows of the current server page are already in the client; Load more fetches nothing.
ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48 sets the paged-list scale and leaves
"show more" previews out of scope, so it does not decide this list.

## Decision

- Each change card shows **30 rows at a time**, on the client.
- **Load more** adds 30 more rows. It disappears once every row on the current server page is
  shown, and a "showing N of M" count sits beside it.
- Load more only reveals rows already on the current server page; **Previous / Next** still pages
  the server.
- The value lives in `CHANGE_ROWS_PAGE_SIZE` (`OntologyReleasePanel.constants.ts`).
- This is a show-more reveal, not a paged view, so the 15/25/50 list scale does not apply.

## Consequences

- The dialog opens on a short list for any size of draft, and the validation and version panels
  stay beside it.
- A row past the first 30 needs Load more or the change search to reach.
- A card keeps its revealed count when the filter or search changes.
- Revisit if the change list moves to a server-paged endpoint per kind. That list would follow the
  15/25/50 scale instead.

## Amendment

v2 (2026-11-15): the Ontology Studio UI moved to Collate (ADR:2026-11-15-ontology-studio-ui-ships-only-in-collate). The guard files marked *(openmetadata-collate)* moved with it, at the same paths under `collate-ui/src/main/resources/ui/`, and the parts of this rule they check now govern Collate's code. The rest is unchanged.
