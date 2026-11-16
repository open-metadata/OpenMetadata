# The Ontology Studio concept drawer reveals a concept's relationships ten at a time

- **Status:** Accepted
- **Revisions:** v1 2026-11-13 (initial) · v2 2026-11-15 (the live-data Search around picker follows the same reveal) · v3 2026-11-15 (UI guards moved to Collate)
- **Deciders:** UI team
- **Guard:** `OntologyConceptInspector.test.tsx` *(openmetadata-collate)* — "lists ten relationships at a time and loads the next ten on demand"; `OntologyConceptLiveData.test.tsx` *(openmetadata-collate)* — "lists ten search-around steps and shows the rest on Show more"
- **Related:** open-metadata/OpenMetadata#37774, ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48

## Context

In large class hierarchies (FIBO, HL7 FHIR) a single concept can have hundreds of `is a` and other
relationships. The concept drawer listed them all, so the Properties, Rules and Data assets
sections sat far below a long scroll. Design review asked for a short first view with Load more.

The relationships are already in the client-side model when the drawer opens; nothing is fetched
per page. ADR:2026-10-13-ui-page-sizes-lists-15-25-50-grids-12-24-48 sets the paged-list scale and
leaves "show more" previews out of scope, so it does not decide this list.

## Decision

- The concept drawer lists a concept's relationships **10 at a time**, on the client.
- **Load more** adds 10 more; it disappears once every relationship is shown. The section count
  keeps the full total.
- The count resets to 10 when another concept is selected.
- The value lives in `RELATION_PAGE_SIZE` (`OntologyConceptInspector.constants.ts`).
- This is a show-more reveal, not a paged view, so the 15/25/50 list scale does not apply.

## Consequences

- The drawer's later sections stay within reach for concepts with long hierarchies.
- A relationship past the first 10 needs Load more (or the graph) to reach; there is no search
  within the list.
- Revisit if relationships move to a server-paged endpoint — that list would follow the 15/25/50
  scale instead.

## Amendment — v2 2026-11-15

The live-data **Search around** picker in the same drawer lists a concept's hop options (one per
relationship and direction) and had the same problem on large hierarchies: FHIR concepts list
dozens of steps. It follows this record:

- The picker lists **10 steps at a time**, on the client; **Show more** adds 10 and disappears once
  every step is shown.
- The count resets to 10 each time Search around is opened.
- The value lives in `STEP_PAGE_SIZE` (`OntologyConceptLiveData.tsx`), cited to this record.

v3 (2026-11-15): the Ontology Studio UI moved to Collate (ADR:2026-11-15-ontology-studio-ui-ships-only-in-collate). The guard files marked *(openmetadata-collate)* moved with it, at the same paths under `collate-ui/src/main/resources/ui/`, and the parts of this rule they check now govern Collate's code. The rest is unchanged.
