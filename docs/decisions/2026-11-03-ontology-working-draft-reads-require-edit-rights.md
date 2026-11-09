# Reading an ontology's working draft requires EditAll on the ontology

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial); v2 2026-11-03 (change sets); v3 2026-11-05 (rows of an unscoped list); v3 amended 2026-11-05 (glossary scopes taken from the page)
- **Deciders:** Ontology Studio program
- **Guard:** `OntologyResourceAccessTest`, `ListFilterTest`, `IndependentOntologyDraftReadIT`, `IndependentOntologyAuthorizationIT`
- **Related:** ADR:2026-11-02-ontology-reviewers-vote-without-edit-rights, `OntologyResourceAccess.requireDraftRead`, `useOntologyStudioModel.ts`, `OntologyMemoryReviewPanel.tsx`

## Context
An ontology has two readable states: the working draft, which holds changes no release has
published, and the active release, which is what consumers read. Four draft reads used two rules.
`POST /v1/ontologies/{id}/sparql?scope=draft` required `EditAll`, while `GET .../working/diff`,
`GET .../working/validation` and the draft `GET .../export` required only view access. The list
endpoints for concepts, properties and axioms returned working definitions to any viewer, as did
`GET .../references`. A role that may only read therefore saw unpublished content through some
endpoints and not others.

## Decision
- Every read of working-draft content requires `EditAll` on the ontology. Release reads (the
  release, its members, release export, release-scoped SPARQL) keep view access.
- The rule covers `POST /v1/ontologies/{id}/sparql?scope=draft`, `GET .../working/diff`,
  `GET .../working/validation`, `GET .../export`, `GET .../references`, and the lists
  `GET /v1/ontologyConcepts`, `/v1/ontologyProperties` and `/v1/ontologyAxioms`.
- A change set holds operations that no release has published, so reading one needs the edit
  right on its scope, the right `authorizeScope` checks for submit. That covers
  `GET /v1/ontologyChangeSets/{id}`, `GET .../{id}/versions`, `GET .../{id}/versions/{version}`
  and the list `GET /v1/ontologyChangeSets`. A native change set needs `EditAll` on its ontology.
  A glossary-scope change set needs `EditAll` on each of its glossaries, or `Create` on a glossary
  it plans to create. The rule holds in every state: applying a native change set writes the
  working draft, and a release is a separate publish, so no state holds only published content.
- The change-set list takes `ontology` (name) or `ontologyId` and then needs `EditAll` on that
  ontology, as the concept lists do. A list that names neither needs `EditAll` on ontologies as a
  type. The server does not filter the page to the rows the caller may read: a filtered page
  breaks `paging.total` and the cursors, and lets a caller count drafts it cannot read. A request
  that names two different ontologies is a 400. `memorySourced` and `state` combine with the
  filter unchanged.
- A list that names an ontology (`ontology` or `ontologyId`) needs `EditAll` on that ontology. A
  list that names none needs `EditAll` on ontologies as a type and, in addition, `EditAll` on the
  ontology of every row on the returned page (v3). A change set in glossary scope is checked with
  the glossary rule above. Each distinct scope, ontology or glossary, is checked once per request, using the glossaries and
  operations the listed rows already carry rather than a read per row, and one refusal
  refuses the whole page. A conditional rule such as `noOwner()` passes on a context that holds no
  entity, so the type-level check alone cannot tell whose rows the page holds. The page is still
  not filtered, for the reason above.
- The existing per-definition view check on the snapshot stays in place after the new check.
- Reading one definition by id or name is unchanged: any viewer reads the working version of a
  concept, property or axiom, including one no release contains. This is an exception to the rule,
  kept because deep links and the Studio's concept panel read a single definition this way, and
  because gating it would need a release-membership lookup on every read. It exposes one
  definition at a time to a caller who already knows its id or name; it exposes no listing, diff,
  validation, export or query.
- The Studio reads the active release when the working list is refused, and shows an ontology
  with no active release as empty, so a reader never sees an error
  (`useOntologyStudioModel.ts`).

## Consequences
- A glossary editor who lacks `EditAll` on ontologies as a type can no longer list change sets
  without naming an ontology, and the listing never includes glossary-scope change sets under an
  ontology filter. Such a user reads a glossary change set by id.
- A listed reviewer of an ontology reads no change set through these endpoints: reviewers vote
  through the assigned review task, not the change set.
- A DataConsumer sees published content only, through every endpoint.
- A concept owner without `EditAll` on the ontology edits that concept, but the Studio draws the
  graph from the active release while they do. Loading the draft for them would need a per-concept
  read path.
- Closing the by-id exception needs a membership lookup against the active release and a
  published-version fallback for the single-definition read.
- To revert to view access for a read, change `requireDraftRead` and the Viewer IT together.
