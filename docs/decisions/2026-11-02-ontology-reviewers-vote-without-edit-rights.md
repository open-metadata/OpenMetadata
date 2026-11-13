# Ontology writes require edit rights; reviewers vote on assigned reviews

- **Status:** Accepted
- **Revisions:** v1 2026-11-02 (initial); v2 2026-11-02 (change-set create and submit, AI draft); v3 2026-11-03 (impact reassignment requires EditAll on each moved child); v4 2026-11-03 (DataSteward carries OntologyAuthorPolicy and edits ontology content)
- **Deciders:** Ontology Studio program
- **Guard:** `DefaultAuthorizerTest` (ontology reviewer case, glossary term reviewer case), `IndependentOntologyAuthorizationIT`, `OntologyAiResourceTest` `OntologyImpactIT.movingChildrenRequiresEditAllOnEachMovedChild`, and `OntologyRolesIT.builtInRolesAndTheirPoliciesAreSeeded`
- **Related:** ADR:2026-11-02-ontology-roles-are-seeded, `DefaultAuthorizer.isReviewer`, `OntologyResourceAccess.requireEditForContentPatch`, `OntologyImpactService.authorizeAffectedTerms`

## Context
`DefaultAuthorizer` lets a user listed in `reviewers` of a persisted entity skip policy evaluation.
That rule suits entities where a reviewer approves edits to the thing under review. An ontology
separates the roles: the person who votes on a release is not the person who captures or activates
it, and a vote needs no edit right because it is resolved through the assigned review task.

## Decision
- The reviewer rule does not apply to `ontology`, `ontologyConcept`, `ontologyProperty`,
  `ontologyRelease`, `ontologyAxiom` and `ontologyChangeSet`. Writes on them follow policy
  evaluation, so capturing and activating a release need `EditAll`.
- Every other entity type keeps the reviewer rule unchanged.
- A listed reviewer still resolves its assigned review task, whatever its roles.
- Patches that touch `/description` or `/tags` on an ontology, concept or property require
  `EditAll`. An edit to ontology content lands in the next release for everyone, so it follows the
  same right as the rest of the content instead of the per-field stewardship default.
- Bulk authoring, pattern instantiation, impact-based reassignment and glossary edit locks require
  `EditAll` on the glossary in place of `EditGlossaryTerms`. Impact-based reassignment also
  requires `EditAll` on each child it moves.
- Creating or submitting a glossary-scope change set, and requesting an AI domain draft for a
  glossary, require `EditAll` on the glossary scope.

## Consequences
- Ontology authoring is granted through roles or ownership. Listing a person as a reviewer grants
  no write right.
- A DataSteward can no longer change a concept or ontology description by PATCH. To restore the
  platform default for descriptions and tags, remove `requireEditForContentPatch` from the three
  PATCH handlers.
- The reviewer rule on other entity types is a separate review and is out of scope here.

## Amendment

v4 2026-11-03. The seeded roles give `DataSteward` the `OntologyAuthorPolicy`, in
`DataSteward.json` for new installs and in the `ontology-roles-on-data-steward` step of the v210
migration for installed catalogs (ADR:2026-11-02-ontology-roles-are-seeded). That policy grants
`EditAll` on `ontology`, `ontologyConcept` and `ontologyProperty`. The second Consequence above, "A
DataSteward can no longer change a concept or ontology description by PATCH", is therefore false on
a catalog where DataSteward keeps its seeded policies. The Decision itself is unchanged.

A DataSteward with the seeded policies can now do the following.

- Patch `/description`, `/tags` and every other field of an ontology, a concept or a property.
  `requireEditForContentPatch` still runs and passes, because the role holds `EditAll`.
- Create and delete ontologies, concepts, properties, axioms and change sets. Capture and activate
  releases, which check `EditAll` on the ontology. Read releases and request a release review,
  through `ViewAll` and `CreateTask` on `ontologyRelease`.

The glossary-scope rules still refuse a DataSteward. Bulk authoring, pattern instantiation,
impact-based reassignment, glossary edit locks, glossary-scope change sets and AI domain drafts
check `EditAll` on the glossary. `DataStewardPolicy` grants per-field rights on every resource,
such as `EditDescription`, `EditTags` and `EditGlossaryTerms`, but not `EditAll`.

Stewards became ontology authors so that a new or upgraded catalog has a built-in role, besides
an administrator, that can create an ontology in Studio. The content-PATCH rule still matters for
every role with per-field rights only. `DataConsumerPolicy` grants `EditDescription` and
`EditTags` on every resource, and `IndependentOntologyAuthorizationIT.dataConsumerCannotEditOntologyContent`
checks that a DataConsumer gets 403 when it patches the description or tags of a
concept, or the description of an ontology. `listedReviewerVotesButCannotCaptureOrActivate` and
`listedReviewerCannotChangeReviewSettings` now run their listed reviewer as `OntologyReviewer` in
place of `DataSteward`, because a DataSteward holds `EditAll` and would pass.

To make description edits by Stewards opt-in again, remove the two policies from DataSteward as the
roles record describes, and assign `OntologyAuthor` per person.
