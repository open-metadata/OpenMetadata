# A live rule is stated once, and a saved query may belong to one ontology

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial)
- **Deciders:** OpenMetadata maintainers
- **Guard:** IndependentOntologyAxiomIT, NativeOntologyImportItemsTest, SavedSparqlQueryServiceTest, rdfAPI.test.ts
- **Related:** #37882, #37883, open-metadata/openmetadata-collate#8596, ADR:2026-10-19-native-ontology-imports-use-working-drafts

## Context

Ontology Studio let an author add "Patient must have exactly 1 patient id" twice. The server stored
identical rules from the REST API, change sets and CSV `AXIOM` rows, and the Studio listed each.
Separately, saved SPARQL queries were stored per user with no ontology, so Ontology Studio listed
queries saved in other, and deleted, ontologies inside a brand-new one.

## Decision

1. Every ontology write refuses, with 400, a live rule (axiom) whose subject, type and
   `NativeOntologyDocument.signature` equal another live rule's in the same ontology. The check
   runs in `OntologyWorkingModel.requireValid`, which every write path uses, only for a rule whose
   structure the write changed, so rules stored before this record do not block unrelated edits.
   It reads at most 10,000 same-subject rules of the type and refuses the write beyond that, the
   working model's existing closure limit.
2. `savedSparqlQuery` carries an optional `ontologyId`. The server keeps it as sent, and every
   client that replaces the saved-query library sends it back unchanged. Ontology Studio
   (openmetadata-collate) records it when a query is created or saved there and lists a query only
   in that ontology. A query without it is unscoped and lists only outside a specific ontology.

## Consequences

Duplicates can no longer enter through any path, and an import that repeats a rule reports a
duplicate instead of failing at apply. Ontology Studio's "My queries" no longer shows other
ontologies' queries; queries saved before this record have no `ontologyId` and appear only in the
all-ontologies view. A client that rebuilds saved queries field by field must keep `ontologyId`, or
a save from it unscopes every Studio query. Revisit if rules ever need intentional repeats, for
example annotated copies with different provenance.
