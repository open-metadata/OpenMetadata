# The focused Studio graph draws only the links its walk followed

- **Status:** Accepted
- **Revisions:** v1 2026-11-15 (initial) · v2 2026-11-15 (UI guards moved to Collate)
- **Deciders:** Ontology Studio program
- **Guard:** `studioFocusedGraph.test.ts` *(openmetadata-collate)* ("draws only the links the walk followed, not those between two outer concepts"), `OntologyGraphView.test.tsx` *(openmetadata-collate)* ("above the node limit"), `OntologyLargeGraph.spec.ts` *(openmetadata-collate)*
- **Related:** open-metadata/OpenMetadata#37821, supersedes ADR:2026-11-02-studio-graph-draws-a-neighbourhood-above-500-concepts

## Context
ADR:2026-11-02-studio-graph-draws-a-neighbourhood-above-500-concepts focuses the graph on a
neighbourhood of at most 120 concepts above 500, and drew every relation whose two ends were both
in that neighbourhood. On HL7 FHIR R5 (1,076 concepts, 7,603 relations) focusing `DomainResource`
filled the 120 slots with its subclasses, and almost all of them point at the same few datatypes
(`string`, `code`, `canonical`, `CodeableConcept`). The induced relations between those outer
concepts drew a solid mesh in which no single link could be followed. Design review asked for
less overlap.

## Decision
Everything in ADR:2026-11-02-studio-graph-draws-a-neighbourhood-above-500-concepts stands except
which relations are drawn:

- `STUDIO_GRAPH_NODE_LIMIT = 500`, `STUDIO_FOCUS_NODE_CAP = 120`, `STUDIO_FOCUS_DEPTH = 2`, the
  seeds (the selected concept and Find matches), the no-seed message and the focused notice are
  unchanged.
- Above the limit, `buildStudioGraphScope` (`utils/studioFocusedGraph.ts`) draws a relation only
  when both ends are in the scope **and** it either touches a seed or is the link the walk reached
  one of its ends through. A relation between two non-seed concepts that the walk did not follow
  is not drawn, even when both ends are shown.
- Selecting a concept re-centres the scope on it, which is how its own links are seen.
- At 500 concepts or fewer, nothing changes: the whole ontology and all its relations are drawn.

## Consequences
The focused view reads as a tree around the seed: one link per shown concept plus the seed's own.
A relation between two shown outer concepts is invisible until one of them is selected, so the
focused canvas is not a complete picture of the scope; Tree, the concept drawer and re-centring
are. Revisit if parallel properties between the same two concepts are merged into one drawn link,
or if users need cross-links in the focused view (e.g. a toggle to show them).

## Amendment

v2 (2026-11-15): the Ontology Studio UI moved to Collate (ADR:2026-11-15-ontology-studio-ui-ships-only-in-collate). The guard files marked *(openmetadata-collate)* moved with it, at the same paths under `collate-ui/src/main/resources/ui/`, and the parts of this rule they check now govern Collate's code. The rest is unchanged.
