# Native ontologies share Studio and memory review

- **Status:** Accepted
- **Revisions:** v1 2026-10-16 (initial) · v2 2026-10-20 (Context Center no longer links Studio drafts)
- **Deciders:** Product owner
- **Guard:** IndependentOntologyReleaseIT, IndependentOntologyActivationIT, ontology change-set integration tests, OntologyReview browser specs
- **Related:** ADR:2026-10-14-ontology-definitions-have-independent-entity-storage; ADR:2026-10-14-ontology-releases-seal-canonical-sql-members

## Context

Replacing the glossary Studio removed existing AI, memory review, library, import/export, leases,
query builder and exploration workflows. Native definitions need those entry points to coexist
with the glossary model. A memory proposal edits a working model; publication still requires an
independent review of the whole sealed release.

## Decision

Keep main's Studio and add native selection with Model and Releases surfaces. Glossary relations
continue to use their current entities and graph. Formal axiom authoring selects a native ontology.

A change set targets either its existing glossary scope or one native ontology, never both. Native
operations carry typed concept, property or axiom payloads and source-memory references. Applying
them holds the same per-ontology lock as ordinary edits and capture, checks the working revision,
and validates the resulting model atomically through `OntologyWorkingState`. Memory proposal review
uses the existing Studio panel, including Context Center's `?draft=` links. Applying a proposal
updates working content; it does not approve or activate a release.

Release encoding `ontology-release-v1` explicitly selects identity and semantic fields. Audit and
permission fields are not sealed content; readers tolerate unknown historical fields, while the
manifest still verifies the original bytes. Current ownership is used for authorization. A review
binds only the release id, release revision and immutable content digest. Temporary authorization
or availability failures remain retryable, rather than cancelling a review.

Native SPARQL reads the verified SQL projection of the active release. It uses the same assertions
as the active Fuseki graph, remains consistent while an outbox write is pending, and requires view
access to every captured member. It cannot read working edits, other graphs or external services.

## Consequences

The SQL model, approval task and active pointer remain authoritative. General field-approval staging
must not hold native working edits: the release is their publication approval unit. Native metadata
labels, data exploration through those labels, library installation, import, AI generation and
visual query generation require explicit native adapters; preserving their glossary workflows does
not claim those adapters are complete. The capability matrix records their delivery status.

## Amendment

v2, 2026-10-20: memories now become Draft glossary terms through the AI provider, so Context Center
no longer opens memory-sourced Studio drafts through `?draft=` links; native memory drafts are
reviewed from Ontology Studio's memory review panel. See
ADR:2026-10-19-memories-become-draft-glossary-terms-through-the-ai-provider.
