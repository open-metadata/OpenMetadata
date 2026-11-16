# A live rule is stated once, and a saved query may belong to one ontology

- **Status:** Accepted
- **Revisions:** v1 2026-11-16 (initial) · v2 2026-11-16 (the check is batched; the bound stays per subject) · v3 2026-11-16 (the check's read locks)
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
   The limits are in the amendment.
2. `savedSparqlQuery` carries an optional `ontologyId`. The server keeps it as sent, and every
   client that replaces the saved-query library sends it back unchanged. Ontology Studio
   (openmetadata-collate) records it when a query is created or saved there and lists a query only
   in that ontology. A query without it is unscoped and lists only outside a specific ontology.

## Consequences

Duplicates can no longer enter through any write path, including two concurrent writers: the
check's read takes `FOR UPDATE` locks, so on MySQL the second writer sees the first's committed
rule. An import that repeats a rule reports a duplicate instead of failing at apply. Ontology Studio's "My queries" no longer shows other
ontologies' queries; queries saved before this record have no `ontologyId` and appear only in the
all-ontologies view. A client that rebuilds saved queries field by field must keep `ontologyId`, or
a save from it unscopes every Studio query. Revisit if rules ever need intentional repeats, for
example annotated copies with different provenance.

## Amendment

v2, 2026-11-16: the check reads the live rules of up to 20 changed subjects per query
(`SUBJECTS_PER_RULE_QUERY` in `OntologyWorkingModel`) and signs each rule once. A first version
queried and re-signed the subject's rules for every changed rule, and the Brick pack install took
1381 s instead of 143.5 s and exhausted the connection pool; batched, it takes 181.6 s. The
working-model bound (`OntologyWriteClosureLimits.WORKING_MODEL_CLOSURE`, 10,000) still applies per
subject: a batch whose subjects together return more rows is halved until each part fits, and only
a single subject with more than 10,000 live rules refuses the write.

## Amendment

v3, 2026-11-16: the check reads with `FOR UPDATE`, like the working model's `ancestors` and
`disjointAxioms` reads and as ADR:2026-10-14-ontology-definitions-have-independent-entity-storage
asks for the reference/axiom join. Under MySQL REPEATABLE READ a plain SELECT can read a snapshot
from before a concurrent writer committed the same rule; a locking read sees the committed row.
PostgreSQL READ COMMITTED already did.
