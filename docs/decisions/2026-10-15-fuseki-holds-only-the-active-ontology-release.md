# Fuseki holds only the active ontology release

- **Status:** Accepted
- **Revisions:** v1 2026-10-15 (initial)
- **Deciders:** Harsha
- **Guard:** `IndependentOntologyActivationIT`, `OntologyReleaseActivationTest`, `OntologyActiveGraphStorageTest`, `RdfOntologyActivationIT`, `RdfBlueGreenRebuildIT`, `RdfLiveWriteRecoveryIT`, reviewer
- **Related:** [Organizational ontology design](../plans/2026-10-14-organizational-ontology-design.md), ADR:2026-10-14-ontology-releases-seal-canonical-sql-members

## Context

Working definitions, review candidates and older releases have different governance states.
Projecting all of them into the serving RDF dataset would mix meanings that an organization has
not selected. SQL already retains immutable release members and the active release pointer.

## Decision

Keep one asserted graph per ontology at `https://open-metadata.org/graph/ontology/{id}`. It contains
only that ontology's active release. Working edits and approval alone do not change it. Historical
releases remain readable and exportable from SQL, without separate serving graphs.

Activation requires edit permission on the ontology, a sealed release owned by it, completed
independent workflow approval, and successful structural and supported OWL 2 DL validation of its
pinned closure. Logical consistency is explicitly `NOT_RUN` until the remote Jena `CHECK` path is
available. The in-server gate does not run an OWL reasoner; OWLAPI remains a test dependency.

Compare the caller's expected activation revision under the ontology state lock. A mismatch is
409. Commit the pointer, incremented revision, append-only activation event, and durable RDF command
in one SQL transaction. Enqueue the RDF command last to retain queue commit order. Rollback uses
the same operation with an older approved release and produces another activation event.

The command carries the ontology ID and reads the current active pointer when applied. Replace the
whole graph atomically with Graph Store PUT, including an empty graph for an archived/deleted owner.
Restoration reprojects the retained active release. Graph replacement participates in the existing
rebuild journal so an activation during a rebuild survives promotion. Rebuilds reconstruct active
graphs from SQL and remove orphan ontology graphs.

RDF-disabled installations can activate releases. Enabling RDF and rebuilding projects their active
content. An unavailable Fuseki does not roll back a committed activation: the durable queue retries
and existing projection health describes lag or failure.

## Consequences

SQL is the publication authority. Fuseki is a rebuildable serving projection, with eventual delivery
and atomic per-graph replacement. The union default graph still combines IRIs shared by different
active ontologies; callers needing module isolation use a named `GRAPH`.

Older servers cannot decode the new live-write command during a mixed-version deployment; complete
the upgrade and rebuild any dead-lettered projection. Raising release/projection size limits needs
measured capture, journal and Fuseki capacity evidence. Activation checks the existing 16 MiB
encoded RDF journal limit before committing, including when RDF is disabled, so every activated
release remains replayable during a later rebuild.
