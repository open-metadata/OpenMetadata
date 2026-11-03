# Reading an ontology's working draft requires EditAll on the ontology

- **Status:** Accepted
- **Revisions:** v1 2026-11-03 (initial)
- **Deciders:** Ontology Studio program
- **Guard:** `OntologyResourceAccessTest`, `IndependentOntologyDraftReadIT`, `IndependentOntologyAuthorizationIT`
- **Related:** ADR:2026-11-02-ontology-reviewers-vote-without-edit-rights, `OntologyResourceAccess.requireDraftRead`, `useOntologyStudioModel.ts`

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
- A list that names an ontology (`ontology` or `ontologyId`) needs `EditAll` on that ontology. A
  list that names none needs `EditAll` on ontologies as a type, so an owner-scoped grant does not
  open it.
- The existing per-definition view check on the snapshot stays in place after the new check.
- Reading one definition by id or name is unchanged.
- The Studio reads the active release when the working list is refused, and shows an ontology
  with no active release as empty, so a reader never sees an error
  (`useOntologyStudioModel.ts`).

## Consequences
- A DataConsumer sees published content only, through every endpoint.
- A concept owner without `EditAll` on the ontology edits that concept, but the Studio draws the
  graph from the active release while they do. Loading the draft for them would need a per-concept
  read path.
- To revert to view access for a read, change `requireDraftRead` and the Viewer IT together.
